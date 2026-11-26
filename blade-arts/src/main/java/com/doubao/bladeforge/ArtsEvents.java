package com.doubao.bladeforge;

import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LightningBolt;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.EnchantmentHelper;
import net.minecraft.world.item.enchantment.Enchantments;
import net.minecraftforge.event.entity.living.LivingDeathEvent;
import net.minecraftforge.event.entity.living.LivingHurtEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.registries.RegistryObject;

/** 十一种附魔的实际效果。只挂事件，不依赖 SlashBlade，任何武器都能用。 */
public final class ArtsEvents {
    /** 防递归：湮灭 / 兽性的追加伤害会再触发一次 LivingHurtEvent。 */
    private static final ThreadLocal<Boolean> GUARD = new ThreadLocal<>();

    private ArtsEvents() {
    }

    private static int lvl(RegistryObject<Enchantment> ench, ItemStack stack) {
        if (stack.isEmpty()) return 0;
        return EnchantmentHelper.getItemEnchantmentLevel(ench.get(), stack);
    }

    @SubscribeEvent
    public static void onHurt(LivingHurtEvent event) {
        if (GUARD.get() != null) return;
        if (!(event.getSource().getEntity() instanceof LivingEntity attacker)) return;
        LivingEntity target = event.getEntity();
        ItemStack weapon = attacker.getMainHandItem();
        float amount = event.getAmount();

        // 霜寒：长时间减速，等级越高越慢（最高迟缓 IV）
        int frost = lvl(BladeArtsMod.FROST, weapon);
        if (frost > 0) {
            target.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN, 60 + frost * 35, Math.min(3, frost - 1)));
        }

        // 剧毒：中毒，II 级起再叠凋零
        int venom = lvl(BladeArtsMod.VENOM, weapon);
        if (venom > 0) {
            target.addEffect(new MobEffectInstance(MobEffects.POISON, 80 + venom * 40, Math.min(2, venom - 1)));
            if (venom >= 2) {
                target.addEffect(new MobEffectInstance(MobEffects.WITHER, 30 + venom * 20, 0));
            }
        }

        // 凋零性：复刻原版 SE「凋零性 20」，概率给凋零 II，持续时间随等级延长
        int wither = lvl(BladeArtsMod.WITHER_ASPECT, weapon);
        if (wither > 0 && attacker.getRandom().nextFloat() < Math.min(0.9F, 0.45F + 0.1F * wither)) {
            target.addEffect(new MobEffectInstance(MobEffects.WITHER, 100 + 25 * wither, Math.min(2, wither)));
        }

        // 吸血：25%×级回血，溢出转伤害吸收
        int steal = lvl(BladeArtsMod.LIFESTEAL, weapon);
        if (steal > 0) {
            float heal = amount * 0.25F * steal;
            float missing = attacker.getMaxHealth() - attacker.getHealth();
            if (missing > 0.5F) {
                attacker.heal(Math.min(heal, missing));
            }
            if (heal > missing) {
                attacker.addEffect(new MobEffectInstance(MobEffects.ABSORPTION, 200,
                        Math.min(3, Math.max(0, steal - 1)), false, false));
            }
        }

        // 雷击：18%×级概率落雷
        int thunder = lvl(BladeArtsMod.THUNDER, weapon);
        if (thunder > 0 && attacker.level() instanceof ServerLevel server
                && attacker.getRandom().nextFloat() < 0.18F * thunder) {
            LightningBolt bolt = EntityType.LIGHTNING_BOLT.create(server);
            if (bolt != null) {
                bolt.moveTo(target.position());
                if (attacker instanceof ServerPlayer player) bolt.setCause(player);
                server.addFreshEntity(bolt);
            }
        }

        // 载器：经验等级 ≥30 才算「启动」，不足时反而削弱这一刀
        int limiter = lvl(BladeArtsMod.LIMITER, weapon);
        if (limiter > 0 && attacker instanceof Player holder) {
            if (holder.experienceLevel >= 30) {
                amount *= 1.0F + 0.08F * limiter;
            } else {
                amount *= 0.8F;
            }
        }

        // 处刑：半血以下开始加伤，15% 以下直接翻倍
        int execution = lvl(BladeArtsMod.EXECUTION, weapon);
        if (execution > 0) {
            float ratio = target.getHealth() / target.getMaxHealth();
            if (ratio < 0.5F) {
                float mult = 1.0F + 0.28F * execution;
                if (ratio < 0.15F) mult *= 2.0F;
                amount *= mult;
            }
        }

        // 狂战：命中后获得力量，越战越强
        int berserk = lvl(BladeArtsMod.BERSERK, weapon);
        if (berserk > 0) {
            attacker.addEffect(new MobEffectInstance(MobEffects.DAMAGE_BOOST, 200, Math.min(2, berserk - 1), false, false));
        }

        // 凶刃：只有杀敌数满 1000（千杀）后才生效的增伤
        int fierce = lvl(BladeArtsMod.FIERCE_EDGE, weapon);
        if (fierce > 0) {
            Object state = BladeStateBridge.state(weapon);
            if (BladeStateBridge.kill(state) >= 1000) {
                amount *= 1.0F + 0.25F * fierce;
            }
        }

        // 耀魂爆发：荣耀值够 20 就烧掉一部分换伤害
        int burst = lvl(BladeArtsMod.PROUD_BURST, weapon);
        if (burst > 0) {
            Object state = BladeStateBridge.state(weapon);
            int proudNow = BladeStateBridge.proud(state);
            if (proudNow >= 20) {
                amount *= 1.0F + 0.12F * burst;
                BladeStateBridge.setProud(state, Math.max(0, proudNow - 5 * burst));
            }
        }

        // 湮灭：追加无视护甲的魔法伤害（加防递归）
        int annihilation = lvl(BladeArtsMod.ANNIHILATION, weapon);
        if (annihilation > 0) {
            GUARD.set(Boolean.TRUE);
            try {
                target.hurt(attacker.damageSources().magic(), amount * 0.15F * annihilation);
            } finally {
                GUARD.remove();
            }
        }

        // 兽性：命中原目标处引爆，溅射附近敌对生物；目标燃烧时必定触发
        int beast = lvl(BladeArtsMod.BEAST, weapon);
        if (beast > 0 && attacker.level() instanceof ServerLevel server) {
            boolean burning = target.isOnFire()
                    || EnchantmentHelper.getItemEnchantmentLevel(Enchantments.FIRE_ASPECT, weapon) > 0;
            if (burning || attacker.getRandom().nextFloat() < 0.4F + 0.1F * beast) {
                GUARD.set(Boolean.TRUE);
                try {
                    for (LivingEntity near : server.getEntitiesOfClass(LivingEntity.class,
                            target.getBoundingBox().inflate(3.0))) {
                        if (near == attacker || near.isAlliedTo(attacker) || !near.isAlive()) continue;
                        if (near != target && near.getType().getCategory() != MobCategory.MONSTER) continue;
                        near.hurt(attacker.damageSources().explosion(attacker, attacker), amount * 0.3F * beast);
                        near.push(0.0D, 0.35D, 0.0D);
                    }
                } finally {
                    GUARD.remove();
                }
                server.sendParticles(ParticleTypes.EXPLOSION_EMITTER,
                        target.getX(), target.getY(0.5D), target.getZ(), 1, 0.0D, 0.0D, 0.0D, 0.0D);
                server.playSound(null, target.getX(), target.getY(), target.getZ(),
                        SoundEvents.GENERIC_EXPLODE, SoundSource.PLAYERS, 1.0F, 1.2F);
            }
        }

        event.setAmount(amount);
    }

    @SubscribeEvent
    public static void onDeath(LivingDeathEvent event) {
        if (!(event.getSource().getEntity() instanceof LivingEntity attacker)) return;
        ItemStack weapon = attacker.getMainHandItem();

        // 摄魂：击杀回血、修耐久，并短暂获得力量与速度
        int soul = lvl(BladeArtsMod.SOUL_DRAIN, weapon);
        if (soul > 0) {
            float missing = attacker.getMaxHealth() - attacker.getHealth();
            if (missing > 0.5F) attacker.heal(Math.min(4.0F * soul, missing));
            if (weapon.isDamageableItem() && weapon.getDamageValue() > 0) {
                weapon.setDamageValue(Math.max(0, weapon.getDamageValue() - soul * 10));
            }
            attacker.addEffect(new MobEffectInstance(MobEffects.DAMAGE_BOOST, 120, Math.min(2, soul - 1), false, false));
            attacker.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SPEED, 120, 0, false, false));
        }

        // 收魂：击杀时在刀上额外累积杀敌数与荣耀值，冲刺千杀
        int harvest = lvl(BladeArtsMod.SOUL_HARVEST, weapon);
        if (harvest > 0) {
            Object state = BladeStateBridge.state(weapon);
            if (state != null) {
                BladeStateBridge.setKill(state, BladeStateBridge.kill(state) + 2 * harvest);
                BladeStateBridge.setProud(state, BladeStateBridge.proud(state) + 5 * harvest);
                if (attacker instanceof ServerPlayer sp) {
                    sp.containerMenu.broadcastChanges();
                }
            }
        }
    }
}
