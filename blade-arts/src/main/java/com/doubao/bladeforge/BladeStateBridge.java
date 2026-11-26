package com.doubao.bladeforge;

import net.minecraft.world.item.ItemStack;
import net.minecraftforge.common.capabilities.Capability;
import net.minecraftforge.common.util.LazyOptional;

/**
 * 反射桥：不把 SlashBlade: Resharped 变成硬依赖，也能读写刀的三项核心数值。
 * 1.20.1 的刀状态放在 Forge Capability（ISlashBladeState）里，真机确认不是物品 NBT。
 */
public final class BladeStateBridge {
    private static final String CAP_CLASS = "mods.flammpfeil.slashblade.capability.slashblade.CapabilitySlashBlade";
    private static Object cachedToken;
    private static boolean looked = false;

    private BladeStateBridge() {
    }

    private static Object token() {
        if (looked) return cachedToken;
        looked = true;
        try {
            cachedToken = Class.forName(CAP_CLASS).getField("BLADESTATE").get(null);
        } catch (Throwable ignored) {
            cachedToken = null;
        }
        return cachedToken;
    }

    /** 拿刀的 ISlashBladeState；不是拔刀剑或没装本体时返回 null。 */
    public static Object state(ItemStack stack) {
        Object t = token();
        if (t == null || stack.isEmpty()) return null;
        try {
            @SuppressWarnings("unchecked")
            LazyOptional<Object> opt = (LazyOptional<Object>) stack.getCapability((Capability<?>) t);
            return opt.orElse(null);
        } catch (Throwable ignored) {
            return null;
        }
    }

    public static int get(Object st, String getter, int def) {
        if (st == null) return def;
        try {
            return (Integer) st.getClass().getMethod(getter).invoke(st);
        } catch (Throwable ignored) {
            return def;
        }
    }

    public static boolean set(Object st, String setter, int value) {
        if (st == null) return false;
        try {
            st.getClass().getMethod(setter, int.class).invoke(st, value);
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    public static int kill(Object st) { return get(st, "getKillCount", 0); }
    public static int proud(Object st) { return get(st, "getProudSoulCount", 0); }
    public static int refine(Object st) { return get(st, "getRefine", 0); }

    /** 通用调用：方法名 + 参数类型 + 参数，失败返回 false。 */
    public static boolean call(Object st, String method, Class<?>[] types, Object... args) {
        if (st == null) return false;
        try {
            st.getClass().getMethod(method, types).invoke(st, args);
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /** 通用读：返回 Object（String / ResourceLocation / Collection 等），失败返回 null。 */
    public static Object read(Object st, String method) {
        if (st == null) return null;
        try {
            return st.getClass().getMethod(method).invoke(st);
        } catch (Throwable ignored) {
            return null;
        }
    }

    public static void setKill(Object st, int v) { set(st, "setKillCount", v); }
    public static void setProud(Object st, int v) { set(st, "setProudSoulCount", v); }
    public static void setRefine(Object st, int v) { set(st, "setRefine", v); }
}
