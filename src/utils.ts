import { Context } from 'koishi'
import { bossPool, bossGroups } from './boss/boss'
import { Config } from './index'
import { weaponConfig, modConfig } from './weapons'
import { SyndicatedItems } from './items'
import { Spacestationtechnology } from './technology'


// 带保底的抽奖方法
export async function gachaWithPity(ctx: Context, handle: string): Promise<boolean> {
  const [record] = await ctx.database.get('ggcevo_sign', { handle: handle })
  const currentPity = record?.pityCounter ?? 0

  // 保底触发判断
  if (currentPity >= 89) {
    await updatePityCounter(ctx, handle, true)
    await ctx.database.upsert('ggcevo_sign', [{
      handle,
      fullPityCount: (record?.fullPityCount || 0) + 1,
      bigPrizeCount: (record?.bigPrizeCount || 0) + 1  // 新增：保底触发时增加大奖计数
    }], ['handle'])
    return true
  }

  // 正常抽奖
  const isWin = simpleDraw()
  if (isWin) {
    await updatePityCounter(ctx, handle, true)
    // 新增：抽中时增加大奖计数
    await ctx.database.upsert('ggcevo_sign', [{
      handle,
      bigPrizeCount: (record?.bigPrizeCount || 0) + 1
    }], ['handle'])
  } else {
    await updatePityCounter(ctx, handle, false)
  }
  return isWin
}

// 更新保底计数器
async function updatePityCounter(ctx: Context, handle: string, isWin: boolean) {
  const [record] = await ctx.database.get('ggcevo_sign', { handle: handle })
  const [backpack] = await ctx.database.get('ggcevo_backpack', { handle: handle, itemId: 2 })

  // 更新基础计数器
  await ctx.database.upsert('ggcevo_sign', [{
    handle,
    totalPulls: (record?.totalPulls || 0) + 1,
    pityCounter: isWin ? 0 : (record?.pityCounter || 0) + 1
  }], ['handle'])

  // 抽中时更新背包
  if (isWin) {
    await ctx.database.upsert('ggcevo_backpack', [{
      handle,
      itemId: 2,
      quantity: (backpack?.quantity || 0) + 1
    }])
  }
}

export async function checkSensitiveWord(ctx: Context, content: string): Promise<boolean> {

  return true;

}

function simpleDraw() {
  return Math.floor(Math.random() * 10000) < 50;
}

function HiddenAward() {
  return Math.floor(Math.random() * 10000) < 1;
}

export function getRandomInt(min: number, max: number) {
  const actualMin = Math.min(min, max);
  const actualMax = Math.max(min, max);
  return Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin;
}

export function PetCapsuleToy() {
  const num = Math.floor(Math.random() * 10000); // 生成0-9999的整数
  if (num < 4000) return 't3级宠物扭蛋';    // 前40% (0-3999)
  if (num < 7000) return 't2级宠物扭蛋';    // 接下来30% (4000-6999)
  if (num < 9000) return 't1级宠物扭蛋';    // 接下来20% (7000-8999)
  return 't0级宠物扭蛋';                   // 最后10% (9000-9999)
}

// 辅助函数：判断是否为同一天
export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function convertUTCtoChinaTime(input: Date | string | number): Date {
  // 统一转换为 Date 对象
  const utcDate = new Date(input);

  // 验证输入有效性
  if (isNaN(utcDate.getTime())) {
    throw new Error("Invalid date input");
  }

  // 时区转换核心逻辑：UTC 时间 + 8 小时
  const chinaTimestamp = utcDate.getTime() + (8 * 60 * 60 * 1000);

  // 返回新 Date 对象（注意：此对象的时间戳表示 UTC+8 时间）
  return new Date(chinaTimestamp);
}

