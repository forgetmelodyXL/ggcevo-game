import { Context } from 'koishi'
import { Config } from '../index'
import { calculateTotalDamage } from './damagecalculation'
import { applyPassiveEffects, BattleStatistics, battleStatsMap, getMaxHPByName, getMaxEnergyByName, getMaxStacksByName } from './BattleEffectProcessor'
import { Spacestationtechnology } from '../careersystem/technology'
import { weaponConfig } from '../weapons'
import { bossPool } from './boss'


async function getCleanerRewardBroadcast(
    ctx: Context,
    boss,
    killerHandle: string,
    killerName: string
): Promise<string[]> {
    const bossType = boss.type;
    const bossName = boss.name;

    // 消息收集数组
    const broadcastMessages: string[] = [];

    // ====================== 警卫长奖励部分 ======================
    // 根据被击败的BOSS类型确定基础金币奖励
    let guardBaseReward = 0;
    if (['巢穴雷兽', '巢穴战士', '巢穴甲虫'].includes(bossName)) {
        guardBaseReward = 200;
    } else {
        guardBaseReward = bossType === '主宰' ? 1000 : 500;
    }

    // 获取所有警卫长
    const allGuards = await ctx.database.get('ggcevo_careers', {
        career: '警卫长'
    });

    // 如果没有警卫长则跳过
    if (allGuards.length > 0) {
        // 获取警卫长的金币记录
        const guardHandles = allGuards.map(g => g.handle);
        const signRecords = await ctx.database.get('ggcevo_sign', {
            handle: { $in: guardHandles }
        });

        // 创建handle到记录的映射
        const signMap = new Map(signRecords.map(record => [record.handle, record]));

        let guardKillerBonus = false;

        for (const guard of allGuards) {
            let rewardAmount = guardBaseReward;

            // 检查是否为致命一击玩家
            if (guard.handle === killerHandle) {
                rewardAmount *= 2; // 致命一击奖励翻倍
                guardKillerBonus = true;
            }

            // 获取当前金币数量
            const currentSignRecord = signMap.get(guard.handle);
            const currentTotal = currentSignRecord?.totalRewards || 0;

            // 更新或创建金币记录
            await ctx.database.upsert('ggcevo_sign', [{
                handle: guard.handle,
                totalRewards: currentTotal + rewardAmount,
            }], ['handle']);
        }

        // 构建警卫长奖励消息
        const guardMessage = `👮 警卫长职业因 ${bossName} 阵亡，获得 ${guardBaseReward} 金币${guardKillerBonus ? ` (击败者 ${killerName} 获得双倍奖励)` : ''}`;
        broadcastMessages.push(guardMessage);
    }

    return broadcastMessages;
}

