import { Context, Schema, h, $ } from 'koishi'
import 'koishi-plugin-sc2arcade-search'
import { weaponConfig, modConfig } from './weapons'
import { PlayerStats } from './database'
import { SyndicatedItems, initDefaultItems, itemConfig } from './items'
import { spaceStationCrewConfig, syndicatePirateConfig } from './careers'
import { Spacestationtechnology } from './technology'
import { Tasklist } from './tasks'
import { bossPool, bossGroups } from './boss/boss'
import { battleStatsMap } from './boss/BattleEffectProcessor'
import { passiveConfig } from './boss/passive'
import { wishConfig } from './wish'
import { ggcevoUpdates, compareVersions } from './update'
import { gachaWithPity, checkSensitiveWord, getRandomInt, PetCapsuleToy, isSameDate, convertUTCtoChinaTime, formatDate, createHpBar, activateNextBossGroup, calculateTotalPower, handleWeaponUpgrade, handleTechUpgrade, applyItemEffect, generateUpgradePriceList, getRankInfo, formatTime, legendaryDiscounts, GUESSING_ITEMS, fixedCurfewCheck, privateChatCurfewCheck, getHalfDayIdentifier, initWeights, updateWeights } from './utils'
import { handleAttack, handleScatterAttack, handleDeathTargets, calculateRewards, updateSignRecord, buildResultMessage, handleBroadcasts, updateBossDamageRecord, updateTaskProgress, testAttackFunction, verifyFinalBlow } from './boss/attackhandling'
import { spaceship, galaxy } from './spaceship'


export const name = 'ggcevo-game'

export const inject = {
  required: ['database'],
}

export interface Config {
  proxyAgent: string
  rankseason: string
  autorank: boolean
  ignoreGlobalLimit: boolean
  groupId: string[]
  dailyPKLimit: number
  sameOpponentLimit: boolean  // 同对手限制开关
  maxDailyBeChallenged: number // 每日被挑战次数限制
  unlimitedBossAttack: boolean // 无限制攻击主宰开关
  enableCurfew: boolean       // 是否开启宵禁模式
  enablePlayRequirement: boolean

  enableMatchesRequirement: boolean  // 新增：是否需要场次需求开关
  enableExchangeCouponForResource: boolean // 是否允许用兑换券兑换资源兑换券
}

export const Config: Schema<Config> = Schema.intersect([
  // 基础配置组
  Schema.object({
    proxyAgent: Schema.string()
      .description('代理服务器地址'),
    enablePlayRequirement: Schema.boolean() // 新增配置项
      .description('开启签到需3天游戏记录(关闭时无限制)').default(false),
    enableCurfew: Schema.boolean()
      .description('是否开启宵禁模式(18:00-24:00禁止群聊指令)').default(false),

  }).description('基础设置'),

  // 赛季与兑换配置组
  Schema.object({
    rankseason: Schema.string()
      .description('当前赛季名称(影响兑换系统)').default('S1'),
    autorank: Schema.boolean()
      .description('自动同步天梯数据').default(false),
    ignoreGlobalLimit: Schema.boolean()
      .description('禁用全局兑换限制(谨慎开启)').default(false),
    enableMatchesRequirement: Schema.boolean()  // 新增配置项
      .description('兑换物品是否需要场次需求').default(true),  // 默认开启
    enableExchangeCouponForResource: Schema.boolean()
      .description('是否允许用兑换券兑换资源兑换券').default(false),
  }).description('赛季配置'),

  // 对战系统配置组
  Schema.object({
    dailyPKLimit: Schema.number()
      .description('每日最大发起PK次数').default(3),
    sameOpponentLimit: Schema.boolean()
      .description('同玩家每日单次限制').default(true),
    maxDailyBeChallenged: Schema.number()
      .description('最大被挑战次数(0=无限制)').default(5),
    unlimitedBossAttack: Schema.boolean()
      .description('开启无限制PVE攻击').default(false),
  }).description('对战限制'),

  // 通知系统配置组
  Schema.object({
    groupId: Schema.array(Schema.string())
      .description('咕咕之战广播通知群组').default([]),
  }).description('通知设置').collapse(),



])