// 辅助格式化日期函数
export function formatDate(d: Date) {
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 辅助函数：创建血条
export function createHpBar(current: number, max: number): string {
  const ratio = current / max
  const filled = Math.floor(ratio * 20)
  return '▰'.repeat(filled) + '▱'.repeat(20 - filled)
}

// 激活下一个BOSS组（权重版）
export async function activateNextBossGroup(ctx: Context, currentGroupId: number | null = null) {
  // 1. 获取所有权重记录
  const allWeights = await ctx.database.get('ggcevo_boss_weights', {});

  // 2. 过滤可选项（排除当前BOSS组）
  let candidateWeights = allWeights;
  if (currentGroupId !== null) {
    candidateWeights = allWeights.filter(w => w.groupId !== currentGroupId);
  }

  // 3. 计算总权重并执行权重随机选择
  const totalWeight = candidateWeights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  let selectedGroupId: number;
  for (const weight of candidateWeights) {
    random -= weight.weight;
    if (random <= 0) {
      selectedGroupId = weight.groupId;
      break;
    }
  }

  // 4. 确保有选择结果（浮点数误差保护）
  selectedGroupId = selectedGroupId || candidateWeights[candidateWeights.length - 1].groupId;

  // 5. 找到选中的组
  let selectedGroup = bossGroups.find(group => group.groupId === selectedGroupId);
  if (!selectedGroup) {
    // 如果找不到组，默认选择第一个组
    selectedGroup = bossGroups[0];
  }

  // 6. 激活该组中的所有BOSS
  const activatedBosses = [];
  for (const bossId of selectedGroup.bosses) {
    // 通过ID查找BOSS配置
    const bossConfig = bossPool.find(b => b.id === bossId);
    if (!bossConfig) {
      throw new Error(`Boss ${bossId} not found in bossPool`);
    }

    // 创建BOSS
    const boss = await ctx.database.create('ggcevo_boss', {
      name: bossConfig.name,
      type: bossConfig.type,
      HP: bossConfig.maxHP,
      tags: bossConfig.tags,    // 新增标签字段
      skills: [...bossConfig.passive],
      energy: bossConfig.maxEnergy,
      isActive: true,
      respawnTime: new Date()
    });

    activatedBosses.push(boss);
  }

  // 7. 更新选中BOSS组的权重
  await updateWeights(ctx, selectedGroupId);

  return {
    group: selectedGroup,
    bosses: activatedBosses
  };
}

// 在武器配置后添加
const weaponConfigById = {};
for (const key in weaponConfig) {
  weaponConfigById[weaponConfig[key].id] = weaponConfig[key];
}

// 优化后的战斗力计算函数
export async function calculateTotalPower(ctx: Context, config: Config, handle: string) {
  // 初始战斗力为0
  let total = 0;

  // 获取职业数据
  const [careerData] = await ctx.database.get('ggcevo_sign', { handle });
  const career = careerData?.career;

  // 计算职业加成
  if (career) {
    if (career === "联盟新兵") total += 1000;
    else if (career === "辛迪加炮灰新兵") total += 2000;
    else if (["深空矿工", "医疗专家", "情报副官", "总工程师", "舰长", "机械化专家"].includes(career)) total += 2500;
    else if (["清洁工", "辛迪加财务经理", "计算机专家", "指挥官", "装甲兵", "破坏者", "征募官"].includes(career)) total += 3000;
    else if (["警卫员下士", "警卫长", "武器中士"].includes(career)) total += 3500;
    else if (["能量武器专家", "枪手", "猩红杀手", "纵火狂"].includes(career)) total += 4000;
  }

  // 计算武器加成（使用新的累加公式）
  const weapons = await ctx.database.get('ggcevo_weapons', { handle });
  for (const { weaponId, level, installedMods } of weapons) {
    const weapon = weaponConfigById[weaponId];
    if (!weapon) continue;

    // 武器基础战力（保持不变）
    total += weapon.damage * 100;

    // 新的等级加成：0级=0, 1级=1000, 2级=3000, 3级=6000, 4级=10000, 5级=15000, 6级=21000
    // 使用三角数公式：n级加成 = n*(n+1)/2 * 1000
    total += level * (level + 1) / 2 * 1000;

    // 模组加成（根据类型区分）
    for (const modName of installedMods || []) {
      const mod = modConfig[modName];
      if (mod) {
        if (mod.isExclusive) {
          // 专属模块：+4000战力
          total += 4000;
        } else {
          // 通用模块：+2000战力
          total += 2000;
        }
      }
    }
  }

  return total;
}

export async function applyItemEffect(
  ctx: Context,
  session: any,
  handle: string,
  itemConfig: any,
  target?: string // 新增可选参数
): Promise<{ success: boolean; message: string }> {
  try {
    // 获取玩家职业信息
    const [careerData] = await ctx.database.get('ggcevo_sign', { handle });
    if (!careerData) {
      return {
        success: false,
        message: '🔒 您尚未进行签到，请先使用"签到"指令',
      };
    }
    const playerCareer = careerData.career;

    // 检查玩家统计记录是否存在
    const [playerStats] = await ctx.database.get('ggcevo_player_stats', { handle });
    if (!playerStats) {
      return {
        success: false,
        message: '🔒 您尚未进行签到，请先使用"签到"指令',
      };
    }

    // 物品名称解析
    const itemName = Object.entries(SyndicatedItems).find(
      ([_, item]) => item.id === itemConfig.id
    )?.[0] || '未知物品'

    // 执行物品专属前置检查
    if (itemConfig.id === 1) { // E-2能量炸弹
      // 检查玩家的buff字段是否含有1
      if (playerStats.buff && playerStats.buff.includes(1)) {
        return {
          success: false,
          message: '您已经拥有E-2能量炸弹效果，无法重复使用。',
        };
      }

      // 给玩家添加buff
      const currentBuff = playerStats.buff || [];
      currentBuff.push(1);
      await ctx.database.upsert('ggcevo_player_stats', [{
        handle,
        buff: currentBuff
      }], ['handle']);

      return {
        success: true,
        message: `成功使用${itemName}，获得「下一次攻击对建筑目标造成1000%的伤害」效果。`,
      };
    }

    if (itemConfig.id === 2) {
      if (!target) return {
        success: false,
        message: '您未选择合适的目标。',
      }

      const [targetboss] = await ctx.database.get('ggcevo_boss', {
        name: target,
        isActive: true
      });

      // 检查目标是否无效
      if (!targetboss) return {
        success: false,
        message: '无法找到指定的目标。',
      }

      // 检查目标是否免疫
      if (targetboss.skills.includes('开天眼')) {
        return {
          success: false,
          message: `目标免疫闪光弹，无法使用此物品。`,
        };
      }

      // 检查目标是否免疫
      if (targetboss.tags.includes('建筑') || targetboss.tags.includes('重型') || targetboss.skills.includes('开天眼')) {
        return {
          success: false,
          message: `目标${target}拥有"${targetboss.tags.includes('建筑') ? '建筑' : '重型'}"标签，无法使用此物品。`,
        };
      }

      // 获取当前技能层数
      const currentCount = targetboss?.skillStacks || 0;

      // 检查层数是否有效
      if (currentCount <= 0) {
        return {
          success: false,
          message: `目标${target}的技能层数已为0，无需使用此物品。`,
        };
      }

      // 计算新的技能层数（减少10层，但不能低于0）
      const newCount = Math.max(0, currentCount - 10);
      const reducedAmount = currentCount - newCount;

      // 更新BOSS状态
      await ctx.database.set('ggcevo_boss',
        { name: target },
        { skillStacks: newCount }
      );

      return {
        success: true,
        message: `成功使用${itemName}，使${target}的技能层数减少10层`,
      };
    }

    if (itemConfig.id === 4) {
      if (!target) return {
        success: false,
        message: '您未选择合适的目标。',
      }

      const [targetboss] = await ctx.database.get('ggcevo_boss', {
        name: target,
        isActive: true
      });

      // 检查目标是否免疫
      if (targetboss.skills.includes('质粒增殖')) {
        return {
          success: false,
          message: `目标免疫脉冲手雷，无法使用此物品。`,
        };
      }

      if (!targetboss || targetboss?.energy === 0) return {
        success: false,
        message: '您无法对没有能量的目标使用。',
      }
      // 执行操作：消耗500点能量
      await ctx.database.set('ggcevo_boss',
        { name: target },
        { energy: Math.max(targetboss.energy - 500, 0) } // 确保不低于0
      );

      return {
        success: true,
        message: `成功使用${itemName}，消耗${target}500点能量`,
      }
    }

    // ================== 处理莫洛托夫燃烧弹 (id:9) ==================
    if (itemConfig.id === 9) {
      if (!target) return {
        success: false,
        message: '使用燃烧弹需要指定目标。',
      }

      const [targetBoss] = await ctx.database.get('ggcevo_boss', {
        name: target,
        isActive: true
      });

      // 检查目标是否有效
      if (!targetBoss) return {
        success: false,
        message: `目标「${target}」未存活或不存在。`,
      }

      // 检查空中目标限制
      const aerialTargets = ["吸血蝙蝠首领", "吸血蝙蝠", "猛毒异兽", "剧毒蝙蝠"];
      if (aerialTargets.includes(targetBoss.name)) {
        return {
          success: false,
          message: "无法对空中目标使用。",
        };
      }

      // 检查免疫类型 (猎手异形/环境适应)
      const immuneSkills = ['猎手异形', '环境适应'];
      const isImmune = immuneSkills.some(skill =>
        targetBoss.skills?.includes(skill)
      );

      if (isImmune) return {
        success: false,
        message: `目标「${target}」免疫燃烧效果。`,
      }

      // 计算燃烧层数 (纵火狂职业加成)
      const baseLayers = 5;
      let bonusLayers = 0;

      // 纵火狂职业效果提升100%
      if (playerCareer === "纵火狂") {
        bonusLayers = baseLayers; // 额外增加5层（总层数变为10层）
      }

      const currentLayers = targetBoss?.burnLayers || 0;
      const totalLayers = baseLayers + bonusLayers;
      const newLayers = currentLayers + totalLayers;

      // 更新BOSS状态
      await ctx.database.set('ggcevo_boss',
        { name: target },
        { burnLayers: newLayers }
      );

      // 获取任务记录
      const [taskRecord] = await ctx.database.get('ggcevo_task', {
        handle,
        taskId: 7
      });

      // 更新任务进度
      await ctx.database.upsert('ggcevo_task', [{
        handle,
        taskId: 7,
        progress: (taskRecord?.progress || 0) + totalLayers
      }], ['handle', 'taskId']);

      // 生成职业加成消息
      const careerBonusMsg = playerCareer === "纵火狂"
        ? `（纵火狂使用莫洛托夫燃烧弹的效果提高100%）`
        : "";

      return {
        success: true,
        message: `成功使用${itemName}，目标「${target}」的燃烧层数增加${totalLayers}层${careerBonusMsg}`,
      };
    }

    // ================== 处理铝热炸弹 (id:10) ==================
    if (itemConfig.id === 10) {
      if (!target) return {
        success: false,
        message: '使用铝热炸弹需要指定目标。',
      }

      const [targetBoss] = await ctx.database.get('ggcevo_boss', {
        name: target,
        isActive: true
      });

      // 检查目标是否有效
      if (!targetBoss) return {
        success: false,
        message: `目标「${target}」未存活或不存在。`,
      }

      // 检查空中目标限制
      const aerialTargets = ["吸血蝙蝠首领", "吸血蝙蝠", "猛毒异兽", "剧毒蝙蝠"];
      if (aerialTargets.includes(targetBoss.name)) {
        return {
          success: false,
          message: "无法对空中目标使用。",
        };
      }

      // 计算伤害 (破坏者职业加成 + 建筑加成)
      let baseDamage = 100;

      // 破坏者职业伤害提高50%
      if (playerCareer === "破坏者") {
        baseDamage = Math.floor(baseDamage * 1.5); // 150点基础伤害
      }

      // 建筑目标伤害翻3倍（与职业加成乘法计算）
      const isBuilding = targetBoss.tags?.includes('建筑');
      const damage = isBuilding ? baseDamage * 3 : baseDamage;

      // 计算实际伤害 (允许目标血量降低至0)
      const actualDamage = Math.min(damage, targetBoss.HP);
      const newHP = Math.max(0, targetBoss.HP - actualDamage);

      // 检查目标是否被击败
      const isDefeated = newHP === 0;

      // 更新BOSS状态
      if (isDefeated) {
        // 目标被击败，设置isActive为false
        await ctx.database.set('ggcevo_boss',
          { name: target },
          { HP: 0, isActive: false }
        );

        // 如果目标是主宰，将所有目标的血量设置为0，isActive设置为false
        if (targetBoss.type === '主宰') {
          await ctx.database.set('ggcevo_boss', {}, {
            HP: 0,
            isActive: false
          });
        }
      } else {
        // 目标未被击败，只更新HP
        await ctx.database.set('ggcevo_boss',
          { name: target },
          { HP: newHP }
        );
      }

      // 更新玩家金币奖励（仅当造成有效伤害时）
      if (actualDamage > 0) {
        await ctx.database.withTransaction(async () => {
          // 更新金币奖励
          const signRecords = await ctx.database.get('ggcevo_sign', { handle })
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            totalRewards: (signRecords[0]?.totalRewards || 0) + damage
          }], ['handle'])

          // 更新伤害记录
          const [damageRecords] = await ctx.database.get('ggcevo_player_stats', { handle });
          await ctx.database.upsert('ggcevo_player_stats', [{
            handle,
            totalDamage: (damageRecords?.totalDamage || 0) + damage,
            spaceshipId: damageRecords?.spaceshipId || 0
          }], ['handle'])
        });
      }

      // 生成职业加成消息
      const careerBonusMsg = playerCareer === "破坏者"
        ? `（破坏者使用爆破物的效果提高50%）`
        : "";

      // 击败消息
      const defeatMsg = isDefeated ? `，成功击败目标` : "";

      return {
        success: true,
        message: `成功使用${itemName}，对${isBuilding ? '建筑目标' : '目标'}「${target}」造成${actualDamage}点伤害${defeatMsg}${careerBonusMsg}`,
      };
    }

    // 其他物品效果处理
    return {
      success: false,
      message: `${itemName} 无法使用。`,
    }

  } catch (error) {
    console.error('物品效果处理失败:', error)
    return {
      success: false,
      message: '⚠️ 物品效果处理异常，已回滚操作。',
    }
  }
}