async function handleBossDefeatRewards(
    ctx: Context,
    targetBoss: any,
): Promise<{ rewardMessages: string[] }> {
    const damageRecords = await ctx.database.select('ggcevo_boss_damage')
        .where({
            bossGroupId: targetBoss.groupId,
            totalDamage: { $gt: 0 }
        })
        .orderBy('totalDamage', 'desc')
        .execute();

    const rewardMessages: string[] = [];
    const rewardMap = new Map();

    if (damageRecords.length === 0) {
        return { rewardMessages };
    }

    // 获取所有参与者
    const handles = damageRecords.map(r => r.handle);

    // 1. 获取精灵双倍祈愿记录（仅用于双倍资源兑换券）
    const doubleWishRecords = await ctx.database.get('ggcevo_wish', {
        handle: { $in: handles },
        wishname: '精灵双倍',
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        isused: false
    });
    const doubleWishIds = doubleWishRecords.map(r => r.id);
    const doubleWishHandles = new Set(doubleWishRecords.map(r => r.handle));

    // 2. 按排名分配资源兑换券奖励（根据新阶梯）
    const allRankRewards = [];

    damageRecords.forEach((record, index) => {
        const rank = index + 1;
        let coupons = 0;

        // 根据排名确定基础奖励
        if (rank === 1) coupons = 35;      // 第一名：
        else if (rank === 2) coupons = 30;  // 第二名：
        else if (rank === 3) coupons = 25;  // 第三名：
        else if (rank <= 10) coupons = 20;  // 4-10名：
        else if (rank <= 20) coupons = 15;  // 11-20名：
        else if (rank <= 50) coupons = 10;  // 21-50名：
        else coupons = 5;                   // 50名后参与奖：

        // 仅对资源兑换券应用精灵双倍效果
        const hasDoubleWish = doubleWishHandles.has(record.handle);
        if (hasDoubleWish) {
            coupons *= 2;
        }

        const reward = {
            coupons,
            playerName: record.playerName,
            rank,
            hasDoubleWish
        };

        rewardMap.set(record.handle, reward);
        allRankRewards.push(reward);
    });

    // 3. 构建奖励提示信息
    // 前20名奖励详细展示（每人一行）
    allRankRewards.slice(0, 20).forEach(reward => {
        const bonusNote = reward.hasDoubleWish ? ' (🧝‍♀ 精灵双倍生效)' : '';
        rewardMessages.push(
            `${reward.rank}. ${reward.playerName} 获得 ${reward.coupons} 资源兑换券${bonusNote}`
        );
    });

    // 21-50名分组提示（按类别分组显示）
    const rank21To50 = allRankRewards.slice(20, 50);
    if (rank21To50.length > 0) {
        const totalPlayers = rank21To50.length;
        const doubleWishCount = rank21To50.filter(p => p.hasDoubleWish).length;
        const baseRewardPerPlayer = 10; // 每人基础奖励

        rewardMessages.push(
            `21-50名: ${totalPlayers}人`,
            `  基础奖励: 每人 ${baseRewardPerPlayer} 资源兑换券`
        );

        if (doubleWishCount > 0) {
            rewardMessages.push(
                `  精灵双倍生效: ${doubleWishCount}人 每人额外获得 ${baseRewardPerPlayer} 资源兑换券`
            );
        } else {
            rewardMessages.push(`  (无精灵双倍玩家)`);
        }
    }

    // 参与奖提示（50名后的玩家）
    const participants = allRankRewards.slice(50);
    if (participants.length > 0) {
        const totalParticipants = participants.length;
        const doubleWishCount = participants.filter(p => p.hasDoubleWish).length;
        const baseRewardPerPlayer = 5; // 每人基础奖励

        rewardMessages.push(
            `参与奖: ${totalParticipants}人`,
            `  基础奖励: 每人 ${baseRewardPerPlayer} 资源兑换券`
        );

        if (doubleWishCount > 0) {
            rewardMessages.push(
                `  精灵双倍生效: ${doubleWishCount}人 每人额外获得 ${baseRewardPerPlayer} 资源兑换券`
            );
        } else {
            rewardMessages.push(`  (无精灵双倍玩家)`);
        }
    }

    // 4. 更新数据库（只发放资源兑换券）
    await ctx.database.withTransaction(async () => {
        // 发放资源兑换券 (物品ID=8)
        for (const [handle, reward] of rewardMap) {
            if (reward.coupons > 0) {
                const [couponData] = await ctx.database.get('ggcevo_backpack', {
                    handle,
                    itemId: 8 // 资源兑换券ID
                });
                await ctx.database.upsert('ggcevo_backpack', [{
                    handle,
                    itemId: 8,
                    quantity: (couponData?.quantity || 0) + reward.coupons
                }], ['handle', 'itemId']);
            }
        }

        // 标记已使用的精灵双倍祈愿记录
        if (doubleWishIds.length > 0) {
            await ctx.database.set('ggcevo_wish', { id: { $in: doubleWishIds } }, {
                isused: true
            });
        }
    });

    return { rewardMessages };
}

// ====================== 主目标攻击函数 ======================
export async function handlePrimaryAttack(
    ctx: Context,
    session: any,
    handle: string,
    config: Config,
    equippedWeapon: any,
    targetBoss: any,
    activeBosses: any[],
    weaponName: string,
    careerData: any,
) {
    // 计算基础伤害
    const damageResult = await calculateTotalDamage(ctx, session, config, equippedWeapon, targetBoss, careerData);

    const ignoreReduction = await handleIgnoreReductionEffects(ctx, handle, weaponName, targetBoss)

    // 处理效果


    const EffectProcessor = applyPassiveEffects(targetBoss, activeBosses, weaponName, damageResult.damage, damageResult.hasCrit, ignoreReduction.ignoreRate, careerData, equippedWeapon)

    const initialDamage = EffectProcessor.finalDamage;

    await saveAndClearStats(ctx)

    // 处理巢穴子代生成
    if (EffectProcessor.spawnNewBossMarks?.length) {
        for (const bossName of EffectProcessor.spawnNewBossMarks) {
            await createNestlingBosses(ctx, bossName);
        }
    }

    const [currentboss] = await ctx.database.get('ggcevo_boss', { name: targetBoss.name });

    const currentHP = currentboss.HP


    // 最终是否被击败
    const isDefeated = currentHP <= 0;

    // 返回结果
    return {
        initialDamage,
        currentHP,
        isDefeated,
        hasCrit: damageResult.hasCrit,
        effectMessage: damageResult.effectMessage,
        passiveMessages: EffectProcessor.messages,
        ignoreMessage: ignoreReduction.messages,
        radiationApplied: EffectProcessor.radiationLayerAdded,
        freezing: EffectProcessor.coldLayerAdded,
        bileStacks: EffectProcessor.bileDetonationTrigger,
        pulseApplied: EffectProcessor.layerReduced,
        arcApplied: EffectProcessor.energyDrained,
        pulseGrenadeTriggered: EffectProcessor.pulseGrenadeTriggered,
        burnLayerAdded: EffectProcessor.burnLayerAdded,
        drainFactor: EffectProcessor.drainFactor,
        reductionAmount: EffectProcessor.reductionAmount,
    };
}

