// 导出逻辑：把工程里的刀转换成 SlashBlade: Resharped 1.20.1 认识的数据包/附属包
const crypto = require('crypto');
const JSZip = require('jszip');

const PACK_FORMAT = 15;

function rl(ns, id) {
  return `${ns}:${id}`;
}

function sanitizePath(s) {
  return String(s || 'blade').toLowerCase().replace(/[^a-z0-9_./-]/g, '_');
}

function slug(s) {
  return String(s || 'blade').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'blade';
}

/** 生成刀定义 JSON（data/<ns>/slashblade/named_blades/<id>.json） */
function bladeDefinition(ns, blade) {
  const props = {
    attack_base: Number(blade.attack) || 4.0,
    max_damage: Math.max(1, Math.round(Number(blade.dur) || 40)),
    root_combo: blade.rootCombo || 'slashblade:standby',
  };
  if (blade.slashArt) props.slash_art = blade.slashArt;
  if (blade.unbreakable) props.unbreakable = true;
  const types = (blade.types || []).filter((t) => t && t !== 'NONE');
  if (types.length) props.sword_type = types.map((t) => t.toLowerCase());
  const effects = (blade.effects || []).filter(Boolean);
  if (effects.length) props.special_effects = effects;

  const render = {
    model: blade.modelRef,
    texture: blade.textureRef,
    summon_sword_color: hexToArgb(blade.summonColor || '#3333ff'),
  };
  if (blade.colorInverse) render.color_inverse = true;
  if (blade.carry) render.carry_type = blade.carry.toLowerCase();

  const def = {
    name: rl(ns, blade.id),
    properties: props,
    render,
  };
  // item 在官方 codec 里是可选的，缺省就是 slashblade:slashblade；只有用户改成别的物品时才写
  if (blade.itemRef && blade.itemRef !== 'slashblade:slashblade') def.item = blade.itemRef;
  const ench = (blade.enchants || []).filter((e) => e && e.id);
  if (ench.length) def.enchantments = ench.map((e) => ({ id: e.id, lvl: Math.max(1, Number(e.lvl) || 1) }));
  if (blade.creative) def.creativeGroup = blade.creative;
  return def;
}

/* ---- 官方 codec 白名单（取自 SlashBlade: Resharped 1.9.65 的
   PropertiesDefinition / RenderDefinition / SlashBladeDefinition / EnchantmentDefinition
   codec 字段名，以及 SwordType、CarryType 两个枚举的真实取值）---- */
const CODEC_TOP = new Set(['name', 'item', 'properties', 'render', 'enchantments', 'creativeGroup']);
const CODEC_PROPS = new Set(['attack_base', 'max_damage', 'root_combo', 'slash_art', 'special_effects', 'sword_type', 'unbreakable']);
const CODEC_RENDER = new Set(['model', 'texture', 'summon_sword_color', 'color_inverse', 'carry_type']);
const CODEC_ENCH = new Set(['id', 'lvl']);
const SWORD_TYPE_OK = new Set(['none', 'edgefragment', 'broken', 'enchanted', 'bewitched', 'fierceredge', 'noscabbard', 'sealed', 'unbreakable', 'souleater']);
const CARRY_TYPE_OK = new Set(['none', 'default', 'pso2', 'ninja', 'katana', 'rninja']);
const ID_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;