// 科技升级逻辑
export async function handleTechUpgrade(ctx: Context, handle: string, target: string) {
  // 检查签到记录是否存在
  const [careerData] = await ctx.database.get('ggcevo_sign', { handle })
  if (!careerData) {
    return '🔒 您尚未进行签到，请先使用"签到"指令'
  }

  const tech = Spacestationtechnology.find(t =>
    t.techname === target
  )

  // 验证逻辑
  const [techEntry] = await ctx.database.get('ggcevo_tech', { handle, techId: tech.techId })
  const currentLevel = techEntry?.level || 0
  if (currentLevel >= tech.maxLevel) return `❌ ${tech.techname}已达最高等级`

  const nextLevel = currentLevel + 1
  const levelData = tech.levels.find(l => l.level === nextLevel)

  // 费用计算
  let originalCost = levelData.cost
  let actualCost = originalCost
  let discountApplied = false
  let discountDetails = []

  // 情报副官折扣
  if (careerData.career === '情报副官') {
    discountApplied = true
    actualCost = Math.floor(originalCost * 0.9)
    discountDetails.push('🎖️ 情报副官职业：10%折扣')
  }

  // 费用检查
  const [signInfo] = await ctx.database.get('ggcevo_sign', { handle })
  if (signInfo?.totalRewards < actualCost) {
    const priceHint = discountApplied
      ? ` (原价${originalCost}金币)`
      : ''
    return `❌ 金币不足！需要${actualCost}金币${priceHint}，您当前拥有：${signInfo?.totalRewards || 0}金币`
  }

  // 检查是否需要增加权限
  let permissionGrantInfo: any = null
  if (tech.techname === "武器系统" && currentLevel === 4 && nextLevel === 5) {
    permissionGrantInfo = {
      type: '武器系统',
      field: 'legendarypermissions',
      amount: 1,
      message: '🎉 获得传奇武器购买权限1次！'
    }
  }
  if (tech.techname === "安防系统" && currentLevel === 4 && nextLevel === 5) {
    permissionGrantInfo = {
      type: '安防系统',
      field: 'explosiondoorauthority',
      amount: 1,
      message: '🔓 获得解锁军械库防爆门权限1次！（使用指令“开启军械库防爆门”）'
    }
  }

  // 执行升级
  await ctx.database.withTransaction(async () => {
    // 扣除金币
    await ctx.database.set('ggcevo_sign', { handle }, {
      totalRewards: signInfo.totalRewards - actualCost
    })

    // 更新科技等级
    await ctx.database.upsert('ggcevo_tech', [{
      handle, techId: tech.techId, level: nextLevel
    }], ['handle', 'techId'])


  })

  // 构建折扣明细部分
  let discountInfo = []
  if (discountApplied) {
    discountInfo = [
      '💰 折扣明细：',
      ...discountDetails.map(detail => `▸ ${detail}`)
    ]
  }

  // 花费信息
  const costInfo = discountApplied
    ? `💸 花费金币：${actualCost} (原价${originalCost})`
    : `💸 花费金币：${actualCost}`



  return [
    `✅ ${tech.techname} 升级至 Lv.${nextLevel}`,
    costInfo,
    ...discountInfo, // 折扣信息
    `📝 基础效果：${levelData.description}`,
    `💼 职业效果：${levelData.careerBonus}`,
  ].filter(Boolean).join('\n')
}