// ====================== 散射攻击函数 ======================
export async function handleScatterAttack(
    ctx: Context,
    session: any,
    handle: string,
    config: Config,
    equippedWeapon: any,
    targetBoss: any,
    weaponName: string,
    activeBosses: any[],
    careerData: any,
) {
    // 获取存活的其他目标（排除主目标）
    const secondaryTargets = activeBosses.filter(boss => boss.name !== targetBoss.name);

    const scatterEffectMessages: string[] = [];
    const extraDamages: Array<{ name: string; damage: number }> = [];
    const actuallyDead: string[] = [];
    const taskUpdates: { taskId: number, count: number }[] = [];

    // 添加散射触发提示
    let scatterRatio = 0;
    if (weaponName === '碎骨步枪') {
        scatterEffectMessages.push('【光束曲射晶片】触发散射攻击！');
        scatterRatio = 1.0;
    } else if (weaponName === '中子步枪') {
        scatterEffectMessages.push('【中子步枪】触发散射攻击！');
        scatterRatio = 1.2;
    } else if (weaponName === 'DG-3电弧步枪') {
        scatterEffectMessages.push('【DG-3电弧步枪】触发散射攻击！');
        scatterRatio = 0.5;
    }

    // 处理每个次要目标
    for (const secondaryTarget of secondaryTargets) {
        // 计算该次要目标的伤害
        const damageResult = await calculateTotalDamage(
            ctx, session, config, equippedWeapon, secondaryTarget, careerData
        );

        const secondaryDamage = Math.round(damageResult.baseDamage * scatterRatio);

        const ignoreReduction = await handleIgnoreReductionEffects(ctx, handle, weaponName, secondaryTarget)

        // 处理效果
        const EffectProcessor = applyPassiveEffects(secondaryTarget, activeBosses, weaponName, secondaryDamage, damageResult.hasCrit, ignoreReduction.ignoreRate, careerData, equippedWeapon)

        const actualDamage = EffectProcessor.finalDamage;

        await saveAndClearStats(ctx)

        const [currentboss] = await ctx.database.get('ggcevo_boss', { name: secondaryTarget.name });

        const currentHP = currentboss.HP

        // 记录伤害
        extraDamages.push({
            name: secondaryTarget.name,
            damage: actualDamage
        });


        // 收集任务更新
        if (EffectProcessor.radiationLayerAdded) {
            // 检查是否安装了辐射充能核心
            const hasRadiationCore = equippedWeapon.installedMods?.includes('辐射充能核心')

            // 根据模组存在决定任务计数
            const count = hasRadiationCore ? 2 : 1;
            taskUpdates.push({ taskId: 1, count });
        }
        if (EffectProcessor.coldLayerAdded) {
            const hasNitrogenCore = equippedWeapon.installedMods?.includes('氮气压缩核心');
            const count = hasNitrogenCore ? 2 : 1;
            taskUpdates.push({ taskId: 2, count });
        }
        if (EffectProcessor.bileDetonationTrigger) {
            taskUpdates.push({ taskId: 3, count: 1 });
        }
        if (EffectProcessor.layerReduced) {
            taskUpdates.push({ taskId: 4, count: EffectProcessor.reductionAmount });
        }
        if (EffectProcessor.energyDrained) {
            taskUpdates.push({ taskId: 5, count: EffectProcessor.drainFactor });
        }
        // 任务6：装甲破坏者 - 根据武器类型和模组计数
        if (weaponName === 'M4AE脉冲步枪') {
            // 脉冲步枪效果触发时完成2次
            taskUpdates.push({ taskId: 6, count: 2 });
        } else if (weaponName === '动力钻头' && equippedWeapon.installedMods?.includes('强力钻刺核心')) {
            // 动力钻头+强力钻刺核心完成1次
            taskUpdates.push({ taskId: 6, count: 1 });
        }
        // 处理燃烧层添加任务
        if (EffectProcessor.burnLayerAdded) {
            let burnLayers = 1; // 默认叠加1层

            // 检查武器名称是否为'龙息霰弹枪'
            if (weaponName === '龙息霰弹枪') {
                burnLayers = 2; // 龙息霰弹枪固定叠加4层
            }

            // 检查是否安装'助燃核心'模组
            if (equippedWeapon.installedMods?.includes('助燃核心')) {
                burnLayers *= 2; // 有模组时双倍叠加层数
            }

            // 添加任务更新计数
            taskUpdates.push({ taskId: 7, count: burnLayers });
        }

        // 更新目标状态
        const isDead = currentHP <= 0;

        // 收集被动消息
        scatterEffectMessages.push(...EffectProcessor.messages.map(m => ` 对 ${secondaryTarget.name} ${m}`));

        // 记录死亡目标
        if (isDead) {
            actuallyDead.push(secondaryTarget.name);
        }
    }

    return {
        scatterEffectMessages,
        extraDamages,
        actuallyDead,
        taskUpdates,
    };
}