export function apply(ctx: Context, config: Config) {
  // write your plugin here

  ctx.model.extend('ggcevo_backpack', {
    handle: 'string',
    itemId: 'unsigned',
    quantity: 'unsigned',
  }, {
    primary: ['handle', 'itemId'],
  })

  ctx.model.extend('ggcevo_sign', {
    handle: 'string',//句柄
    name: 'string', // 玩家名称
    lastSign: 'timestamp',//最后签到时间
    monthlyDays: 'unsigned',  // 当月累计签到天数
    totalRewards: 'unsigned',//金币数量
    totalPulls: 'unsigned',//累计抽奖次数
    pityCounter: 'unsigned',//当前保底次数
    fullPityCount: 'unsigned', // 吃满保底的次数
    bigPrizeCount: 'unsigned',//累计抽中次数
    faction: 'string', // 阵营的英文字段
    career: 'string', // 职业
    redcrystal: 'unsigned', // 红水晶
    syndicateCareer: 'string', // 辛迪加职业
    hp: 'unsigned', // HP值
  }, {
    primary: 'handle'
  })

  ctx.model.extend('ggcevo_welfare', {
    handle: 'string',
    activity: 'unsigned',
    lastdate: 'timestamp'
  }, {
    primary: ['handle', 'activity']
  })

  ctx.model.extend('ggcevo_activity', {
    id: 'unsigned',
    name: 'string',        // 存储活动名称
    description: 'text',
    quantity: 'unsigned',
    itemId: 'unsigned',   // 新增物品ID字段
    endTime: 'timestamp'
  }, {
    primary: 'id',
    autoInc: true
  })

  ctx.model.extend('ggcevo_rank', {
    handle: 'string',
    name: 'string',         // 玩家名称
    rank: 'integer',         // rank分数（带正负）
    wins: 'unsigned',         // 胜场
    matches: 'unsigned',         // 比赛次数
    rankseason: 'string',
    Blacklist: {
      type: 'boolean',
      initial: false,
    },
  }, {
    primary: ['handle', 'rankseason']
  })

  ctx.model.extend('ggcevo_exchange', {
    userId: 'string',
    handle: 'string',    // 句柄
    item: 'string',      // 兑换物品
    type: 'string',
    date: 'timestamp',
    GlobalLimit: 'boolean',
    season: 'string', // 新增赛季字段
  }, {
    primary: ['handle', 'item']
  })

  ctx.model.extend('ggcevo_adminbenefit', {
    userId: 'string',
    handle: 'string',
    signmonth: 'unsigned',
    lastSign: 'timestamp',
  }, {
    primary: 'userId',
  })

  ctx.model.extend('ggcevo_player_stats', {
    handle: 'string',
    total: 'unsigned',
    wins: 'unsigned',
    todayCount: 'unsigned',
    lastPK: 'timestamp',
    totalDamage: 'unsigned',
    attackCount: 'unsigned',
    lastattackDate: 'timestamp',
    wishname: 'string',
    wishUsed: 'boolean',
    lastWishDate: 'timestamp',
    miningStartTime: 'timestamp',
    totalMined: 'unsigned',
    spaceshipId: 'unsigned',
    exploreStartTime: 'timestamp',
    galaxy: 'string',
    exploreSuccessCount: 'unsigned',
    plunderBonus: 'integer',
    totalExploreGold: 'unsigned',
    totalExploreItems: 'unsigned',
    buff: 'json'
  }, {
    primary: 'handle'
  })

  ctx.model.extend('ggcevo_pk_logs', {
    id: 'unsigned',
    initiator_handle: 'string',
    target_handle: 'string',
    date: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
  })

  ctx.model.extend('ggcevo_weapons', {
    handle: 'string',
    weaponId: 'unsigned',
    level: 'unsigned',
    modificationSlots: 'unsigned',
    installedMods: 'list',
    equipped: 'boolean',
    comboCount: 'unsigned', // 新增：记录连续攻击次数的计数器
    pityCounter: 'unsigned',
  }, {
    primary: ['handle', 'weaponId']
  })

  ctx.model.extend('ggcevo_boss', {
    name: 'string',
    type: 'string',
    HP: 'unsigned',
    energy: 'unsigned',
    armorReductionLayers: 'unsigned',
    tags: 'list',
    skills: 'list',
    skillStacks: 'unsigned',
    skillStatus: 'unsigned',
    statusLayers: 'unsigned',
    radiationLayers: 'unsigned',
    coldLayers: 'unsigned',
    burnLayers: 'unsigned',
    lastWeaponName: 'string',
    isActive: 'boolean',
    respawnTime: 'timestamp',
  }, {
    primary: 'name'
  })





  ctx.model.extend('ggcevo_boss_weights', {
    groupId: 'unsigned',
    weight: 'unsigned',
    lastSpawn: 'timestamp',
  }, {
    primary: 'groupId',
  })





  ctx.model.extend('ggcevo_tech', {
    handle: 'string',
    techId: 'unsigned',
    level: 'unsigned',
  }, {
    primary: ['handle', 'techId'],
  })



  ctx.model.extend('ggcevo_task', {
    handle: 'string',
    taskId: 'unsigned',
    progress: 'unsigned',
    Completions: 'unsigned',
  }, {
    primary: ['handle', 'taskId'],
  })

  ctx.command('ggcevo/抽奖')
    .action(async (argv) => {
      const session = argv.session;



      let winCount = 0;

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });

      if (!profile) {
        return '🔒 需要先绑定游戏句柄。';
      }

      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 检查签到记录是否存在
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle });
      if (!record) {
        return '📅 请先进行一次签到后再进行抽奖。';
      }

      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle: handle, itemId: 1 })
      const quantity = backpack?.quantity || 0;
      if (quantity < 1) {
        return "您背包内的咕咕币不足。"
      }

      await ctx.database.upsert('ggcevo_backpack', [{
        handle,
        itemId: 1,
        quantity: 0
      }])

      for (let i = 0; i < quantity; i++) {
        const result = await gachaWithPity(ctx, handle)
        if (result) winCount++
      }

      // 重新获取最新的保底进度
      const [updatedRecord] = await ctx.database.get('ggcevo_sign', { handle: handle });

      return [
        `🎰 您使用了${quantity}枚咕咕币`,
        winCount > 0 ?
          `🎉 其中获得${winCount}张兑换券！` :
          '💔 本次未获得任何兑换券',
        `📊 当前保底进度：${updatedRecord?.pityCounter || 0}/90`
      ].join('\n')
    });

  ctx.command('ggcevo/单抽')
    .action(async (argv) => {
      const session = argv.session;



      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });

      if (!profile) {
        return '🔒 需要先绑定游戏句柄。';
      }

      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 检查签到记录是否存在
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle });
      if (!record) {
        return '📅 请先进行一次签到后再进行抽奖。';
      }

      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle: handle, itemId: 1 })
      if (backpack?.quantity < 1) {
        return "您背包内的咕咕币不足。"
      }
      await ctx.database.upsert('ggcevo_backpack', [{
        handle,
        itemId: 1,
        quantity: backpack.quantity - 1
      }])

      const result = await gachaWithPity(ctx, handle)
      const [updatedRecord] = await ctx.database.get('ggcevo_sign', { handle: handle })
      return [
        `${result ? '🎉 获得兑换券！' : '❌ 未中奖'} 保底进度：${updatedRecord.pityCounter}/90`
      ].join('\n')
    });

  ctx.command('ggcevo/十连抽')
    .action(async (argv) => {
      const session = argv.session;



      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });

      if (!profile) {
        return '🔒 需要先绑定游戏句柄。';
      }

      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 检查签到记录是否存在
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle });
      if (!record) {
        return '📅 请先进行一次签到后再进行抽奖。';
      }

      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle: handle, itemId: 1 })
      if (backpack?.quantity < 10) {
        return "您背包内的咕咕币不足。"
      }
      await ctx.database.upsert('ggcevo_backpack', [{
        handle,
        itemId: 1,
        quantity: backpack.quantity - 10
      }])

      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(await gachaWithPity(ctx, handle))
      }
      const [updatedRecord] = await ctx.database.get('ggcevo_sign', { handle: handle })
      return [
        '十连抽结果：',
        ...results.map(r => r ? '🎉 获得兑换券' : '❌ 未中奖'),
        `保底进度：${updatedRecord.pityCounter}/90`
      ].join('\n')
    });

  ctx.command('ggcevo/背包')
    .action(async (argv) => {
      const session = argv.session;



      // 获取玩家档案
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      // 构建唯一句柄
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle });
      if (!record) {
        return '📅 请先进行一次签到后再查看背包。';
      }

      // 获取背包物品并过滤数量为0的条目
      const items = await ctx.database.get('ggcevo_backpack', { handle });
      const validItems = items.filter(item => item.quantity > 0);

      // 生成物品详情（优化描述为空的情况）
      const itemDetails = validItems.map(userItem => {
        const entry = Object.entries(initDefaultItems).find(
          ([, item]) => item.id === userItem.itemId
        );

        if (!entry) return `未知物品 x ${userItem.quantity}：数据异常，请联系管理员`;

        const [itemName, itemData] = entry;
        // 根据描述是否为空决定显示格式
        return itemData.description
          ? `${itemName} x ${userItem.quantity}：${itemData.description}`
          : `${itemName} x ${userItem.quantity}`;
      });

      // 构建背包信息
      let backpackInfo = `【${session.username}的背包】\n`;

      // 添加金币数量
      backpackInfo += `💰 金币：${record.totalRewards}\n`;

      // 添加红晶数量（仅当阵营为辛迪加海盗时）
      if (record.faction === '辛迪加海盗') {
        backpackInfo += `💎 红晶：${record.redcrystal || 0}\n`;
      }

      // 添加物品列表
      if (validItems.length > 0) {
        backpackInfo += `\n物品：\n${itemDetails.join('\n')}`;
      } else {
        backpackInfo += '\n物品：您的背包空空如也。';
      }

      return backpackInfo;
    });

  ctx.command('ggcevo/签到')
    .action(async (argv) => {
      try {
        const session = argv.session;



        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });

        if (!profile) return '🔒 需要先绑定游戏句柄。';

        const { regionId, realmId, profileId } = profile;
        const handle = `${regionId}-S2-${realmId}-${profileId}`;

        // 获取全局配置
        const config = ctx.config;



        // 获取当前中国时间
        const now = new Date();
        const currentChinaTime = convertUTCtoChinaTime(now);

        // 处理签到记录
        const [record] = await ctx.database.get('ggcevo_sign', { handle });
        const [backpack] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 1 });

        // 检查今天是否已签到
        if (record) {
          const lastSignChina = convertUTCtoChinaTime(record.lastSign);
          if (lastSignChina.getUTCDate() === currentChinaTime.getUTCDate()) {
            return `您今天已经签到过了！本月累计签到${record.monthlyDays}天。`;
          }
        }

        // 条件检查游戏记录（仅在配置开启时）
        let hasRecentPlay = true; // 默认视为有记录
        const messages = [];

        // 仅当配置开启时才检查游戏记录
        if (config.enablePlayRequirement) {
          const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

          try {
            const requestOptions = config.proxyAgent ? { proxyAgent: config.proxyAgent } : undefined;
            const matchData = await ctx.http.get(
              `https://api.sc2arcade.com/profiles/${regionId}/${realmId}/${profileId}/matches?orderDirection=desc`,
              requestOptions
            );

            hasRecentPlay = matchData.results.some(match => {
              const matchDate = new Date(match.date);
              return matchDate >= threeDaysAgo;
            });

            // 添加警告信息（仅当没有检测到记录时）
            if (!hasRecentPlay) {
              messages.push('⚠️ 未检测到最近3天游戏记录：无法获得咕咕币');
            }

          } catch (apiError) {
            console.error('游戏记录API请求失败:', apiError);
            // 仅在配置开启时显示API错误警告
            messages.push('⚠️ 游戏记录验证失败：无法获得咕咕币');
            hasRecentPlay = false;
          }
        }

        // 计算月份变化
        let monthlyDays = 1;
        if (record) {
          const lastSignChina = convertUTCtoChinaTime(record.lastSign);
          if (
            currentChinaTime.getUTCFullYear() !== lastSignChina.getUTCFullYear() ||
            currentChinaTime.getUTCMonth() !== lastSignChina.getUTCMonth()
          ) {
            // 跨月重置
            monthlyDays = 1;
          } else {
            monthlyDays = record.monthlyDays + 1;
          }
        }

        // 初始化加成系统
        let totalBonus = 0;

        // 基础咕咕币计算（考虑配置状态）
        let baseTickets = 0;
        // 只有满足以下条件之一才能获得咕咕币：
        //   a) 配置关闭（不要求游戏记录）
        //   b) 配置开启且检测到游戏记录
        if (!config.enablePlayRequirement || hasRecentPlay) {
          if (monthlyDays < 7) baseTickets = 3;
          else if (monthlyDays === 7) baseTickets = 4;
          else if (monthlyDays === 14) baseTickets = 5;
          else if (monthlyDays === 21) baseTickets = 6;
          else if (monthlyDays === 28) baseTickets = 7;
          else baseTickets = 3;
        }

        // 根据签到天数设置不同的金币范围
        let basePoints;
        if (monthlyDays === 7) {
          // 第七天：150-200金币
          basePoints = getRandomInt(150, 200);
        } else if (monthlyDays === 14) {
          // 第14天：200-250金币
          basePoints = getRandomInt(200, 250);
        } else if (monthlyDays === 21) {
          // 第21天：250-300金币
          basePoints = getRandomInt(250, 300);
        } else if (monthlyDays === 28) {
          // 第28天：300-350金币
          basePoints = getRandomInt(300, 350);
        } else {
          // 其他时间：100-150金币
          basePoints = getRandomInt(100, 150);
        }

        // 获取职业信息
        const [careerData] = await ctx.database.get('ggcevo_sign', { handle });

        // 人类联盟基础加成
        if (careerData?.faction === '人类联盟') {
          totalBonus += 0.5;
          messages.push(`🏛️ 人类联盟阵营：+50%金币`);
        }

        // 辛迪加海盗加成
        if (careerData?.faction === '辛迪加海盗') {
          const [cred17Item] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 1003 });
          if (cred17Item?.quantity >= 1) {
            const credBonus = 0.50;
            totalBonus += credBonus;
            const totalBonusPercent = Math.round(credBonus * 100);
            messages.push(`💎 CRED-17生效：+${totalBonusPercent}%金币`);
          }
          
        }

        // 计算基础加成后的金币和咕咕币
        let baseFinalPoints = Math.round(basePoints * (1 + totalBonus));
        let baseFinalTickets = baseTickets;

        // 喵喵财源效果
        const [playerStats] = await ctx.database.get('ggcevo_player_stats', {
          handle
        });
        const meowEffect = playerStats && playerStats.wishname === '喵喵财源' &&
          playerStats.lastWishDate <= now &&
          new Date(playerStats.lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000) >= now &&
          !playerStats.wishUsed ? playerStats : null;

        let multiplier = 1.0;
        if (meowEffect) {
          multiplier = 2.0;
          messages.push('🐾 喵喵财源祈愿：金币×2，咕咕币x2');
        }

        // 应用喵喵财源乘数
        const finalPoints = Math.round(baseFinalPoints * multiplier);
        const finalTickets = Math.round(baseFinalTickets * multiplier);

        // 红晶奖励处理（不受游戏记录影响）
        let redCrystal = 0;
        if (careerData?.faction === '辛迪加海盗') {
          redCrystal = 3;
          messages.push('💎 辛迪加海盗阵营：+3枚红晶');
          
          // 辛迪加财务经理额外红晶
          if (careerData?.career === '辛迪加财务经理') {
            redCrystal += 3;
            messages.push('🎖️ 辛迪加财务经理职业：额外+3枚红晶');
          }
        }

        // 计算 HP 上限
        let hpMax = 250; // 基础上限
        if (careerData?.career === '警卫员下士') {
          hpMax += 50; // 警卫员下士增加50
        } else if (careerData?.career === '警卫长') {
          hpMax += 25; // 警卫长增加25
        }

        // 使用事务更新数据库
        await ctx.database.withTransaction(async () => {
          // 更新签到记录
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            name: session.username,
            lastSign: now,
            monthlyDays,
            totalRewards: (record?.totalRewards || 0) + finalPoints,
            hp: hpMax, // 恢复HP到上限
            totalPulls: record?.totalPulls || 0,
            pityCounter: record?.pityCounter || 0,
            fullPityCount: record?.fullPityCount || 0,
            bigPrizeCount: record?.bigPrizeCount || 0,
            faction: record?.faction || '',
            career: record?.career || '',
            redcrystal: (record?.redcrystal || 0) + redCrystal,
            syndicateCareer: record?.syndicateCareer || ''
          }]);

          // 初始化玩家统计记录（如果不存在）
          const [playerStats] = await ctx.database.get('ggcevo_player_stats', { handle });
          if (!playerStats) {
            await ctx.database.create('ggcevo_player_stats', {
              handle,
              total: 0,
              wins: 0,
              todayCount: 0,
              lastPK: now,
              totalDamage: 0,
              attackCount: 0,
              lastattackDate: now,
              wishname: '',
              wishUsed: false,
              lastWishDate: now,
              miningStartTime: now,
              totalMined: 0,
              spaceshipId: 0,
              exploreStartTime: null,
              galaxy: null,
              exploreSuccessCount: 0,
              plunderBonus: 0,
              totalExploreGold: 0,
              totalExploreItems: 0,
              buff: []
            });
          }

          // 更新咕咕币背包（仅当有咕咕币时）
          if (finalTickets > 0) {
            await ctx.database.upsert('ggcevo_backpack', [{
              handle,
              itemId: 1,
              quantity: (backpack?.quantity || 0) + finalTickets
            }]);
          }
        });

        // 构建最终消息
        let effectMessage = '';
        if (messages.length > 0) {
          effectMessage = `⚡ 加成效果：\n▸ ${messages.join('\n▸ ')}`;
        }

        // 构造金币部分消息
        let coinMessage = `💰 金币 x ${finalPoints}`;
        if (totalBonus > 0 || multiplier > 1) {
          coinMessage += ` (基础值：${basePoints}金币）`;
        }

        // 构造咕咕币部分消息（仅当有咕咕币时）
        let ticketMessage = '';
        if (finalTickets > 0) {
          ticketMessage = `🪙 咕咕币 x ${finalTickets}`;
          if (multiplier > 1) {
            ticketMessage += ` (基础值：${baseTickets}枚)`;
          }
          ticketMessage += '\n';
        }

        return `签到成功！本月累计签到${monthlyDays}天，获得：\n` +
          `${coinMessage}\n` +
          `${ticketMessage}` +
          `${effectMessage}`;

      } catch (error) {
        console.error('签到命令时发生错误:', error);
        return '服务器繁忙，请稍后尝试。';
      }
    });



  ctx.guild()
    .command('ggcevo/每月津贴')
    .action(async (argv) => {
      const session = argv.session;



      // [1] 获取玩家资料
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      // [2] 构造玩家句柄
      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 检查签到记录是否存在
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle });
      if (!record) {
        return '📅 请先进行一次签到后再领取每月津贴。';
      }

      // [3] 检查基础签到（保持原有逻辑）
      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 1 });

      // [4] 权限检查
      const memberInfo = session.event?.member?.roles;
      //session.send(`调试信息 - 角色列表: ${JSON.stringify(memberInfo)}`);
      if (memberInfo?.some(role => role.name === "member" || role.id === "member")) {
        return "❌ 仅限管理员和群主领取每月津贴。";
      }

      // [5] 获取中国时区月份
      const now = new Date();
      const chinatime = convertUTCtoChinaTime(now);
      const currentYear = chinatime.getUTCFullYear();
      const currentMonth = chinatime.getUTCMonth();

      // [6] 获取管理员津贴记录（改用新表）
      const [adminRecord] = await ctx.database.get('ggcevo_adminbenefit', {
        userId: session.userId
      });

      // [7] 检查本月是否已领取
      if (adminRecord) {
        const lastSignTime = convertUTCtoChinaTime(adminRecord.lastSign);
        const lastYear = lastSignTime.getUTCFullYear();
        const lastMonth = lastSignTime.getUTCMonth();

        // 同年同月已领取
        if (lastYear === currentYear && lastMonth === currentMonth) {
          return `您的本月管理津贴已领取，请在次月1日后可再次领取。`;
        }
      }

      // [8] 更新管理员津贴记录
      await ctx.database.upsert('ggcevo_adminbenefit', [{
        userId: session.userId,
        handle,
        signmonth: (adminRecord?.signmonth || 0) + 1, // 累计月份+1
        lastSign: now,
      }]);

      // [9] 发放咕咕币奖励（保持原有逻辑）
      await ctx.database.upsert('ggcevo_backpack', [{
        handle,
        itemId: 1,
        quantity: (backpack?.quantity || 0) + 50
      }]);

      return `[管理专属] 您成功领取本月津贴，获得了50枚咕咕币！`;
    });

  // 修改后的领取奖励处理
  ctx.command('ggcevo/领取 [name]')
    .action(async (argv, name) => {
      const session = argv.session



      // 获取绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle });
      if (!record) {
        return '📅 请先进行一次签到后再领取奖励。';
      }

      if (!name) {
        await session.send('请在30秒内输入活动名称:')

        name = await session.prompt(30000)
        if (!name) return '已取消操作，请重新输入。'
      }

      // 创建 ID 到物品名称的反向映射
      const itemIdToName = {};
      for (const [name, item] of Object.entries(initDefaultItems)) {
        itemIdToName[item.id] = name;
      }



      // 获取活动信息（包含itemId）
      const now = new Date()
      const [activity] = await ctx.database.get('ggcevo_activity', {
        name,
        endTime: { $gte: now }
      })
      if (!activity) return '活动已结束或不存在。'

      // 检查领取记录
      const existing = await ctx.database.get('ggcevo_welfare', {
        handle,
        activity: activity.id
      })
      if (existing.length) {
        const time = existing[0].lastdate.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai'
        })
        return `您已领取过该活动奖励(领取时间：${time})。`
      }

      // 发放奖励
      if (activity.itemId === 0) { // 金币处理
        const [sign] = await ctx.database.get('ggcevo_sign', { handle })
        await ctx.database.upsert('ggcevo_sign', [{
          handle,
          totalRewards: (sign?.totalRewards || 0) + activity.quantity,
          lastSign: sign?.lastSign || new Date(0),
          monthlyDays: sign?.monthlyDays || 0
        }])
      } else { // 物品处理
        const [item] = await ctx.database.get('ggcevo_backpack', {
          handle,
          itemId: activity.itemId
        })
        await ctx.database.upsert('ggcevo_backpack', [{
          handle,
          itemId: activity.itemId,
          quantity: (item?.quantity || 0) + activity.quantity
        }])
      }

      // 记录领取
      await ctx.database.create('ggcevo_welfare', {
        handle,
        activity: activity.id,
        lastdate: new Date()
      })

      // 修改返回消息中的物品名称显示
      return `您成功领取 ${name} 活动奖励：${activity.itemId === 0
        ? `${activity.quantity}枚金币`
        : `${activity.quantity}个${itemIdToName[activity.itemId] || '未知物品'}`
        }`;
    });

  // 修改后的创建活动命令（参数顺序：活动名称 物品ID 数量 描述 时间(可选)）
  ctx.command('ggcevo/创建活动 <activityName> <itemId:number> <quantity:number> <description> [days:number]', '创建新活动', { authority: 3 })
    .action(async ({ session }, activityName, itemId, quantity, description, days = 7) => {
      if (!activityName) return '活动名称不能为空。'
      if (!itemId) return '物品ID不能为空。'
      if (!quantity || quantity <= 0) return '数量必须大于0。'

      // 检查同名活动
      const [existing] = await ctx.database.get('ggcevo_activity', { name: activityName })
      if (existing) return '同名活动已存在。'

      // 计算结束时间
      const now = new Date()
      const endTime = new Date(now.getTime() + days * 86400000)

      // 创建活动记录
      await ctx.database.create('ggcevo_activity', {
        name: activityName,
        description,
        quantity,
        itemId,
        endTime
      })

      return `活动【${activityName}】创建成功！奖励内容：${itemId === 0 ? '金币' : '物品ID ' + itemId} x${quantity}，持续${days}天。`
    })

  // 更新活动列表显示（正确显示物品名称）
  ctx.command('ggcevo/活动列表')
    .action(async ({ session }) => {



      // 获取绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const now = new Date()
      const activities = await ctx.database.get('ggcevo_activity',
        { endTime: { $gte: now } },
        { sort: { endTime: 'desc' } }
      )

      // 创建物品ID到名称的映射
      const itemMap = new Map<number, string>()
      Object.entries(initDefaultItems).forEach(([name, data]) => itemMap.set(data.id, name))
      itemMap.set(0, '金币') // 添加金币映射

      return activities.length ?
        [
          ...activities.map(a => [
            `活动名称：${a.name}`,
            `结束时间：${formatDate(a.endTime)}`,
            `活动描述：${a.description}`,
            `活动奖励：${a.quantity} ${itemMap.get(a.itemId) || '未知物品'}`,
            '━'.repeat(14)
          ].join('\n')),
          '请输入「领取 活动名称」领取奖励'
        ].join('\n')
        : '当前没有进行中的活动。'
    })







  ctx.command('ggcevo/胜点榜 [page]')
    .alias('排行榜')
    .usage("输入 胜点榜 [页码] 查看对应页的排行榜，每页10条")
    .action(async ({ session }, page) => {



      // 获取绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const pageNum = parseInt(page) || 1;
      if (pageNum < 1) return '请输入有效的页码。';

      const offset = (pageNum - 1) * 10;

      const [records, total] = await Promise.all([
        ctx.database.select('ggcevo_rank')
          .where({ Blacklist: false, rankseason: config.rankseason })
          .orderBy('rank', 'desc')
          .limit(10)
          .offset(offset)
          .execute(),

        ctx.database.select('ggcevo_rank')
          .where({ Blacklist: false, rankseason: config.rankseason })
          .execute(row => $.count(row.handle)),
      ]);

      const totalPages = Math.ceil(total / 10);

      if (pageNum > totalPages) return `查询失败，最多有${totalPages}页`;

      const processedRecords = await Promise.all(
        records.map(async (item) => ({
          ...item,
          displayName: (await checkSensitiveWord(ctx, item.name))
            ? item.name
            : (item.name[0] || '') + '***',
        }))
      );

      // 计算赛季开始时间 (当前时间)
      const seasonStart = new Date();
      seasonStart.setHours(0, 0, 0, 0);

      // 计算赛季结束时间 (开始时间+2个月-1天，23:00:00)
      const seasonEnd = new Date(seasonStart);
      seasonEnd.setMonth(seasonEnd.getMonth() + 2);
      seasonEnd.setDate(seasonEnd.getDate() - 1);
      seasonEnd.setHours(23, 0, 0, 0);

      // 格式化日期函数
      const formatDate = (date) => date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/(\d{4})\/(\d{2})\/(\d{2})/, '$1年$2月$3日').replace(/:\d{2}$/, '');

      const rankingText = processedRecords
        .map((item, index) =>
          `${offset + index + 1}. ${item.displayName} | 积分: ${item.rank} | 胜率: ${item.matches === 0
            ? '0.00%'
            : (item.wins / item.matches * 100).toFixed(2) + '%'
          }`
        )
        .join('\n');

      return [
        `🏆 咕咕胜点榜 ${config.rankseason}赛季`,
        `⏱️ 赛季时间: ${formatDate(seasonStart)}～${formatDate(seasonEnd)}`, // 新增的赛季持续时间
        `📊 数据最新同步时间: ${formatDate(new Date())}`,
        '------------------------------',
        rankingText,
        '------------------------------',
        `第 ${pageNum} 页 / 共 ${totalPages} 页`,
        pageNum < totalPages ? `输入"胜点榜 ${pageNum + 1}"查看下一页` : '已是最后一页'
      ].join('\n');
    })

  ctx.command('ggcevo/赛季结算', '进行赛季结算并发放奖励', { authority: 3 })
    .action(async ({ session }) => {

      // 发送确认提示
      await session.send(`确定要进行赛季结算吗？(请在30秒内回复"是"确认)`)
      const confirm = await session.prompt(30000)
      if (confirm !== '是') return '已取消操作。'

      // 动态生成勋章名称
      const currentSeason = config.rankseason
      const requiredMedals = {
        champion: `🥇${currentSeason}赛季冠军勋章`,
        runnerUp: `🥈${currentSeason}赛季亚军勋章`,
        thirdPlace: `🥉${currentSeason}赛季季军勋章`,
        top10: `🏅${currentSeason}赛季前十勋章`,
        top20: `🎖${currentSeason}赛季前二十勋章`
      }

      // 预检勋章配置
      const missing = Object.values(requiredMedals).filter(name => !initDefaultItems[name])
      if (missing.length > 0) return `缺少勋章配置：${missing.join('，')}`

      // 获取有效玩家数据
      const rankedPlayers = await ctx.database.get('ggcevo_rank', {
        Blacklist: false,
        rankseason: currentSeason
      }, {
        sort: { rank: 'desc' },
        limit: 20
      })

      // 初始化统计信息
      let report = `=== ${currentSeason}赛季结算报告 ===\n\n`
      const playerDetails = []
      let positiveCount = 0
      let negativeCount = 0

      // 处理前20名奖励（只发放咕咕币和勋章）
      for (const [index, player] of rankedPlayers.entries()) {
        const rank = index + 1
        const coins = getCoinsByRank(rank) // 获取咕咕币奖励

        // 更新咕咕币数量
        await updateBackpack(player.handle, 1, coins)

        // 发放勋章
        const medalType = getMedalType(rank)
        const medalName = requiredMedals[medalType]
        const medalId = initDefaultItems[medalName].id
        await updateBackpack(player.handle, medalId, 1)

        // 记录详情
        playerDetails.push(`✦ 第${rank}名：${player.name} - ${coins}咕咕币 + ${medalName}`)
      }

      // 添加精英玩家详情
      report += "🏆 精英玩家奖励：\n" + playerDetails.join('\n') + '\n\n'

      // 处理其他玩家（只发放咕咕币）
      const otherPlayers = await ctx.database.get('ggcevo_rank', {
        Blacklist: false,
        rankseason: currentSeason,
        handle: { $nin: rankedPlayers.map(p => p.handle) }
      })

      for (const player of otherPlayers) {
        if (player.rank > 0) {
          positiveCount++
          await updateBackpack(player.handle, 1, 20) // 20枚咕咕币
        } else {
          negativeCount++
          await updateBackpack(player.handle, 1, 10) // 10枚咕咕币
        }
      }

      // 添加参与奖统计
      report += "🎉 参与奖励发放：\n"
      report += `✦ 积极玩家(分数>0)：${positiveCount}人 x 20咕咕币\n`
      report += `✦ 奋斗玩家(分数≤0)：${negativeCount}人 x 10咕咕币\n\n`

      report += `✅ 总计发放：\n`
      report += `- 精英玩家：${rankedPlayers.length}人\n`
      report += `- 参与玩家：${otherPlayers.length}人`

      // 发送完整报告
      await session.send(report);
      return `${currentSeason}赛季结算完成！`;

      // ========== 辅助函数 ==========
      async function updateBackpack(handle, itemId, quantity) {
        const [item] = await ctx.database.get('ggcevo_backpack', {
          handle: handle,
          itemId: itemId
        })
        await ctx.database.upsert('ggcevo_backpack', [{
          handle: handle,
          itemId: itemId,
          quantity: (item?.quantity || 0) + quantity
        }], ['handle', 'itemId'])
      }

      function getCoinsByRank(rank) {
        return rank === 1 ? 100 :
          rank === 2 ? 90 :
            rank === 3 ? 80 :
              rank <= 10 ? 60 : 40; // 4-10名60枚，11-20名40枚
      }

      function getMedalType(rank) {
        if (rank === 1) return 'champion'
        if (rank === 2) return 'runnerUp'
        if (rank === 3) return 'thirdPlace'
        return rank <= 10 ? 'top10' : 'top20'
      }
    })

  ctx.command('ggcevo/排名 [player]', '查询个人排名')
    .alias('rank')
    .usage("输入“排名”查看自己的排名信息")
    .action(async (argv, player) => {
      const session = argv.session;



      const ctx = session.bot.ctx;

      // 获取目标句柄逻辑
      let handle;
      if (!player) {
        // 查询自己的绑定
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';
        handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;
      } else {
        // 解析@的用户信息
        const parsedUser = h.parse(player)[0];
        if (!parsedUser || parsedUser.type !== 'at' || !parsedUser.attrs.id) {
          return '参数错误，请输入"排名 @玩家"';
        }
        const targetUserId = parsedUser.attrs.id;

        // 查询目标用户的绑定
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: targetUserId });
        if (!profile) return '对方暂未绑定句柄。';
        handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;
      }

      // 统一处理排名查询逻辑
      return getRankInfo(ctx, config, handle);
    });

  ctx.command('ggcevo/给予 <handle> <itemName:string> <amount:number>', '增加用户物品/金币', { authority: 3 })
    .action(async (_, handle, itemName, amount) => {
      try {
        if (!handle || !itemName || amount <= 0) {
          return '参数格式错误，正确格式：给予 句柄 物品名称 数量'
        }

        const parsedAmount = Math.floor(amount)

        // 处理金币逻辑
        if (itemName === '金币') {
          const [signData] = await ctx.database.get('ggcevo_sign', { handle })
          const newTotal = (signData?.totalRewards || 0) + parsedAmount
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            totalRewards: newTotal,
            lastSign: signData?.lastSign || new Date(0),
            monthlyDays: signData?.monthlyDays || 0
          }])
          return `✅ 成功为 ${handle} 添加 ${parsedAmount} 金币！用户当前总数：${newTotal}`

          // 新增红晶逻辑
        } else if (itemName === '红晶') {
          const [careerData] = await ctx.database.get('ggcevo_sign', { handle })
          const currentRed = careerData?.redcrystal || 0
          const newRed = currentRed + parsedAmount

          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            redcrystal: newRed,
            faction: careerData?.faction || '',
            career: careerData?.career || '',
            syndicateCareer: careerData?.syndicateCareer || ''
          }])

          return `✅ 成功为 ${handle} 添加 ${parsedAmount} 红晶！用户当前总数：${newRed}`

          // 普通物品逻辑
        } else {
          const validItems = Object.keys(initDefaultItems)
          if (!validItems.includes(itemName)) {
            return `无效物品名称，可用物品：${validItems.join('、')}`
          }

          const itemId = initDefaultItems[itemName].id
          const [backpack] = await ctx.database.get('ggcevo_backpack', { handle, itemId })
          const newQuantity = (backpack?.quantity || 0) + parsedAmount

          await ctx.database.upsert('ggcevo_backpack', [{
            handle,
            itemId,
            quantity: newQuantity
          }], ['handle', 'itemId'])

          return `✅ 成功为 ${handle} 添加 ${parsedAmount} 个${itemName}！用户当前总数：${newQuantity}`
        }
      } catch (err) {
        console.error('[给予命令错误]', err)
        return '操作失败：' + (err instanceof Error ? err.message : '数据库异常')
      }
    })



  ctx.command('ggcevo/兑换赞助物品', '兑换赞助物品')
    .action(async ({ session }) => {



      try {
        // 获取用户绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;



        // 获取当前赛季
        const currentSeason = config.rankseason;

        // === 新增：查询玩家当前赛季战绩 ===
        const [seasonRecord] = await ctx.database.get('ggcevo_rank', {
          handle,
          rankseason: currentSeason
        });
        // 提取当前赛季场次（若未查询到则为0）
        const seasonMatches = seasonRecord?.matches || 0;

        // 查询用户所有背包物品
        const backpackItems = await ctx.database.get('ggcevo_backpack', { handle });

        // 提取普通兑奖券 (itemId:2)
        const normalCoupon = backpackItems.find(item => item.itemId === 2);

        // 提取宠物扭蛋券 (itemId:3-6 对应 t3-t0)
        const petCoupons = backpackItems.filter(item => item.itemId >= 3 && item.itemId <= 6);

        // 组织宠物券信息
        const petCouponMap = { 3: 't3', 4: 't2', 5: 't1', 6: 't0' };
        let petCouponInfo = '';
        for (const coupon of petCoupons) {
          const quality = petCouponMap[coupon.itemId];
          if (petCouponInfo) petCouponInfo += ' | ';
          petCouponInfo += `${quality}级券(${coupon.quantity})`;
        }
        if (!petCouponInfo) petCouponInfo = '无';

        // 按品质分类并计算剩余数量 - 新增限量物品隐藏逻辑
        const qualityGroups = {};
        for (const [itemName, config] of Object.entries(itemConfig)) {
          const configname = config as any;
          const quality = configname.quality;
          if (!qualityGroups[quality]) qualityGroups[quality] = [];

          // +++ 新增：限量物品兑换完后不再显示 +++
          let shouldSkip = false;
          if (configname.quantity !== undefined) {
            // 构建查询条件
            const queryConditions: any = {
              item: itemName,
              GlobalLimit: true
            };
            if (itemName !== '史蒂夫') {
              queryConditions.season = currentSeason;
            }

            // 查询已兑换数量
            const records = await ctx.database.get('ggcevo_exchange', queryConditions);
            const remaining = Math.max(configname.quantity - records.length, 0);

            // 限量物品(isLimited=true)且剩余为0时跳过
            if (configname.isLimited && remaining <= 0) {
              shouldSkip = true;
            }
          }

          if (shouldSkip) continue;

          // 生成数量显示文本
          let quantityText = '';
          if (configname.quantity !== undefined) {
            // 构建查询条件
            const queryConditions: any = {
              item: itemName,
              GlobalLimit: true
            };
            if (itemName !== '史蒂夫') {
              queryConditions.season = currentSeason;
            }

            // 查询已兑换数量
            const records = await ctx.database.get('ggcevo_exchange', queryConditions);
            const remaining = Math.max(configname.quantity - records.length, 0);
            quantityText = ` [${remaining}/${configname.quantity}]`;
          } else {
            quantityText = ' [无限]';
          }

          qualityGroups[quality].push(`${itemName}${quantityText}`);
        }

        // 兑换券消耗映射
        const couponCostMap = {
          t3: 3,
          t2: 4,
          t1: 5,
          t0: 6
        };

        // 构造分类提示信息
        const order = ['t0', 't1', 't2', 't3'];

        // 添加用户资源信息
        let message = '===== 当前资源 =====\n';
        message += `普通兑奖券: ${normalCoupon?.quantity || 0}张\n`;
        message += `宠物扭蛋券: ${petCouponInfo}\n`;

        // === 新增：显示当前赛季场次 ===
        message += `本赛季场次: ${seasonMatches}场\n\n`;

        message += '请在30秒内输入可兑换物品名称(显示格式：物品名 [剩余/总量]):\n';
        message += '注意：限量物品将在赛季更新时补货，限定物品除外。\n';

        for (const quality of order) {
          const items = qualityGroups[quality] || [];
          if (!items.length) continue;
          message += `\n[${quality.toUpperCase()}](${couponCostMap[quality]}张兑换券)\n${items.join('、')}\n`;
        }

        await session.send(message);

        const name = await session.prompt(30000);
        if (!name) return '已取消操作，请重新输入。';

        const configname = itemConfig[name];
        if (!configname) return '无效的物品名称，请重新输入。';

        // === 修改：添加配置检查 ===
        if (config.enableMatchesRequirement) {

          // === 新增：场次要求配置 ===
          const matchesRequirement = {
            t3: 150,
            t2: 200,
            t1: 250,
            t0: 350
          };

          // 获取当前物品的品质所需场次
          const requiredMatches = matchesRequirement[configname.quality];

          // 检查赛季场次是否达标
          if (seasonMatches < requiredMatches) {
            return `❌ 兑换【${name}】需要在本赛季完成${requiredMatches}场游戏\n` +
              `您当前赛季场次: ${seasonMatches}场（还需${requiredMatches - seasonMatches}场）`;
          }
        }

        const userRecords = await ctx.database.get('ggcevo_exchange', { handle, item: name });
        if (userRecords.length > 0) return '您已经兑换过该物品。';

        // 检查物品限量
        if (configname.quantity !== undefined && (configname.isLimited || config.ignoreGlobalLimit === false)) {
          // 特殊处理史蒂夫的全局限制检查
          const queryConditions: any = {
            item: name,
            GlobalLimit: true
          };
          if (name !== '史蒂夫') {
            queryConditions.season = currentSeason;
          }

          const globalRecords = await ctx.database.get('ggcevo_exchange', queryConditions);
          if (globalRecords.length >= configname.quantity) return '该物品已被兑尽。(非限定物品可等待赛季更新后兑换)';
        }

        // 宠物扭蛋券映射
        const qualityMap = { 't3': 4, 't2': 5, 't1': 6, 't0': 7 };
        const petItems = new Set(
          Object.entries(itemConfig)
            .filter(([_, config]) => config.type === '宠物')
            .map(([name]) => name)
        );

        let cost = configname.cost;
        let itemId = 2;  // 默认使用普通兑奖券
        let couponName = '普通兑奖券';

        // 如果是宠物兑换
        if (petItems.has(name)) {
          const specialCoupon = backpackItems.find(item =>
            item.itemId === qualityMap[configname.quality]
          );

          // 优先使用1个对应扭蛋券
          if (specialCoupon?.quantity >= 1) {
            itemId = qualityMap[configname.quality];
            cost = 1;
            couponName = `${configname.quality}级宠物扭蛋券`;
          }
        }

        // 检查用户是否有足够的兑换券
        const couponItem = backpackItems.find(item => item.itemId === itemId);
        if (!couponItem || couponItem.quantity < cost) {
          const requireMsg = petItems.has(name)
            ? `需要1个${configname.quality}级宠物扭蛋券或${configname.cost}张普通兑奖券`
            : `需要${configname.cost}张普通兑奖券`;
          return `${requireMsg}\n您当前持有：${couponItem?.quantity || 0}个${couponName}`;
        }

        // 设置GlobalLimit标记
        const isGlobal = configname.isLimited || config.ignoreGlobalLimit === false;

        // 执行兑换事务
        await ctx.database.withTransaction(async () => {
          // 扣除兑换券
          await ctx.database.set('ggcevo_backpack',
            { handle, itemId },
            { quantity: couponItem.quantity - cost }
          );
          // 创建兑换记录
          await ctx.database.create('ggcevo_exchange', {
            userId: session.userId,
            handle,
            item: name,
            type: configname.type,
            date: new Date(),
            GlobalLimit: isGlobal,
            season: currentSeason
          });
        });

        // +++ 新增兑换后登记提示和场次信息 +++
        return `🎉 恭喜！您使用${cost}个${couponName}兑换了【${name}】\n` +
          `⚠️ 兑换完成后请寻找活动管理员登记，否则将无法在游戏中使用！`;
      } catch (error) {
        console.error('兑换失败:', error);
        return '兑换失败，请稍后再试';
      }
    });

  ctx.command('ggcevo/兑换扭蛋币')
    .action(async ({ session }) => {



      // 获取用户绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      // 构造玩家唯一标识
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 发送确认提示
      await session.send(`您确定要使用3张兑换券换取一枚扭蛋币吗？(请在30秒内回复"是"确认)`)
      const confirm = await session.prompt(30000)

      if (confirm !== '是') return '已取消操作。'

      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle: handle, itemId: 3 })

      // 检查兑换券余额
      const [coupon] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 2 })
      if (!coupon || coupon.quantity < 3) {
        return `兑换扭蛋币需要3张兑奖券，您当前持有：${coupon?.quantity || 0}张兑换券`
      }

      await ctx.database.set('ggcevo_backpack',
        { handle, itemId: 2 },
        { quantity: coupon.quantity - 3 }
      )

      await ctx.database.upsert('ggcevo_backpack', [{
        handle,
        itemId: 3,
        quantity: (backpack?.quantity || 0) + 1
      }]);

      return `🎉恭喜！您使用3张兑奖券兑换了1枚扭蛋币`
    })

  ctx.command('ggcevo/扭蛋')
    .action(async (argv) => {
      const session = argv.session;



      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });

      if (!profile) {
        return '🔒 需要先绑定游戏句柄。';
      }

      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle: handle, itemId: 3 });
      if (!backpack || backpack.quantity < 1) {
        return `当前扭蛋币不足，您当前拥有：${backpack?.quantity || 0}枚扭蛋币`;
      }

      // 执行抽奖
      const awardName = PetCapsuleToy();

      // 从内存数据获取奖品信息
      const awardItem = Object.entries(initDefaultItems).find(
        ([name, item]) => name === awardName
      );

      // 处理无效奖品
      if (!awardItem) {
        return `系统错误，奖品「${awardName}」不存在，请联系管理员。`;
      }

      // 解构奖品数据
      const [itemName, itemData] = awardItem;

      await ctx.database.upsert('ggcevo_backpack', [{
        handle,
        itemId: 3,
        quantity: backpack.quantity - 1
      }]);

      // 查询用户当前拥有的该奖品数量
      const [userAward] = await ctx.database.get('ggcevo_backpack', { handle, itemId: itemData.id });
      const currentQuantity = userAward ? userAward.quantity : 0;

      // 更新背包中的奖品数量
      await ctx.database.upsert('ggcevo_backpack', [{
        handle,
        itemId: itemData.id,
        quantity: currentQuantity + 1
      }]);

      return `🎉 恭喜！您获得了${itemName}`;
    });



  ctx.command('ggcevo/标记 [handle]', '标记用户到胜点榜黑名单', { authority: 3 })
    .action(async (argv, handle) => {
      const session = argv.session;

      if (!handle) {
        await session.send('请在30秒内输入需要标记的句柄:\n(句柄格式为: [区域ID]-S2-[服务器ID]-[档案ID])')

        handle = await session.prompt(30000)
        if (!handle) return '已取消操作，请重新输入。'
      }

      try {
        // 更严格的句柄格式验证
        const handleRegex = /^([1235])-S2-([12])-(\d+)$/
        if (!handleRegex.test(handle)) {
          return '句柄格式错误，请重新输入。'
        }


        // 检查黑名单存在性（修复判断逻辑）
        const existingEntries = await ctx.database.get('ggcevo_rank', { handle, Blacklist: true, rankseason: config.rankseason })
        if (existingEntries.length > 0) {
          return `${handle}已在当前赛季胜点榜上被标记。`
        }

        // 创建黑名单记录（添加事务处理）
        await ctx.database.upsert('ggcevo_rank', [{
          handle,
          Blacklist: true,
          rankseason: config.rankseason
        }])

        return `✅ 操作成功，用户${handle}在当前赛季胜点榜上被标记。`
      } catch (error) {
        console.error('黑名单操作失败:', error)
        return '操作失败，请稍后重试。错误详情已记录'
      }
    })

  ctx.command('ggcevo/个人信息')
    .action(async (argv) => {
      const session = argv.session;



      const output = [];

      // 获取用户绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      // 基本信息
      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;
      output.push(`🎮 游戏句柄：${handle}`);

      // HP信息
      const [sign] = await ctx.database.get('ggcevo_sign', { handle });
      if (sign) {
        output.push(`❤️ 当前HP：${sign.hp}`);
      }
      output.push('──────────────');

      // 签到信息
      if (sign) {
        const chinaTime = new Date(sign.lastSign).toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        output.push(
          '📅 签到记录：',
          `最后签到：${chinaTime}`,
          `本月累计：${sign.monthlyDays} 天`,
          '──────────────'
        );
      }

      // 抽奖信息
      const [lottery] = await ctx.database.get('ggcevo_sign', { handle });
      if (lottery) {
        output.push(
          '🎉 抽奖统计：',
          `总计抽奖：${lottery.totalPulls} 次`,
          `累计抽中：${lottery.bigPrizeCount} 张`,
          `距离保底剩余：${90 - lottery.pityCounter} 抽`,
          `触发保底：${lottery.fullPityCount} 次`,
          '──────────────'
        );
      }

      // 飞船信息
      const [playerStats] = await ctx.database.get('ggcevo_player_stats', { handle });
      if (playerStats && playerStats.spaceshipId) {
        const shipName = shipIdToName[playerStats.spaceshipId];
        if (shipName) {
          output.push(
            '🚀 飞船信息：',
            `飞船名称：${shipName}`,
            '──────────────'
          );
        }
      }

      // 兑换记录（完整展示）
      const exchanges = await ctx.database.get('ggcevo_exchange', { handle });
      if (exchanges.length) {
        output.push('📜 兑换记录：');
        exchanges
          .sort((a, b) => {
            const aTime = new Date(a.date).getTime();
            const bTime = new Date(b.date).getTime();
            return bTime - aTime;
          })
          .forEach((e, index) => {
            const date = new Date(e.date).toLocaleString('zh-CN', {
              timeZone: 'Asia/Shanghai',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
            const symbol = index === exchanges.length - 1 ? '└' : '├';
            output.push(`${symbol} [${e.type}] ${e.item} (${date})`);
          });
        output.push('──────────────');
      }

      // 统计模块数量（更新为4类）
      const existModules = [
        sign && '签到',
        lottery && '抽奖',
        (playerStats && playerStats.spaceshipId) && '飞船',
        exchanges.length && '兑换'
      ].filter(Boolean);

      output.push(`📊 共查询到${existModules.length}类信息`);

      return output.join('\n');
    });

  // 存储已处理的大厅ID
  const processedLobbies = new Set<number>()

  interface Sc2LobbyResponse {
    results: {
      id: number
      status: string
      hostName: string
      createdAt: string
      slotsHumansTotal: number
      slotsHumansTaken: number
      slots: {
        kind: string
        name: string
        profile?: {
          regionId: number
          realmId: number
          profileId: number
        }
      }[]
    }[]
  }












  ctx.guild()
    .command('ggcevo/pk [user]', '发起玩家对战')
    .alias('挑战')
    .action(async (argv, user) => {
      try {
        const session = argv.session; // 获取 Session 对象

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 验证发起者绑定
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`



        if (!user) return '请输入"pk @玩家"。';


        // 解析目标用户
        const parsedUser = h.parse(user)[0];
        if (!parsedUser || parsedUser.type !== 'at' || !parsedUser.attrs.id) return '参数格式错误，请输入"pk @玩家"。';
        const targetUserId = parsedUser.attrs.id;
        const targetUsername = await session.bot.getGuildMember(session.guildId, targetUserId)
        const [targetprofile] = await ctx.database.get('sc2arcade_player', { userId: targetUserId });
        if (!targetprofile) return '对方尚未绑定句柄。';

        // 生成双方句柄
        const initiatorHandle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;
        const targetHandle = `${targetprofile.regionId}-S2-${targetprofile.realmId}-${targetprofile.profileId}`;
        if (initiatorHandle === targetHandle) return '抱歉，您不能挑战自己。';

        const initiatorPower = await calculateTotalPower(ctx, config, initiatorHandle);
        const targetPower = await calculateTotalPower(ctx, config, targetHandle);


        // 获取双方显示名称
        const initiatorRankname = session.username;
        const targetRankname = targetUsername.nick || targetUsername.user.name;

        // ================== 新增点1：获取双方职业信息 ==================
        const [initiatorCareer] = await ctx.database.get('ggcevo_sign', {
          handle: initiatorHandle
        });
        const [targetCareer] = await ctx.database.get('ggcevo_sign', {
          handle: targetHandle
        });

        let dailyPKLimit = config.dailyPKLimit;

        // ================== 新增点1：检查双方阵营 ==================
        const validGroups = new Set(['人类联盟', '辛迪加海盗']);

        // 检查是否加入有效阵营
        if (!initiatorCareer?.faction || !validGroups.has(initiatorCareer.faction)) {
          return '❌ 您尚未加入人类联盟或辛迪加海盗，不能参与PK';
        }

        if (!targetCareer?.faction || !validGroups.has(targetCareer.faction)) {
          return '❌ 对方尚未加入人类联盟或辛迪加海盗，不能参与PK';
        }





        // 简化后的PK记录初始化（合并到事务中）
        let initiatorPK: PlayerStats;
        let targetPK: PlayerStats;

        await ctx.database.withTransaction(async () => {
          // 获取数据库记录并合并到默认值
          const [dbInitiator] = await ctx.database.get('ggcevo_player_stats', { handle: initiatorHandle });
          const [dbTarget] = await ctx.database.get('ggcevo_player_stats', { handle: targetHandle });

          // 使用Object.assign将数据库记录合并到默认对象
          initiatorPK = Object.assign({
            handle: initiatorHandle,
            total: 0,
            wins: 0,
            todayCount: 0,
            lastPK: new Date(0),
            totalDamage: 0,
            attackCount: 0,
            lastattackDate: new Date(0),
            wishname: '',
            wishUsed: false,
            lastWishDate: new Date(0),
            miningStartTime: new Date(0),
            totalMined: 0,
            spaceshipId: 0,
            exploreStartTime: null,
            galaxy: null,
            exploreSuccessCount: 0,
            plunderBonus: 0,
            totalExploreGold: 0,
            totalExploreItems: 0,
            buff: []
          }, dbInitiator || {});

          targetPK = Object.assign({
            handle: targetHandle,
            total: 0,
            wins: 0,
            todayCount: 0,
            lastPK: new Date(0),
            totalDamage: 0,
            attackCount: 0,
            lastattackDate: new Date(0),
            wishname: '',
            wishUsed: false,
            lastWishDate: new Date(0),
            miningStartTime: new Date(0),
            totalMined: 0,
            spaceshipId: 0,
            exploreStartTime: null,
            galaxy: null,
            exploreSuccessCount: 0,
            plunderBonus: 0,
            totalExploreGold: 0,
            totalExploreItems: 0,
            buff: []
          }, dbTarget || {});
        });




        // 每日次数验证（使用调整后的限制）
        const now = convertUTCtoChinaTime(new Date());
        if (!isSameDate(convertUTCtoChinaTime(initiatorPK.lastPK), now)) {
          initiatorPK.todayCount = 0;
        }

        // 使用调整后的dailyPKLimit
        if (initiatorPK.todayCount >= dailyPKLimit) {
          return `今日挑战次数已用尽(${dailyPKLimit}次/日)。`;
        }

        // 获取中国时区当天0点
        const nowChina = convertUTCtoChinaTime(new Date())
        const todayStart = new Date(nowChina)
        todayStart.setUTCHours(0, 0, 0, 0)
        const adjustedTime = new Date(todayStart.getTime() - (8 * 60 * 60 * 1000));

        // 同对手限制检查（带配置开关）
        if (config.sameOpponentLimit) {
          const sameOpponentCount = await ctx.database.select('ggcevo_pk_logs')
            .where({
              initiator_handle: initiatorHandle,
              target_handle: targetHandle,
              date: { $gte: adjustedTime }
            })
            .execute(row => $.count(row.id))

          if (sameOpponentCount > 0) {
            return '您今天已经挑战过该玩家，请明天再试。'
          }
        }

        // 被挑战次数限制检查（带配置开关）
        if (config.maxDailyBeChallenged > 0) {
          const beChallengedCount = await ctx.database.select('ggcevo_pk_logs')
            .where({
              target_handle: targetHandle,
              date: { $gte: adjustedTime }
            })
            .execute(row => $.count(row.id))

          if (beChallengedCount >= config.maxDailyBeChallenged) {
            return `该玩家今日已被挑战太多次(最多${config.maxDailyBeChallenged}次)。`
          }
        }

        // 后续的金币验证和胜率计算逻辑保持不变
        const [initiatorSign, targetSign] = await Promise.all([
          ctx.database.get('ggcevo_sign', initiatorHandle),
          ctx.database.get('ggcevo_sign', targetHandle)
        ]);

        // 金币双重验证
        const initiatorGold = initiatorSign[0]?.totalRewards || 0;
        const targetGold = targetSign[0]?.totalRewards || 0;
        if (initiatorGold < 100) return '发起者需要至少100金币才能发起挑战。';
        if (targetGold < 100) return '对方金币不足100，无法应战。';

        // ========== 修改点3：动态胜率计算使用默认值 ==========
        const powerDiff = initiatorPower - targetPower;
        let winRate = 50 + (powerDiff / 100) * 0.1;
        winRate = Math.min(Math.max(winRate, 5), 95);

        // 计算机专家特权：胜率提高10%（主动和被动都生效）
        if (initiatorCareer?.career === '计算机专家') {
          winRate += 10;
        }
        if (targetCareer?.career === '计算机专家') {
          winRate -= 10;
        }

        winRate = Math.min(Math.max(winRate, 5), 100);

        // ========== 修改点：使用整数计算代替浮点数 ==========
        const randInt = Math.floor(Math.random() * 10000); // 生成 0-9999 的随机整数
        const winRateInt = Math.floor(winRate * 100);      // 将胜率转换为整数 (0-10000)
        const isWin = randInt < winRateInt;               // 比较整数判断胜负

        // 确定失败者的句柄和职业
        const loserHandle = isWin ? targetHandle : initiatorHandle;
        const loserCareer = isWin ? targetCareer : initiatorCareer;

        // 检查失败者是否拥有MP3播放器且是辛迪加海盗
        let hasMP3 = false;
        if (loserCareer?.faction === '辛迪加海盗') {
          const [mp3Item] = await ctx.database.get('ggcevo_backpack', {
            handle: loserHandle,
            itemId: 1005 // MP3播放器ID
          });
          hasMP3 = mp3Item && mp3Item.quantity > 0;
        }

        // ================== 新增点4：修改金币计算规则 ==================
        // 按照新规则计算金币掠夺
        let baseAmount = 0;

        if (isWin) {
          // 发起者胜利
          if (initiatorGold > targetGold) {
            // 发起者金币大于应对者，按照应对者金币总数的1%
            baseAmount = Math.floor(targetGold * 1 / 100);
          } else {
            // 发起者金币小于应对者，按照发起者金币总数的1%
            baseAmount = Math.floor(initiatorGold * 1 / 100);
          }
        } else {
          // 发起者失败
          if (initiatorGold > targetGold) {
            // 发起者金币大于应对者，按照发起者金币总数的1%
            baseAmount = Math.floor(initiatorGold * 1 / 100);
          } else {
            // 发起者金币小于应对者，按照应对者金币总数的1%
            baseAmount = Math.floor(targetGold * 1 / 100);
          }
        }

        // 每次PK金币最多掠夺200金币
        let goldTransfer = Math.min(baseAmount, 200);

        // 检测MP3播放器效果 (失败时触发)
        let mp3Effect = false;
        if (hasMP3) {
          const reducedGold = Math.floor(goldTransfer * 0.5);  // 50%减免
          mp3Effect = true;
          goldTransfer = reducedGold;                          // 实际转移金币
        }



        // ================== 气喇叭效果处理 ==================
        let hornEffect = false;
        let extraGold = 0;

        // 确定胜利者的句柄和职业
        const winnerHandle = isWin ? initiatorHandle : targetHandle;
        const winnerCareer = isWin ? initiatorCareer : targetCareer;

        // 检查气喇叭条件：胜利者是辛迪加海盗阵营且拥有气喇叭
        if (winnerCareer?.faction === '辛迪加海盗') {
          const [hornItem] = await ctx.database.get('ggcevo_backpack', {
            handle: winnerHandle,
            itemId: 1007 // 气喇叭ID
          });

          // 如果拥有气喇叭，则触发额外金币奖励
          if (hornItem && hornItem.quantity > 0) {
            hornEffect = true;
            extraGold = Math.min(goldTransfer, 200); // 额外奖励等同于抢夺的金币
          }
        }

        // 数据库更新事务
        await ctx.database.withTransaction(async () => {
          // 更新双方挑战记录
          await ctx.database.upsert('ggcevo_player_stats', [
            // 发起者记录
            {
              handle: initiatorHandle,
              total: initiatorPK.total + 1,
              wins: isWin ? initiatorPK.wins + 1 : initiatorPK.wins,
              todayCount: initiatorPK.todayCount + 1,
              lastPK: new Date(),
            },
            // 应战者记录（新增部分）
            {
              handle: targetHandle,
              total: targetPK.total + 1,
              wins: !isWin ? targetPK.wins + 1 : targetPK.wins, // 应战者胜利时增加
              todayCount: targetPK.todayCount,
              lastPK: targetPK.lastPK
            }
          ]);

          // 在数据库事务中
          await ctx.database.create('ggcevo_pk_logs', {
            initiator_handle: initiatorHandle,
            target_handle: targetHandle,
            date: new Date()
          })

          // 常规金币转移逻辑
          if (isWin) {
            await ctx.database.set('ggcevo_sign', targetHandle, {
              totalRewards: targetGold - goldTransfer
            });
            await ctx.database.set('ggcevo_sign', initiatorHandle, {
              totalRewards: initiatorGold + goldTransfer
            });
          } else {
            await ctx.database.set('ggcevo_sign', initiatorHandle, {
              totalRewards: initiatorGold - goldTransfer
            });
            await ctx.database.set('ggcevo_sign', targetHandle, {
              totalRewards: targetGold + goldTransfer
            });
          }

          // 气喇叭生效时，额外白送金币（不是从失败者掠夺）
          if (hornEffect) {
            await ctx.database.set('ggcevo_sign', winnerHandle, {
              totalRewards: (isWin ? initiatorGold + goldTransfer : targetGold + goldTransfer) + extraGold
            });
          }

        });

        // ================== 构建战报 ==================
        const result = [
          `⚔️【对战结果】${isWin ? '胜利' : '失败'}`,
          `🏅 挑战者：${initiatorRankname}(战斗力 ${initiatorPower})`,
          `🛡️ 应战者：${targetRankname}(战斗力 ${targetPower})`,
          `📊 胜率预测：${winRate.toFixed(1)}%`,
          `🎰 金币变动：1%`
        ];

        // 添加金币变动说明
        if (isWin) {
          result.push(`💰 您从对方的口袋里抢夺了${goldTransfer}枚金币`);
        } else {
          result.push(`💸 您从口袋里拿出了${goldTransfer}枚金币上交给对方`);
        }

        // 收集所有加成效果消息
        const bonusEffects = [];

        // 计算机专家特权提示
        if (targetCareer?.career === '计算机专家') {
          bonusEffects.push(`▸ 💻 对方为计算机专家：对方胜率+10%`);
        }

        // 显示MP3效果提示
        if (mp3Effect) {
          bonusEffects.push(`▸ 💿 MP3播放器生效：失败者损失的金币减少50%，胜利者获得的金币也减少50%`);
        }

        // 添加气喇叭效果提示
        if (hornEffect) {
          bonusEffects.push(`▸ 📯 气喇叭生效：辛迪加海盗总部为胜利者发放了额外${extraGold}金币奖励！`);
        }

        // 只在有加成效果时显示标题和内容
        if (bonusEffects.length > 0) {
          result.push(`⚡ 加成效果：`);
          result.push(...bonusEffects);
        }

        result.push(`📅 剩余挑战次数：${dailyPKLimit - (initiatorPK.todayCount + 1)}`);

        return result.join('\n');

      } catch (error) {
        console.error('PK系统异常:', error);
        return '对战功能暂时不可用，请稍后重试';
      }
    });

  // 添加PK榜指令
  ctx.command('ggcevo/pk榜 [page]', '查看玩家PK排行榜')
    .usage("输入 pk榜 [页码] 查看对应页的排行榜，每页10条")
    .action(async ({ session }, page) => {

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      const pageNum = parseInt(page) || 1;
      if (pageNum < 1) return '请输入有效的页码。';

      const offset = (pageNum - 1) * 10;

      const [records, total] = await Promise.all([
        // 获取当前页记录
        ctx.database.select('ggcevo_player_stats')
          .orderBy('wins', 'desc')
          .limit(10)
          .offset(offset)
          .execute(),

        // 获取总记录数（用户总数）
        ctx.database.select('ggcevo_player_stats')
          .execute(row => $.count(row.handle))
      ]);

      const totalPages = Math.ceil(total / 10);
      if (pageNum > totalPages) return `查询失败，最多有 ${totalPages} 页`;
      if (!records.length) return '暂无PK记录';

      // 构建PK榜消息
      const rankingText = records
        .map((record, index) => {
          const winRate = record.total > 0
            ? `${(record.wins / record.total * 100).toFixed(1)}%`
            : 'N/A';
          return [
            `${offset + index + 1}. ${record.handle}`,
            `PK胜利: ${record.wins}次`,
            `胜率: ${winRate}`,
          ].join(' | ');
        })
        .join('\n');

      return [
        '🏆 PK排行榜 🏆',
        '──────────────',
        rankingText,
        '──────────────',
        `第 ${pageNum} 页 / 共 ${totalPages} 页`,
        pageNum < totalPages ? `输入 pk榜 ${pageNum + 1} 查看下一页` : '已是最后一页'
      ].join('\n');
    });


  ctx.command('ggcevo/武器库 [category]')
    .usage('输入"武器库"查看类型，或"武器库 类型"查看详细武器信息')
    .action(async ({ session }, category) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 基础验证
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '⚠️ 需要先绑定游戏句柄';

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 获取折扣信息
      const [careerData] = await ctx.database.get('ggcevo_sign', { handle });
      const playerCareer = careerData?.career || '';
      const playerGroup = careerData?.faction || ''; // 获取玩家阵营

      // 获取武器科技等级
      const [weaponTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 });
      const techLevel = weaponTech?.level || 0;



      // 从配置中获取武器系统数据
      const techConfigData = Spacestationtechnology.find(tech => tech.techId === 2);

      // 折扣详情数组
      const discountDetails = [];

      // 罗马数字等级映射
      const romanLevels = {
        1: 'I',
        2: 'II',
        3: 'III',
        4: 'IV',
        5: 'V',
        6: 'VI'
      };

      // === 仅对人类联盟玩家显示武器科技权限和折扣 ===
      if (playerGroup === '人类联盟' && techLevel > 0 && techConfigData) {
        const isCareer = techConfigData.careerNames.includes(playerCareer);
        
        const applicableLevels = [];
        for (let level = 1; level <= techLevel; level++) {
          applicableLevels.push(romanLevels[level]);
        }
        const levelRange = applicableLevels.join('、');

        discountDetails.push(`▸ 🔧 武器系统Lv${techLevel}: 解锁${levelRange}类武器购买权限`);
        if (isCareer) {
          discountDetails.push(`▸ 💼 职业加成(武器中士/情报副官): 购买享有25%折扣`);
        }
      }
      // === 非人类联盟玩家不显示任何科技折扣信息 ===

      // 仅保留蚱蜢优购活动折扣（仅非传奇武器生效）
      const [playerStats] = await ctx.database.get('ggcevo_player_stats', {
        handle
      });
      const now = new Date();
      const activeWish = playerStats && playerStats.wishname === '蚱蜢优购' &&
        playerStats.lastWishDate <= now &&
        new Date(playerStats.lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000) >= now &&
        !playerStats.wishUsed ? playerStats : null;

      if (activeWish) {
        discountDetails.push(`▸ 🦗 蚱蜢优购祈愿：20%折扣`);
      }

      // 按 category 统计武器分类
      const categoryStats = Object.values(weaponConfig)
        .filter(weapon => weapon.price !== 0)
        .reduce((stats, weapon) => {
          stats[weapon.category] = (stats[weapon.category] || 0) + 1;
          return stats;
        }, {});

      // 无参数显示分类列表
      if (!category) {
        const discountInfo = discountDetails.length > 0
          ? [`💰 当前折扣信息：`, ...discountDetails, '====================']
          : [];

        return [
          '🏪 咕咕武器库分类 🏪',
          '使用 "武器库 分类名称" 查看详细列表',
          ...discountInfo,
          ...Object.entries(categoryStats).map(([catName, count]) =>
            `▸ ${catName} (${count}种)`),
          '===================='
        ].filter(Boolean).join('\n');
      }

      // 验证分类有效性
      if (!Object.keys(categoryStats).includes(category)) {
        return `无效武器分类，可用分类：\n${Object.keys(categoryStats).join('、')}`;
      }

      // 显示所有折扣
      const displayDiscounts = [...discountDetails];

      // 定义各类武器应用的折扣率
      const getWeaponDiscount = (configLevel) => {
        const CAREER_DISCOUNT = 25;
        const GRASSHOPPER_DISCOUNT = 20;

        let applicableDiscount = 0;
        const discountSources = [];

        // === 仅对人类联盟玩家应用职业加成折扣 ===
        if (playerGroup === '人类联盟' &&
          techConfigData?.careerNames.includes(playerCareer) &&
          techLevel > 0 &&
          configLevel <= techLevel) {
          applicableDiscount += CAREER_DISCOUNT;
          discountSources.push(`职业${CAREER_DISCOUNT}%`);
        }

        // 蚱蜢优购折扣（无阵营限制）
        if (activeWish) {
          applicableDiscount += GRASSHOPPER_DISCOUNT;
          discountSources.push(`蚱蜢${GRASSHOPPER_DISCOUNT}%`);
        }

        return { applicableDiscount, discountSources };
      };

      // 生成武器列表
      const items = Object.entries(weaponConfig)
        .filter(([_, config]) =>
          config.category === category && config.price !== 0)
        .map(([name, config]) => {
          // 计算折扣
          const { applicableDiscount, discountSources } = getWeaponDiscount(config.level);

          // 计算显示价格
          let priceDisplay = `${config.price}金币`;
          if (applicableDiscount > 0) {
            const discountedPrice = Math.floor(config.price * (100 - applicableDiscount) / 100);
            priceDisplay = `${discountedPrice}金币 (原价${config.price})`;
          }

          // 获取武器特性描述
          let tagEffectsDesc = '▸ 无特殊加成效果';
          if (config.tagEffects && Object.keys(config.tagEffects).length > 0) {
            tagEffectsDesc = Object.entries(config.tagEffects)
              .map(([tag, multiplier]) =>
                `▸ 对${tag}目标造成${(multiplier * 100).toFixed(0)}%伤害`)
              .join('\n');
          }

          // 添加护甲伤害减免描述
          const armorDamageDesc = (() => {
            if (config.armorDamageReduction === 0) {
              return `护甲减伤：0`;
            } else if (config.armorDamageReduction > 0) {
              return `护甲减伤：${config.armorDamageReduction}（每点护甲扣除${config.armorDamageReduction}点伤害）`;
            } else {
              return `护甲减伤：${config.armorDamageReduction}（每点护甲增加${Math.abs(config.armorDamageReduction)}点伤害）`;
            }
          })();

          // 武器基础信息
          const weaponInfo = [
            `【${name}】`,
            `武器等级：${romanLevels[config.level]}`,
            `武器类型：${config.type}`,
            `基础伤害：${config.damage}`,
            armorDamageDesc,
            `价格：${priceDisplay}`,
            config.specialeffect && `特殊效果：${config.specialeffect}`,
            '特性：',
            tagEffectsDesc,
            `描述：${config.description}`,
            '------------------'
          ];

          return weaponInfo.filter(Boolean).join('\n');
        });

      // 科技升级提示（仅对人类联盟玩家显示）
      const techUpgradeNotice = playerGroup === '人类联盟' &&
        techLevel === 0
        ? '⚠️ 提示：提升武器系统等级可获得额外折扣'
        : '';

      return [
        `🏪 咕咕武器库 - ${category} 🏪`,
        '使用"购买 武器名称"指令进行购买',
        displayDiscounts.length > 0 ? `💰 折扣信息：\n${displayDiscounts.join('\n')}` : '',
        techUpgradeNotice,
        '====================',
        ...items,
        items.length === 0 ? '⚠️ 该分类下暂无可用武器' : ''
      ].filter(Boolean).join('\n');
    });

  ctx.command('ggcevo/爆破库 [type]')
    .usage('输入"爆破库"查看分类，或"爆破库 类型"查看详细物品')
    .action(async ({ session }, type) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '⚠️ 需要先绑定游戏句柄'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 过滤价格大于0且类型为爆破物/手榴弹的物品
      const filteredItems = Object.values(SyndicatedItems).filter(item =>
        item.price > 0 && ['爆破物', '手榴弹'].includes(item.type)
      )

      // 分类统计
      const typeStats = filteredItems.reduce((stats, item) => {
        stats[item.type] = (stats[item.type] || 0) + 1
        return stats
      }, {})

      // 无参数时显示有效类型列表
      if (!type) {
        return [
          '💣 爆破装备库分类 💣',
          '使用 "爆破库 类型名称" 查看详细列表',
          '====================',
          ...Object.entries(typeStats).map(([typeName, count]) =>
            `▸ ${typeName} (${count}种)`),
          '===================='
        ].join('\n')
      }

      // 验证类型有效性
      const validTypes = Object.keys(typeStats)
      if (!validTypes.includes(type)) {
        return `无效分类，可用类型：\n${validTypes.join('、')}`
      }

      // 生成物品列表 - 添加条件字段
      const items = filteredItems
        .filter(item => item.type === type)
        .map(item => {
          const itemName = Object.keys(SyndicatedItems).find(k => SyndicatedItems[k] === item);
          const itemDetails = [
            `名称：${itemName}`,
            `类型：${item.type}`,
            `价格：${item.price}金币`,
            `条件：${item.condition}`,  // 新增的条件字段
            `效果：${item.effects}`,   // 效果字段保持不变
            `描述：${item.description}`,
            '------------------'
          ];
          return itemDetails.join('\n');
        });

      return [
        `💣 爆破装备库 - ${type} 💣`,
        '使用"购买 物品名称"指令进行购买',
        '====================',
        ...items,
        items.length === 0 ? '⚠️ 该分类下暂无可用物品' : ''
      ].join('\n')
    })

  ctx.command('ggcevo/购买 <item>')
    .action(async ({ session }, item) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 黑名单检查


      // 合并物品数据源
      const allItems = { ...weaponConfig, ...SyndicatedItems }

      // 输入校验
      if (!item) return '请输入"购买 物品名称"来购买所需物品。'
      const itemconfig = allItems[item]
      if (!itemconfig) return '无效的物品名称，请重新输入。'
      if (itemconfig.price <= 0) return '❌ 该物品不可直接购买'

      // 类型判断
      const isWeapon = ['能量武器', '热能武器', '实弹武器'].includes(itemconfig.category)
      const isLegendaryWeapon = itemconfig.category === '传奇武器'

      // 禁止购买传奇武器
      if (isLegendaryWeapon) {
        return '❌ 传奇武器无法直接购买。'
      }

      // 武器查重逻辑
      if (isWeapon) {
        const existingWeapon = await ctx.database.get('ggcevo_weapons', {
          handle,
          weaponId: itemconfig.id
        })
        if (existingWeapon.length > 0) return `❌ 您已经拥有${item}，无法重复购买`
      }

      // 获取用户数据
      const [signInfo] = await ctx.database.get('ggcevo_sign', { handle })
      const [careerData] = await ctx.database.get('ggcevo_sign', { handle })
      const playerGroup = careerData?.faction || ''
      const playerCareer = careerData?.career || ''

      // === 人类联盟玩家武器购买权限检查 ===
      if (isWeapon && playerGroup === '人类联盟') {
        const [weaponTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 });
        const techLevel = weaponTech?.level || 0;
        
        if (itemconfig.level > techLevel) {
          const romanLevels = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
          return `❌ 购买${romanLevels[itemconfig.level]}类武器需要武器系统科技等级达到${itemconfig.level}级。\n当前武器系统等级：${techLevel}级`;
        }
      }

      // ================= 折扣计算系统 =================
      let totalDiscount = 0
      let discountDetails = []
      let activeWish = null

      // 罗马数字等级映射
      const romanLevels = {
        1: 'I',
        2: 'II',
        3: 'III',
        4: 'IV',
        5: 'V',
        6: 'VI'
      };

      // 获取武器科技等级
      const [weaponTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 });
      const techLevel = weaponTech?.level || 0;

      // 从配置中获取武器系统数据
      const techConfigData = Spacestationtechnology.find(tech => tech.techId === 2);

      // 1. 职业加成折扣（仅对非传奇武器、人类联盟阵营、指定职业生效）
      if (!isLegendaryWeapon && playerGroup === '人类联盟' && techLevel > 0 && techConfigData) {
        if (itemconfig.level && itemconfig.level <= techLevel) {
          const isCareerBonus = techConfigData.careerNames.includes(playerCareer);

          // 只有职业是武器中士或情报副官时才享有25%折扣
          if (isCareerBonus) {
            totalDiscount += 25;
            discountDetails.push(`▸ 💼 职业加成(武器中士/情报副官): 25%折扣`);
          }
        }
      }

      // 2. 蚱蜢优购折扣（仅对非传奇武器生效）
      if (!isLegendaryWeapon) {
        const [playerStats] = await ctx.database.get('ggcevo_player_stats', {
          handle
        });
        const now = new Date();
        activeWish = playerStats && playerStats.wishname === '蚱蜢优购' &&
          playerStats.lastWishDate <= now &&
          new Date(playerStats.lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000) >= now &&
          !playerStats.wishUsed ? playerStats : null;

        if (activeWish) {
          totalDiscount += 20
          discountDetails.push(`▸ 🦗 蚱蜢优购祈愿：20%折扣`)
        }
      }



      // 限制最大折扣
      totalDiscount = Math.min(totalDiscount, 100)

      // 计算实际价格
      let actualPrice = itemconfig.price
      if (totalDiscount > 0) {
        actualPrice = Math.floor(itemconfig.price * (100 - totalDiscount) / 100)
        actualPrice = Math.max(actualPrice, 1)
      }

      // 金币检查
      if ((signInfo?.totalRewards || 0) < actualPrice) {
        let priceInfo = `需要 ${actualPrice} 金币`
        if (discountDetails.length > 0) {
          priceInfo += ` (原价${itemconfig.price})`
        }
        return `❌ 金币不足，${priceInfo}`
      }

      // ================= 执行交易 =================
      let isAutoEquipped = false
      await ctx.database.withTransaction(async () => {
        // 扣除金币
        await ctx.database.set('ggcevo_sign', { handle }, {
          totalRewards: signInfo.totalRewards - actualPrice
        })

        // 标记优惠券已使用（如果有）
        if (activeWish) {
          await ctx.database.set('ggcevo_player_stats', { handle }, {
            wishUsed: true
          })
        }



        // 分类型存储
        if (isWeapon) {
          // 武器存储逻辑
          await ctx.database.upsert('ggcevo_weapons', [{
            handle,
            weaponId: itemconfig.id,
            level: 0,
            modificationSlots: 1,
            equipped: false,
            comboCount: 0,
            pityCounter: 0,
          }], ['handle', 'weaponId'])

          // 自动装备逻辑
          const equippedCount = await ctx.database.select('ggcevo_weapons')
            .where({ handle, equipped: true })
            .execute(row => $.count(row.weaponId))
          if (equippedCount === 0) {
            await ctx.database.set('ggcevo_weapons',
              { handle, weaponId: itemconfig.id },
              { equipped: true }
            )
            isAutoEquipped = true
          }
        } else {
          // 背包物品逻辑
          const [existing] = await ctx.database.get('ggcevo_backpack', {
            handle,
            itemId: itemconfig.id
          })
          await ctx.database.upsert('ggcevo_backpack', [{
            handle,
            itemId: itemconfig.id,
            quantity: (existing?.quantity || 0) + 1
          }], ['handle', 'itemId'])
        }
      })

      // ================= 构建反馈信息 =================
      let message = `✅ 成功购买${isWeapon ? '武器' : '物品'}「${item}」\n`

      // 显示价格和折扣信息
      if (discountDetails.length > 0) {
        message += `花费 ${actualPrice} 金币 (原价${itemconfig.price} 金币)`
        message += `\n💰 折扣明细：\n${discountDetails.join('\n')}`
      } else {
        message += `花费 ${actualPrice} 金币`
      }



      // 装备状态提示
      if (isWeapon) {
        if (isAutoEquipped) {
          message += "\n【系统已为您自动装备该武器】"
        }
        message += "\n输入「武器仓库」查看详情"
      } else {
        const [current] = await ctx.database.get('ggcevo_backpack', { handle, itemId: itemconfig.id })
        message += `\n当前持有数量：${current?.quantity || 1}`
      }

      return message
    })

  // 装备系统
  ctx.command('ggcevo/武器仓库')
    .action(async ({ session }) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      const weapons = await ctx.database.get('ggcevo_weapons', {
        handle,
      })

      const weaponDetails = await Promise.all(weapons.map(async (w) => {
        const weaponName = Object.entries(weaponConfig).find(([_, c]) => c.id === w.weaponId)[0]
        const config = weaponConfig[weaponName]

        // 应用传奇武器等级加成规则
        const isLegendary = config.category === '传奇武器';
        const levelBonusRate = isLegendary ? 0.05 : 0.10;

        // 计算当前基础伤害（包含传奇武器加成调整）
        const currentDamage = config.damage * (1 + levelBonusRate * w.level);

        // 添加类型标签
        const typeTag = isLegendary ? '【传奇武器】' : '';

        // 格式化工伤值
        const damageFormatted = currentDamage.toFixed(1);

        // 新增装备状态标识
        const statusIcon = w.equipped ? '⚡' : '・'
        const statusText = w.equipped ? '[已装备]' : ''

        const mods = w.installedMods
          .map(m => m)  // 直接使用模块名称
          .join(' | ') || '无'

        return [
          `${statusIcon} ${weaponName} ${typeTag} ${statusText}`,
          `等级：Lv.${w.level} | 改装槽：${w.modificationSlots}`,
          `基础伤害：${damageFormatted}`,
          `改装：${mods}`,
        ].join('\n')
      }))

      return [
        `🛡️ ${session.username}的武器仓库`,
        '使用"装备武器 武器名称"来装备武器',
        '⚡表示当前装备武器',
        '──────────────',
        ...(weaponDetails.length ? weaponDetails : ['空空如也，快去"武器库"看看吧！']),
        '──────────────',
        '💡 武器效果说明：',
        '🔧 改装效果在战斗中生效'
      ].join('\n')
    })

  // 装备切换命令
  ctx.command('ggcevo/装备武器 <weapon>')
    .alias('装备')
    .action(async ({ session }, weapon) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      if (!weapon) return '请输入"装备武器 武器名称"来装备一把你拥有的武器。'
      if (!weaponConfig[weapon]) return '武器名称错误，请输入"装备武器 武器名称"来装备一把你拥有的武器。'
      const itemconfig = weaponConfig[weapon]


      // 检查是否拥有该武器
      const [owned] = await ctx.database.get('ggcevo_weapons', {
        handle,
        weaponId: itemconfig.id
      })
      if (!owned) return '您尚未获得该武器。'

      // 使用事务保证操作的原子性
      await ctx.database.withTransaction(async () => {
        // 解除所有其他武器的装备状态
        await ctx.database.set('ggcevo_weapons',
          {
            handle: handle,
            weaponId: { $ne: itemconfig.id } // 排除当前武器
          },
          { equipped: false }
        )

        // 装备当前武器
        await ctx.database.upsert('ggcevo_weapons', [{
          handle,
          weaponId: itemconfig.id,
          equipped: true,
        }], ['handle', 'weaponId'])
      })

      return `您已成功装备武器 ${weapon}！`
    })

  // 科技升级指令
  ctx.command('ggcevo/升级科技 <target>', '升级空间站科技')
    .action(async ({ session }, target) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 基础验证
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 黑名单检查


      // 无目标时显示科技价格表
      if (!target) {
        return '请输入"升级科技 科技名称"来升级科技'
      }

      // 验证是否是有效的科技
      const tech = Spacestationtechnology.find(t => t.techname === target);
      if (!tech) {
        const validTech = Spacestationtechnology.map(t => t.techname).join('、');
        return `❌ 无效科技名称。可用科技: ${validTech}`;
      }

      return handleTechUpgrade(ctx, handle, target);
    });

  // 武器升级指令
  ctx.command('ggcevo/升级武器 <target>', '升级武器')
    .alias('升级')
    .action(async ({ session }, target) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 基础验证（与科技指令相同）
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 黑名单检查


      // 无目标时显示武器价格表
      if (!target) {
        return generateUpgradePriceList(ctx, handle); // 需要实现该函数
      }

      // 验证是否是有效的武器
      if (!Object.keys(weaponConfig).includes(target)) {
        const validWeapons = Object.keys(weaponConfig).join('、');
        return `❌ 无效武器名称。可用武器: ${validWeapons}`;
      }

      return handleWeaponUpgrade(ctx, handle, target);
    });

  ctx.command('ggcevo/改装武器 <weapon> [mod]', '安装武器模块')
    .alias('改装')
    .action(async ({ session }, weapon, mod) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家档案
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      // 构建唯一句柄
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 黑名单检查


      // 科技和职业数据获取
      const [techData] = await ctx.database.get('ggcevo_tech', { handle, techId: 3 }).catch(() => [{ level: 0 }])
      const [careerData] = await ctx.database.get('ggcevo_sign', { handle })
      const techLevel = techData?.level || 0
      const isCareerMatch = ['武器中士', '情报副官'].includes(careerData?.career)

      // 折扣计算函数
      const calculateDiscountRate = (isExclusive) => {
        // 通用折扣计算
        let discount = 0;

        // 人类联盟折扣
        if (careerData?.faction === '人类联盟') {
          if (isExclusive) {
            if (techLevel >= 2) {
              discount = Math.max(5, isCareerMatch ? 10 : 0);
            }
          } else {
            if (techLevel >= 1) {
              discount = Math.max(5, isCareerMatch ? 10 : 0);
            }
          }
        }

        return Math.min(discount, 100);
      }

      // 核心逻辑：处理模块安装
      const processModInstallation = async () => {
        // 获取模块配置
        const modInfo = modConfig[mod]
        if (!modInfo) return '❌ 无效模块名称。'

        // ========== 新增：检查回收模式 ==========
        if (modInfo.recyclable) {
          return `❌ ${mod} 已开启回收模式，无法安装该模块。`;
        }
        // =====================================

        // 验证武器名称有效性
        if (!weapon || !weaponConfig[weapon]?.id) {
          const validWeapons = Object.keys(weaponConfig).filter(k => weaponConfig[k].id)
          return `❌ 无效武器名称。可选武器：${validWeapons.join('、')}`
        }

        const weaponId = weaponConfig[weapon].id

        // 获取装备数据
        const [equipment] = await ctx.database.get('ggcevo_weapons', { handle, weaponId })

        // 检查武器拥有情况
        if (!equipment) {
          return `❌ 尚未获得【${weapon}】或武器名称错误`
        }

        // 模块验证
        if (modInfo.isExclusive) {
          if (modInfo.exclusiveTo !== weapon) return `❌ 该模块只能安装在${modInfo.exclusiveTo}上。`
          const hasExclusive = equipment.installedMods.some(m => modConfig[m]?.isExclusive)
          if (hasExclusive) return '❌ 每个武器只能安装一个专属模块。'
        }

        // 槽位检查
        if (equipment.installedMods.length >= equipment.modificationSlots) {
          return `❌ 当前可用改装槽已满(武器升级至3/6级会额外获得一个改装槽)。`
        }

        // 重复安装检查
        if (equipment.installedMods.includes(mod)) {
          return '❌ 已安装相同模块。'
        }

        // 计算折扣率
        const discountRate = calculateDiscountRate(modInfo.isExclusive)

        // 计算实际费用
        const actualCost = Math.floor(modInfo.cost * (1 - discountRate / 100))

        // 金币检查
        const [signInfo] = await ctx.database.get('ggcevo_sign', { handle })
        if ((signInfo?.totalRewards || 0) < actualCost) {
          return `❌ 改装需要 ${actualCost} 金币，当前持有：${signInfo?.totalRewards || 0}`
        }

        // 执行安装
        await ctx.database.set('ggcevo_weapons',
          { handle, weaponId },
          { installedMods: [...equipment.installedMods, mod] }
        )

        await ctx.database.set('ggcevo_sign', { handle }, {
          totalRewards: signInfo.totalRewards - actualCost
        })

        // 折扣信息详细说明
        const discountMessages = [];
        if (discountRate > 0) {
          discountMessages.push(`💰 折扣明细：`);
          if (careerData?.faction === '人类联盟') {
            if (modInfo.isExclusive && techLevel >= 2) {
              discountMessages.push(`▸ ⚙️ 武器升级平台Lv.${techLevel}：${isCareerMatch ? 10 : 5}%折扣`);
            } else if (!modInfo.isExclusive && techLevel >= 1) {
              discountMessages.push(`▸ ⚙️ 武器升级平台Lv.${techLevel}：${isCareerMatch ? 10 : 5}%折扣`);
            }
          }
        }

        return [
          `✅ ${weapon} 成功安装 ${mod}！`,
          `花费金币：${actualCost}${discountRate > 0 ? ` (原价${modInfo.cost})` : ''}`,
          discountMessages.length > 0 && discountMessages.join('\n'),
          `改装槽：${equipment.installedMods.length + 1}/${equipment.modificationSlots}`
        ].filter(Boolean).join('\n')
      }

      // 核心逻辑：显示改装列表
      const showModList = async () => {
        // 构建模块列表函数 - 新增回收模式过滤
        const buildModList = (isExclusive) => {
          const mods = Object.entries(modConfig)
            // ========== 新增：过滤掉回收模式模块 ==========
            .filter(([_, m]) => m.isExclusive === isExclusive && !m.recyclable)
            .map(([name, cfg]) => {
              const discountRate = calculateDiscountRate(cfg.isExclusive)
              const actualPrice = Math.floor(cfg.cost * (1 - discountRate / 100))
              return [
                `【${name}】${cfg.isExclusive ? ` (专属:${cfg.exclusiveTo})` : ''}`,
                `价格：${actualPrice}金币${discountRate > 0 ? ` (原价${cfg.cost})` : ''}`,
                `效果：${cfg.effect}`,
                '------------------'
              ].join('\n')
            })

          if (mods.length === 0) return '该类别暂无可用模块'
          return mods.join('\n')
        }

        // 计算通用和专属折扣率
        const universalDiscountRate = calculateDiscountRate(false)
        const exclusiveDiscountRate = calculateDiscountRate(true)

        // 当指定了有效的武器名称时
        if (weapon && weaponConfig[weapon]?.id) {
          // 只筛选当前武器的专属模块 - 新增回收模式过滤
          const weaponExclusiveMods = Object.entries(modConfig)
            .filter(([_, cfg]) =>
              cfg.isExclusive && cfg.exclusiveTo === weapon && !cfg.recyclable // 新增回收模式过滤
            )

          // 构建专属模块列表
          const exclusiveList = weaponExclusiveMods.length > 0
            ? weaponExclusiveMods.map(([name, cfg]) => {
              const discountRate = calculateDiscountRate(true)
              const actualPrice = Math.floor(cfg.cost * (1 - discountRate / 100))
              return [
                `【${name}】`,
                `价格：${actualPrice}金币${discountRate > 0 ? ` (原价${cfg.cost})` : ''}`,
                `效果：${cfg.effect}`,
                '------------------'
              ].join('\n')
            }).join('\n')
            : '❌ 该武器没有可用的专属模块'

          return [
            `🛠️ ${weapon} 专属模块 🛠️`,
            '使用「改装武器 武器名称 模块名称」安装',
            '※ 每个武器只能安装一个专属模块',
            exclusiveDiscountRate > 0 && `💰 当前专属模块折扣：`,
            exclusiveDiscountRate > 0 && careerData?.faction === '人类联盟' && techLevel >= 2 && `▸ ⚙️ 武器升级平台Lv.${techLevel}：${exclusiveDiscountRate}%折扣`,
            '====================',
            exclusiveList
          ].filter(Boolean).join('\n')
        }
        // 没有指定武器或无效武器名称时
        else {
          return [
            '🛠️ 通用武器模块 🛠️',
            '使用「改装武器 武器名称 模块名称」安装通用模块',
            '※ 使用「改装武器 武器名称」查询武器专属模块',
            universalDiscountRate > 0 && `💰 当前通用模块折扣：`,
            universalDiscountRate > 0 && careerData?.faction === '人类联盟' && techLevel >= 1 && `▸ ⚙️ 武器升级平台Lv.${techLevel}：${universalDiscountRate}%折扣`,
            '====================',
            buildModList(false)
          ].filter(Boolean).join('\n')
        }
      }

      // 逻辑路由
      if (mod) {
        return processModInstallation()
      } else {
        return showModList()
      }
    })

  ctx.command('ggcevo/拆卸 <weapon> <mod>', '卸载武器模块，专属模块返还50%金币，通用模块返还80%金币')
    .action(async ({ session }, weapon, mod) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家档案
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      // 构建唯一句柄
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 黑名单检查


      // 验证武器是否存在
      const weaponId = weaponConfig[weapon]?.id;
      if (!weaponId) return '❌ 请输入"拆卸 武器名称 模块名称"\n注意：通用模块返还80%金币，专属模块返还50%金币';

      // 验证模块是否存在并获取模块信息
      const modInfo = modConfig[mod];
      if (!modInfo) return '❌ 请输入"拆卸 武器名称 模块名称"\n注意：通用模块返还80%金币，专属模块返还50%金币';

      // 获取装备数据
      const [equipment] = await ctx.database.get('ggcevo_weapons', {
        handle,
        weaponId
      });
      if (!equipment) return '❌ 您尚未获得该武器。';

      // 检查模块是否已安装
      if (!equipment.installedMods.includes(mod)) {
        return `❌ 该武器未安装${mod}模块。`;
      }

      // 检查回收模式
      const isRecyclable = modInfo.recyclable;

      // 根据情况确定返还比例
      let refundRate;
      let refundReason;

      if (isRecyclable) {
        refundRate = 1.0; // 100%返还
        refundReason = "ℹ️ 全额返还金币";
      } else if (modInfo.isExclusive) {
        refundRate = 0.5; // 50%返还
        refundReason = "ℹ️ 专属模块返还50%金币";
      } else {
        refundRate = 0.8; // 80%返还
        refundReason = "ℹ️ 通用模块返还80%金币";
      }

      // 计算返还金币
      const refund = Math.floor(modInfo.cost * refundRate);

      // 更新装备数据 - 移除模块
      const newMods = equipment.installedMods.filter(m => m !== mod);
      await ctx.database.set('ggcevo_weapons',
        { handle, weaponId },
        { installedMods: newMods }
      );

      // 更新金币总额
      const [signInfo] = await ctx.database.get('ggcevo_sign', { handle });
      const newBalance = (signInfo?.totalRewards || 0) + refund;

      await ctx.database.upsert('ggcevo_sign', [{
        handle,
        totalRewards: newBalance
      }], ['handle']);

      // 构建响应消息
      const responseLines = [
        `✅ 已从 ${weapon} 拆卸 ${mod} 模块`,
        refund === modInfo.cost
          ? `返还金币：${refund}`
          : `返还金币：${refund} (原价${modInfo.cost})`,
        `当前金币总额：${newBalance}`,
        `剩余模块：${newMods.join(', ') || '无'}`,
        refundReason
      ];

      return responseLines.filter(Boolean).join('\n');
    });






  ctx.command('ggcevo/攻击 <bossName>')
    .usage('请输入要攻击的异形名称(例如：攻击 异齿猛兽 或 攻击 寒冰王蛇)')
    .action(async (argv, bossName) => {
      const session = argv.session;
      let bossEventBroadcast: string[] | string = null;

      const isDirect = session.isDirect
      if (!isDirect) {
        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'
      } else {
        const Curfew = privateChatCurfewCheck(session, config)
        if (!Curfew) return '⛔ 非宵禁时段 (0:00-18:00) 禁止在私聊中使用攻击指令。'
      }

      // 基础验证
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;


      // 获取当前存活的所有异形
      const activeBosses = await ctx.database.get('ggcevo_boss', { isActive: true });
      const activeNames = activeBosses.map(b => b.name).join('，');

      if (!bossName) {
        return `请使用"攻击 异形名称"进行攻击。\n当前存活的异形：${activeNames || "无"}。`;
      }

      // 查询目标BOSS
      const [targetBoss] = activeBosses.filter(b => b.name === bossName);
      if (!targetBoss) {
        return `当前没有找到名为 ${bossName} 的可攻击目标。\n请攻击当前存活的异形：${activeNames || "无"}。`;
      }

      // 使用目标BOSS对象
      const verifiedBoss = targetBoss;

      // ======== 新增：攻击消耗HP检查 ========
      // 检查签到记录和玩家HP是否足够
      const [playerData] = await ctx.database.get('ggcevo_sign', { handle });
      if (!playerData) {
        return '🔒 您尚未进行签到，请先使用"签到"指令';
      }
      if (playerData.hp < 100) {
        return '您的HP不足100，无法进行攻击！';
      }

      // 扣除100点HP
      await ctx.database.set('ggcevo_sign', { handle }, {
        hp: playerData.hp - 100
      });

      // 获取装备状态
      const [equippedWeapon] = await ctx.database.get('ggcevo_weapons', { handle, equipped: true });
      if (!equippedWeapon) return '请先输入"装备 武器名称"后再攻击。';

      // 计算伤害
      const weaponConfigEntry = Object.entries(weaponConfig).find(([_, c]) => c.id === equippedWeapon.weaponId);
      const [weaponName, weaponData] = weaponConfigEntry;

      // 检查武器是否可以攻击空中目标
      const airTargets = ['吸血蝙蝠首领', '吸血蝙蝠', '猛毒异兽', '剧毒蝙蝠'];
      if (!weaponData.isantiair && airTargets.includes(verifiedBoss.name)) {
        return '您当前装备的武器无法攻击空中目标！';
      }

      const [careerData] = await ctx.database.get('ggcevo_sign', { handle });

      // ======================= 主目标攻击 =======================
      const primaryAttackResult = await handleAttack(
        ctx, session, handle, config, equippedWeapon, verifiedBoss,
        activeBosses, weaponName, careerData
      );

      // 处理死亡目标
      const allDeadTargets = [];
      if (primaryAttackResult.isDefeated) {
        allDeadTargets.push(verifiedBoss);
      }

      // ======================= 散射攻击 =======================
      let scatterResult = null;
      const hasOtherBosses = activeBosses.some(b => b.name !== verifiedBoss.name); // 新增检查
      const isScatterAttack = (
        (
          (equippedWeapon.installedMods?.includes('光束曲射晶片') &&
            weaponName === '碎骨步枪') ||
          weaponName === '中子步枪' ||
          weaponName === 'DG-3电弧步枪'
        ) &&
        hasOtherBosses  // 新增条件
      );

      if (isScatterAttack) {
        scatterResult = await handleScatterAttack(
          ctx, session, handle, config, equippedWeapon, verifiedBoss, weaponName
          , activeBosses, careerData
        );

        // 收集死亡目标
        scatterResult.actuallyDead.forEach(name => {
          const deadBoss = activeBosses.find(b => b.name === name);
          if (deadBoss) allDeadTargets.push(deadBoss);
        });
      }

      // ================= 统一结算所有死亡目标 =================
      const totalDamage = primaryAttackResult.damage +
        (scatterResult ? scatterResult.extraDamages.reduce((sum, d) => sum + d.damage, 0) : 0);

      // 更新伤害记录（合并主目标和散射目标）
      await updateBossDamageRecord(
        ctx,
        handle,
        session.username,
        totalDamage
      );

      const deathResults = await handleDeathTargets(ctx, allDeadTargets, session.username, handle);
      bossEventBroadcast = deathResults.bossBroadcast;

      // ======================= 奖励系统 =======================

      const { finalReward, careerMessage, redcrystalMessage, techMessage } = await calculateRewards(
        ctx, handle, totalDamage
      );

      // 更新签到记录
      await updateSignRecord(ctx, handle, finalReward);

      // ======================= 任务系统 =======================
      // 收集任务完成情况
      const taskUpdates = [...primaryAttackResult.taskUpdates];

      // 处理散射攻击中的任务完成情况
      if (scatterResult && scatterResult.taskUpdates) {
        scatterResult.taskUpdates.forEach(update => {
          taskUpdates.push(update);
        });
      }

      // 更新任务进度
      if (taskUpdates.length > 0) {
        await updateTaskProgress(ctx, handle, taskUpdates);
      }

      // ====================== 连击系统 =======================
      // 1. 将装备的武器连击计数器加1
      await ctx.database.set('ggcevo_weapons', {
        handle,
        weaponId: equippedWeapon.weaponId
      }, {
        comboCount: (equippedWeapon?.comboCount || 0) + 1
      });

      // 2. 将该玩家所有其他武器的连击计数器清零
      await ctx.database.set('ggcevo_weapons', {
        handle,
        weaponId: { $ne: equippedWeapon.weaponId } // 排除当前装备的武器
      }, {
        comboCount: 0
      });

      // ================= 暴击保底计数器更新 =================
      if (!primaryAttackResult.hasCrit) {
        // 主攻击没有暴击，保底计数器加1
        await ctx.database.set('ggcevo_weapons', {
          handle,
          weaponId: equippedWeapon.weaponId
        }, {
          pityCounter: (equippedWeapon?.pityCounter || 0) + 1
        });
      } else {
        // 主攻击暴击，重置保底计数器为0
        await ctx.database.set('ggcevo_weapons', {
          handle,
          weaponId: equippedWeapon.weaponId
        }, {
          pityCounter: 0
        });
      }

      // ================= 构建结果消息 =================
      const resultMessage = buildResultMessage(
        session, weaponName, verifiedBoss,
        {
          ...primaryAttackResult,
          initialDamage: primaryAttackResult.damage
        },
        scatterResult,
        finalReward,
        careerMessage,
        techMessage,
        redcrystalMessage
      );

      await session.send(resultMessage);

      // ================= 广播处理 =================
      const groupId = [...config.groupId];
      await handleBroadcasts(
        ctx, groupId,
        bossEventBroadcast,
      );
    });

  ctx.command('ggcevo/攻击假人 [name]')  // 添加name参数
    .option('tags', '-t <tags:string> 添加BOSS标签(逗号分隔)')
    .option('passives', '-p <passives:string> 添加被动技能(逗号分隔)')
    .option('hp', '-l <hp:number> 模拟假人血量')
    .option('energy', '-e <energy:number> 模拟假人能量')
    .option('skillStacks', '-s <stacks:number> 技能层数')
    //.option('radiation', '-r <rad:number> 辐射层数')
    .option('cold', '-c <cold:number> 寒冷层数')
    .option('status', '-a <status:number> 状态层数')
    .option('armor', '-d <armor:number> 护甲')
    // 新增燃烧层数选项
    .option('burn', '-b <burn:number> 燃烧层数')
    .action(async (argv, name) => {
      const session = argv.session;
      const { options } = argv;

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      if (!name) {
        name = '测试假人'
      }

      // 解析目标用户
      const parsedUser = h.parse(name)[0];
      if (parsedUser && parsedUser.type === 'at') return '无法指定群友为假人。';

      // 处理血量选项
      let hp = 10000;
      if (typeof options.hp === 'number') {
        hp = Math.max(1, Math.min(options.hp, 10000)); // 限制在1-10000
      }

      // 处理能量选项
      let energy = 1000;
      if (typeof options.energy === 'number') {
        energy = Math.max(0, Math.min(options.energy, 1000)); // 限制在0-1000
      }

      let armor = 0
      if (typeof options.armor === 'number') {
        armor = Math.max(-100, Math.min(options.armor, 100))  // 限制-100-100
      }

      // 处理层数选项
      const clampLayer = (value: number | undefined, max = 100) =>
        typeof value === 'number' ? Math.max(0, Math.min(value, max)) : 0;

      const skillStacks = clampLayer(options.skillStacks);
      //const radiationLayers = clampLayer(options.radiation);
      const coldLayers = clampLayer(options.cold);
      const skillStatus = clampLayer(options.status);
      // 新增燃烧层数处理
      const burnLayers = clampLayer(options.burn);

      // 转换逗号分隔字符串为数组
      const parseList = (str?: string) =>
        str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];

      // 处理标签和被动
      const tags = parseList(options.tags);
      const passives = parseList(options.passives);

      // 基础验证
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 获取装备状态
      const [equippedWeapon] = await ctx.database.get('ggcevo_weapons', {
        handle,
        equipped: true
      });
      if (!equippedWeapon) return '请先输入"装备 武器名称"后再测试。';

      // 创建虚拟假人BOSS对象（使用处理后的值）
      const dummyBoss = {
        name,
        HP: hp,
        type: '主宰',
        groupId: 0,
        tags: tags || [],
        skills: passives || [],
        skillStacks,
        skillStatus,
        radiationLayers: 0,
        armorReductionLayers: 0,
        coldLayers,
        // 添加燃烧层数
        burnLayers,
        energy,
        armor,
        isActive: true,
        lastWeaponName: "",
        testTag: true,
      };

      // 虚拟活跃BOSS列表
      const activeBosses = [dummyBoss];

      // 获取武器配置
      const weaponConfigEntry = Object.entries(weaponConfig).find(([_, c]) => c.id === equippedWeapon.weaponId);
      const [weaponName] = weaponConfigEntry;

      const [careerData] = await ctx.database.get('ggcevo_sign', { handle });

      try {
        // 使用测试函数模拟攻击
        const testResult = await testAttackFunction(
          ctx,
          session,
          handle,
          config,
          equippedWeapon,
          dummyBoss,
          activeBosses,
          weaponName,
          careerData,
        );

        // 构建层数显示信息
        const layerInfo = [];
        if (skillStacks > 0) layerInfo.push(`技能层数: ${skillStacks}`);
        //if (radiationLayers > 0) layerInfo.push(`辐射层数: ${radiationLayers}`);
        if (coldLayers > 0) layerInfo.push(`寒冷层数: ${coldLayers}`);
        if (skillStatus > 0) layerInfo.push(`状态层数: ${skillStatus}`);
        // 新增燃烧层数显示
        if (burnLayers > 0) layerInfo.push(`燃烧层数: ${burnLayers}`);

        const layerDisplay = layerInfo.length > 0
          ? `📊 层数状态: ${layerInfo.join(' | ')}`
          : '';

        // 构建测试结果
        return [
          `🎯 使用武器 ${weaponName} 攻击 ${dummyBoss.name}`,
          `❤️ 假人血量：${dummyBoss.HP}/10000`,
          `🔋 假人能量：${dummyBoss.energy}/1000`,
          `🛡️ 假人护甲：${dummyBoss.armor}`,
          options.tags?.length && `🏷️ 模拟标签：${tags.join(', ')}`,
          options.passives?.length && `✨ 模拟被动：${passives.join(', ')}`,
          layerDisplay,
          ...(testResult.effectMessage.length > 0 ? [
            `⚡ 攻击效果：\n${testResult.effectMessage.map(m => `▸ ${m}`).join('\n')}`
          ] : []),
          ...(testResult.ignoreMessage.length > 0 ? [
            `🗡️ 无视减伤效果：\n${testResult.ignoreMessage.map(m => `▸ ${m}`).join('\n')}`
          ] : []),
          ...(testResult.passiveMessages.length > 0 ? [
            `🛡️ 被动效果：\n${testResult.passiveMessages.map(m => `▸ ${m}`).join('\n')}`
          ] : []),
          `📊 理论伤害值：${testResult.initialDamage}${testResult.hasCrit ? '(✨ 暴击)' : ''}`,
          '💡 参数添加：可添加标签(-t)、被动(-p)、血量(-l)、能量(-e)、护甲(-d)',
          '💡 层数选项：技能层数(-s)、寒冷层数(-c)、状态层数(-a)、燃烧层数(-b)',
        ].filter(line => line).join('\n');
      } finally {
        // 清理战斗统计数据
        Object.keys('测试假人').forEach(key => delete battleStatsMap[key]);
      }
    });

  // 添加伤害榜指令
  ctx.command('ggcevo/伤害榜 [page]', '查看当前主宰伤害排名')
    .usage("输入 伤害榜 [页码] 查看对应页的排行榜，每页10条")
    .action(async (_, page) => {
      const pageNum = parseInt(page) || 1;
      if (pageNum < 1) return '请输入有效的页码。';

      // 获取当前激活的BOSS组
      const activeBosses = await ctx.database.get('ggcevo_boss', {});
      if (!activeBosses.length) return '当前暂无伤害榜。';

      const mainBoss = activeBosses.find(b => b.type === '主宰');
      if (!mainBoss) return '当前数据异常，请联系管理员';

      const offset = (pageNum - 1) * 10;

      // 获取所有玩家的伤害记录
      const allRecords = await ctx.database.get('ggcevo_player_stats', {}, { sort: { totalDamage: 'desc' } });

      // 过滤出有伤害记录的玩家
      const filteredRecords = allRecords.filter(record => record.totalDamage > 0);
      const total = filteredRecords.length;
      const records = filteredRecords.slice(offset, offset + 10);

      const totalPages = Math.ceil(total / 10);
      if (pageNum > totalPages) return `查询失败，最多有 ${totalPages} 页`;

      if (!records.length) return '暂无伤害记录';

      // 构建伤害榜消息
      const rankingText = records
        .map((record, index) =>
          `${offset + index + 1}. ${record.handle} | 总伤害: ${record.totalDamage} | 攻击次数: ${record.attackCount}`
        )
        .join('\n');

      return [
        `🏆 咕咕之战伤害榜 (${mainBoss.name})`,
        '──────────────',
        rankingText,
        '──────────────',
        `第 ${pageNum} 页 / 共 ${totalPages} 页`,
        pageNum < totalPages ? `输入 伤害榜 ${pageNum + 1} 查看下一页` : '已是最后一页'
      ].join('\n');
    });

  ctx.command('ggcevo/异形信息', '查看当前主宰信息')
    .alias('yx信息')
    .action(async ({ session }) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      const activeBosses = await ctx.database.get('ggcevo_boss', { isActive: true });
      if (!activeBosses.length) return '当前没有存活的异形，请等待12点或0点刷新。';

      const mainBoss = activeBosses.find(b => b.type === '主宰');
      const minions = activeBosses.filter(b => b.type === '子代');

      if (!mainBoss) return '当前数据异常，请联系管理员';

      // 在bossPool中查找主BOSS的配置
      const mainBossConfig = bossPool.find(b => b.name === mainBoss.name);
      if (!mainBossConfig) return '配置数据异常，请联系管理员';

      const mainBossHpBar = createHpBar(mainBoss.HP, mainBossConfig.maxHP);

      // 主宰信息
      const result = [
        `🔴 主宰：${mainBoss.name}`,
        `${mainBossHpBar} (${mainBoss.HP}/${mainBossConfig.maxHP})`,
      ];

      // 如果配置的初始能量不为0，则显示当前能量值
      if (mainBossConfig.maxEnergy > 0) {
        result.push(`⚡ 能量：${mainBoss.energy}/1000`);
      }

      // +++ 新增护甲显示 +++
      result.push(`🛡️ 护甲：${mainBossConfig.armor || 0}`);

      // +++ 新增护甲削减显示 +++
      if (mainBoss.armorReductionLayers > 0) {
        const reductionValue = mainBoss.armorReductionLayers * 0.1; // 数据库存储值*0.1
        result.push(`🔻 护甲削减：${reductionValue.toFixed(1)}`);
      }

      result.push(`🏷️ 标签：${mainBoss.tags?.join('、') || '无'}`);

      // 新增辐射层数显示
      if (mainBoss.radiationLayers > 0) {
        result.push(`☢️ 辐射：${mainBoss.radiationLayers}层`);
      }

      // 新增寒冷层数显示
      if (mainBoss.coldLayers > 0) {
        result.push(`❄️ 寒冷：${mainBoss.coldLayers}层`);
      }

      if (mainBoss.burnLayers > 0) {
        result.push(`🔥 燃烧：${mainBoss.burnLayers}层`);
      }

      result.push(`✨ 被动：`);

      // 添加被动描述
      if (mainBoss.skills.length > 0) {
        result.push(...mainBoss.skills.map(p => `➤ ${p}：${passiveConfig[p]?.description}`));
      } else {
        result.push('➤ 无');
      }

      // 主宰的计数技能层数显示
      const countingSkill = mainBoss.skills?.find(s => ['岗哨机枪', '吸血唾液', '灼烧粘液', '光影之刃', '毒性唾液', '基因变异'].includes(s));
      if (countingSkill) {
        result.push(`📈 ${countingSkill}：${mainBoss.skillStacks}层`);
      }

      // 新增冷适应层数显示
      if (mainBoss.skills.includes('冷适应')) {
        result.push(`🛡️ 冷适应：${mainBoss.statusLayers}层`);
      }

      // +++ 新增剧毒突袭层数显示 +++
      if (mainBoss.skills.includes('剧毒突袭')) {
        result.push(`☠️ 剧毒突袭：${mainBoss.statusLayers}层`);
      }

      if (mainBoss.skills.includes('恐吓尖啸')) {
        result.push(`😱 恐吓尖啸：${mainBoss.statusLayers}层`);
      }

      if (mainBoss.skills.includes('孵化')) {
        result.push(`🥚 孵化：${mainBoss.statusLayers}层`);
      }

      // +++ 新增酸蚀池状态显示 +++
      if (mainBoss.skills.includes('酸蚀池')) {
        let acidText;
        switch (mainBoss.skillStatus) {
          case 0:
          case 1:
            acidText = '脓蚀酸池';
            break;
          case 2:
            acidText = '蚀骨酸池';
            break;
          case 3:
            acidText = '焦熔酸池';
            break;
          default:
            acidText = '未知状态';
        }
        result.push(`🧪 当前酸蚀池：${acidText}`);
      }
      // --- 新增结束 ---



      // 显示最后记录的武器名称
      if (mainBoss.lastWeaponName) {
        result.push(`🎭 记录武器：${mainBoss.lastWeaponName}`);
      }

      if (minions.length > 0) {
        result.push('\n🟠 子代：');
        for (let i = 0; i < minions.length; i++) {
          const minion = minions[i];
          // 在bossPool中查找子代的配置
          const minionConfig = bossPool.find(b => b.name === minion.name);
          const minionHpBar = createHpBar(minion.HP, minionConfig?.maxHP || 1000);

          // 子代信息
          const minionInfo = [
            `❤️ ${minion.name}`,
            `${minionHpBar} (${minion.HP}/${minionConfig?.maxHP || '未知'})`,
          ];

          // 如果子代配置的初始能量不为0，则显示当前能量值
          if (minionConfig && minionConfig.maxEnergy > 0) {
            minionInfo.push(`⚡ 能量：${minion.energy}/1000`);
          }

          // +++ 新增护甲显示 (子代) +++
          minionInfo.push(`🛡️ 护甲：${minionConfig?.armor || 0}`);

          // +++ 新增护甲削减显示 (子代) +++
          if (minion.armorReductionLayers > 0) {
            const reductionValue = minion.armorReductionLayers * 0.1; // 数据库存储值*0.1
            minionInfo.push(`🔻 护甲削减：${reductionValue.toFixed(1)}`);
          }

          minionInfo.push(`🏷️ 标签：${minion.tags?.join('、') || '无'}`);

          // 新增辐射层数显示 (子代)
          if (minion.radiationLayers > 0) {
            minionInfo.push(`☢️ 辐射：${minion.radiationLayers}层`);
          }

          // 新增寒冷层数显示 (子代)
          if (minion.coldLayers > 0) {
            minionInfo.push(`❄️ 寒冷：${minion.coldLayers}层`);
          }

          if (minion.burnLayers > 0) {
            minionInfo.push(`🔥 燃烧：${minion.burnLayers}层`);
          }

          minionInfo.push(`✨ 被动：`);

          // 添加子代被动描述
          if (minion.skills.length > 0) {
            minionInfo.push(...minion.skills.map(p => `➤ ${p}：${passiveConfig[p]?.description}`));
          } else {
            minionInfo.push('➤ 无');
          }

          // 子代的计数技能层数显示
          const minionCountingSkill = minion.skills?.find(s => ['岗哨机枪', '吸血唾液', '灼烧粘液', '光影之刃', '毒性唾液', '基因变异'].includes(s));
          if (minionCountingSkill) {
            minionInfo.push(`📈 ${minionCountingSkill}：${minion.skillStacks}层`);
          }

          // 新增冷适应层数显示
          if (minion.skills.includes('冷适应')) {
            minionInfo.push(`🛡️ 冷适应：${minion.statusLayers}层`);
          }

          // +++ 新增剧毒突袭层数显示（子代）+++
          if (minion.skills.includes('剧毒突袭')) {
            minionInfo.push(`☠️ 剧毒突袭：${minion.statusLayers}层`);
          }

          if (minion.skills.includes('恐吓尖啸')) {
            minionInfo.push(`😱 恐吓尖啸：${minion.statusLayers}层`);
          }

          if (minion.skills.includes('孵化')) {
            minionInfo.push(`🥚 孵化：${minion.statusLayers}层`);
          }

          // +++ 新增子代酸蚀池状态显示 +++
          if (minion.skills.includes('酸蚀池')) {
            let acidText;
            switch (minion.skillStatus) {
              case 0:
              case 1:
                acidText = '脓蚀酸池';
                break;
              case 2:
                acidText = '蚀骨酸池';
                break;
              case 3:
                acidText = '焦熔酸池';
                break;
              default:
                acidText = '未知状态';
            }
            minionInfo.push(`🧪 当前酸蚀池：${acidText}`);
          }
          // --- 新增结束 ---



          // 显示子代最后记录的武器名称
          if (minion.lastWeaponName) {
            minionInfo.push(`🎭 记录武器：${minion.lastWeaponName}`);
          }

          result.push(...minionInfo);

          // 如果不是最后一个子代，添加空行分隔
          if (i < minions.length - 1) result.push('');
        }
      }

      return result.join('\n');
    });



  ctx.command('ggcevo/祈愿')
    .action(async (argv) => {
      const session = argv.session;

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取用户信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';
      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 黑名单检查


      // 检查签到记录和金币信息
      const [sign] = await ctx.database.get('ggcevo_sign', { handle });
      if (!sign) return '🔒 您尚未进行签到，请先使用"签到"指令';
      if (sign.totalRewards < 100) return '需要100金币进行祈愿，您的金币不足。';

      // 检查冷却时间（每天限1次）
      const now = new Date();
      const [playerStats] = await ctx.database.get('ggcevo_player_stats', { handle });

      // 检查今天是否已经祈愿过
      if (playerStats?.lastWishDate) {
        const lastWishDate = new Date(playerStats.lastWishDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastWishDate.setHours(0, 0, 0, 0);
        if (lastWishDate.getTime() === today.getTime()) {
          return '📅 每天只能祈愿一次，请明天再来。';
        }
      }

      // 检查当前是否有有效的祈愿效果
      if (playerStats?.wishname && playerStats?.lastWishDate) {
        const lastWishDate = new Date(playerStats.lastWishDate);
        const endTime = new Date(lastWishDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (endTime > now && !playerStats.wishUsed) {
          // 合并祈愿配置并查找当前效果
          const allEffects = [...wishConfig.common, ...wishConfig.rare];
          const currentEffect = allEffects.find(e => e.name === playerStats.wishname) ?? {
            name: '未知效果',
            effect: '效果信息暂不可用'
          };

          // 格式化结束时间
          const endTimeStr = endTime.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });

          return `🕒 您当前有祈愿效果：【${currentEffect.name}】${currentEffect.effect}\n效果结束时间：${endTimeStr}`;
        }
      }

      // 扣除费用
      let newGold = sign.totalRewards - 100;

      // 随机选择祈愿类型
      const isRare = Math.random() < 0.05;
      const pool = isRare ? wishConfig.rare : wishConfig.common;
      const effect = pool[Math.floor(Math.random() * pool.length)];

      // 处理特殊效果
      switch (effect.name) {
        case '金柚赐福':
          // 使用 upsert 确保背包物品存在
          const [ResourceExchangeVoucher] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 8 });
          await ctx.database.upsert('ggcevo_backpack', [{
            handle,
            itemId: 8,
            quantity: (ResourceExchangeVoucher?.quantity || 0) + 3
          }]);
          break;
        case '酥手空空':
          newGold = Math.max(0, newGold - 50);
          // 构造疯狂星期四文案
          const kfcMsg = '🍗【疯狂星期四警报】有人抽中了"酥手空空"！'
            + '钱包空空如也，现在急需好心人V他50金币！'
            + '慈悲为怀的指挥官，速带黄金救场，解救同袍于水火！🆘';

          const groupId = [...config.groupId]

          // 向配置的群组广播消息
          await ctx.broadcast(groupId, kfcMsg);
          break;
        case '夜市赠礼':
          // 使用 upsert 确保背包物品存在
          const [backpack] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 1 });
          await ctx.database.upsert('ggcevo_backpack', [{
            handle,
            itemId: 1,
            quantity: (backpack?.quantity || 0) + 5
          }]);
          break;
      }

      // 更新金币
      await ctx.database.set('ggcevo_sign', { handle }, { totalRewards: newGold });

      // 更新祈愿记录
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await ctx.database.upsert('ggcevo_player_stats', [{
        handle,
        wishname: effect.name,
        wishUsed: false,
        lastWishDate: now,
        spaceshipId: 0
      }]);

      // 格式化效果结束时间
      const formattedEndTime = endTime.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `✨ 祈愿成功！花费100枚金币获得【${effect.name}】效果：${effect.effect}\n⏳ 效果持续至 ${formattedEndTime}`;
    });

  // 加入阵营指令
  ctx.command('ggcevo/加入 <faction>', '加入阵营')
    .alias('加入阵营')
    .action(async ({ session }, faction) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取用户绑定的句柄
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 检查参数有效性
      const validFactions = ['人类联盟', '辛迪加海盗'];
      if (!faction) return `请输入"加入 阵营名称"加入对应阵营\n有效阵营：${validFactions.join(' / ')}`;
      if (!validFactions.includes(faction)) {
        return `您输入的是错误的阵营名称，请选择有效阵营：${validFactions.join(' / ')}`;
      }

      // 检查是否已加入阵营
      const [existing] = await ctx.database.get('ggcevo_sign', { handle });
      if (existing?.faction === '人类联盟' || existing?.faction === '辛迪加海盗') {
        const career = existing.career || '未转职';
        return `你已经加入${existing.faction}阵营`;
      }

      // 获取金币信息
      const [signData] = await ctx.database.get('ggcevo_sign', { handle });
      const userCoins = signData?.totalRewards || 0;

      // 处理不同阵营加入逻辑
      try {
        if (faction === '人类联盟') {
          // 人类联盟加入条件
          if (userCoins < 1000) {
            return `加入人类联盟需要1000金币，您当前拥有${userCoins}金币`;
          }

          await session.send(`请问您确定要缴纳1000金币加入人类联盟吗？(请在30秒内输入"是"确定加入)`);

          // 获取用户输入并转换为数字
          const cost = await session.prompt(30000);
          if (cost !== '是') return '已取消加入。';

          // 扣除金币
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            totalRewards: signData?.totalRewards - 1000
          }], ['handle']);

          // 创建职业记录
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            faction: '人类联盟',
            redcrystal: 0
          }], ['handle']);

        } else if (faction === '辛迪加海盗') {
          if (userCoins < 2000) {
            return `加入辛迪加海盗需要缴纳2000金币，您当前拥有${userCoins}金币`;
          }

          await session.send(`请问您确定要缴纳2000金币加入辛迪加海盗吗？(请在30秒内输入"是"确定加入)`);

          // 获取用户输入并转换为数字
          const cost = await session.prompt(30000);
          if (cost !== '是') return '已取消加入。';

          // 扣除金币
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            totalRewards: signData?.totalRewards - 2000
          }], ['handle']);

          // 创建职业记录
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            faction: '辛迪加海盗',
            redcrystal: (existing?.redcrystal || 0) + 5
          }], ['handle']);
        }

        return `花费了${faction === '人类联盟' ? '1000金币' : '2000金币'}成功加入${faction}！${faction === '人类联盟' ? '' : '获得5枚红晶，'}人类联盟阵营可以转职人类职业，辛迪加海盗阵营可同时拥有人类职业和辛迪加职业`;
      } catch (err) {
        ctx.logger.error('加入阵营失败:', err);
        return '加入阵营时发生错误，请稍后再试';
      }
    });

  ctx.command('ggcevo/退出', '退出当前阵营')
    .alias('退出阵营')
    .action(async ({ session }) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取用户绑定的句柄
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      const { regionId, realmId, profileId } = profile;
      const handle = `${regionId}-S2-${realmId}-${profileId}`;

      // 黑名单检查


      // 获取当前阵营信息
      const [currentCareer] = await ctx.database.get('ggcevo_sign', { handle });
      if (!currentCareer || !currentCareer.faction) {
        return '您尚未加入任何阵营。';
      }

      // 获取用户金币信息
      const [signData] = await ctx.database.get('ggcevo_sign', { handle });
      const userCoins = signData?.totalRewards || 0;

      // 计算退出费用
      let exitCost = 0;
      let exitFactionName = '';

      if (currentCareer.faction === '人类联盟') {
        exitCost = 2000; // 加入价格的2倍
        exitFactionName = '人类联盟';
      } else if (currentCareer.faction === '辛迪加海盗') {
        exitCost = 4000; // 加入价格的2倍
        exitFactionName = '辛迪加海盗';
      }

      // 检查金币是否足够
      if (userCoins < exitCost) {
        return `退出${exitFactionName}需要${exitCost}金币，您当前只有${userCoins}金币`;
      }

      // 确认退出操作
      await session.send(`确定要花费${exitCost}金币退出${exitFactionName}吗？(30秒内输入"是"确认退出)`);
      const confirm = await session.prompt(30000);
      if (confirm !== '是') return '已取消退出操作。';

      try {
        // 扣除金币
        await ctx.database.upsert('ggcevo_sign', [{
          handle,
          totalRewards: Math.max(0, signData.totalRewards - exitCost)
        }], ['handle']);

        // 清空阵营信息
        await ctx.database.upsert('ggcevo_sign', [{
          handle,
          faction: '',
          career: '',
          syndicateCareer: '',
          redcrystal: currentCareer.redcrystal // 保留红晶数量
        }], ['handle']);

        return `✅ 成功花费${exitCost}金币退出${exitFactionName}！`;
      } catch (err) {
        ctx.logger.error('退出阵营失败:', err);
        return '退出阵营时发生错误，请稍后再试';
      }
    });

  ctx.command('ggcevo/职业 [type]', '职业查询')
    .action(async ({ session }, type) => {
      // 无参数时显示一级分类
      if (!type) {
        return [
          '🎖️ 职业分类',
          '使用"职业 人类职业"查看人类联盟可转职职业',
          '使用"职业 辛迪加职业"查看辛迪加海盗可转职职业',
          '使用"转职 职业名称"进行转职',
          '──────────────',
          '💡 人类联盟阵营可以转职人类职业',
          '💡 辛迪加海盗阵营可同时拥有人类职业和辛迪加职业'
        ].join('\n');
      }

      // 如果参数是"人类职业"，显示所有可转职的人类职业
      if (type === '人类职业') {
        const careerList = spaceStationCrewConfig.map(p => {
          const info = [
            `🛠️ ${p.professionName}`,
            `▸ 效果：${p.effect || '暂无效果描述'}`
          ];
          return info.join('\n');
        });

        return [
          '🎖️ 人类联盟可转职职业列表',
          '使用"转职 职业名称"进行转职',
          '──────────────',
          ...(careerList.length ? careerList : ['暂无可转职职业']),
          '──────────────',
          '💡 转职后原有职业效果将被替换'
        ].join('\n');
      }

      // 如果参数是"辛迪加职业"，显示所有可转职的辛迪加职业
      if (type === '辛迪加职业') {
        const careerList = syndicatePirateConfig.map(p => {
          const info = [
            `🛠️ ${p.professionName}`,
            `▸ 效果：${p.effect || '暂无效果描述'}`
          ];
          return info.join('\n');
        });

        return [
          '🎖️ 辛迪加海盗可转职职业列表',
          '使用"转职 职业名称"进行转职',
          '──────────────',
          ...(careerList.length ? careerList : ['暂无可转职职业']),
          '──────────────',
          '💡 转职后原有职业效果将被替换'
        ].join('\n');
      }

      return `未知的职业类型：${type}\n使用"职业"查看职业分类`;
    });

  ctx.command('ggcevo/转职 [profession]', '转职系统')
    .action(async ({ session }, profession) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 不带参数时显示帮助信息
      if (!profession) {
        return [
          '🎖️ 转职指令使用帮助',
          '使用"转职 职业名称"进行转职',
          '──────────────',
          '💡 先使用"职业"指令查询可转职的职业列表',
          '💡 "职业 人类职业" - 查看人类联盟职业',
          '💡 "职业 辛迪加职业" - 查看辛迪加海盗职业',
          '──────────────',
          '💡 首次转职免费，后续转职需要转职券'
        ].join('\n');
      }

      // 获取用户绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';

      // 构建唯一句柄
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 获取当前阵营信息
      const [careerData] = await ctx.database.get('ggcevo_sign', { handle });
      if (!careerData) return '请先加入阵营后使用转职功能。';

      // 检查当前职业是否在配置中
      const allProfessions = [...spaceStationCrewConfig, ...syndicatePirateConfig];
      const currentCareer = careerData.career;
      const currentSyndicateCareer = careerData.syndicateCareer;
      const isCurrentCareerValid = allProfessions.some(p => p.professionName === currentCareer);
      const isCurrentSyndicateCareerValid = allProfessions.some(p => p.professionName === currentSyndicateCareer);

      // 以下是转职逻辑
      // 检查是否是人类职业
      const humanProfession = spaceStationCrewConfig.find(p => p.professionName === profession);
      // 检查是否是辛迪加职业
      const syndicateProfession = syndicatePirateConfig.find(p => p.professionName === profession);

      // 校验职业有效性
      if (!humanProfession && !syndicateProfession) return '该职业不存在。';

      // 检查是否已经是该职业
      if (careerData.career === profession || careerData.syndicateCareer === profession) {
        return '您已经是该职业了。';
      }

      // 人类转职逻辑：必须加入人类联盟或辛迪加海盗阵营
      if (humanProfession) {
        if (careerData.faction !== '人类联盟' && careerData.faction !== '辛迪加海盗') {
          return '只有已加入阵营的玩家才能进行人类转职。';
        }

        // 检查是否已经有人类职业（一旦转职后无法更改）
        if (isCurrentCareerValid) {
          return `您已经转职为【${currentCareer}】，人类职业一旦转职后无法更改。`;
        }
      }

      // 辛迪加转职逻辑：必须加入辛迪加海盗阵营
      if (syndicateProfession) {
        if (careerData.faction !== '辛迪加海盗') {
          return '只有辛迪加海盗可以转职为该职业。';
        }

        // 检查是否已经有辛迪加职业（一旦转职后无法更改）
        if (isCurrentSyndicateCareerValid) {
          return `您已经转职为【${currentSyndicateCareer}】，辛迪加职业一旦转职后无法更改。`;
        }
      }

      // 二次验证
      await session.send(
        `⚠️ 确认转职为【${profession}】吗？\n` +
        `💡 提醒：职业一旦转职后将无法更改！\n` +
        `请在30秒内输入"是"确认转职，或输入其他内容取消。`
      );

      const confirm = await session.prompt(30000);
      if (confirm !== '是') return '🚫 已取消转职';

      try {
        // 人类职业转职逻辑
        if (humanProfession) {
          // 更新职业信息
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            career: profession,
            syndicateCareer: careerData.syndicateCareer // 保持辛迪加职业不变
          }], ['handle']);

          return `转职成功！当前职业：${profession}\n💡 提醒：一般情况下无法更改职业。`;

          // 辛迪加职业转职逻辑  
        } else if (syndicateProfession) {
          // 更新职业信息
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            syndicateCareer: profession,
            career: careerData.career // 保持人类职业不变
          }], ['handle']);

          return `转职成功！当前职业：${profession}\n💡 提醒：一般情况下无法更改职业。`;
        }

      } catch (err) {
        ctx.logger.error('转职失败:', err);
        return '转职过程中发生错误，请稍后再试';
      }
    });

  ctx.command('ggcevo/职业信息', '查看当前阵营与职业状态')
    .action(async ({ session }) => {
      try {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取用户绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', {
          userId: session.userId
        });
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        // 构建唯一句柄
        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        // 查询职业数据
        let [careerData] = await ctx.database.get('ggcevo_sign', { handle });
        if (!careerData) return '🔒 您尚未进行签到，请先使用"签到"指令';

        // 开始构建信息卡片
        const infoCard = [`🎮 游戏句柄：${handle}`];

        // 添加战力信息
        try {
          const powerValue = await calculateTotalPower(ctx, config, handle);
          infoCard.push(`⚔️ 当前战力：${powerValue}`);
        } catch (err) {
          ctx.logger.warn('战力计算失败', err);
        }

        // 处理阵营和职业信息
        if (careerData.faction) {
          // 获取人类职业信息
          const humanProfession = spaceStationCrewConfig.find(p => p.professionName === careerData.career);
          const humanEffectDisplay = humanProfession?.effect || '无特殊效果';

          // 添加阵营相关信息
          infoCard.push(`🎯 当前阵营：${careerData.faction}`);

          // 显示人类职业
          infoCard.push(
            `👔 人类职业：${careerData.career || '未转职'}`,
            //`✨ 职业效果：${humanEffectDisplay}`
          );

          // 辛迪加海盗阵营额外显示辛迪加职业
          if (careerData.faction === '辛迪加海盗' && careerData.syndicateCareer) {
            const syndicateProfession = syndicatePirateConfig.find(p => p.professionName === careerData.syndicateCareer);
            const syndicateEffectDisplay = syndicateProfession?.effect || '无特殊效果';
            infoCard.push(
              `👔 辛迪加职业：${careerData.syndicateCareer}`,
              //`✨ 职业效果：${syndicateEffectDisplay}`
            );
          }

          // 显示加入时间（如果存在）
          if (careerData.lastSign) {
            const joinDate = new Date(careerData.lastSign);
            const formattedDate = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月${joinDate.getDate()}日`;
            infoCard.push(`🗓️ 加入时间：${formattedDate}`);
          }

          // 人类联盟专属科技信息
          if (careerData.faction === '人类联盟') {
            const techEntries = await ctx.database.get('ggcevo_tech', { handle });
            const activeTechs = techEntries
              .filter(entry => entry.level > 0)
              .map(entry => {
                const techConfig = Spacestationtechnology.find(t => t.techId === entry.techId);
                return techConfig ? `🛠️ ${techConfig.techname} [${entry.level}/${techConfig.maxLevel}]` : null;
              })
              .filter(Boolean);

            if (activeTechs.length > 0) {
              infoCard.push('', '〓 科技研发 〓', ...activeTechs); // 添加空行分隔
            }
          }
        } else {
          // 未加入阵营时的显示
          infoCard.push(
            '🎯 当前阵营：无',
            '👔 当前职业：无',
            '',
            '💡 使用"加入阵营"指令选择你的阵营'
          );
        }

        // 添加分隔线和提示
        const divider = '〓═════════〓';
        const promptMessage = careerData.faction === '辛迪加海盗' ?
          '💡 提示：红晶可通过主动发起PK获得(无论胜负)' :
          careerData.faction ? '💡 提示：使用「转职」指令可变更职业' : '';

        return [
          `〓 职业档案 〓`,
          ...infoCard,
          ...(promptMessage ? [divider, promptMessage] : [])
        ].join('\n');

      } catch (error) {
        ctx.logger.error('查询职业信息失败:', error);
        return '获取职业信息失败，请稍后重试';
      }
    });

  ctx.command('ggcevo/黑市 [category]', '辛迪加海盗专属黑市')
    .usage('输入"黑市"查看分类，或"黑市 分类名称"查看详细')
    .action(async ({ session }, category) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 阵营验证（仅用于显示折扣信息，不限制查看）
      const [careerData] = await ctx.database.get('ggcevo_sign', { handle })
      const currentCareer = careerData?.career || '';
      const currentFaction = careerData?.faction || '';

      // 合并统计所有类型（按武器配置的 category 分类）
      const categoryStats = {}
      Object.values(weaponConfig)
        .filter(config => config.redCrystalCost > 0)
        .forEach(weapon => {
          categoryStats[weapon.category] = (categoryStats[weapon.category] || 0) + 1
        })
      Object.values(SyndicatedItems)
        .filter(item => item.redCrystalCost > 0)
        .forEach(item => {
          categoryStats[item.type] = (categoryStats[item.type] || 0) + 1
        })

      // 无参数模式显示分类
      if (!category) {
        // 构建折扣提示
        const discountLines = [];

        // 普通职业折扣
        if (currentCareer === '破坏者') {
          discountLines.push(`▸ 破坏者职业：爆破物类50%折扣`);
        }
        if (currentCareer === '计算机专家') {
          discountLines.push(`▸ 计算机专家职业：设备工具类50%折扣`);
        }

        // 传奇武器折扣
        Object.entries(legendaryDiscounts).forEach(([item, professions]) => {
          if (professions.includes(currentCareer)) {
            const category = weaponConfig[item]?.category;
            discountLines.push(`▸ ${currentCareer}职业：${item}（传奇）50%折扣`);
          }
        });

        return [
          '🏴 辛迪加黑市 🏴',
          '使用 "黑市 分类名称" 查看详细信息',
          discountLines.length ? [
            '💰 折扣明细：',
            ...discountLines
          ].join('\n') : '',
          '====================',
          ...Object.entries(categoryStats).map(([catName, count]) =>
            `▸ ${catName} (${count}种)`),
          '====================',
        ].join('\n')
      }

      // 类型有效性验证 - 修改为更友好的错误提示
      if (!Object.keys(categoryStats).includes(category)) {
        return `无效黑市分类，可用分类：\n${Object.keys(categoryStats).join('、')}`
      }

      // 构建折扣详情数组
      const discountDetails = [];

      // 常规职业折扣
      if (currentCareer === '破坏者' && category === '爆破物') {
        discountDetails.push(`▸ 破坏者职业：爆破物类50%折扣`);
      }
      if (currentCareer === '计算机专家' && category === '设备工具') {
        discountDetails.push(`▸ 计算机专家职业：设备工具类50%折扣`);
      }

      // 传奇武器折扣
      Object.entries(legendaryDiscounts).forEach(([weapon, professions]) => {
        if (professions.includes(currentCareer) && weaponConfig[weapon]?.category === category) {
          discountDetails.push(`▸ ${currentCareer}职业：${weapon}（传奇）50%折扣`);
        }
      });

      // 合并处理武器和物品
      const items = [
        ...Object.entries(weaponConfig)
          .filter(([_, config]) =>
            config.category === category &&
            config.redCrystalCost > 0
          )
          .map(([name, config]) => {
            // 检查折扣
            const isDiscount = legendaryDiscounts[name]?.includes(currentCareer);
            const originalPrice = config.redCrystalCost;
            const discountPrice = isDiscount ? Math.floor(originalPrice * 0.5) : originalPrice;

            // 护甲伤害减免描述
            const armorDamageDesc = config.armorDamageReduction === 0 ?
              `护甲减伤：0` :
              `护甲减伤：${config.armorDamageReduction}`;

            const infoBlocks = [
              `【${name}】`,
              `类型：${config.type}`,
              `基础伤害：${config.damage}`,
              armorDamageDesc,
            ];

            // 价格信息
            if (isDiscount) {
              infoBlocks.push(
                `订购价：${discountPrice}红晶 (原价${originalPrice})`,
              );
            } else {
              infoBlocks.push(`订购价：${discountPrice}红晶`);
            }

            // 特殊效果
            if (config.specialeffect) {
              infoBlocks.push(`特殊效果：${config.specialeffect}`)
            }

            // 标签效果
            let tagEffectsDesc = '▸ 无特殊加成效果';
            if (config.tagEffects && Object.keys(config.tagEffects).length > 0) {
              tagEffectsDesc = Object.entries(config.tagEffects)
                .map(([tag, mul]) => `▸ 对${tag}目标造成${(mul * 100).toFixed(0)}%伤害`)
                .join('\n')
            }
            infoBlocks.push('特性：', tagEffectsDesc)

            // 描述
            infoBlocks.push(
              `描述：${config.description}`,
              '------------------'
            );

            return infoBlocks.join('\n');
          }),

        ...Object.entries(SyndicatedItems)
          .filter(([_, item]) =>
            item.type === category &&
            item.redCrystalCost > 0
          )
          .map(([name, item]) => {
            // 应用职业折扣
            const isDiscount =
              (currentCareer === '破坏者' && category === '爆破物') ||
              (currentCareer === '计算机专家' && category === '设备工具');

            const originalPrice = item.redCrystalCost;
            const discountPrice = isDiscount ? Math.floor(originalPrice * 0.5) : originalPrice;
            const discountReason = isDiscount ? currentCareer : null;

            const infoBlocks = [
              `【${name}】`,
              `类型：${item.type}`,
            ];

            // 价格信息
            if (isDiscount) {
              infoBlocks.push(
                `订购价：${discountPrice}红晶 (原价${originalPrice})`,
              );
            } else {
              infoBlocks.push(`订购价：${discountPrice}红晶`);
            }

            // 物品信息
            infoBlocks.push(
              `条件：${item.condition}`,
              `特殊效果：${item.effects}`,
              `描述：${item.description}`,
              '------------------'
            );

            return infoBlocks.join('\n');
          })
      ]

      return [
        `🏴 辛迪加黑市 - ${category} 🏴`,
        '使用"订购 物品名称"进行购买(仅消耗红晶)',
        discountDetails.length > 0 ? `💰 折扣明细：\n${discountDetails.join('\n')}` : '',
        '====================',
        ...items,
        items.length === 0 ? '⚠️ 该分类下暂无可用商品' : ''
      ].filter(Boolean).join('\n');
    });

  ctx.command('ggcevo/订购 <item>')
    .action(async ({ session }, item) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 黑名单检查


      // 阵营验证
      const [careerData] = await ctx.database.get('ggcevo_sign', { handle })
      if (!careerData || careerData.faction !== '辛迪加海盗') {
        return '🚫 该功能需要【辛迪加海盗】阵营权限'
      }

      // 参数有效性验证
      if (!item) return '请输入"订购 物品名称"向辛迪加总部订购物品。'

      // 精确查找物品类型
      const isWeapon = Object.prototype.hasOwnProperty.call(weaponConfig, item);
      const isSyndicatedItem = Object.prototype.hasOwnProperty.call(SyndicatedItems, item);

      if (!isWeapon && !isSyndicatedItem) return '❌ 无效物品名称';

      // 获取准确配置
      const itemConfig = isWeapon ? weaponConfig[item] : SyndicatedItems[item];
      if (!itemConfig.redCrystalCost) return '⛔ 该物品不可订购';

      // 新增：全局折扣计算
      let discountApplied = false;
      let discountReason = '';
      let originalPrice = itemConfig.redCrystalCost;
      let finalCost = originalPrice;

      // 爆破物：破坏者折扣
      if (!isWeapon && itemConfig.type === '爆破物' && careerData.career === '破坏者') {
        finalCost = Math.floor(originalPrice * 0.5);
        discountApplied = true;
        discountReason = '破坏者职业：爆破物类物品50%折扣';
      }
      // 设备工具：计算机专家折扣
      else if (!isWeapon && itemConfig.type === '设备工具' && careerData.career === '计算机专家') {
        finalCost = Math.floor(originalPrice * 0.5);
        discountApplied = true;
        discountReason = '计算机专家职业：设备工具类物品50%折扣';
      }
      // 传奇武器：特定职业折扣
      else if (isWeapon && itemConfig.category === '传奇武器' && legendaryDiscounts[item]?.includes(careerData.career)) {
        finalCost = Math.floor(originalPrice * 0.5);
        discountApplied = true;
        discountReason = `${careerData.career}职业：购买${item}享受50%折扣`;
      }

      // 设备工具类专属检查（新增部分）
      if (isSyndicatedItem && itemConfig.type === '设备工具') {
        const [existingItem] = await ctx.database.get('ggcevo_backpack', {
          handle,
          itemId: itemConfig.id
        });

        // 检查是否已拥有该设备工具
        if (existingItem && existingItem.quantity >= 1) {
          return '❌ 您已经拥有该设备工具，无法重复订购。';
        }
      }

      // 更新：红晶校验（使用finalCost）
      if ((careerData.redcrystal || 0) < finalCost) {
        const discountMessage = discountApplied
          ? `(原价${originalPrice})`
          : '';
        return `❌ 红晶不足！需要：${finalCost}${discountMessage} 当前拥有红晶：${careerData.redcrystal}`;
      }

      if (isWeapon) {
        // 武器专属处理逻辑
        const existing = await ctx.database.get('ggcevo_weapons', {
          handle,
          weaponId: itemConfig.id
        });
        if (existing.length) return '您已经拥有该武器。';
      }

      // 事务处理（使用finalCost）
      let isAutoEquipped = false; // 跟踪是否自动装备武器
      await ctx.database.withTransaction(async () => {
        // 扣除红晶
        await ctx.database.set('ggcevo_sign', { handle }, {
          redcrystal: careerData.redcrystal - finalCost
        });

        if (isWeapon) {
          // 创建新武器记录
          await ctx.database.create('ggcevo_weapons', {
            handle,
            weaponId: itemConfig.id,
            level: 0,
            modificationSlots: 1,
            installedMods: [],
            equipped: false,
            comboCount: 0,
            pityCounter: 0,
          });

          // 自动装备逻辑
          const equippedCount = await ctx.database.select('ggcevo_weapons')
            .where({ handle, equipped: true })
            .execute(row => $.count(row.weaponId))

          if (equippedCount === 0) {
            await ctx.database.set('ggcevo_weapons',
              { handle, weaponId: itemConfig.id },
              { equipped: true }
            );
            isAutoEquipped = true;
          }
        } else {
          // 特殊物品处理
          const [existing] = await ctx.database.get('ggcevo_backpack', {
            handle,
            itemId: itemConfig.id
          });

          await ctx.database.upsert('ggcevo_backpack', [{
            handle,
            itemId: itemConfig.id,
            quantity: (existing?.quantity || 0) + 1
          }], ['handle', 'itemId']);
        }
      });

      // 构建响应消息
      const buildResponse = async () => {
        // 构建折扣明细部分
        const discountLines = []

        // 价格信息
        const priceInfo = [
          `消耗红晶：${finalCost}${discountApplied ? ` (原价${originalPrice})` : ''}`
        ]

        // 武器与非武器分开处理
        if (isWeapon) {
          const equippedStatus = isAutoEquipped ? '已自动装备武器' : '需手动装备武器';

          return [
            `✅ 成功订购【${item}】！`,
            ...priceInfo,
            discountApplied ? `💰 折扣明细：\n${discountReason}` : '',
            `装备状态：${equippedStatus}`,
            '输入 "武器仓库" 管理武器'
          ].filter(Boolean).join('\n')
        } else {
          const currentStock = await ctx.database.get('ggcevo_backpack', {
            handle,
            itemId: itemConfig.id
          }).then(r => r[0]?.quantity || 1)

          return [
            `✅ 成功订购【${item}】x1！`,
            ...priceInfo,
            discountApplied ? `💰 折扣明细：\n${discountReason}` : '',
            `当前库存：${currentStock}件`
          ].filter(Boolean).join('\n')
        }
      }

      // 调用异步响应构建函数
      return await buildResponse()
    })



  ctx.command('ggcevo/使用 [itemName] [target]')
    .action(async (argv, itemName, target) => {
      const session = argv.session

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家档案
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 黑名单检查


      try {
        if (!itemName) return '请输入"使用 物品名称 (可选目标)"使用仓库中的物品。'

        const warehouseItems = await ctx.database.get('ggcevo_backpack', { handle })

        // 查找匹配物品（使用严格名称比对）
        const targetItem = warehouseItems.find(item => {
          const entry = Object.entries(SyndicatedItems).find(
            ([_, cfg]) => cfg.id === item.itemId
          )
          return entry?.[0] === itemName
        })

        if (!targetItem) return `❌ 未找到 ${itemName} 或物品不可用`
        if (targetItem.quantity < 1) return `⚠️ ${itemName} 库存不足`

        // 获取配置项完整信息
        const itemEntry = Object.entries(SyndicatedItems).find(
          ([_, item]) => item.id === targetItem.itemId
        )!
        const [itemNameConfirmed, itemConfig] = itemEntry

        // 执行物品效果并获取操作结果
        const effectResult = await applyItemEffect(ctx, session, handle, itemConfig, target)
        if (!effectResult.success) return effectResult.message

        // 扣除物品数量（只有效果触发成功时执行）
        const newQuantity = targetItem.quantity - 1
        await ctx.database.set('ggcevo_backpack',
          { handle, itemId: targetItem.itemId },
          { quantity: newQuantity }
        )

        await session.send(
          `✅ 成功使用 ${itemNameConfirmed}\n` +
          `剩余数量：${newQuantity}\n` +
          `触发效果：${effectResult.message}`
        );

      } catch (error) {
        ctx.logger('GGCEVO').error(error)
        return '⚠️ 物品使用失败，请联系管理员'
      }
    })

  ctx.command('ggcevo/科技 [techName]', '查看空间站科技信息')
    .usage('输入"科技"查看列表，或"科技 科技名称"查看详细信息')
    .action(async ({ session }, techName) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家档案
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 罗马数字转换映射
      const romanNumerals = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

      // 检查情报副官折扣（仅人类联盟有效）
      const [careerData] = await ctx.database.get('ggcevo_sign', { handle });
      const isIntelligenceOfficer = careerData?.faction === '人类联盟' && careerData?.career === '情报副官';

      // 无参数时显示科技列表
      if (!techName) {
        const techList = Spacestationtechnology.map(tech =>
          `▸ ${tech.techname} (最大等级 ${romanNumerals[tech.maxLevel]})`
        );

        return [
          '🛰️ 空间站科技系统 🛰️',
          '使用 "科技 科技名称" 查看详细信息',
          isIntelligenceOfficer ? [
            '💰 折扣明细：',
            '▸ 🎖️ 情报副官职业：10%折扣'
          ].join('\n') : '',
          '====================',
          ...techList,
          '====================',
        ].filter(Boolean).join('\n');
      }

      // 查找匹配的科技（支持中文名称匹配）
      const tech = Spacestationtechnology.find(t =>
        t.techname === techName
      );

      if (!tech) return `❌ 无效科技名称，可用科技：\n${Spacestationtechnology.map(t => t.techname).join('、')}`;

      const techDetails = tech.levels.map(level => {
        const originalCost = level.cost
        const discountedCost = isIntelligenceOfficer
          ? Math.floor(originalCost * 0.9)
          : originalCost

        const costDesc = isIntelligenceOfficer
          ? `▸ 升级花费：${discountedCost}金币 (原价${originalCost})`
          : `▸ 升级花费：${originalCost}金币`

        return [
          `✦ 等级 ${romanNumerals[level.level]}`,
          costDesc,
          `▸ 基础效果：${level.description}`,
          `▸ 职业效果：${level.careerBonus}`,
          '------------------'
        ].join('\n');
      });

      // 构建折扣信息
      let discountInfo = []
      if (isIntelligenceOfficer) {
        discountInfo = [
          '💰 折扣明细：',
          '▸ 🎖️ 情报副官职业：10%折扣'
        ]
      }

      return [
        `🛠️ ${tech.techname} 科技详情 🛠️`,
        `最大可升级等级：${romanNumerals[tech.maxLevel]}`,
        `适用职业：${tech.careerNames.join('、')}`, // 适用职业移动到最顶部
        '使用 "升级科技 科技名称" 进行升级',
        ...discountInfo,
        '====================',
        ...techDetails
      ].filter(Boolean).join('\n');
    });

  ctx.command('ggcevo/挖矿')
    .action(async ({ session }) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 阵营验证
      const [career] = await ctx.database.get('ggcevo_sign', { handle });

      // 获取科技等级
      const [tech] = await ctx.database.get('ggcevo_tech', { handle, techId: 1 });
      const techLevel = tech?.level || 0;  // 默认等级为0

      // 检查仓库中的物品加成
      const warehouseItems = await ctx.database.get('ggcevo_backpack', { handle });
      let itemBonusRate = 0;
      let miningRobotBonus = 0;

      // 检查自动采掘机器人
      const miningItem = warehouseItems.find(item => item.itemId === 1008); // ID 1008对应自动采掘机器人
      if (miningItem && career.faction === '辛迪加海盗') {
        // 基础加成50%
        miningRobotBonus = 50 / 100;
        itemBonusRate += miningRobotBonus;
      }

      // 处理挖矿操作
      const [playerStats] = await ctx.database.get('ggcevo_player_stats', { handle });
      const [sign] = await ctx.database.get('ggcevo_sign', { handle });

      // 检查player_stats记录是否存在
      if (!playerStats) {
        return '🔒 您尚未进行签到，请先使用"签到"指令';
      }

      // 开始挖矿或更新记录
      const isNeverMined = !playerStats?.miningStartTime ||
        playerStats.miningStartTime.getTime() === 0 ||
        playerStats.miningStartTime.getUTCFullYear() === 1970;
      if (isNeverMined) {
        await ctx.database.upsert('ggcevo_player_stats', [{
          handle,
          miningStartTime: new Date(),
          totalMined: 0,  // 初始化总收益
          spaceshipId: 0
        }]);
        return '⛏️ 首次挖矿作业已开始，请至少等待1小时。\n💡 提示：基础收益为每半小时4枚金币';
      }

      // 计算持续时间
      const nowtime = new Date();
      const chinaStart = playerStats.miningStartTime;
      const duration = Math.floor(
        (nowtime.getTime() - chinaStart.getTime()) / 1000 / 60
      );

      // 当持续时间不足时
      if (duration < 60) {
        const remaining = 60 - duration;
        return [
          '⛏️ 挖矿进行中',
          `🕒 开始时间：${playerStats.miningStartTime.toLocaleString('zh-CN', { hour12: false })}`,
          `⏱️ 当前时间：${nowtime.toLocaleString('zh-CN', { hour12: false })}`,
          `⏳ 还需等待：${remaining}分钟`,
          `💡 提示：挖矿至少需要进行1个小时`
        ].join('\n');
      }

      // 精确收益计算（包含首小时）
      let halfHours = Math.floor(duration / 30);
      // 基础收益：每半小时4枚金币
      let base = halfHours * 4;

      // 根据科技等级设置收益上限（仅人类联盟5级科技享受上限提升）
      const maxHalfHours = (career?.faction === '人类联盟' && techLevel === 5) ? 96 : 48;
      halfHours = Math.min(halfHours, maxHalfHours);
      base = Math.min(base, maxHalfHours * 4);

      // 初始化加成值
      let techBonusRate = 0;
      let careerBonusRate = 0;
      let shipBonusRate = 0;
      let minerBonusRate = 0; // 深空矿工独立加成

      // 人类联盟享受科技加成
      if (career?.faction === '人类联盟') {
        // 设置科技基础加成
        const baseTechRates = [0, 0.10, 0.20, 0.30, 0.40, 0.50];
        techBonusRate = baseTechRates[Math.min(techLevel, 5)];

        // 检查职业是否享受额外加成
        const techCareers = ['深空矿工', '情报副官'];
        if (techCareers.includes(career?.career)) {
          // 设置职业额外加成
          const careerBonusRates = [0, 0.10, 0.20, 0.30, 0.40, 0.50];
          careerBonusRate = careerBonusRates[Math.min(techLevel, 5)];
        }
      }

      // 为深空矿工角色添加独立加成
      if (career?.career === '深空矿工') {
        minerBonusRate = 0.5; // 固定50%加成
      }

      // 太空船加成检查
      let shipName = "";
      const [shipPlayerStats] = await ctx.database.get('ggcevo_player_stats', {
        handle,
      });

      // 检查飞船是否存在并应用挖矿加成
      if (shipPlayerStats && shipPlayerStats.spaceshipId) {
        // 查找飞船信息（根据id匹配）
        for (const [name, data] of Object.entries(spaceship)) {
          if (data.id === shipPlayerStats.spaceshipId) {
            shipName = name;
            // 使用 spaceship.ts 中定义的 miningbonus 值
            shipBonusRate = (data.miningbonus || 0) / 100;
            break;
          }
        }
      }

      // 计算总加成率（所有加成率相加）
      const totalBonusRate = techBonusRate + careerBonusRate + shipBonusRate + itemBonusRate + minerBonusRate;
      const total = Math.round(base * (1 + totalBonusRate));

      // 数据库事务更新
      await ctx.database.withTransaction(async () => {
        // 更新签到表总金币
        await ctx.database.upsert('ggcevo_sign', [{
          handle,
          totalRewards: (sign?.totalRewards || 0) + total
        }], ['handle']);

        // 更新挖矿信息到玩家统计
        await ctx.database.upsert('ggcevo_player_stats', [{
          handle,
          miningStartTime: new Date(),
          totalMined: (playerStats.totalMined || 0) + total,
          spaceshipId: playerStats.spaceshipId || 0
        }]);
      });

      // 格式化时间函数
      const formatTime = (mins: number) => {
        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        return `${hours}小时${minutes}分钟`;
      }

      // 创建报告行数组
      const reportLines = [
        '⛏️ 挖矿报告',
        `🕒 开始时间：${playerStats.miningStartTime.toLocaleString('zh-CN', { hour12: false })}`,
        `⏱️ 结束时间：${nowtime.toLocaleString('zh-CN', { hour12: false })}`,
        `⏳ 持续时间：${formatTime(duration)}`,
      ];

      // 根据科技等级动态调整上限提示
      const maxHours = maxHalfHours / 2; // 转换为小时数
      if (duration > maxHours * 60) {
        reportLines.push(`⚠️ 注意：收益已在${maxHours}小时达到上限`);
      }

      // 添加收益信息
      let rewardLine = `💰 实际获得：${total}金币`;
      if (totalBonusRate > 0) {
        rewardLine += ` (基础值：${base}金币)`;
      }
      reportLines.push(rewardLine);

      // 计算科技总加成（科技加成+职业加成）
      const techCareerBonus = techBonusRate + careerBonusRate;

      // 添加加成信息（仅当有加成时显示）
      const hasTechCareerBonus = techCareerBonus > 0;
      const hasShipBonus = shipBonusRate > 0;
      const hasItemBonus = itemBonusRate > 0;
      const hasMinerBonus = minerBonusRate > 0;

      if (hasTechCareerBonus || hasShipBonus || hasItemBonus || hasMinerBonus) {
        reportLines.push(`⚡ 加成效果：`);

        // 显示合并的科技加成（科技+职业）
        if (hasTechCareerBonus) {
          // 显示科技等级和实际总加成
          reportLines.push(`▸ ⚙️ 科技加成Lv.${techLevel}：+${(techCareerBonus * 100).toFixed(0)}%金币`);
        }

        // 单独显示飞船加成
        if (hasShipBonus) {
          reportLines.push(`▸ 🚀 ${shipName}：+${(shipBonusRate * 100).toFixed(0)}%金币`);
        }

        // 显示采掘机器人加成
        if (hasItemBonus) {
          reportLines.push(`▸ 📦 自动采掘机器人：+${(miningRobotBonus * 100).toFixed(0)}%金币`);
        }

        // 显示深空矿工独立加成
        if (hasMinerBonus) {
          reportLines.push(`▸ ⛏️ 深空矿工专业加成：+${(minerBonusRate * 100).toFixed(0)}%金币`);
        }

        // 特殊效果提示（仅人类联盟5级科技）
        if (techLevel === 5 && career?.faction === '人类联盟') {
          reportLines.push(`▸ ⏱️ 单次挖矿时间上限增加至48小时`);
        }
      }

      // 在报告中添加总收益显示
      reportLines.push(`🏆 历史总挖矿收益：${(playerStats.totalMined || 0) + total}金币`);

      // 添加结束提示
      reportLines.push('💡 已自动开始新一轮挖矿');

      // 返回完整报告
      return reportLines.join('\n');
    });

  ctx.command('ggcevo/任务 [name]')
    .usage('输入"任务"查看所有任务列表，或"任务 任务名称"查看详细任务信息')
    .action(async ({ session }, name) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家游戏句柄
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '⚠️ 需要先绑定游戏句柄'

      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 无参数时显示所有任务列表
      if (!name) {
        const taskList = [];

        for (const [taskName, task] of Object.entries(Tasklist)) {
          // 查询玩家任务进度
          const [playerTask] = await ctx.database.get('ggcevo_task', {
            handle,
            taskId: task.id
          }).catch(() => [null])

          const completionStatus = playerTask?.progress || 0

          taskList.push([
            `▸ 【${taskName}】`,
            `类型: ${task.type}`,
            `奖励: ${task.price}金币`,
            `进度: ${completionStatus}/${task.target}`,
            '------------------'
          ].join('\n'))
        }

        return [
          '📋 任务列表',
          '使用"任务 任务名称"查看详细任务信息',
          '====================',
          ...taskList,
        ].join('\n')
      }

      // 查找指定任务
      const task = Object.entries(Tasklist).find(
        ([taskName]) => taskName === name
      )?.[1]

      if (!task) return '⚠️ 未找到该任务，请检查任务名称是否正确'

      // 查询玩家任务进度
      const [playerTask] = await ctx.database.get('ggcevo_task', {
        handle,
        taskId: task.id
      }).catch(() => [null])

      const progress = playerTask ? playerTask.progress : 0
      const completions = playerTask ? playerTask.Completions : 0

      return [
        `📝 任务详情: ${name}`,
        '====================',
        `任务名称: ${name}`,
        `任务类型: ${task.type}`,
        `任务目标: ${task.target}次`,
        `任务奖励: ${task.price}金币`,
        `当前进度: ${progress}/${task.target}`,
        `累计完成: ${completions}次`,
        '------------------',
        '完成条件:',
        task.condition,
        '====================',
        `📌 使用"完成任务 ${name}"领取奖励`
      ].join('\n')
    })

  ctx.command('ggcevo/完成任务 <name:text>', '完成指定任务领取奖励')
    .usage('输入"完成任务 任务名称"来完成任务并领取奖励')
    .action(async ({ session }, name) => {
      try {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取玩家游戏句柄
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '⚠️ 需要先绑定游戏句柄';

        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        // 检查签到记录是否存在
        const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
        if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

        // 查找匹配的任务
        if (!name) return '请输入"完成任务 任务名称"领取任务奖励';

        const taskEntry = Object.entries(Tasklist).find(([taskName]) =>
          taskName.includes(name)
        );

        if (!taskEntry) return `⚠️ 未找到名称包含"${name}"的任务`;

        const [taskName, taskConfig] = taskEntry;

        // 获取玩家任务数据
        const [taskData] = await ctx.database.get('ggcevo_task', {
          handle,
          taskId: taskConfig.id
        });

        if (!taskData) return `⚠️ 任务进度不足！当前进度：0/${taskConfig.target}`;

        // 检查进度是否足够
        if (taskData.progress < taskConfig.target) {
          return `⚠️ 任务进度不足！当前进度：${taskData.progress}/${taskConfig.target}`;
        }

        // 获取玩家阵营和职业信息
        const [careerData] = await ctx.database.get('ggcevo_sign', { handle });

        // 获取关键系统固件科技等级
        const [systemFirmwareTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 5 }).catch(() => [{ level: 0 }]);
        const techLevel = Math.min(systemFirmwareTech?.level || 0, 5);

        // 计算可完成的次数（核心修改点）
        const completableTimes = Math.floor(taskData.progress / taskConfig.target);
        const remainingProgress = taskData.progress % taskConfig.target;
        const newCompletions = taskData.Completions + completableTimes;

        // === 奖励计算逻辑 ===
        // 计算基础加成（科技和职业）
        let baseBonus = 0;
        if (techLevel > 0) {
          baseBonus = (careerData?.faction === '人类联盟' && ['舰长', '情报副官'].includes(careerData?.career))
            ? [0, 10, 20, 30, 40, 50][techLevel]
            : [0, 5, 10, 15, 20, 25][techLevel];
        }

        // 舰长职业额外加成
        const captainBonus = (careerData?.faction === '人类联盟' && careerData.career === '舰长') ? 50 : 0;

        // 总加成百分比
        const totalBonus = baseBonus + captainBonus;

        // 计算单次任务奖励
        const singleReward = totalBonus > 0
          ? Math.round(taskConfig.price * (1 + totalBonus / 100))
          : taskConfig.price;

        // 关键系统固件Lv.5额外结算概率（20%概率额外结算一次）
        let extraReward = 0;
        let extraCount = 0;
        if (techLevel >= 5) {
          for (let i = 0; i < completableTimes; i++) {
            if (Math.random() < 0.2) {
              extraReward += singleReward;
              extraCount++;
            }
          }
        }

        // 总奖励
        const totalReward = singleReward * completableTimes + extraReward;

        // 更新任务数据
        await ctx.database.set('ggcevo_task', {
          handle,
          taskId: taskConfig.id
        }, {
          progress: remainingProgress,
          Completions: newCompletions
        });

        // 更新金币数据
        const [signData] = await ctx.database.get('ggcevo_sign', { handle });
        const newTotalRewards = (signData?.totalRewards || 0) + totalReward;
        await ctx.database.upsert('ggcevo_sign', [{
          handle,
          totalRewards: newTotalRewards
        }], ['handle']);

        // 构建响应消息
        const response = [
          `🎉 成功完成 ${completableTimes} 次【${taskName}】任务！`
        ];

        // 显示总奖励信息（区分有无加成和额外结算情况）
        const baseTotal = taskConfig.price * completableTimes;
        if (totalBonus > 0 || extraReward > 0) {
          let rewardMsg = `💰 获得奖励：${totalReward}金币`;
          if (totalBonus > 0) {
            rewardMsg += ` (基础值: ${baseTotal}金币)`;
          }
          if (extraReward > 0) {
            rewardMsg += ` (额外结算: +${extraReward}金币)`;
          }
          response.push(rewardMsg);
        } else {
          response.push(`💰 获得奖励：${totalReward}金币`);
        }

        // 显示加成信息（如果存在加成）
        if (totalBonus > 0) {
          response.push(`⚡ 加成效果：`);

          // 显示关键系统固件加成信息
          if (baseBonus > 0) {
            response.push(`▸ ⚙️ 关键系统固件Lv.${techLevel}: +${baseBonus}%金币`);
          }

          // 显示舰长职业加成信息
          if (captainBonus > 0) {
            response.push(`▸ 🚀 舰长职业: +${captainBonus}%金币`);
          }
        }

        // 显示额外结算信息
        if (extraCount > 0) {
          response.push(`▸ 🔮 关键系统固件Lv.5触发：额外结算${extraCount}次任务奖励`);
        }

        // 添加任务信息
        response.push(
          `📊 累计完成次数: ${newCompletions}次`,
        );

        return response.join('\n');

      } catch (error) {
        console.error('完成任务命令时发生错误:', error);
        return '处理任务时发生错误，请稍后重试。';
      }
    });





  ctx.command('ggcevo/技能 [异形名称]')
    .usage('查询异形技能，输入"技能"查看所有异形，输入"技能 异形名称"查询详细技能')
    .action(async ({ session }, unitName) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 收集所有异形名称（去重排序）
      const allUnits = new Set<string>();
      bossPool.forEach(boss => {
        allUnits.add(boss.name);
      });
      const sortedUnits: string[] = [...allUnits].sort();

      // 无参数时显示所有异形列表
      if (!unitName) {
        return [
          '🦠 可查询技能的异形列表 🦠',
          '使用「技能 异形名称」查看详细技能',
          '====================',
          ...sortedUnits.map(name => `▸ ${name}`),
          '===================='
        ].join('\n');
      }

      // 查找匹配的异形（优先精确匹配）
      const searchName = unitName.trim().toLowerCase();
      
      // 首先尝试精确匹配
      const exactMatch = sortedUnits.find(name => name.toLowerCase() === searchName);
      
      // 如果没有精确匹配，再进行模糊匹配
      let matchedUnits: string[];
      if (exactMatch) {
        matchedUnits = [exactMatch];
      } else {
        matchedUnits = sortedUnits.filter(name =>
          name.toLowerCase().includes(searchName)
        );
      }

      // 匹配结果处理
      if (matchedUnits.length === 0) {
        return `未找到名称包含"${unitName}"的异形，请输入完整名称或部分关键词`;
      }
      if (matchedUnits.length > 1) {
        return [
          `找到多个包含"${unitName}"的异形：`,
          ...matchedUnits.map(name => `▸ ${name}`),
          '请输入完整的异形名称查询（例如：技能 异齿猛兽 或 技能 异齿猛兽首领）'
        ].join('\n');
      }

      // 获取匹配的异形单位
      const targetUnit = matchedUnits[0];
      let skills: string[] = [];
      let foundUnitType: string | null = null;

      // 在bossPool中查找异形技能配置
      bossPool.some(boss => {
        if (boss.name === targetUnit) {
          skills = boss.passive || [];
          foundUnitType = boss.type;
          return true;
        }
        return false;
      });

      // 处理未找到的情况
      if (!foundUnitType) {
        return `「${targetUnit}」未配置任何被动技能`;
      }

      // 获取技能详细信息（包括衍生技能）
      const expandedSkills = new Set<string>();
      const allSkillDetails: string[] = [];

      // 技能层级符号定义
      const levelSymbols = ['▸', '◇', '◆']; // 基础技能、一级衍生、二级衍生
      const levelTitles = [
        '🔹 【一级衍生技能】',
        '🔸 【二级衍生技能】',
        '【衍生技能】'
      ];

      // 递归添加技能详情（带层级）
      const addSkillDetail = (skillName: string, indentLevel = 0, visited = new Set<string>()) => {
        // 避免循环引用
        if (visited.has(skillName)) {
          allSkillDetails.push(`${'  '.repeat(indentLevel)}${levelSymbols[indentLevel] || '▸'} ${skillName}：[递归终止 - 避免循环引用]`);
          return;
        }
        visited.add(skillName);

        // 检查技能配置是否存在
        const config = passiveConfig[skillName];
        if (!config) {
          allSkillDetails.push(`${'  '.repeat(indentLevel)}${levelSymbols[indentLevel] || '▸'} ${skillName}：技能未定义`);
          return;
        }

        // 添加技能到已扩展集合
        expandedSkills.add(skillName);

        // 格式化描述文本（清理特殊符号）
        let desc = config.description
          .replace(/《([^》]+)》/g, '$1') // 移除《》标记
          .replace(/\n/g, '\n    ') // 处理换行
          .replace(/(；|。)/g, '$1\n    '); // 在分号/句号后换行

        // 添加当前技能
        const indent = '  '.repeat(indentLevel);
        const symbol = levelSymbols[indentLevel] || '▸';
        allSkillDetails.push(`${indent}${symbol} ${skillName}：\n    ${desc}`);

        // 添加衍生技能（如果有）
        const derivedSkills = config.derivedSkills || [];
        if (derivedSkills.length > 0) {
          // 添加衍生技能标题
          const titleIndex = indentLevel < levelTitles.length ? indentLevel : levelTitles.length - 1;
          allSkillDetails.push(`${indent}${levelTitles[titleIndex]}`);

          // 添加每个衍生技能
          derivedSkills.forEach(derivedSkill => {
            addSkillDetail(derivedSkill, indentLevel + 1, new Set(visited));
          });
        }
      };

      // 添加所有基础技能（初始调用）
      skills.forEach(skill => addSkillDetail(skill));

      // 处理无技能情况
      if (allSkillDetails.length === 0) {
        return `「${targetUnit}」未配置任何被动技能`;
      }

      // 构建最终输出
      return [
        `🦠 ${targetUnit} - ${foundUnitType} (${expandedSkills.size} 个被动技能) 🦠`,
        '====================',
        ...allSkillDetails,
        '====================',
        `注：部分技能可触发衍生技能，最多显示二级衍生技能`
      ].join('\n');
    });

  // 咕咕更新指令实现
  ctx.command('ggcevo/咕咕更新')
    .action(async ({ session }) => {
      try {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 按版本号降序排序获取最新三条更新
        const latestUpdates = [...ggcevoUpdates]
          .sort((a, b) => compareVersions(a.version, b.version))
          .slice(0, 3);

        if (latestUpdates.length === 0) {
          return "🛑 暂无更新记录";
        }

        // 构建更新消息
        let message = "🕊️ 咕咕之战版本更新内容：\n\n";

        for (const update of latestUpdates) {
          message += `🔹【版本 v${update.version} | ${update.time}】\n`;
          message += `${update.content}\n\n`;
        }

        const latestVersion = latestUpdates[0].version;
        message += `✅ 当前最新版本：v${latestVersion}\n`;
        message += "输入「ggcevo」查看全部指令\n";
        message += "输入「ggcevo/武器库」查看可购买武器";

        return message;
      } catch (error) {
        ctx.logger.error('咕咕更新指令出错:', error);
        return "🛠️ 系统维护中，请稍后再试";
      }
    });

  // 辅助函数：通过飞船ID获取名称
  function getSpaceshipNameById(spaceshipId: number): string {
    for (const [name, data] of Object.entries(spaceship)) {
      if (data.id === spaceshipId) {
        return name;
      }
    }
    return "普通飞船";
  }

  ctx.command('ggcevo/探索 [galaxyName]')
    .action(async ({ session }, galaxyName) => {

      // 宵禁检查
      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家基础信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signRecord] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signRecord) {
        return '📅 请先进行一次签到后再进行探索。';
      }

      // 检查玩家统计记录是否存在
      const [playerStats] = await ctx.database.get('ggcevo_player_stats', { handle });
      if (!playerStats) {
        return '📅 请先进行一次签到后再进行探索。';
      }

      // 物品配置（每个物品的基础掉落概率）
      const possibleItems = [
        { id: 2, name: "闪光弹", type: '手榴弹', chance: 0.1 },
        { id: 4, name: "脉冲手雷", type: '手榴弹', chance: 0.1 },
        { id: 9, name: "莫洛托夫燃烧弹", type: '手榴弹', chance: 0.05 },
        { id: 10, name: "铝热炸弹", type: '爆破物', chance: 0.05 },
      ];

      // 解析目标用户
      if (galaxyName) {
        const parsedUser = h.parse(galaxyName)[0];
        if (parsedUser && parsedUser.type === 'at') return '禁止探索群友。';
      }

      // 阵营验证
      const [career] = await ctx.database.get('ggcevo_sign', { handle });

      // 职业相关信息
      const careerName = career?.career;
      const careerCoinBonus = careerName === '总工程师' ? 50 : 0;
      const engineerSuccessBonus = careerName === '总工程师' ? 0.1 : 0;

      // 破坏者职业效果
      const demolitionsBonus = careerName === '破坏者' ? 0.2 : 0;
      const bomberBonusItem = careerName === '破坏者' ? '爆破物' : '';

      // 纵火狂职业效果
      const arsonistBonus = careerName === '纵火狂' ? 0.2 : 0;
      const molotovBonusItem = careerName === '纵火狂' ? '莫洛托夫燃烧弹' : '';

      // 获取玩家飞船信息
      let shipBonus = 0;
      let plunderRateBonus = 0;
      let isBehemoth = false;
      let shipSuccessBonus = 0;

      if (playerStats.spaceshipId) {
        const ship = Object.values(spaceship).find(s => s.id === playerStats.spaceshipId);
        if (ship) {
          shipBonus = ship.explorebonus || 0;
          shipSuccessBonus = ship.shipSuccessBonus || 0;
          // 保留庞兽号歼星舰的isBehemoth标记
          if (ship.id === 4) {
            isBehemoth = true;
            plunderRateBonus = 30;
          }
        }
      }

      // 获取反应堆科技等级
      const [techReactor] = await ctx.database.get('ggcevo_tech', { handle, techId: 6 });
      const techLevel = techReactor?.level || 0;
      let techBonusRate = 0;
      let careerBonusRate = 0;

      if (career?.faction === '人类联盟' && techLevel > 0) {
        const baseRates = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
        techBonusRate = baseRates[techLevel];
        if (['总工程师', '情报副官'].includes(careerName)) {
          careerBonusRate = baseRates[techLevel];
        }
      }

      // 获取当前时间
      const now = new Date();

      // 自动修复异常数据：如果 exploreStartTime 不为空但 galaxy 为空，说明数据异常
      if (playerStats.exploreStartTime && !playerStats.galaxy) {
        await ctx.database.set('ggcevo_player_stats', { handle }, {
          exploreStartTime: null,
          galaxy: null,
          plunderBonus: 0
        });
        playerStats.exploreStartTime = null;
        playerStats.galaxy = null;
      }

      // 处理探索状态
      if (playerStats.exploreStartTime) {
        const duration = Math.floor((now.getTime() - playerStats.exploreStartTime.getTime()) / 1000 / 60);
        const remainingMinutes = 12 * 60 - duration;

        if (remainingMinutes > 0) {
          return [
            '🪐 正在进行探索任务',
            `🌌 星系：${playerStats.galaxy}`,
            `⏱️ 开始时间：${playerStats.exploreStartTime.toLocaleString('zh-CN', { hour12: false })}`,
            `⏳ 剩余时间：${Math.floor(remainingMinutes / 60)}小时${remainingMinutes % 60}分钟`,
            '💡 提示：探索将持续12小时，完成后才可再次进行探索'
          ].join('\n');
        } else {
          // 探索完成 - 开始结算
          return await handleExploreCompletion();
        }
      }

      // 如果没有提供星系名称，显示可探索星系列表
      if (!galaxyName) {
        return showGalaxyList();
      }

      // 检查星系是否存在
      if (!galaxy[galaxyName]) {
        return `❌ 未知的星系："${galaxyName}"`;
      }

      // 检查玩家是否拥有飞船
      if (playerStats.spaceshipId === 0) {
        return '🚀 您还没有购买飞船，请先购买飞船后再进行探索。\n使用命令：购买飞船 [飞船名称]';
      }

      // 处理掠夺事件
      const plunderHandled = await handlePlunderEvent();

      // 开始新的探索任务
      if (!plunderHandled) {
        await ctx.database.upsert('ggcevo_player_stats', [{
          handle,
          exploreStartTime: new Date(),
          galaxy: galaxyName,
          exploreSuccessCount: playerStats.exploreSuccessCount || 0,
          plunderBonus: 0
        }], ['handle']);
      }

      // 计算预计成功率
      const galaxyData = galaxy[galaxyName];
      let estimatedRate = galaxyData.success;
      if (career?.faction === '人类联盟' && galaxyName === '联盟星系') estimatedRate += 0.1;
      else if (career?.faction === '辛迪加海盗' && galaxyName === '辛迪加星系') estimatedRate += 0.1;

      // 添加总工程师和飞船成功率加成
      estimatedRate += engineerSuccessBonus + shipSuccessBonus;
      estimatedRate = Math.min(estimatedRate, 1) * 100;

      // 探索开始信息
      return [
        `🚀 开始探索 ${galaxyName}`,
        `⏱️ 开始时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
        `⏳ 持续时间：12小时`,
        `📊 预计成功率：${estimatedRate.toFixed(0)}%`,
        `📦 可获得物品：${galaxyData.available.join('、') || '无'}`,
        `💰 预计可获得100-200金币`
      ].join('\n');

      // 辅助函数：处理探索完成
      async function handleExploreCompletion() {
        const returnsIncrement = (playerStats.exploreSuccessCount || 0) + 1;
        const galaxyData = galaxy[playerStats.galaxy];

        // 检查星系数据是否存在
        if (!galaxyData) {
          // 重置探索状态
          await ctx.database.upsert('ggcevo_player_stats', [{
            handle,
            exploreStartTime: null,
            galaxy: null,
            exploreSuccessCount: playerStats.exploreSuccessCount || 0,
            plunderBonus: 0
          }], ['handle']);
          return '🪐 探索过程中出现错误，请重新选择星系进行探索。';
        }

        // 计算实际成功率
        let successRate = galaxyData.success;
        if (career?.faction === '人类联盟' && playerStats.galaxy === '联盟星系') successRate += 0.1;
        else if (career?.faction === '辛迪加海盗' && playerStats.galaxy === '辛迪加星系') successRate += 0.1;

        // 添加成功率加成
        successRate += engineerSuccessBonus + shipSuccessBonus;
        successRate = Math.min(successRate, 1);

        // 基础金币奖励
        const baseCoinReward = Math.floor(Math.random() * 101) + 100;
        const galaxyBonusPercent = galaxyData.bonus * 100;

        // 详细加成效果
        const bonusEffects = [];

        // 添加各种加成效果提示
        if (galaxyBonusPercent) {
          bonusEffects.push(`▸ 🌌 ${playerStats.galaxy}：金币+${galaxyBonusPercent.toFixed(0)}%`);
        }

        if (shipBonus || shipSuccessBonus) {
          const shipType = playerStats.spaceshipId ? getSpaceshipNameById(playerStats.spaceshipId) : "未知飞船";
          if (shipBonus) bonusEffects.push(`▸ 🚀 ${shipType}：金币+${shipBonus}%`);
          if (shipSuccessBonus) bonusEffects.push(`▸ 🛸 ${shipType}：成功率+${Math.round(shipSuccessBonus * 100)}%`);
        }

        if (playerStats.plunderBonus) {
          const sign = playerStats.plunderBonus > 0 ? '+' : '';
          bonusEffects.push(`▸ ⚔️ 掠夺事件：${sign}${playerStats.plunderBonus}%金币`);
        }

        if (engineerSuccessBonus > 0) {
          bonusEffects.push(`▸ 🔧 总工程师职业：成功率+${Math.round(engineerSuccessBonus * 100)}%`);
        }

        // 计算物品掉落加成
        let itemDropBonus = 0;

        // 陨石星系的物品掉落加成
        if (playerStats.galaxy === '陨石星系') {
          itemDropBonus += 0.1;
          bonusEffects.push(`▸ 🌠 陨石星系效果：物品获得概率+10%`);
        }

        // 科技和职业的掉落加成
        if (career?.faction === '人类联盟' && techLevel === 5 && ['情报副官', '总工程师'].includes(careerName)) {
          itemDropBonus += 0.2;
          bonusEffects.push(`▸ 🔍 反应堆科技Lv.${techLevel}：物品获得概率+20%`);
        }

        // 合并科技加成和职业加成为一行显示
        const combinedTechBonus = techBonusRate + careerBonusRate;
        if (combinedTechBonus > 0) {
          bonusEffects.push(`▸ ⚙️ 反应堆科技Lv.${techLevel}：+${(combinedTechBonus * 100).toFixed(0)}%金币`);
        }

        // 总工程师金币加成
        if (careerCoinBonus) {
          bonusEffects.push(`▸ 🎓 总工程师职业：金币+${careerCoinBonus}%`);
        }

        // 破坏者职业效果提示
        if (demolitionsBonus > 0) {
          bonusEffects.push(`▸ 💣 破坏者职业：${bomberBonusItem}获得概率+${demolitionsBonus * 100}%`);
        }

        // 纵火狂职业效果提示
        if (arsonistBonus > 0) {
          bonusEffects.push(`▸ 🔥 纵火狂职业：${molotovBonusItem}获得概率+${arsonistBonus * 100}%`);
        }

        // 计算总加成系数
        const totalBonusMultiplier = 1 + (
          galaxyBonusPercent +
          shipBonus +
          (playerStats.plunderBonus || 0) +
          (techBonusRate + careerBonusRate) * 100 +
          careerCoinBonus
        ) / 100;

        // 最终金币计算
        let finalCoin = Math.floor(baseCoinReward * totalBonusMultiplier);
        const isSuccess = Math.random() < successRate;
        if (!isSuccess) {
          finalCoin = Math.floor(finalCoin * 0.5);
          bonusEffects.push(`▸ ⚠️ 探索失败：金币奖励减半`);
        }

        // 检查签到记录是否存在
        const [signRecord] = await ctx.database.get('ggcevo_sign', { handle });
        if (!signRecord) {
          return '📅 请先进行一次签到后再进行探索。';
        }

        // 更新金币总额
        const newTotalRewards = signRecord.totalRewards + finalCoin;
        await ctx.database.set('ggcevo_sign', { handle }, { totalRewards: newTotalRewards });

        // 物品奖励处理
        const itemRewards = await handleItemRewards(isSuccess, galaxyData.available, itemDropBonus, bonusEffects);

        // 计算总探索金币和总探索物品数量
        const totalExploreGold = (playerStats.totalExploreGold || 0) + finalCoin;
        const totalExploreItems = (playerStats.totalExploreItems || 0) + itemRewards.length;

        // 更新玩家统计记录
        await ctx.database.set('ggcevo_player_stats', { handle }, {
          exploreStartTime: null,
          galaxy: null,
          exploreSuccessCount: returnsIncrement,
          plunderBonus: 0,
          totalExploreGold,
          totalExploreItems
        });

        // 构建结算信息
        const isRewardModified = finalCoin !== baseCoinReward;
        const coinDisplay = isRewardModified
          ? `💰 金币 +${finalCoin}（基础值 ${baseCoinReward}）`
          : `💰 金币 +${finalCoin}`;

        return [
          isSuccess ? '🎉 探索成功！' : '⚠️ 探索失败！',
          `🌌 星系：${playerStats.galaxy}`,
          `🔮 实际成功率：${(successRate * 100).toFixed(1)}%`,
          coinDisplay,
          ...(itemRewards.length > 0 ? [`🎁 获得物品：${itemRewards.join('、')}`] : []),
          ...(bonusEffects.length > 0 ? ['', '⚡ 加成效果：', ...bonusEffects] : []),
          '',
          `🏆 已探索次数：${returnsIncrement}`,
          '💡 输入"探索 星系名称"开始下一轮探索'
        ].filter(Boolean).join('\n');
      }

      // 辅助函数：处理物品奖励
      async function handleItemRewards(isSuccess, availableItems, itemDropBonus, bonusEffects) {
        const itemRewards = [];
        if (!isSuccess) return itemRewards;

        for (const item of possibleItems) {
          if (!availableItems.includes(item.name)) continue;

          // 应用物品掉落加成
          let dropRate = item.chance + itemDropBonus;

          // 应用职业加成
          if (careerName === '破坏者' && item.type === bomberBonusItem) {
            dropRate += demolitionsBonus;
          }
          if (careerName === '纵火狂' && item.name === molotovBonusItem) {
            dropRate += arsonistBonus;
          }

          if (Math.random() < dropRate) {
            // 职业额外掉落机制
            let extraDrop = 0;
            if (careerName === '破坏者' && item.type === bomberBonusItem && Math.random() < 0.1) {
              extraDrop = 1;
              bonusEffects.push(`▸ 💣 破坏者职业效果：额外获得${item.name}×1`);
            }
            if (careerName === '纵火狂' && item.name === molotovBonusItem && Math.random() < 0.1) {
              extraDrop = 1;
              bonusEffects.push(`▸ 🔥 纵火狂职业效果：额外获得${item.name}×1`);
            }

            const finalQuantity = 1 + extraDrop;
            const [existing] = await ctx.database.get('ggcevo_backpack', { handle, itemId: item.id });

            if (existing) {
              await ctx.database.set('ggcevo_backpack', { handle, itemId: item.id }, {
                quantity: existing.quantity + finalQuantity
              });
            } else {
              await ctx.database.create('ggcevo_backpack', {
                handle,
                itemId: item.id,
                quantity: finalQuantity
              });
            }

            itemRewards.push(`${item.name}${extraDrop > 0 ? `×${finalQuantity}` : ''}`);
          }
        }

        return itemRewards;
      }

      // 辅助函数：显示星系列表
      function showGalaxyList() {
        const exploreOptions = [];
        for (const [name, info] of Object.entries(galaxy)) {
          const bonusPercent = Math.round(info.bonus * 100);
          exploreOptions.push([
            `【${name}】`,
            `- 成功率：${(info.success * 100).toFixed(0)}%`,
            `- 金币加成：${bonusPercent > 0 ? '+' : ''}${bonusPercent}%`,
            `- 可获得物品：${info.available.join('、') || '无'}`,
            `- 特殊效果：${info.effect}`
          ].join('\n'));
        }

        return [
          '🌌 可探索的星系：',
          ...exploreOptions.map(opt => `▸ ${opt}`),
          '\n使用格式：探索 [星系名称]',
          '示例：探索 联盟星系'
        ].join('\n');
      }

      // 辅助函数：处理掠夺事件
      async function handlePlunderEvent() {
        const basePlunderRate = 0.2;
        const actualPlunderRate = basePlunderRate + (plunderRateBonus / 100);
        if (!(Math.random() < actualPlunderRate)) return false;

        // 获取可掠夺目标
        const explorers = await ctx.database.get('ggcevo_player_stats', {
          galaxy: galaxyName,
          exploreStartTime: { $ne: null },
          plunderBonus: { $gte: 0 },
          handle: { $ne: handle }
        });

        if (explorers.length === 0) return false;

        // 过滤可掠夺目标，只选择plunderBonus为0的玩家
        const plunderTargets = explorers.filter(explorer => {
          return explorer.plunderBonus === 0;
        });

        if (plunderTargets.length === 0) return false;

        // 选择目标
        const target = plunderTargets[Math.floor(Math.random() * plunderTargets.length)];
        const targetShipId = target.spaceshipId || 0;
        const targetShipType = getSpaceshipNameById(targetShipId);
        const playerShipType = playerStats && playerStats.spaceshipId ? getSpaceshipNameById(playerStats.spaceshipId) : "未知型号";

        const isTargetBehemoth = targetShipId === 4;
        let defenseNote = '';

        // 新增：识别双方飞船型号
        const sameShipType = playerStats && playerStats.spaceshipId ? playerStats.spaceshipId === targetShipId : false;

        let baseSuccessRate = sameShipType ? 50 :
          isBehemoth ? 80 :
            playerStats && playerStats.spaceshipId === 3 ? 60 :
              50;

        // 庞兽号防御效果
        if (isTargetBehemoth && !isBehemoth && !sameShipType) {
          baseSuccessRate -= 30;
          defenseNote = '⚠️ 目标飞船为庞兽号歼星舰，掠夺成功率降低30%！';
        }

        // 相同型号提示
        if (sameShipType) {
          defenseNote = `⚠️ 检测到相同型号飞船「${playerShipType}」，掠夺成功率为50%！`;
        }

        // 获取目标玩家名称
        const [targetSign] = await ctx.database.get('ggcevo_sign', { handle: target.handle });
        const targetName = targetSign?.name || '未知玩家';

        // 发送掠夺提示
        await session.send([
          `❗ 您在探索过程中发现了【${targetName}】的飞船`,
          `🚀 对方飞船：${targetShipType}`,
          defenseNote,
          `🎯 掠夺成功率：${baseSuccessRate}%`,
          `⏱️ （30秒内输入"是"来进行掠夺）`
        ].filter(line => line !== '').join('\n'));

        try {
          const response = await session.prompt(30000);
          if (response !== '是') return false;

          const success = Math.random() < baseSuccessRate / 100;
          const [playerBonus, targetBonus] = success ? [20, -20] : [-20, 20];

          // 更新当前玩家的掠夺加成
          await ctx.database.upsert('ggcevo_player_stats', [{
            handle,
            exploreStartTime: new Date(),
            galaxy: galaxyName,
            exploreSuccessCount: playerStats?.exploreSuccessCount || 0,
            plunderBonus: (playerStats?.plunderBonus || 0) + playerBonus
          }], ['handle']);

          // 更新目标玩家的掠夺加成
          await ctx.database.set('ggcevo_player_stats', { handle: target.handle }, {
            plunderBonus: (target.plunderBonus || 0) + targetBonus
          });

          await session.send(
            success
              ? `✅ 掠夺成功！您获得${playerBonus}%金币加成，${targetName}的金币收益被降低了20%。`
              : `❌ 掠夺失败！您的金币收益被降低20%，${targetName}获得了20%的金币收益加成。`
          );
          return true;
        } catch (error) {
          // 忽略超时错误
          return false;
        }
      }
    });

  // 创建飞船ID到飞船名称的映射
  const shipIdToName = {};
  for (const [name, data] of Object.entries(spaceship)) {
    shipIdToName[data.id] = name;
  }

  // 1. 飞船信息指令 - 查询玩家当前拥有的飞船


  // 2. 购买飞船指令
  ctx.command('ggcevo/购买飞船 [shipName]')
    .alias('飞船')
    .action(async ({ session }, shipName) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取玩家基础信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
      if (!profile) return '🔒 需要先绑定游戏句柄。';
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 黑名单检查


      // 获取金币余额
      const [signRecord] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signRecord) return '请先进行至少一次签到获得金币后购买飞船';
      const coins = signRecord.totalRewards;

      // 检查飞船是否存在
      if (!shipName) {
        // 显示可购买飞船列表
        const shipList = Object.keys(spaceship).map(name => {
          const ship = spaceship[name];
          return [
            `【${name}】`,
            `- 价格: ${ship.price}金币`,
            `- 挖矿加成: ${ship.miningbonus}%`,
            `- 探索加成: ${ship.explorebonus}%`,
            `- 效果: ${ship.effect || '无'}`
          ].join('\n');
        });

        return [
          '🚀 可购买的飞船：',
          ...shipList.map(ship => `▸ ${ship}`),
          '\n使用格式：购买飞船 [飞船名称]',
          '示例：购买飞船 TX-12S隐形巡洋舰',
          `💡 提示：购买飞船后使用"个人信息"查看您的飞船`
        ].join('\n');
      }

      // 验证飞船名称
      const ship = spaceship[shipName];
      if (!ship) return `❌ 未知飞船："${shipName}"`;

      // 检查金币是否足够
      if (coins < ship.price) {
        return `❌ 金币不足！购买需要${ship.price}金币，当前余额${coins}金币`;
      }

      // 检查玩家是否已有飞船
      const [existingStats] = await ctx.database.get('ggcevo_player_stats', { handle });
      const now = new Date();

      // 检查玩家统计记录是否存在
      if (!existingStats) {
        return '📅 请先进行一次签到后再购买飞船。';
      }

      if (existingStats.spaceshipId) {
        // 获取原有飞船名称
        const existingShipName = shipIdToName[existingStats.spaceshipId] || '未知飞船';

        // 已有飞船时提示替换
        await session.send(
          `⚠️ 您已拥有飞船【${existingShipName}】，是否替换为【${shipName}】?\n` +
          `✔️ 更换需支付 ${ship.price}金币（原飞船无退款）\n` +
          '请在30秒内输入"是"确认更换，或输入其他内容取消。'
        );

        const confirm = await session.prompt(30000);
        if (confirm !== '是') return '🚫 已取消购买';

        // 更新飞船记录
        await ctx.database.set('ggcevo_player_stats', { handle }, {
          spaceshipId: ship.id
        });
      } else {
        // 更新飞船记录
        await ctx.database.set('ggcevo_player_stats', { handle }, {
          spaceshipId: ship.id
        });
      }


      // 扣款购买飞船
      const newCoins = coins - ship.price;
      await ctx.database.set('ggcevo_sign', { handle }, {
        totalRewards: newCoins
      });

      // 在购买指令的success部分添加提示
      return [
        `🎉 成功购买 ${shipName}！`,
        `⛏️ 挖矿加成：+${ship.miningbonus}%金币`,
        `🔭 探索加成：+${ship.explorebonus}%金币`,
        `💡 特殊效果：${ship.effect || '无'}`,
        `📅 购买时间：${now.toLocaleString('zh-CN', { hour12: false })}`,
        (existingStats && existingStats.spaceshipId) ? `🔁 已替换原有飞船` : '🚀 祝你星系探险愉快！',
        '\n📡 使用"飞船信息"查看您的飞船详情' // 新增的提示
      ].join('\n');
    });









  ctx.command('ggcevo/兑换资源 [name] [amount]')
    .usage('输入"兑换资源"查看可兑换物品列表\n输入"兑换资源 物品名称 [数量]"进行兑换')
    .action(async ({ session }, name, amount) => {

      const Curfew = fixedCurfewCheck(session, config)
      if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

      // 获取用户绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄'
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

      // 检查签到记录是否存在
      const [signCheck] = await ctx.database.get('ggcevo_sign', { handle });
      if (!signCheck) return '🔒 您尚未进行签到，请先使用"签到"指令';

      // 可兑换物品映射表
      const exchangeItems: { [key: string]: any } = {
        // === 特殊资源兑换 ===
        '金币': {
          type: 'resource',
          costItemId: 8,
          costAmount: 1,
          valuePerCoupon: 100,
          currencyField: 'totalRewards',
          table: 'ggcevo_sign',
          display: '1张资源兑换券 → 100金币'
        },
        '红晶': {
          type: 'resource',
          costItemId: 8,
          costAmount: 1,
          valuePerCoupon: 1,
          currencyField: 'redcrystal',
          table: 'ggcevo_sign',
          display: '1张资源兑换券 → 1红晶',
          preCheck: async () => {
            const [career] = await ctx.database.get('ggcevo_sign', { handle })
            if (!career || career.faction !== '辛迪加海盗') {
              return `⚠️ 兑换失败：仅限【辛迪加海盗】组织成员兑换，您当前属于【${career?.faction || '无'}】`
            }
            return null
          }
        }
        // 可在此继续添加其他物品兑换...
      }

      // 根据配置决定是否添加兑换券兑换资源兑换券功能
      if (config.enableExchangeCouponForResource) {
        exchangeItems['资源兑换券'] = {
          type: 'item',
          costItemId: 2,     // 消耗：ItemID=2 (兑换券)
          costAmount: 1,     // 每张兑换券消耗数量
          gainItemId: 8,     // 获得：ItemID=8 (资源兑换券)
          gainAmount: 20,    // 获得数量
          display: '1张兑换券 → 20张资源兑换券'
        }
      }

      // 无参数时显示可兑换物品列表
      if (!name) {
        // 查询用户持有的相关物品
        const [resourceCoupon] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 8 })   // 资源兑换券
        const [exchangeCoupon] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 2 })    // 兑换券

        const examples = [
          '"兑换资源 金币 5" → 兑换500金币（消耗5张资源券）'
        ]
        if (config.enableExchangeCouponForResource) {
          examples.push('"兑换资源 资源兑换券 2" → 兑换40张资源券（消耗2张兑换券）')
        }

        return [
          '🛒 资源兑换商店 🛒',
          '使用 "兑换资源 物品名称 数量" 进行兑换',
          '====================',
          `🪙 资源兑换券: ${resourceCoupon?.quantity || 0}张`,
          `🎟️ 兑换券: ${exchangeCoupon?.quantity || 0}张`,
          '====================',
          ...Object.entries(exchangeItems).map(([itemName, config]) => {
            return `▸ ${itemName}: ${config.display}`
          }),
          '====================',
          '输入示例：',
          ...examples
        ].join('\n')
      }

      // 验证物品名称有效性
      const itemConfig = exchangeItems[name]
      if (!itemConfig) return `⚠️ 无效物品名称，可用选项：${Object.keys(exchangeItems).join('、')}`

      // 解析兑换数量
      let exchangeCount = parseInt(amount) || 1
      if (exchangeCount <= 0) return '⚠️ 兑换数量必须大于0'
      if (exchangeCount > 100) return '⚠️ 单次最多兑换100次'

      try {
        if (itemConfig.type === 'resource') {
          // ===== 资源兑换逻辑处理 =====
          // 执行特殊检查（如红晶需要海盗组织）
          if (itemConfig.preCheck) {
            const checkResult = await itemConfig.preCheck()
            if (checkResult) return checkResult
          }

          // 检查资源兑换券持有量
          const [costItem] = await ctx.database.get('ggcevo_backpack', {
            handle,
            itemId: itemConfig.costItemId
          })
          const requiredCoupons = exchangeCount * itemConfig.costAmount
          const heldCoupons = costItem?.quantity || 0

          if (heldCoupons < requiredCoupons) {
            return `⚠️ ${name}不足，需要${requiredCoupons}张资源兑换券，当前持有：${heldCoupons}张`
          }

          // 计算获得资源量
          const gainAmount = itemConfig.valuePerCoupon * exchangeCount

          await ctx.database.withTransaction(async () => {
            // 扣除资源兑换券
            await ctx.database.set('ggcevo_backpack',
              { handle, itemId: itemConfig.costItemId },
              { quantity: heldCoupons - requiredCoupons }
            )

            // 更新资源表
            const [record] = await ctx.database.get(itemConfig.table, { handle })
            if (record) {
              await ctx.database.set(itemConfig.table,
                { handle },
                { [itemConfig.currencyField]: record[itemConfig.currencyField] + gainAmount }
              )
            } else {
              await ctx.database.create(itemConfig.table, {
                handle,
                userId: session.userId,
                [itemConfig.currencyField]: gainAmount,
                ...(itemConfig.table === 'ggcevo_sign' ? { lastSign: new Date() } : {})
              })
            }
          })

          return `🎉 兑换成功！使用${requiredCoupons}张资源券兑换了${gainAmount}${name}`

        } else if (itemConfig.type === 'item') {
          // ===== 物品兑换逻辑处理 =====
          // 检查源物品持有量
          const [costItem] = await ctx.database.get('ggcevo_backpack', {
            handle,
            itemId: itemConfig.costItemId
          })
          const requiredQuantity = exchangeCount * itemConfig.costAmount
          const heldQuantity = costItem?.quantity || 0

          if (heldQuantity < requiredQuantity) {
            const requiredName = itemConfig.costItemId === 2 ? '兑换券' : '物品'
            return `⚠️ ${name}不足，需要${requiredQuantity}张${requiredName}，当前持有：${heldQuantity}张`
          }

          // 计算获得物品数量
          const gainQuantity = exchangeCount * itemConfig.gainAmount

          await ctx.database.withTransaction(async () => {
            // 扣除源物品
            await ctx.database.set('ggcevo_backpack',
              { handle, itemId: itemConfig.costItemId },
              { quantity: heldQuantity - requiredQuantity }
            )

            // 添加目标物品
            const [targetItem] = await ctx.database.get('ggcevo_backpack', {
              handle,
              itemId: itemConfig.gainItemId
            })
            if (targetItem) {
              await ctx.database.set('ggcevo_backpack',
                { handle, itemId: itemConfig.gainItemId },
                { quantity: targetItem.quantity + gainQuantity }
              )
            } else {
              await ctx.database.create('ggcevo_backpack', {
                handle,
                itemId: itemConfig.gainItemId,
                quantity: gainQuantity
              })
            }
          })

          const costName = itemConfig.costItemId === 2 ? '兑换券' : '物品'
          return `🔄 兑换成功！使用${requiredQuantity}张${costName}兑换了${gainQuantity}张${name}`
        }

        return '⚠️ 未知的兑换类型'
      } catch (error) {
        console.error('兑换失败:', error)
        return '⚠️ 兑换过程中出错，请稍后再试'
      }
    })

  ctx.command('ggcevo/异形刷新权重', '查询当前主宰刷新权重')
    .alias('yx刷新权重')
    .action(async ({ session }) => {
      try {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 从数据库获取权重数据
        const weights = await ctx.database
          .select('ggcevo_boss_weights', {})
          .execute();

        if (!weights || weights.length === 0) {
          return '当前没有配置BOSS刷新权重数据';
        }

        // 关联BOSS组名称并排序
        const sortedList = weights.map(w => {
          const group = bossGroups.find(g => g.groupId === w.groupId);
          return {
            id: w.groupId,
            name: group?.name || `未知BOSS组(${w.groupId})`,
            weight: w.weight,
            lastSpawn: w.lastSpawn
          };
        }).sort((a, b) => b.weight - a.weight);

        // 修改日期格式化函数为中国时区
        const dateFormat = (timestamp) => {
          return new Date(timestamp).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(',', '');
        };

        let reply = '当前BOSS组刷新权重（按权重从高到低）：\n';
        reply += '===========================\n';

        sortedList.forEach(boss => {
          reply += `【${boss.name}】\n`;
          reply += `▸ 权重：${boss.weight}\n`;
          // 检查上次刷新时间是否为UTC 0点或无
          let lastSpawnText = '无';
          if (boss.lastSpawn) {
            const spawnDate = new Date(boss.lastSpawn);
            // 检查是否为UTC 0点时间
            if (!(spawnDate.getUTCHours() === 0 && spawnDate.getUTCMinutes() === 0 && spawnDate.getUTCSeconds() === 0)) {
              lastSpawnText = dateFormat(boss.lastSpawn);
            }
          }
          reply += `▸ 上次刷新：${lastSpawnText}\n`;
          reply += '---------------------------\n';
        });

        return reply;
      } catch (err) {
        ctx.logger.error('BOSS权重查询失败', err);
        return '查询BOSS权重时发生错误，请检查服务器日志';
      }
    });

  // 添加定时任务，每半小时触发一次
  ctx.setInterval(async () => {
    try {
      // 1. 检测ggcevo_boss_weights为空时，初始化每个boss组的权重
      const weights = await ctx.database.get('ggcevo_boss_weights', {});
      if (weights.length === 0) {
        await initWeights(ctx);
        console.log('初始化boss权重成功');
      }

      // 2. 检测ggcevo_boss为空时，根据权重随机创建一个boss组
      const bosses = await ctx.database.get('ggcevo_boss', {});
      if (bosses.length === 0) {
        await activateNextBossGroup(ctx);
        console.log('创建新的boss组成功');
      }

      // 3. 若检测到type为主宰的isActive为false，则处理重置逻辑
      const inactiveMainBosses = await ctx.database.get('ggcevo_boss', { type: '主宰', isActive: false });
      if (inactiveMainBosses.length > 0) {
        // a. 将所有玩家的ggcevo_player_stats的totalDamage，attackCount清0
        await ctx.database.set('ggcevo_player_stats', {}, { totalDamage: 0, attackCount: 0 });

        // b. 清空ggcevo_boss数据库所有数据
        await ctx.database.remove('ggcevo_boss', {});

        // c. 根据权重重新生成新的boss组
        await activateNextBossGroup(ctx);
        console.log('重置boss组并创建新的boss组成功');
      }
    } catch (error) {
      console.error('定时任务执行失败:', error);
    }
  }, 30 * 60 * 1000); // 每半小时执行一次

}