/** 按官方 codec 审计一把刀：键名拼错、枚举越界、资源 ID 写法不合规都会报出来 */
function auditDefinition(def) {
  const issues = [];
  const bad = (tag, text) => issues.push(['bad', tag, text]);
  const warn = (tag, text) => issues.push(['warn', tag, text]);

  for (const k of Object.keys(def)) {
    if (!CODEC_TOP.has(k)) bad('字段名', `顶层键「${k}」官方 codec 不认，写进去会被静默忽略`);
  }
  const props = def.properties || {};
  for (const k of Object.keys(props)) {
    if (!CODEC_PROPS.has(k)) bad('字段名', `properties 里没有「${k}」这个键，官方不认`);
  }
  const render = def.render || {};
  for (const k of Object.keys(render)) {
    if (!CODEC_RENDER.has(k)) bad('字段名', `render 里没有「${k}」这个键，官方不认`);
  }
  for (const e of (def.enchantments || [])) {
    for (const k of Object.keys(e)) {
      if (!CODEC_ENCH.has(k)) bad('字段名', `enchantments 里没有「${k}」这个键`);
    }
  }

  for (const t of (props.sword_type || [])) {
    if (!SWORD_TYPE_OK.has(String(t).toLowerCase())) bad('剑型枚举', `「${t}」不是合法的 SwordType（合法值：${[...SWORD_TYPE_OK].join(' / ')}）`);
  }
  if (props.sword_type && props.sword_type.length && props.unbreakable
    && props.sword_type.some((t) => String(t).toLowerCase() === 'unbreakable')) {
    warn('剑型枚举', 'unbreakable 同时出现在 sword_type 与 properties.unbreakable，两处都写属于重复');
  }
  if (render.carry_type && !CARRY_TYPE_OK.has(String(render.carry_type).toLowerCase())) {
    bad('持刀姿态', `「${render.carry_type}」不是合法的 CarryType（合法值：${[...CARRY_TYPE_OK].join(' / ')}）`);
  }

  for (const key of ['root_combo', 'slash_art']) {
    const v = props[key];
    // slash_art 完全缺冒号的情况交给工程体检的基础校验去报，这里只抓「像 id 但格式脏」的
    if (key === 'slash_art' && v && !String(v).includes(':')) continue;
    if (v && !ID_RE.test(v)) bad('资源 ID', `${key}「${v}」不是合法的 命名空间:路径`);
  }
  for (const key of ['model', 'texture']) {
    if (render[key] && !ID_RE.test(render[key])) bad('资源 ID', `${key}「${render[key]}」不是合法的 命名空间:路径`);
  }
  for (const eff of (props.special_effects || [])) {
    if (!ID_RE.test(String(eff))) bad('资源 ID', `special_effects「${eff}」不是合法的 id`);
  }
  for (const e of (def.enchantments || [])) {
    if (!ID_RE.test(String(e.id || ''))) bad('附魔 ID', `「${e.id || '（空）'}」不是合法的附魔 id`);
    // lvl 在官方 codec 里可有可无（缺省按 1 级），只有写了但越界才提示
    if (e.lvl !== undefined && e.lvl !== null) {
      const lvl = Number(e.lvl);
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > 255) warn('附魔等级', `「${e.id}」等级 ${e.lvl} 超出 1-255，游戏会截断`);
    }
  }

  const col = render.summon_sword_color;
  if (col !== undefined && (!Number.isInteger(col) || col < 0 || col > 4294967295)) {
    bad('刀光颜色', `summon_sword_color 必须是 0-4294967295 的整数（ARGB），当前是 ${col}`);
  }
  if (def.item && !ID_RE.test(def.item)) bad('承载物品', `item「${def.item}」不是合法的物品 id`);
  if (def.creativeGroup && !ID_RE.test(def.creativeGroup)) bad('创造分组', `creativeGroup「${def.creativeGroup}」不是合法的 id`);
  if (!def.name || !ID_RE.test(def.name)) bad('刀定义 name', `name「${def.name || '（空）'}」不是合法的 命名空间:刀id`);
  return issues;
}