// ====================== 统一处理死亡目标 ======================
export async function handleDeathTargets(
    ctx: Context,
    deadTargets: any[],
    killerName: string,
    killerHandle: string
) {
    const bossBroadcast: string[] = [];
    const cleanerBroadcast: string[] = [];

    for (const deadBoss of deadTargets) {
        // 处理清洁工奖励
        const cleanerReward = await getCleanerRewardBroadcast(
            ctx, deadBoss, killerHandle, killerName
        );
        if (cleanerReward.length > 0) {
            cleanerBroadcast.push(...cleanerReward);
        }

        // 主宰死亡处理
        if (deadBoss.type === '主宰') {
            // 设置所有相关BOSS为非激活状态
            await ctx.database.set('ggcevo_boss', { groupId: deadBoss.groupId }, {
                isActive: false,
                HP: 0
            });

            // +++ 修改：计算下一个0点或12点作为复活时间 +++
            const now = new Date();
            let nextRespawn = new Date();

            // 获取当前小时
            const hours = now.getHours();

            if (hours < 12) {
                // 如果当前时间小于12点，设置为当天的12点
                nextRespawn.setHours(12, 0, 0, 0);
            } else {
                // 如果当前时间大于等于12点，设置为次日的0点
                nextRespawn.setDate(nextRespawn.getDate() + 1);
                nextRespawn.setHours(0, 0, 0, 0);
            }

            // 设置复活时间
            await ctx.database.set('ggcevo_boss', { name: deadBoss.name }, {
                respawnTime: nextRespawn
            });

            // 获取奖励消息
            const { rewardMessages } = await handleBossDefeatRewards(ctx, deadBoss);

            // +++ 修改广播消息反映新的复活规则 +++
            const timeFormat = nextRespawn.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            bossBroadcast.push(
                `🎯 主宰 ${deadBoss.name} 已被 ${killerName} 击败！`,
                `所有子代已消失，主宰将在 ${timeFormat} 重生`,
                '',
                '🏆 伤害排行榜奖励：',
                ...rewardMessages
            );
        } else if (deadBoss.name === '巢穴雷兽' || deadBoss.name === '巢穴战士' || deadBoss.name === '巢穴甲虫') {
            await ctx.database.remove('ggcevo_boss', { name: deadBoss.name });
        } else {
            await ctx.database.upsert('ggcevo_boss', [{
                name: deadBoss.name,
                isActive: false,
                HP: 0
            }], ['name']);
        }
    }

    return {
        bossBroadcast,
        cleanerBroadcast
    };
}

