import { Context } from 'koishi'
import { weaponConfig, modConfig } from '../weapons'
import { Config } from '../index'

export async function calculateTotalDamage(
    ctx: Context,
    session: any,
    config: Config,
    equippedWeapon: any,
    targetBoss: any,
    careerData: any,
): Promise<{
    damage: number;
    baseDamage: number;
    hasCrit: boolean;
    effectMessage: string[];
}> {
    let effectMessage = [];
    const finalTags = targetBoss.tags || [];

    // 基础武器伤害
    const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId });
    const { regionId, realmId, profileId } = profile;
    const handle = `${regionId}-S2-${realmId}-${profileId}`;

    // 基础伤害计算
    const weaponConfigEntry = Object.entries(weaponConfig).find(([_, c]) => c.id === equippedWeapon.weaponId);
    const [weaponName, weaponData] = weaponConfigEntry;

    // 根据武器类型确定等级加成系数
    const isLegendary = weaponData.category === '传奇武器';
    const levelBonusRate = isLegendary ? 0.05 : 0.10;
    const baseDamage = weaponData.damage * (1 + levelBonusRate * equippedWeapon.level);
    effectMessage.push(`🔫 ${weaponName} Lv.${equippedWeapon.level}：基础伤害${baseDamage.toFixed(1)}`);

    // 标签加成计算 - 添加稳定DNA检查
    let tagMultiplier = 1;
    let tagAdditive = 0;

    if (targetBoss.skills && targetBoss.skills.includes('稳定DNA')) {
        // 稳定DNA技能生效时跳过标签计算
        effectMessage.push(`🧬 稳定DNA：目标免疫标签伤害加成`);
    } else {
        // 正常计算标签加成
        tagAdditive = await calculateTagMultiplier(weaponData, finalTags, equippedWeapon);
        tagMultiplier = 1 + tagAdditive;
        if (tagAdditive !== 0) {
            const sign = tagAdditive >= 0 ? '+' : '';
            effectMessage.push(`📌 标签加成：攻击伤害${sign}${Math.round(tagAdditive * 100)}%`);
        }
    }

    // 2. 模块加成（改为纯加法计算）
    const { totalModAdd, modMessages } = calculateModifiers(equippedWeapon, weaponName);
    effectMessage.push(...modMessages);

    // 3. 职业加成（加法）
    const careerAddResult = await calculateCareerAdditive(ctx, handle, weaponData.type, weaponData.id, careerData);
    if (careerAddResult.message) effectMessage.push(careerAddResult.message);

    // 4. 祈愿加成（加法）
    const wishAddResult = await calculateWishAdditive(ctx, handle, equippedWeapon);
    if (wishAddResult.message) effectMessage.push(wishAddResult.message);

    // 5. 额外伤害加成
    const extraDamageBonus = await calculateExtraDamageBonus(ctx, handle, weaponName, careerData);
    if (extraDamageBonus.value > 0) {
        effectMessage.push(extraDamageBonus.message);
    }

    // 最终伤害计算 - 按照要求的顺序：基础伤害*(模块加成+职业加成+祈愿加成)*标签加成*额外伤害加成
    let finalDamage = baseDamage * (1 + totalModAdd + careerAddResult.value + wishAddResult.value) * tagMultiplier * (1 + extraDamageBonus.value);

    // 暴击计算（单独函数处理）
    const { hasCrit, critSources } = await calculateCrit(ctx, handle, equippedWeapon, weaponName, careerData, weaponData.type);
    // 添加暴击率信息（无论是否暴击）
    effectMessage.push(...critSources);
    
    // 应用暴击伤害
    if (hasCrit) {
        finalDamage *= 2; // 暴击伤害翻倍
        effectMessage.push('💥 暴击！');
    }

    // 保底机制：最低1点伤害
    finalDamage = Math.max(finalDamage, 1);

    return {
        damage: finalDamage,
        baseDamage: baseDamage,
        hasCrit,
        effectMessage,
    };
}