/** 配方结构审计：pattern/key/刀坯 request 是不是游戏认得的形状 */
function auditRecipe(rec) {
  if (!rec) return [];
  const issues = [];
  const bad = (tag, text) => issues.push(['bad', tag, text]);
  const warn = (tag, text) => issues.push(['warn', tag, text]);
  if (rec.type === 'slashblade:shaped_blade') {
    const p = Array.isArray(rec.pattern) ? rec.pattern : [];
    if (!p.length) bad('配方结构', 'pattern 是空的，游戏读不出摆法');
    else {
      if (p.length > 3) bad('配方结构', `pattern 有 ${p.length} 行，工作台最多 3 行`);
      const w = p[0].length;
      if (w > 3) bad('配方结构', `pattern 每行 ${w} 个字符，工作台最多 3 列`);
      if (p.some((row) => String(row).length !== w)) bad('配方结构', 'pattern 各行长度不一致，游戏会直接拒绝');
      const chars = new Set(p.join('').replace(/ /g, '').split(''));
      const keyChars = new Set(Object.keys(rec.key || {}));
      for (const ch of chars) if (!keyChars.has(ch)) bad('配方结构', `pattern 里的「${ch}」在 key 里没定义`);
      for (const k of keyChars) if (!p.join('').includes(k)) warn('配方结构', `key 里的「${k}」在 pattern 里没用上，属于冗余`);
    }
    if (!rec.key || !Object.keys(rec.key).length) bad('配方结构', 'key 是空的');
    const hasBladeIngredient = Object.values(rec.key || {}).some((v) => v && v.type === 'slashblade:blade');
    if (!hasBladeIngredient) bad('配方结构', '配方里没有「刀坯」材料，做出来只是普通物品，拿不到刀');
    for (const [k, v] of Object.entries(rec.key || {})) {
      if (!v || (!v.item && !v.tag)) {
        bad('配方结构', `key「${k}」既没有 item 也没有 tag，游戏读不出这格要什么`);
        continue;
      }
      const ref = v.tag || v.item;
      if (!ID_RE.test(String(ref))) bad('配方结构', `key「${k}」的 ${v.tag ? '标签' : '物品'} id「${ref}」不合法`);
      if (v.type === 'slashblade:blade' && !(v.request && v.request.name)) bad('配方结构', `key「${k}」的刀坯缺少 request.name，做出来的刀没有定义`);
    }
    if (!ID_RE.test(String(rec.blade || ''))) bad('配方结构', `blade「${rec.blade || '（空）'}」不是合法的刀 id`);
  } else if (rec.type === 'slashblade:slashblade_smithing') {
    for (const k of ['template', 'base', 'addition']) {
      const v = rec[k];
      if (!v || (!v.item && !v.tag)) bad('配方结构', `锻造台的 ${k} 缺失，或者既没有 item 也没有 tag`);
    }
    if (!ID_RE.test(String(rec.blade || ''))) bad('配方结构', `blade「${rec.blade || '（空）'}」不是合法的刀 id`);
  }
  return issues;
}

