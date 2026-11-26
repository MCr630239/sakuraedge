import { createPreview } from './preview.js';

const $ = (id) => document.getElementById(id);
const tabBody = $('tabBody');

const SLASH_ARTS = [
  ['', '不设置（无拔刀术）'],
  ['slashblade:void_slash', '虚空斩 Void Slash'],
  ['slashblade:circle_slash', '圆舞斩 Circle Slash'],
  ['slashblade:drive_vertical', '幻影刃-纵 Drive Vertical'],
  ['slashblade:drive_horizontal', '幻影刃 Drive Horizontal'],
  ['slashblade:judgement_cut', '次元斩 Judgement Cut（多数刀的默认）'],
  ['slashblade:piercing', '平突 Piercing'],
  ['slashblade:sakura_end', '终焉樱 Sakura End'],
  ['slashblade:wave_edge', '波刀龙胆 Wave Edge'],
  ['custom', '自定义（附属模组注册的 SA）…'],
];

const COMBO_ROOTS = [
  ['slashblade:standby', '待机 Standby'],
  ['slashblade:none', '无连段'],
  ['slashblade:combo_a1', '连段 A1'],
  ['slashblade:combo_b1', '连段 B1'],
];

const SWORD_TYPES = [
  ['ENCHANTED', '附魔', '开局即视为已附魔状态'],
  ['BEWITCHED', '妖', '可附魔，附魔后刀光变红'],
  ['SEALED', '封印', '无法使用拔刀术'],
  ['FIERCEREDGE', '千杀', '击杀数 ≥1000 时自动获得'],
  ['BROKEN', '折断', '耐久耗尽后折断'],
  ['EDGEFRAGMENT', '残刃', '只剩刃片的状态'],
  ['NOSCABBARD', '无鞘', '不带刀鞘，手持时直接出鞘'],
  ['SOULEATER', '噬魂', '攻击时吸取耀魂'],
];

const REQUIRED_GROUPS = [
  ['blade', '刀（第三人称）'],
  ['sheath', '刀鞘（第三人称）'],
  ['blade_damaged', '损坏的刀'],
  ['blade_fragment', '断刃碎片'],
  ['effect', 'SA 蓄力高光'],
  ['item_blade', '物品栏（完好）'],
  ['item_damaged', '物品栏（损坏）'],
  ['item_bladens', '无鞘图标（可忽略）'],
];

// 原版 1.20.1 全部 40 个附魔：[ID, 中文名, 最大等级, 对拔刀剑是否真的生效]
const ENCHANT_GROUPS = [
  ['扩展附魔 · 需 Blade Forge Arts 前置', [
    ['bladeforge_arts:frost_aspect', '霜寒', 4, true],
    ['bladeforge_arts:venom_aspect', '剧毒', 4, true],
    ['bladeforge_arts:lifesteal', '吸血', 4, true],
    ['bladeforge_arts:thunder_aspect', '雷击', 3, true],
    ['bladeforge_arts:soul_drain', '摄魂', 4, true],
    ['bladeforge_arts:execution', '处刑', 4, true],
    ['bladeforge_arts:annihilation', '湮灭', 3, true],
    ['bladeforge_arts:berserk', '狂战', 3, true],
    ['bladeforge_arts:wither_aspect', '凋零性', 3, true],
    ['bladeforge_arts:beast_aspect', '兽性', 3, true],
    ['bladeforge_arts:limiter', '载器', 3, true],
    ['bladeforge_arts:soul_harvest', '收魂', 3, true],
    ['bladeforge_arts:fierce_edge', '凶刃', 3, true],
    ['bladeforge_arts:proud_burst', '耀魂爆发', 3, true],
  ]],
  ['武器', [
    ['minecraft:sharpness', '锋利', 5, true],
    ['minecraft:smite', '亡灵杀手', 5, true],
    ['minecraft:bane_of_arthropods', '节肢杀手', 5, true],
    ['minecraft:knockback', '击退', 2, true],
    ['minecraft:fire_aspect', '火焰附加', 2, true],
    ['minecraft:looting', '抢夺', 3, true],
    ['minecraft:sweeping_edge', '横扫之刃', 3, true],
  ]],
  ['工具 / 剑', [
    ['minecraft:efficiency', '效率', 5, false],
    ['minecraft:silk_touch', '精准采集', 1, false],
    ['minecraft:unbreaking', '耐久', 3, true],
    ['minecraft:fortune', '时运', 3, false],
    ['minecraft:mending', '经验修补', 1, true],
  ]],
  ['防具 / 身体', [
    ['minecraft:protection', '保护', 4, false],
    ['minecraft:fire_protection', '火焰保护', 4, true],
    ['minecraft:feather_falling', '摔落保护', 4, true],
    ['minecraft:blast_protection', '爆炸保护', 4, false],
    ['minecraft:projectile_protection', '弹射物保护', 4, false],
    ['minecraft:respiration', '水下呼吸', 3, false],
    ['minecraft:aqua_affinity', '水下速掘', 1, false],
    ['minecraft:thorns', '荆棘', 3, false],
    ['minecraft:depth_strider', '深海探索者', 3, false],
    ['minecraft:frost_walker', '冰霜行者', 2, false],
    ['minecraft:soul_speed', '灵魂疾行', 3, true],
    ['minecraft:swift_sneak', '迅捷潜行', 3, true],
  ]],
  ['弓', [
    ['minecraft:power', '力量', 5, false],
    ['minecraft:punch', '冲击', 2, false],
    ['minecraft:flame', '火矢', 1, false],
    ['minecraft:infinity', '无限', 1, false],
  ]],
  ['弩', [
    ['minecraft:multishot', '多重射击', 1, false],
    ['minecraft:quick_charge', '快速装填', 3, false],
    ['minecraft:piercing', '穿透', 4, false],
  ]],
  ['钓鱼竿', [
    ['minecraft:luck_of_the_sea', '海之眷顾', 3, false],
    ['minecraft:lure', '饵钓', 3, false],
  ]],
  ['三叉戟', [
    ['minecraft:loyalty', '忠诚', 3, false],
    ['minecraft:impaling', '穿刺', 5, false],
    ['minecraft:riptide', '激流', 3, false],
    ['minecraft:channeling', '引雷', 1, false],
  ]],
  ['诅咒', [
    ['minecraft:binding_curse', '绑定诅咒', 1, false],
    ['minecraft:vanishing_curse', '消失诅咒', 1, false],
  ]],
];

const ENCH_INDEX = new Map();
for (const [group, list] of ENCHANT_GROUPS) {
  for (const [id, cn, max, useful] of list) ENCH_INDEX.set(id, { cn, max, useful, group });
}

const ENCH_QUICK = [
  'minecraft:sharpness', 'minecraft:smite', 'minecraft:bane_of_arthropods', 'minecraft:looting',
  'minecraft:sweeping_edge', 'minecraft:fire_aspect', 'minecraft:knockback',
  'minecraft:unbreaking', 'minecraft:mending', 'minecraft:protection',
  'minecraft:fire_protection', 'minecraft:feather_falling', 'minecraft:soul_speed', 'minecraft:swift_sneak',
];

const ENCH_ARTS = [
  'bladeforge_arts:frost_aspect', 'bladeforge_arts:venom_aspect', 'bladeforge_arts:lifesteal',
  'bladeforge_arts:thunder_aspect', 'bladeforge_arts:soul_drain', 'bladeforge_arts:execution',
  'bladeforge_arts:annihilation', 'bladeforge_arts:berserk',
  'bladeforge_arts:wither_aspect', 'bladeforge_arts:beast_aspect', 'bladeforge_arts:limiter',
  'bladeforge_arts:soul_harvest', 'bladeforge_arts:fierce_edge', 'bladeforge_arts:proud_burst',
];

// 附魔套装：一键叠一套（同 ID 覆盖等级，其它保留）
const ENCH_SETS = [
  ['combat', '战斗套', [
    ['minecraft:sharpness', 5], ['minecraft:looting', 3], ['minecraft:fire_aspect', 2],
    ['minecraft:knockback', 2], ['minecraft:sweeping_edge', 3],
  ]],
  ['survival', '生存套', [
    ['minecraft:unbreaking', 3], ['minecraft:mending', 1], ['minecraft:protection', 4],
    ['minecraft:fire_protection', 4], ['minecraft:feather_falling', 4],
  ]],
  ['full', '满配（全部有效）', [
    ['minecraft:sharpness', 5], ['minecraft:smite', 5], ['minecraft:bane_of_arthropods', 5],
    ['minecraft:knockback', 2], ['minecraft:fire_aspect', 2], ['minecraft:looting', 3],
    ['minecraft:sweeping_edge', 3], ['minecraft:unbreaking', 3], ['minecraft:mending', 1],
    ['minecraft:fire_protection', 4], ['minecraft:feather_falling', 4],
    ['minecraft:soul_speed', 3], ['minecraft:swift_sneak', 3], ['minecraft:protection', 4],
  ]],
  ['element', '元素套（需前置）', [
    ['bladeforge_arts:frost_aspect', 4], ['bladeforge_arts:venom_aspect', 4],
    ['bladeforge_arts:thunder_aspect', 3], ['bladeforge_arts:lifesteal', 4],
  ]],
  ['soul', '刀魂套（需前置）', [
    ['bladeforge_arts:soul_harvest', 3], ['bladeforge_arts:fierce_edge', 3],
    ['bladeforge_arts:proud_burst', 3], ['minecraft:sharpness', 5], ['minecraft:looting', 3],
    ['minecraft:unbreaking', 3],
  ]],
  ['seclassic', '原版 SE 复刻（需前置）', [
    ['bladeforge_arts:wither_aspect', 3], ['bladeforge_arts:beast_aspect', 3],
    ['bladeforge_arts:limiter', 3], ['bladeforge_arts:soul_drain', 4],
  ]],
  ['rage', '狂暴套（需前置）', [
    ['bladeforge_arts:execution', 4], ['bladeforge_arts:annihilation', 3],
    ['bladeforge_arts:berserk', 3], ['bladeforge_arts:soul_drain', 4],
  ]],
  ['curse', '诅咒套', [
    ['minecraft:binding_curse', 1], ['minecraft:vanishing_curse', 1],
  ]],
];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function roman(n) {
  n = Number(n) || 1;
  if (n <= 10) return ROMAN[n];
  return 'X+' + (n - 10);
}

function enchantName(id) {
  return (ENCH_INDEX.get(id) || {}).cn || '';
}

function enchantOptions(selected) {
  const groups = ENCHANT_GROUPS.map(([group, list]) => `
    <optgroup label="${group}">${list.map(([id, cn, max, useful]) =>
      `<option value="${id}" ${id === selected ? 'selected' : ''}>${cn} ${id.replace('minecraft:', '')}${useful ? ' ★' : ''}</option>`).join('')}
    </optgroup>`).join('');
  return `<option value="">选择附魔…</option>${groups}`;
}

const EFFECT_PRESETS = [
  ['slashblade:wither_edge', '凋零性'],
];

// 奥义预设：官方 SA（动作层）+ 剑气色 + 剑型 + 附魔的组合，一键套用
// real: 效果是否由模组原生支持；visual: 只靠颜色/附魔近似
const ARTS_PRESETS = [
  { key: 'flame', name: '烈焰斩', sa: 'slashblade:drive_horizontal', color: '#ff5a1f',
    types: ['BEWITCHED'], ench: [['minecraft:fire_aspect', 2]], note: '横斩波 + 火焰附加 II + 妖刀红刀光（真有效果）' },
  { key: 'frost', name: '霜寒斩', sa: 'slashblade:piercing', color: '#8fe3ff',
    types: ['BEWITCHED'], ench: [['minecraft:sharpness', 2]], note: '刺突 + 冰蓝剑气（颜色近似，无原生冰冻）' },
  { key: 'thunder', name: '雷光斩', sa: 'slashblade:drive_vertical', color: '#9ecbff',
    types: ['BEWITCHED'], ench: [['minecraft:sharpness', 3], ['minecraft:knockback', 1]], note: '纵斩波 + 锋利 III + 击退（真有效果）' },
  { key: 'venom', name: '剧毒斩', sa: 'slashblade:circle_slash', color: '#7bd44a',
    types: ['BEWITCHED'], ench: [['minecraft:bane_of_arthropods', 3]], note: '圆舞斩 + 节肢杀手 III + 酸绿剑气' },
  { key: 'blood', name: '血吸斩', sa: 'slashblade:judgement_cut', color: '#c8143c',
    types: ['BEWITCHED'], ench: [['minecraft:looting', 3]], note: '居合斩 + 抢夺 III + 血红剑气' },
  { key: 'wither', name: '凋零斩', sa: 'slashblade:void_slash', color: '#4a2a5a',
    types: ['BEWITCHED'], ench: [['minecraft:smite', 3]], effects: ['slashblade:wither_edge'],
    note: '虚空斩 + SE 凋零性 + 亡灵杀手 III（SE 真有效果）' },
  { key: 'sakura', name: '樱吹雪', sa: 'slashblade:sakura_end', color: '#ffb7d5',
    types: ['BEWITCHED'], ench: [['minecraft:looting', 2]], note: '樱之终 + 粉樱剑气 + 抢夺 II' },
  { key: 'void', name: '虚空斩', sa: 'slashblade:void_slash', color: '#241a3a',
    types: ['BEWITCHED'], ench: [['minecraft:sharpness', 4]], note: '虚空斩 + 暗紫剑气 + 锋利 IV' },
  { key: 'gale', name: '疾风斩', sa: 'slashblade:wave_edge', color: '#b8f5e0',
    types: ['BEWITCHED'], ench: [['minecraft:knockback', 2]], note: '波刃 + 击退 II（真有效果）' },
  { key: 'titan', name: '巨力斩', sa: 'slashblade:drive_vertical', color: '#ffd24a',
    types: ['BEWITCHED'], ench: [['minecraft:sharpness', 5], ['minecraft:unbreaking', 3]], note: '纵斩波 + 锋利 V + 耐久 III（真有效果）' },
];

