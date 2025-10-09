import { weaponConfig } from '../weapons'
import { bossPool } from './boss'

export interface BattleStatistics {
  // 新增：唯一标识（用于区分不同对象的统计数据）
  name: string;

  // 基础生命值变化
  hpChange: number;          // 当前HP变化量（正数增加/负数减少）

  // 能量相关变化
  energyChange: number;      // 当前能量变化量

  armorChange: number;  // 新增：护甲削减值的变化量

  // 标签变化
  tagsAdded: string[];       // 新增的标签列表
  tagsRemoved: string[];     // 移除的标签列表

  // 技能变化
  skillsAdded: string[];     // 新增的技能列表
  skillsRemoved: string[];   // 移除的技能列表


  skillStacksChanged: number;// 技能层数变化值
  skillStatusChanged: number; // 技能状态变化值

  statusLayersChanged: number; // 特殊层数变化值

  // 特殊层数变化
  radiationLayersChange: number;   // 当前辐射层数变化量
  coldLayersChange: number;        // 当前寒冷层数变化量
  burnLayersChanged: number;      // 当前燃烧层数变化量

  // 其他关键信息
  lastWeaponName: string;    // 最后一次受击的武器名称
}

// 存储容器：键为 name，值为对应的统计数据
export const battleStatsMap: Record<string, BattleStatistics> = {};

// 获取指定 name 的统计数据（返回副本避免外部修改内部数据）
function getStatsByName(name: string): BattleStatistics | undefined {
  const stats = battleStatsMap[name];
  if (!stats) return undefined;
  // 深拷贝数组属性
  return {
    ...stats,
    tagsAdded: [...stats.tagsAdded],
    tagsRemoved: [...stats.tagsRemoved],
    skillsAdded: [...stats.skillsAdded],
    skillsRemoved: [...stats.skillsRemoved],
  };
}

function updateStatsByName(
  name: string,
  updates: Partial<BattleStatistics> // 允许部分属性更新
): void {
  // 获取现有数据（不存在则初始化默认值）
  const existing = battleStatsMap[name] ?? {
    name, // 键与 name 一致
    hpChange: 0,
    energyChange: 0,
    armorChange: 0,  // 新增字段初始化
    tagsAdded: [],
    tagsRemoved: [],
    skillsAdded: [],
    skillsRemoved: [],
    skillStacksChanged: 0,
    skillStatusChanged: 0,
    statusLayersChanged: 0,
    radiationLayersChange: 0,
    coldLayersChange: 0,
    burnLayersChanged: 0,
    lastWeaponName: "",
  };

  // 合并更新（关键逻辑）
  battleStatsMap[name] = {
    // name 不可变（保持原键）
    name: existing.name,

    // 数值类型：累加（支持正负变化）
    hpChange: existing.hpChange + (updates.hpChange ?? 0),
    energyChange: existing.energyChange + (updates.energyChange ?? 0),
    skillStacksChanged: existing.skillStacksChanged + (updates.skillStacksChanged ?? 0),
    skillStatusChanged: existing.skillStatusChanged + (updates.skillStatusChanged ?? 0),
    statusLayersChanged: existing.statusLayersChanged + (updates.statusLayersChanged ?? 0),
    radiationLayersChange: existing.radiationLayersChange + (updates.radiationLayersChange ?? 0),
    coldLayersChange: existing.coldLayersChange + (updates.coldLayersChange ?? 0),
    armorChange: existing.armorChange + (updates.armorChange ?? 0),
    burnLayersChanged: existing.burnLayersChanged + (updates.burnLayersChanged ?? 0),

    // 数组类型：合并（新增内容追加到现有数组）
    tagsAdded: [...existing.tagsAdded, ...(updates.tagsAdded ?? [])],
    tagsRemoved: [...existing.tagsRemoved, ...(updates.tagsRemoved ?? [])],
    skillsAdded: [...existing.skillsAdded, ...(updates.skillsAdded ?? [])],
    skillsRemoved: [...existing.skillsRemoved, ...(updates.skillsRemoved ?? [])],

    // 字符串类型：覆盖（取最新值）
    lastWeaponName: updates.lastWeaponName ?? existing.lastWeaponName,
  };
}

/**
 * 根据Boss名称获取其最大HP（maxHP）
 * @param bossName 要查询的Boss名称（支持主宰或子代）
 * @returns 对应Boss的maxHP（未找到时返回undefined）
 */
export function getMaxHPByName(bossName: string): number | undefined {
  // 遍历所有主宰Boss
  for (const boss of bossPool) {
    // 检查主宰自身名称是否匹配
    if (boss.main.name === bossName) {
      return boss.main.maxHP;
    }
    // 检查子代Boss名称是否匹配
    for (const minion of boss.minions) {
      if (minion.name === bossName) {
        return minion.maxHP;
      }
    }
  }
  // 未找到匹配的Boss
  return 10000;
}

/**
 * 根据Boss名称获取其最大能量（maxEnergy）
 * @param bossName 要查询的Boss名称（支持主宰或子代）
 * @returns 对应Boss的maxEnergy（未找到时返回undefined）
 */
export function getMaxEnergyByName(bossName: string): number | undefined {

  // 遍历所有主宰Boss
  for (const boss of bossPool) {
    // 检查主宰自身名称是否匹配
    if (boss.main.name === bossName) {
      return boss.main.maxEnergy; // 返回主宰的maxEnergy
    }
    // 检查子代Boss名称是否匹配
    for (const minion of boss.minions) {
      if (minion.name === bossName) {
        return minion.maxEnergy; // 返回子代的maxEnergy
      }
    }
  }
  // 未找到匹配的Boss
  return 10000;
}

export function getMaxStacksByName(bossName: string): number | undefined {

  // 遍历所有主宰Boss
  for (const boss of bossPool) {
    // 检查主宰自身名称是否匹配
    if (boss.main.name === bossName) {
      return boss.main.maxStacks; // 返回主宰的maxStacks
    }
    // 检查子代Boss名称是否匹配
    for (const minion of boss.minions) {
      if (minion.name === bossName) {
        return minion.maxStacks; // 返回子代的maxStacks
      }
    }
  }
  // 未找到匹配的Boss
  return 0;
}

/**
 * 根据Boss名称获取其最大护盾值（maxShield）
 * @param bossName 要查询的Boss名称（支持主宰或子代）
 * @returns 对应Boss的maxShield（未找到时返回undefined）
 */
export function getMaxShieldByName(bossName: string): number | undefined {


  for (const boss of bossPool) {
    if (boss.main.name === bossName) return boss.main.maxShield;
    for (const minion of boss.minions) {
      if (minion.name === bossName) return minion.maxShield;
    }
  }
  return 0;
}

/**
 * 根据Boss名称获取其护甲值（armor）
 * @param bossName 要查询的Boss名称（支持主宰或子代）
 * @returns 对应Boss的armor值（未找到时返回undefined）
 */
export function getArmorByName(bossName: string): number | undefined {


  for (const boss of bossPool) {
    if (boss.main.name === bossName) return boss.main.armor;
    for (const minion of boss.minions) {
      if (minion.name === bossName) return minion.armor;
    }
  }
  return undefined;
}

/**
 * 根据Boss名称获取其护盾护甲值（shieldArmor）
 * @param bossName 要查询的Boss名称（支持主宰或子代）
 * @returns 对应Boss的shieldArmor值（未找到时返回undefined）
 */
export function getShieldArmorByName(bossName: string): number | undefined {


  for (const boss of bossPool) {
    if (boss.main.name === bossName) return boss.main.shieldArmor;
    for (const minion of boss.minions) {
      if (minion.name === bossName) return minion.shieldArmor;
    }
  }
  return 0;
}