// 重构暴击计算函数（添加暴击来源信息）
async function calculateCrit(
    ctx: Context,
    handle: string,
    equippedWeapon: any,
    weaponName: string,
    careerData: any, // 新增职业参数
    weaponType: string // 新增武器类型参数
): Promise<{
    hasCrit: boolean;
    critSources: string[];
}> {
    let critRate = 0;
    const pityCounter = equippedWeapon?.pityCounter || 0;
    const critSources = [];


    if (weaponName === 'M4AE脉冲步枪' || weaponName === '核聚变重炮') {
        return {
            hasCrit: false,
            critSources: []
        };
    }

    // 检查保底机制 - MK-4激光步枪
    if (weaponName === 'MK-4激光步枪' && pityCounter >= 3) {
        return {
            hasCrit: true,
            critSources: ['🔫 MK-4激光步枪：保底暴击']
        };
    }

    // 检查保底机制 - 棱镜超载核心模组
    if (
        equippedWeapon.installedMods?.includes('棱镜超载核心') &&
        modConfig['棱镜超载核心']?.exclusiveTo === weaponName &&
        pityCounter >= 4
    ) {
        return {
            hasCrit: true,
            critSources: ['⚙️ 【棱镜超载核心】：保底暴击']
        };
    }

    // 能量武器专家职业加成（新增部分）
    if (careerData?.career === '能量武器专家' && weaponType === '能量武器') {
        //critRate += 10;
        //critSources.push('⚔️ 能量武器专家职业：能量武器暴击率+10%');
    }

    // 模组提供的暴击率
    if (equippedWeapon.installedMods?.includes('棱镜水晶')) {
        //critRate += 10;
        //critSources.push('⚙️ 【棱镜水晶】：暴击率+10%');
    }

    if (equippedWeapon.installedMods?.includes('棱镜超载核心') &&
        modConfig['棱镜超载核心']?.exclusiveTo === weaponName) {
        critRate += 20;
        critSources.push('⚙️ 【棱镜超载核心】：暴击率+20%');
    }

    // 暴击韵律祈愿
    const [playerStats] = await ctx.database.get('ggcevo_player_stats', {
        handle
    });
    const now = new Date();
    const critRhythm = playerStats && playerStats.wishname === '暴击韵律' && 
                      playerStats.lastWishDate <= now && 
                      new Date(playerStats.lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000) >= now ? playerStats : null;

    if (critRhythm) {
        critRate += 20;
        critSources.push('🎵 暴击韵律祈愿：暴击率+20%');
    }

    // MK-4激光步枪专属暴击率
    if (weaponName === 'MK-4激光步枪') {
        critRate += 25;
        critSources.push('🔫 MK-4激光步枪：暴击率+25%');
    }



    return {
        hasCrit: Math.random() * 100 < critRate,
        critSources
    };
}

// 标签加成计算（纯加法）
async function calculateTagMultiplier(
    weaponData: any,
    tags: string[],
    equippedWeapon: any
) {
    // 模组效果配置
    const MOD_EFFECTS = [
        { mod: '助燃核心', tag: '惧热', value: 3.0 },
        { mod: '助燃核心', tag: '生物', value: 2.0 },
        { mod: '辐射充能核心', tag: '生物', value: 1.5 },
    ];

    let totalAdditive = 0;

    // 遍历标签计算加成（加法）
    for (const tag of tags) {
        // 优先检测模组效果
        const activeMod = MOD_EFFECTS.find(me =>
            me.tag === tag &&
            equippedWeapon.installedMods?.includes(me.mod)
        );

        // 获取加成值
        const effectValue = activeMod
            ? activeMod.value
            : weaponData.tagEffects?.[tag] ?? 1.0;

        // 累加（纯加法）
        totalAdditive += effectValue - 1;
    }

    return totalAdditive;
}