/** 对整份工程逐刀跑一次官方 codec 审计 */
function auditProject(project) {
  const ns = sanitizePath(String(project.namespace || 'blade').toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const out = [];
  const byId = new Map((project.blades || []).map((b) => [b.id, b]));
  for (const blade of (project.blades || [])) {
    if (!blade || !blade.id) continue;
    const name = blade.zh || blade.en || blade.id;
    const def = bladeDefinition(ns, blade);
    for (const [lv, tag, text] of auditDefinition(def)) out.push({ bladeId: blade.id, name, lv, tag, text });
    let rec = null;
    try { rec = bladeRecipe(ns, blade, byId); } catch (e) { out.push({ bladeId: blade.id, name, lv: 'bad', tag: '配方结构', text: '配方生成异常：' + e.message }); }
    for (const [lv, tag, text] of auditRecipe(rec)) out.push({ bladeId: blade.id, name, lv, tag, text });
  }
  return out;
}

function hexToArgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return 0xff3333ff;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

/** 生成配方 JSON；返回 null 表示没有配方 */
function bladeRecipe(ns, blade, byId) {
  const r = blade.recipe || {};
  if (!r.type || r.type === 'none') return null;
  const material = r.material || 'slashblade:proudsoul';
  const core = r.core || 'slashblade:proudsoul_sphere';
  const id = blade.id;

  // 锻造台：模板 + 基底（源刀）+ 添加物
  if (r.type === 'smithing') {
    const src = byId.get(r.source);
    if (!src) return null;
    const request = { name: rl(ns, src.id) };
    if (Number(r.kill) > 0) request.kill = Math.round(Number(r.kill));
    if (Number(r.refine) > 0) request.refine = Math.round(Number(r.refine));
    if (Number(r.proud) > 0) request.proud_soul = Math.round(Number(r.proud));
    const template = r.template || 'minecraft:netherite_upgrade_smithing_template';
    const addition = r.addition || 'minecraft:netherite_ingot';
    return {
      type: 'slashblade:slashblade_smithing',
      template: template.startsWith('#') ? { tag: template.slice(1) } : { item: template },
      base: { type: 'slashblade:blade', item: blade.itemRef || 'slashblade:slashblade', request },
      addition: addition.startsWith('#') ? { tag: addition.slice(1) } : { item: addition },
      blade: rl(ns, id),
    };
  }

  const src = r.type === 'upgrade' ? byId.get(r.source) : null;
  if (r.type === 'upgrade' && !src) return null;

  const request = r.type === 'upgrade' ? { name: rl(ns, src.id) } : { name: rl(ns, id) };
  if (Number(r.kill) > 0) request.kill = Math.round(Number(r.kill));
  if (Number(r.refine) > 0) request.refine = Math.round(Number(r.refine));
  if (Number(r.proud) > 0) request.proud_soul = Math.round(Number(r.proud));

  const bladeItem = blade.itemRef || 'slashblade:slashblade';

  // 自定义 3×3 网格：每格可为 'blade' / 'material' / 'core' / 任意物品 id / 空
  if (Array.isArray(r.grid) && r.grid.some((c) => c)) {
    const cells = r.grid.slice(0, 9).concat(new Array(Math.max(0, 9 - r.grid.length)).fill(''));
    const key = {};
    const syms = { blade: 'B', material: 'S', core: 'C' };
    const freeChars = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const itemSym = new Map();
    let freeIdx = 0;
    const symOf = (cell) => {
      if (!cell) return ' ';
      if (syms[cell]) {
        if (!key[syms[cell]]) {
          if (cell === 'blade') key.B = { type: 'slashblade:blade', item: bladeItem, request };
          else if (cell === 'material') key.S = { item: material };
          else key.C = { item: core };
        }
        return syms[cell];
      }
      if (!itemSym.has(cell)) {
        const ch = freeChars[freeIdx++] || 'X';
        itemSym.set(cell, ch);
        key[ch] = cell.startsWith('#') ? { tag: cell.slice(1) } : { item: cell };
      }
      return itemSym.get(cell);
    };
    const rows = [0, 1, 2].map((i) => cells.slice(i * 3, i * 3 + 3).map(symOf));
    const nonEmptyRow = rows.map((row) => row.some((c) => c !== ' '));
    const nonEmptyCol = [0, 1, 2].map((c) => rows.some((row) => row[c] !== ' '));
    const r0 = nonEmptyRow.indexOf(true);
    const r1 = nonEmptyRow.lastIndexOf(true);
    const c0 = nonEmptyCol.indexOf(true);
    const c1 = nonEmptyCol.lastIndexOf(true);
    if (r0 < 0 || c0 < 0) return null;
    const pattern = rows.slice(r0, r1 + 1).map((row) => row.slice(c0, c1 + 1).join(''));
    const used = new Set(pattern.join('').replace(/ /g, ''));
    for (const k of Object.keys(key)) if (!used.has(k)) delete key[k];
    return {
      type: 'slashblade:shaped_blade',
      blade: rl(ns, id),
      category: 'equipment',
      key,
      pattern,
      result: { item: bladeItem },
      show_notification: true,
    };
  }

  if (r.type === 'upgrade') {
    return {
      type: 'slashblade:shaped_blade',
      blade: rl(ns, id),
      category: 'equipment',
      key: {
        B: { type: 'slashblade:blade', item: 'slashblade:slashblade', request },
        S: { item: material },
      },
      pattern: [' S ', 'SBS', ' S '],
      result: { item: bladeItem },
      show_notification: true,
    };
  }
  return {
    type: 'slashblade:shaped_blade',
    blade: rl(ns, id),
    category: 'equipment',
    key: {
      B: { type: 'slashblade:blade', item: bladeItem, request: { name: 'slashblade:none' } },
      S: { item: material },
      C: { item: core },
    },
    pattern: ['SSS', 'SBS', 'SSC'],
    result: { item: bladeItem },
    show_notification: true,
  };
}

/** 收集资源文件：内容相同的模型/贴图只保留一份（按 sha1 去重） */
function collectAssets(ns, blades) {
  const files = new Map(); // path -> { data: Buffer, hash }
  const meta = new Map(); // bladeId -> { modelRef, textureRef }
  const seen = new Map(); // `${kind}:${hash}` -> path

  for (const blade of blades) {
    const base = `${ns}_${slug(blade.id)}`;
    const modelData = blade.modelData || '';
    const texData = String(blade.textureData || '').replace(/^data:image\/png;base64,/, '');

    const modelHash = crypto.createHash('sha1').update(modelData).digest('hex');
    const texHash = crypto.createHash('sha1').update(texData).digest('hex');

    let modelPath = seen.get('m:' + modelHash);
    if (!modelPath) {
      modelPath = `assets/${ns}/model/named/${base}.obj`;
      seen.set('m:' + modelHash, modelPath);
      files.set(modelPath, { data: Buffer.from(modelData, 'utf8'), hash: modelHash });
    }
    let texPath = seen.get('t:' + texHash);
    if (!texPath) {
      texPath = `assets/${ns}/model/named/${base}.png`;
      seen.set('t:' + texHash, texPath);
      files.set(texPath, { data: Buffer.from(texData, 'base64'), hash: texHash });
    }
    meta.set(blade.id, {
      modelRef: `${ns}:${modelPath.replace(`assets/${ns}/`, '')}`,
      textureRef: `${ns}:${texPath.replace(`assets/${ns}/`, '')}`,
    });
  }
  return { files, meta };
}

function buildTree(project) {
  const ns = project.namespace;
  const blades = project.blades || [];
  const byId = new Map(blades.map((b) => [b.id, b]));
  const { files, meta } = collectAssets(ns, blades);
  const warnings = [];
  const selfChecks = [];

  // 把 blade 的模型/贴图引用补上
  const enriched = blades.map((b) => ({
    ...b,
    modelRef: meta.get(b.id).modelRef,
    textureRef: meta.get(b.id).textureRef,
  }));

  const langZh = { 'itemGroup.slashblade': '拔刀剑' };
  const langEn = {};
  const dataFiles = new Map();
  const assetFiles = new Map();

  for (const [p, info] of files) assetFiles.set(p, info.data);

  for (const blade of enriched) {
    const def = bladeDefinition(ns, blade);
    dataFiles.set(`data/${ns}/slashblade/named_blades/${blade.id}.json`, JSON.stringify(def, null, 2));
    // 出包自检：把刚生成的这份定义当场再走一遍官方 codec 审计，对不上就是导出器自己的锅
    for (const [lv, tag, text] of auditDefinition(def)) {
      selfChecks.push({ bladeId: blade.id, name: blade.zh || blade.en || blade.id, lv, tag, text });
    }
    langZh[`item.${ns}.${blade.id}`] = blade.zh || blade.en || blade.id;
    langEn[`item.${ns}.${blade.id}`] = blade.en || blade.zh || blade.id;

    const recipe = bladeRecipe(ns, blade, byId);
    if (recipe) dataFiles.set(`data/${ns}/recipes/${blade.id}.json`, JSON.stringify(recipe, null, 2));
    // 配方也当场自检一遍
    for (const [lv, tag, text] of auditRecipe(recipe)) {
      selfChecks.push({ bladeId: blade.id, name: blade.zh || blade.en || blade.id, lv, tag, text });
    }
    if (blade.recipe && blade.recipe.type === 'upgrade' && !byId.has(blade.recipe.source)) {
      warnings.push(`刀「${blade.zh || blade.id}」的强化源刀不存在，配方已跳过`);
    }
  }
  assetFiles.set(`assets/${ns}/lang/zh_cn.json`, JSON.stringify(langZh, null, 2));
  assetFiles.set(`assets/${ns}/lang/en_us.json`, JSON.stringify(langEn, null, 2));

  return { ns, enriched, dataFiles, assetFiles, warnings, selfChecks };
}

function modsToml(project) {
  const ns = project.namespace;
  return `modLoader="lowcodefml"
loaderVersion="[47,)"
license="All Rights Reserved"

[[mods]]
modId="${ns}"
version="${project.pack.version || '1.0.0'}"
displayName="${escapeToml(project.pack.name || ns)}"
authors="${escapeToml(project.pack.authors || '')}"
description='''${(project.pack.description || 'SlashBlade addon generated by Sakura Edge Studio').replace(/'''/g, "''")}'''
logoFile="icon.png"
displayTest="IGNORE_SERVER_VERSION"

[[dependencies.${ns}]]
modId="forge"
mandatory=true
versionRange="[47,)"
ordering="NONE"
side="BOTH"

[[dependencies.${ns}]]
modId="minecraft"
mandatory=true
versionRange="[1.20.1,1.21)"
ordering="NONE"
side="BOTH"

[[dependencies.${ns}]]
modId="slashblade"
mandatory=true
versionRange="[1.9.65,)"
ordering="AFTER"
side="BOTH"
`;
}

function escapeToml(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function readme(project, warnings) {
  const ns = project.namespace;
  return `Sakura Edge Studio 导出的拔刀剑附属包
=====================================

命名空间: ${ns}
版本: ${project.pack.version || '1.0.0'}
刀数量: ${(project.blades || []).length}

安装方式
--------
1. 确认 mods 文件夹里有 SlashBlade: Resharped（1.20.1，Forge 47+）
2. 把本 jar 放进 mods 文件夹，启动游戏
3. 刀会在「拔刀剑」创造模式标签页里出现（creativeGroup 已指向 slashblade:slashblade）

内容说明
--------
data/${ns}/slashblade/named_blades/*.json  刀的定义（属性/渲染/拔刀术）
assets/${ns}/model/named/*.obj|png         自带的刀模型与贴图
data/${ns}/recipes/*.json                  合成/强化配方

注意
----
- 本包是纯数据模组（modLoader=lowcodefml），不含 Java 代码，改版本号也不需要重新编译
- 刀的三维模型与贴图可随时替换，只要保持 OBJ 里存在 item_blade 与 blade 两个组
${warnings.length ? '\n导出时的问题:\n' + warnings.map((w) => ' - ' + w).join('\n') + '\n' : ''}`;
}

async function buildModJar(project) {
  const { ns, dataFiles, assetFiles, warnings, selfChecks } = buildTree(project);
  const zip = new JSZip();
  zip.file('META-INF/mods.toml', modsToml(project));
  zip.file('pack.mcmeta', JSON.stringify({ pack: { pack_format: PACK_FORMAT, description: project.pack.description || project.pack.name } }, null, 2));
  zip.file('LICENSE.txt', 'All Rights Reserved\nGenerated by Sakura Edge Studio\n');
  zip.file('README.txt', readme(project, warnings));
  for (const [p, text] of dataFiles) zip.file(p, text);
  for (const [p, buf] of assetFiles) zip.file(p, buf);
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  return { buffer: buf, warnings, ns, selfChecks };
}

async function buildResourcePack(project) {
  const { assetFiles } = buildTree(project);
  const zip = new JSZip();
  zip.file('pack.mcmeta', JSON.stringify({ pack: { pack_format: PACK_FORMAT, description: project.pack.description || project.pack.name } }, null, 2));
  for (const [p, buf] of assetFiles) zip.file(p, buf);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function buildDataPack(project) {
  const { dataFiles } = buildTree(project);
  const zip = new JSZip();
  zip.file('pack.mcmeta', JSON.stringify({ pack: { pack_format: PACK_FORMAT, description: project.pack.description || project.pack.name } }, null, 2));
  for (const [p, text] of dataFiles) zip.file(p, text);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { buildModJar, buildResourcePack, buildDataPack, bladeDefinition, bladeRecipe, auditDefinition, auditRecipe, auditProject, sanitizePath, slug };