export async function calculateRewards(
    ctx: Context,
    handle: string,
    totalDamage: number
) {
    // 安防系统的加成映射表
    const SECURITY_BONUS_MAPPING = {
        base: [5, 10, 15, 20, 25],
        career: [10, 20, 30, 40, 50]
    };

    // 1. 获取职业和安防系统等级
    const [careerData] = await ctx.database.get('ggcevo_careers', { handle });
    const career = careerData?.career;
    const group = careerData?.group;  // 获取角色阵营信息

    const [securityTech] = await ctx.database.get('ggcevo_tech', {
        handle,
        techId: 4
    });

    let techBonusPercent = 0;
    let techMessage = ''; // 新增：独立的科技奖励信息

    // 增加人类联盟阵营限制（新增）
    const isHumanAlliance = group === '人类联盟';

    if (securityTech && securityTech.level >= 1 && isHumanAlliance) {  // 修改条件
        const techLevel = securityTech.level - 1;
        const securityConfig = Spacestationtechnology.find(t => t.techId === 4);
        const isEligibleForCareerBonus = securityConfig?.careerNames.includes(career);

        techBonusPercent = isEligibleForCareerBonus
            ? SECURITY_BONUS_MAPPING.career[techLevel]
            : SECURITY_BONUS_MAPPING.base[techLevel];

        // 构建独立的科技加成消息
        techMessage = isEligibleForCareerBonus
            ? `⚙️ 安防系统Lv.${securityTech.level}：+${SECURITY_BONUS_MAPPING.career[techLevel]}%金币`
            : `⚙️ 安防系统Lv.${securityTech.level}：+${SECURITY_BONUS_MAPPING.base[techLevel]}%金币`;
    }

    // 职业加成（保持不变）
    let careerMultiplier = 0;
    let careerMessage = '';
    if (career === '警卫员下士') {
        careerMultiplier = 50;
        careerMessage = '🛡️ 警卫员下士职业：+50%金币';
    } else if (career === '警卫长') {
        // careerMultiplier = 75;
        // careerMessage = '🛡️ 警卫长职业：+75%金币';
    }

    // 计算总加成
    const totalBonusPercent = careerMultiplier + techBonusPercent;
    const totalBonusFactor = 1 + totalBonusPercent / 100;

    // 最终奖励
    const finalReward = Math.round(totalDamage * totalBonusFactor);

    // ====== 清洁工奖励调整 ======
    let redcrystalMessage = '';
    if (career === '清洁工') {
        // 基础红晶数量
        const baseRedCrystal = 1;
        // 根据伤害计算额外红晶（每100伤害+1，上限额外3）
        const damageBonus = Math.min(Math.floor(totalDamage / 100), 3);
        const totalRedCrystal = baseRedCrystal + damageBonus;

        // 更新红晶数量
        await ctx.database.upsert('ggcevo_careers', [{
            handle,
            redcrystal: (careerData?.redcrystal || 0) + totalRedCrystal
        }], ['handle']);

        // 统一提示获得的总红晶数量
        redcrystalMessage = `🔴 清洁工职业：+${totalRedCrystal}枚红晶`;
    }
    // ====== 调整结束 ======

    return {
        finalReward,
        careerMessage,
        redcrystalMessage,
        techMessage
    };
}

// ====================== 更新记录 ======================
export async function updateSignRecord(ctx: Context, handle: string, reward: number) {
    const [existingSign] = await ctx.database.get('ggcevo_sign', { handle });
    await ctx.database.upsert('ggcevo_sign', [{
        handle,
        totalRewards: (existingSign?.totalRewards || 0) + reward
    }], ['handle']);
}

// ====================== 构建结果消息 ======================
export function buildResultMessage(
    session: any,
    weaponName: string,
    targetBoss: any,
    primaryResult: any,
    scatterResult: any,
    finalReward: number,
    careerMessage: string,
    techMessage: string,
    redcrystalMessage: string
) {

    const maxHP = getMaxHPByName(targetBoss.name);

    const messages = [
        `🔥 ${session.username} 使用武器 ${weaponName} 对 ${targetBoss.name} 发起攻击！`,
        ...(primaryResult.effectMessage.length > 0 ? [
            `⚡ 攻击效果：\n${primaryResult.effectMessage.map(m => `▸ ${m}`).join('\n')}`
        ] : []),
        ...(primaryResult.ignoreMessage.length > 0 ? [
            `🗡️ 无视伤害减免：\n${primaryResult.ignoreMessage.map(m => `▸ ${m}`).join('\n')}`
        ] : []),
        ...(primaryResult.passiveMessages.length > 0 ? [
            `🛡️ 被动效果：\n${primaryResult.passiveMessages.map(m => `▸ ${m}`).join('\n')}`
        ] : []),
        `造成伤害：${primaryResult.initialDamage}${primaryResult.hasCrit ? '(✨ 暴击)' : ''}`,
    ];

    if (scatterResult) {
        messages.push(
            `⚡ 散射效果：\n${scatterResult.scatterEffectMessages.map(m => `▸ ${m}`).join('\n')}`,
            `散射伤害：`,
            ...scatterResult.extraDamages.map(d => `▸ 对 ${d.name} 造成 ${d.damage} 伤害`),
            ...(scatterResult.actuallyDead.length > 0 ? [
                `💀 散射击杀：${scatterResult.actuallyDead.join(', ')}`
            ] : [])
        );
    }

    const bonusMessages = [
        careerMessage ? `▸ ${careerMessage}` : '',
        techMessage ? `▸ ${techMessage}` : '',
        redcrystalMessage ? `▸ ${redcrystalMessage}` : ''
    ].filter(msg => msg); // 过滤掉空值

    messages.push(
        `获得金币：${finalReward}`
    );

    // 只在有加成消息时才显示加成效果标题和内容
    if (bonusMessages.length > 0) {
        messages.push(
            `⚡ 加成效果：`,
            ...bonusMessages
        );
    }

    messages.push(
        `目标剩余HP：${Math.max(primaryResult.currentHP, 0)}/${maxHP}`,
        primaryResult.isDefeated ? `🎉 恭喜，您已成功击败 ${targetBoss.name}！` : ''
    );

    return messages.filter(line => line).join('\n');
}

