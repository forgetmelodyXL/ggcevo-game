import { Context } from 'koishi'
import { weaponConfig } from '../weapons'
import { SyndicatedItems } from '../items'

// 空间站船员职业配置项
export const spaceStationCrewConfig = [
  {
    professionName: '深空矿工',
    effect: '挖矿的金币收益提高50%',
    requirements: '挖矿累计金币收益达到500金币',
    Jobtransfer: true,
    costcoins: 2000,
  },
  {
    professionName: '警卫员下士',
    effect: '攻击获得的金币+50%',
    requirements: '当期伤害榜累计造成100及以上伤害',
    Jobtransfer: true,
    costcoins: 2000,
  },
  {
    professionName: '警卫长',
    effect: '攻击伤害+5%，当有异形被击败时获得金币(击败者获得双倍金币)',
    requirements: '当期伤害榜累计攻击4次及以上',
    Jobtransfer: false,
    costcoins: 3000,
  },
  {
    professionName: '武器中士',
    effect: '攻击伤害+15%; 购买传奇武器无需权限次数（第一次购买将消耗权限次数半价购买传奇武器）',
    requirements: '至少拥有一把6级及以上等级的武器',
    Jobtransfer: true,
    costcoins: 3000,
  },
  {
    professionName: '医疗专家',
    effect: '',
    requirements: '',
    Jobtransfer: false,
    costcoins: 2000,
  },
  {
    professionName: '情报副官',
    effect: '升级空间站科技享有10%的折扣',
    requirements: '至少一个空间站科技等级≥5级',
    Jobtransfer: true,
    costcoins: 3000,
  },
  {
    professionName: '总工程师',
    effect: '探索获得的金币收益提高50%；探索的成功率提高10%',
    requirements: '探索次数达到4次及以上',
    Jobtransfer: true,
    costcoins: 2000,
  },
  {
    professionName: '舰长',
    effect: '完成任务奖励+50%',
    requirements: '累计完成4次及以上任务',
    Jobtransfer: true,
    costcoins: 2000,
  },
  {
    professionName: '机械化专家',
    effect: '机甲形态攻击伤害+50%',
    requirements: '',
    Jobtransfer: false,
    costcoins: 3000,
  },
  {
    professionName: '联盟新兵',
    effect: '你只是一个普通人',
    requirements: '无',
    Jobtransfer: false,
    costcoins: 0,
  },
]

// 辛迪加海盗职业配置项
export const syndicatePirateConfig = [
  {
    professionName: '能量武器专家',
    effect: '能量武器攻击伤害+20%; 购买MK-4激光步枪(传奇)享有50%的折扣',
    requirements: '至少拥有一把3级及以上等级的能量武器',
    Jobtransfer: true,
    costredcrystal: 30,
  },
  {
    professionName: '清洁工',
    effect: '每次攻击额外获得1枚红晶，每造成100伤害额外获得1枚红晶（至多额外获得3枚）',
    requirements: '当期伤害榜累计攻击4次及以上',
    Jobtransfer: false,
    costredcrystal: 20,
  },
  {
    professionName: '枪手',
    effect: '武器等级上限为7级; 升级武器享有10%的折扣; 购买M4AE脉冲步枪(传奇)享有50%的折扣',
    requirements: '至少拥有一把6级及以上等级的武器',
    Jobtransfer: true,
    costredcrystal: 40,
  },
  {
    professionName: '猩红杀手',
    effect: '“侦察步枪”攻击伤害+15%; 使用“侦察步枪”攻击时每1点护甲改为减少0点伤害; 购买DSR-55反器材步枪(传奇)享有50%的折扣',
    requirements: '“侦察步枪”武器等级≥3级',
    Jobtransfer: true,
    costredcrystal: 30,
  },
  {
    professionName: '纵火狂',
    effect: '热能武器攻击伤害+20%; 探索获得莫洛托夫燃烧弹的概率提高20%并且有10%的概率额外获得1个；使用莫洛托夫燃烧弹的效果提高100%；购买龙息霰弹枪(传奇)享有50%的折扣',
    requirements: '至少拥有一把3级及以上等级的热能武器',
    Jobtransfer: true,
    costredcrystal: 30,
  },
  {
    professionName: '辛迪加财务经理',
    effect: '每日签到能额外获得5枚红晶',
    requirements: '当月累计签到14天及以上',
    Jobtransfer: true,
    costredcrystal: 20,
  },
  {
    professionName: '计算机专家',
    effect: '黑市订购设备工具类享有50%折扣; 主动发起的PK胜率提高10%； 每日主动PK次数增加3次',
    requirements: '仓库中至少拥有一个黑市订购的设备工具类物品',
    Jobtransfer: true,
    costredcrystal: 20,
  },
  {
    professionName: '指挥官',
    effect: '使用红晶升级物品享有50%的折扣；升级物品时有50%的概率获得双倍加成；购买光剑（传奇）享有50%的折扣',
    requirements: '仓库中至少拥有一个升级5次及以上的物品',
    Jobtransfer: true,
    costredcrystal: 30,
  },
  {
    professionName: '装甲兵',
    effect: '所有武器额外拥有一个改装槽；武器改装任意模块享有10%的折扣；购买外星电浆（传奇）享有50%的折扣',
    requirements: '至少拥有一把改装3个模块的武器',
    Jobtransfer: false,
    costredcrystal: 40,
  },
  {
    professionName: '破坏者',
    effect: '黑市订购爆破物类享有50%折扣；探索获得爆破物的概率提高20%并且有10%的概率额外获得1个；使用爆破物的效果提高50%；购买核聚变重炮（传奇）享有50%的折扣',
    requirements: '仓库中至少拥有一个爆破物类物品',
    Jobtransfer: true,
    costredcrystal: 30,
  },
  {
    professionName: '征募官',
    effect: '购买DG-3电弧步枪（传奇）享有50%的折扣',
    requirements: 'PK胜利20次及以上',
    Jobtransfer: false,
    costredcrystal: 20,
  },
  {
    professionName: '辛迪加炮灰新兵',
    effect: '你只是一个炮灰',
    requirements: '无',
    Jobtransfer: false,
    costredcrystal: 0,
  },
]