const CARRIES = [
  ['DEFAULT', 'DEFAULT · 横背（水平横挂背后）'],
  ['KATANA', 'KATANA · 腰间横插'],
  ['NINJA', 'NINJA · 斜背（刀尖朝下）'],
  ['RNINJA', 'RNINJA · 反向斜背'],
  ['PSO2', 'PSO2 · 竖贴后背'],
  ['NONE', 'NONE · 不渲染'],
];
const TEX_PRESETS = [
  ['shiro', '白夜', 'katana_shiro.png'],
  ['moon', '月影', 'katana_moon.png'],
  ['crimson', '绯樱', 'katana_crimson.png'],
  ['agito_false', '原版 · 神裂', 'agito_false.png'],
  ['yamato', '原版 · 阎魔', 'yamato.png'],
];

const MODEL_PRESETS = [
  ['katana', '樱刃 katana（自绘）'],
  ['agito', '原版 · 神裂 agito'],
  ['yamato', '原版 · 阎魔 yamato'],
];

const TUNE_DEFAULT = { len: 1, wid: 1, sori: 0, hilt: 1 };
const HILT_ANCHOR = -100; // 刀柄前端（鋺），刀身从这里往 +X 长出去

// 直接改 OBJ 顶点：8 个组、UV、面序都不动，所以导出后游戏里照样认
function tuneObj(text, tune) {
  const t = Object.assign({}, TUNE_DEFAULT, tune || {});
  if (t.len === 1 && t.wid === 1 && t.sori === 0 && t.hilt === 1) return text;
  const out = [];
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('v ') && !line.startsWith('vt ') && !line.startsWith('vn ')) {
      const parts = line.trim().split(/\s+/);
      let x = Number(parts[1]);
      let y = Number(parts[2]);
      const z = Number(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { out.push(line); continue; }
      if (x < HILT_ANCHOR) {
        x = HILT_ANCHOR + (x - HILT_ANCHOR) * t.hilt;
      } else {
        x = HILT_ANCHOR + (x - HILT_ANCHOR) * t.len;
      }
      y *= t.wid;
      if (x > HILT_ANCHOR && t.sori) {
        const k = (x - HILT_ANCHOR) / 300;
        y += t.sori * 55 * k * k;
      }
      out.push(`v ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

function retune(b) {
  b.modelData = tuneObj(b.modelBaseData || b.modelData, b.tune || TUNE_DEFAULT);
}

function builtinModel(key) {
  const m = state.builtin.models && state.builtin.models[key];
  return (m && m.obj) || state.builtin.obj;
}

const state = {
  project: null,
  selectedId: null,
  tab: 'base',
  mode: 'icon',
  builtin: null,
  preview: null,
  dirty: false,
  gridSel: 0,
  upd: {
    info: null,
    source: '',
    token: '',
    autoCheck: true,
    checking: false,
    result: null,
    downloading: false,
    pct: 0,
    phase: '',
    extract: null,
    installed: null,
  },
};

let previewTimer = null;

/* ---------------- 数据 ---------------- */

function uid() {
  let i = 1;
  const used = new Set((state.project?.blades || []).map((b) => b.id));
  while (used.has(`blade_${i}`)) i++;
  return `blade_${i}`;
}

function makeBlade(over = {}) {
  const b = {
    id: over.id || uid(),
    zh: '新刀',
    en: 'New Blade',
    itemRef: 'slashblade:slashblade',
    creative: 'slashblade:slashblade',
    attack: 4.0,
    dur: 40,
    unbreakable: false,
    slashArt: 'slashblade:judgement_cut',
    rootCombo: 'slashblade:standby',
    types: [],
    effects: [],
    enchants: [],
    summonColor: '#3a3aff',
    colorInverse: false,
    carry: 'PSO2',
    modelName: 'katana.obj',
    textureName: 'katana_shiro.png',
    modelBase: 'katana',
    modelBaseData: builtinModel('katana'),
    tune: Object.assign({}, TUNE_DEFAULT),
    modelData: builtinModel('katana'),
    textureData: state.builtin.textures.shiro,
    recipe: { type: 'create', material: 'slashblade:proudsoul', core: 'slashblade:proudsoul_sphere', source: '', kill: 0, refine: 0, proud: 0 },
  };
  Object.assign(b, over);
  if (!b.modelBaseData) b.modelBaseData = b.modelData || builtinModel('katana');
  b.tune = Object.assign({}, TUNE_DEFAULT, b.tune || {});
  retune(b);
  return b;
}

function demoProject() {
  const blades = [
    makeBlade({
      id: 'mumei', zh: '无铭', en: 'Mumei', attack: 4.0, dur: 40, carry: 'DEFAULT',
      slashArt: 'slashblade:judgement_cut', textureName: 'katana_shiro.png',
      textureData: state.builtin.textures.shiro,
      recipe: { type: 'create', material: 'slashblade:proudsoul', core: 'slashblade:proudsoul_sphere', source: '', kill: 0, refine: 0, proud: 0 },
    }),
    makeBlade({
      id: 'byakuya', zh: '白夜', en: 'Byakuya', attack: 6.0, dur: 70, carry: 'KATANA',
      slashArt: 'slashblade:wave_edge', textureName: 'katana_moon.png',
      textureData: state.builtin.textures.moon, types: ['BEWITCHED'], effects: [],
      enchants: [{ id: 'minecraft:sharpness', lvl: 2 }, { id: 'minecraft:looting', lvl: 3 }],
      recipe: { type: 'upgrade', material: 'slashblade:proudsoul_ingot', core: 'slashblade:proudsoul_sphere', source: 'mumei', kill: 50, refine: 0, proud: 0 },
    }),
    makeBlade({
      id: 'hizakura', zh: '绯樱', en: 'Hizakura', attack: 8.0, dur: 110, carry: 'NINJA',
      slashArt: 'slashblade:sakura_end', textureName: 'katana_crimson.png',
      textureData: state.builtin.textures.crimson, types: ['BEWITCHED'], effects: [],
      enchants: [{ id: 'minecraft:sharpness', lvl: 5 }, { id: 'minecraft:fire_aspect', lvl: 2 }, { id: 'minecraft:mending', lvl: 1 }],
      recipe: { type: 'upgrade', material: 'slashblade:proudsoul_crystal', core: 'slashblade:proudsoul_trapezohedron', source: 'byakuya', kill: 150, refine: 3, proud: 100 },
    }),
    makeBlade({
      id: 'agito_demo', zh: '神裂', en: 'Agito', attack: 5.0, dur: 60, carry: 'DEFAULT',
      slashArt: 'slashblade:wave_edge', modelName: 'agito.obj', textureName: 'agito_false.png',
      modelData: builtinModel('agito'), textureData: state.builtin.textures.agito_false,
      recipe: { type: 'create', material: 'slashblade:proudsoul_ingot', core: 'slashblade:proudsoul_sphere', source: '', kill: 0, refine: 0, proud: 0 },
    }),
  ];
  return {
    format: 'sakura-edge-project/1',
    namespace: 'sakura_edge',
    pack: { name: '樱刃 Sakura Edge', version: '1.0.0', authors: '', description: '又一套自己锻的拔刀剑' },
    blades,
  };
}

function current() {
  return state.project.blades.find((b) => b.id === state.selectedId) || null;
}

/* ---------------- 工具 ---------------- */

function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = 'toast'), 3200);
}

function setStatus(text) {
  $('statusText').textContent = text;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseEnchants(text) {
  return text
    .split(/[\n,，;；]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.split(/\s+/);
      let id = m[0];
      if (!id.includes(':')) id = 'minecraft:' + id;
      return { id, lvl: Math.max(1, parseInt(m[1] || '1', 10) || 1) };
    });
}

function enchantText(list) {
  return (list || []).map((e) => `${e.id} ${e.lvl}`).join('\n');
}

/* ---------------- 校验 ---------------- */

function validate(b, project) {
  const issues = [];
  const nsRe = /^[a-z][a-z0-9_]{1,20}$/;
  if (!nsRe.test(project.namespace)) issues.push(['bad', '命名空间', '必须是小写字母开头、2-21 位的 [a-z0-9_]']);
  const idRe = /^[a-z0-9_]{1,40}$/;
  if (!idRe.test(b.id)) issues.push(['bad', '刀 ID', '只能包含小写字母/数字/下划线，1-40 位']);
  const dup = project.blades.filter((x) => x.id === b.id).length;
  if (dup > 1) issues.push(['bad', '刀 ID', `有 ${dup} 把刀的 ID 相同，导出会互相覆盖`]);
  if (!b.zh && !b.en) issues.push(['warn', '名称', '中文名和英文名都是空的']);
  if (!(b.attack >= 1 && b.attack <= 30)) issues.push(['warn', '基础攻击', '建议保持在 1.0 - 30.0']);
  if (!(b.dur >= 1 && b.dur <= 5000)) issues.push(['warn', '耐久', '建议保持在 1 - 5000']);
  if (!/^\s*(v|vt|vn|f|g|o|s|usemtl|mtllib|#)/m.test(b.modelData || '')) {
    issues.push(['bad', '模型', '不是合法的 OBJ 文本']);
  } else {
    const groups = (b.modelData.match(/^\s*g\s+.*$/gm) || []).map((s) => s.trim().split(/\s+/)[1]);
    if (!groups.includes('item_blade')) issues.push(['warn', '模型', '缺少 item_blade 组：物品栏图标会显示不出来']);
    if (!groups.includes('blade')) issues.push(['warn', '模型', '缺少 blade 组：手持/展示架上看不到刀']);
  }
  if (!String(b.textureData || '').startsWith('data:image/png;base64,')) issues.push(['bad', '贴图', '缺少 PNG 贴图']);
  if (b.slashArt && !b.slashArt.includes(':')) issues.push(['bad', '拔刀术', '必须是 命名空间:id 的形式']);
  if (!b.slashArt) issues.push(['warn', '拔刀术', '未设置，刀能挥但发不出奥义']);
  if (!b.recipe || b.recipe.type === 'none') issues.push(['warn', '配方', '没有配方时只能靠 /give 或创造模式获取']);
  if (b.recipe && b.recipe.type === 'upgrade' && !project.blades.some((x) => x.id === b.recipe.source)) {
    issues.push(['bad', '配方', '强化源刀不存在']);
  }
  if (b.recipe && b.recipe.type === 'smithing') {
    if (!b.recipe.source) issues.push(['bad', '配方', '锻造台需要一个基底源刀']);
    else if (!project.blades.some((x) => x.id === b.recipe.source)) issues.push(['bad', '配方', '锻造台基底源刀不存在']);
    for (const [key, label] of [['template', '模板'], ['addition', '添加物']]) {
      const v = b.recipe[key];
      if (v && !v.startsWith('#') && !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(v)) {
        issues.push(['bad', '配方', `${label}「${v}」不是合法的物品 id（或 #标签）`]);
      }
    }
  }
  if (b.recipe && Array.isArray(b.recipe.grid) && b.recipe.grid.some((c) => c)) {
    if (!b.recipe.grid.includes('blade')) issues.push(['bad', '配方', '自定义摆法里没有「刀」，做出来是普通物品，拿不到刀坯']);
    for (const c of b.recipe.grid) {
      if (!c || ['blade', 'material', 'core'].includes(c)) continue;
      if (!/^#?[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(c)) issues.push(['bad', '配方', `自定义摆法里的「${c}」不是合法物品 id（或 #标签）`]);
    }
  }
  return issues;
}

/* ---------------- 界面 ---------------- */

function renderList() {
  const list = $('bladeList');
  list.innerHTML = '';
  $('bladeCount').textContent = state.project.blades.length;
  for (const b of state.project.blades) {
    const li = document.createElement('li');
    li.className = 'blade-item' + (b.id === state.selectedId ? ' active' : '');
    li.dataset.id = b.id;
    li.innerHTML = `
      <div class="row1"><span class="name">${esc(b.zh || b.en || b.id)}</span><span class="atk">${Number(b.attack).toFixed(1)}</span></div>
      <div class="rid">${esc(state.project.namespace)}:${esc(b.id)}</div>`;
    li.addEventListener('click', () => selectBlade(b.id));
    list.appendChild(li);
  }
}

function selectBlade(id) {
  state.selectedId = id;
  renderList();
  renderInspector();
  refreshPreview();
  syncPosePanel();
}

function textRow(label, field, value, opts = {}) {
  const type = opts.type || 'text';
  const extra = opts.attrs || '';
  return `<div class="form-row"><label>${label}</label>
    <input type="${type}" data-f="${field}" value="${esc(value)}" ${extra} spellcheck="false" />
    ${opts.suffix ? `<span class="suffix">${opts.suffix}</span>` : ''}</div>`;
}