// ====================== 广播处理函数 ======================
export async function handleBroadcasts(
    ctx: Context,
    groupIds: string[],
    bossEventBroadcast: string[] | string | null,
    cleanerRewardBroadcast: string[] | null,
) {
    const broadcastMessages: string[] = [];


    // 2. 添加BOSS事件广播（如果有）
    if (bossEventBroadcast) {
        const bossMsg = Array.isArray(bossEventBroadcast)
            ? bossEventBroadcast.join('\n')
            : bossEventBroadcast;
        broadcastMessages.push(bossMsg);
    }

    // 3. 添加清洁工奖励广播（如果是主目标攻击）
    if (cleanerRewardBroadcast && cleanerRewardBroadcast.length > 0) {
        broadcastMessages.push(cleanerRewardBroadcast.join('\n'));
    }

    // 发送广播
    if (broadcastMessages.length > 0) {
        await ctx.broadcast(groupIds, broadcastMessages.join('\n\n'));
    }
}

export async function updateBossDamageRecord(
    ctx: Context,
    handle: string,
    playerName: string,
    bossGroupId: number,
    damageAmount: number
) {
    // 查询现有记录
    const [existingRecord] = await ctx.database.get('ggcevo_boss_damage', {
        handle,
        bossGroupId
    });

    // 更新或插入记录
    await ctx.database.upsert('ggcevo_boss_damage', [{
        handle,
        bossGroupId,
        playerName,
        totalDamage: (existingRecord?.totalDamage || 0) + damageAmount,
        attackCount: (existingRecord?.attackCount || 0) + 1,
        lastattackDate: new Date()
    }], ['handle', 'bossGroupId']);

    // ======== 新增：记录攻击日志 ========
    await ctx.database.create('ggcevo_damage_logs', {
        handle,
        date: new Date()  // 使用当前时间戳
    });
}

// 任务更新函数
export async function updateTaskProgress(
    ctx: Context,
    handle: string,
    taskUpdates: { taskId: number, count: number }[]
) {
    for (const update of taskUpdates) {
        // 获取任务记录
        const [taskRecord] = await ctx.database.get('ggcevo_task', {
            handle,
            taskId: update.taskId
        });

        // 更新任务进度
        await ctx.database.upsert('ggcevo_task', [{
            handle,
            taskId: update.taskId,
            progress: (taskRecord?.progress || 0) + update.count
        }], ['handle', 'taskId']);
    }
}

/**
 * 更新数据库中的Boss数据
 * @param ctx Koishi上下文
 * @param stats 战斗统计数据
 */
async function updateDatabaseWithStats(ctx: Context, stats: BattleStatistics) {
    // 获取Boss基础数据
    const bossData = await ctx.database.get('ggcevo_boss', { name: stats.name });
    const maxHP = getMaxHPByName(stats.name);
    const maxEnergy = getMaxEnergyByName(stats.name);
    const maxStacks = getMaxStacksByName(stats.name);

    if (!bossData || bossData.length === 0) {
        // 可选：处理Boss不存在的情况
        return;
    }

    const boss = bossData[0];
    const updateData: Partial<typeof boss> = {};

    // 1. 数值属性更新（添加上限限制）
    if (stats.hpChange !== 0) {
        const newHP = boss.HP + stats.hpChange;
        updateData.HP = Math.max(0, Math.min(maxHP, newHP));
    }

    if (stats.energyChange !== 0) {
        const newEnergy = boss.energy + stats.energyChange;
        updateData.energy = Math.max(0, Math.min(maxEnergy, newEnergy));
    }

    if (stats.armorChange !== 0) {
        const newarmor = boss.armorReductionLayers + stats.armorChange;
        updateData.armorReductionLayers = Math.max(0, newarmor)
    }

    // 2. 层数属性更新（保持原逻辑）
    if (stats.skillStacksChanged !== 0) {
        const newStacks = boss.skillStacks + stats.skillStacksChanged;
        updateData.skillStacks = Math.max(0, Math.min(maxStacks, newStacks));
    }

    if (stats.skillStatusChanged !== 0) {
        updateData.skillStatus = Math.max(0, boss.skillStatus + stats.skillStatusChanged);
    }

    if (stats.statusLayersChanged !== 0) {
        updateData.statusLayers = Math.max(0, boss.statusLayers + stats.statusLayersChanged);
    }

    if (stats.radiationLayersChange !== 0) {
        updateData.radiationLayers = Math.max(0, boss.radiationLayers + stats.radiationLayersChange);
    }

    if (stats.coldLayersChange !== 0) {
        updateData.coldLayers = Math.max(0, boss.coldLayers + stats.coldLayersChange);
    }

    if (stats.burnLayersChanged !== 0) {
        updateData.burnLayers = Math.max(0, boss.burnLayers + stats.burnLayersChanged);
    }

    // 3. 标签和技能更新（保持原逻辑）
    if (stats.tagsAdded.length > 0 || stats.tagsRemoved.length > 0) {
        updateData.tags = [
            ...boss.tags.filter(tag => !stats.tagsRemoved.includes(tag)),
            ...stats.tagsAdded.filter(tag => !boss.tags.includes(tag))
        ];
    }

    if (stats.skillsAdded.length > 0 || stats.skillsRemoved.length > 0) {
        updateData.skills = [
            ...boss.skills.filter(skill => !stats.skillsRemoved.includes(skill)),
            ...stats.skillsAdded.filter(skill => !boss.skills.includes(skill))
        ];
    }

    // 4. 特殊属性更新
    if (stats.lastWeaponName) {
        updateData.lastWeaponName = stats.lastWeaponName;
    }

    // 5. 执行更新
    if (Object.keys(updateData).length > 0) {
        await ctx.database.set('ggcevo_boss', { name: stats.name }, updateData);
    }
}

