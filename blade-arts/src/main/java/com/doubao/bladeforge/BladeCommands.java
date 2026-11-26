package com.doubao.bladeforge;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.Tag;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.registries.ForgeRegistries;

/**
 * /bladeforge —— 一条命令改完一把刀，不用记一堆 NBT 路径。
 *
 *   soul  <杀敌数> <荣耀值> <锻造数>   写三项核心数值
 *   color <RRGGBB> [inverse]        改刀光颜色（拔刀剑本体按这个颜色渲染剑气）
 *   art   <看到SA名>                 换这把刀的拔刀术
 *   se    <add|remove> <id>          给刀加/去一个特殊效果
 *   ench  <id> [等级]                直接附魔
 *   info                             打印这把刀的全部状态
 *   nbt                              打印里面的数字字段（排查用）
 *
 * 全部优先走 Forge Capability 反射，不把 SlashBlade 变成硬依赖。
 */
public final class BladeCommands {

    private BladeCommands() {
    }

    private static final String[][] SA_ALIAS = {
            {"void_slash", "次元斩"}, {"circle_slash", "圆舞斩"}, {"drive_vertical", "幻影刃-纵"},
            {"drive_horizontal", "幻影刃"}, {"judgement_cut", "终焉樱"}, {"piercing", "平突"},
            {"sakura_end", "樱之终"}, {"wave_edge", "波刀龙胆"},
    };

    /** 常见 SE / 附魔简名，省得记完整 ID。 */
    private static final String[][] ID_ALIAS = {
            {"wither_edge", "slashblade:wither_edge"},
            {"凋零性", "slashblade:wither_edge"},
            {"frost_aspect", "bladeforge_arts:frost_aspect"},
            {"霜寒", "bladeforge_arts:frost_aspect"},
            {"venom_aspect", "bladeforge_arts:venom_aspect"},
            {"剧毒", "bladeforge_arts:venom_aspect"},
            {"soul_harvest", "bladeforge_arts:soul_harvest"},
            {"收魂", "bladeforge_arts:soul_harvest"},
            {"fierce_edge", "bladeforge_arts:fierce_edge"},
            {"凶刃", "bladeforge_arts:fierce_edge"},
            {"proud_burst", "bladeforge_arts:proud_burst"},
            {"耀魂爆发", "bladeforge_arts:proud_burst"},
    };

    @SubscribeEvent
    public static void onRegister(RegisterCommandsEvent event) {
        CommandDispatcher<CommandSourceStack> d = event.getDispatcher();

        // soul <kill> <proud> <refine>
        var refineNode = Commands.argument("refine", IntegerArgumentType.integer(0, 9999))
                .executes(BladeCommands::soul);
        var proudNode = Commands.argument("proud", IntegerArgumentType.integer(0, 99999999)).then(refineNode);
        var killNode = Commands.argument("kill", IntegerArgumentType.integer(0, 9999999)).then(proudNode);
        var soulNode = Commands.literal("soul").then(killNode);

        // color <hex> [inverse]
        var inverseNode = Commands.argument("inverse", StringArgumentType.word())
                .executes(BladeCommands::colorInverse);
        var hexNode = Commands.argument("hex", StringArgumentType.word())
                .executes(BladeCommands::color).then(inverseNode);
        var colorNode = Commands.literal("color").then(hexNode);

        // art <SA 名或 ID>
        var artArg = Commands.argument("sa", StringArgumentType.greedyString()).executes(BladeCommands::art);
        var artNode = Commands.literal("art").then(artArg);

        // se <add|remove|play|stop|clear> <id>
        var seAddArg = Commands.argument("id", StringArgumentType.greedyString()).executes(ctx -> se(ctx, true));
        var seRemoveArg = Commands.argument("id", StringArgumentType.greedyString()).executes(ctx -> se(ctx, false));
        var seNode = Commands.literal("se")
                .then(Commands.literal("add").then(seAddArg))
                .then(Commands.literal("play").then(seAddArg))
                .then(Commands.literal("remove").then(seRemoveArg))
                .then(Commands.literal("stop").then(seRemoveArg))
                .then(Commands.literal("clear").executes(BladeCommands::seClear));

        // ench <附魔[:等级]>  —— 用 greedy 是因为 word 吃不下中文附魔名
        var enchArg = Commands.argument("spec", StringArgumentType.greedyString()).executes(BladeCommands::ench);
        var enchNode = Commands.literal("ench").then(enchArg);

        var infoNode = Commands.literal("info").executes(BladeCommands::info);
        var nbtNode = Commands.literal("nbt").executes(BladeCommands::dump);

        d.register(Commands.literal("bladeforge")
                .requires(src -> src.hasPermission(2))
                .then(soulNode)
                .then(colorNode)
                .then(artNode)
                .then(seNode)
                .then(enchNode)
                .then(infoNode)
                .then(nbtNode));
    }