function selectRow(label, field, value, options) {
  const opts = options
    .map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`)
    .join('');
  return `<div class="form-row"><label>${label}</label><select data-f="${field}">${opts}</select></div>`;
}

// 拔刀术：下拉（官方 8 个 + 不设置）+ 自定义输入，两者写同一个 slashArt 字段
function saRow(b) {
  const cur = String(b.slashArt || '');
  const known = SLASH_ARTS.some(([v]) => v === cur);
  const val = known ? cur : (cur ? 'custom' : '');
  const opts = SLASH_ARTS.map(([v, t]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(t)}</option>`).join('');
  return `<div class="form-row"><label>拔刀术</label><select data-sa>${opts}</select></div>
  <div class="form-row" id="saCustomRow"${val === 'custom' ? '' : ' hidden'}><label>自定义 SA</label>
    <input type="text" data-sa-custom value="${esc(val === 'custom' ? cur : '')}" placeholder="如 slb:ex_sa" spellcheck="false" /></div>`;
}

function checkRow(label, field, checked) {
  return `<div class="form-row"><label>${label}</label>
    <input type="checkbox" data-f="${field}" ${checked ? 'checked' : ''} style="flex:none;width:16px;height:16px;accent-color:#e35e7d" /></div>`;
}

function baseTab(b) {
  return `
  <div class="group">
    <div class="group-title">身份</div>
    ${textRow('刀 ID', 'id', b.id, { suffix: `${state.project.namespace}:` })}
    <p class="hint">导出后刀的资源名是 <b>${esc(state.project.namespace)}:${esc(b.id)}</b>，改 ID 会同时改变配方与语言键。</p>
    ${textRow('中文名', 'zh', b.zh)}
    ${textRow('英文名', 'en', b.en)}
    ${textRow('物品 ID', 'itemRef', b.itemRef)}
    <p class="hint">数据模组没有自己的物品，默认复用 <span class="suffix">slashblade:slashblade</span>。</p>
  </div>
  <div class="group">
    <div class="group-title">创造模式</div>
    ${textRow('标签 ID', 'creative', b.creative)}
    <p class="hint">填 <b>slashblade:slashblade</b> 会出现在「拔刀剑」标签页；也可以填 <b>minecraft:combat</b> 让它出现在战斗用品页。</p>
  </div>
  <div class="group">
    <div class="group-title">资料</div>
    <div class="export-box">
      <p>工程命名空间 <b>${esc(state.project.namespace)}</b>，共 ${state.project.blades.length} 把刀。<br/>
      导出的 jar 是纯数据附属包，不含 Java 代码，装进 mods 即可。</p>
      <div class="btn-row">
        <button id="btnExport2" class="accent small">导出附属包 jar</button>
        <button id="btnCatalog" class="ghost small">导出刀谱 HTML</button>
        <button id="btnSave2" class="ghost small">保存工程</button>
      </div>
    </div>
  </div>`;
}

function statsTab(b) {
  return `
  <div class="group">
    <div class="group-title">数值</div>
    ${textRow('基础攻击', 'attack', b.attack, { type: 'number', attrs: 'step="0.5" min="0" max="40"' })}
    ${textRow('最大耐久', 'dur', b.dur, { type: 'number', attrs: 'min="1" step="10"' })}
    ${checkRow('不可损坏', 'unbreakable', b.unbreakable)}
  </div>
  <div class="group">
    <div class="group-title">刀之奥义 · 拔刀术（SA）</div>
    ${saRow(b)}
    ${selectRow('连段入口', 'rootCombo', b.rootCombo, COMBO_ROOTS)}
    <p class="hint">拔刀术是「引用」：下拉里是 Resharped 1.20.1 仅有的 8 个奥义（次元斩是绝大多数刀的默认 SA，也最廉价）；选「不设置」就不写 <span class="suffix">slash_art</span>。附属模组自带的奥义用「自定义」填它的 ResourceLocation。</p>
    <div class="group-title sub">奥义预设（点一下整套套用）</div>
    <div class="chips">${ARTS_PRESETS.map((p) => `<span class="pill" data-arts="${p.key}" title="${esc(p.note)}">${p.name}</span>`).join('')}</div>
    <p class="hint">预设 = 一个官方奥义 + 剑气颜色 + 剑型 + 附魔（+ 必要的 SE）。会覆盖当前刀的剑气色、剑型与附魔列表；标「颜色近似」的是没有原生效果的，只做了视觉。</p>
  </div>
  <div class="group">
    <div class="group-title">刀的状态</div>
    <div class="chips" id="typeChips">
      ${SWORD_TYPES.map(([v, t, d]) => `<span class="pill ${b.types.includes(v) ? 'on' : ''}" data-type="${v}" title="${esc(d)}">${t} · ${v.toLowerCase()}</span>`).join('')}
    </div>
    <p class="hint">点击切换。<b>妖</b> = 附魔后出现红色刀光；<b>封印</b> = 禁用拔刀术；<b>千杀</b> 正常要杀敌数满 1000 才由模组自动加上，在这勾选等于开局就给你这个状态（数据包里写 sword_type: fierceredge）。</p>
  </div>
  <div class="group">
    <div class="group-title">附魔（附魔增效）<span class="group-count">${(b.enchants || []).length}</span></div>
    <div class="group-title sub">附魔套装（一键叠一套）</div>
    <div class="chips">
      ${ENCH_SETS.map(([k, t, list]) => `<span class="pill" data-ench-set="${k}" title="${esc(list.map(([id, lvl]) => enchantName(id) + ' ' + roman(lvl)).join('、'))}">${t} · ${list.length} 项</span>`).join('')}
    </div>
    <div class="group-title sub">常用附魔（点一次加一级）</div>
    <div class="chips">
      ${ENCH_QUICK.map((id) => `<span class="pill" data-ench-quick="${id}">＋ ${enchantName(id)}</span>`).join('')}
    </div>
    <div class="group-title sub">扩展附魔 · 需 Blade Forge Arts 前置</div>
    <div class="chips">
      ${ENCH_ARTS.map((id) => `<span class="pill" data-ench-quick="${id}" title="${esc(id)}">＋ ${enchantName(id)}</span>`).join('')}
    </div>
    <div class="ench-rows">
      ${(b.enchants || []).map((e, i) => {
        const known = ENCH_INDEX.has(e.id);
        const cn = enchantName(e.id);
        return `
        <div class="form-row ench-row">
          ${known
            ? `<select data-f="ench.id" data-i="${i}">${enchantOptions(e.id)}</select>`
            : `<input type="text" data-f="ench.id" data-i="${i}" value="${esc(e.id || '')}" placeholder="自定义附魔 ID" spellcheck="false" />`}
          <input type="number" data-f="ench.lvl" data-i="${i}" value="${e.lvl}" min="1" max="255" class="lvl" />
          <span class="roman" title="等级">${roman(e.lvl)}</span>
          <button class="ghost small" data-ench-del="${i}" title="删除">×</button>
        </div>
        ${known && cn ? `<div class="ench-sub">${ENCH_INDEX.get(e.id).group} · 原版上限 ${ENCH_INDEX.get(e.id).max} 级 · ${esc(e.id)}</div>` : ''}`;
      }).join('')}
      ${(b.enchants || []).length ? '' : '<p class="hint">还没有附魔。点下面的常用附魔，或「＋ 自定义附魔」写模组附魔 ID。</p>'}
    </div>
    <button class="ghost small" data-ench-add>＋ 自定义附魔</button>
    <p class="hint">「扩展附魔」组（霜寒 / 剧毒 / 吸血 / 雷击 / 摄魂 / 处刑 / 湮灭 / 狂战 / 凋零性 / 兽性 / 载器）由前置模组 <span class="suffix">Blade Forge Arts</span> 提供，把那个 jar 一起放进 mods 才生效；只装工坊出的刀包会显示附魔名但没有实际效果。</p>
    <p class="hint">列表是原版 1.20.1 全部 40 个附魔，标 ★ 的是对拔刀剑真正生效的（锋利/抢夺/耐久/经验修补/火焰保护/摔落保护/灵魂疾行等）；没标的写了也不会报错，只是不产生效果。</p>
    <p class="hint">等级可以超过原版上限（拔刀剑允许夸张数值），会写进 <span class="suffix">enchantments</span> 与刀 NBT。</p>
  </div>
  <div class="group">
    <div class="group-title">刀之奥义 · 特殊效果（SE）</div>
    <div class="form-row"><label>效果列表</label>
      <textarea data-f="effects" rows="2" spellcheck="false">${esc((b.effects || []).join('\n'))}</textarea></div>
    <div class="chips">${EFFECT_PRESETS.map(([id, name]) => `<span class="pill" data-effect="${id}">＋ ${name}</span>`).join('')}</div>
    <p class="hint">每行一个 ResourceLocation。重锋 1.20.1 <b>只注册了凋零性</b>（<span class="suffix">slashblade:wither_edge</span>）这一个 SE；老版本的兽性、载器在 1.20.1 没有。想复刻它们就往刀上加前置的 <span class="suffix">bladeforge_arts:beast_aspect</span> / <span class="suffix">limiter</span> 附魔，效果等价。</p>
  </div>`;
}

function renderTab(b) {
  const texName = b.textureName || 'texture.png';
  const tune = Object.assign({}, TUNE_DEFAULT, b.tune || {});
  return `
  <div class="group">
    <div class="group-title">模型（OBJ）</div>
    <div class="asset-card">
      <div class="asset-thumb" style="display:grid;place-items:center;font-family:var(--mono);color:#5b6484">OBJ</div>
      <div class="asset-info">
        <div class="asset-name">${esc(b.modelName || '未导入')}</div>
        <div class="asset-sub">${Math.round((b.modelData || '').length / 1024)} KB · 需包含 item_blade / blade 组</div>
      </div>
      <button data-act="import-model" class="ghost small">导入</button>
      <button data-act="builtin-model" class="ghost small">内置</button>
    </div>
    <div class="chips">
      ${MODEL_PRESETS.map(([k, t]) => `<span class="pill${b.modelName === k + '.obj' ? ' on' : ''}" data-model="${k}">内置 · ${t}</span>`).join('')}
    </div>
    <div class="group-title">贴图（PNG）</div>
    <div class="asset-card">
      <img class="asset-thumb" src="${esc(b.textureData)}" alt="texture" />
      <div class="asset-info">
        <div class="asset-name">${esc(texName)}</div>
        <div class="asset-sub">建议 16/32/64/128 方形、像素风</div>
      </div>
      <button data-act="import-tex" class="ghost small">导入</button>
    </div>
    <div class="chips">
      ${TEX_PRESETS.map(([k, t]) => `<span class="pill" data-tex="${k}">内置 · ${t}</span>`).join('')}
    </div>
    <div class="group-title">刀模调整（不装 Blender 也能改）</div>
    <div class="form-row"><label>刀身长度</label><input type="range" data-tune="len" min="0.6" max="1.6" step="0.01" value="${tune.len}" /><span class="suffix" id="tune-len">${tune.len.toFixed(2)}×</span></div>
    <div class="form-row"><label>刀身宽度</label><input type="range" data-tune="wid" min="0.7" max="1.4" step="0.01" value="${tune.wid}" /><span class="suffix" id="tune-wid">${tune.wid.toFixed(2)}×</span></div>
    <div class="form-row"><label>弯度（上翘）</label><input type="range" data-tune="sori" min="0" max="1.2" step="0.01" value="${tune.sori}" /><span class="suffix" id="tune-sori">${tune.sori.toFixed(2)}</span></div>
    <div class="form-row"><label>刀柄长度</label><input type="range" data-tune="hilt" min="0.7" max="1.4" step="0.01" value="${tune.hilt}" /><span class="suffix" id="tune-hilt">${tune.hilt.toFixed(2)}×</span></div>
    <div class="row"><button data-act="tune-reset" class="ghost small">恢复原始</button><button data-act="save-obj" class="ghost small">导出 OBJ</button><button data-act="save-png" class="ghost small">导出贴图</button></div>
    <p class="hint">只动顶点，不动分组和 UV：长度沿刀轴拉伸（柄不跟着变长）、宽度改横截面、弯度让刀身上翘、柄长单独缩放。工具里看着满意就直接「导出 OBJ」，和贴图一起丢给工坊或别的工程用。</p>
    <div class="group-title">模型分组自检</div>
    <div class="group-checks">${groupCheck(b)}</div>
    <p class="hint">按 mcmod 教程《适用于“拔刀剑：重锋”的拔刀剑 obj 模型制作教程》：模型不要移动/缩放原版模型，你自己的模型要与它重合，并按上表把各部分命名为对应组名，否则游戏里不显示。</p>
    <p class="hint">内置刀模：樱刃 katana 是工坊自绘的程序化刀模（8 组齐全）；「原版 · 神裂 agito」「原版 · 阎魔 yamato」直接取自 SlashBlade: Resharped 的 <span class="suffix">assets/slashblade/model/named/</span>，贴图同名（agito 用的 <span class="suffix">agito_false.png</span>）。原版素材版权归原作者，仅供做兼容/比对参考，别单独二次分发。</p>
  </div>
  <div class="group">
    <div class="group-title">渲染细节</div>
    <div class="form-row"><label>召唤剑颜色</label>
      <input type="color" data-f="summonColor" value="${esc(b.summonColor)}" />
      <span class="suffix">${esc(b.summonColor)}</span></div>
    ${checkRow('颜色反转', 'colorInverse', b.colorInverse)}
    ${selectRow('携带姿态', 'carry', (b.carry || 'PSO2').toUpperCase(), CARRIES)}
    <p class="hint">决定刀放在快捷栏、不在主手时挂在角色身上的方式（<span class="suffix">render.carry_type</span>）。NINJA / PSO2 在第一人称视角下会自动隐藏，避免挡视线。</p>
  </div>`;
}