// 批量更新所有战斗统计数据到数据库
async function saveAndClearStats(ctx: Context) {
    for (const name in battleStatsMap) {
        const stats = battleStatsMap[name];
        await updateDatabaseWithStats(ctx, stats);
    }

    // 清空 battleStatsMap
    Object.keys(battleStatsMap).forEach(key => delete battleStatsMap[key]);
}

async function handleIgnoreReductionEffects(
    ctx: Context,
    handle: string,
    weaponName: string,
    targetBoss: any,
) {
    const ignoreEffects = [];
    const messages = [];

    // 1. 武器基础效果处理
    const handleWeaponEffect = () => {
        if (weaponName === '光剑') {
            ignoreEffects.push(1.0);
            messages.push(`⚔️ 【光剑】武器效果：无视100%伤害减免`);
        }
        else if (weaponName === 'M4AE脉冲步枪') {
            ignoreEffects.push(0.5);
            messages.push(`🔫 【M4AE脉冲步枪】武器效果：无视50%伤害减免`);
        }
        else if (weaponName === '粒子相位枪' &&
            targetBoss?.tags.includes('护盾')) {
            ignoreEffects.push(0.5);
            messages.push(`⚡ 【粒子相位枪】武器效果：无视50%伤害减免`);
        }
    }

    // 2. 模块处理（破甲模块 + 裂甲核心专属模块）
    const handlePiercingMod = async () => {
        const weaponConfigData = weaponConfig[weaponName];
        if (!weaponConfigData) return;

        const [equippedWeapon] = await ctx.database.get('ggcevo_weapons', {
            weaponId: weaponConfigData.id,
            handle,
            equipped: true
        });

        if (!equippedWeapon?.installedMods) return;

        // 处理破甲模块
        if (equippedWeapon.installedMods.includes('破甲模块')) {
            //ignoreEffects.push(0.1);
            //messages.push(`⚡ 【破甲模块】生效：无视10%伤害减免`);
        }

        // 处理裂甲核心专属模块（仅限高斯步枪）
        if (weaponName === '高斯步枪' &&
            equippedWeapon.installedMods.includes('裂甲核心')) {
            ignoreEffects.push(0.4);
            messages.push(`💥 【裂甲核心】生效：无视40%伤害减免`);
        }


        if (weaponName === '侦察步枪' &&
            equippedWeapon.installedMods.includes('金刚石瞄准镜')) {
            ignoreEffects.push(0.2);
            messages.push(`💥 【金刚石瞄准镜】生效：无视20%伤害减免`);
        }
    }

    // 执行武器和模块效果
    handleWeaponEffect();
    await handlePiercingMod();

    // 3. 职业专属效果
    const handleCareerEffects = async () => {
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle });
        if (!careerData || careerData.group !== '辛迪加海盗') return;

        // 雷达面罩效果
        const [radarMask] = await ctx.database.get('ggcevo_warehouse', {
            handle,
            itemId: 6
        });

        if (radarMask?.quantity > 0) {
            ignoreEffects.push(0.1);
            messages.push(`🛰️ 【雷达面罩】生效：无视10%伤害减免`);
        }
    }

    // 4. 职业效果处理
    await handleCareerEffects();

    // 5. 最终效果汇总
    if (ignoreEffects.length === 0) return { ignoreRate: 0, messages: [] };

    const totalIgnoreRate = Math.min(
        1.0,
        ignoreEffects.reduce((sum, rate) => sum + rate, 0)
    );

    return {
        ignoreRate: totalIgnoreRate,
        messages
    };
}