export async function handleWeaponUpgrade(ctx: Context, handle: string, target: string) {
  // 获取武器数据
  const weaponData = weaponConfig[target]
  const [equipment] = await ctx.database.get('ggcevo_weapons', {
    handle, weaponId: weaponData.id
  })

  // 获取职业信息
  const [careerData] = await ctx.database.get('ggcevo_sign', { handle })

  // 状态验证
  if (!equipment) return '❌ 您尚未获得该武器'

  // 武器等级上限检查（枪手为7级，其他为6级）
  const maxLevel = careerData?.career === '枪手' ? 7 : 6;
  if (equipment.level >= maxLevel) return `❌ 该武器已达最高等级(Lv.${maxLevel})`

  // ==================== 折扣计算模块 ====================
  // 基础费用表 [等级0→1, 1→2,...5→6, 6→7]
  const BASE_COST = [1050, 1450, 1850, 2250, 2650, 3050, 3450]
  const baseCost = BASE_COST[equipment.level]

  // 获取科技信息
  const weaponTechConfig = Spacestationtechnology.find(t => t.techId === 2)

  let techLevel = 0
  let totalDiscount = 0
  const discountDetails = []

  // 枪手职业折扣
  const isGunslinger = careerData?.career === '枪手';
  if (isGunslinger) {
    totalDiscount += 10
    discountDetails.push('🔫 枪手职业：10%折扣')
  }

  if (careerData?.faction === '人类联盟') {
    const [weaponTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 }).catch(() => [{ level: 0 }])

    // 计算武器系统折扣
    techLevel = Math.min(Math.max(weaponTech?.level || 0, 0), 5)
    const isCareerMatch = weaponTechConfig?.careerNames.includes(careerData?.career)

    // 折扣映射表 [等级1-5]
    const BASE_DISCOUNTS = [0, 0, 0, 0, 0]
    const CAREER_DISCOUNTS = [0, 0, 0, 0, 20]

    const baseDiscount = techLevel > 0 ? BASE_DISCOUNTS[techLevel - 1] : 0
    const careerDiscount = (isCareerMatch && techLevel > 0) ? CAREER_DISCOUNTS[techLevel - 1] : 0
    const weaponDiscount = Math.max(baseDiscount, careerDiscount)

    if (weaponDiscount > 0) {
      totalDiscount += weaponDiscount
      discountDetails.push(
        `⚙️ 武器系统Lv.${techLevel}：${weaponDiscount}%折扣`
      )
    }
  }

  // 检查并应用灵狐升运折扣
  const activeWish = await checkFoxBlessing(ctx, handle)
  if (activeWish) {
    totalDiscount += 20 // 灵狐升运的20%折扣
    discountDetails.push('🦊 灵狐升运祈愿：20%折扣')
  }

  // 计算最终费用
  totalDiscount = Math.min(totalDiscount, 100)
  const discountedCost = baseCost * (100 - totalDiscount) / 100
  const actualCost = Math.floor(discountedCost)

  // ==================== 费用验证 ====================
  const [signInfo] = await ctx.database.get('ggcevo_sign', { handle })
  if (signInfo?.totalRewards < actualCost) {
    // 仅当有折扣时才显示原价信息
    const priceInfo = totalDiscount > 0
      ? `需要${actualCost}金币(原价${baseCost}金币)`
      : `需要${actualCost}金币`;

    return `❌ ${priceInfo}，您当前拥有：${signInfo?.totalRewards || 0}金币`
  }

  // ==================== 执行升级 ====================
  // 先计算新的等级和改装槽数量
  const newLevel = equipment.level + 1;
  const newModSlots = Math.floor(newLevel / 3) + 1;

  await ctx.database.withTransaction(async () => {
    await ctx.database.set('ggcevo_sign', { handle }, {
      totalRewards: signInfo.totalRewards - actualCost
    })

    await ctx.database.set('ggcevo_weapons',
      { handle, weaponId: weaponData.id },
      {
        level: newLevel,
        modificationSlots: newModSlots
      }
    )
    if (activeWish) {
        await ctx.database.set('ggcevo_player_stats',
          { handle }, { wishUsed: true }
        )
      }
  })

  // ==================== 构建反馈消息 ====================
  // 应用传奇武器等级加成规则
  const isLegendary = weaponData.category === '传奇武器';
  const levelBonusRate = isLegendary ? 0.05 : 0.10;

  const damage = (weaponData.damage * (1 + levelBonusRate * newLevel)).toFixed(1);

  let msg = `${target} ${isLegendary ? '【传奇武器】 ' : ''}升级成功！Lv.${newLevel}`;

  // 价格信息
  const priceInfo = totalDiscount > 0
    ? `\n💸 花费：${actualCost}金币 (原价${baseCost}金币)`
    : `\n💸 花费：${actualCost}金币`
  msg += priceInfo

  // 折扣详情
  if (discountDetails.length > 0) {
    msg += `\n💰 折扣明细：\n▸ ${discountDetails.join('\n▸ ')}`
  }

  msg += `\n💥 伤害：${damage}`
  msg += `\n🔧 改装槽：${newModSlots}个`

  return msg
}

