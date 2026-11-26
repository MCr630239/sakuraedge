package com.doubao.bladeforge;

import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

@Mod(BladeArtsMod.MODID)
public class BladeArtsMod {
    public static final String MODID = "bladeforge_arts";

    public static final DeferredRegister<Enchantment> ENCHANTMENTS =
            DeferredRegister.create(ForgeRegistries.ENCHANTMENTS, MODID);

    // 霜寒：命中减速
    public static final RegistryObject<Enchantment> FROST =
            ENCHANTMENTS.register("frost_aspect", () -> new ArtsEnchantment(Enchantment.Rarity.RARE, 4));
    // 剧毒：命中中毒
    public static final RegistryObject<Enchantment> VENOM =
            ENCHANTMENTS.register("venom_aspect", () -> new ArtsEnchantment(Enchantment.Rarity.RARE, 4));
    // 吸血：命中回血
    public static final RegistryObject<Enchantment> LIFESTEAL =
            ENCHANTMENTS.register("lifesteal", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 4));
    // 雷击：概率落雷
    public static final RegistryObject<Enchantment> THUNDER =
            ENCHANTMENTS.register("thunder_aspect", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 3));
    // 摄魂：击杀回血并修复耐久
    public static final RegistryObject<Enchantment> SOUL_DRAIN =
            ENCHANTMENTS.register("soul_drain", () -> new ArtsEnchantment(Enchantment.Rarity.RARE, 4));
    // 处刑：残血目标额外伤害
    public static final RegistryObject<Enchantment> EXECUTION =
            ENCHANTMENTS.register("execution", () -> new ArtsEnchantment(Enchantment.Rarity.RARE, 4));

    // 湮灭：附带无视护甲的魔法伤害
    public static final RegistryObject<Enchantment> ANNIHILATION =
            ENCHANTMENTS.register("annihilation", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 3));
    // 狂战：命中后获得力量，越战越强
    public static final RegistryObject<Enchantment> BERSERK =
            ENCHANTMENTS.register("berserk", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 3));

    // 凋零性：复刻原版 SE，概率施加凋零
    public static final RegistryObject<Enchantment> WITHER_ASPECT =
            ENCHANTMENTS.register("wither_aspect", () -> new ArtsEnchantment(Enchantment.Rarity.RARE, 3));
    // 兽性：复刻原版 SE，命中溅射爆炸
    public static final RegistryObject<Enchantment> BEAST =
            ENCHANTMENTS.register("beast_aspect", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 3));
    // 载器：复刻原版 SE，经验等级门槛增伤
    public static final RegistryObject<Enchantment> LIMITER =
            ENCHANTMENTS.register("limiter", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 3));

    // 收魂：击杀额外累积杀敌数与荣耀值
    public static final RegistryObject<Enchantment> SOUL_HARVEST =
            ENCHANTMENTS.register("soul_harvest", () -> new ArtsEnchantment(Enchantment.Rarity.RARE, 3));
    // 凶刃：杀敌数满 1000 后才生效的增伤
    public static final RegistryObject<Enchantment> FIERCE_EDGE =
            ENCHANTMENTS.register("fierce_edge", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 3));
    // 耀魂爆发：消耗荣耀值换取这一刀的额外伤害
    public static final RegistryObject<Enchantment> PROUD_BURST =
            ENCHANTMENTS.register("proud_burst", () -> new ArtsEnchantment(Enchantment.Rarity.VERY_RARE, 3));

    public BladeArtsMod() {
        IEventBus modBus = FMLJavaModLoadingContext.get().getModEventBus();
        ENCHANTMENTS.register(modBus);
        MinecraftForge.EVENT_BUS.register(ArtsEvents.class);
        MinecraftForge.EVENT_BUS.register(BladeCommands.class);
    }
}