// 新增条件验证函数
export async function checkTransferRequirements(ctx: Context, handle: string, profession: string): Promise<{ success: boolean; message?: string }> {
  const [mainBoss] = await ctx.database.get('ggcevo_boss', {
    type: '主宰',
    isActive: true
  });

  const [signData] = await ctx.database.get('ggcevo_sign', { handle });
  const [careerData] = await ctx.database.get('ggcevo_careers', { handle });
  const damageRecords = await ctx.database.get('ggcevo_boss_damage', { handle });

  const totalAttack = damageRecords.reduce((sum, r) => sum + r.attackCount, 0);
  const totalDamage = damageRecords.reduce((sum, r) => sum + r.totalDamage, 0);

  const weapons = await ctx.database.get('ggcevo_weapons', {
    handle,
    level: { $gte: 3 }
  });

  let hasLevel6Weapon = false

  switch (profession) {
    case '深空矿工':
      // 获取挖矿记录
      const [miningRecord] = await ctx.database.get('ggcevo_Mining', { handle });
      const totalMined = miningRecord?.totalMined || 0;

      return {
        success: totalMined >= 500,
        message: totalMined >= 500 ? '' : `需要挖矿累计收益达到500金币(当前${totalMined}金币)`
      };

    // +++ 新增总工程师检查 +++
    case '总工程师': {
      const exploreRecords = await ctx.database.get('ggcevo_explore', { handle });
      const totalReturns = exploreRecords.reduce((sum, r) => sum + (r.returns || 0), 0);

      return {
        success: totalReturns >= 4,
        message: totalReturns >= 4
          ? ''
          : `需要探索返回次数达到4次及以上(当前${totalReturns}次)`
      };
    }

    case '警卫长':
      if (!mainBoss) return { success: false, message: '当前暂无伤害榜。' };
      return {
        success: totalAttack >= 4,
        message: `需要当期伤害榜累计攻击4次及以上(当前${totalAttack}次)`
      };

    case '警卫员下士': {
      if (!mainBoss) return { success: false, message: '当前暂无伤害榜。' };
      return {
        success: totalDamage >= 100,
        message: `需要当期伤害榜累计造成100及以上伤害(当前${totalDamage})`
      };
    }

    case '武器中士':
      // 检查是否拥有6级及以上武器
      hasLevel6Weapon = weapons.some(weapon => weapon.level >= 6);
      return {
        success: hasLevel6Weapon,
        message: hasLevel6Weapon ? '' : '需要至少拥有一把6级及以上等级的武器'
      };

    // +++ 新增舰长检查 +++
    case '舰长': {
      const taskRecords = await ctx.database.get('ggcevo_task', { handle });
      const totalCompletions = taskRecords.reduce(
        (sum, task) => sum + (task.Completions || 0),
        0
      );

      return {
        success: totalCompletions >= 4,
        message: totalCompletions >= 4
          ? ''
          : `需要累计完成4次及以上任务(当前${totalCompletions}次)`
      };
    }

    case '情报副官':
      const techs = await ctx.database.get('ggcevo_tech', { handle });
      const hasValidTech = techs.some(t => t.level >= 5);
      return {
        success: hasValidTech,
        message: hasValidTech ? '' : '需要至少一个空间站科技等级≥5级'
      };

    case '能量武器专家':
      const hasEnergyWeapon = weapons.some(weapon => {
        const weaponConfigEntry = Object.values(weaponConfig).find(c => c.id === weapon.weaponId);
        return weaponConfigEntry?.type === '能量武器';
      });
      return {
        success: hasEnergyWeapon,
        message: `需要至少拥有一把3级及以上等级的能量武器`
      };

    case '纵火狂':
      const hasthermalWeapon = weapons.some(weapon => {
        const weaponConfigEntry = Object.values(weaponConfig).find(c => c.id === weapon.weaponId);
        return weaponConfigEntry?.type === '热能武器';
      });
      return {
        success: hasthermalWeapon,
        message: `需要至少拥有一把3级及以上等级的热能武器`
      };

    case '猩红杀手': {
      const scoutRifle = weapons.find(weapon => weapon.weaponId === 7)
      return {
        success: !!scoutRifle,
        message: scoutRifle ? '' : '需要“侦察步枪”武器等级≥3级'
      }
    };

    case '枪手':
      // 检查是否拥有6级及以上武器
      hasLevel6Weapon = weapons.some(weapon => weapon.level >= 6);
      return {
        success: hasLevel6Weapon,
        message: hasLevel6Weapon ? '' : '需要至少拥有一把6级及以上等级的武器'
      };

    case '破坏者':
      // 从仓库获取所有物品
      const warehouseItems = await ctx.database.get('ggcevo_warehouse', { handle });

      // 定义黑市爆破物物品ID列表
      const blackMarketExplosives = Object.values(SyndicatedItems)
        .filter(item => item.type === '爆破物' && item.redCrystalCost >= 0)
        .map(item => item.id);

      // 检查仓库中是否有符合条件的黑市爆破物
      const hasExplosive = warehouseItems.some(item =>
        blackMarketExplosives.includes(item.itemId) && item.quantity >= 0
      );

      return {
        success: hasExplosive,
        message: hasExplosive ? '' : '需要仓库中拥有一个爆破物类物品'
      };

    case '装甲兵': {
      // 获取用户的所有武器
      const userWeapons = await ctx.database.get('ggcevo_weapons', {
        handle,
      });

      // 检查是否有任何武器的installedMods数组长度 >= 3
      const hasModifiedWeapon = userWeapons.some(weapon =>
        weapon.installedMods && weapon.installedMods.length >= 3
      );

      return {
        success: hasModifiedWeapon,
        message: hasModifiedWeapon ? '' : '需要至少拥有一把改装了3个模块的武器'
      };
    }


    case '征募官': {
      // 获取玩家的PK数据
      const [pkProfile] = await ctx.database.get('ggcevo_pk', { handle });

      if (!pkProfile) {
        return {
          success: false,
          message: '没有PK记录，需要PK胜利20次及以上'
        };
      }

      return {
        success: pkProfile.wins >= 20,
        message: pkProfile.wins >= 20
          ? ''
          : `需要PK胜利20次及以上(当前${pkProfile.wins}次)`
      };
    }

    case '清洁工':
      if (!mainBoss) return { success: false, message: '当前暂无伤害榜。' };
      return {
        success: totalAttack >= 4,
        message: `需要当期伤害榜累计攻击4次及以上(当前${totalAttack}次)`
      };

    case '辛迪加财务经理':
      return {
        success: signData?.monthlyDays >= 14,
        message: `需要当月累计签到14天及以上(当前${signData?.monthlyDays || 0}天)`
      };

    case '计算机专家': {
      // 从仓库获取所有物品
      const warehouseItems = await ctx.database.get('ggcevo_warehouse', { handle });

      // 定义黑市设备工具物品ID列表
      const blackMarketDeviceTools = Object.values(SyndicatedItems)
        .filter(item => item.type === '设备工具' && item.redCrystalCost > 0)
        .map(item => item.id);

      // 检查仓库中是否有符合条件的黑市设备工具
      const hasDeviceTool = warehouseItems.some(item =>
        blackMarketDeviceTools.includes(item.itemId) && item.quantity > 0
      );

      return {
        success: hasDeviceTool,
        message: hasDeviceTool ? '' : '需要仓库中拥有一个从黑市订购的设备工具物品'
      };
    }

    case '指挥官': {
      // 获取玩家仓库所有物品
      const warehouseItems = await ctx.database.get('ggcevo_warehouse', {
        handle
      });

      // 检查是否有物品升级次数≥5
      const hasUpgradedItem = warehouseItems.some(item =>
        (item.upgrades || 0) >= 5
      );

      return {
        success: hasUpgradedItem,
        message: hasUpgradedItem ? '' : '需要仓库中至少拥有一个升级5次及以上的物品'
      };
    }



    default:
      return { success: false, message: '未知职业要求' };
  }
}