// 公共方法：灵狐升运检查
async function checkFoxBlessing(ctx: Context, handle: string) {
  return ctx.database.get('ggcevo_player_stats', {
    handle
  }).then(records => {
    const playerStats = records[0];
    const now = new Date();
    if (playerStats && playerStats.wishname === '灵狐升运' && 
        playerStats.lastWishDate <= now && 
        new Date(playerStats.lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000) >= now && 
        !playerStats.wishUsed) {
      return playerStats;
    }
    return null;
  })
}

export async function generateUpgradePriceList(ctx: Context, handle: string) {
  // 获取职业信息
  const [careerData] = await ctx.database.get('ggcevo_sign', { handle })
  const isGunslinger = careerData?.career === '枪手';
  const isAlliance = careerData?.faction === '人类联盟'; // 检查是否是人类联盟阵营

  // 初始化折扣信息
  let techLevel = 0;
  let techDiscountRate = 0;
  let hasTechDiscount = false;

  // 只有人类联盟才处理武器系统信息
  if (isAlliance) {
    // 获取折扣信息
    const [techData] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 }).catch(() => [{ level: 0 }])
    const weaponTechConfig = Spacestationtechnology.find(t => t.techId === 2)

    // 计算折扣
    techLevel = Math.min(techData?.level || 0, 5)
    const isCareerMatch = weaponTechConfig?.careerNames.includes(careerData?.career)
    const BASE_DISCOUNTS = [0, 0, 0, 0, 0]
    const CAREER_DISCOUNTS = [0, 0, 0, 0, 20]

    // 实际折扣计算
    const baseDiscount = techLevel > 0 ? BASE_DISCOUNTS[techLevel - 1] : 0
    const careerDiscount = isCareerMatch ? CAREER_DISCOUNTS[techLevel - 1] : 0
    techDiscountRate = Math.max(baseDiscount, careerDiscount)
    hasTechDiscount = techDiscountRate > 0
  }

  // 灵狐祝福检查
  const foxBlessing = await checkFoxBlessing(ctx, handle)
  const foxDiscount = foxBlessing ? 20 : 0
  const hasFoxDiscount = foxDiscount > 0

  // 枪手折扣（独立于其他折扣）
  const gunslingerDiscount = isGunslinger ? 10 : 0;
  const hasGunslingerDiscount = isGunslinger;

  // 基础价格表（枪手额外增加7级）
  const BASE_COST = [1050, 1450, 1850, 2250, 2650, 3050, 3450]
  const maxLevel = isGunslinger ? 7 : 6

  // 构建价格明细
  const priceDetails = [];
  for (let i = 0; i < maxLevel; i++) {
    const level = `${i}→${i + 1}`
    let baseCost = BASE_COST[i]
    let finalPrice = baseCost
    let discountsApplied = []

    // 收集所有折扣
    let totalDiscount = 0

    // 枪手折扣
    if (isGunslinger) {
      totalDiscount += gunslingerDiscount
      discountsApplied.push(`${gunslingerDiscount}% (枪手)`)
    }

    // 人类联盟的科技折扣
    if (isAlliance && hasTechDiscount) {
      totalDiscount += techDiscountRate
      discountsApplied.push(`${techDiscountRate}% (科技)`)
    }

    // 灵狐折扣
    if (hasFoxDiscount) {
      totalDiscount += foxDiscount
      discountsApplied.push(`${foxDiscount}% (灵狐)`)
    }

    // 计算最终价格
    if (totalDiscount > 0) {
      totalDiscount = Math.min(totalDiscount, 100)
      finalPrice = Math.floor(baseCost * (100 - totalDiscount) / 100)
    }

    // 判断是否需要显示原价
    const showOriginal = finalPrice < baseCost

    // 构建价格行
    const levelInfo = `等级 ${level.padEnd(5)}`
    const priceInfo = `▸ 价格: ${finalPrice.toString().padStart(4)}${showOriginal ? ` (原价${baseCost})` : ''}`

    // 添加折扣说明
    let discountDetail = ''
    if (discountsApplied.length > 0) {
      discountDetail = ` - 折扣总计: ${totalDiscount}% [${discountsApplied.join(', ')}]`
    }

    priceDetails.push(`${levelInfo}\n${priceInfo}`)
  }

  // 构建提示信息
  const discountNotice = []

  // ============== 折扣标题行 ==============
  if (hasTechDiscount || hasFoxDiscount || hasGunslingerDiscount) {
    discountNotice.push('💰 当前折扣：')
  }

  // 枪手折扣提示
  if (isGunslinger) {
    discountNotice.push(`▸ 🔫 枪手职业：10%折扣`)
  }

  // 人类联盟的科技折扣提示
  if (isAlliance && hasTechDiscount) {
    discountNotice.push(`▸ ⚙️ 武器系统Lv.${techLevel}：${techDiscountRate}%折扣`)
  }

  // 灵狐折扣提示
  if (hasFoxDiscount) {
    discountNotice.push(`▸ 🦊 灵狐升运祈愿：20%折扣`)
  }

  if (!hasTechDiscount && !hasFoxDiscount && !hasGunslingerDiscount) {
    // 根据不同阵营显示不同的提示信息
    if (isAlliance) {
      discountNotice.push('💡 提示：升级武器系统科技可获得折扣')
    } else if (careerData?.faction === '辛迪加海盗') {
      discountNotice.push('💡 提示：转职为枪手职业可获得折扣')
    } else {
      discountNotice.push('💡 提示：加入人类联盟或辛迪加海盗可获得折扣')
    }
  }

  // 等级上限提示
  if (isGunslinger) {
    discountNotice.push('▸ 🔝 枪手职业：武器等级上限提升至7级')
  }

  return [
    '⚡ 武器升级价格表 ⚡',
    `武器等级上限: ${maxLevel}级${isGunslinger ? ' (枪手职业)' : ''}`,
    '使用「升级武器 武器名称」对武器进行等级升级',
    ...discountNotice,
    '====================',
    ...priceDetails,
    '====================',
  ].join('\n')
}