    // ---------- soul ----------

    private static int soul(CommandContext<CommandSourceStack> ctx) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        int kill = IntegerArgumentType.getInteger(ctx, "kill");
        int proud = IntegerArgumentType.getInteger(ctx, "proud");
        int refine = IntegerArgumentType.getInteger(ctx, "refine");

        Object st = BladeStateBridge.state(stack);
        boolean cap = st != null;
        boolean okK = false, okP = false, okR = false;
        if (cap) {
            BladeStateBridge.setKill(st, kill);
            BladeStateBridge.setProud(st, proud);
            BladeStateBridge.setRefine(st, refine);
            okK = BladeStateBridge.kill(st) == kill;
            okP = BladeStateBridge.proud(st) == proud;
            okR = BladeStateBridge.refine(st) == refine;
        } else {
            CompoundTag tag = stack.getOrCreateTag();
            okK = setKey(tag, "killcount", kill);
            okP = setKey(tag, "proudsoul", proud);
            okR = setKey(tag, "repaircounter", refine) || setKey(tag, "refine", refine);
        }
        if (!okK && !okP && !okR) {
            fail(ctx, "这把刀既没有拔刀剑能力也没有对应 NBT 字段，/bladeforge nbt 看看它存了什么");
            return 0;
        }
        refresh(ctx);
        String msg = "已写入主手刀" + (cap ? "（能力数据）" : "（物品 NBT）")
                + "：杀敌数 " + (okK ? kill : "失败") + "  荣耀值 " + (okP ? proud : "失败")
                + "  锻造数 " + (okR ? refine : "失败");
        ctx.getSource().sendSuccess(() -> Component.literal(msg), true);
        return Command.SINGLE_SUCCESS;
    }

    // ---------- color ----------

    private static int color(CommandContext<CommandSourceStack> ctx) {
        return applyColor(ctx, false);
    }

    private static int colorInverse(CommandContext<CommandSourceStack> ctx) {
        String flag = StringArgumentType.getString(ctx, "inverse");
        return applyColor(ctx, flag.equalsIgnoreCase("inverse") || flag.equalsIgnoreCase("反转"));
    }

    private static int applyColor(CommandContext<CommandSourceStack> ctx, boolean inverse) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        Object st = BladeStateBridge.state(stack);
        if (st == null) {
            fail(ctx, "这把不是拔刀剑（没有刀状态），改不了刀光颜色");
            return 0;
        }
        String raw = StringArgumentType.getString(ctx, "hex").replace("#", "").replace("0x", "");
        int rgb;
        try {
            rgb = Integer.parseInt(raw, 16);
        } catch (NumberFormatException e) {
            fail(ctx, "颜色要写成十六进制，比如 ff3399 或 #FF3399");
            return 0;
        }
        boolean ok = BladeStateBridge.call(st, "setColorCode", new Class<?>[]{int.class}, rgb);
        if (inverse) BladeStateBridge.call(st, "setEffectColorInverse", new Class<?>[]{boolean.class}, true);
        if (!ok) {
            fail(ctx, "这个版本的刀状态没有 setColorCode");
            return 0;
        }
        refresh(ctx);
        String hex = String.format(Locale.ROOT, "#%06X", rgb);
        String msg = "刀光颜色已设为 " + hex + (inverse ? "（反转）" : "");
        ctx.getSource().sendSuccess(() -> Component.literal(msg), true);
        return Command.SINGLE_SUCCESS;
    }

    // ---------- art ----------

    private static int art(CommandContext<CommandSourceStack> ctx) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        Object st = BladeStateBridge.state(stack);
        if (st == null) {
            fail(ctx, "这把不是拔刀剑，改不了拔刀术");
            return 0;
        }
        String arg = StringArgumentType.getString(ctx, "sa").trim();
        String id = resolveSa(arg);
        if (id == null) {
            fail(ctx, "没认出这个拔刀术：" + arg + "。可用：" + String.join(" / ", saNames()));
            return 0;
        }
        boolean ok = BladeStateBridge.call(st, "setSlashArtsKey", new Class<?>[]{ResourceLocation.class},
                new ResourceLocation(id));
        if (!ok) {
            fail(ctx, "这个版本的刀状态没有 setSlashArtsKey");
            return 0;
        }
        refresh(ctx);
        String msg = "拔刀术已改为 " + artName(id) + "（" + id + "）";
        ctx.getSource().sendSuccess(() -> Component.literal(msg), true);
        return Command.SINGLE_SUCCESS;
    }

    private static String resolveSa(String arg) {
        String low = arg.toLowerCase(Locale.ROOT).replace("slashblade:", "");
        for (String[] pair : SA_ALIAS) {
            if (low.equals(pair[0]) || arg.equals(pair[1])) return "slashblade:" + pair[0];
        }
        if (low.contains(":")) return arg;   // 完整 ID 当成自定义奥义直接用
        return null;
    }

    private static String artName(String id) {
        String raw = id.replace("slashblade:", "");
        for (String[] pair : SA_ALIAS) {
            if (raw.equals(pair[0])) return pair[1];
        }
        return raw;
    }

    private static List<String> saNames() {
        List<String> out = new ArrayList<>();
        for (String[] pair : SA_ALIAS) out.add(pair[1] + "(" + pair[0] + ")");
        return out;
    }

    // ---------- se ----------

    private static int se(CommandContext<CommandSourceStack> ctx, boolean add) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        Object st = BladeStateBridge.state(stack);
        if (st == null) {
            fail(ctx, "这把不是拔刀剑，改不了特殊效果");
            return 0;
        }
        String id = resolveId(StringArgumentType.getString(ctx, "id"));
        boolean ok = BladeStateBridge.call(st, add ? "addSpecialEffect" : "removeSpecialEffect",
                new Class<?>[]{ResourceLocation.class}, new ResourceLocation(id));
        if (!ok) {
            fail(ctx, (add ? "添加" : "移除") + "失败，这个版本可能没有对应方法");
            return 0;
        }
        refresh(ctx);
        String msg = (add ? "已加上" : "已去掉") + "特殊效果 " + id;
        ctx.getSource().sendSuccess(() -> Component.literal(msg), true);
        return Command.SINGLE_SUCCESS;
    }

    private static int seClear(CommandContext<CommandSourceStack> ctx) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        Object st = BladeStateBridge.state(stack);
        if (st == null) {
            fail(ctx, "这把不是拔刀剑");
            return 0;
        }
        Object cur = BladeStateBridge.read(st, "getSpecialEffects");
        if (!(cur instanceof java.util.Collection<?> col) || col.isEmpty()) {
            ctx.getSource().sendSuccess(() -> Component.literal("这把刀本来就没有特殊效果"), false);
            return Command.SINGLE_SUCCESS;
        }
        List<ResourceLocation> copy = new ArrayList<>();
        for (Object o : col) if (o instanceof ResourceLocation rl) copy.add(rl);
        int n = 0;
        for (ResourceLocation rl : copy) {
            if (BladeStateBridge.call(st, "removeSpecialEffect", new Class<?>[]{ResourceLocation.class}, rl)) n++;
        }
        refresh(ctx);
        final int done = n;
        ctx.getSource().sendSuccess(() -> Component.literal("已清掉 " + done + " 个特殊效果"), true);
        return Command.SINGLE_SUCCESS;
    }

    private static String resolveId(String arg) {
        String raw = arg.trim();
        for (String[] pair : ID_ALIAS) {
            if (raw.equalsIgnoreCase(pair[0])) return pair[1];
        }
        if (raw.contains(":")) return raw;
        // 裸名：先试前置模组的，再试本体的
        String arts = "bladeforge_arts:" + raw;
        if (ForgeRegistries.ENCHANTMENTS.containsKey(new ResourceLocation(arts))) return arts;
        return "slashblade:" + raw;
    }

    // ---------- ench ----------

    private static int ench(CommandContext<CommandSourceStack> ctx) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        String spec = StringArgumentType.getString(ctx, "spec").trim();
        int lvl = 1;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.+?)[:\\s]+([0-9]+)$").matcher(spec);
        if (m.matches()) {
            spec = m.group(1);
            lvl = Math.max(1, Math.min(10, Integer.parseInt(m.group(2))));
        }
        String id = resolveId(spec);
        ResourceLocation rl = new ResourceLocation(id);
        Enchantment ench = ForgeRegistries.ENCHANTMENTS.getValue(rl);
        if (ench == null) {
            fail(ctx, "没这个附魔：" + id + "。可用简名：收魂 / 凶刃 / 耀魂爆发 / 霜寒 / 剧毒 / 凋零性，或用完整 ID");
            return 0;
        }
        stack.enchant(ench, lvl);
        refresh(ctx);
        final String shown = ench.getFullname(lvl).getString();
        ctx.getSource().sendSuccess(() -> Component.literal("已附上 " + shown + "（" + id + "）"), true);
        return Command.SINGLE_SUCCESS;
    }

    // ---------- info / dump ----------

    private static int info(CommandContext<CommandSourceStack> ctx) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        Object st = BladeStateBridge.state(stack);
        StringBuilder sb = new StringBuilder();
        sb.append(stack.getHoverName().getString()).append("  ");
        if (st == null) {
            sb.append("（没有拔刀剑能力）");
        } else {
            sb.append("杀敌数 ").append(BladeStateBridge.kill(st))
              .append(" / 荣耀值 ").append(BladeStateBridge.proud(st))
              .append(" / 锻造数 ").append(BladeStateBridge.refine(st));
            Object saKey = BladeStateBridge.read(st, "getSlashArtsKey");
            sb.append("\n拔刀术：").append(saKey == null ? "未知" : artName(saKey.toString()) + "（" + saKey + "）");
            Object color = BladeStateBridge.read(st, "getColorCode");
            if (color instanceof Integer c) {
                sb.append("\n刀光色：").append(String.format(Locale.ROOT, "#%06X", c.intValue() & 0xFFFFFF));
            }
            Object se = BladeStateBridge.read(st, "getSpecialEffects");
            if (se instanceof java.util.Collection<?> col) {
                sb.append("\n特殊效果：").append(col.isEmpty() ? "无" : joinList(col));
            }
        }
        List<String> enchList = new ArrayList<>();
        for (var entry : net.minecraft.world.item.enchantment.EnchantmentHelper.getEnchantments(stack).entrySet()) {
            enchList.add(entry.getKey().getFullname(entry.getValue()).getString());
        }
        sb.append("\n附魔：").append(enchList.isEmpty() ? "无" : String.join("，", enchList));
        final String msg = sb.toString();
        ctx.getSource().sendSuccess(() -> Component.literal(msg), false);
        return Command.SINGLE_SUCCESS;
    }

    private static String joinList(java.util.Collection<?> col) {
        List<String> out = new ArrayList<>();
        for (Object o : col) out.add(o instanceof ResourceLocation rl ? rl.toString() : String.valueOf(o));
        return String.join("，", out);
    }

    private static int dump(CommandContext<CommandSourceStack> ctx) {
        ItemStack stack = hand(ctx);
        if (stack == null) return 0;
        Object state = BladeStateBridge.state(stack);
        StringBuilder sb = new StringBuilder();
        if (state != null) {
            sb.append("拔刀剑能力：杀敌数 ").append(BladeStateBridge.kill(state))
              .append("，荣耀值 ").append(BladeStateBridge.proud(state))
              .append("，锻造数 ").append(BladeStateBridge.refine(state)).append("。");
        } else {
            sb.append("没有拔刀剑能力（这把不是刀？）。");
        }
        List<String> lines = new ArrayList<>();
        collect(stack.getOrCreateTag(), "", lines);
        sb.append(lines.isEmpty() ? "NBT 里没有数字字段" : "NBT 数字字段：" + String.join("，", lines));
        final String msg = sb.toString();
        ctx.getSource().sendSuccess(() -> Component.literal(msg), false);
        return Command.SINGLE_SUCCESS;
    }

    // ---------- helpers ----------

    private static ItemStack hand(CommandContext<CommandSourceStack> ctx) {
        if (!(ctx.getSource().getEntity() instanceof LivingEntity living)) {
            fail(ctx, "要对一个拿刀的实体执行（玩家直接输入命令即可）");
            return null;
        }
        ItemStack stack = living.getMainHandItem();
        if (stack.isEmpty()) {
            fail(ctx, "主手是空的，先拿一把刀");
            return null;
        }
        return stack;
    }

    private static void refresh(CommandContext<CommandSourceStack> ctx) {
        if (ctx.getSource().getEntity() instanceof net.minecraft.server.level.ServerPlayer sp) {
            sp.containerMenu.broadcastChanges();
            sp.inventoryMenu.broadcastChanges();
        }
    }

    private static void fail(CommandContext<CommandSourceStack> ctx, String text) {
        ctx.getSource().sendFailure(Component.literal(text));
    }

    private static boolean setKey(CompoundTag tag, String keyLower, int value) {
        for (String key : tag.getAllKeys()) {
            Tag t = tag.get(key);
            if (t == null) continue;
            if (t.getId() == Tag.TAG_INT && key.toLowerCase(Locale.ROOT).equals(keyLower)) {
                tag.putInt(key, value);
                return true;
            }
            if (t instanceof CompoundTag child && setKey(child, keyLower, value)) {
                return true;
            }
        }
        return false;
    }

    private static void collect(CompoundTag tag, String prefix, List<String> out) {
        for (String key : tag.getAllKeys()) {
            Tag t = tag.get(key);
            if (t == null) continue;
            if (t.getId() == Tag.TAG_INT && out.size() < 30) {
                out.add((prefix.isEmpty() ? "" : prefix + ".") + key + "=" + tag.getInt(key));
            } else if (t instanceof CompoundTag child) {
                collect(child, prefix.isEmpty() ? key : prefix + "." + key, out);
            }
        }
    }
}