function recipeTab(b) {
  const others = state.project.blades.filter((x) => x.id !== b.id);
  const r = b.recipe || {};
  const grid = Array.isArray(r.grid) && r.grid.length
    ? r.grid.slice(0, 9).concat(new Array(Math.max(0, 9 - r.grid.length)).fill(''))
    : null;
  const sel = Math.min(8, Math.max(0, state.gridSel || 0));
  const cellLabel = (c) => {
    if (!c) return '空';
    if (c === 'blade') return '刀';
    if (c === 'material') return '主材';
    if (c === 'core') return '核心';
    const hit = paletteList().find(([id]) => id === c);
    if (hit) return hit[1];
    return (c.startsWith('#') ? '#' : '') + String(c.split(':').pop()).slice(0, 6);
  };
  const isItem = grid && grid[sel] && !['blade', 'material', 'core'].includes(grid[sel]) ? grid[sel] : '';
  return `
  <div class="group">
    <div class="group-title">配方</div>
    ${selectRow('配方类型', 'recipe.type', r.type || 'none', [
      ['none', '不生成配方'],
      ['create', '锻造：用材料直接做出来（工作台）'],
      ['upgrade', '强化：用另一把刀升上来（工作台）'],
      ['smithing', '锻造台：模板 + 源刀 + 添加物'],
    ])}
    ${r.type === 'smithing' ? '' : textRow('主材料', 'recipe.material', r.material || 'slashblade:proudsoul')}
    ${r.type === 'smithing' ? '' : textRow('核心材料', 'recipe.core', r.core || 'slashblade:proudsoul_sphere')}
  </div>
  ${r.type === 'smithing' ? `
  <div class="group">
    <div class="group-title">锻造台</div>
    ${selectRow('基底（源刀）', 'recipe.source', r.source || '', [['', '（请选择）'], ...others.map((x) => [x.id, `${x.zh || x.id} (${x.id})`])])}
    ${textRow('模板', 'recipe.template', r.template || 'minecraft:netherite_upgrade_smithing_template')}
    ${textRow('添加物', 'recipe.addition', r.addition || 'minecraft:netherite_ingot')}
    <p class="hint">模板和添加物都可以写 <span class="suffix">#forge:ingots/netherite</span> 这种标签形式，开头加一个 # 即可。</p>
  </div>` : ''}
  ${r.type === 'upgrade' ? `
  <div class="group">
    <div class="group-title">强化条件</div>
    ${selectRow('源刀', 'recipe.source', r.source || '', [['', '（请选择）'], ...others.map((x) => [x.id, `${x.zh || x.id} (${x.id})`])])}
    ${textRow('击杀数 ≥', 'recipe.kill', r.kill || 0, { type: 'number', attrs: 'min="0" step="10"' })}
    ${textRow('锻造数 ≥', 'recipe.refine', r.refine || 0, { type: 'number', attrs: 'min="0" step="1"' })}
    ${textRow('魂数 ≥', 'recipe.proud', r.proud || 0, { type: 'number', attrs: 'min="0" step="10"' })}
    <p class="hint">强化配方使用 SlashBlade 的 <span class="suffix">slashblade:shaped_blade</span> 类型，会保留源刀的击杀数/锻造数/附魔。</p>
  </div>` : ''}
  ${r.type === 'create' || r.type === 'upgrade' ? `
  <div class="group">
    <div class="group-title">摆法</div>
    <div class="row" style="display:flex;gap:8px;margin-bottom:8px">
      <button class="chip ${grid ? '' : 'active'}" data-gridmode="preset">预设摆法</button>
      <button class="chip ${grid ? 'active' : ''}" data-gridmode="custom">自定义 3×3</button>
    </div>
    ${grid ? `
    <div style="display:grid;grid-template-columns:repeat(3,58px);gap:6px;margin:4px 0 10px">
      ${grid.map((c, i) => `<button data-cell="${i}" title="${esc(c || '空')}" style="height:50px;border-radius:8px;border:1px solid ${i === sel ? '#2b6cb0' : '#26313f'};background:${i === sel ? '#17324a' : '#131b24'};color:${c ? '#e2ebf5' : '#5b6b7d'};cursor:pointer;font-size:12px">${esc(cellLabel(c))}</button>`).join('')}
    </div>
    <div class="hint">已选第 ${sel + 1} 格（第 ${Math.floor(sel / 3) + 1} 行第 ${(sel % 3) + 1} 列）：<b style="color:#e2ebf5">${esc(grid[sel] || '空')}</b></div>
    <div class="row" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">
      <button class="chip" data-setcell="">空</button>
      <button class="chip" data-setcell="blade">刀</button>
      <button class="chip" data-setcell="material">主材料</button>
      <button class="chip" data-setcell="core">核心材料</button>
    </div>
    <div class="row" style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px">
      <button class="chip" data-fill="row">整行铺满</button>
      <button class="chip" data-fill="col">整列铺满</button>
      <button class="chip" data-fill="clear">清空网格</button>
      <button class="chip" data-setcell="reset">载入预设摆法</button>
    </div>
    <div class="field"><label>该格自定义物品 id / 标签</label><input data-cellitem="1" spellcheck="false" placeholder="minecraft:diamond 或 #minecraft:planks" value="${esc(isItem)}" /></div>
    <div class="group-title" style="margin-top:14px">常用材料（点一下填进选中格）</div>
    <div class="row" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">
      ${paletteList().map(([id, label]) => `<button class="chip" data-pal="${esc(id)}" title="${esc(id)}">${esc(label)}</button>`).join('')}
      <button class="chip" data-palfav="1" title="把当前格的物品 id 存进这个面板">★ 收藏当前格</button>
    </div>
    ${(state.project.materialPalette || []).length ? `
    <div class="row" style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px">
      ${state.project.materialPalette.map(([id, label], i) => `<button class="chip" data-pal="${esc(id)}" title="${esc(id)}">${esc(label)}</button><button class="chip" data-paldel="${i}" title="从面板移除">×</button>`).join('')}
    </div>` : ''}
    <p class="hint">导出时会自动裁掉空行空列，同种材料自动合并成一个键。自定义格直接写 <span class="suffix">minecraft:diamond</span>、<span class="suffix">modid:item</span> 或 <span class="suffix">#minecraft:planks</span> 这种标签。</p>
    ` : '<p class="hint">当前是预设摆法（锻造 SSS/SBS/SSC、强化 S / SBS / S）。点「自定义 3×3」就能自己摆。</p>'}
  </div>` : ''}
  <div class="group">
    <div class="group-title">预览</div>
    <pre class="hint" style="white-space:pre-wrap">${esc(recipePreview(b))}</pre>
  </div>`;
}

function modelGroups(b) {
  return (String(b.modelData || '').match(/^\s*g\s+([^\s]+)/gm) || []).map((line) => line.trim().split(/\s+/)[1]);
}

function groupCheck(b) {
  const groups = modelGroups(b);
  return REQUIRED_GROUPS.map(([g, desc]) => {
    const ok = groups.includes(g);
    return `<div class="group-check ${ok ? 'ok' : 'miss'}"><span class="mark"></span><span class="gname">${g}</span><span class="gdesc">${desc}</span></div>`;
  }).join('');
}

const PALETTE_DEFAULT = [
  ['minecraft:iron_ingot', '铁锭'],
  ['minecraft:gold_ingot', '金锭'],
  ['minecraft:diamond', '钻石'],
  ['minecraft:netherite_ingot', '合金锭'],
  ['minecraft:stick', '木棍'],
  ['minecraft:blaze_rod', '烈焰棒'],
  ['minecraft:paper', '纸'],
  ['slashblade:proudsoul', '魂灵'],
  ['slashblade:proudsoul_sphere', '魂珠'],
  ['#minecraft:planks', '木板'],
];

function paletteList() {
  const custom = state.project.materialPalette || [];
  const seen = new Set(PALETTE_DEFAULT.map(([id]) => id));
  return PALETTE_DEFAULT.concat(custom.filter(([id]) => !seen.has(id)));
}

function presetGrid(type) {
  if (type === 'upgrade') return ['', 'material', '', 'material', 'blade', 'material', '', 'material', ''];
  return ['material', 'material', 'material', 'material', 'blade', 'material', 'material', 'material', 'core'];
}

function ensureGrid(recipe) {
  if (!Array.isArray(recipe.grid) || recipe.grid.length !== 9) recipe.grid = presetGrid(recipe.type);
  return recipe.grid;
}

function gridTrimmed(grid) {
  const cells = grid.slice(0, 9).concat(new Array(Math.max(0, 9 - grid.length)).fill(''));
  const syms = { blade: 'B', material: 'S', core: 'C' };
  const itemSym = new Map();
  const free = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  let fi = 0;
  const symOf = (cell) => {
    if (!cell) return ' ';
    if (syms[cell]) return syms[cell];
    if (!itemSym.has(cell)) itemSym.set(cell, free[fi++] || 'X');
    return itemSym.get(cell);
  };
  const rows = [0, 1, 2].map((i) => cells.slice(i * 3, i * 3 + 3).map(symOf));
  const nr = rows.map((row) => row.some((c) => c !== ' '));
  const nc = [0, 1, 2].map((c) => rows.some((row) => row[c] !== ' '));
  const r0 = nr.indexOf(true), r1 = nr.lastIndexOf(true);
  const c0 = nc.indexOf(true), c1 = nc.lastIndexOf(true);
  if (r0 < 0 || c0 < 0) return null;
  return { pattern: rows.slice(r0, r1 + 1).map((row) => row.slice(c0, c1 + 1).join('')), itemSym };
}

function recipePreview(b) {
  const r = b.recipe || {};
  if (!r.type || r.type === 'none') return '（不生成配方文件）';
  const ns = state.project.namespace;
  if (r.type === 'smithing') {
    return `${ns}:recipes/${b.id}.json\n类型：slashblade:slashblade_smithing（锻造台）\n模板 = ${r.template || 'minecraft:netherite_upgrade_smithing_template'}\n基底 = ${r.source || '（未选源刀）'}（击杀≥${r.kill || 0} 锻造≥${r.refine || 0} 魂≥${r.proud || 0}）\n添加物 = ${r.addition || 'minecraft:netherite_ingot'}\n产出刀 = ${ns}:${b.id}`;
  }
  if (Array.isArray(r.grid) && r.grid.some((c) => c)) {
    const t = gridTrimmed(r.grid);
    if (!t) return '（自定义摆法是空的，不会生成配方）';
    const lines = t.pattern.map((row) => '  ' + row.split('').map((c) => (c === ' ' ? '·' : c)).join(' '));
    const keyLines = [];
    if (t.pattern.join('').includes('B')) keyLines.push(`  B = ${r.type === 'upgrade' ? r.source : '空白刀坯 + ' + ns + ':' + b.id}（击杀≥${r.kill || 0} 锻造≥${r.refine || 0} 魂≥${r.proud || 0}）`);
    if (t.pattern.join('').includes('S')) keyLines.push(`  S = ${r.material || 'slashblade:proudsoul'}`);
    if (t.pattern.join('').includes('C')) keyLines.push(`  C = ${r.core || 'slashblade:proudsoul_sphere'}`);
    for (const [item, ch] of t.itemSym) keyLines.push(`  ${ch} = ${item}`);
    return `${ns}:recipes/${b.id}.json\n类型：slashblade:shaped_blade（自定义 3×3）\npattern:\n${lines.join('\n')}\nkey:\n${keyLines.join('\n')}`;
  }
  if (r.type === 'create') {
    return `${ns}:recipes/${b.id}.json\npattern: SSS / SBS / SSC\nS = ${r.material}\nB = 空白刀坯 + 名称 ${ns}:${b.id}\nC = ${r.core}`;
  }
  return `${ns}:recipes/${b.id}.json\npattern:  S  / SBS /  S \nB = ${r.source}（击杀≥${r.kill || 0} 锻造≥${r.refine || 0} 魂≥${r.proud || 0}）\nS = ${r.material}`;
}

/* ---------------- 刀谱（HTML） ---------------- */
function catalogDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function saName(id) {
  const hit = SLASH_ARTS.find(([v]) => v === id);
  if (!hit) return id || '（未设置）';
  return hit[1].split(' ')[0].replace(/（.*?）$/, '');
}

