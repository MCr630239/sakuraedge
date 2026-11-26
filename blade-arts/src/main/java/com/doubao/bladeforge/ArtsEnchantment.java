package com.doubao.bladeforge;

import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.EnchantmentCategory;

/** Blade Forge 追加的附魔，全部作用于主手武器。 */
public class ArtsEnchantment extends Enchantment {
    private final int maxLevel;

    public ArtsEnchantment(Rarity rarity, int maxLevel) {
        super(rarity, EnchantmentCategory.WEAPON, new EquipmentSlot[]{EquipmentSlot.MAINHAND});
        this.maxLevel = maxLevel;
    }

    @Override
    public int getMaxLevel() {
        return maxLevel;
    }

    @Override
    public int getMinCost(int level) {
        return 12 + level * 9;
    }

    @Override
    public int getMaxCost(int level) {
        return getMinCost(level) + 28;
    }

    /** 允许附到任何有耐久的武器上（拔刀剑不是原版 SwordItem）。 */
    @Override
    public boolean canApplyAtEnchantingTable(ItemStack stack) {
        return stack.isDamageableItem() || super.canApplyAtEnchantingTable(stack);
    }

    @Override
    public boolean isAllowedOnBooks() {
        return true;
    }

    @Override
    public boolean isTreasureOnly() {
        return false;
    }
}