// 模块加成计算（纯加法）
function calculateModifiers(equippedWeapon: any, weaponName: string) {
    let totalModAdd = 0;
    const modMessages = [];

    // 动能增幅：纯加法
    if (equippedWeapon.installedMods?.includes('动能增幅')) {
        //totalModAdd += 0.15;
        //modMessages.push(`🛠️ 【动能增幅】：伤害+15%`);
    }

    // 裂甲核心：纯加法
    if (equippedWeapon.installedMods?.includes('裂甲核心') &&
        weaponName === modConfig['裂甲核心']?.exclusiveTo) {
        totalModAdd += 0.4;
        modMessages.push(`🛠️ 【裂甲核心】：伤害+40%`);
    }


    if (equippedWeapon.installedMods?.includes('轻型电源节点') &&
        weaponName === modConfig['轻型电源节点']?.exclusiveTo) {
        totalModAdd += 0.4;
        modMessages.push(`🛠️ 【轻型电源节点】：伤害+40%`);
    }

    // 微型聚变核心：纯加法
    if (equippedWeapon.installedMods?.includes('微型聚变核心')) {
        const currentCombo = equippedWeapon?.comboCount || 0;
        const maxStacks = 6;
        const bonusPerCombo = 0.1;
        const effectiveStacks = Math.min(currentCombo, maxStacks);
        const bonusDamage = effectiveStacks * bonusPerCombo;

        totalModAdd += bonusDamage;
        modMessages.push(`🛠️ 【微型聚变核心】：攻击伤害+${(bonusDamage * 100).toFixed(0)}%`);
    }

    // M134轮转机枪的横冲直撞机制
    if (weaponName === 'M134轮转机枪') {
        const baseBonusPerStack = 0.025; // 每层2.5%

        // 获取当前层数（没有上限）
        const currentStacks = equippedWeapon.comboCount || 0;

        // 检查是否安装了等离子轴承模组
        const hasPlasmaBearing = equippedWeapon.installedMods?.includes('等离子轴承');
        const bonusPerStack = hasPlasmaBearing ? baseBonusPerStack * 2 : baseBonusPerStack;

        // 计算理论伤害加成（无上限）
        const rawStacksBonus = currentStacks * bonusPerStack;

        // 应用50%伤害上限
        const maxBonus = 0.5; // 50%上限
        const stacksBonus = Math.min(rawStacksBonus, maxBonus);

        // 添加到总加成
        totalModAdd += stacksBonus;

        // 添加消息
        let stacksMessage = `🔫 【横冲直撞】：连续攻击${currentStacks}次，伤害增加${(stacksBonus * 100).toFixed(1)}%`;
        if (rawStacksBonus >= maxBonus) {
            stacksMessage += ` (已达上限)`;
        }
        modMessages.push(stacksMessage);
    }

    return {
        totalModAdd,
        modMessages
    };
}

// 重构后的职业加成计算（返回加法值）
async function calculateCareerAdditive(ctx: Context, handle: string, weaponType: string, weaponId: number, careerData: any) {

    let value = 0;
    let message = '';

    // 示例计算逻辑（根据实际配置调整）
    if (careerData?.career === '警卫长') {
        value += 0.05;
        message = '⚔️ 警卫长职业：攻击伤害+5%';
    }
    if (careerData?.career === '武器中士') {
        value += 0.15;
        message = '⚔️ 武器中士职业：攻击伤害+15%';
    }
    if (careerData?.career === '能量武器专家') {
        if (weaponType === '能量武器') {
            value += 0.2;
            message = '⚔️ 能量武器专家职业：能量武器攻击伤害+20%';
        }
    }
    if (careerData?.career === '纵火狂') {
        if (weaponType === '热能武器') {
            value += 0.2;
            message = '⚔️ 纵火狂职业：热能武器攻击伤害+20%';
        }
    }
    if (careerData?.career === '猩红杀手') {
        if (weaponId === 7) { // 侦察步枪的ID是7
            value += 0.15;
            message = '⚔️ 猩红杀手职业：侦察步枪攻击伤害+15%';
        }
    }

    return { value, message };
}

// 重构的祈愿加成函数（返回加法值）
async function calculateWishAdditive(ctx: Context, handle: string, weapon: any) {
    let value = 0;
    const messages = [];

    // 获取玩家状态
    const [playerStats] = await ctx.database.get('ggcevo_player_stats', {
        handle
    });
    const now = new Date();

    // 王权增幅
    if (playerStats && playerStats.wishname === '王权增幅' && 
        playerStats.lastWishDate <= now && 
        new Date(playerStats.lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000) >= now) {
        value += 0.05;
        messages.push('👑 王权增幅祈愿：攻击伤害+5%');
    }

    // 悲鸣之锋
    if (playerStats && playerStats.wishname === '悲鸣之锋' && 
        playerStats.lastWishDate <= now && 
        new Date(playerStats.lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000) >= now) {
        const levelBonus = 0.05 * weapon.level + 0.1;
        value += levelBonus;
        messages.push(`🗡️ 悲鸣之锋祈愿：攻击伤害+${Math.round(levelBonus * 100)}%`);
    }

    return {
        value,
        message: messages.join('，')
    };
}

// 额外伤害加成计算函数
async function calculateExtraDamageBonus(ctx: Context, handle: string, weaponName: string, careerData: any) {
    let value = 0;
    let message = '';

    // 检查雷达面罩效果：辛迪加海盗阵营，拥有雷达面罩，使用侦察步枪
    if (careerData?.faction === '辛迪加海盗' && weaponName === '侦察步枪') {
        const [radarMask] = await ctx.database.get('ggcevo_backpack', {
            handle,
            itemId: 1006 // 雷达面罩ID
        });

        if (radarMask?.quantity > 0) {
            value += 0.05; // 额外造成5%的伤害
            message = '🛰️ 【雷达面罩】生效：使用侦察步枪时额外造成5%的伤害';
        }
    }

    return {
        value,
        message
    };
}