function buildCatalogHtml(project) {
  const ns = project.namespace || 'blade';
  const pack = project.pack || {};
  const rows = project.blades.map((b) => {
    const issues = validate(b, project);
    const bad = issues.filter((i) => i[0] === 'bad').length;
    const warn = issues.filter((i) => i[0] === 'warn').length;
    const ench = (b.enchants || []).map((e) => `${enchantName(e.id)} ${roman(e.lvl)}`).join('、') || '—';
    const eff = (b.effects || []).map((e) => e.split(':').pop()).join('、') || '—';
    const types = (b.types || []).join('、') || '—';
    const rec = !b.recipe || b.recipe.type === 'none' ? '无配方' : b.recipe.type === 'create' ? '锻造' : `强化（源刀 ${b.recipe.source}）`;
    const color = bad ? '#ff6b6b' : warn ? '#e9c46a' : '#5ad08a';
    return `
      <tr>
        <td><b>${esc(b.zh || b.en || b.id)}</b><div class="id">${esc(ns)}:${esc(b.id)}</div></td>
        <td class="num">${Number(b.attack).toFixed(1)}</td>
        <td class="num">${b.dur}${b.unbreakable ? '（不可破坏）' : ''}</td>
        <td>${esc(saName(b.slashArt))}</td>
        <td>${esc(types)}</td>
        <td>${esc(eff)}</td>
        <td class="ench">${esc(ench)}</td>
        <td>${esc(rec)}</td>
        <td style="color:${color}">${bad ? `错误 ${bad}` : warn ? `提示 ${warn}` : '通过'}</td>
      </tr>`;
  }).join('');

  const total = project.blades.length;
  const badAll = project.blades.filter((b) => validate(b, project).some((i) => i[0] === 'bad')).length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(pack.name || ns)} · 刀谱</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 28px 56px; background: #11131a; color: #d8dcea;
         font: 14px/1.6 "Segoe UI", "PingFang SC", system-ui, sans-serif; }
  h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: .5px; }
  .sub { color: #7f89a5; font-size: 12.5px; margin-bottom: 22px; }
  .sub code { color: #b8c3dd; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-weight: 600; font-size: 12px; color: #8d97b3;
             padding: 8px 10px; border-bottom: 1px solid #262b3a; letter-spacing: .5px; }
  tbody td { padding: 10px; border-bottom: 1px solid #1d2230; vertical-align: top; }
  tbody tr:hover { background: #171b26; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .id { color: #6f7a96; font-size: 11.5px; font-family: ui-monospace, Consolas, monospace; }
  .ench { color: #c9a4ff; font-size: 12.5px; }
  .foot { margin-top: 22px; color: #6a7490; font-size: 12px; }
  .foot b { color: #cbd4ea; }
</style>
</head>
<body>
  <h1>${esc(pack.name || ns)} · 刀谱</h1>
  <div class="sub">命名空间 <code>${esc(ns)}</code> · 共 ${total} 把刀 · 生成于 ${catalogDate()}${pack.version ? ` · 版本 ${esc(pack.version)}` : ''}</div>
  <table>
    <thead><tr>
      <th style="width:22%">刀</th><th style="width:7%">攻击</th><th style="width:9%">耐久</th>
      <th style="width:14%">拔刀术</th><th style="width:9%">刀型</th><th style="width:9%">SE</th>
      <th>附魔</th><th style="width:12%">获取</th><th style="width:8%">校验</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">校验不通过的刀有 <b>${badAll}</b> 把（共 ${total} 把）。此页由樱刃工坊生成，直接双击即可在浏览器查看，也可打印成 PDF。</div>
</body>
</html>`;
}

async function exportCatalog() {
  if (!window.api || !window.api.saveHtml) { toast('当前环境不能写文件', true); return; }
  const html = buildCatalogHtml(state.project);
  const p = await window.api.saveHtml(`${state.project.namespace || 'blade'}-catalog.html`, html);
  if (p) toast('刀谱已导出：' + p);
}

function checkTab(b) {
  const issues = validate(b, state.project);
  const rows = issues.length
    ? issues
        .map(
          ([level, tag, msg]) => `<div class="check-item ${level}"><span class="tag">${level === 'bad' ? '错误' : level === 'warn' ? '提示' : '通过'}</span><div><b>${esc(tag)}</b> · ${esc(msg)}</div></div>`
        )
        .join('')
    : `<div class="check-item ok"><span class="tag">通过</span><div>这把刀没有发现问题</div></div>`;

  return `
  <div class="group">
    <div class="group-title">检查项</div>
    <div class="check-list">${rows}</div>
  </div>
  <div class="group">
    <div class="group-title">导出</div>
    <div class="export-box">
      <p>jar 里包含：named_blades 定义、模型+贴图、中英文语言、配方、mods.toml。<br/>
      放到 <b>mods/</b> 里即可，需要前置 SlashBlade: Resharped 1.20.1。</p>
      <div class="btn-row">
        <button id="btnExport2" class="accent small">导出附属包 jar</button>
        <button id="btnExportPacks2" class="ghost small">资源包 + 数据包</button>
      </div>
    </div>
  </div>`;
}


const DOC = [
  {
    t: '剑技与连击',
    rows: [
      ['拔刀术（SA）', '待机 Standby 时按特殊移动键拔刀出鞘，触发当前 SA；在 None 状态下无法使用'],
      ['次元斩 Judgement Cut', '后退小半步，在准星或锁定目标处召唤球状实体，半径 4 格内造成 5 段魔法伤害；完美释放额外斩 3 下并上挑。绝大多数刀的默认 SA'],
      ['终焉樱 Sakura End', '原地蓄势后向前方放射樱花花瓣的多段攻击'],
      ['虚空斩 Void Slash', '短距离瞬间移动并攻击，可穿过薄墙'],
      ['圆舞斩 Circle Slash', '原地横向大范围回旋斩，覆盖面广但位移小'],
      ['幻影刃-纵 / 幻影刃 Drive Vertical / Horizontal', '高速突进直线斩，纵劈与横斩两个版本'],
      ['波刀龙胆 Wave Edge', '放出向前飞行的斩击波，可打远处目标'],
      ['平突 Piercing', '蓄力突刺，一条直线穿透多个目标'],
      ['连击 Combo A/B/C', '左键连续点击依次进入 A1→B1→C1；连段入口 root_combo 决定起手动作'],
    ],
  },
  {
    t: '附魔增效',
    rows: [
      ['锋利 / 亡灵杀手 / 节肢杀手', '直接换算成额外攻击力，按附魔等级提升'],
      ['抢夺', '提升击杀掉落（耀魂碎片、经验）'],
      ['耐久 / 经验修补', '减缓耐久消耗并可用经验修复'],
      ['灵魂疾行', '刀上带此附魔时提升移动速度'],
      ['缓降', '刀上带此附魔时下落速度变慢'],
      ['扩展附魔（前置提供）', '霜寒 / 剧毒 / 吸血 / 雷击 / 摄魂 / 处刑 / 湮灭 / 狂战 / 凋零性 / 兽性 / 载器 / 收魂 / 凶刃 / 耀魂爆发 —— 共 14 种，装 Blade Forge Arts 才生效，写法 <span class="suffix">bladeforge_arts:xxx</span>'],
    ],
    note: '1.20.1 重锋的原生附魔增效只有灵魂疾行、摔落缓冲两种；其余都是前置补给刀的额外增益。',
  },
  {
    t: '刀魂三项数值（杀敌数 / 荣耀值 / 锻造数）',
    rows: [
      ['杀敌数 KillCount', '只认「这把刀亲手击杀」，烧死、摔死、落石等环境伤害不计。累计 ≥1000 会自动进入千杀 Fiercer Edge，评级需求与伤害阶段随之改变'],
      ['荣耀值 ProudSoul', '刀的能量条，放 SA、幻影剑、修耐久、做耀魂材料都要花。每次击杀在 +1 杀敌数的同时涨荣耀，涨幅 = 怪物掉落经验 × (1 + 评级系数 × 0.1)，D=1 / C=2 / B=3 / A=4 / S=5 / SS=6 / SSS=7'],
      ['锻造数 Refine', '每在铁砧上动一次刀 +1：改名、附魔书附魔、耀魂修耐久、耀魂加荣耀都算。每 +1 极限伤害 +1，但要玩家等级解锁——等级 ≥ 锻造数全额生效，等级 < 锻造数只按等级数算'],
    ],
    note: '这三项都是「用出来」的运行时数据，named_blades 定义里没有对应字段（只认 properties / render / enchantments / creativeGroup），所以工坊出的新刀一定从 0 开始。进游戏后用下面的 /bladeforge 命令可以直接改。',
  },
  {
    t: '游戏内一条命令改刀',
    rows: [
      ['/bladeforge soul <杀敌数> <荣耀值> <锻造数>', '直接写主手刀的刀魂三项，写完立刻生效，不用重开背包'],
      ['/bladeforge color <RRGGBB> [inverse]', '改刀光颜色，剑气与闪光同色；加 inverse 反转'],
      ['/bladeforge art <拔刀术>', '换这把刀的 SA，写中文名就行：次元斩 / 圆舞斩 / 幻影刃 / 终焉樱 / 平突 / 波刀龙胆'],
      ['/bladeforge se add|remove <效果>', '加或去掉特殊效果，简名直接写「凋零性」，clear 全清'],
      ['/bladeforge ench <附魔>[ 等级]', '一条命令附魔，中文简名也认：收魂 3、耀魂爆发:3、或 minecraft:sharpness 5'],
      ['/bladeforge info', '一次看全：名称、三项数值、拔刀术、刀光色、特殊效果、附魔'],
    ],
    note: '需要 2 级权限（单人开作弊即可）。全部走能力反射，没装拔刀剑本体时模组照样能启动，只是这些命令改不了刀。',
  },
  {
    t: '刀的状态',
    rows: [
      ['附魔 Enchanted', '开局直接视为已附魔的状态（不同于「妖」）'],
      ['妖 Bewitched', '可接纳附魔，附魔后刀光变为红色'],
      ['封印 Sealed', '禁止使用拔刀术，只能平砍'],
      ['千杀 Fiercer Edge', '击杀数达到 1000 后自动附加，攻击力上升'],
      ['折断 Broken', '耐久耗尽，需修复才能继续使用'],
      ['残刃 Edge Fragment', '只剩刃片，外观与判定都退化'],
      ['无鞘 No Scabbard', '不带刀鞘，手持状态直接暴露刀身'],
      ['噬魂 Soul Eater', '攻击时吸取目标灵魂回复耀魂'],
    ],
  },
  {
    t: '特殊效果',
    rows: [
      ['凋零性 Wither Edge', '命中时附加凋零效果（slashblade:wither_edge）'],
      ['其他', '由附属模组通过 SpecialEffectsRegistry 注册，ID 写进 special_effects 即可'],
    ],
  },
  {
    t: '战斗能力',
    rows: [
      ['防御 / 格挡', '副手或右键格挡，减免正面伤害'],
      ['踢跃 / 借力跳', '对着敌人或墙面借力起跳'],
      ['瞬步·上行 / 隔空 / 退行 / 回避', '消耗耀魂的高速位移，方向取决于输入'],
      ['Untouchable', '完美闪避后的无敌帧窗口'],
      ['Lock On', '锁定目标，命中判定更稳'],
      ['TNT 灭火 / 箭矢反射', '刀身可熄灭 TNT、反弹箭矢'],
      ['Stun', '命中后使目标短暂硬直'],
    ],
  },
  {
    t: '舞台预览模式',
    rows: [
      ['物品栏姿态', '只画 item_blade 组，等同物品栏里看到的样子'],
      ['手持姿态', '画 blade + sheath 组，等同第三人称手持收刀状态'],
      ['角色背负', '带一个 1.8 格高的方块小人，按当前 carry_type 把刀挂上去，可旋转观察'],
    ],
    note: '角色背负是按 LayerMainBlade 里的位移与旋转做的近似还原，用于对照姿态，不是逐像素复刻游戏内的挂点。',
  },
  {
    t: '携带姿态 carry_type',
    rows: [
      ['DEFAULT', '横背：水平横挂背后，略向斜下，刀柄在右肩'],
      ['KATANA', '腰间：横插在腰带位置，刀柄在右侧'],
      ['NINJA', '斜背：从右肩斜向左腰，第一人称自动隐藏'],
      ['RNINJA', '反向斜背：与 NINJA 方向相反的斜挂'],
      ['PSO2', '竖贴后背：几乎竖直贴在背上，第一人称自动隐藏'],
      ['NONE', '不渲染：收刀时完全不画模型'],
    ],
    note: '对应定义里的 render.carry_type，值为小写字符串；不填时默认 PSO2。',
  },
  {
    t: 'OBJ 模型分组（mcmod 教程 5202）',
    rows: [
      ['blade', '第三人称的刀身'],
      ['sheath', '第三人称的刀鞘'],
      ['blade_damaged', '耐久低时的刀身'],
      ['blade_fragment', '断刃碎片'],
      ['effect', 'SA 蓄力时鞘口的高光'],
      ['item_blade', '物品栏图标（完好）'],
      ['item_damaged', '物品栏图标（损坏）'],
      ['item_bladens', '无鞘图标（原教程标注未知，可不做）'],
    ],
    note: '模型不要移动/缩放/旋转原版参考模型，自己的模型要与它完全重合并按上表分组命名，否则游戏内不显示或显示错位。',
  },
];

function docTab() {
  return `
  <div class="group">
    <div class="group-title">拔刀剑机制速查（重锋 1.20.1）</div>
    ${DOC.map((sec) => `
      <div class="doc-sec">
        <div class="doc-title">${sec.t}</div>
        <table class="doc-table">${sec.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
        ${sec.note ? `<p class="hint">${sec.note}</p>` : ''}
      </div>`).join('')}
  </div>`;
}

/* ---------------- 更新 ---------------- */

function fmtBytes(n) {
  const v = Number(n) || 0;
  if (!v) return '大小未知';
  if (v >= 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + ' MB';
  return Math.round(v / 1024) + ' KB';
}

const FEEDBACK_REPO = 'https://github.com/MCr630239/sakuraedge';

function feedbackUrl() {
  const info = (state.upd && state.upd.info) || {};
  const body = [
    '**问题 / 建议**',
    '',
    '',
    '**复现步骤（如果是 bug）**',
    '1. ',
    '',
    '**环境**',
    `- 樱刃工坊 v${info.version || '未知'}`,
    `- 平台：${info.platform || '未知'}${info.packaged === false ? '（开发模式）' : ''}`,
    '',
    '**截图 / 日志 / 工程文件**',
    '（可以直接拖进这个输入框）',
  ].join('\n');
  return `${FEEDBACK_REPO}/issues/new?title=${encodeURIComponent('【反馈】')}&body=${encodeURIComponent(body)}`;
}

function updateTab() {
  const u = state.upd;
  const info = u.info || {};
  const res = u.result;
  const meta = res && res.ok ? res.meta : null;

  let status = '<p class="hint">还没检查过。填好更新源后点「立即检查」。</p>';
  if (u.checking) status = '<p class="hint">正在读取更新源…</p>';
  else if (u.downloading) {
    const pct = Math.round((u.pct || 0) * 100);
    const mb = (n) => (n / 1048576).toFixed(1);
    let line = `正在下载更新包… ${pct}%`;
    if (u.total) line += ` · ${mb(u.got)} / ${mb(u.total)} MB`;
    if (u.speed) line += ` · ${(u.speed / 1048576).toFixed(2)} MB/s`;
    status = `<p class="hint">${line}</p>
      <div style="height:6px;background:#1a2330;border-radius:3px;overflow:hidden;margin:6px 0 10px"><div style="height:6px;width:${pct}%;background:#e05a7a"></div></div>`;
  } else if (u.installing) {
    const ex = u.extract;
    const epct = ex ? Math.round((ex.pct || 0) * 100) : 0;
    let line = `正在解压更新包… ${ex ? epct + '%' : ''}`;
    if (ex && ex.total) line += ` · ${ex.done} / ${ex.total} 个条目`;
    if (ex && ex.skipped) line += ` · 跳过 ${ex.skipped} 个未变化文件`;
    status = `<p class="hint">${line}</p>
      <div style="height:6px;background:#1a2330;border-radius:3px;overflow:hidden;margin:6px 0 10px"><div style="height:6px;width:${epct}%;background:#e05a7a"></div></div>`;
  }
  else if (u.installed) {
    const r = u.installed;
    status = r.ok
      ? `<p class="hint" style="color:#8bd89a">已解压 ${r.count} 个文件${r.skipped ? '（跳过 ' + r.skipped + ' 个未变化）' : ''}，${r.restart ? '工坊会自动退出并替换，然后重新启动' : '请手动替换'}。</p>
         <p class="hint">目标目录：<span class="suffix">${esc(r.appDir || '')}</span></p>`
      : `<p class="hint" style="color:#e8a07a">${esc(r.error || '安装失败')}</p>
         ${r.stage ? `<p class="hint">已解压到：<span class="suffix">${esc(r.stage)}</span></p>` : ''}`;
  } else if (res) {
    if (!res.ok) status = `<p class="hint" style="color:#e88484">检查失败：${esc(res.error || '未知错误')}</p>`;
    else if (res.newer) {
      status = `<p style="color:#8bd89a;font-weight:600">发现新版本 v${esc(meta.version)}（当前 v${esc(res.current)}）</p>
        ${(meta.delta && meta.delta.from === res.current)
          ? `<p class="hint" style="color:#8bd89a">增量更新：只需 ${fmtBytes(meta.delta.size)}（比整包 ${fmtBytes(meta.size)} 少 ${fmtBytes(Math.max(0, meta.size - meta.delta.size))}）</p>`
          : `<p class="hint">更新包：${fmtBytes(meta.size)}${meta.channel ? ' · ' + esc(meta.channel) : ''}</p>`}
        ${meta.notes ? `<p class="hint" style="white-space:pre-wrap">${esc(meta.notes)}</p>` : ''}
        <div class="row" style="display:flex;gap:8px;margin:10px 0">
          <button class="chip active" data-upd="download">${(meta.delta && meta.delta.from === res.current) ? '增量更新并安装' : '下载并安装'}</button>
          <button class="chip" data-upd="downloadonly">只下载</button>
        </div>`;
    } else {
      status = `<p style="color:#8bd89a">已是最新版本 v${esc(res.current)}</p>`;
    }
  }

  return `
  <div class="group">
    <div class="group-title">关于</div>
    <div class="doc-sec">
      <table class="doc-table">
        <tr><td>当前版本</td><td>v${esc(info.version || '—')}</td></tr>
        <tr><td>运行平台</td><td>${esc(info.platform || '—')}${info.packaged === false ? '（开发模式）' : ''}</td></tr>
      </table>
    </div>
    <p class="hint">自动更新只支持 Windows 正式版：下载 zip → 解压到临时目录 → 等工坊退出后覆盖安装目录 → 自动重启。</p>
    <p class="hint">建议把工坊解压在普通文件夹（例如 <span class="suffix">D:\Tools\SakuraEdgeStudio</span>）。装在 <span class="suffix">Program Files</span> 这类受保护目录时，替换需要以管理员身份运行。</p>
    <div class="row" style="display:flex;gap:8px;margin:10px 0 6px">
      <button class="chip active" data-upd="feedback">遇到问题 / 提建议</button>
      <button class="chip" data-upd="issues">查看已有反馈</button>
    </div>
    <p class="hint">打开的是 GitHub Issues 新建页，标题和正文会自动带上版本与系统信息；截图、导出的工程、日志都能直接贴进去。</p>
  </div>
  <div class="group">
    <div class="group-title">更新源</div>
    <div class="field"><label>更新源（GitHub 仓库 / latest.json 地址 / 本地目录）</label>
      <input id="updSource" spellcheck="false" placeholder="github:你的名字/仓库 或 https://…/latest.json 或 D:\\update" value="${esc(u.source || '')}" /></div>
    <div class="field"><label>GitHub Token（可选，仓库私有或 API 限流时填）</label>
      <input id="updToken" type="password" spellcheck="false" placeholder="ghp_… （留空也够用）" value="${esc(u.token || '')}" /></div>
    <div class="row" style="display:flex;gap:8px;align-items:center;margin:8px 0">
      <button class="chip" data-upd="save">保存</button>
      <button class="chip active" data-upd="check">立即检查</button>
      <button class="chip" data-upd="zip">从 zip 安装…</button>
    </div>
    <label class="hint" style="display:flex;gap:6px;align-items:center;cursor:pointer">
      <input type="checkbox" data-upd-auto="1" ${u.autoCheck ? 'checked' : ''} /> 启动时自动检查（每天一次）
    </label>
    <p class="hint">GitHub 源写法：<span class="suffix">github:你的名字/仓库</span> 读最新 release；<span class="suffix">github:名字/仓库@v1.14.2</span> 固定某个 tag。</p>
    <p class="hint">发版约定：tag 用 <span class="suffix">v1.14.2</span> 这种形式，附件命名为 <span class="suffix">SakuraEdgeStudio-1.14.2-Windows-x64.zip</span>。API 被限流时会自动改读 releases.atom 并按这个约定拼下载地址。</p>
    <p class="hint">私有仓库也能用：填 GitHub Token 后，附件的下载会自动走 API 鉴权；不做开源也不影响发版。</p>
    <p class="hint">也可以填清单地址：<span class="suffix">{"version":"1.14.1","url":"…zip","size":116391936,"notes":"…"}</span>，url 支持相对路径。</p>
  </div>
  <div class="group">
    <div class="group-title">状态</div>
    ${u.info && u.info.lastFail ? `<p class="hint" style="color:#e8a07a">${esc(u.info.lastFail)}</p>` : ''}
    ${status}
    <div class="row" style="display:flex;gap:8px;margin-top:10px">
      <button class="chip" data-upd="logdir">打开更新日志目录</button>
    </div>
  </div>`;
}

async function updCheck(silent) {
  const u = state.upd;
  const src = (document.getElementById('updSource') || {}).value;
  if (src !== undefined) u.source = String(src).trim();
  const tok = document.getElementById('updToken');
  if (tok) u.token = String(tok.value || '').trim();
  if (u.token !== (u.info && u.info.token)) {
    await window.api.updateSave({ source: u.source, token: u.token });
  }
  if (!u.source) {
    u.result = { ok: false, error: '先填一个更新源地址' };
    if (state.tab === 'update') renderInspector();
    return;
  }
  u.checking = true;
  u.installed = null;
  if (state.tab === 'update') renderInspector();
  const r = await window.api.updateCheck(u.source);
  u.checking = false;
  u.result = r;
  if (r && r.ok && r.newer && silent) showUpdateBanner(r.meta);
  if (state.tab === 'update') renderInspector();
}

async function updDownloadAndInstall(autoInstall) {
  const u = state.upd;
  const meta = u.result && u.result.ok ? u.result.meta : null;
  if (!meta || !meta.url) {
    toast('更新清单里没有下载地址', true);
    return;
  }
  u.downloading = true;
  u.pct = 0;
  if (state.tab === 'update') renderInspector();
  const dl = await window.api.updateDownload({ url: meta.url, assetApi: meta.assetApi || '' });
  u.downloading = false;
  if (!dl.ok) {
    toast('下载失败：' + dl.error, true);
    u.result = { ok: false, error: '下载失败：' + dl.error };
    if (state.tab === 'update') renderInspector();
    return;
  }
  toast(`已下载 ${fmtBytes(dl.bytes)}`);
  if (!autoInstall) {
    u.installed = { ok: false, error: '只下载完成，文件在 ' + dl.path + '，可以点「从 zip 安装…」选它' };
    if (state.tab === 'update') renderInspector();
    return;
  }
  await updInstallPath(dl.path);
}

async function updInstallPath(zipPath) {
  const u = state.upd;
  if (!zipPath) return;
  u.installing = true;
  u.extract = null;
  u.installed = null;
  if (state.tab === 'update') renderInspector();
  const r = await window.api.updateInstall(zipPath);
  u.installing = false;
  u.installed = r;
  if (state.tab === 'update') renderInspector();
}

async function updPickAndInstall() {
  const p = await window.api.updatePickZip();
  if (p) await updInstallPath(p);
}

function showUpdateBanner(meta) {
  let el = document.getElementById('updateBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'updateBanner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:10px;padding:8px 14px;background:linear-gradient(90deg,#1c3b2b,#17324a);border-bottom:1px solid #2b6cb0;font-size:13px;color:#cfe6ff';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>工坊有新版本 <b>v${esc(meta.version)}</b>（当前 v${esc((state.upd.info || {}).version || '')}）</span>
    <button class="chip active" id="updBannerGo">去更新</button>
    <button class="chip" id="updBannerX">×</button>`;
  el.querySelector('#updBannerGo').onclick = () => {
    state.tab = 'update';
    renderInspector();
  };
  el.querySelector('#updBannerX').onclick = () => el.remove();
}

async function initUpdate() {
  if (!window.api || !window.api.updateState) return;
  try {
    const st = await window.api.updateState();
    state.upd.info = st;
    state.upd.source = st.source || '';
    state.upd.token = st.token || '';
    state.upd.autoCheck = st.autoCheck !== false;
    if (window.api.onUpdateProgress) {
      window.api.onUpdateProgress((p) => {
        if (!p) return;
        if (p.phase === 'extract') {
          state.upd.extract = { done: p.done, total: p.total, pct: p.pct || 0, skipped: p.skipped || 0 };
          updateTab();
          return;
        }
        if (p.phase !== 'download') return;
        const now = Date.now();
        if (state.upd.lastT && now - state.upd.lastT > 250) {
          state.upd.speed = (p.got - state.upd.lastGot) / ((now - state.upd.lastT) / 1000);
          state.upd.lastT = now;
          state.upd.lastGot = p.got;
        } else if (!state.upd.lastT) {
          state.upd.lastT = now;
          state.upd.lastGot = p.got;
        }
        state.upd.got = p.got;
        state.upd.total = p.total;
        state.upd.pct = p.pct || 0;
        if (state.tab === 'update' && state.upd.downloading) renderInspector();
      });
    }
    if (state.upd.autoCheck && state.upd.source) {
      const last = Number(st.lastCheck || 0);
      if (Date.now() - last > 12 * 3600 * 1000) updCheck(true);
    }
  } catch (_) {}
}

function renderInspector() {
  const b = current();
  document.querySelectorAll('#tabs button').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === state.tab));
  if (state.tab === 'update') {
    tabBody.innerHTML = updateTab();
    return;
  }
  if (!b) {
    tabBody.innerHTML = '<p class="hint">左边还没有刀，点「＋ 新建刀」开始。</p>';
    return;
  }
  const html = { base: baseTab, stats: statsTab, render: renderTab, recipe: recipeTab, check: checkTab, doc: docTab }[state.tab](b);
  tabBody.innerHTML = html;
  updateStageMeta();
}

const CARRY_DEFAULT = {
  DEFAULT: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
  KATANA: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
  NINJA: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
  RNINJA: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
  PSO2: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
};

function effPose(b) {
  const t = String((b && b.carry) || 'PSO2').toUpperCase();
  return Object.assign({}, CARRY_DEFAULT[t] || CARRY_DEFAULT.PSO2, (b && b.pose) || {});
}

function syncPosePanel() {
  const b = current();
  const panel = $('posePanel');
  if (!panel) return;
  panel.hidden = state.mode !== 'back' || !b;
  if (panel.hidden || !b) return;
  const p = effPose(b);
  panel.querySelector('#poseType').textContent = String(b.carry || 'PSO2').toUpperCase();
  for (const key of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'scale']) {
    const input = panel.querySelector(`[data-pose="${key}"]`);
    if (input) input.value = p[key];
  }
  panel.querySelector('#poseNums').textContent = `x ${p.x} y ${p.y} z ${p.z} / ${p.rx} ${p.ry} ${p.rz}`;
  const len = panel.querySelector('#poseLen');
  if (len) len.textContent = `长度 ${(Number(p.scale) || 1).toFixed(2)}×（原版为 1.00×）`;
}

function carryLabel(carry) {
  const key = String(carry || 'PSO2').toUpperCase();
  const hit = CARRIES.find((c) => c[0] === key);
  return hit ? hit[1] : key;
}

function updateStageMeta() {
  const b = current();
  if (!b) return;
  const issues = validate(b, state.project);
  const bad = issues.filter((i) => i[0] === 'bad').length;
  const warn = issues.filter((i) => i[0] === 'warn').length;
  $('stageMeta').innerHTML = [
    `attack <span style="color:#8b93ab">${Number(b.attack).toFixed(1)}</span> · dur <span style="color:#8b93ab">${b.dur}</span>`,
    `${esc(b.modelName || 'obj')} · ${esc(b.textureName || 'png')}`,
    state.mode === 'back' ? `背负 · ${esc(carryLabel(b.carry))}` : null,
    bad ? `<span style="color:#e5645f">${bad} 个错误</span>` : warn ? `<span style="color:#e2b341">${warn} 个提示</span>` : '<span style="color:#4fc08d">校验通过</span>',
  ].filter(Boolean).join('<br/>');
  $('stageTitle') && ($('stageTitle').textContent = b.zh || b.en || b.id);
  $('statusRight').textContent = `${state.project.namespace}:${b.id} · ${state.project.blades.length} 把刀${state.dirty ? ' · 未保存' : ''}`;
}

function refreshPreview() {
  const b = current();
  if (!b || !state.preview) return;
  state.preview.setBlade(b, state.mode);
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 220);
}

/* ---------------- 事件 ---------------- */

function onEdit(target) {
  const b = current();
  const f = target.dataset.f;
  if (!b || !f) return;
  let value = target.type === 'checkbox' ? target.checked : target.value;

  if (f === 'effects') b.effects = value.split(/[\n,，;；]+/).map((s) => s.trim()).filter(Boolean);
  else if (f === 'ench.id') {
    b.enchants[Number(target.dataset.i)].id = value.trim();
    state.dirty = true;
    renderInspector();
    return;
  }
  else if (f === 'ench.lvl') {
    const i = Number(target.dataset.i);
    b.enchants[i].lvl = Math.min(255, Math.max(1, parseInt(value, 10) || 1));
    const info = ENCH_INDEX.get(b.enchants[i].id);
    if (info && b.enchants[i].lvl > info.max) toast(`${info.cn} 原版上限 ${info.max} 级，拔刀剑会照写入，但游戏里可能被裁剪`);
    state.dirty = true;
    renderInspector();
    return;
  }
  else if (f.startsWith('recipe.')) {
    const key = f.slice(7);
    if (key === 'kill' || key === 'refine' || key === 'proud') value = Math.max(0, parseInt(value, 10) || 0);
    b.recipe = b.recipe || {};
    b.recipe[key] = value;
  } else if (f === 'attack' || f === 'dur') {
    b[f] = Number(value) || 0;
  } else {
    b[f] = value;
  }
  state.dirty = true;
  if (['id', 'zh', 'attack'].includes(f)) renderList();
  if (f === 'recipe.type' || f === 'recipe.source') renderInspector();
  if (f.startsWith('recipe.') && state.tab === 'recipe' && f === 'recipe.type') renderInspector();
  updateStageMeta();
  if (['modelData', 'textureData'].includes(f)) schedulePreview();
  if (f === 'carry' && state.mode === 'back') {
    state.preview.setMode('back');
    syncPosePanel();
  }
}

tabBody.addEventListener('click', (e) => {
  const upd = e.target.closest('[data-upd]');
  if (upd) {
    const how = upd.dataset.upd;
    if (how === 'save') {
      const srcEl = document.getElementById('updSource');
      const tokEl = document.getElementById('updToken');
      state.upd.source = srcEl ? srcEl.value.trim() : state.upd.source;
      state.upd.token = tokEl ? tokEl.value.trim() : state.upd.token;
      window.api.updateSave({ source: state.upd.source, token: state.upd.token, autoCheck: state.upd.autoCheck });
      toast('更新源已保存');
      return;
    }
    if (how === 'check') { updCheck(false); return; }
    if (how === 'zip') { updPickAndInstall(); return; }
    if (how === 'download') { updDownloadAndInstall(true); return; }
    if (how === 'downloadonly') { updDownloadAndInstall(false); return; }
    if (how === 'logdir') { window.api.updateOpenLogDir(); return; }
    if (how === 'feedback') { window.api.openUrl(feedbackUrl()); return; }
    if (how === 'issues') { window.api.openUrl(FEEDBACK_REPO + '/issues'); return; }
  }
  const cell = e.target.closest('[data-cell]');
  if (cell) {
    state.gridSel = Number(cell.dataset.cell) || 0;
    renderInspector();
    return;
  }
  const mode = e.target.closest('[data-gridmode]');
  if (mode) {
    const b = current();
    if (!b) return;
    b.recipe = b.recipe || {};
    if (mode.dataset.gridmode === 'custom') ensureGrid(b.recipe);
    else delete b.recipe.grid;
    state.dirty = true;
    renderInspector();
    return;
  }
  const fillBtn = e.target.closest('[data-fill]');
  if (fillBtn) {
    const b = current();
    if (!b) return;
    b.recipe = b.recipe || {};
    ensureGrid(b.recipe);
    const how = fillBtn.dataset.fill;
    const sel = Math.min(8, Math.max(0, state.gridSel || 0));
    if (how === 'clear') b.recipe.grid = new Array(9).fill('');
    else {
      const v = b.recipe.grid[sel] || '';
      if (how === 'row') for (let c = 0; c < 3; c++) b.recipe.grid[Math.floor(sel / 3) * 3 + c] = v;
      else for (let rr = 0; rr < 3; rr++) b.recipe.grid[rr * 3 + (sel % 3)] = v;
    }
    state.dirty = true;
    renderInspector();
    return;
  }
  const pal = e.target.closest('[data-pal]');
  if (pal) {
    const b = current();
    if (!b) return;
    b.recipe = b.recipe || {};
    ensureGrid(b.recipe);
    b.recipe.grid[Math.min(8, Math.max(0, state.gridSel || 0))] = pal.dataset.pal;
    state.dirty = true;
    renderInspector();
    return;
  }
  const palFav = e.target.closest('[data-palfav]');
  if (palFav) {
    const b = current();
    if (!b) return;
    const grid = Array.isArray(b.recipe && b.recipe.grid) ? b.recipe.grid : null;
    const v = grid ? grid[Math.min(8, Math.max(0, state.gridSel || 0))] : '';
    if (!v || ['blade', 'material', 'core'].includes(v)) {
      toast('当前格是空/刀/主材料/核心材料，只有自定义物品才能收藏');
      return;
    }
    state.project.materialPalette = state.project.materialPalette || [];
    if (state.project.materialPalette.some(([id]) => id === v)) {
      toast('这个物品已经在面板里了');
      return;
    }
    state.project.materialPalette.push([v, String(v.split(':').pop()).slice(0, 10)]);
    state.dirty = true;
    renderInspector();
    toast('已收藏：' + v);
    return;
  }
  const palDel = e.target.closest('[data-paldel]');
  if (palDel) {
    state.project.materialPalette = (state.project.materialPalette || []).filter(
      (_, i) => i !== Number(palDel.dataset.paldel)
    );
    state.dirty = true;
    renderInspector();
    return;
  }
  const setBtn = e.target.closest('[data-setcell]');
  if (setBtn) {
    const b = current();
    if (!b) return;
    b.recipe = b.recipe || {};
    ensureGrid(b.recipe);
    const v = setBtn.dataset.setcell;
    if (v === 'reset') b.recipe.grid = presetGrid(b.recipe.type);
    else b.recipe.grid[state.gridSel] = v;
    state.dirty = true;
    renderInspector();
  }
});

tabBody.addEventListener('change', (e) => {
  if (e.target.dataset && e.target.dataset.updAuto !== undefined) {
    state.upd.autoCheck = e.target.checked;
    window.api.updateSave({ source: state.upd.source, autoCheck: e.target.checked });
    return;
  }
  const inp = e.target.closest('[data-cellitem]');
  if (!inp) return;
  const b = current();
  if (!b) return;
  b.recipe = b.recipe || {};
  ensureGrid(b.recipe);
  const v = String(inp.value || '').trim().toLowerCase();
  b.recipe.grid[state.gridSel] = v;
  state.dirty = true;
  renderInspector();
});

tabBody.addEventListener('input', (e) => {
  if (e.target.dataset && e.target.dataset.saCustom !== undefined) {
    const b0 = current();
    if (!b0) return;
    b0.slashArt = e.target.value.trim();
    state.dirty = true;
    return;
  }
  if (e.target.dataset && e.target.dataset.tune) {
    const b = current();
    if (!b) return;
    const key = e.target.dataset.tune;
    b.tune = Object.assign({}, TUNE_DEFAULT, b.tune || {}, { [key]: Number(e.target.value) });
    const label = document.getElementById('tune-' + key);
    if (label) label.textContent = key === 'sori' ? Number(e.target.value).toFixed(2) : Number(e.target.value).toFixed(2) + '×';
    retune(b);
    state.dirty = true;
    schedulePreview();
    return;
  }
  onEdit(e.target);
});
tabBody.addEventListener('change', (e) => {
  const saSel = e.target.closest('[data-sa]');
  if (saSel) {
    const b0 = current();
    if (!b0) return;
    const row = document.getElementById('saCustomRow');
    if (saSel.value === 'custom') {
      if (row) row.hidden = false;
      const inp = row && row.querySelector('[data-sa-custom]');
      if (inp) inp.focus();
      return;
    }
    b0.slashArt = saSel.value;
    if (row) row.hidden = true;
    state.dirty = true;
    updateStageMeta();
    return;
  }
  onEdit(e.target);
});

tabBody.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act], [data-type], [data-tex], [data-ench-add], [data-ench-del], [data-ench-quick], [data-ench-set], [data-effect], [data-arts], button');
  if (!t) return;
  const b = current();
  if (!b) return;

  if (t.dataset.act === 'tune-reset') {
    b.tune = Object.assign({}, TUNE_DEFAULT);
    retune(b);
    state.dirty = true;
    refreshPreview();
    renderInspector();
    toast('已恢复原始刀模');
    return;
  }
  if (t.dataset.act === 'save-obj') {
    const path = await window.api.saveObj((b.id || 'blade') + '.obj', b.modelData || '');
    if (path) toast('模型已导出');
    return;
  }
  if (t.dataset.act === 'save-png') {
    const path = await window.api.savePng((b.id || 'blade') + '.png', b.textureData || '');
    if (path) toast('贴图已导出');
    return;
  }
  if (t.dataset.act === 'import-model') {
    const res = await window.api.importModel();
    if (!res) return;
    b.modelBase = 'custom';
    b.modelBaseData = res.data;
    b.tune = Object.assign({}, TUNE_DEFAULT);
    b.modelData = res.data;
    b.modelName = res.name;
    state.dirty = true;
    refreshPreview();
    renderInspector();
    toast(`已导入模型 ${res.name}`);
    return;
  }
  if (t.dataset.act === 'builtin-model') {
    b.modelBase = 'katana';
    b.modelBaseData = builtinModel('katana');
    b.tune = Object.assign({}, TUNE_DEFAULT);
    b.modelData = builtinModel('katana');
    b.modelName = 'katana.obj（内置）';
    state.dirty = true;
    refreshPreview();
    renderInspector();
    toast('已切回内置刀模');
    return;
  }
  if (t.dataset.act === 'import-tex') {
    const res = await window.api.importTexture();
    if (!res) return;
    b.textureData = res.data;
    b.textureName = res.name;
    state.dirty = true;
    refreshPreview();
    renderInspector();
    toast(`已导入贴图 ${res.name}`);
    return;
  }
  if (t.dataset.enchAdd !== undefined) {
    b.enchants = b.enchants || [];
    b.enchants.push({ id: '', lvl: 1 });
    state.dirty = true;
    renderInspector();
    return;
  }
  if (t.dataset.enchDel !== undefined) {
    b.enchants.splice(Number(t.dataset.enchDel), 1);
    state.dirty = true;
    renderInspector();
    return;
  }
  if (t.dataset.enchSet) {
    const set = ENCH_SETS.find(([k]) => k === t.dataset.enchSet);
    if (!set) return;
    b.enchants = b.enchants || [];
    for (const [id, lvl] of set[2]) {
      const hit = b.enchants.find((e) => e.id === id);
      if (hit) hit.lvl = Math.max(hit.lvl, lvl);
      else b.enchants.push({ id, lvl });
    }
    state.dirty = true;
    renderInspector();
    toast('已套用「' + set[1] + '」：' + set[2].length + ' 项附魔');
    return;
  }
  if (t.dataset.enchQuick) {
    const id = t.dataset.enchQuick;
    b.enchants = b.enchants || [];
    const exist = b.enchants.find((x) => x.id === id);
    if (exist) exist.lvl = Math.min(255, Number(exist.lvl || 1) + 1);
    else b.enchants.push({ id, lvl: 1 });
    state.dirty = true;
    renderInspector();
    return;
  }
  if (t.dataset.arts) {
    const p = ARTS_PRESETS.find((x) => x.key === t.dataset.arts);
    if (!p) return;
    b.slashArt = p.sa;
    b.summonColor = p.color;
    b.types = (p.types || []).slice();
    b.enchants = (p.ench || []).map(([id, lvl]) => ({ id, lvl }));
    if (p.effects) b.effects = p.effects.slice();
    state.dirty = true;
    renderInspector();
    updateStageMeta();
    toast('已套用「' + p.name + '」：' + p.note);
    return;
  }
  if (t.dataset.effect) {
    b.effects = b.effects || [];
    if (!b.effects.includes(t.dataset.effect)) b.effects.push(t.dataset.effect);
    state.dirty = true;
    renderInspector();
    return;
  }
  if (t.dataset.type) {
    const v = t.dataset.type;
    b.types = b.types.includes(v) ? b.types.filter((x) => x !== v) : [...b.types, v];
    state.dirty = true;
    t.classList.toggle('on');
    updateStageMeta();
    return;
  }
  if (t.dataset.model) {
    b.modelBase = t.dataset.model;
    b.modelBaseData = builtinModel(t.dataset.model);
    b.tune = Object.assign({}, TUNE_DEFAULT);
    b.modelData = b.modelBaseData;
    b.modelName = t.dataset.model + '.obj';
    state.dirty = true;
    refreshPreview();
    renderInspector();
    return;
  }
  if (t.dataset.tex) {
    const preset = TEX_PRESETS.find((x) => x[0] === t.dataset.tex);
    b.textureData = state.builtin.textures[t.dataset.tex];
    b.textureName = (preset ? preset[2] : `katana_${t.dataset.tex}.png`) + '（内置）';
    state.dirty = true;
    refreshPreview();
    renderInspector();
    return;
  }
});