// 被动效果处理函数集
export const BattleEffectProcessor = {

  // 弱化形态
  handleWeakForm: function (targetBoss: any) {
    if (targetBoss.type === '子代') {

      if (targetBoss.name === '空间站哨枪塔' || targetBoss.name === '孵化场' || targetBoss.name === '巢穴雷兽' || targetBoss.name === '巢穴战士' || targetBoss.name === '巢穴甲虫') {
        return null
      }

      const newBuffMultiplier = 0.1;

      const messages = [`📚 【弱化形态】生效：子代防御脆弱，受到的伤害+10%`];

      return {
        buffMultiplier: newBuffMultiplier,
        messages
      };
    }

    return null
  },

  // 异形甲壳
  handleAlienShell: function (
    targetBoss: any,
  ) {
    if (targetBoss.skills.includes('异形甲壳')) {
      // 获取最大生命值和当前生命值
      const maxHP = getMaxHPByName(targetBoss.name);
      const currentHP = targetBoss.HP;

      // 计算已损失生命值百分比
      const lostHpPercent = (maxHP - currentHP) / maxHP;

      // 计算减伤比例：初始10% + 每损失1%血量增加1%减伤
      let reductionPercent = 0.1 + lostHpPercent;

      // 限制最高减伤为80%
      reductionPercent = Math.min(reductionPercent, 0.8);

      // 计算实际减伤值
      const reductionValue = Math.round(reductionPercent * 100);

      const messages = [
        `🛡️ 【异形甲壳】生效：当前减伤${reductionValue}%`
      ];

      return {
        nerfMultiplier: reductionPercent,
        messages
      };
    }

    return null;
  },

  // 孤立无援处理（活跃Boss中仅自己时增伤20%）
  handleIsolated: function (
    targetBoss: any,          // 当前目标Boss对象
    activeBosses: any[],      // 全局活跃Boss列表（从数据库查询）
    tempMark: boolean,
  ) {

    // 如果有临时标记，则不触发孤立无援
    if (tempMark || targetBoss?.testTag) {
      return null;
    }

    // 触发条件：活跃Boss列表中仅有当前Boss自己（无其他数据）
    const isIsolated =
      activeBosses.length === 1 &&  // 活跃Boss仅1个
      activeBosses[0].name === targetBoss.name;  // 唯一的Boss名字与当前一致

    if (isIsolated) {
      // 叠加增伤系数（原系数+20%）
      const newBuffMultiplier = 0.2;

      // 构造提示消息（明确说明触发条件）
      const messages = [
        `📚 【孤立无援】生效：无存活子代时，受到的伤害+20%`
      ];

      return {
        buffMultiplier: newBuffMultiplier,
        messages
      };
    }

    return null
  },

  handleFrostRegeneration: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills字段）
    activeBosses: any[],      // 全局活跃Boss列表（从数据库查询，需包含name、HP字段）
    maxStatsForTarget: any,
  ): {
    messages: string[]; // 提示消息
    targetUpdates?: { name: string, updates: Partial<BattleStatistics> }; // 目标boss更新数据
    otherUpdates: Array<{ name: string, updates: Partial<BattleStatistics> }>; // 其他boss更新数据
  } | null {
    const messages: string[] = [];
    const otherUpdates: Array<{ name: string, updates: Partial<BattleStatistics> }> = [];

    // 1. 检查是否拥有「冰霜回复」技能
    if (!targetBoss.skills.includes('冰霜回复')) {
      return null;
    }

    // 获取当前目标的最大生命值
    const targetMaxHP = maxStatsForTarget.maxHP;

    // 3. 判断是否触发技能（当前HP ≤ 30%maxHP）
    const currentHP = targetBoss.HP; // 关键修改：从activeBosses获取当前HP
    if (currentHP > targetMaxHP * 0.3) {
      return null;
    }

    // 4. 处理目标Boss自身回复（40%maxHP）
    const selfHealAmount = Math.round(targetMaxHP * 0.4);
    const targetUpdates: Partial<BattleStatistics> = {
      hpChange: selfHealAmount,       // 累加HP变化量（正数回复）
      skillsRemoved: ['冰霜回复']     // 移除技能
    };

    messages.push(`❄️ 【冰霜回复】触发：生命值≤30%，自身回复${selfHealAmount}点生命值`);

    // 5. 处理其他存活异形回复（10%maxHP）
    const otherSurvivingBosses = activeBosses.filter(boss =>
      boss.name !== targetBoss.name && boss.isActive
    );

    otherSurvivingBosses.forEach(otherBoss => {
      const otherName = otherBoss.name;
      const otherMaxHP = maxStatsForTarget.maxHP;
      const otherHealAmount = Math.round(otherMaxHP * 0.1);

      // 创建其他异形的更新数据
      otherUpdates.push({
        name: otherName,
        updates: { hpChange: otherHealAmount }
      });

      messages.push(`❄️ 「${otherName}」回复${otherHealAmount}点生命值`);
    });

    // 6. 最终消息（包含技能移除提示）
    messages.push(`❄️ 【冰霜回复】技能移除`);

    return {
      messages,
      targetUpdates: {
        name: targetBoss.name,
        updates: targetUpdates
      },
      otherUpdates
    };
  },

  handleFrostAura: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills字段）
    activeBosses: any[],      // 全局活跃Boss列表（从数据库查询，需包含name、HP字段）
  ): {
    messages: string[]; // 提示消息
    targetUpdates?: { name: string, updates: Partial<BattleStatistics> }; // 目标boss更新数据
    otherUpdates: Array<{ name: string, updates: Partial<BattleStatistics> }>; // 其他boss更新数据
  } | null {
    const messages: string[] = [];
    const otherUpdates: Array<{ name: string, updates: Partial<BattleStatistics> }> = [];

    // 2. 检查目标Boss是否拥有「冰霜环绕」技能
    if (!targetBoss.skills.includes('冰霜环绕')) {
      return null;
    }

    // 3. 获取目标Boss的最大HP（maxHP）
    const targetMaxHP = getMaxHPByName(targetBoss.name);

    // 4. 获取当前HP（从活跃列表中读取）
    const currentHP = targetBoss.HP;

    // 5. 判断是否触发技能（当前HP ≤ 30%maxHP）
    const triggerCondition = currentHP <= targetMaxHP * 0.3;
    if (!triggerCondition) {
      return null;
    }

    // 6. 获取当前燃烧层数
    const currentBurnLayers = targetBoss.burnLayers || 0;

    // 7. 处理目标Boss自身更新数据
    const selfHealAmount = Math.round(targetMaxHP * 0.45);
    const targetUpdates: Partial<BattleStatistics> = {
      hpChange: selfHealAmount,       // 生命值回复
      skillsRemoved: ['冰霜环绕'],    // 移除自身原有技能
      skillsAdded: ['寒霜地狱'],      // 新增【寒霜地狱】技能
      burnLayersChanged: -(currentBurnLayers + 2) // 清除所有燃烧层数
    };

    messages.push(`❄️ 【冰霜环绕】触发：生命值≤30%，自身回复${selfHealAmount}点生命值`);
    messages.push(`❄️ 「${targetBoss.name}」获得「寒霜地狱」技能`);

    // 新增消息：清除燃烧层数
    if (currentBurnLayers > 0) {
      messages.push(`🔥 【冰霜环绕】触发：清空全部燃烧效果`);
    }

    // 8. 为所有存活异形（排除自身）添加寒霜地狱技能
    const survivingMinions = activeBosses.filter(boss =>
      boss.name !== targetBoss.name && boss.isActive
    );

    survivingMinions.forEach(minion => {
      const minionName = minion.name;
      const minionUpdates: Partial<BattleStatistics> = {
        skillsAdded: ['寒霜地狱'] // 新增【寒霜地狱】技能
      };

      otherUpdates.push({
        name: minionName,
        updates: minionUpdates
      });

      messages.push(`❄️ 「${minionName}」获得「寒霜地狱」技能`);
    });

    // 9. 最终消息
    messages.push(`❄️ 【冰霜环绕】技能移除`);

    return {
      messages,
      targetUpdates: {
        name: targetBoss.name,
        updates: targetUpdates
      },
      otherUpdates
    };
  },

  // 冰霜进化处理（免疫伤害并回复生命值）
  handleFrostEvolution: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills字段）
    weaponName: string,       // 造成伤害的武器名称
    damage: number,           // 武器造成的伤害值
  ): {
    isImmune: boolean;        // 是否触发免疫标记
    immuneCold: boolean;      // 【新增】是否免疫了寒冷伤害
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let isImmune = false;

    if (!targetBoss.skills.includes('冰霜进化')) {
      return null
    }

    const isColdWeapon = weaponName === '零度之下';
    if (!isColdWeapon) {
      return null
    }

    isImmune = true;
    const immuneCold = true; // 【新增】免疫寒冷标记
    const healAmount = damage; // 回复量等于伤害值
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        hpChange: healAmount, // 生命值变化量
      } as Partial<BattleStatistics>
    };

    messages.push(`❄️ 【冰霜进化】生效：免疫寒冷伤害并回复${healAmount}点生命值`);

    // 【修改】返回对象加入immuneCold标记
    return {
      isImmune,
      immuneCold,  // 新增的免疫寒冷标记
      messages,
      targetUpdates
    };
  },

  // 寒霜地狱处理
  handleFrostHell: function (
    targetBoss: any,          // 当前目标Boss对象
  ) {
    if (targetBoss.skills.includes('寒霜地狱')) {
      const newNerfMultiplier = 0.3;

      const messages = [`❄️ 【寒霜地狱】生效：受到的伤害-30%`];

      return {
        nerfMultiplier: newNerfMultiplier,
        messages
      };
    }

    return null
  },

  // 应激甲壳I处理（基础减伤20%）
  handleStressShellI: function (
    targetBoss: any,          // 当前目标Boss对象
  ) {
    if (targetBoss.skills.includes('应激甲壳I')) {
      const newNerfMultiplier = 0.2;

      const messages = [`🛡️ 【应激甲壳I】生效：受到的伤害-20%`];

      return {
        nerfMultiplier: newNerfMultiplier,
        messages
      };
    }

    return null
  },

  // 应激甲壳II处理（进阶减伤25%）
  handleStressShellII: function (
    targetBoss: any,          // 当前目标Boss对象
  ) {
    if (targetBoss.skills.includes('应激甲壳II')) {
      const newNerfMultiplier = 0.25; // 增加25%减伤

      const messages = [`🛡️ 【应激甲壳II】生效：受到的伤害-25%`];

      return {
        nerfMultiplier: newNerfMultiplier,
        messages
      };
    }

    return null
  },

  // 求生本能I (修改后)
  handleSurvivalInstinctI: function (
    targetBoss: any,
    damageAmount: number  // 新增：接收伤害值参数
  ): {
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    if (!targetBoss.skills.includes('求生本能I')) {
      return null;
    }

    // 获取目标Boss的最大HP
    const targetMaxHP = getMaxHPByName(targetBoss.name);

    // 判断是否触发（伤害值 ≥ 当前HP）
    const isLethal = damageAmount >= targetBoss.HP;
    if (!isLethal) {
      return null;
    }

    // 处理目标Boss自身回复（30%maxHP）
    const selfHealAmount = Math.round(targetMaxHP * 0.3);
    const updates: Partial<BattleStatistics> = {
      hpChange: selfHealAmount,     // 回复生命值
      skillsRemoved: ['求生本能I']  // 移除技能
    };

    messages.push(`❤️ 【求生本能I】触发：承受致命伤害时，回复${selfHealAmount}点生命值`);
    messages.push(`❤️ 【求生本能I】技能移除`);

    return {
      messages,
      targetUpdates: {
        name: targetBoss.name,
        updates
      }
    };
  },

  // 求生本能II (修改后)
  handleSurvivalInstinctII: function (
    targetBoss: any,
    damageAmount: number  // 新增：接收伤害值参数
  ): {
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    if (!targetBoss.skills.includes('求生本能II')) {
      return null;
    }

    // 获取目标Boss的最大HP
    const targetMaxHP = getMaxHPByName(targetBoss.name);

    // 判断是否触发（伤害值 ≥ 当前HP）
    const isLethal = damageAmount >= targetBoss.HP;
    if (!isLethal) {
      return null;
    }

    // 处理目标Boss自身回复（50%最大HP）并移除技能
    const selfHealAmount = Math.round(targetMaxHP * 0.5);
    const updates: Partial<BattleStatistics> = {
      hpChange: selfHealAmount,       // 生命值变化量
      skillsRemoved: ['求生本能II']    // 移除的技能
    };

    messages.push(`❤️ 【求生本能II】触发：承受致命伤害时，回复${selfHealAmount}点生命值`);
    messages.push(`❤️ 【求生本能II】技能移除`);

    return {
      messages,
      targetUpdates: {
        name: targetBoss.name,
        updates
      }
    };
  },

  // 冷适应处理 - 修改版：只要有惧热标签并且寒冷层数>0就清除寒冷层数
  handleColdAdaptation: function (
    targetBoss: any,
    weaponName: string,
  ): {
    isImmune: boolean;
    immuneCold: boolean;
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let isImmune = false;
    let immuneCold = false;
    let targetUpdates = null;

    // 1. 检查技能
    if (!targetBoss.skills.includes('冷适应')) {
      return null;
    }

    // 2. 获取当前状态
    const currentLayers = targetBoss.statusLayers || 0;
    const hasFearHeatTag = targetBoss.tags.includes('惧热') || false;
    const currentColdLayers = targetBoss.coldLayers || 0;

    // ======== 修改开始 ========
    // 3. 只要存在惧热标签且寒冷层数>0就清除寒冷层数
    if (hasFearHeatTag && currentColdLayers > 0) {
      if (!targetUpdates) {
        targetUpdates = {
          name: targetBoss.name,
          updates: {}
        };
      }

      // 清除所有寒冷层数
      targetUpdates.updates.coldLayersChange = -(currentColdLayers + 2);
      messages.push(`🌬️ 【冷适应】生效：清除全部${currentColdLayers}层寒冷效果`);
    }
    // ======== 修改结束 ========

    // 4. 处理寒冷伤害免疫（当有惧热标签且使用的是寒冷武器）
    if (hasFearHeatTag && weaponName === '零度之下') {
      isImmune = true;
      immuneCold = true;
      messages.push(`🌬️ 【冷适应】生效：免疫寒冷伤害`);
      return { isImmune, immuneCold, messages, targetUpdates };
    }

    // 5. 处理未获得「惧热」标签的寒冷攻击
    if (currentLayers < 10 && weaponName === '零度之下') {
      const newLayers = currentLayers + 1;

      // 创建更新对象
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          statusLayersChanged: 1
        }
      };

      messages.push(`🌬️ 【冷适应】触发：当前${newLayers}层`);

      // 达到10层添加惧热标签
      if (newLayers >= 10) {
        targetUpdates.updates.tagsAdded = ['惧热'];
        messages.push(`🔥 【冷适应】生效：获得「惧热」标签并免疫寒冷伤害`);
      }
    }

    return { isImmune, immuneCold, messages, targetUpdates };
  },

  // 感染空间站处理（空间站存活时自身减伤50%）
  handleInfectedSpaceStation: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills字段）
    activeBosses: any[],      // 全局活跃Boss列表（从数据库查询）
  ) {
    const messages: string[] = [];


    // ------------------------------
    // 2. 检查目标Boss是否拥有「感染空间站」技能
    // ------------------------------
    if (!targetBoss.skills.includes('感染空间站')) {
      return null
    }

    // ------------------------------
    // 3. 检查「空间站哨枪塔」是否存活（独立于目标Boss的存活状态）
    // ------------------------------
    const spaceStation = activeBosses.find(boss =>
      boss.name === '空间站哨枪塔' && boss.isActive
    );
    if (!spaceStation) {
      return null
    }


    const newNerfMultiplier = 0.5; // 减伤系数+50%
    messages.push(`🛸 【感染空间站】生效：「空间站哨枪塔」存活，受到的伤害-50%`);

    return {
      nerfMultiplier: newNerfMultiplier,  // 返回调整后的减伤系数
      messages
    };
  },

  // 病毒云处理（释放病毒云雾减伤10%）
  handleVirusCloud: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills字段）
  ) {
    const messages: string[] = [];

    if (!targetBoss.skills.includes('病毒云')) {
      return null
    }


    const newNerfMultiplier = 0.1; // 减伤系数+10%
    messages.push(`☁️ 【病毒云】生效：受到的伤害-10%`);

    return {
      nerfMultiplier: newNerfMultiplier,  // 返回调整后的减伤系数
      messages
    };
  },

  // 霉菌滋生处理（空间站存活时为其回复1%最大生命值）
  handleMoldGrowth: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills字段）
    activeBosses: any[],      // 全局活跃Boss列表（从数据库查询）
  ): {
    messages: string[];       // 提示消息
    otherUpdates: {    // 空间站更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    // 1. 检查是否拥有「霉菌滋生」技能
    if (!targetBoss.skills.includes('霉菌滋生')) {
      return null;
    }

    // 2. 获取空间站
    const spaceStation = activeBosses.find(boss =>
      boss.name === '空间站哨枪塔' && boss.isActive
    );

    if (!spaceStation) {
      return null;
    }

    // 3. 计算回复量（1%最大生命值）
    const spaceStationMaxHP = getMaxHPByName(spaceStation.name);
    const healAmount = Math.round(spaceStationMaxHP * 0.01);

    // 4. 准备空间站更新数据
    const otherUpdates = {
      name: spaceStation.name,
      updates: {
        hpChange: healAmount
      } as Partial<BattleStatistics>
    };

    messages.push(`🍄 【霉菌滋生】生效：为「空间站哨枪塔」回复${healAmount}点生命值`);

    return {
      messages,
      otherUpdates
    };
  },

  // 岗哨机枪处理（累计10次攻击后为其他异形回复10%最大生命值）
  handleSentryGun: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills、skillStacks字段）
    activeBosses: any[],      // 全局活跃Boss列表（从数据库查询）
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    otherUpdates: Array<{     // 其他boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    }>;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;
    const otherUpdates: Array<{ name: string; updates: Partial<BattleStatistics> }> = [];

    // 1. 检查技能
    if (!targetBoss.skills.includes('岗哨机枪')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 处理未触发的情况（层数<10）
    if (currentStacks < 10) {
      // 增加层数
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          skillStacksChanged: 1 // 层数+1
        } as Partial<BattleStatistics>
      };

      const newStacks = currentStacks + 1;
      messages.push(`🔫 【岗哨机枪】充能：当前${newStacks}/10次攻击`);

      return {
        messages,
        targetUpdates,
        otherUpdates
      };
    }

    // 4. 处理触发情况（层数≥10）
    // 重置层数
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: -currentStacks // 重置层数
      } as Partial<BattleStatistics>
    };

    // 5. 筛选其他存活异形并准备更新数据
    const otherSurvivingBosses = activeBosses.filter(boss =>
      boss.name !== targetBoss.name &&
      boss.isActive
    );

    // 为每个存活异形生成回复更新数据
    otherSurvivingBosses.forEach(otherBoss => {
      const otherName = otherBoss.name;
      const otherMaxHP = getMaxHPByName(otherName)!;
      const healAmount = Math.round(otherMaxHP * 0.1);

      otherUpdates.push({
        name: otherName,
        updates: {
          hpChange: healAmount // 生命值回复
        }
      });

      messages.push(`🔫 【岗哨机枪】触发：为「${otherName}」回复${healAmount}点生命值`);
    });

    return {
      messages,
      targetUpdates,
      otherUpdates
    };
  },

  // 结构装甲处理（常规伤害降低20%；热能武器伤害降低40%）
  handleStructuralArmor: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills字段）
    weaponData: any,       // 造成伤害的武器数据（需包含type字段，如{ type: '热能武器' }）
  ) {
    const messages: string[] = [];


    // 2. 校验技能是否存在
    if (!targetBoss.skills.includes('结构装甲')) {
      return null
    }

    // 3. 获取武器类型并计算减伤系数
    const weaponType = weaponData.type; // 假设weaponData包含type字段（如"热能武器"）
    const isHeatWeapon = weaponType === '热能武器';
    const nerfMultiplier = isHeatWeapon ? 0.4 : 0.2; // 热能武器40%减伤，常规20%

    // 4. 记录提示信息
    messages.push(`🛡️ 【结构装甲】生效：受到${weaponType}的伤害-${nerfMultiplier * 100}%`);

    // 返回减伤系数（供外部战斗逻辑计算实际伤害）和提示信息
    return {
      nerfMultiplier,
      messages
    };
  },

  // 吸血唾液处理（叠加「吸血」层数，每层提供5%减伤，最多20层）
  handleVampireSaliva: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills、skillStacks字段）
  ): {
    nerfMultiplier: number;   // 减伤系数（0-1之间）
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('吸血唾液')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 计算新增层数（不超过20层）
    const addStacks = (currentStacks < 20) ? 1 : 0; // 只有当前层数小于20时才增加
    const addedReduction = currentStacks * 0.05; // 总减伤

    // 4. 准备更新数据
    let targetUpdates = null;
    if (addStacks > 0) {
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          skillStacksChanged: addStacks // 实际增加的层数（0或1）
        } as Partial<BattleStatistics>
      };
    }

    // 5. 记录提示信息

    messages.push(`🩸 【吸血唾液】生效：当前${currentStacks}层，受到的伤害-${(addedReduction * 100).toFixed(0)}%`);
    messages.push(`🩸 【吸血唾液】叠层：「吸血唾液」层数+1`);

    return {
      nerfMultiplier: addedReduction,
      messages,
      targetUpdates
    };
  },

  // 进食处理（吸血层数达到20层时，回复20%最大生命值）
  handleFeeding: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills、skillStacks字段）
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('进食')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 判断是否触发（层数≥20）
    if (currentStacks < 20) {
      return null;
    }

    // 4. 计算回复量（20%最大生命值）
    const maxHP = getMaxHPByName(targetBoss.name);
    const healAmount = Math.round(maxHP * 0.2);

    // 5. 准备更新数据
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: -currentStacks,  // 层数清零
        hpChange: healAmount                // 生命值回复
      } as Partial<BattleStatistics>
    };

    // 6. 记录提示信息
    messages.push(`🍽️ 【进食】触发：消耗20层「吸血唾液」，回复${healAmount}点生命值`);

    return {
      messages,
      targetUpdates
    };
  },

  // 嗜血狂暴处理（生命值低于50%时，叠加吸血层数并降低20%伤害）
  handleBloodlust: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills、skillStacks字段）
  ): {
    nerfMultiplier: number;   // 额外减伤系数（0-1之间）
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;
    let nerfMultiplier = 0;

    // 1. 检查技能是否存在
    if (!targetBoss.skills.includes('嗜血狂暴')) {
      return null;
    }

    // 2. 获取当前HP和最大HP
    const currentHP = targetBoss.HP;
    const maxHP = getMaxHPByName(targetBoss.name);

    // 3. 获取当前吸血层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 4. 判断是否触发嗜血狂暴（HP≤50%）
    const isLowHP = currentHP <= maxHP * 0.5;

    if (isLowHP) {
      // 5. 叠加吸血层数（不超过20层）
      if (currentStacks < 20) {
        targetUpdates = {
          name: targetBoss.name,
          updates: {
            skillStacksChanged: 1 // 层数+1
          } as Partial<BattleStatistics>
        };
      }

      // 6. 计算额外减伤20%
      nerfMultiplier = 0.2;

      // 7. 记录提示信息

      messages.push(`🔥 【嗜血狂暴】生效：生命值≤50%，每次受击+1层「吸血唾液」且受到的伤害-20%`);
    }

    return {
      nerfMultiplier,
      messages,
      targetUpdates
    };
  },

  // 吐血处理（无「吸血唾液」层数时，所受伤害提升20%）
  handleVomit: function (
    targetBoss: any,          // 当前目标Boss对象（需包含name、skills、skillStacks字段）
  ) {
    const messages: string[] = [];



    // 2. 校验技能是否存在
    if (!targetBoss.skills.includes('吐血')) {
      return null
    }

    // 3. 获取当前「吸血唾液」层数（从统计数据中读取，默认0）
    const currentVampireStacks = targetBoss.skillStacks || 0;

    // 4. 判断是否触发「吐血」效果（无吸血层数时）
    const isTriggered = currentVampireStacks === 0;
    const buffMultiplier = isTriggered ? 0.2 : 0; // 无层数时增伤20%

    // 5. 记录提示信息
    if (isTriggered) {
      messages.push(`🩸 【吐血】生效：无「吸血唾液」层数，受到的伤害+20%`);
    }

    // 返回增伤系数和提示（外部用此系数计算实际伤害）
    return {
      buffMultiplier,
      messages
    };
  },

  // 超导体（状态转换：护盾→重甲）
  handleSuperconductor: function (
    targetBoss: any,
  ): {
    messages: string[];
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;

    // 1. 校验技能存在
    if (!targetBoss.skills.includes('超导体')) {
      return null;
    }

    // 2. 获取当前生命值比例
    const maxHP = getMaxHPByName(targetBoss.name);
    const hpPercent = targetBoss.HP / maxHP;

    // 3. 检查触发条件：生命值≤10%且持有护盾标签
    const hasShieldTag = targetBoss.tags.includes('护盾') || false;
    if (hpPercent > 0.1 || !hasShieldTag) {
      return null;
    }

    // 4. 准备更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        tagsRemoved: ['护盾'], // 移除护盾标签
        tagsAdded: ['重甲']   // 添加重甲标签
      } as Partial<BattleStatistics>
    };

    // 5. 记录提示信息
    messages.push(`🛡️ 【超导体】触发：生命值≤10%，「护盾」标签转换为「重甲」标签`);

    return {
      messages,
      targetUpdates
    };
  },

  // 能量虹吸（生命值相关减伤）
  handleEnergySiphon: function (
    targetBoss: any,
  ): {
    nerfMultiplier: number;
    messages: string[];
  } {
    const messages: string[] = [];


    // 校验技能存在
    if (!targetBoss.skills.includes('能量虹吸')) return null

    // 计算生命值比例
    const maxHP = getMaxHPByName(targetBoss.name);

    const hpPercent = targetBoss.HP / maxHP;

    // 确定减伤系数
    let nerfMultiplier = 0;
    if (hpPercent >= 0.7) {
      nerfMultiplier = 0.4;  // 70%+生命值减伤40%
      messages.push(`⚡ 【能量虹吸】生效：生命值≥70%，受到的伤害-40%`);
    } else if (hpPercent >= 0.3) {
      nerfMultiplier = 0.2;  // 30%-70%生命值减伤20%
      messages.push(`⚡ 【能量虹吸】生效：生命值≥30%，受到的伤害-20%`);
    }

    return { nerfMultiplier, messages };
  },

  // 能源虹吸（能量值相关减伤）
  handleEnergyAbsorption: function (
    targetBoss: any,
  ): {
    nerfMultiplier: number;
    messages: string[];
  } {
    const messages: string[] = [];


    // 校验技能存在
    if (!targetBoss.skills.includes('能源虹吸')) return null

    // 获取当前能量值
    const currentEnergy = targetBoss.energy;
    const maxEnergy = getMaxEnergyByName(targetBoss.name);

    const energyPercent = currentEnergy / maxEnergy;

    // 确定减伤系数
    let nerfMultiplier = 0;
    if (energyPercent >= 0.8) {
      nerfMultiplier = 0.5;  // 80%+能量减伤50%
      messages.push(`⚡ 【能源虹吸】生效：能量值≥80%，受到的伤害-50%`);
    } else if (energyPercent >= 0.5) {
      nerfMultiplier = 0.3;  // 50%-80%能量减伤30%
      messages.push(`⚡ 【能源虹吸】生效：能量值≥50%，受到的伤害-30%`);
    }

    return { nerfMultiplier, messages };
  },

  handleElectricField: function (
    targetBoss: any,
    weaponData: any,
  ): {
    isImmune: boolean;
    messages: string[];
  } {
    const messages: string[] = [];
    let isImmune = false;

    // 校验技能存在
    if (!targetBoss.skills.includes('电能立场')) return null

    // 检查是否是非热能武器伤害
    if (weaponData.type === '热能武器') {
      return null;
    }

    // 获取当前能量值
    const currentEnergy = targetBoss.energy;
    const maxEnergy = getMaxEnergyByName(targetBoss.name);

    const energyPercent = currentEnergy / maxEnergy;

    // 校验能量条件
    if (energyPercent < 0.3) {
      return null
    }

    // 获取寒冷层数
    const coldLayers = targetBoss.coldLayers || 0;

    // 计算免疫概率（基础55%，每层寒冷-5%）
    const baseChance = 0.55;
    const coldPenalty = coldLayers * 0.05;
    const immuneChance = Math.max(baseChance - coldPenalty, 0.05);

    // 模拟免疫判定
    isImmune = Math.random() < immuneChance;

    // 只有在成功免疫时才生成消息
    if (isImmune) {
      const chancePercent = Math.round(immuneChance * 100);
      messages.push(`⚡ 【电能立场】生效：能量值≥30%，${chancePercent}%概率成功免疫非热能武器伤害`);
    }

    return { isImmune, messages };
  },

  // 电能冲击波（能量回复）
  handleElectricShockwave: function (
    targetBoss: any,
  ): {
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    // 1. 校验技能存在
    if (!targetBoss.skills.includes('电能冲击波')) {
      return null;
    }

    // 2. 获取当前能量和最大能量
    const currentEnergy = targetBoss.energy || 0;
    const maxEnergy = getMaxEnergyByName(targetBoss.name);

    // 3. 计算实际回复量（不超过最大能量）
    const maxHealAmount = 100;
    const actualHealAmount = Math.min(maxHealAmount, maxEnergy - currentEnergy);

    // 4. 检查是否有实际回复
    if (actualHealAmount <= 0) {
      return null
    }

    // 5. 准备更新数据
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        energyChange: maxHealAmount // 回复量
      } as Partial<BattleStatistics>
    };

    // 6. 记录提示信息
    messages.push(`⚡ 【电能冲击波】生效：回复${maxHealAmount}点能量`);


    return {
      messages,
      targetUpdates
    };
  },

  // 脉冲（生命回复）
  handlePulse: function (
    targetBoss: any,
    activeBosses: any[]
  ): {
    messages: string[];
    otherUpdates: Array<{     // 其他boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    }>;
  } | null {
    const messages: string[] = [];
    const otherUpdates: Array<{ name: string; updates: Partial<BattleStatistics> }> = [];

    // 1. 校验技能存在
    if (!targetBoss.skills.includes('脉冲')) {
      return null;
    }

    // 2. 获取当前能量值
    const currentEnergy = targetBoss.energy || 0;
    const maxEnergy = getMaxEnergyByName(targetBoss.name);

    // 3. 检查能量百分比是否≥30%
    const energyPercent = maxEnergy > 0 ? currentEnergy / maxEnergy : 0;
    if (energyPercent < 0.3) {
      return null
    }

    // 4. 获取寒冷层数
    const coldLayers = targetBoss.coldLayers || 0;

    // 5. 计算触发概率（基础60%，每层寒冷-5%）
    const baseChance = 0.6;
    const coldPenalty = coldLayers * 0.05;
    const triggerChance = Math.max(baseChance - coldPenalty, 0.1);

    // 6. 判定是否触发
    if (Math.random() >= triggerChance) {
      return null
    }

    // 7. 获取所有存活异形
    const survivors = activeBosses.filter(b => b.isActive);

    // 8. 为每个存活异形计算回复量
    survivors.forEach(survivor => {
      const healAmount = 100

      if (healAmount > 0) {
        otherUpdates.push({
          name: survivor.name,
          updates: { hpChange: healAmount }
        });

        messages.push(`⚡ 【脉冲】生效：为「${survivor.name}」回复${healAmount}点生命值`);
      }
    });

    return {
      messages,
      otherUpdates
    };
  },

  // 能量黑洞（固定减伤）
  handleEnergyBlackhole: function (
    targetBoss: any,
  ): {
    nerfMultiplier: number;
    messages: string[];
  } {
    const messages: string[] = [];


    // 校验技能存在
    if (!targetBoss.skills.includes('能量黑洞')) return null

    // 固定20%减伤
    messages.push(`⚡ 【能量黑洞】生效：存在「能量黑洞」时，受到的伤害-20%`);
    return { nerfMultiplier: 0.2, messages };
  },

  // 火焰异形（免疫伤害并回复生命值）
  handleFlameAlien: function (
    targetBoss: any,
    weaponName: string,
    damage: number,
  ): {
    isImmune: boolean;        // 是否触发免疫标记
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let isImmune = false;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('火焰异形')) {
      return null;
    }

    // 2. 校验是否是火焰伤害
    const isFireDamage = weaponName === '焚烧枪' || weaponName === '龙息霰弹枪';
    if (!isFireDamage) {
      return null;
    }

    // 3. 根据武器类型处理不同效果
    let healAmount = 0;
    let targetUpdates = null;

    if (weaponName === '焚烧枪') {
      // 焚烧枪：免疫伤害并回复100%伤害值
      isImmune = true;
      healAmount = damage;
      messages.push(`🔥 【火焰异形】生效：免疫火焰伤害并回复${healAmount}点生命值`);
    } else if (weaponName === '龙息霰弹枪') {
      // 龙息霰弹枪：不免疫伤害，只回复20%伤害值
      healAmount = Math.round(damage * 0.2);
      messages.push(`🔥 【火焰异形】生效：受到龙息霰弹枪的火焰伤害，回复${healAmount}点生命值`);
    }

    // 4. 准备更新数据
    if (healAmount > 0) {
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          hpChange: healAmount, // 生命值变化量
        } as Partial<BattleStatistics>
      };
    }

    return {
      isImmune,
      messages,
      targetUpdates
    };
  },

  // 庞兽狂暴 - 低生命时减伤
  handleColossalRampage: function (
    targetBoss: any,
  ) {
    const messages: string[] = [];



    // 2. 校验技能是否存在
    if (!targetBoss.skills.includes('庞兽狂暴')) {
      return null
    }

    // 3. 获取生命值比例
    const maxHP = getMaxHPByName(targetBoss.name);


    const hpPercent = targetBoss.HP / maxHP;
    let nerfMultiplier = 0;

    // 4. 生命值低于50%时触发减伤
    if (hpPercent <= 0.5) {
      nerfMultiplier = 0.5; // 50%减伤
      messages.push(`💥 【庞兽狂暴】生效：生命值≤50%，受到的伤害-50%`);
    }

    return { nerfMultiplier, messages };
  },

  handleBurningSlime: function (
    targetBoss: any,
    weaponName: string,
  ): {
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    isHighStackHeal: boolean;  // 新增的标记字段
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;
    let isHighStackHeal = false; // 初始化标记

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('灼烧粘液')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;
    const maxStacks = 20;

    // 3. 确定是否为火焰伤害
    const isFireDamage = weaponName === '焚烧枪' || weaponName === '龙息霰弹枪';

    // 4. 准备更新数据
    const updates: Partial<BattleStatistics> = {};

    // 5. 非火焰攻击时叠加层数
    if (!isFireDamage && currentStacks < maxStacks) {
      updates.skillStacksChanged = 1;
      const newStacks = currentStacks + 1;
      messages.push(`🔥 【灼烧粘液】生效：获得1层「灼烧粘液」`);
    }

    // 6. 火焰攻击时消耗层数回复生命
    if (isFireDamage && currentStacks > 0) {
      const healAmount = currentStacks * 10;
      updates.hpChange = healAmount;
      updates.skillStacksChanged = -currentStacks;

      messages.push(`🔥 【灼烧粘液】触发：消耗${currentStacks}层「灼烧粘液」，回复${healAmount}点生命值`);

      // 判断是否满足高堆叠条件
      if (currentStacks >= 10) {
        isHighStackHeal = true; // 设置高堆叠标记
      }

    }

    // 7. 如果有更新，构建返回对象
    if (Object.keys(updates).length > 0) {
      targetUpdates = {
        name: targetBoss.name,
        updates: updates
      };
    }

    // 返回包含标记的对象
    return {
      messages,
      targetUpdates,
      isHighStackHeal  // 新增的标记字段
    };
  },

  // 腐蚀胆汁 - 群体回复机制
  handleCorrosiveBile: function (
    targetBoss: any,
    activeBosses: any[],
    isHighStackHeal = false,
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据（层数重置）
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    otherUpdates: Array<{     // 其他boss更新数据（生命回复）
      name: string;
      updates: Partial<BattleStatistics>;
    }>;
  } | null {
    const messages: string[] = [];
    const otherUpdates: Array<{ name: string; updates: Partial<BattleStatistics> }> = [];
    let targetUpdates = null;
    const requiredStacks = 10;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('腐蚀胆汁') || isHighStackHeal) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 检查是否达到触发条件（层数≥10）
    if (currentStacks < requiredStacks) {
      return null
    }

    // 4. 筛选存活异形
    const otherSurvivingBosses = activeBosses.filter(boss =>
      boss.isActive
    );



    // 6. 准备目标boss的层数重置数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: -currentStacks // 重置层数为0
      } as Partial<BattleStatistics>
    };

    messages.push(`🧪 【腐蚀胆汁】触发：消耗${currentStacks}层「灼烧粘液」`);

    // 5. 为每个存活异形准备回复数据
    otherSurvivingBosses.forEach(otherBoss => {
      const otherName = otherBoss.name;
      const healAmount = 1000

      if (healAmount > 0) {
        otherUpdates.push({
          name: otherName,
          updates: { hpChange: healAmount }
        });

        messages.push(`🧪 【腐蚀胆汁】触发：为「${otherName}」回复${healAmount}点生命值`);
      }
    });

    return {
      messages,
      targetUpdates,
      otherUpdates
    };
  },

  // 火焰吐息 - 高级群体回复机制
  handleFlameBreath: function (
    targetBoss: any,
    activeBosses: any[],
    isHighStackHeal = false,
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据（层数重置）
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    otherUpdates: Array<{     // 其他boss更新数据（生命回复）
      name: string;
      updates: Partial<BattleStatistics>;
    }>;
  } | null {
    const messages: string[] = [];
    const otherUpdates: Array<{ name: string; updates: Partial<BattleStatistics> }> = [];
    let targetUpdates = null;
    const requiredStacks = 20;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('火焰吐息') || isHighStackHeal) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 检查是否达到触发条件（层数≥20）
    if (currentStacks < requiredStacks) {
      return null
    }

    // 4. 筛选存活异形（排除自身）
    const otherSurvivingBosses = activeBosses.filter(boss =>
      boss.isActive
    );



    // 6. 准备目标boss的层数重置数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: -currentStacks // 重置层数为0
      } as Partial<BattleStatistics>
    };


    messages.push(`🔥 【火焰吐息】触发：消耗${currentStacks}层「灼烧粘液」`);

    // 5. 为每个存活异形准备回复数据（20%最大生命值）
    otherSurvivingBosses.forEach(otherBoss => {
      const otherName = otherBoss.name;
      const maxHP = getMaxHPByName(otherName);
      const healAmount = Math.round(maxHP * 0.2)

      if (healAmount > 0) {
        otherUpdates.push({
          name: otherName,
          updates: { hpChange: healAmount }
        });

        messages.push(`🔥 【火焰吐息】触发：为「${otherName}」回复${healAmount}点生命值`);
      }
    });

    return {
      messages,
      targetUpdates,
      otherUpdates
    };
  },

  // 太阳耀斑 - 移除状态并获得免疫
  handleSolarFlare: function (
    targetBoss: any,
    weaponName: string,
    activeBosses: any[],
  ): {
    isImmune: boolean;       // 是否免疫伤害
    immuneCold: boolean;     // 新增：是否免疫了寒冷伤害
    messages: string[];      // 提示消息
    targetUpdates: {         // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    tempMark: boolean;       // 临时标记（防止触发孤立无援）
  } | null {
    const messages: string[] = [];
    let isImmune = false;
    let immuneCold = false; // 初始化新增的免疫标记
    let targetUpdates = null;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('太阳耀斑')) {
      return null;
    }

    // 2. 检查是否有存活子代（排除自身）
    const hasLivingOffspring = activeBosses.some(boss =>
      boss.name !== targetBoss.name && boss.isActive
    );

    // 3. 检查是否满足触发条件（无存活子代且自身有惧寒标签）
    const hasFearColdTag = targetBoss.tags.includes('惧寒') || false;
    if (hasLivingOffspring) {
      return null;
    }

    // 获取当前寒冷层数（用于清除）
    const currentColdLayers = targetBoss.coldLayers || 0;

    // 创建更新对象（用于可能的多项更新）
    let updates: Partial<BattleStatistics> = {};

    if (hasFearColdTag) {
      // 4. 准备移除惧寒标签的更新数据
      updates.tagsRemoved = ['惧寒'];
      messages.push(`☀️ 【太阳耀斑】触发：移除「惧寒」标签`);

      // 6. 清除所有寒冷层数
      if (currentColdLayers > 0) {
        updates.coldLayersChange = -(currentColdLayers + 2);
        messages.push(`☀️ 【太阳耀斑】生效：清除全部寒冷效果`);
      }
    }

    // 5. 检查是否免疫寒冷伤害
    const isColdWeapon = weaponName === '零度之下';
    if (isColdWeapon) {
      //isImmune = true;
      //immuneCold = true; // 设置免疫标记
      //messages.push(`☀️ 【太阳耀斑】生效：免疫寒冷伤害`);
    }




    // 如果有任何更新，设置targetUpdates
    if (Object.keys(updates).length > 0) {
      targetUpdates = {
        name: targetBoss.name,
        updates
      };
    }

    return {
      isImmune,
      immuneCold, // 返回新增的免疫标记
      messages,
      targetUpdates,
      tempMark: true  // 添加临时标记
    };
  },

  // 燃烧潜地 - 低生命回复
  handleBurningBurrow: function (
    targetBoss: any,
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('燃烧潜地')) {
      return null;
    }

    // 2. 获取最大生命值和当前生命值
    const maxHP = getMaxHPByName(targetBoss.name);
    const currentHP = targetBoss.HP;

    // 3. 计算生命值比例
    const hpPercent = currentHP / maxHP

    // 4. 检查是否触发（生命值低于10%）
    if (hpPercent >= 0.1) {
      return null;
    }

    // 5. 计算回复量（50%最大生命值）
    const healAmount = Math.round(maxHP * 0.5);

    // 6. 准备更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillsRemoved: ['燃烧潜地'], // 移除技能
        hpChange: healAmount          // 回复生命值
      } as Partial<BattleStatistics>
    };

    // 7. 记录提示信息
    messages.push(`🔥 【燃烧潜地】触发：生命值≤10%，回复${healAmount}点生命值`);
    messages.push(`🔥 【燃烧潜地】技能移除`);

    return {
      messages,
      targetUpdates
    };
  },

  // 炼狱爆弹 - 基于层数和子代的减伤
  handleInfernalBomb: function (
    targetBoss: any,
    activeBosses: any[],
  ) {
    const messages: string[] = [];
    let nerfMultiplier = 0;


    // 2. 校验技能是否存在
    if (!targetBoss.skills.includes('炼狱爆弹')) {
      return null
    }

    // 3. 获取当前灼烧粘液层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 4. 检查是否有存活子代
    const hasLivingOffspring = activeBosses.some(boss =>
      boss.name !== targetBoss.name && boss.isActive
    );

    // 5. 计算减伤比例
    // 每层提供5%基础减伤
    let baseReduction = currentStacks * 0.05;

    // 有子代时额外获得每层5%减伤
    let extraReduction = 0;
    if (hasLivingOffspring) {
      extraReduction = currentStacks * 0.05;
    }

    nerfMultiplier = baseReduction + extraReduction;

    if (nerfMultiplier > 0) {
      const reductionPercent = Math.round(nerfMultiplier * 100);
      const offspringMsg = hasLivingOffspring ? "" : "";
      messages.push(`💣 【炼狱爆弹】生效：当前${currentStacks}层「灼烧粘液」，受到的伤害-${reductionPercent}%${offspringMsg}`);
    }

    return { nerfMultiplier, messages };
  },

  // 猎手异形处理（条件增减伤 + 火焰/寒冷免疫）
  handleHunterAlien: function (
    targetBoss: any,
    activeBosses: any[],      // 全局活跃Boss列表
    weaponName: string,       // 造成伤害的武器名称
  ): {
    buffMultiplier: number;   // 当前增伤系数变化
    nerfMultiplier: number;   // 当前减伤系数变化
    isImmune: boolean;        // 是否触发免疫
    immuneCold: boolean;      // 新增：是否免疫寒冷伤害
    immuneFire: boolean;      // 新增：是否免疫火焰伤害
    messages: string[];       // 提示消息
  } {
    const messages: string[] = [];
    let buffMultiplier = 0;
    let nerfMultiplier = 0;
    let isImmune = false;
    let immuneCold = false; // 新增
    let immuneFire = false; // 新增

    // 1. 校验目标是否拥有「猎手异形」技能
    if (!targetBoss.skills.includes('猎手异形')) {
      return null
    }

    // 2. 免疫检查（火焰或寒冷武器）
    const isFireDamage = weaponName === '焚烧枪';
    const isDragonBreathShotgun = weaponName === '龙息霰弹枪'
    const isColdDamage = weaponName === '零度之下';
    if (isFireDamage || isColdDamage) {
      isImmune = true;

      if (isFireDamage) {
        immuneFire = true; // 设置火焰免疫标记
      }
      if (isColdDamage) {
        immuneCold = true; // 设置寒冷免疫标记
      }

      messages.push(`🦖 【猎手异形】生效：免疫${isFireDamage ? '火焰' : '寒冷'}伤害`);
    }

    // 3. 计算其他存活异形数量（排除自己）
    const otherLivingAliens = activeBosses.filter(boss =>
      boss.name !== targetBoss.name &&
      boss.isActive
    ).length;

    // 4. 根据其他异形存活情况计算增减伤
    if (otherLivingAliens > 0) {
      // 存在其他异形：减伤20%
      nerfMultiplier = 0.2;
      messages.push(`🦖 【猎手异形】生效：存在其他存活异形，受到的伤害-20%`);
    } else {
      // 无其他异形：增伤20%
      buffMultiplier = 0.2;
      messages.push(`🦖 【猎手异形】生效：无其他存活异形，受到的伤害+20%`);
    }

    if (isDragonBreathShotgun) {
      immuneFire = true;
      nerfMultiplier += 0.2;
      messages.push(`🦖 【猎手异形】生效：免疫龙息霰弹枪造成的20%火焰伤害`);
    }

    return {
      buffMultiplier,
      nerfMultiplier,
      isImmune,
      immuneCold, // 新增返回标记
      immuneFire, // 新增返回标记
      messages
    };
  },

  // 狂暴处理（低生命减伤）
  handleRampage: function (
    targetBoss: any,
  ): {
    nerfMultiplier: number;   // 减伤系数变化
    messages: string[];       // 提示消息
  } {
    const messages: string[] = [];
    let nerfMultiplier = 0;

    // 1. 校验目标是否拥有「狂暴」技能
    if (!targetBoss.skills.includes('狂暴')) {
      return null
    }


    // 3. 检查生命值比例
    const maxHP = getMaxHPByName(targetBoss.name);

    const currentHP = targetBoss.HP;
    if (currentHP <= maxHP * 0.5) {
      // 生命值低于50%时触发50%减伤
      nerfMultiplier = 0.5;
      messages.push(`💥 【狂暴】生效：生命值≤50%，受到的伤害-50%`);
    }

    return { nerfMultiplier, messages };
  },

  // 伪装处理（记录武器并触发减伤）
  handleDisguise: function (
    targetBoss: any,
    weaponName: string,       // 造成伤害的武器名称
  ): {
    nerfMultiplier: number;   // 减伤系数变化
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let nerfMultiplier = 0;
    let targetUpdates = null;

    // 1. 校验目标是否拥有「伪装」技能
    if (!targetBoss.skills.includes('伪装')) {
      return null;
    }

    // 2. 获取当前记录的武器名称
    const lastWeapon = targetBoss.lastWeaponName || null;

    // 3. 检查是否触发减伤（与上次武器一致）
    if (lastWeapon && lastWeapon === weaponName) {
      // 触发80%减伤
      nerfMultiplier = 0.8;
      messages.push(`🎭 【伪装】生效：已适应武器「${weaponName}」，本次受到的伤害-80%`);

      // 触发后不记录当前武器（避免连续触发）
    } else {
      // 未触发减伤，记录新武器
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          lastWeaponName: weaponName // 记录当前武器
        } as Partial<BattleStatistics>
      };
      messages.push(`🎭 【伪装】生效：记录新武器「${weaponName}」`);
    }

    return {
      nerfMultiplier,
      messages,
      targetUpdates
    };
  },

  // 致命一击处理（概率免疫伤害）
  handleDeadlyHit: function (
    targetBoss: any,
  ): {
    isImmune: boolean;         // 是否免疫伤害
    messages: string[];       // 提示消息
  } {
    const messages: string[] = [];
    let isImmune = false;

    // 1. 校验目标是否拥有「致命一击」技能
    if (!targetBoss.skills.includes('致命一击')) {
      return null
    }

    // 3. 5%概率判定
    if (Math.random() < 0.05) {
      isImmune = true;
      messages.push(`💀 【致命一击】生效：5%概率免疫伤害`);
    }

    return { isImmune, messages };
  },

  /** 星界之风处理（概率群体回复）- 修正版 */
  handleAstralWind: function (
    targetBoss: any,
    activeBosses: any[],
    doubleChance: boolean // 是否双倍触发概率
  ): {
    messages: string[];
    otherUpdates: Array<{     // 所有boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    }>;
  } | null {
    const messages: string[] = [];
    const otherUpdates: Array<{ name: string; updates: Partial<BattleStatistics> }> = [];
    const baseHealAmount = 200;

    // 1. 校验目标是否拥有「星界之风」技能
    if (!targetBoss.skills.includes('星界之风')) {
      return null;
    }

    // 2. 根据心灵狂热状态调整概率
    const triggerProbability = doubleChance ? 0.10 : 0.05; // 双倍概率时为10%

    // 3. 概率判定
    if (Math.random() >= triggerProbability) {
      return null
    }

    // 4. 筛选所有存活异形（包括自己）
    const survivingBosses = activeBosses.filter(boss => boss.isActive);

    // 5. 为所有异形计算并准备回复数据
    survivingBosses.forEach(boss => {
      const bossName = boss.name;
      if (baseHealAmount > 0) {
        otherUpdates.push({
          name: bossName,
          updates: { hpChange: baseHealAmount }
        });
      }

      // 为每条消息单独记录（即使为0）
      messages.push(`🌬️ 【星界之风】触发：为「${bossName}」回复${baseHealAmount}点生命值`);
    });

    return {
      messages,
      otherUpdates
    };
  },

  /** 心灵狂热处理（低生命减伤和概率强化）- 修正版 */
  handleMindFrenzy: function (
    targetBoss: any,
  ): {
    nerfMultiplier: number;
    doubleAstralWind: boolean; // 星界之风触发概率翻倍标记
    messages: string[];
  } {
    const messages: string[] = [];
    let nerfMultiplier = 0;
    let doubleAstralWind = false;

    // 1. 校验目标是否拥有「心灵狂热」技能
    if (!targetBoss.skills.includes('心灵狂热')) {
      return null
    }

    // 3. 检查生命值比例
    const maxHP = getMaxHPByName(targetBoss.name);

    const hpPercent = targetBoss.HP / maxHP;

    // 4. 生命值低于50%时触发效果
    if (hpPercent <= 0.5) {
      nerfMultiplier = 0.2;
      doubleAstralWind = true;
      messages.push(`🧠 【心灵狂热】生效：生命值≤50%，受到的伤害-20%，「星界之风」触发概率翻倍`);
    }

    return { nerfMultiplier, doubleAstralWind, messages };
  },

  //宇宙能量
  handleCosmicEnergy: function (
    targetBoss: any,
    damage: number,      // 本次伤害值
  ): {
    messages: string[];
    targetUpdates: {     // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    // 1. 校验目标是否拥有「宇宙能量」技能
    if (!targetBoss.skills.includes('宇宙能量')) {
      return null;
    }

    // 2. 获取当前能量和最大能量值
    const maxEnergy = getMaxEnergyByName(targetBoss.name);
    const currentEnergy = targetBoss.energy || 0;

    // 3. 计算能量获取量
    const energyToAdd = damage;

    // 4. 无实际效果时直接返回
    if (energyToAdd <= 0) {
      return null;
    }

    // 5. 计算实际能量增加和溢出治疗
    let energyGained = 0;
    let overflowHeal = 0;

    if (currentEnergy + energyToAdd <= maxEnergy) {
      // 未溢出：全部转为能量
      energyGained = energyToAdd;
    } else {
      // 溢出：能量补满，溢出部分转治疗
      energyGained = maxEnergy - currentEnergy;
      overflowHeal = (currentEnergy + energyToAdd) - maxEnergy;
    }

    // 6. 无实际变化时直接返回（能量0且治疗0）
    if (energyGained <= 0 && overflowHeal <= 0) {
      return null;
    }

    // 7. 准备更新数据
    const messages: string[] = [];
    const updates: Partial<BattleStatistics> = {};
    let messageParts = [];

    // 8. 构建消息内容
    if (energyGained > 0) {
      messageParts.push(`获得${energyGained}点能量`);
      updates.energyChange = energyGained;
    }

    if (overflowHeal > 0) {
      messageParts.push(`${overflowHeal}点溢出伤害转为生命回复`);
      updates.hpChange = overflowHeal;
    }

    // 9. 拼接完整消息
    if (messageParts.length > 0) {
      messages.push(`🌌 【宇宙能量】生效：${messageParts.join('，')}`);
    }

    return {
      messages,
      targetUpdates: {
        name: targetBoss.name,
        updates
      }
    };
  },

  // 复苏 (修改后)
  handleRevival: function (
    targetBoss: any,
    damageAmount: number  // 新增：接收伤害值参数
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    if (!targetBoss.skills.includes('复苏')) {
      return null;
    }

    // 判断是否触发（伤害值 ≥ 当前HP）
    const isLethal = damageAmount >= targetBoss.HP;
    if (!isLethal) {
      return null;
    }

    // 计算回复值
    const maxHP = getMaxHPByName(targetBoss.name);
    const maxEnergy = getMaxEnergyByName(targetBoss.name);
    const healAmount = Math.round(maxHP * 0.6);
    const energyGain = maxEnergy; // 100%能量

    // 准备更新数据
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        hpChange: healAmount,         // 回复60%最大生命值
        energyChange: energyGain,     // 回复100%能量
        skillsRemoved: ['复苏'],       // 移除复苏技能
        skillsAdded: ['灵能构造炉']    // 添加新技能
      } as Partial<BattleStatistics>
    };

    messages.push(`🔥 【复苏】生效：承受致命伤害时免疫死亡，回复${healAmount}点生命值和${energyGain}点能量，获得「灵能构造炉」技能`);
    messages.push(`🔥 【复苏】技能移除`);

    return {
      messages,
      targetUpdates
    };
  },

  /** 光影之刃处理（层数叠加） */
  handleBladeOfLight: function (
    targetBoss: any,
  ): {
    messages: string[];
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;
    const maxStacks = 50;

    // 1. 校验目标是否拥有「光影之刃」技能
    if (!targetBoss.skills.includes('光影之刃')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 已达最大层数时不叠加
    if (currentStacks >= maxStacks) {
      return null
    }

    // 4. 准备增加一层的更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: 1
      } as Partial<BattleStatistics>
    };

    // 5. 记录提示信息
    const newStacks = currentStacks + 1;
    messages.push(`✨ 【光影之刃】生效：获得1层「光影之刃」`);

    return {
      messages,
      targetUpdates
    };
  },

  /** 远古预兆处理（概率免疫能量伤害）- 增加boost参数 */
  handleAncientOmen: function (
    targetBoss: any,
    weaponData: any,          // 武器数据，包含类型
  ): {
    isImmune: boolean;         // 是否免疫伤害
    messages: string[];        // 提示消息
    targetUpdates: {           // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let isImmune = false;
    let targetUpdates = null;

    // 1. 校验目标是否拥有「远古预兆」技能
    if (!targetBoss.skills.includes('远古预兆')) {
      return null;
    }

    // 2. 检查是否是非热能武器伤害
    if (weaponData.type === '热能武器') {
      return null;
    }

    //获取当前光影之刃层数
    const lightBladeStacks = targetBoss.skillStacks || 0;

    //每层提升0.5%概率
    const boostPerStack = 0.005;
    const totalBoost = lightBladeStacks * boostPerStack;

    // 3. 计算实际概率（基础1%+加成）
    const baseProbability = 0.01;
    const actualProbability = Math.min(baseProbability + totalBoost, 1); // 确保不超过100%

    // 4. 概率判定
    if (Math.random() >= actualProbability) {

      return null
    }

    // 5. 触发免疫和能量回复
    isImmune = true;
    const energyGained = 100;

    // 6. 准备更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        energyChange: energyGained // 回复100点能量
      } as Partial<BattleStatistics>
    };

    // 7. 记录提示信息
    messages.push(`🔮 【远古预兆】触发：${(actualProbability * 100).toFixed(2)}%概率免疫非热能武器伤害，并回复${energyGained}点能量`);

    return {
      isImmune,
      messages,
      targetUpdates
    };
  },

  /** 超视距穿梭处理（层数相关伤害调整） */
  handleHyperRangeShift: function (
    targetBoss: any,
  ): {
    nerfMultiplier: number;     // 减伤系数变化
    buffMultiplier: number;     // 增伤系数变化
    messages: string[];
  } {
    const messages: string[] = [];
    let nerfMultiplier = 0;
    let buffMultiplier = 0;

    // 1. 校验目标是否拥有「超视距穿梭」技能
    if (!targetBoss.skills.includes('超视距穿梭')) {
      return null
    }

    // 2. 获取目标能量百分比
    const currentEnergy = targetBoss.energy || 0;
    const maxEnergy = getMaxEnergyByName(targetBoss.name)
    const energyPercent = currentEnergy / maxEnergy;

    // 3. 根据能量状态计算层数效果
    if (energyPercent >= 0.6) {
      // 高能量：每层10%减伤
      nerfMultiplier = targetBoss.skillStacks * 0.1;
      messages.push(`🚀 【超视距穿梭】生效：能量值≥60%，受到的伤害-${(nerfMultiplier * 100).toFixed(0)}%`);
    } else if (energyPercent >= 0.3) {
      // 中能量：每层5%减伤
      nerfMultiplier = targetBoss.skillStacks * 0.05;
      messages.push(`🚀 【超视距穿梭】生效：能量值≥30%，受到的伤害-${(nerfMultiplier * 100).toFixed(0)}%`);
    } else if (energyPercent <= 0.1) {
      // 低能量：每层5%增伤
      buffMultiplier = targetBoss.skillStacks * 0.05;
      messages.push(`🚀 【超视距穿梭】生效：能量值≤10%，受到的伤害+${(buffMultiplier * 100).toFixed(0)}%`);
    }

    return { nerfMultiplier, buffMultiplier, messages };
  },

  /** 灵能构造炉处理（随机获得技能）- 增加boost参数 */
  handlePsychicForge: function (
    targetBoss: any,
  ): {
    messages: string[];       // 提示消息
    newSkill: string | null;  // 获得的新技能名称
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let newSkill: string | null = null;
    let targetUpdates = null;

    const possibleSkills = [
      '天启超载护盾',
      '塌缩脉冲',
      '地毯式轰炸',
      '轰炸引导'
    ];

    // 1. 校验目标是否拥有「灵能构造炉」技能
    if (!targetBoss.skills.includes('灵能构造炉')) {
      return null;
    }

    // 2. 基础概率+加成值
    const baseProbability = 0.05;

    // 3. 概率判定
    if (Math.random() >= baseProbability) {
      return null
    }

    // 4. 排除目标已有的技能
    const availableSkills = possibleSkills.filter(
      skill => !targetBoss.skills.includes(skill)
    );

    // 5. 如果没有可用技能则不触发获取
    if (availableSkills.length === 0) {
      return null
    }

    // 6. 从可用技能中随机选择
    newSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];

    // 7. 准备更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillsAdded: [newSkill]
      } as Partial<BattleStatistics>
    };

    messages.push(`⚙️ 【灵能构造炉】触发：${(baseProbability * 100).toFixed(2)}%概率获得新技能「${newSkill}」`);

    return {
      messages,
      newSkill,
      targetUpdates
    };
  },

  // 修改后的天启超载护盾处理函数
  handleOverdriveShield: function (
    targetBoss: any,
    activeBosses: any[]
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据（消耗层数）
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    otherUpdates: Array<{     // 其他boss更新数据（生命回复）
      name: string;
      updates: Partial<BattleStatistics>;
    }>;
  } | null {
    const messages: string[] = [];
    const otherUpdates: Array<{ name: string; updates: Partial<BattleStatistics> }> = [];

    // 1. 校验目标是否拥有「天启超载护盾」技能
    if (!targetBoss.skills.includes('天启超载护盾')) {
      return null;
    }

    // 2. 10%概率判定
    if (Math.random() >= 0.1) {
      return null;
    }

    // 3. 计算消耗的层数（当前层数的一半，向下取整）
    const currentStacks = targetBoss.skillStacks || 0;
    const consumedStacks = Math.floor(currentStacks / 2); // 核心修改：消耗一半层数

    // 没有层数可消耗时直接返回
    if (consumedStacks <= 0) {
      return null;
    }

    // 4. 筛选所有存活异形（包括自己）
    const survivingBosses = activeBosses.filter(boss => boss.isActive);

    messages.push(`🛡️ 【天启超载护盾】触发：消耗${consumedStacks}层「光影之刃」`);

    // 5. 为所有异形计算并准备回复数据（基于消耗的层数）
    survivingBosses.forEach(boss => {
      const healAmount = consumedStacks * 10; // 核心修改：基于消耗的层数计算回复值
      otherUpdates.push({
        name: boss.name,
        updates: { hpChange: healAmount }
      });
      messages.push(`为「${boss.name}」回复${healAmount}点生命值`);
    });

    // 6. 准备层数消耗的更新数据
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: -consumedStacks // 消耗层数
      } as Partial<BattleStatistics>
    };

    return {
      messages,
      targetUpdates,
      otherUpdates
    };
  },

  /** 塌缩脉冲处理（额外叠加层数） */
  handleCollapsingPulse: function (
    targetBoss: any,
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;
    const maxStacks = 50;

    // 1. 校验目标是否拥有「塌缩脉冲」技能
    if (!targetBoss.skills.includes('塌缩脉冲')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 检查是否达到最大层数
    if (currentStacks >= maxStacks) {
      return null
    }

    // 4. 准备增加一层的更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: 1
      } as Partial<BattleStatistics>
    };

    // 5. 记录提示信息
    const newStacks = currentStacks + 1;
    messages.push(`🌀 【塌缩脉冲】生效：额外获得1层「光影之刃」`);

    return {
      messages,
      targetUpdates
    };
  },

  /** 地毯式轰炸处理 */
  handleCarpetBombing: function (
    targetBoss: any,
  ): {
    nerfMultiplier: number;     // 减伤系数
    messages: string[];
    tempMark: boolean;           // 新增：临时标记（防止触发孤立无援）
  } {
    const messages: string[] = [];
    let nerfMultiplier = 0;

    // 1. 校验目标是否拥有「地毯式轰炸」技能
    if (!targetBoss.skills.includes('地毯式轰炸')) {
      return null
    }

    // 3. 触发减伤
    nerfMultiplier = 0.8;

    messages.push(`💣 【地毯式轰炸】生效：受到的伤害-80%`);

    return { nerfMultiplier, messages, tempMark: true };
  },

  // 修改后的轰炸引导处理函数
  handleBombardmentGuide: function (
    targetBoss: any,
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据（消耗层数+回复能量）
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    // 1. 校验目标是否拥有「轰炸引导」技能
    if (!targetBoss.skills.includes('轰炸引导')) {
      return null;
    }

    // 2. 10%概率判定
    if (Math.random() >= 0.1) {
      return null;
    }

    // 3. 计算消耗的层数（当前层数的一半，向下取整）
    const currentStacks = targetBoss.skillStacks || 0;
    const consumedStacks = Math.floor(currentStacks / 2); // 核心修改：消耗一半层数

    // 没有层数可消耗时直接返回
    if (consumedStacks <= 0) {
      return null;
    }

    // 4. 计算能量回复值（基于消耗的层数）
    const energyGained = consumedStacks * 10;

    // 5. 准备更新数据（消耗层数+回复能量）
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: -consumedStacks, // 消耗层数
        energyChange: energyGained          // 回复能量
      } as Partial<BattleStatistics>
    };

    // 6. 记录提示信息
    messages.push(`🎯 【轰炸引导】触发：消耗${consumedStacks}层「光影之刃」，获得${energyGained}点能量`);

    return {
      messages,
      targetUpdates
    };
  },

  // 统一的辐射效果处理函数
  handleRadiationEffect: function (
    targetBoss: any,
    weaponName: string,
    equippedWeapon: any,
  ): {
    messages: string[];
    targetUpdates: { name: string; updates: Partial<BattleStatistics> } | null;
    armorReduction: number;
    layerAdded: boolean;
  } | null {
    const messages: string[] = [];
    let layerAdded = false;

    // 1. 获取当前辐射层数
    const currentLayers = targetBoss.radiationLayers || 0;

    // 2. 计算护甲削减值（基于当前层数）
    const armorReduction = currentLayers * 0.05;

    // 3. 添加护甲削减效果消息
    if (currentLayers > 0) {
      messages.push(`☢️ 【辐射】：当前${currentLayers}层，护甲值减少${armorReduction.toFixed(2)}`);
    }

    // 4. 检查是否需要增加层数
    let targetUpdates = null;

    if (
      weaponName === '伽马枪' &&
      !targetBoss.tags.includes('机械') &&
      targetBoss.tags.includes('生物')
    ) {
      // 5. 检查是否装备辐射充能核心模组
      const hasRadiationCore = equippedWeapon.installedMods?.includes('辐射充能核心')
      const layerIncrement = hasRadiationCore ? 2 : 1;

      // 6. 准备层数更新数据
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          radiationLayersChange: layerIncrement,
        } as Partial<BattleStatistics>
      };

      // 7. 添加层数增加消息
      messages.push(
        `☢️ 【伽马枪】武器效果：获得${layerIncrement}层「辐射」并削减${(layerIncrement * 0.05).toFixed(2)}护甲值`
      );

      layerAdded = true;
    }

    return {
      messages,
      targetUpdates,
      armorReduction,
      layerAdded
    };
  },

  // 统一的寒冷效果处理函数
  handleColdEffect: function (
    targetBoss: any,
    weaponName: string,
    equippedWeapon: any, // 新增装备武器参数
    isImmuneCold: boolean,  // 新增免疫标记参数
  ): {
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    buffMultiplier: number;
    layerAdded: boolean;
  } | null {

    // 如果免疫寒冷，直接返回空并给出提示
    if (isImmuneCold) {
      return null
    }

    if (targetBoss.skills.includes('冰霜进化') || targetBoss.skills.includes('猎手异形')) {
      return null
    }

    const messages: string[] = [];
    let layerAdded = false;

    // 1. 获取当前寒冷层数
    const currentLayers = targetBoss.coldLayers || 0;

    // 2. 计算增伤系数（基于当前层数）
    const effectiveLayers = Math.min(currentLayers, 100);
    const buffMultiplier = effectiveLayers * 0.01;

    // 3. 添加增伤效果消息（只要有层数就显示）
    if (effectiveLayers > 0) {
      messages.push(`❄️ 【寒冷】：当前${currentLayers}层，受到的伤害+${(effectiveLayers * 1).toFixed(1)}%`);

      if (currentLayers > 100) {
        //messages.push(`❄️ 注意：超过100层的寒冷不会提供额外增伤`);
      }
    }

    // 4. 检查是否需要增加层数
    let targetUpdates = null;
    let layerIncrement = 0; // 初始化层数增量

    if (
      weaponName === '零度之下' // 使用零度之下的武器
    ) {
      // 5. 检查是否装备氮气压缩核心模组
      const hasNitrogenCore = equippedWeapon.installedMods?.includes('氮气压缩核心');
      layerIncrement = hasNitrogenCore ? 2 : 1; // 双倍层数

      // 6. 准备层数更新数据
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          coldLayersChange: layerIncrement // 使用计算后的增量
        } as Partial<BattleStatistics>
      };

      // 7. 添加层数增加消息
      messages.push(`❄️【零度之下】武器效果：获得${layerIncrement}层「寒冷」`);

      // 设置层数增加标记
      layerAdded = true;
    }

    return {
      messages,
      targetUpdates,
      buffMultiplier,
      layerAdded
    };
  },

  // 统一的武器能量消耗处理函数（已添加模组检测）
  handleWeaponEnergyDrain: function (
    targetBoss: any,
    weaponName: string,
    maxStatsForTarget: any,
    equippedWeapon: any  // 新增参数：当前装备的武器对象
  ): {
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    success: boolean;
    drainFactor: number;
  } | null {
    // 定义武器能量消耗映射
    const weaponEnergyDrain: Record<string, number> = {
      '弧焊枪': 200,
      'DG-3电弧步枪': 500
    };

    const targetmaxEnergy = maxStatsForTarget.maxEnergy;

    // 检查是否是需要消耗能量的武器
    let drainValue = weaponEnergyDrain[weaponName];
    if (!drainValue || targetmaxEnergy === 0) {
      return null;
    }

    const messages: string[] = [];

    // 检测是否安装了高压电池模组（双倍效果）
    const hasHighVoltageBattery = equippedWeapon.installedMods?.includes('高压电池');
    if (hasHighVoltageBattery && weaponName === '弧焊枪') {
      drainValue *= 2; // 双倍消耗
    }

    const success = drainValue > 0; // 成功消耗能量标记

    // 准备更新数据（无论是否消耗能量都返回，但只在实际消耗时有更新数据）
    let targetUpdates = null;
    if (success) {
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          energyChange: -drainValue // 消耗能量（负值）
        } as Partial<BattleStatistics>
      };
    }

    const drainFactor = drainValue / 100

    // 添加提示信息
    const weaponDisplayName = weaponName === '弧焊枪' ? '弧焊枪' : 'DG-3电弧步枪';
    let effectDescription = `消耗${drainValue}点能量`;

    // 添加模组效果提示
    if (hasHighVoltageBattery && weaponName === '弧焊枪') {
      //effectDescription += '（高压电池：双倍效果）';
    }

    if (success) {
      messages.push(`⚡ 【${weaponDisplayName}】武器效果：${effectDescription}`);
    }

    return {
      messages,
      targetUpdates,
      success,
      drainFactor
    };
  },

  // 统一的武器层数减少处理函数（已添加模组检测）
  handleWeaponLayerReduction: function (
    targetBoss: any,
    weaponName: string,
    maxStatsForTarget: any,
    equippedWeapon: any  // 新增参数：当前装备的武器对象
  ): {
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    reductionSuccess: boolean;
    reductionAmount: number;
  } | null {
    // 定义武器层数减少映射
    const weaponLayerReduction: Record<string, number> = {
      '脉冲扰乱枪': 2
    };

    const maxStacks = maxStatsForTarget.maxStacks;

    // 检查是否是支持减少层数的武器
    let reductionAmount = weaponLayerReduction[weaponName];
    if (!reductionAmount || maxStacks === 0) {
      return null;
    }

    const messages: string[] = [];

    // 检测是否安装了脉冲稳定核心模组（双倍效果）
    const hasStabilizationCore = equippedWeapon.installedMods?.includes('脉冲稳定核心');
    if (hasStabilizationCore && weaponName === '脉冲扰乱枪') {
      reductionAmount *= 2; // 双倍减少
    }

    const reductionSuccess = reductionAmount > 0;

    // 准备更新数据
    let targetUpdates = null;
    if (reductionSuccess) {
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          skillStacksChanged: -reductionAmount
        } as Partial<BattleStatistics>
      };
    }

    // 添加提示信息
    let effectDescription = `技能层数减少${reductionAmount}层`;

    // 添加模组效果提示
    if (hasStabilizationCore && weaponName === '脉冲扰乱枪') {
      //effectDescription += '（脉冲稳定核心：双倍效果）';
    }

    if (reductionSuccess) {
      messages.push(`⚡ 【${weaponName}】武器效果：${effectDescription}`);
    }

    return {
      messages,
      targetUpdates,
      reductionSuccess,
      reductionAmount
    };
  },

  handleToxicSaliva: function (
    targetBoss: any
  ): {
    nerfMultiplier: number;
    messages: string[];
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;
    let nerfMultiplier = 0;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('毒性唾液')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;
    const maxStacks = 20;

    // 计算减伤系数（每层5%）
    nerfMultiplier = currentStacks * 0.05;

    // 仅在层数大于0时显示减伤消息
    if (currentStacks > 0) {
      messages.push(`🧪 【毒性唾液】生效：当前${currentStacks}层，使受到的伤害-${(nerfMultiplier * 100).toFixed(0)}%`);
    }

    // 3. 处理新增层数
    if (currentStacks < maxStacks) {
      const newStacks = currentStacks + 1;
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          skillStacksChanged: 1
        } as Partial<BattleStatistics>
      };
      messages.push(`🧪 【毒性唾液】生效：获得一层「毒性唾液」`);
    }

    return {
      nerfMultiplier,
      messages,
      targetUpdates
    };
  },

  /**
   * 剧毒狂暴处理（低生命额外减伤和叠层）
   * 效果：生命值≤50%时，受击额外获得1层「毒性唾液」且受到的伤害降低
   */
  handleToxicFrenzy: function (
    targetBoss: any
  ): {
    nerfMultiplier: number;   // 额外减伤系数
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据（额外叠层）
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;
    let nerfMultiplier = 0;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('剧毒狂暴')) {
      return null;
    }

    // 2. 获取当前生命值百分比
    const maxHP = getMaxHPByName(targetBoss.name);
    const currentHP = targetBoss.HP;
    const hpPercent = currentHP / maxHP;

    // 3. 判断是否触发（生命值≤50%）
    if (hpPercent > 0.5) {
      return null;
    }

    // 4. 获取当前毒性唾液层数
    const currentStacks = targetBoss.skillStacks || 0;
    const maxStacks = 20;

    // 6. 提供额外减伤
    nerfMultiplier = 0.2;
    messages.push(`💥 【剧毒狂暴】生效：生命值≤50%，受到的伤害额外降低20%`);

    // 5. 检查是否可以额外叠加层数
    if (currentStacks < maxStacks) {
      targetUpdates = {
        name: targetBoss.name,
        updates: {
          skillStacksChanged: 1 // 额外叠加1层
        } as Partial<BattleStatistics>
      };
      messages.push(`💥 【剧毒狂暴】生效：额外获得1层「毒性唾液」`);
    }


    return {
      nerfMultiplier,
      messages,
      targetUpdates
    };
  },

  /**
   * 毒气波处理（概率获得多层层数）
   * 效果：受击时有20%概率额外获得5层「毒性唾液」
   */
  handleToxicGasWave: function (
    targetBoss: any
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('毒气波')) {
      return null;
    }

    // 2. 20%概率判定
    if (Math.random() >= 0.2) {
      return null;
    }

    // 3. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;
    const maxStacks = 20;

    // 4. 计算实际可添加的层数（不超过上限）
    const addAmount = Math.min(5, maxStacks - currentStacks);

    if (addAmount <= 0) {
      return null
    }

    // 5. 准备更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: addAmount
      } as Partial<BattleStatistics>
    };

    // 6. 记录提示信息
    messages.push(`🌫️ 【毒气波】触发：20%概率获得5层「毒性唾液」`);

    return {
      messages,
      targetUpdates
    };
  },

  /**
   * 淬毒撕咬处理（层数治疗效果）
   * 效果：根据毒性唾液层数，在受击时回复生命值
   */
  handlePoisonedBite: function (
    targetBoss: any
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('淬毒撕咬')) {
      return null;
    }

    // 2. 获取当前层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 根据层数决定回复量
    let healAmount = 0;
    if (currentStacks >= 15) {
      healAmount = 150;
    } else if (currentStacks >= 10) {
      healAmount = 100;
    } else if (currentStacks >= 5) {
      healAmount = 50;
    }

    // 没有达到最低层数不触发
    if (healAmount === 0) {
      return null;
    }

    // 4. 准备更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        hpChange: healAmount // 回复生命值
      } as Partial<BattleStatistics>
    };

    // 5. 记录提示信息
    messages.push(`🦷 【淬毒撕咬】触发：回复${healAmount}点生命值`);

    return {
      messages,
      targetUpdates
    };
  },

  /**
 * 酸蚀池处理（循环抗性）
 * 效果：受击时按顺序循环选择三种酸池（1->2->3->1），提供特定武器类型减伤和增伤
 */
  handleAcidPool: function (
    targetBoss: any,
    weaponData: any, // 武器类型：实弹/能量/热能
    enhanced: boolean   // 是否处于剧毒突袭强化状态
  ): {
    nerfMultiplier: number;   // 减伤系数
    buffMultiplier: number;   // 增伤系数
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } {
    const messages: string[] = [];
    let nerfMultiplier = 0;
    let buffMultiplier = 0;
    let targetUpdates = null;
    let nextAcidType = 0;

    const weaponType = weaponData.type;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('酸蚀池')) {
      return { nerfMultiplier, buffMultiplier, messages, targetUpdates };
    }

    // 2. 获取当前酸池类型
    let acidType = targetBoss.skillStatus || 0;

    // 3. 如果没有存储过酸池类型，设置为1（首次触发）
    if (acidType === 0) {
      acidType = 1;
    }

    // 4. 设置下次将使用的酸池类型
    if (acidType === 3) {
      nextAcidType = -2;
    } else if (targetBoss.skillStatus === 0) {
      nextAcidType = 2;
    } else {
      nextAcidType = 1;
    }

    // 准备更新数据（设置下次酸池类型）
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStatusChanged: nextAcidType // 存储下次使用的酸池类型
      } as Partial<BattleStatistics>
    };

    // 5. 根据酸池类型处理效果
    let acidName = "";
    let resistType = "";
    let vulnerableType = "";

    switch (acidType) {
      case 1: // 脓蚀酸池
        acidName = "脓蚀酸池";
        resistType = "实弹武器";
        vulnerableType = "能量武器";
        break;
      case 2: // 蚀骨酸池
        acidName = "蚀骨酸池";
        resistType = "能量武器";
        vulnerableType = "热能武器";
        break;
      case 3: // 焦熔酸池
        acidName = "焦熔酸池";
        resistType = "热能武器";
        vulnerableType = "实弹武器";
        break;
    }

    messages.push(`🛢️ 本次触发的【酸蚀池】：${acidName}`);

    // 6. 检查是否强化状态（剧毒突袭）
    if (enhanced) {
      // 强化效果：完全免疫对应的抗性类型伤害，移除对应的易伤效果
      if (weaponType === resistType) {
        nerfMultiplier = 1;
        messages.push(`💪 【酸蚀池·强化】生效：受到${resistType}伤害-100%`);
      } else if (weaponType === vulnerableType) {
        // 强化状态下
        buffMultiplier = 1;
        messages.push(`💪 【酸蚀池·强化】生效：受到${vulnerableType}伤害+100%`);
      }
    } else {
      // 普通效果：80%减伤对应类型，50%增伤另一种类型
      if (weaponType === resistType) {
        nerfMultiplier = 0.5; // 50%减伤
        messages.push(`🛢️ 【酸蚀池】生效：受到${resistType}伤害-50%`);
      } else if (weaponType === vulnerableType) {
        buffMultiplier = 0.5; // 50%增伤
        messages.push(`🛢️ 【酸蚀池】生效：受到${vulnerableType}伤害+50%`);
      }
    }

    return {
      nerfMultiplier,
      buffMultiplier,
      messages,
      targetUpdates
    };
  },

  /**
   * 剧毒突袭处理
   * 效果：毒性唾液≥20层时，消耗所有层数并使强化下5次触发的「酸蚀池」
   */
  handleToxicAssault: function (
    targetBoss: any
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let targetUpdates = null;

    // 1. 校验技能是否存在
    if (!targetBoss.skills.includes('剧毒突袭')) {
      return null;
    }

    // 2. 检查层数是否≥20
    const currentStacks = targetBoss.skillStacks || 0;
    if (currentStacks < 20) {
      return null;
    }

    // 3. 获取当前强化次数（存储在statusLayers）
    const currentAssaultCount = targetBoss.statusLayers || 0;
    const addAssaultCount = 5;

    // 4. 准备更新数据
    targetUpdates = {
      name: targetBoss.name,
      updates: {
        skillStacksChanged: -currentStacks, // 清空毒性唾液层数
        statusLayersChanged: addAssaultCount // 增加强化次数
      } as Partial<BattleStatistics>
    };

    // 5. 记录提示信息
    const newAssaultCount = currentAssaultCount + addAssaultCount;
    messages.push(`☠️ 【剧毒突袭】触发：消耗20层「毒性唾液」，强化下${newAssaultCount}次「酸蚀池」`);

    return {
      messages,
      targetUpdates
    };
  },

  // 虫巢思维 - 每有一只巢穴子代，减伤20%
  handleHiveMind: function (
    targetBoss: any,
    activeBosses: any[],
    nestlingNames: string[] = ['巢穴雷兽', '巢穴战士', '巢穴甲虫']
  ) {
    if (targetBoss.name.includes('巢穴雷兽') || targetBoss.name.includes('巢穴战士') || targetBoss.name.includes('巢穴甲虫')) {
      return {
        buffMultiplier: 0.2,
        messages: [`🐛 【虫巢思维】生效：受到的伤害+20%`]
      }
    }

    if (!targetBoss.skills.includes('虫巢思维')) return null;

    // 计算存活的巢穴子代数量
    const livingNestlings = activeBosses.filter(boss =>
      boss.isActive && nestlingNames.includes(boss.name)
    ).length;

    if (livingNestlings === 0) return null;

    const nerfMultiplier = livingNestlings * 0.2;
    const messages = [`🐛 【虫巢思维】生效：存在${livingNestlings}只巢穴子代，受到的伤害-${Math.round(nerfMultiplier * 100)}%`];

    return { nerfMultiplier, messages };
  },

  // 爆虫伏击 - 血量低于50%时，立即孵化巢穴子代直至上限（生效后移除）
  handleBurrowAmbush: function (
    targetBoss: any,
    activeBosses: any[],
    nestlingNames: string[] = ['巢穴雷兽', '巢穴战士', '巢穴甲虫']
  ) {
    if (!targetBoss.skills.includes('爆虫伏击')) return null;

    const maxHP = getMaxHPByName(targetBoss.name);
    const hpPercent = targetBoss.HP / maxHP;

    if (hpPercent >= 0.5) return null;

    // 获取当前已存在的巢穴子代类型
    const existingTypes = activeBosses
      .filter(boss => boss.isActive && nestlingNames.includes(boss.name))
      .map(boss => boss.name);

    // 确定需要孵化的类型（每种最多1只）
    const needSpawn = nestlingNames.filter(name =>
      !existingTypes.includes(name) // 当前尚未存在
    );

    if (needSpawn.length === 0) {
      // 所有子代都已存在
      return {
        messages: [
          '🕳️ 【爆虫伏击】触发：生命值≤50%，但所有巢穴子代已存在，无需孵化',
          '🕳️ 【爆虫伏击】技能移除'
        ],
        targetUpdates: {
          name: targetBoss.name,
          updates: { skillsRemoved: ['爆虫伏击'] }
        }
      };
    }

    // 构建消息和标记数组
    const spawnMessages = needSpawn.map(name =>
      `🕳️ 【爆虫伏击】触发：孵化1只${name}`
    );
    spawnMessages.push('🕳️ 【爆虫伏击】技能移除');

    return {
      messages: spawnMessages,
      targetUpdates: {
        name: targetBoss.name,
        updates: { skillsRemoved: ['爆虫伏击'] }
      },
      spawnNewBossMark: needSpawn // 返回需要孵化的子代名称数组
    };
  },

  // 虚弱喷吐 - 孵化场存活时减伤80%，死亡时增伤20%
  handleWeakeningSpit: function (
    targetBoss: any,
    activeBosses: any[]
  ) {
    if (!targetBoss.skills.includes('虚弱喷吐')) return null;

    // 检查是否有孵化场存活
    const hatcheryExists = activeBosses.some(boss =>
      boss.name === '孵化场' && boss.isActive
    );

    let effect = null;

    if (hatcheryExists) {
      effect = { nerfMultiplier: 0.8, messages: ['🤢 【虚弱喷吐】生效：孵化场存活，受到的伤害-80%'] };
    } else {
      effect = { buffMultiplier: 0, messages: [] };
    }

    return effect;
  },

  handleHealingSwarm: function (
    targetBoss: any,          // 当前目标Boss对象
    activeBosses: any[]       // 全局活跃Boss列表（从数据库查询）
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    };
    otherUpdates: Array<{     // 其他boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    }>;
  } | null {
    // 1. 检查技能是否存在
    if (!targetBoss.skills.includes('治愈虫群')) {
      return null;
    }

    // 2. 获取最大生命值和当前生命值
    const maxHP = getMaxHPByName(targetBoss.name);
    const currentHP = targetBoss.HP;

    // 3. 检查生命值比例是否≤30%
    const hpPercent = currentHP / maxHP;
    if (hpPercent > 0.3) {
      return null;
    }

    const messages: string[] = [];
    const otherUpdates: Array<{ name: string; updates: Partial<BattleStatistics> }> = [];

    // 4. 计算自身回复量（40%最大生命值）
    const selfHealAmount = Math.round(maxHP * 0.4);
    messages.push(`💫 【治愈虫群】触发：生命值≤30%，自身回复${selfHealAmount}点生命值`);
    messages.push(`💫 【治愈虫群】技能移除`);

    // 5. 为目标Boss准备更新数据（回复+移除技能）
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        hpChange: selfHealAmount,
        skillsRemoved: ['治愈虫群'] // 移除技能
      } as Partial<BattleStatistics>
    };

    // 6. 筛选所有存活的其他异形（排除自身）
    const otherSurvivingBosses = activeBosses.filter(boss =>
      boss.isActive && boss.name !== targetBoss.name
    );

    // 7. 为每个存活异形计算回复量并准备更新数据
    otherSurvivingBosses.forEach(otherBoss => {
      const otherMaxHP = getMaxHPByName(otherBoss.name);
      const healAmount = Math.round(otherMaxHP * 0.1);

      if (healAmount > 0) {
        otherUpdates.push({
          name: otherBoss.name,
          updates: { hpChange: healAmount }
        });

        messages.push(`💫 「${otherBoss.name}」回复${healAmount}点生命值`);
      }
    });

    return {
      messages,
      targetUpdates,
      otherUpdates
    };
  },

  // 释放信息素 - 所有存活巢穴子代减伤20%
  handleReleasePheromones: function (
    targetBoss: any,
  ) {
    if (!targetBoss.name.includes('巢穴雷兽') && !targetBoss.name.includes('巢穴战士') && !targetBoss.name.includes('巢穴甲虫') && !targetBoss.name.includes('孵化场') && !targetBoss.name.includes('虫群女王')) return null;

    const messages = [`🌬️ 【释放信息素】生效：受到的伤害-20%`];

    const nerfMultiplier = 0.2

    return { messages, nerfMultiplier };
  },

  // 恐吓尖啸 - 每受到10次攻击，无巢穴子代时孵化1只
  handleTerrifyingScreech: function (
    targetBoss: any,
    activeBosses: any[],
    nestlingNames: string[] = ['巢穴雷兽', '巢穴战士', '巢穴甲虫']
  ) {
    if (!targetBoss.skills.includes('恐吓尖啸')) return null;

    // 初始化或增加攻击计数器
    const currentCount = targetBoss.statusLayers || 0;

    // 未达到10次攻击
    if (currentCount < 10) {
      // 4. 准备更新数据
      return {
        targetUpdates: {
          name: targetBoss.name,
          updates: { statusLayersChanged: 1 }
        } as Partial<BattleStatistics>,
        messages: [`😱 【恐吓尖啸】生效：获得一层恐吓尖啸`]
      };
    }

    // 检查是否有巢穴子代存活
    const nestlingsExist = activeBosses.some(boss =>
      boss.isActive && nestlingNames.includes(boss.name)
    );

    if (nestlingsExist) {
      return {
        targetUpdates: {
          name: targetBoss.name,
          updates: { statusLayersChanged: -10 } // 重置计数器
        } as Partial<BattleStatistics>,
        messages: []
      };
    }

    // 随机选择一种巢穴子代
    const randomBossName = nestlingNames[Math.floor(Math.random() * nestlingNames.length)];

    return {
      targetUpdates: {
        name: targetBoss.name,
        updates: { statusLayersChanged: -10 } // 重置计数器
      } as Partial<BattleStatistics>,
      messages: [`😱 【恐吓尖啸】触发：无巢穴子代存活，需要孵化1只${randomBossName}`],
      spawnNewBossMark: randomBossName // 返回生成标记
    };
  },

  // 孵化 - 每受到10次攻击，无巢穴子代时孵化1只
  handleHatching: function (
    targetBoss: any,
    activeBosses: any[],
    nestlingNames: string[] = ['巢穴雷兽', '巢穴战士', '巢穴甲虫']
  ) {
    // 检查是否拥有"孵化"技能
    if (!targetBoss.skills.includes('孵化')) return null;

    // 初始化或增加孵化专用计数器
    const currentCount = targetBoss.statusLayers || 0;

    // 未达到10次攻击
    if (currentCount < 10) {
      return {
        targetUpdates: {
          name: targetBoss.name,
          updates: { statusLayersChanged: 1 }
        },
        messages: [`🥚 【孵化】生效：获得一层孵化`]
      };
    }

    // 检查是否有巢穴子代存活
    const hasNestlings = activeBosses.some(boss =>
      boss.isActive && nestlingNames.includes(boss.name)
    );

    if (hasNestlings) {
      return {
        targetUpdates: {
          name: targetBoss.name,
          updates: { statusLayersChanged: -10 } // 重置计数器
        },
        messages: []
      };
    }

    // 随机选择一种巢穴子代
    const randomBossName = nestlingNames[Math.floor(Math.random() * nestlingNames.length)];

    return {
      targetUpdates: {
        name: targetBoss.name,
        updates: { statusLayersChanged: -10 } // 重置计数器
      },
      messages: [`🥚 【孵化】触发：成功孵化1只${randomBossName}`],
      spawnNewBossMark: randomBossName
    };
  },

  // 增强后的脉冲步枪及动力钻头特殊效果处理
  handlePulseRifleEffect: function (
    weaponName: string,
    targetBoss: any,
    equippedWeapon: any,
  ): {
    pulseGrenadeTriggered: boolean;
    targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    messages: string[];
  } {
    const messages: string[] = [];
    let targetUpdates = null;
    let pulseGrenadeTriggered: boolean = false;

    // 处理 M4AE 脉冲步枪效果 - 护甲削减改为100%触发
    if (weaponName === 'M4AE脉冲步枪') {
      // 100%概率触发护甲削减
      const armorReduction = 2;
      targetUpdates = {
        name: targetBoss.name,
        updates: { armorChange: armorReduction }
      };
      messages.push(`💥 【脉冲榴弹】触发：削减目标0.2点护甲值`);

      // 33%概率触发额外伤害
      if (Math.random() < 0.33) {
        pulseGrenadeTriggered = true;
        messages.push(`💥 【脉冲榴弹】额外效果：本次攻击造成额外50%伤害！`);
      }
    }
    // 处理动力钻头+强力钻刺核心效果 - 保持不变
    else if (weaponName === '动力钻头' && equippedWeapon.installedMods?.includes('强力钻刺核心')) {
      targetUpdates = {
        name: targetBoss.name,
        updates: { armorChange: 1 }
      };
      messages.push(`⚡ 【强力钻刺核心】触发：动力钻头穿透装甲，削减目标0.1点护甲值`);
    }
    // 其他武器不触发效果
    else {
      return null
    }

    return {
      pulseGrenadeTriggered,
      targetUpdates,
      messages
    };
  },

  // 核聚变重炮特殊效果处理
  handleFusionCannonEffect: function (
    weaponName: string,
    equippedWeapon: any,
  ): {
    fusionExplosionTriggered: boolean;  // 重命名的触发标记
    messages: string[];
  } {
    const messages: string[] = [];
    let fusionExplosionTriggered: boolean = false;  // 修改为核聚变爆炸标记

    // 1. 检查武器类型
    if (weaponName !== '核聚变重炮') return null;  // 修改武器名称

    const currentCombo = equippedWeapon?.comboCount || 0;

    const fusionTriggerProbability = 0.20 + (currentCombo * 0);

    // 2. 20%概率触发特殊效果
    if (Math.random() < fusionTriggerProbability) {  // 概率调整为20%

      fusionExplosionTriggered = true;

      // 4. 修改效果描述文本
      messages.push(`💥 【核聚变爆炸】触发：额外造成50%伤害`);

      return {
        fusionExplosionTriggered,
        messages
      };
    }

    // 5. 未触发效果时返回null
    return null;
  },

  // 在 BattleEffectProcessor 对象中添加以下函数
  handleBurnEffect: function (
    targetBoss: any,          // 当前目标Boss对象
    weaponName: string,       // 武器名称
    equippedWeapon: any,       // 新增：当前装备的武器对象
    isImmuneFire: boolean,
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    burnLayerAdded: boolean;   // 燃烧层数是否成功叠加
  } | null {
    const messages: string[] = [];
    let burnLayerAdded = false;

    if (isImmuneFire) {
      return null;
    }

    // 1. 检查是否是指定的燃烧武器
    const isBurnWeapon = weaponName === '焚烧枪' || weaponName === '龙息霰弹枪';
    if (!isBurnWeapon) {
      return null;
    }

    // 新增：计算燃烧层数（检查助燃核心模组）
    let burnLayers = 1; // 基础叠层
    if (weaponName === '龙息霰弹枪') {
      burnLayers = 2;  // 龙息霰弹枪基础叠加2层
    }
    if (equippedWeapon && equippedWeapon.installedMods?.includes('助燃核心')) {
      burnLayers = 2; // 模组效果：双倍叠层
    }

    // 4. 准备更新数据
    const targetUpdates = {
      name: targetBoss.name,
      updates: {
        burnLayersChanged: burnLayers // 动态燃烧层数
      } as Partial<BattleStatistics>
    };

    burnLayerAdded = true;

    // 5. 记录提示信息（区分模组效果）
    let effectMessage = `🔥 【${weaponName}】武器效果：目标获得${burnLayers}层「燃烧」`;
    if (burnLayers > 1) {
      //effectMessage += '（助燃核心：双倍叠层）';
    }
    messages.push(effectMessage);

    return {
      messages,
      targetUpdates,
      burnLayerAdded
    };
  },

  // 基因变异处理函数
  handleGeneMutation: function (
    targetBoss: any,
  ): {
    messages: string[];              // 提示消息
    targetUpdates: {                 // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
    tempMark: boolean;               // 移除孤立无援状态的标记
  } | null {
    const messages: string[] = [];
    let targetUpdates: {
      name: string;
      updates: Partial<BattleStatistics>;
    } | null = null;
    let tempMark = false;             // 用于移除孤立无援的标记

    // 1. 检查目标是否拥有「基因变异」技能
    if (!targetBoss.skills.includes('基因变异')) {
      return null;
    }

    // 2. 设置移除孤立无援的标记
    tempMark = true;

    // 3. 更新 statusLayers（受击次数）和 skillStacks（基因变异层数）
    const currentStatusLayers = targetBoss.statusLayers || 0;

    targetUpdates = {
      name: targetBoss.name,
      updates: {
        statusLayersChanged: 1,         // statusLayers +1
        skillStacksChanged: 1           // skillStacks +1
      } as Partial<BattleStatistics>
    };

    messages.push(`🧬 【基因变异】生效：获得1层「基因变异」`);

    // 2. 回复能量
    const energyGain = 100;
    targetUpdates.updates.energyChange = energyGain;
    messages.push(`🧬 【基因变异】生效：回复${energyGain}点能量`);

    // 4. 检查是否触发获得新技能（statusLayers+1达到3的倍数）
    if ((currentStatusLayers + 1) % 3 === 0) {
      // 获取当前基因技能数量
      const geneSkills = targetBoss.skills.filter(skill => [
        '优化冗余片段', '开天眼', '环境适应', '加快分化',
        '耐力强化', '稳定DNA', '增厚甲壳', '质粒增殖',
        '加速代谢', '组织增生', '模仿生物签名'
      ].includes(skill));
      const geneSkillCount = geneSkills.length;

      // 已有4个基因技能时不获得新技能
      if (geneSkillCount >= 4) {
        // 执行移除基因技能操作（原步骤5）
        targetUpdates.updates.statusLayersChanged = -(currentStatusLayers + 1);
        targetUpdates.updates.skillsRemoved = [...geneSkills];
        messages.push(`🧬 【基因变异】触发：移除所有基因技能`);
      } else {
        // 正常获得新技能
        const availableSkills = [
          '优化冗余片段', '开天眼', '环境适应', '加快分化',
          '耐力强化', '稳定DNA', '增厚甲壳', '质粒增殖',
          '加速代谢', '组织增生', '模仿生物签名'
        ].filter(skill => !targetBoss.skills.includes(skill));

        if (availableSkills.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableSkills.length);
          const newSkill = availableSkills[randomIndex];

          // 添加到新增技能列表
          const updates = targetUpdates.updates;
          updates.skillsAdded = updates.skillsAdded || [];
          updates.skillsAdded.push(newSkill);

          messages.push(`🧬 【基因变异】触发：获得基因技能「${newSkill}」`);

        }
      }
    }

    return {
      messages,
      targetUpdates,
      tempMark
    };
  },

  // 优化冗余片段处理（免疫辐射伤害）
  handleRedundancyOptimization: function (
    targetBoss: any,
    weaponName: string
  ): {
    isImmune: boolean;        // 是否触发免疫标记
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];

    // 1. 检查目标是否拥有「优化冗余片段」技能
    if (!targetBoss.skills.includes('优化冗余片段')) {
      return null;
    }

    // 2. 检查是否是辐射伤害
    const isRadiationDamage = weaponName === '伽马枪';
    if (!isRadiationDamage) {
      return null;
    }

    // 3. 清空辐射层数
    if (targetBoss.radiationLayers > 0) {
      const updates: Partial<BattleStatistics> = {
        radiationLayersChange: -(targetBoss.radiationLayers + 2)
      };

      return {
        isImmune: true,
        messages: [`🧬 【优化冗余片段】生效：免疫辐射伤害并清空所有辐射层数`],
        targetUpdates: {
          name: targetBoss.name,
          updates
        }
      };
    }

    return {
      isImmune: true,
      messages: [`🧬 【优化冗余片段】生效：免疫辐射伤害`],
      targetUpdates: null
    };
  },

  // 环境适应处理（免疫火焰和寒冷伤害，任意攻击都会清空寒冷/燃烧层数）
  handleEnvironmentalAdaptation: function (
    targetBoss: any,
    weaponName: string
  ): {
    isImmune: boolean;        // 是否触发免疫标记
    immuneCold: boolean;      // 新增：是否免疫寒冷伤害
    immuneFire: boolean;      // 新增：是否免疫火焰伤害
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    const messages: string[] = [];
    let immuneCold = false; // 新增
    let immuneFire = false; // 新增

    // 1. 检查目标是否拥有「环境适应」技能
    if (!targetBoss.skills.includes('环境适应')) {
      return null;
    }

    // 2. 检查是否是火焰或寒冷伤害
    const isFireDamage = weaponName === '焚烧枪';
    const isColdDamage = weaponName === '零度之下';

    // 3. 清空相应的层数（无论何种武器攻击都清空）
    const updates: Partial<BattleStatistics> = {};
    let clearMessageParts: string[] = [];

    if (targetBoss.burnLayers > 0) {
      updates.burnLayersChanged = -(targetBoss.burnLayers + 2);
      clearMessageParts.push(`清空全部燃烧效果`);
    }

    if (targetBoss.coldLayers > 0) {
      updates.coldLayersChange = -(targetBoss.coldLayers + 2);
      clearMessageParts.push(`清空全部寒冷效果`);
    }

    // 4. 添加免疫逻辑（仅针对火焰/寒冷伤害）
    let isImmune = false;

    if (isFireDamage) {
      isImmune = true;
      immuneFire = true;
    }

    if (isColdDamage) {
      isImmune = true;
      immuneCold = true;
    }

    // 5. 构造完整消息
    let fullMessage = `🧬 【环境适应】生效：`;
    let immuneMessage = '';

    if (isImmune) {
      immuneMessage = `免疫${isFireDamage ? '火焰' : (isColdDamage ? '寒冷' : '')}伤害`;
    }

    if (clearMessageParts.length > 0) {
      fullMessage += `${immuneMessage ? immuneMessage + '并' : ''}${clearMessageParts.join('和')}`;
    } else if (immuneMessage) {
      fullMessage += immuneMessage;
    } else {
      // 没有效果则不返回
      return null;
    }

    messages.push(fullMessage);

    return {
      isImmune,
      immuneCold,
      immuneFire,
      messages,
      targetUpdates: Object.keys(updates).length > 0 ? {
        name: targetBoss.name,
        updates
      } : null
    };
  },

  // 加快分化处理（回复生命值）
  handleAcceleratedDifferentiation: function (
    targetBoss: any
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    // 1. 检查目标是否拥有「加快分化」技能
    if (!targetBoss.skills.includes('加快分化')) {
      return null;
    }

    // 2. 获取基因变异层数
    const currentStacks = targetBoss.skillStacks || 0;

    // 3. 计算层数的一半（向下取整）
    const halfStacks = Math.floor(currentStacks / 2);

    // 没有可计算的层数时直接返回
    if (halfStacks <= 0) {
      return null;
    }

    // 4. 计算回复量（基于半层层数 × 5）
    const healAmount = halfStacks * 5;

    return {
      messages: [`🧬 【加快分化】生效：回复${healAmount}点生命值`],
      targetUpdates: {
        name: targetBoss.name,
        updates: {
          hpChange: healAmount
          // 不再消耗层数
        } as Partial<BattleStatistics>
      }
    };
  },

  // 耐力强化处理（能量回复和减伤）
  handleEnduranceEnhancement: function (
    targetBoss: any
  ): {
    messages: string[];       // 提示消息
    nerfMultiplier: number;   // 减伤系数
  } | null {
    // 1. 检查目标是否拥有「耐力强化」技能
    if (!targetBoss.skills.includes('耐力强化')) {
      return null;
    }

    const messages: string[] = [];
    let nerfMultiplier = 0;

    // 3. 计算能量相关减伤
    const currentEnergy = targetBoss.energy || 0;
    const maxEnergy = getMaxEnergyByName(targetBoss.name);
    const energyPercent = maxEnergy > 0 ? currentEnergy / maxEnergy : 0;

    if (energyPercent >= 0.8) {
      nerfMultiplier = 0.8;
      messages.push(`🧬 【耐力强化】生效：能量≥80%，受到的伤害-80%`);
    } else if (energyPercent >= 0.5) {
      nerfMultiplier = 0.5;
      messages.push(`🧬 【耐力强化】生效：能量≥50%，受到的伤害-50%`);
    } else if (energyPercent >= 0.3) {
      nerfMultiplier = 0.3;
      messages.push(`🧬 【耐力强化】生效：能量≥30%，受到的伤害-30%`);
    }

    return {
      messages,
      nerfMultiplier
    };
  },

  // 增厚甲壳处理（减伤）
  handleThickenedCarapace: function (
    targetBoss: any
  ): {
    nerfMultiplier: number;   // 减伤系数
    messages: string[];       // 提示消息
  } | null {
    // 1. 检查目标是否拥有「增厚甲壳」技能
    if (!targetBoss.skills.includes('增厚甲壳')) {
      return null;
    }

    // 2. 获取基因变异层数
    const geneStacks = targetBoss.skillStacks || 0;
    const nerfMultiplier = geneStacks * 0.01;

    if (nerfMultiplier === 0) {
      return null;
    }

    return {
      nerfMultiplier,
      messages: [`🧬 【增厚甲壳】生效：受到的伤害-${(nerfMultiplier * 100).toFixed(0)}%`]
    };
  },

  // 加速代谢处理（额外增加基因变异层数）
  handleAcceleratedMetabolism: function (
    targetBoss: any
  ): {
    messages: string[];       // 提示消息
    targetUpdates: {          // 目标boss更新数据
      name: string;
      updates: Partial<BattleStatistics>;
    } | null;
  } | null {
    // 1. 检查目标是否拥有「加速代谢」技能
    if (!targetBoss.skills.includes('加速代谢')) {
      return null;
    }

    // 2. 获取当前基因技能数量
    const geneSkillsCount = targetBoss.skills.filter(skill => [
      '优化冗余片段', '开天眼', '环境适应', '加快分化',
      '耐力强化', '稳定DNA', '增厚甲壳', '质粒增殖',
      '加速代谢', '组织增生', '模仿生物签名'
    ].includes(skill)).length;

    // 3. 添加额外的层数
    if (geneSkillsCount > 0) {
      return {
        messages: [`🧬 【加速代谢】生效：当前拥有${geneSkillsCount}个基因技能，额外增加${geneSkillsCount}层基因变异`],
        targetUpdates: {
          name: targetBoss.name,
          updates: {
            skillStacksChanged: geneSkillsCount
          } as Partial<BattleStatistics>
        }
      };
    }

    return null;
  },

  // 模仿生物签名处理（概率免疫伤害）
  handleBiologicalSignatureImitation: function (
    targetBoss: any,
  ): {
    isImmune: boolean;        // 是否触发免疫
    messages: string[];       // 提示消息
  } | null {
    // 1. 检查目标是否拥有「模仿生物签名」技能
    if (!targetBoss.skills.includes('模仿生物签名')) {
      return null;
    }

    // 2. 获取基因变异层数
    const geneStacks = targetBoss.skillStacks || 0;

    // 3. 计算免疫概率
    const baseChance = 0.01;
    const stackBonus = geneStacks * 0.01;
    const totalChance = Math.min(baseChance + stackBonus, 0.99); // 上限99%

    // 4. 概率判定
    if (Math.random() < totalChance) {
      return {
        isImmune: true,
        messages: [`🧬 【模仿生物签名】生效：${(totalChance * 100).toFixed(1)}%概率免疫本次伤害`]
      };
    }

    return null;
  },

  // 冰悚嚎叫处理（50%血量以下减伤30%）
  handleShiveringHowl: function (
    targetBoss: any,          // 当前目标Boss对象
  ): {
    nerfMultiplier: number;   // 减伤系数
    messages: string[];       // 提示消息
  } | null {
    const messages: string[] = [];

    // 1. 校验技能存在
    if (!targetBoss.skills.includes('冰悚嚎叫')) {
      return null;
    }

    // 2. 获取最大生命值
    const maxHP = getMaxHPByName(targetBoss.name);
    if (typeof maxHP !== 'number') return null;

    // 3. 计算当前生命值比例
    const hpPercent = targetBoss.HP / maxHP;

    // 4. 检查是否触发（血量低于50%）
    if (hpPercent > 0.5) {
      return null;
    }

    // 5. 触发30%减伤
    const nerfMultiplier = 0.3;
    messages.push(`❄️ 【冰悚嚎叫】生效：生命值≤50%，受到的伤害-30%`);

    return {
      nerfMultiplier,
      messages
    };
  },

  // 龙息霰弹枪抗性处理
  handleDragonBreathResistance: function (
    targetBoss: any,      // 目标Boss对象
    weaponName: string,   // 武器名称
  ): {
    nerfMultiplier: number; // 减伤系数
    messages: string[];    // 提示消息
  } | null {
    // 1. 检查武器是否为龙息霰弹枪
    const isDragonBreath = weaponName === '龙息霰弹枪';
    if (!isDragonBreath) {
      return null;
    }

    // 2. 检查目标Boss是否拥有特定抗性技能
    const resistanceSkills = ['火焰异形', '猎手异形', '环境适应'];
    const activeResistances = resistanceSkills.filter(skill =>
      targetBoss.skills.includes(skill)
    );

    // 3. 如果没有抗性技能，返回null
    if (activeResistances.length === 0) {
      return null;
    }

    // 4. 触发30%减伤效果
    return {
      nerfMultiplier: 0.2,
      messages: [
        `🔥 【龙息霰弹枪】：${activeResistances.join('、')}免疫20%的火焰伤害`
      ]
    };
  },



};
