// 封装的排名查询函数
export async function getRankInfo(ctx: Context, config: Config, handle: string) {
  // 查询用户记录
  const [user] = await ctx.database.get('ggcevo_rank', {
    handle,
    rankseason: config.rankseason
  });

  if (!user) return '暂未找到排名信息。';
  if (user.Blacklist) return '❌ 该用户已被禁止参加本赛季胜点榜。';

  // 计算全服排名
  const allRanks = await ctx.database.select('ggcevo_rank')
    .where({ Blacklist: false, rankseason: config.rankseason })
    .orderBy('rank', 'desc')
    .execute();

  const userRank = allRanks.findIndex(u => u.handle === handle) + 1;

  // 敏感词处理
  const isSafe = await checkSensitiveWord(ctx, user.name);
  const displayName = isSafe ? user.name : (user.name[0] || '') + '***';

  // 构建响应信息
  return `🎮 咕咕排名信息 🎮\n` +
    '------------------------------\n' +
    `昵称：${displayName}\n` +
    `句柄：${user.handle}\n` +
    `当前积分：${user.rank}\n` +
    `参赛次数：${user.matches} 次\n` +
    `胜率：${user.matches === 0
      ? '0.00%'
      : (user.wins / user.matches * 100).toFixed(2) + '%'
    }\n` +
    `全服排名：第 ${userRank} 名\n` +
    '------------------------------';
}