document.querySelectorAll('#tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    renderInspector();
  });
});

$('modeGroup').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  state.mode = btn.dataset.mode;
  document.querySelectorAll('#modeGroup .chip').forEach((c) => c.classList.toggle('active', c === btn));
  state.preview.setMode(state.mode);
  syncPosePanel();
});

$('btnSpin').addEventListener('click', (e) => {
  const on = !e.target.classList.contains('active');
  e.target.classList.toggle('active', on);
  state.preview.setSpin(on);
});

$('posePanel').addEventListener('input', (e) => {
  const key = e.target.dataset.pose;
  if (!key) return;
  const b = current();
  if (!b) return;
  const p = effPose(b);
  p[key] = Number(e.target.value);
  b.pose = p;
  state.dirty = true;
  $('poseNums').textContent = `x ${p.x} y ${p.y} z ${p.z} / ${p.rx} ${p.ry} ${p.rz}`;
  if ($('poseLen')) $('poseLen').textContent = `长度 ${(Number(p.scale) || 1).toFixed(2)}×（原版为 1.00×）`;
  state.preview.setMode('back');
});

$('posePanel').addEventListener('click', (e) => {
  if (e.target.id !== 'poseReset') return;
  const b = current();
  if (!b) return;
  delete b.pose;
  state.dirty = true;
  syncPosePanel();
  state.preview.setMode('back');
});