// ====================== 测试攻击函数 ======================
export async function testAttackFunction(
    ctx: Context,
    session: any,
    handle: string,
    config: Config,
    equippedWeapon: any,
    targetBoss: any,
    activeBosses: any[],
    weaponName: string,
    careerData: any,
) {
    // 计算基础伤害
    const damageResult = await calculateTotalDamage(ctx, session, config, equippedWeapon, targetBoss, careerData);

    const ignoreReduction = await handleIgnoreReductionEffects(ctx, handle, weaponName, targetBoss)

    // 处理效果
    const EffectProcessor = applyPassiveEffects(targetBoss, activeBosses, weaponName, damageResult.damage, damageResult.hasCrit, ignoreReduction.ignoreRate, careerData, equippedWeapon)

    const initialDamage = EffectProcessor.finalDamage;

    // 清空 battleStatsMap
    Object.keys(battleStatsMap).forEach(key => delete battleStatsMap[key]);

    // 返回结果
    return {
        initialDamage,
        hasCrit: damageResult.hasCrit,
        effectMessage: damageResult.effectMessage,
        passiveMessages: EffectProcessor.messages,
        ignoreMessage: ignoreReduction.messages,
    };
}

export async function createNestlingBosses(ctx: any, nestlingNames: string | string[]) {
    // 确保输入是数组
    const names = Array.isArray(nestlingNames) ? nestlingNames : [nestlingNames];
    const createdBosses = [];

    // 在bossPool中查找匹配的子代
    for (const name of names) {
        let foundMinion = null;
        let groupId = null;

        for (const bossGroup of bossPool) {
            const minion = bossGroup.minions.find(m => m.name === name);
            if (minion) {
                foundMinion = minion;
                groupId = bossGroup.id;
                break;
            }
        }

        if (!foundMinion) {
            // 改为只抛出当前出错的名称
            throw new Error(`未知的巢穴子代名称: ${name}`);
        }

        // 在数据库中创建巢穴子代
        const createdBoss = await ctx.database.create('ggcevo_boss', {
            name: foundMinion.name,
            type: foundMinion.type,
            HP: foundMinion.maxHP,
            tags: foundMinion.tags,
            skills: [...foundMinion.passive],
            energy: foundMinion.maxEnergy,
            armor: foundMinion.armor,
            groupId: groupId,
            isActive: true,
            respawnTime: new Date()
        });

        createdBosses.push(createdBoss);
    }

    return createdBosses;
}

// ======================= 斩杀阶段验证码机制 =======================
export async function verifyFinalBlow(
    ctx: any,
    session: any,
    bossName: string,
    targetBoss: any,
    activeBosses
): Promise<{
    success: boolean,
    updatedBoss?: any,
    verificationPassed?: boolean
}> {
    // 1. 检查是否满足验证条件
    const isDominationBoss = targetBoss.type === '主宰';
    const isLowHealth = targetBoss.HP < 2000;

    const forbiddenSkills = ['求生本能I', '求生本能II', '复苏'];
    const hasResurrectionSkill = forbiddenSkills.some(skill =>
        targetBoss.skills.includes(skill)
    );

    // 触发条件：活跃Boss列表中仅有当前Boss自己（无其他数据）
    const isIsolated =
        activeBosses.length === 1 &&  // 活跃Boss仅1个
        activeBosses[0].name === targetBoss.name;  // 唯一的Boss名字与当前一致

    // 不满足条件直接通过验证（移除时间窗口检查）
    if (!(isDominationBoss && isLowHealth && !hasResurrectionSkill && isIsolated)) {
        return {
            success: true,
            updatedBoss: targetBoss,
            verificationPassed: false
        };
    }

    // 2. 生成6位数字验证码
    //const verificationCode = Array(6).fill(0).map(() =>
    //    Math.floor(Math.random() * 10)
    //).join('');

    // 3. 发送验证提示
    //await session.send(
    //    `<quote id="${session.messageId}"/>⚠️ ${bossName}进入斩杀阶段！每个攻击时间段均可攻击2次，但需完成安全验证\n` +
    //    `请在30秒内输入验证码:【${verificationCode}】`
    //);

    // 4. 等待用户输入
    //const userInput = (await session.prompt(30000))?.trim();

    //if (!userInput) {
    //    await session.send('⏱️ 验证超时！请重新发起攻击。');
    //    return { success: false };
    //}

    //if (userInput !== verificationCode) {
    //   await session.send('❌ 验证码错误！攻击已中断。');
    //    return { success: false };
    //}

    // 5. 验证通过后重新查询BOSS状态
    //const [updatedBoss] = await ctx.database.get('ggcevo_boss', {
    //    name: bossName,
    //    isActive: true
    //});

    //if (!updatedBoss) {
    //    await session.send(`✅ 验证通过！但${bossName}已被其他玩家消灭。`);
    //    return { success: false };
    //}

    return {
        success: true,
        updatedBoss: targetBoss,
        verificationPassed: true
    };
}