/**
 * 统一处理所有被动效果（包含伤害修正、免疫检查、状态更新等）
 * @param targetBoss 当前被攻击的Boss对象
 * @param weaponName 使用的武器名称
 * @param damage 武器造成的原始伤害值
 * @param activeBosses 当前所有活跃Boss列表
 * @returns 包含最终伤害值和所有效果消息的对象
 */
export function applyPassiveEffects(
  targetBoss: any,
  activeBosses: any[],
  weaponName: string,
  damage: number,
  hasCrit: boolean,
  ignoreRate: number,
  careerData: any,
  equippedWeapon: any,
): {
  finalDamage: number;
  messages: string[];
  radiationLayerAdded: boolean;
  coldLayerAdded: boolean;
  energyDrained: boolean;
  layerReduced: boolean;
  bileDetonationTrigger: boolean;
  spawnNewBossMarks: string[];
  pulseGrenadeTriggered: boolean;
  burnLayerAdded: boolean;
  drainFactor: number;
  reductionAmount: number;
} {
  // 初始化变量
  const messages: string[] = [];
  let immune = false;
  let totalBuffMultiplier = 0;
  let totalNerfMultiplier = 0;
  let radiationLayerAdded = false;
  let coldLayerAdded = false;
  let energyDrained = false;
  let layerReduced = false;
  let bileDetonationTrigger = false;
  let spawnNewBossMarks: string[] = []; // 收集需要生成新boss的标记
  let armor = 0
  let pulseGrenadeTriggered = false
  let burnLayerAdded = false; // 在函数顶部声明变量
  let drainFactor = 0
  let reductionAmount = 0

  // 初始化免疫标记
  let isImmuneCold = false;
  let isImmuneFire = false;

  // 武器数据
  const weaponData = weaponConfig[weaponName] || { type: '' };

  // 定义概率加成变量
  let doubleAstralWind = false;
  let isolatedImmunityMark = false; // 孤立无援免疫标记

  // 在processEffect辅助函数中添加标记收集
  const processEffect = (effect: Function, ...args: any[]) => {
    const result = effect(...args);
    if (!result) return null;

    messages.push(...(result.messages || []));

    // 处理targetUpdates
    if (result.targetUpdates) {
      updateStatsByName(result.targetUpdates.name, result.targetUpdates.updates);
    }

    // 处理otherUpdates (兼容单对象和数组)
    if (result.otherUpdates) {
      // 统一转为数组处理
      const updates = Array.isArray(result.otherUpdates)
        ? result.otherUpdates
        : [result.otherUpdates];

      for (const update of updates) {
        updateStatsByName(update.name, update.updates);
      }
    }

    // +++ 新增：收集生成新boss的标记 +++
    if (result.spawnNewBossMark) {
      spawnNewBossMarks.push(result.spawnNewBossMark);
    }

    return result;
  };

  // 1. 预先计算所有Boss的最大属性（扩展版）
  const maxStatsMap: Record<string, {
    maxHP: number;
    maxEnergy: number;
    maxStacks: number;
    maxShield: number;
    armor: number;
    shieldArmor: number;
  }> = {};

  // 为当前目标和所有活跃Boss计算最大属性
  const allBosses = [targetBoss, ...activeBosses];
  for (const boss of allBosses) {
    if (!maxStatsMap[boss.name]) {
      maxStatsMap[boss.name] = {
        maxHP: getMaxHPByName(boss.name) || 0,
        maxEnergy: getMaxEnergyByName(boss.name) || 0,
        maxStacks: getMaxStacksByName(boss.name) || 0,
        maxShield: getMaxShieldByName(boss.name) || 0,
        armor: getArmorByName(boss.name) || 0,
        shieldArmor: getShieldArmorByName(boss.name) || 0
      };
    }
  }

  // 2. 修改所有效果处理函数，传入预计算的最大属性
  const maxStatsForTarget = maxStatsMap[targetBoss.name];

  // 定义通用效果处理类型
  type EffectItem = {
    effect: Function;
    args: any[];
  };

  // 步骤2: 免疫检查 (基础免疫)
  const coldImmuneEffects: EffectItem[] = [
    {
      effect: BattleEffectProcessor.handleColdAdaptation,
      args: [targetBoss, weaponName]
    },
  ];

  const fireImmuneEffects: EffectItem[] = [

  ];

  // 定义条件免疫效果
  const conditionImmuneEffects: EffectItem[] = [
    {
      effect: BattleEffectProcessor.handleRedundancyOptimization,
      args: [targetBoss, weaponName]
    },
    {
      effect: BattleEffectProcessor.handleEnvironmentalAdaptation,
      args: [targetBoss, weaponName]
    },
  ];

  const chanceImmuneEffects: EffectItem[] = [
    {
      effect: BattleEffectProcessor.handleDeadlyHit,
      args: [targetBoss]
    },
    {
      effect: BattleEffectProcessor.handleElectricField,
      args: [targetBoss, weaponData]
    },
    {
      effect: BattleEffectProcessor.handleAncientOmen,
      args: [targetBoss, weaponData]
    },
    {
      effect: BattleEffectProcessor.handleBiologicalSignatureImitation,
      args: [targetBoss]
    }
  ];

  // 在步骤2：免疫检查前添加新的免疫类型
  const hunterAlienImmune: EffectItem[] = [
    {
      effect: BattleEffectProcessor.handleHunterAlien,
      args: [targetBoss, activeBosses, weaponName]
    }
  ];

  // 执行所有免疫检查
  const allImmuneEffects = [...coldImmuneEffects, ...fireImmuneEffects, ...chanceImmuneEffects, ...conditionImmuneEffects, ...hunterAlienImmune];
  // 在执行免疫效果时收集标记
  for (const immuneEffect of allImmuneEffects) {
    const result = processEffect(immuneEffect.effect, ...immuneEffect.args);
    if (result) {
      isImmuneCold = isImmuneCold || (result.immuneCold === true);
      isImmuneFire = isImmuneFire || (result.immuneFire === true);
      if (result.isImmune) immune = true;
      if (result.buffMultiplier !== undefined) totalBuffMultiplier += result.buffMultiplier;
      if (result.nerfMultiplier !== undefined) totalNerfMultiplier += result.nerfMultiplier;
    }
  }

  // 在免疫检查阶段处理太阳耀斑时更新临时标记
  const solarFlareResult = BattleEffectProcessor.handleSolarFlare(targetBoss, weaponName, activeBosses);
  if (solarFlareResult) {
    // 更新临时标记
    isolatedImmunityMark = solarFlareResult.tempMark || false;
    isImmuneCold = isImmuneCold || (solarFlareResult.immuneCold === true);

    // 处理效果
    if (solarFlareResult.isImmune) immune = true;
    messages.push(...solarFlareResult.messages);
    if (solarFlareResult.targetUpdates) {
      updateStatsByName(solarFlareResult.targetUpdates.name, solarFlareResult.targetUpdates.updates);
    }
  }

  // === 新区域：处理M4AE脉冲步枪的特殊效果 ===

  const pulseEffect = BattleEffectProcessor.handlePulseRifleEffect(weaponName, targetBoss, equippedWeapon);
  if (pulseEffect) {
    // 收集消息
    messages.push(...pulseEffect.messages);
    pulseGrenadeTriggered = pulseEffect.pulseGrenadeTriggered
    // 处理目标更新
    if (pulseEffect.targetUpdates) {
      updateStatsByName(pulseEffect.targetUpdates.name, pulseEffect.targetUpdates.updates);
    }
  }

  // === 新区域：处理核聚变重炮的特殊效果 ===
  const fusionEffect = BattleEffectProcessor.handleFusionCannonEffect(weaponName, equippedWeapon);
  if (fusionEffect) {
    messages.push(...fusionEffect.messages);
  }

  // === 新区域：处理燃烧效果（焚烧枪、龙息霰弹枪）===
  const burnEffectResult = BattleEffectProcessor.handleBurnEffect(targetBoss, weaponName, equippedWeapon, isImmuneFire);
  if (burnEffectResult) {
    messages.push(...burnEffectResult.messages);
    if (burnEffectResult.targetUpdates) {
      updateStatsByName(burnEffectResult.targetUpdates.name, burnEffectResult.targetUpdates.updates);
    }
    burnLayerAdded = burnEffectResult.burnLayerAdded; // 收集燃烧叠加标记
  }

  // 步骤3: 核心减伤/增伤效果处理
  // 在地毯式轰炸处理中更新临时标记
  const carpetBombResult = BattleEffectProcessor.handleCarpetBombing(targetBoss)
  if (carpetBombResult) {
    // 更新临时标记
    isolatedImmunityMark = carpetBombResult.tempMark || false;

    // 处理其他效果
    if (carpetBombResult.nerfMultiplier) {
      totalNerfMultiplier += carpetBombResult.nerfMultiplier;
    }
    messages.push(...carpetBombResult.messages);
  }

  // === 最先处理：基因变异核心逻辑 ===
  // 放在所有其他效果之前，因为它可能设置孤立无援标记
  const geneMutationResult = BattleEffectProcessor.handleGeneMutation(targetBoss);
  if (geneMutationResult) {
    messages.push(...geneMutationResult.messages);
    if (geneMutationResult.targetUpdates) {
      updateStatsByName(geneMutationResult.targetUpdates.name, geneMutationResult.targetUpdates.updates);
    }
    // 获取孤立无援免疫标记，供后续handleIsolated使用
    isolatedImmunityMark = geneMutationResult.tempMark;
  }

  const damageAdjustEffects: EffectItem[] = [
    // 单参数效果
    { effect: BattleEffectProcessor.handleWeakForm, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleAlienShell, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleFrostHell, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleStressShellI, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleStressShellII, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleVirusCloud, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleEnergyBlackhole, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleColossalRampage, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleVomit, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleRampage, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleHyperRangeShift, args: [targetBoss] },
    // +++ 新增：冰悚嚎叫技能处理 +++
    { effect: BattleEffectProcessor.handleShiveringHowl, args: [targetBoss] },
    // 1. 毒性唾液
    { effect: BattleEffectProcessor.handleToxicSaliva, args: [targetBoss] },
    // 2. 剧毒狂暴
    { effect: BattleEffectProcessor.handleToxicFrenzy, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleEnergySiphon, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleEnergyAbsorption, args: [targetBoss] },

    // 双参数效果
    { effect: BattleEffectProcessor.handleStructuralArmor, args: [targetBoss, weaponData] },
    { effect: BattleEffectProcessor.handleDisguise, args: [targetBoss, weaponName] },
    { effect: BattleEffectProcessor.handleDragonBreathResistance, args: [targetBoss, weaponName] },

    // 多参数效果
    { effect: BattleEffectProcessor.handleIsolated, args: [targetBoss, activeBosses, isolatedImmunityMark] },
    { effect: BattleEffectProcessor.handleInfectedSpaceStation, args: [targetBoss, activeBosses] },
    { effect: BattleEffectProcessor.handleInfernalBomb, args: [targetBoss, activeBosses] },
    { effect: BattleEffectProcessor.handleHiveMind, args: [targetBoss, activeBosses] },
    { effect: BattleEffectProcessor.handleReleasePheromones, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleWeakeningSpit, args: [targetBoss, activeBosses] },
    { effect: BattleEffectProcessor.handleThickenedCarapace, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleEnduranceEnhancement, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleAcceleratedMetabolism, args: [targetBoss] },
  ];

  // 执行核心效果处理
  for (const effectItem of damageAdjustEffects) {
    const result = processEffect(effectItem.effect, ...effectItem.args);
    if (result) {
      if (result.buffMultiplier !== undefined) totalBuffMultiplier += result.buffMultiplier;
      if (result.nerfMultiplier !== undefined) totalNerfMultiplier += result.nerfMultiplier;
      bileDetonationTrigger ||= (result.bileDetonationTrigger === true);
    }
  }

  // 心灵狂热单独处理
  const mindFrenzyResult = BattleEffectProcessor.handleMindFrenzy(targetBoss);
  if (mindFrenzyResult) {
    messages.push(...mindFrenzyResult.messages);
    if (mindFrenzyResult.nerfMultiplier) {
      totalNerfMultiplier += mindFrenzyResult.nerfMultiplier;
    }
    doubleAstralWind = mindFrenzyResult.doubleAstralWind || false;
  }



  // 步骤4: 层数依赖效果处理
  const layerDependentEffects: EffectItem[] = [
    { effect: BattleEffectProcessor.handleVampireSaliva, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleBloodlust, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleBladeOfLight, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleCollapsingPulse, args: [targetBoss] },
    // 3. 毒气波
    { effect: BattleEffectProcessor.handleToxicGasWave, args: [targetBoss] },
  ];

  for (const effectItem of layerDependentEffects) {
    const result = processEffect(effectItem.effect, ...effectItem.args);
    if (result) {
      if (result.buffMultiplier !== undefined) totalBuffMultiplier += result.buffMultiplier;
      if (result.nerfMultiplier !== undefined) totalNerfMultiplier += result.nerfMultiplier;
    }
  }

  // 步骤5: 状态变化效果处理
  const stateChangeEffects: EffectItem[] = [
    { effect: BattleEffectProcessor.handleSuperconductor, args: [targetBoss] },
    // 4. 剧毒突袭
    { effect: BattleEffectProcessor.handleToxicAssault, args: [targetBoss] },
    { effect: BattleEffectProcessor.handleTerrifyingScreech, args: [targetBoss, activeBosses] },
    { effect: BattleEffectProcessor.handleHatching, args: [targetBoss, activeBosses] },
  ];

  for (const effectItem of stateChangeEffects) {
    processEffect(effectItem.effect, ...effectItem.args);
  }

  // === 额外处理：酸蚀池强化状态 ===
  // 需要放在状态变化之后，伤害计算之前
  let isEnhanced = false;
  if (targetBoss.statusLayers > 0 && targetBoss.skills.includes('酸蚀池')) {
    isEnhanced = true;
    // 消耗一次强化次数
    updateStatsByName(targetBoss.name, {
      statusLayersChanged: -1
    });
  }

  // === 酸蚀池依赖强化状态，需要重新调用 ===
  const acidPoolResult = BattleEffectProcessor.handleAcidPool(
    targetBoss,
    weaponData,
    isEnhanced
  );
  if (acidPoolResult) {
    messages.push(...acidPoolResult.messages);
    if (acidPoolResult.targetUpdates) {
      updateStatsByName(acidPoolResult.targetUpdates.name, acidPoolResult.targetUpdates.updates);
    }
    if (acidPoolResult.nerfMultiplier) {
      totalNerfMultiplier += acidPoolResult.nerfMultiplier;
    }
    if (acidPoolResult.buffMultiplier) {
      totalBuffMultiplier += acidPoolResult.buffMultiplier;
    }
  }


  // 燃烧粘液特殊处理
  const burningSlimeResult = BattleEffectProcessor.handleBurningSlime(targetBoss, weaponName);
  if (burningSlimeResult) {
    messages.push(...burningSlimeResult.messages);
    if (burningSlimeResult.targetUpdates) {
      updateStatsByName(burningSlimeResult.targetUpdates.name, burningSlimeResult.targetUpdates.updates);
    }
    bileDetonationTrigger = burningSlimeResult.isHighStackHeal || false;
  }

  // 胆汁腐蚀/火焰吐息处理
  const bileEffects: EffectItem[] = [
    { effect: BattleEffectProcessor.handleCorrosiveBile, args: [targetBoss, activeBosses, bileDetonationTrigger] },
    { effect: BattleEffectProcessor.handleFlameBreath, args: [targetBoss, activeBosses, bileDetonationTrigger] },
  ];

  for (const effectItem of bileEffects) {
    processEffect(effectItem.effect, ...effectItem.args);
  }

  // 步骤7: 概率触发效果
  const astralWindResult = BattleEffectProcessor.handleAstralWind(
    targetBoss,
    activeBosses,
    doubleAstralWind
  );
  if (astralWindResult) {
    messages.push(...astralWindResult.messages);
    if (astralWindResult.otherUpdates) {
      for (const update of astralWindResult.otherUpdates) {
        updateStatsByName(update.name, update.updates);
      }
    }
  }

  const psychicForgeResult = BattleEffectProcessor.handlePsychicForge(
    targetBoss,
  );
  if (psychicForgeResult) {
    messages.push(...psychicForgeResult.messages);
    if (psychicForgeResult.targetUpdates) {
      updateStatsByName(psychicForgeResult.targetUpdates.name, psychicForgeResult.targetUpdates.updates);
    }
  }

  // 步骤8: 辐射/寒冷效果处理
  const radiationResult = BattleEffectProcessor.handleRadiationEffect(targetBoss, weaponName, equippedWeapon);
  if (radiationResult) {
    messages.push(...radiationResult.messages);
    if (radiationResult.targetUpdates) {
      updateStatsByName(radiationResult.targetUpdates.name, radiationResult.targetUpdates.updates);
    }
    radiationLayerAdded = radiationResult.layerAdded;
  }

  const coldResult = BattleEffectProcessor.handleColdEffect(targetBoss, weaponName, equippedWeapon, isImmuneCold);
  if (coldResult) {
    messages.push(...coldResult.messages);
    if (coldResult.buffMultiplier) {
      totalBuffMultiplier += coldResult.buffMultiplier;
    }
    if (coldResult.targetUpdates) {
      updateStatsByName(coldResult.targetUpdates.name, coldResult.targetUpdates.updates);
    }
    coldLayerAdded = coldResult.layerAdded;
  }

  // 步骤9: 能量消耗/层数减少
  const energyDrainResult = BattleEffectProcessor.handleWeaponEnergyDrain(targetBoss, weaponName, maxStatsForTarget, equippedWeapon);
  if (energyDrainResult) {
    messages.push(...energyDrainResult.messages);
    if (energyDrainResult.targetUpdates) {
      updateStatsByName(energyDrainResult.targetUpdates.name, energyDrainResult.targetUpdates.updates);
    }
    energyDrained = energyDrainResult.success || false;
    drainFactor = energyDrainResult.drainFactor;
  }

  const layerReduceResult = BattleEffectProcessor.handleWeaponLayerReduction(targetBoss, weaponName, maxStatsForTarget, equippedWeapon);
  if (layerReduceResult) {
    messages.push(...layerReduceResult.messages);
    if (layerReduceResult.targetUpdates) {
      updateStatsByName(layerReduceResult.targetUpdates.name, layerReduceResult.targetUpdates.updates);
    }
    layerReduced = layerReduceResult.reductionSuccess || false;
    reductionAmount = layerReduceResult.reductionAmount;
  }

  // 最终伤害计算
  let finalDamage = damage;

  // 应用无视减伤系数调整
  let adjustedNerfMultiplier = totalNerfMultiplier * (1 - ignoreRate);

  // 伤害系数调整
  const damageMultiplier = 1 + totalBuffMultiplier - adjustedNerfMultiplier;
  finalDamage = damage * damageMultiplier;

  if (pulseGrenadeTriggered || fusionEffect?.fusionExplosionTriggered) {
    finalDamage *= 1.5;
  }

  if (hasCrit) {
    finalDamage *= 2;
  }

  let burnDamage

  if (weaponName === '焚烧枪' || weaponName === '龙息霰弹枪') {
    // 计算燃烧伤害（每层造成1点伤害，且最大层数限制为100）
    const currentBurnLayers = Math.min(targetBoss?.burnLayers || 0, 100);
    burnDamage = currentBurnLayers * 1;

    const burnDebuffMultiplier = totalNerfMultiplier * 0.5;
    burnDamage *= (1 - burnDebuffMultiplier);

    if (burnDamage > 0) {
      // 生成百分比格式的减伤描述（仅当有减伤时显示）
      const debuffText = burnDebuffMultiplier > 0
        ? `（受到${Math.round(burnDebuffMultiplier * 100)}%的减伤效果）`
        : '';

      messages.push(`🔥 【燃烧】效果造成额外${burnDamage.toFixed(1)}点伤害${debuffText}`);
    }

    finalDamage += burnDamage;
  }

  // 处理"组织增生"技能
  if (targetBoss.skills && targetBoss.skills.includes('组织增生')) {
    // 获取「基因变异」层数（默认0）
    const geneMutationStacks = targetBoss?.skillStacks || 0;

    // 计算护甲加成值
    const armorBonus = geneMutationStacks * 0.1;

    // 临时增加护甲值
    armor += armorBonus;

    // 可选的调试信息
    if (armorBonus > 0) {
      messages.push(`【组织增生】生效：临时增加${armorBonus.toFixed(1)}点护甲`);
    }
  }

  // === 新增：护甲减伤处理 ===
  // 读取武器的护甲减伤属性（默认为0）
  let armorDamageReduction = weaponData.armorDamageReduction || 0;
  // 计算护甲减伤总量（目标当前护甲值 × 减伤系数）

  if (careerData?.career === '猩红杀手' && weaponName === '侦察步枪') {
    armorDamageReduction = 0;
  }
  if (equippedWeapon.installedMods?.includes('氮气压缩核心')) {
    armorDamageReduction = 0;
  }
  if (equippedWeapon.installedMods?.includes('轻型电源节点')) {
    armorDamageReduction = 0;
  }
  if (equippedWeapon.installedMods?.includes('助燃核心')) {
    armorDamageReduction = -0.5;
  }
  if (equippedWeapon.installedMods?.includes('强力钻刺核心')) {
    armorDamageReduction = 0.2;
  }

  const baseArmor = getArmorByName(targetBoss.name) !== undefined
    ? getArmorByName(targetBoss.name)
    : targetBoss.armor;
  armor += baseArmor - (targetBoss.radiationLayers * 0.05) - (targetBoss.armorReductionLayers * 0.1);

  const armorReduction = armorDamageReduction * armor;

  if (armorReduction !== 0) {
    if (armorReduction > 0) {
      messages.push(`护甲减伤: ${armorReduction.toFixed(2)}点`);
    } else {
      messages.push(`护甲增伤: ${Math.abs(armorReduction).toFixed(2)}点`);
    }
  }

  finalDamage = Math.max(Math.round(finalDamage - armorReduction), 1);

  if (finalDamage < targetBoss.HP) {
    // 步骤6: 特殊回复效果处理
    const healingEffects: EffectItem[] = [
      { effect: BattleEffectProcessor.handleFrostRegeneration, args: [targetBoss, activeBosses, maxStatsForTarget] },
      { effect: BattleEffectProcessor.handleFrostAura, args: [targetBoss, activeBosses] },
      { effect: BattleEffectProcessor.handleSentryGun, args: [targetBoss, activeBosses] },
      { effect: BattleEffectProcessor.handleMoldGrowth, args: [targetBoss, activeBosses] },
      { effect: BattleEffectProcessor.handleElectricShockwave, args: [targetBoss] },
      { effect: BattleEffectProcessor.handlePulse, args: [targetBoss, activeBosses] },
      { effect: BattleEffectProcessor.handleFeeding, args: [targetBoss] },
      { effect: BattleEffectProcessor.handleBurningBurrow, args: [targetBoss] },
      { effect: BattleEffectProcessor.handleBombardmentGuide, args: [targetBoss] },
      { effect: BattleEffectProcessor.handleOverdriveShield, args: [targetBoss, activeBosses] },
      // 6. 淬毒撕咬
      { effect: BattleEffectProcessor.handlePoisonedBite, args: [targetBoss] },
      { effect: BattleEffectProcessor.handleHealingSwarm, args: [targetBoss, activeBosses] },
      { effect: BattleEffectProcessor.handleBurrowAmbush, args: [targetBoss, activeBosses] },
      { effect: BattleEffectProcessor.handleAcceleratedDifferentiation, args: [targetBoss] },
    ];

    for (const effectItem of healingEffects) {
      processEffect(effectItem.effect, ...effectItem.args);
    }
  }

  // ==================== 新区域：处理需要最新伤害值(finaDamage)的函数 ====================
  // 这些函数需要最新的finalDamage作为输入，放在伤害计算后、濒死处理前

  // 处理需要最新伤害值的函数 - 冰霜进化
  const frostEvolutionResult = BattleEffectProcessor.handleFrostEvolution(
    targetBoss,
    weaponName,
    finalDamage // 使用最新计算的finalDamage
  );
  if (frostEvolutionResult) {
    messages.push(...frostEvolutionResult.messages);
    if (frostEvolutionResult.targetUpdates) {
      updateStatsByName(frostEvolutionResult.targetUpdates.name, frostEvolutionResult.targetUpdates.updates);
    }
    if (frostEvolutionResult.isImmune) {
      immune = true;
    }
  }

  // 处理需要最新伤害值的函数 - 火焰异形
  const flameAlienResult = BattleEffectProcessor.handleFlameAlien(
    targetBoss,
    weaponName,
    finalDamage // 使用最新计算的finalDamage
  );
  if (flameAlienResult) {
    messages.push(...flameAlienResult.messages);
    if (flameAlienResult.targetUpdates) {
      updateStatsByName(flameAlienResult.targetUpdates.name, flameAlienResult.targetUpdates.updates);
    }
    if (flameAlienResult.isImmune) {
      immune = true;
    }
  }

  // 处理需要最新伤害值的函数 - 宇宙能量
  const cosmicEnergyResult = BattleEffectProcessor.handleCosmicEnergy(
    targetBoss,
    finalDamage // 使用最新计算的finalDamage
  );
  if (cosmicEnergyResult) {
    messages.push(...cosmicEnergyResult.messages);
    if (cosmicEnergyResult.targetUpdates) {
      updateStatsByName(cosmicEnergyResult.targetUpdates.name, cosmicEnergyResult.targetUpdates.updates);
    }
  }

  // 确保如果免疫，最终伤害为0
  if (immune) {
    finalDamage = 0;
  }

  // 计算当前是否致命伤害
  const isLethal = finalDamage >= targetBoss.HP && finalDamage > 0;

  // 处理濒死回血技能（优先级顺序：求生本能I > 求生本能II > 复苏）
  const survivalSkills = [
    { func: BattleEffectProcessor.handleSurvivalInstinctI, name: '求生本能I' },
    { func: BattleEffectProcessor.handleSurvivalInstinctII, name: '求生本能II' },
    { func: BattleEffectProcessor.handleRevival, name: '复苏' }
  ];

  let revivalTriggered = false;

  if (isLethal) {
    for (const skill of survivalSkills) {
      if (targetBoss.skills.includes(skill.name)) {
        // 传入finalDamage作为伤害值参数
        const result = skill.func(targetBoss, finalDamage);
        if (result) {
          // 应用技能效果
          updateStatsByName(result.targetUpdates.name, result.targetUpdates.updates);
          messages.push(...result.messages);
          revivalTriggered = true;

          // 触发后跳出循环
          break;
        }
      }
    }
  }

  // 如果没有触发任何濒死技能，应用伤害
  if (!revivalTriggered && !immune && finalDamage > 0) {
    updateStatsByName(targetBoss.name, {
      hpChange: -finalDamage,
    });
  }

  return {
    finalDamage,
    messages,
    radiationLayerAdded,
    coldLayerAdded,
    energyDrained,
    layerReduced,
    bileDetonationTrigger,
    spawnNewBossMarks, // +++ 新增生成标记 +++
    pulseGrenadeTriggered,
    burnLayerAdded, // 新增燃烧叠加标记
    drainFactor,
    reductionAmount,
  };
}