$('btnResetCam').addEventListener('click', () => state.preview.resetCamera());

$('btnNewBlade').addEventListener('click', () => {
  const b = makeBlade();
  state.project.blades.push(b);
  state.dirty = true;
  selectBlade(b.id);
  toast('新建了一把刀');
});

$('btnDup').addEventListener('click', () => {
  const b = current();
  if (!b) return;
  const copy = JSON.parse(JSON.stringify(b));
  copy.id = uid();
  copy.zh = (b.zh || b.id) + ' 改';
  copy.en = (b.en || b.id) + ' Copy';
  state.project.blades.push(copy);
  state.dirty = true;
  selectBlade(copy.id);
});

$('btnDel').addEventListener('click', () => {
  const b = current();
  if (!b) return;
  if (!confirm(`删除「${b.zh || b.id}」？`)) return;
  state.project.blades = state.project.blades.filter((x) => x.id !== b.id);
  state.dirty = true;
  selectBlade(state.project.blades[0]?.id || null);
});

$('btnSave').addEventListener('click', saveProject);
$('btnOpen').addEventListener('click', openProject);
$('btnImportProj').addEventListener('click', openProject);
$('btnExport').addEventListener('click', exportJar);
if ($('btnCheck')) $('btnCheck').addEventListener('click', () => openCheck(false));
if ($('btnSplit')) $('btnSplit').addEventListener('click', exportSplit);
$('btnExportPacks').addEventListener('click', exportPacks);