// 新增辅助函数：检查保护卡状态
export function isWithinProtection(protections: any[]) {
  const now = new Date();
  return protections.some(p =>
    p.status === 'active' &&
    now >= p.startTime &&
    now <= p.endTime
  );
}

export function formatTime(date: Date) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 定义传奇武器折扣配置
export const legendaryDiscounts = {
  'MK-4激光步枪': ['能量武器专家'],
  'M4AE脉冲步枪': ['枪手'],
  'DSR-55反器材步枪': ['猩红杀手'],
  '龙息霰弹枪': ['纵火狂'],
  'DG-3电弧步枪': ['征募官'],
  '光剑': ['指挥官'],
  '外星电浆': ['装甲兵'],
  '核聚变重炮': ['破坏者']
};

// 使用内存存储竞猜项目配置
export const GUESSING_ITEMS = [
  {
    id: 1,
    description: '猜测下一个复活主宰的名字',
    odds: 5,
    minBet: 100,
    maxBet: 1000,
    status: 'open',
  },
  // 可以继续添加更多竞猜项目
  // { id: 2, description: '其他竞猜项目', odds: 2.5, status: 'closed' },
];

// 宵禁检查函数（固定18:00-24:00）
export function fixedCurfewCheck(session, config: Config): true | false {
  // 1. 未开启宵禁或私聊均放行
  if (!config.enableCurfew || session.isDirect) return true;

  // 2. 获取当前北京时间 (UTC+8)
  const now = new Date();
  const hours = now.getUTCHours() + 8;
  const currentHour = hours >= 24 ? hours - 24 : hours;

  // 3. 检查是否在固定宵禁时段 (18:00-24:00)
  if (currentHour >= 18 && currentHour < 24) {
    // 改为返回 false 而不提示信息
    return false;
  }

  return true;
}

/**
 * 私聊宵禁检查函数
 * 在非固定宵禁时段（18:00-24:00之外）禁止私聊
 * @param session 会话对象
 * @param config 配置对象
 * @returns 是否允许私聊
 */
export function privateChatCurfewCheck(session, config: Config): boolean {
  // 1. 未开启宵禁或非私聊直接放行
  if (!config.enableCurfew || !session.isDirect) return true;

  // 2. 获取当前北京时间 (UTC+8)
  const now = new Date();
  const hours = now.getUTCHours() + 8;
  const currentHour = hours >= 24 ? hours - 24 : hours;

  // 3. 检查是否在固定宵禁时段外 (00:00-18:00)
  if (currentHour < 18) {
    return false; // 非宵禁时段禁止私聊
  }

  return true; // 宵禁时段允许私聊
}

// 新增辅助函数：生成半日标识（格式：年月日_上午/下午）
export function getHalfDayIdentifier(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const period = date.getHours() < 12 ? 'am' : 'pm';
  return `${year}${month}${day}_${period}`;
}

// 初始化权重表（完全在内存处理）
export async function initWeights(ctx) {
  for (const group of bossGroups) {
    await ctx.database.create('ggcevo_boss_weights', {
      groupId: group.groupId,
      weight: 100,
      lastSpawn: new Date(0) // 设置为遥远的过去
    });
  }
}

// 权重更新逻辑（采用循环更新）
export async function updateWeights(ctx: Context, selectedId: number) {
  // 获取所有权重记录
  const allWeights = await ctx.database.get('ggcevo_boss_weights', {});

  // 逐条更新权重记录
  for (const weight of allWeights) {
    if (weight.groupId === selectedId) {
      // 选中的BOSS组权重设为固定值50
      await ctx.database.set('ggcevo_boss_weights', { groupId: weight.groupId }, {
        weight: 50,
        lastSpawn: new Date()
      });
    } else {
      // 其他BOSS组权重增加20%（最高500）
      const newWeight = Math.min(500, Math.floor(weight.weight * 1.2));
      await ctx.database.set('ggcevo_boss_weights', { groupId: weight.groupId }, {
        weight: newWeight,
        lastSpawn: weight.lastSpawn
      });
    }
  }
}

// Buff配置
export const buffConfig = [
  {
    id: 1,
    name: 'E-2能量炸弹',
    effects: '下一次攻击对建筑目标造成1000%的伤害'
  }
];