document.addEventListener('click', (e) => {
  if (e.target.id === 'btnExport2') exportJar();
  if (e.target.id === 'btnCatalog') exportCatalog();
  if (e.target.id === 'btnSave2') saveProject();
  if (e.target.id === 'btnExportPacks2') exportPacks();
});

$('projName').addEventListener('input', (e) => { state.project.pack.name = e.target.value; state.dirty = true; });
$('projNs').addEventListener('input', (e) => {
  state.project.namespace = e.target.value.trim();
  state.dirty = true;
  renderList();
  updateStageMeta();
});
$('projVer').addEventListener('input', (e) => { state.project.pack.version = e.target.value; state.dirty = true; });

/* ---------------- 项目管理 ---------------- */

function applyProject(project) {
  state.project = project;
  if (!state.project.pack) state.project.pack = { name: project.namespace, version: '1.0.0', authors: '', description: '' };
  $('projName').value = state.project.pack.name || '';
  $('projNs').value = state.project.namespace;
  $('projVer').value = state.project.pack.version || '1.0.0';
  state.selectedId = state.project.blades[0]?.id || null;
  renderList();
  renderInspector();
  refreshPreview();
}

async function openProject() {
  const res = await window.api.openProject();
  if (!res) return;
  try {
    applyProject(res.project);
    state.dirty = false;
    toast(`已打开 ${res.path}`);
  } catch (err) {
    toast('工程读取失败：' + err.message, true);
  }
}

async function saveProject() {
  const path = await window.api.saveProject(serialize());
  if (!path) return;
  state.dirty = false;
  updateStageMeta();
  toast(`已保存到 ${path}`);
}

function serialize() {
  return JSON.parse(JSON.stringify(state.project));
}

/* ---------------- 工程体检 ---------------- */

async function projectCheck() {
  const project = serialize();
  const rows = [];
  const nsRe = /^[a-z][a-z0-9_]{1,20}$/;
  if (!(project.blades || []).length) rows.push({ lv: 'bad', tag: '刀库', text: '一把刀都没有，出包会是空包' });
  if (!nsRe.test(project.namespace || '')) rows.push({ lv: 'bad', tag: '命名空间', text: '必须是小写字母开头、2-21 位的 [a-z0-9_]' });
  for (const b of (project.blades || [])) {
    for (const [lv, tag, text] of validate(b, project)) {
      rows.push({ bladeId: b.id, name: b.zh || b.en || b.id, lv, tag, text });
    }
  }
  // 官方 codec 审计：键名拼错、枚举越界、资源 ID 不合规（跑在主进程里，用导出器真实的定义生成逻辑）
  if (window.api && window.api.auditProject) {
    try {
      const res = await window.api.auditProject(project);
      if (res && res.ok) for (const r of res.rows) rows.push(r);
      else if (res && res.error) rows.push({ lv: 'bad', tag: 'codec 审计', text: '审计执行失败：' + res.error });
    } catch (err) {
      rows.push({ lv: 'warn', tag: 'codec 审计', text: '审计没跑起来：' + err.message });
    }
  }
  const seen = new Set();
  const uniq = rows.filter((r) => {
    const k = `${r.bladeId || ''}|${r.tag}|${r.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    rows: uniq,
    bad: uniq.filter((r) => r.lv === 'bad').length,
    warn: uniq.filter((r) => r.lv === 'warn').length,
    blades: (project.blades || []).length,
  };
}

async function openCheck(auto) {
  const ck = await projectCheck();
  const old = document.getElementById('checkOverlay');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'checkOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,9,13,.72);z-index:900;display:flex;align-items:center;justify-content:center';
  const list = ck.rows.length
    ? ck.rows.map((r, i) => {
        const color = r.lv === 'bad' ? '#ff6b6b' : '#ffcc66';
        const label = r.lv === 'bad' ? '错误' : '提示';
        return `<div data-row="${i}" style="display:flex;gap:10px;padding:9px 14px;border-bottom:1px solid #1e2836;align-items:flex-start;cursor:${r.bladeId ? 'pointer' : 'default'}">
          <span style="flex:0 0 40px;color:${color};border:1px solid ${color};border-radius:4px;font-size:12px;text-align:center;line-height:18px">${label}</span>
          <div style="flex:1;font-size:13px;line-height:19px"><b style="color:#e2ebf5">${esc(r.name || '工程')}</b>
          <span style="color:#7d8fa6"> · ${esc(r.tag)} · </span><span style="color:#aebfd2">${esc(r.text)}</span></div></div>`;
      }).join('')
    : '<div style="padding:22px 18px;color:#7ce38b;font-size:14px">全部通过，可以直接出包</div>';
  ov.innerHTML = `<div style="width:min(760px,92vw);max-height:78vh;display:flex;flex-direction:column;background:#111821;border:1px solid #26313f;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden">
    <div style="padding:15px 18px;border-bottom:1px solid #1e2836;display:flex;align-items:center;gap:12px">
      <b style="font-size:16px;color:#eaf2fa">工程体检</b>
      <span style="color:#7d8fa6;font-size:13px">${ck.blades} 把刀 · <span style="color:#ff6b6b">${ck.bad} 错误</span> · <span style="color:#ffcc66">${ck.warn} 提示</span> · 含官方 codec 键名/枚举校验</span>
    </div>
    <div style="overflow:auto;flex:1">${list}</div>
    <div style="padding:12px 18px;border-top:1px solid #1e2836;display:flex;justify-content:flex-end;gap:10px">
      ${auto && ck.bad > 0 ? '<button id="checkForce" style="padding:7px 14px;border-radius:8px;border:1px solid #33455c;background:#18212c;color:#c8d6e6;cursor:pointer">仍然出包</button>' : ''}
      <button id="checkClose" style="padding:7px 18px;border-radius:8px;border:0;background:#2b6cb0;color:#fff;cursor:pointer">知道了</button>
    </div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (ev) => {
    if (ev.target === ov || ev.target.id === 'checkClose') { ov.remove(); return; }
    if (ev.target.id === 'checkForce') { ov.remove(); doExportJar(); return; }
    const row = ev.target.closest('[data-row]');
    if (!row) return;
    const r = ck.rows[Number(row.dataset.row)];
    if (r && r.bladeId) {
      ov.remove();
      selectBlade(r.bladeId);
      state.tab = 'check';
      renderInspector();
      setStatus('已定位到「' + (r.name || r.bladeId) + '」');
    }
  });
}

/* ---------------- 导出 ---------------- */

async function exportJar() {
  const ck = await projectCheck();
  if (ck.bad > 0) { openCheck(true); return; }
  doExportJar();
}

async function doExportJar() {
  const project = serialize();
  const res = await window.api.exportJar(project);
  if (!res) return;
  const size = (res.size / 1024).toFixed(0);
  const self = res.selfChecks || [];
  const bad = self.filter((r) => r.lv === 'bad').length;
  if (bad) {
    toast(`出包写完了，但自检发现 ${bad} 条问题（${size} KB）：${res.path}`, true);
    setStatus(`自检 ${bad} 条问题，建议先修再进 mods`);
  } else {
    toast(`导出成功（${size} KB）· 自检 ${self.length ? self.length + ' 提示' : '通过'}：${res.path}`);
    setStatus('jar 已导出并自检通过，可直接放进 mods');
  }
  if (self.length) console.warn('[selfCheck]', self);
  if (res.warnings && res.warnings.length) console.warn(res.warnings);
}

async function exportSplit() {
  if (!window.api || !window.api.exportSplit) { toast('当前环境不能写文件', true); return; }
  const ck = await projectCheck();
  if (ck.bad > 0) { openCheck(false); toast('有错误，先修掉再分刀出包', true); return; }
  const res = await window.api.exportSplit(serialize());
  if (!res) return;
  const bad = (res.selfChecks || []).filter((r) => r.lv === 'bad').length;
  toast(`分刀出包完成：${res.files.length} 个 jar → ${res.dir}` + (bad ? `（自检 ${bad} 条问题）` : ''), bad > 0);
  setStatus(`分刀出包：${res.files.length} 成功 / ${res.failed.length} 失败` + (bad ? ` / 自检 ${bad} 条问题` : ''));
  if (res.failed.length) console.warn('分刀出包失败', res.failed);
}

async function exportPacks() {
  const res = await window.api.exportPacks(serialize());
  if (!res) return;
  toast(`资源包/数据包已导出到 ${res.dir}`);
}

/* ---------------- 启动 ---------------- */

async function boot() {
  window.addEventListener('error', (e) => console.error('[error]', e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => console.error('[rejection]', e.reason && (e.reason.stack || e.reason)));
  try {
    await start();
  } catch (err) {
    console.error('[boot failed]', err && (err.stack || err));
    setStatus('启动失败：' + (err && err.message ? err.message : err));
    toast('启动失败：' + (err && err.message ? err.message : err), true);
  }
}

async function start() {
  state.builtin = await window.api.builtinAssets();
  try {
    state.preview = createPreview($('view'));
  } catch (err) {
    console.error('[webgl]', err);
    setStatus('3D 预览不可用（缺少 OpenGL / 显卡驱动），其它功能正常');
  }
  const project = demoProject();
  applyProject(project);
  state.dirty = false;
  window.__previewDiag = () => (state.preview ? state.preview.diag() : 'no preview');
  window.__previewShot = () => (state.preview ? state.preview.snapshot() : null);
  window.__serialize = serialize;
  window.__loadProject = applyProject;
  window.__catalogHtml = () => buildCatalogHtml(state.project);
  window.__exportCatalog = exportCatalog;
  window.__exportJar = exportJar;
  const info = await window.api.info();
  setStatus(`樱刃工坊 v${info.version} · 目标 Minecraft 1.20.1 / Forge 47 · 需要 SlashBlade: Resharped`);

  window.api.onMenu('menu:open', openProject);
  window.api.onMenu('menu:save', saveProject);
  window.api.onMenu('menu:export', exportJar);
  window.api.onMenu('menu:newBlade', () => $('btnNewBlade').click());
  window.api.onMenu('menu:dupBlade', () => $('btnDup').click());
  initUpdate();
}

boot();
