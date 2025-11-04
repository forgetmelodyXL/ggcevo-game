import { Context, Schema, h, $ } from 'koishi'
import 'koishi-plugin-sc2arcade-search'
import { weaponConfig, modConfig } from './weapons'
import { PKProfile } from './database'
import { SyndicatedItems, initDefaultItems, itemConfig } from './items'
import { spaceStationCrewConfig, syndicatePirateConfig, checkTransferRequirements } from './careersystem/careers'
import { Spacestationtechnology, itemupgrades } from './careersystem/technology'
import { Tasklist } from './tasks'
import { bossPool } from './boss/boss'
import { battleStatsMap } from './boss/BattleEffectProcessor'
import { passiveConfig } from './boss/passive'
import { wishConfig } from './wish'
import { ggcevoUpdates, compareVersions } from './update'
import { gachaWithPity, checkSensitiveWord, getRandomInt, PetCapsuleToy, isSameDate, convertUTCtoChinaTime, formatDate, createHpBar, activateNextBossGroup, calculateTotalPower, handleWeaponUpgrade, handleTechUpgrade, applyItemEffect, generateUpgradePriceList, getRankInfo, isWithinProtection, formatTime, legendaryDiscounts, GUESSING_ITEMS, fixedCurfewCheck, privateChatCurfewCheck, getHalfDayIdentifier, initWeights, updateWeights } from './utils'
import { handlePrimaryAttack, handleScatterAttack, handleDeathTargets, calculateRewards, updateSignRecord, buildResultMessage, handleBroadcasts, updateBossDamageRecord, updateTaskProgress, testAttackFunction, verifyFinalBlow } from './boss/attackhandling'
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
  checkInterval: number
  dailyPKLimit: number
  sameOpponentLimit: boolean  // 同对手限制开关
  maxDailyBeChallenged: number // 每日被挑战次数限制
  unlimitedBossAttack: boolean // 无限制攻击主宰开关
  pointBonusEnabled: boolean
  enableViolationAlert: boolean
  enableCurfew: boolean       // 是否开启宵禁模式
  enablePlayRequirement: boolean
  enableGuguBattle: boolean // 咕咕之战开关
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
    enableGuguBattle: Schema.boolean()  // 新增的咕咕之战开关
      .description('是否开启咕咕之战功能').default(true),
  }).description('基础设置'),

  // 赛季与兑换配置组
  Schema.object({
    rankseason: Schema.string()
      .description('当前赛季名称(影响兑换系统)').default('S1'),
    autorank: Schema.boolean()
      .description('自动同步天梯数据').default(false),
    ignoreGlobalLimit: Schema.boolean()
      .description('禁用全局兑换限制(谨慎开启)').default(false),
    pointBonusEnabled: Schema.boolean()  // 新增配置项
      .description('是否开启积分加成功能').default(false),
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

  // 通知系统配置组 - 新增违规提醒开关
  Schema.object({
    groupId: Schema.array(Schema.string())
      .description('广播通知群组').default([]),
    checkInterval: Schema.number()
      .description('大厅监控检查间隔(秒)').default(60),
    enableViolationAlert: Schema.boolean()
      .description('启用违规玩家房间提醒').default(false), // 新增配置项
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
    handle: 'string',
    lastSign: 'timestamp',
    monthlyDays: 'unsigned',  // 当月累计签到天数
    totalRewards: 'unsigned',
    totalPulls: 'unsigned',
    pityCounter: 'unsigned',
    fullPityCount: 'unsigned', // 吃满保底的次数
    bigPrizeCount: 'unsigned',
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
    startTime: 'timestamp',
    endTime: 'timestamp',
    creator: 'string',
    status: 'string'
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

  ctx.model.extend('ggcevo_punishment', {
    id: 'unsigned',          // 自增序号
    handle: 'string',        // 平台用户句柄/ID
    qq: 'string',            // 关联QQ号
    level: 'string',         // 处罚等级
    reason: 'text',          // 长文本存储处罚原因
    count: 'unsigned',       // 处罚次数
    reviewer: 'string',      // 审核人名称
    date: 'timestamp',       // 处罚时间
    comment: 'text',         // 备注信息（可选）
  }, {
    primary: 'id',
    autoInc: true,           // 启用自增ID
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

  ctx.model.extend('ggcevo_blacklist', {
    handle: 'string',
    name: 'string',
    createdAt: 'timestamp',
  }, {
    primary: 'handle',
  })

  ctx.model.extend('ggcevo_pk', {
    handle: 'string',
    name: 'string',
    total: 'unsigned',
    wins: 'unsigned',
    todayCount: 'unsigned',
    lastPK: 'timestamp',
    enable: {
      type: 'boolean',
      initial: false,       // 默认开启
    },
    lastToggle: 'timestamp'
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
    groupId: 'unsigned',
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

  ctx.model.extend('ggcevo_boss_damage', {
    handle: 'string',
    playerName: 'string',
    totalDamage: 'unsigned',
    attackCount: 'unsigned',
    bossGroupId: 'unsigned',
    lastattackDate: 'timestamp',
  }, {
    primary: 'handle',
  })

  ctx.model.extend('ggcevo_damage_logs', {
    id: 'unsigned',
    handle: 'string',
    date: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
  })

  ctx.model.extend('ggcevo_boss_weights', {
    bossId: 'unsigned',
    weight: 'unsigned',
    lastSpawn: 'timestamp',
  }, {
    primary: 'bossId',
  })

  ctx.model.extend('ggcevo_wish', {
    id: 'unsigned',
    handle: 'string',
    wishname: 'string',
    startTime: 'timestamp',
    endTime: 'timestamp',
    isused: 'boolean',
  }, {
    primary: 'id',
    autoInc: true,
  })

  ctx.model.extend('ggcevo_careers', {
    handle: 'string',
    group: 'string',
    career: 'string',
    redcrystal: 'unsigned',
    date: 'timestamp',
  }, {
    primary: 'handle',
  })

  ctx.model.extend('ggcevo_warehouse', {
    handle: 'string',
    itemId: 'unsigned',
    quantity: 'unsigned',
    bonus: 'unsigned',
    upgrades: 'unsigned',
  }, {
    primary: ['handle', 'itemId'],
  })

  ctx.model.extend('ggcevo_tech', {
    handle: 'string',
    techId: 'unsigned',
    level: 'unsigned',
  }, {
    primary: ['handle', 'techId'],
  })

  ctx.model.extend('ggcevo_Mining', {
    handle: 'string',
    startTime: 'timestamp',
    totalMined: 'unsigned',
  }, {
    primary: 'handle',
  })

  ctx.model.extend('ggcevo_task', {
    handle: 'string',
    taskId: 'unsigned',
    progress: 'unsigned',
    Completions: 'unsigned',
  }, {
    primary: ['handle', 'taskId'],
  })

  ctx.model.extend('ggcevo_permissions', {
    handle: 'string',
    legendarypermissions: 'unsigned',
    explosiondoorauthority: 'unsigned',
  }, {
    primary: 'handle',
  })

  ctx.model.extend('ggcevo_pk_protection', {
    id: 'unsigned',
    handle: 'string',
    startTime: 'timestamp',
    endTime: 'timestamp',
    status: 'string',
  }, {
    primary: 'id',
    autoInc: true,
  })

  ctx.model.extend('ggcevo_spaceship', {
    handle: 'string',
    id: 'unsigned',
    createTime: 'timestamp',
  }, {
    primary: 'handle',
  })

  ctx.model.extend('ggcevo_explore', {
    handle: 'string',
    name: 'string',
    startTime: 'timestamp',
    galaxy: 'string',
    returns: 'unsigned',
    plunderbonus: 'integer',
    status: 'string',
  }, {
    primary: 'handle',
  })

  ctx.model.extend('ggcevo_global_stats', {
    groupId: 'string',
    updatedAt: 'timestamp',
    rankdate: 'timestamp',
  }, {
    primary: 'groupId',
  })

  // 定义竞猜记录模型 (双主键：handle + itemId)
  ctx.model.extend('ggcevo_guess', {
    handle: 'string',
    name: 'string',
    itemId: 'unsigned',
    guessContent: 'string',
    amount: 'unsigned',
    wins: 'unsigned',
    createdAt: 'timestamp',
  }, {
    primary: ['handle', 'itemId'],
  })



  // 状态维护定时任务
  ctx.setInterval(async () => {
    const now = new Date()

    // 任务1：更新已开始但状态未变的未开始活动
    await ctx.database.set('ggcevo_activity',
      {
        status: '未开始',
        startTime: { $lte: now },
        endTime: { $gte: now }
      },
      { status: '进行中' }
    )

    // 任务2：更新已过期但状态未变的进行中活动
    await ctx.database.set('ggcevo_activity',
      {
        status: '进行中',
        endTime: { $lt: now }
      },
      { status: '已结束' }
    )
  }, 60 * 60 * 1000) // 每小时执行一次




  if (config.enableGuguBattle) {

    // BOSS轮换定时任务（包含竞猜结算）
    ctx.setInterval(async () => {
      // 检查并初始化权重表
      const weightCount = await ctx.database.get('ggcevo_boss_weights', {});
      if (!weightCount || weightCount.length === 0) {
        await initWeights(ctx);
      }

      // 首先检测空表情况
      const totalBosses = await ctx.database.select('ggcevo_boss').execute(row => $.count(row.name));

      // 获取所有配置群组（假设config.groupId是数组）
      const groupIds = [...config.groupId];

      if (totalBosses === 0) {
        const firstBoss = await activateNextBossGroup(ctx);
        await ctx.broadcast(groupIds, `🔄 咕咕之战系统已初始化，首个主宰【${firstBoss.name}】已登场！`);
        return;
      }

      const now = new Date();

      // 查找所有需要刷新的BOSS组
      const expiredGroups = await ctx.database.select('ggcevo_boss')
        .where({
          type: '主宰',
          respawnTime: { $lte: now }, // 修改为小于等于当前时间
          isActive: false
        })
        .execute();

      // 处理每个需要刷新的BOSS组
      for (const group of expiredGroups) {
        const currentGroupId = group.groupId;

        // 清空关联数据
        await ctx.database.remove('ggcevo_boss_damage', {});
        await ctx.database.remove('ggcevo_boss', {});
        await ctx.database.set('ggcevo_weapons', {}, { comboCount: 0 });
        await ctx.database.set('ggcevo_weapons', {}, { pityCounter: 0 });

        // 创建新BOSS
        const newBossGroup = await activateNextBossGroup(ctx, currentGroupId);

        await updateWeights(ctx, newBossGroup.groupId)

        // 🎯 竞猜结算逻辑 🎯
        const nextBossName = newBossGroup.name;
        const guessingRecords = await ctx.database.get('ggcevo_guess', {
          itemId: 1,
        });

        if (guessingRecords.length > 0) {
          const winners = guessingRecords.filter(r =>
            r.guessContent === nextBossName
          );

          const winMessages = [];

          // 结算赢家奖励
          for (const winner of winners) {
            const prize = Math.floor(winner.amount * 5);
            const [signInfo] = await ctx.database.get('ggcevo_sign', {
              handle: winner.handle
            });

            if (signInfo) {
              await ctx.database.set('ggcevo_sign', { handle: winner.handle }, {
                totalRewards: signInfo.totalRewards + prize
              });

              // ✅ 给获胜者增加获胜次数 (使用读取+写入方式)
              // 先获取当前用户的竞猜记录
              const [guessRecord] = await ctx.database.get('ggcevo_guess', {
                handle: winner.handle,
                itemId: 1
              });

              // 获取当前wins值，默认为0
              const currentWins = guessRecord?.wins || 0;

              // 更新wins值
              await ctx.database.set('ggcevo_guess', {
                handle: winner.handle,
                itemId: 1
              }, {
                wins: currentWins + 1
              });

              // 记录中奖消息
              winMessages.push(`${winner.name}: 获得${prize}金币（第${currentWins + 1}次猜中）`);
            }
          }

          // 🎯 修改点：将所有项目1的竞猜记录标记为已结算
          await ctx.database.set('ggcevo_guess', {
            itemId: 1,
          }, {
            guessContent: '',    // 清空竞猜内容
            amount: 0            // 重置竞猜金额
          })

          // 记录日志
          ctx.logger('ggcevo').info(`竞猜结算: ${winners.length}位玩家猜中新主宰【${nextBossName}】`);

          // 构建广播消息
          const broadcastMsg = [
            `🔄 新的主宰【${nextBossName}】已刷新！`,
            ...(winMessages.length > 0 ? [
              `🎉 猜中新主宰的玩家:`,
              ...winMessages // 显示玩家名称、金额和猜中次数
            ] : [])
          ].join('\n');

          await ctx.broadcast(groupIds, broadcastMsg);
        } else {
          // 没有竞猜记录的普通刷新
          await ctx.broadcast(groupIds, `🔄 新的主宰【${nextBossName}】已刷新！`);
        }
      }
    }, 60 * 1000); // 每分钟检查一次



    ctx.setInterval(async () => {
      if (config.autorank) {
        try {
          const ggcmap = await ctx.database.get('ggcevo_global_stats', {});

          const lastdate = ggcmap[0].updatedAt
          // 修复1：转换日期类型
          let currentMaxDate = new Date(lastdate)
          let nextCursor: string | null = null
          let shouldContinue = true
          let pageMaxDate = new Date(0)


          do {
            // 构建请求URL
            const baseUrl = `https://api.sc2arcade.com/maps/3/165561/match-history`
            const params = new URLSearchParams({
              orderBy: 'date',
              orderDirection: 'desc',
              includeMatchResult: 'false',
              includeMatchLobby: 'false',
              limit: '200',
              after: nextCursor || ''
            })

            // 配置请求参数
            const getconfig = {
              url: `${baseUrl}?${params}`,
              config: { proxyAgent: config.proxyAgent }
            }

            // 发送请求
            let response
            if (!config.proxyAgent) {
              response = await ctx.http.get(getconfig.url)
            } else {
              response = await ctx.http.get(getconfig.url, getconfig.config)
            }


            // 处理当前页数据
            for (const record of response.results) {
              // 修复3：正确转换日期类型
              const recordDate = new Date(record.date)

              if (recordDate <= currentMaxDate) {
                shouldContinue = false
                break
              }

              // 更新页内最大日期
              if (recordDate > pageMaxDate) {
                pageMaxDate = recordDate
              }

              const handle = `${record.profile.regionId}-S2-${record.profile.realmId}-${record.profile.profileId}`
              // 准备MMR更新
              const [ggcrank] = await ctx.database.get('ggcevo_rank', { handle: handle, rankseason: config.rankseason })
              await ctx.database.upsert('ggcevo_rank', [{
                handle: handle,
                name: record.profile.name,
                rank: record.decision === 'win' ? (ggcrank?.rank || 0) + 150 : (ggcrank?.rank || 0) - 50,
                wins: (ggcrank?.wins || 0) + (record.decision === 'win' ? 1 : 0),
                matches: (ggcrank?.matches || 0) + 1,
                rankseason: config.rankseason
              }])
            }



            // 修复5：安全终止条件
            nextCursor = response.page?.next || null

          } while (nextCursor && shouldContinue)
          if (pageMaxDate > currentMaxDate) {
            currentMaxDate = pageMaxDate
            await ctx.database.set('ggcevo_global_stats', {}, {
              updatedAt: new Date(currentMaxDate.toISOString())
            })
          }
        } catch (err) {
          console.error('错误:', err)
        }
      }

    }, 60 * 60 * 1000) // 每小时执行

    // 创建定时任务
    ctx.setInterval(async () => {
      // 新增：检查开关状态
      if (config.enableViolationAlert) {
        try {
          const response = await ctx.http<Sc2LobbyResponse>('get', 'https://api.sc2arcade.com/lobbies/history?regionId=3&mapId=165561&orderDirection=desc&includeMapInfo=false&includeSlots=true&includeSlotsProfile=true&includeSlotsJoinInfo=false&includeJoinHistory=false&includeMatchResult=false&includeMatchPlayers=false')
          const data = response.data

          // 处理大厅数据
          const openLobbies = data.results.filter(lobby =>
            lobby.status === 'open' &&
            !processedLobbies.has(lobby.id)
          )

          // 收集所有玩家信息
          const allPlayers = openLobbies
            .flatMap(lobby => lobby.slots
              .filter(slot => slot.kind === 'human' && slot.profile)
              .map(slot => ({
                regionId: slot.profile.regionId,
                realmId: slot.profile.realmId,
                profileId: slot.profile.profileId,
                handle: `${slot.profile.regionId}-S2-${slot.profile.realmId}-${slot.profile.profileId}`,
                name: slot.name // 保留名称用于后续展示
              }))
            )

          // 查询处罚记录
          const punishmentRecords = await ctx.database
            .select('ggcevo_punishment')
            .where({
              $and: [
                { handle: { $in: allPlayers.map(p => p.handle) } },
                { id: { $gte: 1889 } },
                { level: { $in: ['B', 'B+', 'A'] } }
              ]
            })
            .execute()

          // 构建受处罚玩家集合
          const punishedHandles = new Set(punishmentRecords.map(r => r.handle))

          // 处理每个大厅
          for (const lobby of openLobbies) {
            // 匹配当前大厅的违规玩家
            const lobbyPlayers = lobby.slots
              .filter(slot => slot.kind === 'human' && slot.profile)
              .map(slot => ({
                regionId: slot.profile.regionId,
                realmId: slot.profile.realmId,
                profileId: slot.profile.profileId,
                handle: `${slot.profile.regionId}-S2-${slot.profile.realmId}-${slot.profile.profileId}`,
                name: slot.name
              }))

            const violators = lobbyPlayers.filter(p => punishedHandles.has(p.handle))

            if (violators.length > 0) {
              // 获取未受处罚玩家
              const unpunishedPlayersData = lobbyPlayers.filter(p =>
                !punishedHandles.has(p.handle)
              )

              // 构建查询条件
              const queryConditions = unpunishedPlayersData.map(p => ({
                regionId: p.regionId,
                realmId: p.realmId,
                profileId: p.profileId
              }))

              // 查询安全玩家ID
              const safePlayers = await ctx.database
                .select('sc2arcade_player')
                .where({ $or: queryConditions })
                .execute()
                .then(res => res.map(r => r.userId))

              // 构建通知消息
              const atElements = safePlayers
                .map(userId => `<at id="${userId}"/>`)
                .join(' ')

              const message = [
                `📺 监测到违规玩家正在房间中！`,
                `创建时间: ${new Date(lobby.createdAt).toLocaleString('zh-CN')}`,
                `🚨 违规玩家(${violators.length} 人)：`,
                ...violators.map(v => {
                  const record = punishmentRecords.find(r => r.handle === v.handle)
                  return `· ${v.name}(${record?.level}级处罚)`
                }),
                `房主: ${lobby.hostName}`,
                `玩家数: ${lobby.slotsHumansTaken}/${lobby.slotsHumansTotal}`,
                '──────────────',
                `请以下玩家通知房主踢人：${atElements || '无'}`
              ].join('\n')

              const groupId = [...config.groupId]

              await ctx.broadcast(groupId, message)
              processedLobbies.add(lobby.id)
            }
          }
        } catch (error) {
          ctx.logger.error('监控失败:', error)
        }
      }
    }, config.checkInterval * 1000)

    // 每天0点更新状态
    ctx.setInterval(async () => {
      const now = new Date();
      await ctx.database.set('ggcevo_pk_protection', {
        endTime: { $lt: now },
        status: 'active'
      }, {
        status: 'expired'
      });
    }, 24 * 60 * 60 * 1000);

  }







































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

      const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
      if (existingEntries.length > 0) {
        return `⛔ 您已被列入黑名单。`
      }

      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle: handle, itemId: 1 })
      const quantity = backpack?.quantity;
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
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle })
      return [
        `🎰 您使用了${quantity}枚咕咕币`,
        winCount > 0 ?
          `🎉 其中获得${winCount}张兑换券！` :
          '💔 本次未获得任何兑换券',
        `📊 当前保底进度：${record.pityCounter}/90`
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

      const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
      if (existingEntries.length > 0) {
        return `⛔ 您已被列入黑名单。`
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
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle })
      return [
        `${result ? '🎉 获得兑换券！' : '❌ 未中奖'} 保底进度：${record.pityCounter}/90`
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

      const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
      if (existingEntries.length > 0) {
        return `⛔ 您已被列入黑名单。`
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
      const [record] = await ctx.database.get('ggcevo_sign', { handle: handle })
      return [
        '十连抽结果：',
        ...results.map(r => r ? '🎉 获得兑换券' : '❌ 未中奖'),
        `保底进度：${record.pityCounter}/90`
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

      // 获取背包物品并过滤数量为0的条目
      const items = await ctx.database.get('ggcevo_backpack', { handle });
      const validItems = items.filter(item => item.quantity > 0);

      if (!validItems.length) return '您的背包空空如也。';

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

      return `【${session.username}的背包】\n${itemDetails.join('\n')}`;
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

        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。';

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

        // 金币基础值统一为50-100（不受游戏记录影响）
        const basePoints = getRandomInt(0, 0);

        // 获取职业信息
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle });

        // 获取关键系统固件科技等级
        let tech5Bonus = 0;
        if (careerData &&
          careerData.group === '人类联盟' &&
          (careerData.career === '舰长' || careerData.career === '情报副官')) {
          const [tech5Data] = await ctx.database.get('ggcevo_tech', {
            handle,
            techId: 5,
            level: 5
          });
          if (tech5Data) {
            tech5Bonus = 1.0; // 100%加成
            messages.push('🔧 关键系统固件科技LV.5：+100%金币');
          }
        }

        // 人类联盟基础加成
        if (careerData?.group === '人类联盟') {
          totalBonus += 0.2 + tech5Bonus;
          messages.push(`🏛️ 人类联盟阵营：+20%金币`);
        } else {
          totalBonus += tech5Bonus;
        }

        // 辛迪加海盗加成
        if (careerData?.group === '辛迪加海盗') {
          const [cred17Item] = await ctx.database.get('ggcevo_warehouse', { handle, itemId: 3 });
          if (cred17Item?.quantity >= 1) {
            const credBonus = 0.50 + (cred17Item.bonus || 0) / 100;
            totalBonus += credBonus;
            const totalBonusPercent = Math.round(credBonus * 100);
            messages.push(`💎 CRED-17生效：+${totalBonusPercent}%金币`);
          }
        }

        // 计算基础加成后的金币和咕咕币
        let baseFinalPoints = Math.round(basePoints * (1 + totalBonus));
        let baseFinalTickets = baseTickets;

        // 喵喵财源效果
        const [meowEffect] = await ctx.database.get('ggcevo_wish', {
          handle,
          wishname: '喵喵财源',
          startTime: { $lte: now },
          endTime: { $gte: now },
          isused: false
        });

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
        if (careerData?.group === '辛迪加海盗' && careerData.career === '辛迪加财务经理') {
          redCrystal = 5;
          messages.push('🎖️ 辛迪加财务经理职业：+5枚红晶');
        }

        // 使用事务更新数据库
        await ctx.database.withTransaction(async () => {
          // 更新签到记录
          await ctx.database.upsert('ggcevo_sign', [{
            handle,
            lastSign: now,
            monthlyDays,
            totalRewards: (record?.totalRewards || 0) + finalPoints
          }]);

          // 更新咕咕币背包（仅当有咕咕币时）
          if (finalTickets > 0) {
            await ctx.database.upsert('ggcevo_backpack', [{
              handle,
              itemId: 1,
              quantity: (backpack?.quantity || 0) + finalTickets
            }]);
          }

          // 更新红晶数量（如果符合条件）
          if (redCrystal > 0) {
            await ctx.database.upsert('ggcevo_careers', [{
              handle,
              redcrystal: (careerData.redcrystal || 0) + redCrystal
            }], ['handle']);
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

  ctx.command('ggcevo/补签')
    .action(async (argv) => {
      try {
        const session = argv.session;

        // 验证账号绑定
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        const { regionId, realmId, profileId } = profile;
        const handle = `${regionId}-S2-${realmId}-${profileId}`;

        // 检查黑名单
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。';

        // 获取签到记录
        const [record] = await ctx.database.get('ggcevo_sign', { handle });
        if (!record) return '暂未查询到您的签到记录';

        // 计算补签日期
        const lastSignChina = convertUTCtoChinaTime(record.lastSign);
        const targetDateChina = new Date(lastSignChina);

        // 获取当前中国时间
        const nowChina = convertUTCtoChinaTime(new Date());
        const currentYear = nowChina.getUTCFullYear();
        const currentMonth = nowChina.getUTCMonth();

        // 验证补签日期有效性
        const yesterday = new Date(targetDateChina).getUTCDate() - 1;

        // 日期有效性检查
        if (
          targetDateChina.getUTCFullYear() !== currentYear ||
          targetDateChina.getUTCMonth() !== currentMonth ||  // 必须当月
          record.monthlyDays > yesterday                     // 不超过昨天
        ) {
          return '暂时没有可补签的日期';
        }

        // 检查补签消耗
        const costPoints = 100;
        if (record.totalRewards < costPoints) {
          return `补签需要消耗${costPoints}枚金币，您当前拥有：${record.totalRewards}枚金币`;
        }

        // 计算新累计天数
        const newMonthlyDays = record.monthlyDays + 1;

        // 计算奖励（基于当月累计天数）
        let tickets = 3, points = 0;
        switch (newMonthlyDays) {
          case 7:
            tickets = 4;
            break;
          case 14:
            tickets = 5;
            break;
          case 21:
            tickets = 6;
            break;
          case 28:
            tickets = 7;
            break;
        }

        // 更新数据库
        await ctx.database.set('ggcevo_sign', { handle }, {
          monthlyDays: newMonthlyDays,
          totalRewards: record.totalRewards - costPoints + points
        });

        // 更新背包
        const [backpack] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 1 });
        await ctx.database.set('ggcevo_backpack', { handle, itemId: 1 }, {
          quantity: (backpack?.quantity || 0) + tickets
        });

        // 根据金币数量构建奖励信息
        const rewardsMessage = points > 0
          ? `获得${points}枚金币和${tickets}枚咕咕币。`
          : `获得${tickets}枚咕咕币。`;

        return `补签成功！本月累计签到${newMonthlyDays}天，消耗${costPoints}枚金币，${rewardsMessage}`;
      } catch (error) {
        console.error('补签错误:', error);
        return '补签失败，请稍后重试。';
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

      // [3] 检查基础签到（保持原有逻辑）
      const [backpack] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 1 });

      // [4] 权限检查
      const memberInfo = await session.event?.member?.roles;
      if (memberInfo?.includes("member")) {
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
          return `您的本月管理津贴已领取，${currentMonth + 2}月1日后可再次领取。`;
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

      // 检查黑名单
      const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
      if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。';

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
      const [activity] = await ctx.database.get('ggcevo_activity', {
        name,
        status: '进行中'
      })
      if (!activity) return '活动未进行中。'

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

  // 修改后的创建活动命令（参数顺序：活动名字 物品名字 数量 描述）
  ctx.command('ggcevo/创建活动 <activityName> <itemName> <quantity:number> <description>', '创建新活动', { authority: 3 })
    .option('start', '-s <startTime:date>', { fallback: Date.now() })
    .option('duration', '-d <days:number>', { fallback: 7 })
    .action(async ({ session, options }, activityName, itemName, quantity, description) => {
      if (!activityName) return '活动名称不能为空。'
      if (!itemName) return '物品名称不能为空。'

      // 处理金币特例
      let itemId: number
      if (itemName === '金币') {
        itemId = 0 // 特殊标识
      } else {
        // 查找物品ID
        const entry = Object.entries(initDefaultItems).find(([name]) => name === itemName)
        if (!entry) return `物品 ${itemName} 不存在`
        itemId = entry[1].id
      }

      // 检查同名活动
      const [existing] = await ctx.database.get('ggcevo_activity', { name: activityName })
      if (existing) return '同名活动已存在。'

      // 计算时间
      const start = new Date(options.start)
      const end = new Date(start.getTime() + options.duration * 86400000)
      const status = start <= new Date() ? '进行中' : '未开始'

      // 创建活动记录
      await ctx.database.create('ggcevo_activity', {
        name: activityName,
        description,
        quantity,
        itemId,
        startTime: start,
        endTime: end,
        status,
        creator: session.userId
      })

      return `活动【${activityName}】创建成功！奖励内容：${itemName} x${quantity}。`
    })

  // 更新活动列表显示（正确显示物品名称）
  ctx.command('ggcevo/活动列表')
    .action(async ({ session }) => {
      // 获取绑定信息
      const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
      if (!profile) return '🔒 需要先绑定游戏句柄。'

      const activities = await ctx.database.get('ggcevo_activity',
        { status: '进行中' },
        { sort: { startTime: 'desc' } }
      )

      // 创建物品ID到名称的映射
      const itemMap = new Map<number, string>()
      Object.entries(initDefaultItems).forEach(([name, data]) => itemMap.set(data.id, name))
      itemMap.set(0, '金币') // 添加金币映射

      return activities.length ?
        [
          ...activities.map(a => [
            `活动名称：${a.name}`,
            `活动时间：${formatDate(a.startTime)} - ${formatDate(a.endTime)}`,
            `活动描述：${a.description}`,
            `活动奖励：${a.quantity} ${itemMap.get(a.itemId) || '未知物品'}`,
            '━'.repeat(14)
          ].join('\n')),
          '请输入「领取 活动名称」领取奖励'
        ].join('\n')
        : '当前没有进行中的活动。'
    })



  ctx.command('ggcevo/胜点榜数据同步', { authority: 3 })
    .action(async () => {
      try {
        const ggcmap = await ctx.database.get('ggcevo_global_stats', {});

        const lastdate = ggcmap[0].updatedAt
        // 修复1：转换日期类型
        let currentMaxDate = new Date(lastdate)
        let nextCursor: string | null = null
        let shouldContinue = true
        let pageMaxDate = new Date(0)



        do {
          // 构建请求URL
          const baseUrl = `https://api.sc2arcade.com/maps/3/165561/match-history`
          const params = new URLSearchParams({
            orderBy: 'date',
            orderDirection: 'desc',
            includeMatchResult: 'false',
            includeMatchLobby: 'false',
            limit: '200',
            after: nextCursor || ''
          })

          // 配置请求参数
          const getconfig = {
            url: `${baseUrl}?${params}`,
            config: { proxyAgent: config.proxyAgent }
          }

          // 发送请求
          let response
          if (!config.proxyAgent) {
            response = await ctx.http.get(getconfig.url)
          } else {
            response = await ctx.http.get(getconfig.url, getconfig.config)
          }


          // 处理当前页数据
          for (const record of response.results) {
            // 修复3：正确转换日期类型
            const recordDate = new Date(record.date)

            if (recordDate <= currentMaxDate) {
              shouldContinue = false
              break
            }

            // 更新页内最大日期
            if (recordDate > pageMaxDate) {
              pageMaxDate = recordDate
            }

            const handle = `${record.profile.regionId}-S2-${record.profile.realmId}-${record.profile.profileId}`
            // 准备MMR更新
            const [ggcrank] = await ctx.database.get('ggcevo_rank', { handle: handle, rankseason: config.rankseason })
            await ctx.database.upsert('ggcevo_rank', [{
              handle: handle,
              name: record.profile.name,
              rank: record.decision === 'win' ? (ggcrank?.rank || 0) + 150 : (ggcrank?.rank || 0) - 50,
              wins: (ggcrank?.wins || 0) + (record.decision === 'win' ? 1 : 0),
              matches: (ggcrank?.matches || 0) + 1,
              rankseason: config.rankseason
            }])
          }



          // 修复5：安全终止条件
          nextCursor = response.page?.next || null


        } while (nextCursor && shouldContinue)
        if (pageMaxDate > currentMaxDate) {
          currentMaxDate = pageMaxDate
          await ctx.database.set('ggcevo_global_stats', {}, {
            updatedAt: new Date(currentMaxDate.toISOString())
          })
        }
        return '✅ 胜点榜数据同步成功！'
      } catch (err) {
        console.error('错误:', err)
        return '服务器繁忙，请稍后尝试。';
      }

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

      const ggcmap = await ctx.database.get('ggcevo_global_stats', {});

      const lastdate = ggcmap[0].updatedAt

      // 获取rankdate并计算赛季时间
      const rankDate = ggcmap[0].rankdate;

      // 计算赛季开始时间 (上赛季结束的次日00:00:00)
      const seasonStart = new Date(rankDate);
      seasonStart.setDate(seasonStart.getDate() + 1);
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
        `📊 数据最新同步时间: ${formatDate(lastdate)}`,
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
          return '参数错误，请输入“排名 @玩家”';
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
          const [careerData] = await ctx.database.get('ggcevo_careers', { handle })
          const currentRed = careerData?.redcrystal || 0
          const newRed = currentRed + parsedAmount

          await ctx.database.upsert('ggcevo_careers', [{
            handle,
            redcrystal: newRed,
            group: careerData?.group || '',
            career: careerData?.career || '',
            date: careerData?.date || new Date()
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

  ctx.command('ggcevo/违规记录 [user]', '违规记录查询')
    .usage("输入 违规记录 [@玩家] -p 页码 查看处罚记录，每页1条")
    .option('p', '-p <page:number> 指定页码')
    .action(async (argv) => {
      const session = argv.session;
      const pageNum = argv.options.p ? argv.options.p : 1;  // 从选项获取页码
      const user = argv.args[0];  // 从位置参数获取用户

      let handle: string
      if (!user) {
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;
      } else {
        const parsedUser = h.parse(user)[0];
        if (!parsedUser || parsedUser.type !== 'at' || !parsedUser.attrs.id) {
          return '参数错误，请输入“违规记录 @玩家”'
        }
        const targetUserId = parsedUser.attrs.id;
        let targetUsername = parsedUser.attrs.name || targetUserId;
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: targetUsername });

        if (!profile) {
          return '对方暂未绑定句柄。';
        }
        const { regionId, realmId, profileId } = profile;
        handle = `${regionId}-S2-${realmId}-${profileId}`;
      }

      if (pageNum < 1) return '请输入有效的页码。';

      const totalPages = await ctx.database.select('ggcevo_punishment')
        .where({ handle })
        .execute(row => $.count(row.id));

      const records = await ctx.database.select('ggcevo_punishment')
        .where({ handle })
        .orderBy('id', 'desc')
        .limit(1)
        .offset(pageNum - 1)
        .execute();

      if (!records.length) {
        return pageNum === 1
          ? `【${handle}】暂无违规记录`
          : `【${handle}】第 ${pageNum} 条记录不存在`
      }

      const recordText = records.map(item => {
        const baseInfo = [
          `ID: ${item.id}`,
          `句柄: ${item.handle}`,
          `QQ: ${item.qq}`,
          `处罚等级: ${item.level}`,
          `处罚原因: ${item.reason}`,
          `处罚次数: ${item.count}`,
          `审核人: ${item.reviewer}`,
          `处罚时间: ${item.date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        ];
        let finalText = baseInfo.join('\n');
        //if (item.comment) finalText += `\n备注: ${item.comment}`;
        return finalText;
      }).join('\n------------------------------\n');

      return [
        `🚨 违规记录 🚨`,
        `第 ${pageNum} 条 共 ${totalPages} 条`,
        '------------------------------',
        recordText,
        '------------------------------',
        pageNum < totalPages ? `输入 违规记录 (@玩家) -p ${pageNum + 1} 查看下一条` : '已是最后一页'
      ].join('\n');
    })

  ctx.command('ggcevo/兑换赞助物品', '兑换赞助物品')
    .action(async ({ session }) => {
      try {
        // 获取用户绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) {
          return `⛔ 您已被列入黑名单。`;
        }

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
      const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

      const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
      if (existingEntries.length > 0) {
        return `⛔ 您已被列入黑名单。`
      }

      // 发送确认提示
      await session.send(`您确定要使用3张兑换券换取一枚扭蛋币吗？(请在30秒内回复“是”确认)`)
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

      const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
      if (existingEntries.length > 0) {
        return `⛔ 您已被列入黑名单。`
      }

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

  ctx.command('ggcevo/拉黑 [user]', '黑名单管理', { authority: 3 })
    .action(async (argv, user) => {
      const session = argv.session;

      // 中国时区时间格式化函数
      const formatChinaTime = (date) => {
        return new Date(date).toLocaleString('zh-CN', {
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

      // 显示黑名单列表
      if (!user) {
        const blacklist = await ctx.database.get('ggcevo_blacklist', {}, { fields: ['handle', 'name', 'createdAt'] });

        if (blacklist.length === 0) return '当前黑名单为空。';

        let message = '📋 黑名单列表：\n';
        for (const entry of blacklist.slice(0, 10)) {
          // 使用中国时区格式化
          const time = formatChinaTime(entry.createdAt);
          message += `▫️ ${entry.name} (${entry.handle}) - 添加时间: ${time}\n`;
        }
        if (blacklist.length > 10) message += `\n...显示前10条，共${blacklist.length}条记录`;

        return message;
      }

      // 处理用户拉黑
      try {
        // 解析被@用户
        const parsed = h.parse(user)[0];
        if (!parsed || parsed.type !== 'at') return '格式错误，请使用"拉黑 @用户"格式';

        const targetUserId = parsed.attrs.id;

        // 获取目标用户的群信息
        const targetUserInfo = await session.bot.getGuildMember(session.guildId, targetUserId);
        if (!targetUserInfo) return '无法获取用户信息';

        // 获取用户名
        const targetName = targetUserInfo.nick || targetUserInfo.user.name;

        // 查询绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: targetUserId });
        if (!profile) return `${targetName} 尚未绑定星际句柄`;

        // 构建句柄
        const targetHandle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        // 检查是否已存在
        const exists = await ctx.database.get('ggcevo_blacklist', { handle: targetHandle });
        if (exists.length) return `⚠️ ${targetName} (${targetHandle}) 已在黑名单中`;

        // 添加到黑名单
        await ctx.database.create('ggcevo_blacklist', {
          handle: targetHandle,
          name: targetName,
          createdAt: new Date()
        });

        return `✅ 已拉黑 ${targetName} (${targetHandle})`;
      } catch (error) {
        console.error('拉黑操作错误:', error);
        return '操作失败，请检查控制台日志';
      }
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
      output.push(`🎮 游戏句柄：${handle}\n──────────────`);

      // 签到信息
      const [sign] = await ctx.database.get('ggcevo_sign', { handle });
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

      // 统计模块数量（更新为3类）
      const existModules = [
        sign && '签到',
        lottery && '抽奖',
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










  if (config.enableGuguBattle) {

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

          const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
          if (existingEntries.length > 0) {
            return `⛔ 您已被列入黑名单。`
          }

          if (!user) return '请输入“pk @玩家”。';


          // 解析目标用户
          const parsedUser = h.parse(user)[0];
          if (!parsedUser || parsedUser.type !== 'at' || !parsedUser.attrs.id) return '参数格式错误，请输入“pk @玩家”。';
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
          const [initiatorCareer] = await ctx.database.get('ggcevo_careers', {
            handle: initiatorHandle
          });
          const [targetCareer] = await ctx.database.get('ggcevo_careers', {
            handle: targetHandle
          });

          // ================== 计算机专家特权：增加每日PK次数 ==================
          let dailyPKLimit = config.dailyPKLimit;

          // 计算机专家每日主动PK次数增加3次
          if (initiatorCareer?.career === '计算机专家') {
            dailyPKLimit += 3; // 增加次数上限
          }

          // ================== 新增点1：检查双方阵营 ==================
          const validGroups = new Set(['人类联盟', '辛迪加海盗']);

          // 检查是否加入有效阵营
          if (!initiatorCareer?.group || !validGroups.has(initiatorCareer.group)) {
            return '❌ 您尚未加入人类联盟或辛迪加海盗，不能参与PK';
          }

          if (!targetCareer?.group || !validGroups.has(targetCareer.group)) {
            return '❌ 对方尚未加入人类联盟或辛迪加海盗，不能参与PK';
          }

          // ================== 新增点1：检查被挑战者保护状态 ==================
          const targetProtections = await ctx.database.get('ggcevo_pk_protection', {
            handle: targetHandle,
            status: 'active'
          });

          // 检查被挑战者是否处于保护期
          if (isWithinProtection(targetProtections)) {
            const nearestEndTime = targetProtections.reduce((max, p) =>
              p.endTime > max ? p.endTime : max, new Date(0)
            );
            return `🛡️ ${targetRankname}正处于PK保护期（至 ${nearestEndTime.toLocaleString('zh-CN')}），无法挑战`;
          }

          // ================== 新增点2：检查发起者保护状态 ==================
          const initiatorProtections = await ctx.database.get('ggcevo_pk_protection', {
            handle: initiatorHandle,
            status: 'active'
          });

          let hasProtection = isWithinProtection(initiatorProtections);

          // 如果发起者处于保护期，提示解除选项
          if (hasProtection) {
            // 显示所有有效保护卡
            const protectionList = initiatorProtections
              .filter(p => new Date() < p.endTime)
              .map(p => `🛡️ ID:${p.id} ${formatTime(p.startTime)} ~ ${formatTime(p.endTime)}`)
              .join('\n');

            await session.send(`⚠️ 您正处于PK保护期：\n${protectionList}\n\n发起PK将自动解除保护，确认继续？\n回复"是"继续PK，或回复其他内容退出`);

            const confirm = await session.prompt(30000);
            if (confirm !== '是') return '已取消PK操作，保护期仍有效。';

            // 解除所有保护卡
            await ctx.database.set('ggcevo_pk_protection', {
              handle: initiatorHandle
            }, {
              status: 'canceled'
            });

            hasProtection = false;
          }

          // ================== 新增点2：人类联盟保护期检查 ==================
          if (targetCareer.group === '人类联盟') {
            // 确保 date 字段有效并转换为日期对象
            let joinDate: Date;

            // 如果数据库返回的是时间戳字符串
            if (typeof targetCareer.date === 'string') {
              // 将数据库中的时间戳字符串转换为Date对象
              joinDate = new Date(targetCareer.date);
            }
            // 如果数据库返回的是数字时间戳
            else if (typeof targetCareer.date === 'number') {
              joinDate = new Date(targetCareer.date);
            }
            // 如果已经是Date对象
            else {
              joinDate = targetCareer.date as Date;
            }

            // 验证日期是否有效
            if (isNaN(joinDate.getTime())) {
              return '❌ 对方阵营加入阵营日期无效';
            }

            const now = new Date();

            // 计算天数差（确保类型为数字）
            const timeDiff = now.getTime() - joinDate.getTime();
            const diffInDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

            // === 新增处理：第一次PK的场景 ===
            // 获取应战者的PK记录以检查enable状态
            const [targetPKRecord] = await ctx.database.get('ggcevo_pk', {
              handle: targetHandle
            });

            // 如果查询不到记录（第一次PK）并且保护期内 -> 应用保护
            // 或者有记录但enable为false并且保护期内 -> 应用保护
            const isNewPlayer = !targetPKRecord;
            const hasProtection = diffInDays < 30;
            const isPKDisabled = targetPKRecord && !targetPKRecord.enable;

            if ((isNewPlayer || isPKDisabled) && hasProtection) {
              return `🛡️ 该玩家是人类联盟成员，当前处于30天保护期内（剩余${30 - diffInDays}天），无法PK`;
            }
          }

          // 简化后的PK记录初始化（合并到事务中）
          let initiatorPK: PKProfile;
          let targetPK: PKProfile;

          await ctx.database.withTransaction(async () => {
            // 获取数据库记录并合并到默认值
            const [dbInitiator] = await ctx.database.get('ggcevo_pk', { handle: initiatorHandle });
            const [dbTarget] = await ctx.database.get('ggcevo_pk', { handle: targetHandle });

            // 使用Object.assign将数据库记录合并到默认对象
            initiatorPK = Object.assign({
              handle: initiatorHandle,
              name: initiatorRankname,
              total: 0,
              wins: 0,
              todayCount: 0,
              lastPK: new Date(0),
              enable: false,
              lastToggle: new Date(0)
            }, dbInitiator || {});

            targetPK = Object.assign({
              handle: targetHandle,
              name: targetRankname,
              total: 0,
              wins: 0,
              todayCount: 0,
              lastPK: new Date(0),
              enable: false,
              lastToggle: new Date(0)
            }, dbTarget || {});
          });

          // ================== 新增点3：人类联盟发起者开启PK功能（交互式确认）==================
          if (initiatorCareer.group === '人类联盟' && !initiatorPK.enable) {
            // 计算保护期剩余天数
            let joinDate: Date;
            if (typeof initiatorCareer.date === 'string') joinDate = new Date(initiatorCareer.date);
            else if (typeof initiatorCareer.date === 'number') joinDate = new Date(initiatorCareer.date);
            else joinDate = initiatorCareer.date;

            if (!isNaN(joinDate.getTime())) {
              const now = new Date();
              const timeDiff = now.getTime() - joinDate.getTime();
              const remainingDays = 30 - Math.floor(timeDiff / (1000 * 60 * 60 * 24));

              // 仅当仍有保护期时才需要确认
              if (remainingDays > 0) {
                // 发送确认提示
                await session.send(`⚠️ 您的人类联盟保护期剩余 ${remainingDays} 天，发起PK将永久失去保护期！请确认是否继续？\n回复"是"继续PK，或"否"退出`);

                // 等待用户确认
                const confirm = await session.prompt(30000);
                if (confirm !== '是') return '已取消PK操作，保护期仍有效';
              }
            }

            // 更新PK状态（永久开启）
            initiatorPK.enable = true;
            initiatorPK.lastToggle = new Date();
            await ctx.database.set('ggcevo_pk', initiatorHandle, {
              enable: true,
              lastToggle: new Date()
            });
          }


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

          // ================== 新增点2：修改MP3播放器条件 ==================
          let hasMP3 = false;
          // 仅当玩家是辛迪加海盗时检查MP3
          if (initiatorCareer?.group === '辛迪加海盗') {
            const [mp3Item] = await ctx.database.get('ggcevo_warehouse', {
              handle: initiatorHandle,
              itemId: 5 // MP3播放器ID
            });
            hasMP3 = mp3Item && mp3Item.quantity > 0;
          }

          // ========== 修改点3：动态胜率计算使用默认值 ==========
          const powerDiff = initiatorPower - targetPower;
          let winRate = 50 + (powerDiff / 100) * 0.1;
          winRate = Math.min(Math.max(winRate, 5), 95);

          // 计算机专家特权：胜率提高10%
          if (initiatorCareer?.career === '计算机专家') {
            winRate += 10; // 增加10个百分点
          }

          winRate = Math.min(Math.max(winRate, 5), 100);

          // ========== 修改点：使用整数计算代替浮点数 ==========
          const randInt = Math.floor(Math.random() * 10000); // 生成 0-9999 的随机整数
          const winRateInt = Math.floor(winRate * 100);      // 将胜率转换为整数 (0-10000)
          const isWin = randInt < winRateInt;               // 比较整数判断胜负

          // ================== 新增点4：修改金币计算规则 ==================
          // 人类联盟作为被挑战者失败时仅损失1%金币
          let stealPercentage = getRandomInt(1, 5);

          // 如果应战者是人类联盟且失败，固定1%
          if (targetCareer.group === '人类联盟' && isWin) {
            stealPercentage = 1;
          }

          let goldTransfer = Math.floor(
            (isWin ? targetGold : initiatorGold) * stealPercentage / 100
          );

          // 检测MP3播放器效果 (失败时触发)
          let mp3Effect = false;
          if (!isWin && hasMP3) {
            const reducedGold = Math.floor(goldTransfer * 0.5);  // 50%减免
            mp3Effect = true;
            goldTransfer = reducedGold;                          // 实际转移金币
          }

          // ================== 计算机专家被动保护（在结果处理前） ==================
          let computerExpertProtection = false;

          // 当应战者是计算机专家且PK失败时
          if (isWin && targetCareer?.career === '计算机专家') {
            // 50%概率触发金币保护
            if (Math.random() < 0.5) {
              //computerExpertProtection = true;
              //goldTransfer = 0;
            }
          }

          // ================== 气喇叭效果处理 ==================
          let hornEffect = false;
          let extraGold = 0;

          // 检查气喇叭条件：发起者是辛迪加海盗阵营且拥有气喇叭
          if (isWin && initiatorCareer?.group === '辛迪加海盗') {
            const [hornItem] = await ctx.database.get('ggcevo_warehouse', {
              handle: initiatorHandle,
              itemId: 7 // 气喇叭ID
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
            await ctx.database.upsert('ggcevo_pk', [
              // 发起者记录
              {
                handle: initiatorHandle,
                name: initiatorRankname,
                total: initiatorPK.total + 1,
                wins: isWin ? initiatorPK.wins + 1 : initiatorPK.wins,
                todayCount: initiatorPK.todayCount + 1,
                lastPK: new Date(),
              },
              // 应战者记录（新增部分）
              {
                handle: targetHandle,
                name: targetRankname,
                total: targetPK.total + 1,
                wins: !isWin ? targetPK.wins + 1 : targetPK.wins, // 应战者胜利时增加
              }
            ]);

            // 在数据库事务中
            await ctx.database.create('ggcevo_pk_logs', {
              initiator_handle: initiatorHandle,
              target_handle: targetHandle,
              date: new Date()
            })

            // ================== 新增点4：财务经理职业奖励 ==================
            let extraRedCrystal = 0;
            // 主动PK且获胜
            if (isWin && initiatorCareer?.career === '辛迪加财务经理') {
              //extraRedCrystal = 1;
            }

            // ================== 修改点：合并红晶奖励 ==================
            let redcrystalAdd = 0;
            // 辛迪加海盗基础奖励
            if (initiatorCareer?.group === '辛迪加海盗') {
              redcrystalAdd += 1;
            }
            // 财务经理额外奖励
            redcrystalAdd += extraRedCrystal;

            // 如果有红晶奖励
            if (redcrystalAdd > 0) {
              await ctx.database.upsert('ggcevo_careers', [{
                handle: initiatorHandle,
                redcrystal: (initiatorCareer?.redcrystal || 0) + redcrystalAdd
              }], ['handle']);
            }



            // ================== 修正的金币转移逻辑 ==================
            if (computerExpertProtection) {
              // 计算机专家保护生效时，双方金币都不变动
              // 不触发气喇叭效果
            } else if (hornEffect) {
              // 气喇叭生效时的金币处理
              await ctx.database.set('ggcevo_sign', targetHandle, {
                totalRewards: targetGold - goldTransfer
              });
              await ctx.database.set('ggcevo_sign', initiatorHandle, {
                totalRewards: initiatorGold + goldTransfer + extraGold
              });
            } else {
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
            }


          });

          // ================== 构建战报（添加职业效果） ==================
          const result = [
            `⚔️【对战结果】${isWin ? '胜利' : '失败'}`,
            `🏅 挑战者：${initiatorRankname}(战斗力 ${initiatorPower})`,
            `💼 职业：${initiatorCareer?.career || '无'}`,
            `🛡️ 应战者：${targetRankname}(战斗力 ${targetPower})`,
            `💼 职业：${targetCareer?.career || '无'}`,
            `📊 胜率预测：${winRate.toFixed(1)}%`,
            `🎰 金币变动：${stealPercentage}%`
          ];

          // 添加金币变动说明
          if (computerExpertProtection) {
            result.push(`💻 计算机专家职业：应战者PK失败时不损失金币`);
          } else if (isWin) {
            result.push(`💰 您从对方的口袋里抢夺了${goldTransfer}枚金币`);
          } else {
            result.push(`💸 您从口袋里拿出了${goldTransfer}枚金币上交给对方`);
          }

          // 收集所有加成效果消息
          const bonusEffects = [];

          // ================== 计算机专家专属提示 ==================
          if (initiatorCareer?.career === '计算机专家') {
            const usedCount = initiatorPK.todayCount + 1;
            bonusEffects.push(
              `▸ 💻 计算机专家特权：`,
              `   - 主动PK胜率+10%（最高可至100%）`,
              `   - 每日挑战次数+3`
            );
          }

          // 添加人类联盟保护信息
          if (targetCareer.group === '人类联盟' && isWin) {
            bonusEffects.push(`▸ 🛡️ 人类联盟：应战者PK失败时仅损失1%的金币`);
          }

          // 显示MP3效果提示
          if (mp3Effect) {
            bonusEffects.push(`▸ 💿 MP3播放器生效：挑战者PK失败时上交的金币减少50%`);
          }

          // 添加气喇叭效果提示
          if (hornEffect) {
            bonusEffects.push(`▸ 📯 气喇叭生效：辛迪加海盗总部为您发放了额外${extraGold}金币奖励！`);
          }

          // 红晶奖励提示
          if (initiatorCareer?.group === '辛迪加海盗') {
            bonusEffects.push(`▸ 🔴 辛迪加海盗阵营：+1枚红晶`);
          }
          if (isWin && initiatorCareer?.career === '辛迪加财务经理') {
            //bonusEffects.push(`▸ 🎖️ 辛迪加财务经理职业：+1枚红晶`);
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
          ctx.database.select('ggcevo_pk')
            .orderBy('wins', 'desc')
            .limit(10)
            .offset(offset)
            .execute(),

          // 获取总记录数（启用PK的用户总数）
          ctx.database.select('ggcevo_pk')
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
            const rankname = record.name || record.handle;
            return [
              `${offset + index + 1}. ${rankname}`,
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

        // 获取折扣信息
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle });
        const playerCareer = careerData?.career || '';
        const playerGroup = careerData?.group || ''; // 获取玩家阵营

        // 获取武器科技等级
        const [weaponTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 });
        const techLevel = weaponTech?.level || 0;

        // 获取传奇武器权限
        const [legendaryPerm] = await ctx.database.get('ggcevo_permissions', { handle });
        const legendaryPermission = legendaryPerm?.legendarypermissions || 0;

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
          5: 'V'
        };

        // === 仅对人类联盟玩家显示武器科技折扣 ===
        if (playerGroup === '人类联盟' && techLevel > 0 && techConfigData) {
          const isCareer = techConfigData.careerNames.includes(playerCareer);
          const totalDiscount = isCareer ? 50 : 25;

          const applicableLevels = [];
          for (let level = 1; level <= techLevel; level++) {
            applicableLevels.push(romanLevels[level]);
          }
          const levelRange = applicableLevels.join('、');

          discountDetails.push(`▸ 🔧 武器系统Lv${techLevel}: ${totalDiscount}%折扣 (适用${levelRange}类武器)`);
        }
        // === 非人类联盟玩家不显示任何科技折扣信息 ===

        // 仅保留蚱蜢优购活动折扣（仅非传奇武器生效）
        const activeWish = await ctx.database.get('ggcevo_wish', {
          handle,
          wishname: '蚱蜢优购',
          startTime: { $lte: new Date() },
          endTime: { $gte: new Date() },
          isused: false
        }).then(records => records[0]);

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

        // 创建传奇武器专用折扣数组
        let displayDiscounts = [];

        // 添加武器中士职业的传奇武器专属折扣
        if (category === '传奇武器' &&
          playerCareer === '武器中士' &&
          legendaryPermission > 0) {
          displayDiscounts.push('▸ 🎖️ 武器中士职业：50%折扣');
        }
        // 非传奇武器显示所有折扣
        else {
          displayDiscounts = [...discountDetails];
        }

        // 定义各类武器应用的折扣率
        const getWeaponDiscount = (configLevel) => {
          // 基础折扣参数
          const BASE_DISCOUNT = 25;
          const CAREER_DISCOUNT = 25;
          const GRASSHOPPER_DISCOUNT = 20;
          const LEGENDARY_WEAPON_MASTER_DISCOUNT = 50;

          let applicableDiscount = 0;
          const discountSources = [];

          // 传奇武器特殊规则：只应用武器中士折扣
          if (category === '传奇武器') {
            if (playerCareer === '武器中士' && legendaryPermission > 0) {
              applicableDiscount += LEGENDARY_WEAPON_MASTER_DISCOUNT;
              discountSources.push(`武器中士${LEGENDARY_WEAPON_MASTER_DISCOUNT}%`);
            }
          }
          // 非传奇武器应用正常折扣规则
          else {
            // === 仅对人类联盟玩家应用科技折扣 ===
            if (playerGroup === '人类联盟' && techLevel > 0 && configLevel <= techLevel) {
              applicableDiscount += BASE_DISCOUNT;
              discountSources.push(`科技${BASE_DISCOUNT}%`);
            }

            // === 仅对人类联盟玩家应用职业加成 ===
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

            // 武器基础信息 - 传奇武器不显示等级
            const weaponInfo = [
              `【${name}】`,
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

            // 非传奇武器添加等级信息
            if (category !== '传奇武器') {
              weaponInfo.splice(1, 0, `武器等级：${romanLevels[config.level]}`);
            }

            return weaponInfo.filter(Boolean).join('\n');
          });

        // 构建顶部特殊提示信息
        const permissionNotice = category === '传奇武器'
          ? '⚠️ 购买传奇武器要求：人类联盟阵营+武器系统5级+传奇武器购买权限'
          : null;

        // 非传奇武器添加科技升级提示（仅对人类联盟玩家显示）
        const techUpgradeNotice = playerGroup === '人类联盟' &&
          techLevel === 0 &&
          category !== '传奇武器'
          ? '⚠️ 提示：提升武器系统等级可获得额外折扣'
          : '';

        return [
          `🏪 咕咕武器库 - ${category} 🏪`,
          '使用"购买 武器名称"指令进行购买',
          displayDiscounts.length > 0 ? `💰 折扣信息：\n${displayDiscounts.join('\n')}` : '',
          techUpgradeNotice,
          permissionNotice,
          '====================',
          ...items,
          items.length === 0 ? '⚠️ 该分类下暂无可用武器' : ''
        ].filter(Boolean).join('\n');
      });

    ctx.command('ggcevo/爆破库 [type]')
      .usage('输入“爆破库”查看分类，或“爆破库 类型”查看详细物品')
      .action(async ({ session }, type) => {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
        if (!profile) return '⚠️ 需要先绑定游戏句柄'

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
          '使用“购买 物品名称”指令进行购买',
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

        // 黑名单检查
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。'

        // 合并物品数据源
        const allItems = { ...weaponConfig, ...SyndicatedItems }

        // 输入校验
        if (!item) return '请输入"购买 物品名称"来购买所需物品。'
        const itemconfig = allItems[item]
        if (!itemconfig) return '无效的物品名称，请重新输入。'
        if (itemconfig.price <= 0) return '❌ 该物品不可直接购买'

        // 类型判断
        const isWeapon = ['能量武器', '热能武器', '实弹武器', '传奇武器'].includes(itemconfig.category)
        const isLegendaryWeapon = itemconfig.category === '传奇武器'

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
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle })
        const playerGroup = careerData?.group || ''
        const playerCareer = careerData?.career || ''

        // ============= 传奇武器权限检查 =============
        let legendaryPermission = 0;
        let hasLegendaryPermission = false;

        if (isLegendaryWeapon) {
          // 获取权限记录
          const [permissionRecord] = await ctx.database.get('ggcevo_permissions', { handle });
          legendaryPermission = permissionRecord?.legendarypermissions || 0;
          hasLegendaryPermission = legendaryPermission > 0;

          // 检查阵营（所有职业都需要人类联盟）
          if (playerGroup !== '人类联盟') {
            return '❌ 购买传奇武器需要在"人类联盟"阵营。'
          }

          // 获取武器系统等级
          const [weaponTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 })
          const weaponSystemLevel = weaponTech?.level || 0

          // 检查武器系统等级（所有职业都需要5级）
          if (weaponSystemLevel < 5) {
            return `❌ 购买传奇武器需要将武器系统升级到5级(当前等级：${weaponSystemLevel})。`
          }

          // 非武器中士必须有权限才能购买
          if (playerCareer !== '武器中士' && !hasLegendaryPermission) {
            return '❌ 购买传奇武器需要"传奇武器购买权限"，您当前没有购买权限。'
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
          5: 'V'
        };

        // 获取武器科技等级
        const [weaponTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 2 });
        const techLevel = weaponTech?.level || 0;

        // 从配置中获取武器系统数据
        const techConfigData = Spacestationtechnology.find(tech => tech.techId === 2);

        // 1. 科技折扣（仅对非传奇武器且人类联盟阵营生效）
        if (!isLegendaryWeapon && playerGroup === '人类联盟' && techLevel > 0 && techConfigData) {
          // 确定武器是否有资格应用科技折扣
          if (itemconfig.level && itemconfig.level <= techLevel) {
            const isCareerBonus = techConfigData.careerNames.includes(playerCareer);

            // 计算科技基础折扣
            totalDiscount += 25;
            discountDetails.push(`▸ 🔧 武器系统Lv${techLevel}: ${isCareerBonus ? '50%' : '25%'}折扣 (适用${romanLevels[itemconfig.level]}类武器)`);

            // 职业加成折扣（仅科技适用的职业）
            if (isCareerBonus) {
              totalDiscount += 25;
            }
          }
        }

        // 2. 蚱蜢优购折扣（仅对非传奇武器生效）
        if (!isLegendaryWeapon) {
          activeWish = await ctx.database.get('ggcevo_wish', {
            handle,
            wishname: '蚱蜢优购',
            startTime: { $lte: new Date() },
            endTime: { $gte: new Date() },
            isused: false
          }).then(records => records[0] || null)

          if (activeWish) {
            totalDiscount += 20
            discountDetails.push(`▸ 🦗 蚱蜢优购祈愿：20%折扣`)
          }
        }

        // 3. 传奇武器处理（特殊规则）
        let willConsumePermission = false;
        if (isLegendaryWeapon) {
          // 武器中士特权：有权限时半价购买并消耗次数
          if (playerCareer === '武器中士' && hasLegendaryPermission) {
            totalDiscount = 50; // 覆盖之前任何折扣
            discountDetails = [`▸ 🎖️ 武器中士职业：半价购买(消耗1次权限)`];
            willConsumePermission = true;
          }
          // 武器中士没有权限时：原价购买不消耗权限
          else if (playerCareer === '武器中士') {
            discountDetails.push(`▸ 🎖️ 武器中士职业：原价购买`);
          }
          // 非武器中士：原价购买并消耗一次权限
          else {
            willConsumePermission = true;
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
            await ctx.database.set('ggcevo_wish', { id: activeWish.id }, {
              isused: true
            })
          }

          // ============= 扣除传奇武器权限 (如果标记为消耗) =============
          if (willConsumePermission) {
            const [permissionRecord] = await ctx.database.get('ggcevo_permissions', { handle })
            if (!permissionRecord || permissionRecord.legendarypermissions <= 0) {
              throw new Error('传奇武器购买权限不足')
            }

            // 更新购买权限记录
            const remaining = permissionRecord.legendarypermissions - 1
            await ctx.database.set('ggcevo_permissions', { handle }, {
              legendarypermissions: remaining
            })

            // 更新权限计数变量
            legendaryPermission = remaining;
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
            // 仓库物品逻辑
            const [existing] = await ctx.database.get('ggcevo_warehouse', {
              handle,
              itemId: itemconfig.id
            })
            await ctx.database.upsert('ggcevo_warehouse', [{
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

        // 权限消耗信息
        if (isLegendaryWeapon) {
          if (willConsumePermission) {
            message += `\n扣除 1 次传奇武器购买权限，剩余次数：${legendaryPermission}`
          } else if (playerCareer === '武器中士' && !hasLegendaryPermission) {
            message += `\n【武器中士特权】本次按原价购买，未消耗权限次数`
          }
        }

        // 装备状态提示
        if (isWeapon) {
          if (isAutoEquipped) {
            message += "\n【系统已为您自动装备该武器】"
          }
          message += "\n输入「武器仓库」查看详情"
        } else {
          const [current] = await ctx.database.get('ggcevo_warehouse', { handle, itemId: itemconfig.id })
          message += `\n当前持有数量：${current?.quantity || 1}，输入「仓库」查看物品`
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
          ...(weaponDetails.length ? weaponDetails : ['空空如也，快去“武器库”看看吧！']),
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

        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
        if (existingEntries.length > 0) {
          return `⛔ 您已被列入黑名单。`
        }

        if (!weapon) return '请输入“装备武器 武器名称”来装备一把你拥有的武器。'
        if (!weaponConfig[weapon]) return '武器名称错误，请输入“装备武器 武器名称”来装备一把你拥有的武器。'
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

        // 黑名单检查
        if ((await ctx.database.get('ggcevo_blacklist', { handle })).length) {
          return '⛔ 您已被列入黑名单。';
        }

        // 无目标时显示科技价格表
        if (!target) {
          return '请输入“升级科技 科技名称”来升级科技'
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

        // 黑名单检查
        if ((await ctx.database.get('ggcevo_blacklist', { handle })).length) {
          return '⛔ 您已被列入黑名单。';
        }

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

        // 黑名单检查
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。'

        // 科技和职业数据获取
        const [techData] = await ctx.database.get('ggcevo_tech', { handle, techId: 3 }).catch(() => [{ level: 0 }])
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle })
        const techLevel = techData?.level || 0
        const isCareerMatch = ['武器中士', '情报副官'].includes(careerData?.career)

        // 判断是否为装甲兵(辛迪加海盗)
        const isArmoredPirate = careerData?.career === '装甲兵' && careerData?.group === '辛迪加海盗'

        // 折扣计算函数
        const calculateDiscountRate = (isExclusive) => {
          // 通用折扣计算
          let discount = 0;

          // 人类联盟折扣
          if (careerData?.group === '人类联盟') {
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

          // 装甲兵+辛迪加海盗的固定10%折扣
          if (isArmoredPirate) {
            discount += 10;
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

          // 装甲兵海盗的槽位+1加成
          const actualSlots = equipment.modificationSlots + (isArmoredPirate ? 1 : 0)

          // 槽位检查（使用实际槽位）
          if (equipment.installedMods.length >= actualSlots) {
            return `❌ 当前可用改装槽已满(武器升级至3/6级会额外获得一个改装槽${isArmoredPirate ? '，装甲兵职业额外获得一个改装槽' : ''})。`
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
            if (careerData?.group === '人类联盟') {
              if (modInfo.isExclusive && techLevel >= 2) {
                discountMessages.push(`▸ ⚙️ 武器升级平台Lv.${techLevel}：${isCareerMatch ? 10 : 5}%折扣`);
              } else if (!modInfo.isExclusive && techLevel >= 1) {
                discountMessages.push(`▸ ⚙️ 武器升级平台Lv.${techLevel}：${isCareerMatch ? 10 : 5}%折扣`);
              }
            }
            if (isArmoredPirate) {
              discountMessages.push('▸ 🔰 装甲兵职业：10%折扣');
            }
          }

          return [
            `✅ ${weapon} 成功安装 ${mod}！`,
            `花费金币：${actualCost}${discountRate > 0 ? ` (原价${modInfo.cost})` : ''}`,
            discountMessages.length > 0 && discountMessages.join('\n'),
            `改装槽：${equipment.installedMods.length + 1}/${actualSlots} ${isArmoredPirate ? '(装甲兵职业额外获得一个改装槽)' : ''}`
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

            // 装甲兵海盗的专属模块提示
            const armorMessage = isArmoredPirate
              ? '🔰 装甲兵职业：\n▸ 武器改装槽+1'
              : '';

            return [
              `🛠️ ${weapon} 专属模块 🛠️`,
              '使用「改装武器 武器名称 模块名称」安装',
              '※ 每个武器只能安装一个专属模块',
              armorMessage,
              exclusiveDiscountRate > 0 && `💰 当前专属模块折扣：`,
              exclusiveDiscountRate > 0 && careerData?.group === '人类联盟' && techLevel >= 2 && `▸ ⚙️ 武器升级平台Lv.${techLevel}：${exclusiveDiscountRate}%折扣`,
              exclusiveDiscountRate > 0 && isArmoredPirate && '▸ 🔰 装甲兵职业：10%折扣',
              '====================',
              exclusiveList
            ].filter(Boolean).join('\n')
          }
          // 没有指定武器或无效武器名称时
          else {
            // 装甲兵海盗的通用模块提示
            const armorMessage = isArmoredPirate
              ? '🔰 装甲兵职业：\n▸ 武器改装槽+1'
              : '';

            return [
              '🛠️ 通用武器模块 🛠️',
              '使用「改装武器 武器名称 模块名称」安装通用模块',
              '※ 使用「改装武器 武器名称」查询武器专属模块',
              armorMessage,
              universalDiscountRate > 0 && `💰 当前通用模块折扣：`,
              universalDiscountRate > 0 && careerData?.group === '人类联盟' && techLevel >= 1 && `▸ ⚙️ 武器升级平台Lv.${techLevel}：${universalDiscountRate}%折扣`,
              universalDiscountRate > 0 && isArmoredPirate && '▸ 🔰 装甲兵职业：10%折扣',
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

        // 黑名单检查
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。';

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
        let cleanerRewardBroadcast: string[] | null = null;

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
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。';

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

        // ======== 新增：斩杀阶段验证 ========
        const verification = await verifyFinalBlow(
          ctx,
          session,
          bossName,
          targetBoss,  // 当前目标BOSS
          activeBosses
        );

        // 验证失败则终止攻击
        if (!verification.success) {
          return '攻击已取消';
        }

        // 使用更新后的BOSS对象（如果验证通过）
        const verifiedBoss = verification.updatedBoss || targetBoss;

        // ======== 新增：攻击时间限制检查 ========
        // 检查每日攻击限制
        const unlimitedBossAttack = config.unlimitedBossAttack;

        // ======== 修改：攻击时间限制检查（基于ggcevo_damage_logs） ========
        if (!unlimitedBossAttack) {
          // 获取当前中国时区时间
          const now = new Date();

          // 获取当前日期和时间段标识
          const currentHalfDayIdentifier = getHalfDayIdentifier(now);

          // 查询玩家最近的攻击记录（最多查4条）
          const attackLogs = await ctx.database
            .select('ggcevo_damage_logs')
            .where({ handle })
            .orderBy('date', 'desc')
            .limit(4)
            .execute();

          // 检查当前时间段内的攻击次数
          let currentHalfDayCount = 0;
          for (const log of attackLogs) {
            const logTime = log.date;
            if (getHalfDayIdentifier(logTime) === currentHalfDayIdentifier) {
              currentHalfDayCount++;
            } else {
              //break; // 超出当前时间段，停止检查
            }
          }

          // 根据验证码状态确定攻击上限
          if (verification.verificationPassed) {
            // 斩杀攻击：当前半日已达2次限制
            if (currentHalfDayCount >= 2) {
              const nextResetHour = now.getHours() < 12 ? 12 : 24;
              return `您在当前时间段（${now.getHours() < 12 ? '0-12点' : '12-24点'}）已攻击过2次（斩杀阶段），请${nextResetHour === 12 ? '中午12点' : '次日0点'
                }后再挑战！`;
            }
          } else {
            // 普通攻击：当前半日已达1次限制
            if (currentHalfDayCount >= 1) {
              const nextResetHour = now.getHours() < 12 ? 12 : 24;
              return `您在当前时间段（${now.getHours() < 12 ? '0-12点' : '12-24点'}）已攻击过1次，请${nextResetHour === 12 ? '中午12点' : '次日0点'
                }后再挑战！`;
            }
          }
        }

        // 获取装备状态
        const [equippedWeapon] = await ctx.database.get('ggcevo_weapons', { handle, equipped: true });
        if (!equippedWeapon) return '请先输入"装备 武器名称"后再攻击。';

        // 计算伤害
        const weaponConfigEntry = Object.entries(weaponConfig).find(([_, c]) => c.id === equippedWeapon.weaponId);
        const [weaponName, weaponData] = weaponConfigEntry;

        if (!weaponData.isantiair && (verifiedBoss.groupId === 5 || verifiedBoss.groupId === 10)) {
          return '您当前装备的武器无法攻击空中目标！';
        }

        const [careerData] = await ctx.database.get('ggcevo_careers', { handle });

        // ======================= 主目标攻击 =======================
        const primaryAttackResult = await handlePrimaryAttack(
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
        const totalDamage = primaryAttackResult.initialDamage +
          (scatterResult ? scatterResult.extraDamages.reduce((sum, d) => sum + d.damage, 0) : 0);

        // 更新伤害记录（合并主目标和散射目标）
        await updateBossDamageRecord(
          ctx,
          handle,
          session.username,
          verifiedBoss.groupId,  // 注意：所有伤害都计入同一个BOSS组
          totalDamage
        );

        const deathResults = await handleDeathTargets(ctx, allDeadTargets, session.username, handle);
        bossEventBroadcast = deathResults.bossBroadcast;
        cleanerRewardBroadcast = deathResults.cleanerBroadcast;

        // ======================= 奖励系统 =======================

        const { finalReward, careerMessage, redcrystalMessage, techMessage } = await calculateRewards(
          ctx, handle, totalDamage
        );

        // 更新签到记录
        await updateSignRecord(ctx, handle, finalReward);

        // ======================= 任务系统 =======================
        // 收集任务完成情况
        const taskUpdates = [];
        if (primaryAttackResult.radiationApplied) {
          // 检查是否安装了辐射充能核心
          const hasRadiationCore = equippedWeapon.installedMods?.includes('辐射充能核心')

          // 根据模组存在决定任务计数
          const count = hasRadiationCore ? 2 : 1;
          taskUpdates.push({ taskId: 1, count });
        }
        if (primaryAttackResult.freezing) {
          const hasNitrogenCore = equippedWeapon.installedMods?.includes('氮气压缩核心');
          const count = hasNitrogenCore ? 2 : 1;
          taskUpdates.push({ taskId: 2, count });
        }
        if (primaryAttackResult.bileStacks) {
          taskUpdates.push({ taskId: 3, count: 1 });
        }
        if (primaryAttackResult.pulseApplied) {
          taskUpdates.push({ taskId: 4, count: primaryAttackResult.reductionAmount });
        }
        if (primaryAttackResult.arcApplied) {
          taskUpdates.push({ taskId: 5, count: primaryAttackResult.drainFactor });
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
        if (primaryAttackResult.burnLayerAdded) {
          let burnLayers = 1; // 默认叠加1层

          // 检查武器名称是否为'龙息霰弹枪'
          if (weaponName === '龙息霰弹枪') {
            burnLayers = 2; // 龙息霰弹枪固定叠加2层
          }

          // 检查是否安装'助燃核心'模组
          if (equippedWeapon.installedMods?.includes('助燃核心')) {
            burnLayers *= 2; // 有模组时双倍叠加层数
          }

          // 添加任务更新计数
          taskUpdates.push({ taskId: 7, count: burnLayers });
        }

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
          primaryAttackResult,
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
          cleanerRewardBroadcast,
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
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。';

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

        const [careerData] = await ctx.database.get('ggcevo_careers', { handle });

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

        const [records, total] = await Promise.all([
          // 获取当前页记录
          ctx.database.select('ggcevo_boss_damage')
            .where({ bossGroupId: mainBoss.groupId })
            .orderBy('totalDamage', 'desc')
            .limit(10)
            .offset(offset)
            .execute(),

          // 获取总记录数
          ctx.database.select('ggcevo_boss_damage')
            .where({ bossGroupId: mainBoss.groupId })
            .execute(row => $.count(row.handle))
        ]);

        const totalPages = Math.ceil(total / 10);
        if (pageNum > totalPages) return `查询失败，最多有 ${totalPages} 页`;

        if (!records.length) return '暂无伤害记录';

        // 构建伤害榜消息
        const rankingText = records
          .map((record, index) =>
            `${offset + index + 1}. ${record.playerName || '未知玩家'} | 总伤害: ${record.totalDamage} | 攻击次数: ${record.attackCount}`
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

        const bossGroup = bossPool.find(group => group.main.name === mainBoss.name);
        if (!bossGroup) return '配置数据异常，请联系管理员';

        const mainBossHpBar = createHpBar(mainBoss.HP, bossGroup.main.maxHP);

        // 主宰信息
        const result = [
          `🔴 主宰：${mainBoss.name}`,
          `${mainBossHpBar} (${mainBoss.HP}/${bossGroup.main.maxHP})`,
        ];

        // 如果配置的初始能量不为0，则显示当前能量值
        if (bossGroup.main.maxEnergy > 0) {
          result.push(`⚡ 能量：${mainBoss.energy}/1000`);
        }

        // +++ 新增护甲显示 +++
        result.push(`🛡️ 护甲：${bossGroup.main.armor || 0}`);

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
            const minionConfig = bossGroup.minions.find(m => m.name === minion.name);
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

    ctx.command('ggcevo/初始化异形 <groupid:number>', '初始化指定主宰组', { authority: 3 })
      .alias('初始化yx')
      .action(async (_, groupid) => {
        if (!groupid) groupid = 1

        // 查找对应的BOSS配置
        const bossConfig = bossPool.find(g => g.id === groupid)
        if (!bossConfig) {
          return `未找到groupid为${groupid}的异形配置`
        }

        // 清空相关伤害记录
        await ctx.database.remove('ggcevo_boss_damage', {});

        // 删除旧的主宰组
        await ctx.database.remove('ggcevo_boss', {});

        // 将ggcevo_weapons表中所有记录的comboCount重置为0
        await ctx.database.set('ggcevo_weapons', {}, { comboCount: 0 });


        await ctx.database.set('ggcevo_weapons', {}, { pityCounter: 0 });

        // 创建新的主宰组
        await ctx.database.create('ggcevo_boss', {
          name: bossConfig.main.name,
          type: '主宰',
          HP: bossConfig.main.maxHP,
          tags: bossConfig.main.tags,
          skills: [...bossConfig.main.passive],
          energy: bossConfig.main.maxEnergy,
          groupId: groupid,
          isActive: true,
          respawnTime: new Date()
        })

        // 过滤需要排除的子代名称
        const excludeNames = ['巢穴雷兽', '巢穴战士', '巢穴甲虫'];
        const validMinions = bossConfig.minions.filter(minion =>
          !excludeNames.includes(minion.name)
        );

        // 创建有效的子代
        for (const minion of validMinions) {
          await ctx.database.create('ggcevo_boss', {
            name: minion.name,
            type: '子代',
            HP: minion.maxHP,
            tags: minion.tags,
            skills: [...minion.passive],
            energy: minion.maxEnergy,
            groupId: groupid,
            isActive: true,
            respawnTime: new Date()
          })
        }

        return `✅ 异形初始化成功！当前主宰：${bossConfig.main.name}`
      })

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
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) return '⛔ 您已被列入黑名单。';

        // 获取金币信息
        const [sign] = await ctx.database.get('ggcevo_sign', { handle });
        if (!sign || sign.totalRewards < 50) return '需要50金币进行祈愿，您的金币不足。';

        // 检查冷却时间（优化部分）
        const now = new Date();
        // 直接获取最新的一条祈愿记录（按结束时间倒序）
        const [latestWish] = await ctx.database.get('ggcevo_wish', { handle }, {
          sort: { endTime: 'desc' },
          limit: 1
        });

        // 使用可选链操作符处理空值
        if (latestWish?.endTime > now) {
          // 合并祈愿配置并查找当前效果
          const allEffects = [...wishConfig.common, ...wishConfig.rare];
          const currentEffect = allEffects.find(e => e.name === latestWish.wishname) ?? {
            name: '未知效果',
            effect: '效果信息暂不可用'
          };

          // 格式化冷却结束时间
          const endTime = latestWish.endTime.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });

          return `🕒 祈愿冷却中，下次可祈愿时间：${endTime}\n当前祈愿效果：【${currentEffect.name}】${currentEffect.effect}`;
        }

        // 扣除基础费用
        let newGold = sign.totalRewards - 50;

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

        // 创建新的祈愿记录
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);
        await ctx.database.create('ggcevo_wish', {
          handle,
          wishname: effect.name,
          startTime,
          endTime,
          isused: false
        });

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

        return `✨ 祈愿成功！花费50枚金币获得【${effect.name}】效果：${effect.effect}\n⏳ 效果持续至 ${formattedEndTime}`;
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

        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
        if (existingEntries.length > 0) {
          return `⛔ 您已被列入黑名单。`
        }

        // 检查参数有效性
        const validFactions = ['人类联盟', '辛迪加海盗'];
        if (!faction) return `请输入“加入 阵营名称”加入对应阵营\n有效阵营：${validFactions.join(' / ')}`;
        if (!validFactions.includes(faction)) {
          return `您输入的是错误的阵营名称，请选择有效阵营：${validFactions.join(' / ')}`;
        }

        // 检查是否已加入阵营
        const [existing] = await ctx.database.get('ggcevo_careers', { handle });
        if (existing?.group === '人类联盟' || existing?.group === '辛迪加海盗') {
          return `你已经加入${existing.group}阵营，当前职业：${existing.career}`;
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

            await session.send(`请问您确定要缴纳1000金币加入人类联盟吗？(请在30秒内输入“是”确定加入)`);

            // 获取用户输入并转换为数字
            const cost = await session.prompt(30000);
            if (cost !== '是') return '已取消加入。';

            // 扣除金币
            await ctx.database.upsert('ggcevo_sign', [{
              handle,
              totalRewards: signData?.totalRewards - 1000
            }], ['handle']);

            // 创建职业记录
            await ctx.database.upsert('ggcevo_careers', [{
              handle,
              group: '人类联盟',
              career: '联盟新兵',
              date: new Date()
            }], ['handle']);

          } else if (faction === '辛迪加海盗') {
            if (userCoins < 2000) {
              return `加入辛迪加海盗需要缴纳2000金币，您当前拥有${userCoins}金币`;
            }

            await session.send(`请问您确定要缴纳2000金币加入辛迪加海盗吗？(请在30秒内输入“是”确定加入)`);

            // 获取用户输入并转换为数字
            const cost = await session.prompt(30000);
            if (cost !== '是') return '已取消加入。';

            // 扣除金币
            await ctx.database.upsert('ggcevo_sign', [{
              handle,
              totalRewards: signData?.totalRewards - 2000
            }], ['handle']);

            // 创建职业记录
            await ctx.database.upsert('ggcevo_careers', [{
              handle,
              group: '辛迪加海盗',
              career: '辛迪加炮灰新兵',
              redcrystal: (existing?.redcrystal || 0) + 5,
              date: new Date()
            }], ['handle']);
          }

          return `花费了${faction === '人类联盟' ? '1000金币' : '2000金币'}成功加入${faction}！${faction === '人类联盟' ? '' : '获得5枚红晶，'}初始职业：${faction === '人类联盟' ? '联盟新兵' : '辛迪加炮灰新兵'
            }`;
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
        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle });
        if (existingEntries.length > 0) {
          return `⛔ 您已被列入黑名单。`;
        }

        // 获取当前阵营信息
        const [currentCareer] = await ctx.database.get('ggcevo_careers', { handle });
        if (!currentCareer || !currentCareer.group) {
          return '您尚未加入任何阵营。';
        }

        // 获取用户金币信息
        const [signData] = await ctx.database.get('ggcevo_sign', { handle });
        const userCoins = signData?.totalRewards || 0;

        // 计算退出费用
        let exitCost = 0;
        let exitFactionName = '';

        if (currentCareer.group === '人类联盟') {
          exitCost = 2000; // 加入价格的2倍
          exitFactionName = '人类联盟';
        } else if (currentCareer.group === '辛迪加海盗') {
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
          await ctx.database.upsert('ggcevo_careers', [{
            handle,
            group: '',
            career: '',
            redcrystal: currentCareer.redcrystal, // 保留红晶数量
            date: null // 清空加入日期
          }], ['handle']);

          return `✅ 成功花费${exitCost}金币退出${exitFactionName}！`;
        } catch (err) {
          ctx.logger.error('退出阵营失败:', err);
          return '退出阵营时发生错误，请稍后再试';
        }
      });

    ctx.command('ggcevo/转职 [profession]', '转职系统')
      .action(async ({ session }, profession) => {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取用户绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        // 构建唯一句柄
        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        const existingEntries = await ctx.database.get('ggcevo_blacklist', { handle })
        if (existingEntries.length > 0) {
          return `⛔ 您已被列入黑名单。`
        }

        // 获取当前阵营信息
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle });
        if (!careerData) return '请先加入阵营后使用转职功能。';

        // 根据阵营加载配置
        let careerconfig;
        if (careerData.group === '人类联盟') {
          careerconfig = spaceStationCrewConfig;
        } else if (careerData.group === '辛迪加海盗') {
          careerconfig = syndicatePirateConfig;
        } else {
          return '未知阵营无法显示职业信息。';
        }

        // 无参数时显示职业列表
        if (!profession) {
          // 筛选可转职职业（排除当前职业）
          const availableCareers = careerconfig.filter(p =>
            p.Jobtransfer && p.professionName !== careerData.career
          );

          // 构建职业信息展示
          const careerList = availableCareers.map(p => {
            const info = [
              `🛠️ ${p.professionName}`,
              `▸ 效果：${p.effect || '暂无效果描述'}`,
              `▸ 需求：${p.requirements || '无特殊要求'}`,
              `▸ 消耗：` + (careerData.group === '辛迪加海盗' ? `${p.costredcrystal}红晶` : `${p.costcoins}金币`)

            ];
            return info.join('\n');
          });

          return [
            `🎖️ ${careerData.group} 可转职列表（当前职业：${careerData.career}）`,
            '使用"转职 职业名称"进行转职',
            '──────────────',
            ...(careerList.length ? careerList : ['暂无更多可转职职业']),
            '──────────────',
            '💡 转职后原有职业效果将被替换'
          ].join('\n');
        }

        // 以下是原有转职逻辑
        // 查找目标职业配置
        const targetProfession = careerconfig.find(p => p.professionName === profession);

        // 校验职业有效性
        if (!targetProfession) return '该职业不存在。';
        if (!targetProfession.Jobtransfer) return '该职业无法直接转职。';
        if (careerData.career === profession) return '您已经是该职业了。';

        // 在找到targetProfession后添加条件检查
        const requirementCheck = await checkTransferRequirements(ctx, handle, profession);
        if (!requirementCheck.success) {
          return `转职条件不满足：${requirementCheck.message}`;
        }

        // 获取用户资源
        const [signData] = await ctx.database.get('ggcevo_sign', { handle });
        const userCoins = signData?.totalRewards || 0;
        const userRedCrystal = careerData.redcrystal || 0;

        try {
          // 人类联盟转职逻辑
          if (careerData.group === '人类联盟') {
            if (userCoins < targetProfession.costcoins) {
              return `转职需要 ${targetProfession.costcoins} 金币，您当前拥有 ${userCoins}`;
            }

            // 扣除金币
            await ctx.database.upsert('ggcevo_sign', [{
              handle,
              totalRewards: userCoins - targetProfession.costcoins
            }], ['handle']);

            // 辛迪加海盗转职逻辑  
          } else if (careerData.group === '辛迪加海盗') {
            if (userRedCrystal < (targetProfession.costredcrystal || 0)) {
              return `需要红晶 ${targetProfession.costredcrystal}，您当前拥有 ${userRedCrystal}`;
            }

            // 扣除资源
            await Promise.all([
              ctx.database.upsert('ggcevo_careers', [{
                handle,
                redcrystal: userRedCrystal - (targetProfession.costredcrystal || 0)
              }], ['handle'])
            ]);
          }

          // 更新职业信息
          await ctx.database.upsert('ggcevo_careers', [{
            handle,
            career: profession,
          }], ['handle']);

          return `${careerData.group === '辛迪加海盗' ? `花费${targetProfession.costredcrystal}红晶` : `花费${targetProfession.costcoins}金币`}转职成功！当前职业：${profession}`;

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

          // 查询或创建职业数据
          let [careerData] = await ctx.database.get('ggcevo_careers', { handle });

          // 若未找到职业记录，则创建默认空记录
          if (!careerData) {
            await ctx.database.create('ggcevo_careers', {
              handle,
              group: '',
              career: '',
              redcrystal: 0,
              date: null
            });
            // 重新获取新创建的记录
            [careerData] = await ctx.database.get('ggcevo_careers', { handle });
          }

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
          if (careerData.group) {
            // 阵营配置查询
            const factionconfig = careerData.group === '辛迪加海盗' ?
              syndicatePirateConfig : spaceStationCrewConfig;
            const profession = factionconfig.find(p => p.professionName === careerData.career);
            const effectDisplay = profession?.effect || '无特殊效果';

            // 添加阵营相关信息
            infoCard.push(
              `🎯 当前阵营：${careerData.group}`,
              `👔 当前职业：${careerData.career}`,
              `✨ 职业效果：${effectDisplay}`
            );

            // 显示加入时间（如果存在）
            if (careerData.date) {
              const joinDate = new Date(careerData.date);
              const formattedDate = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月${joinDate.getDate()}日`;
              infoCard.push(`🗓️ 加入时间：${formattedDate}`);
            }

            // 人类联盟专属科技信息
            if (careerData.group === '人类联盟') {
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
          const promptMessage = careerData.group === '辛迪加海盗' ?
            '💡 提示：红晶可通过主动发起PK获得(无论胜负)' :
            careerData.group ? '💡 提示：使用「转职」指令可变更职业' : '';

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

        // 阵营验证
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle })
        if (!careerData || careerData.group !== '辛迪加海盗') {
          return '🚫 该功能需要【辛迪加海盗】阵营权限'
        }

        const currentCareer = careerData.career;

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
        if (await ctx.database.get('ggcevo_blacklist', { handle }).then(r => r.length)) {
          return '⛔ 您已被列入黑名单。'
        }

        // 阵营验证
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle })
        if (!careerData || careerData.group !== '辛迪加海盗') {
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
          const [existingItem] = await ctx.database.get('ggcevo_warehouse', {
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
          await ctx.database.set('ggcevo_careers', { handle }, {
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
            const [existing] = await ctx.database.get('ggcevo_warehouse', {
              handle,
              itemId: itemConfig.id
            });

            await ctx.database.upsert('ggcevo_warehouse', [{
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
            const currentStock = await ctx.database.get('ggcevo_warehouse', {
              handle,
              itemId: itemConfig.id
            }).then(r => r[0]?.quantity || 1)

            return [
              `✅ 成功订购【${item}】x1！`,
              ...priceInfo,
              discountApplied ? `💰 折扣明细：\n${discountReason}` : '',
              `当前库存：${currentStock}件`,
              '输入 "仓库" 查看所有物品'
            ].filter(Boolean).join('\n')
          }
        }

        // 调用异步响应构建函数
        return await buildResponse()
      })

    ctx.command('ggcevo/仓库')
      .action(async (argv) => {
        const session = argv.session;

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';

        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        const [items, signData, careerData] = await Promise.all([
          ctx.database.get('ggcevo_warehouse', { handle }),
          ctx.database.get('ggcevo_sign', { handle }),
          ctx.database.get('ggcevo_careers', { handle })
        ]);

        const totalRewards = signData[0]?.totalRewards || 0;
        const redcrystal = careerData[0]?.redcrystal || 0;

        const message = [`【${session.username}的仓库】`];
        message.push(`💰 金币：${totalRewards}`);

        // 修改部分：在红晶后添加分隔线
        if (careerData[0]?.group === '辛迪加海盗') {
          message.push(`🔴 红晶：${redcrystal}`);
        }

        message.push('――――――――――――――'); // 新增的分隔线

        const validItems = items.filter(item =>
          Object.values(SyndicatedItems).some(
            specialItem => specialItem.id === item.itemId
          ) && item.quantity > 0
        );

        if (!validItems.length) {
          message.push('你的物品仓库空空如也。');
        } else {
          message.push(
            validItems.map(warehouseItem => {
              const entry = Object.entries(SyndicatedItems).find(
                ([, item]) => item.id === warehouseItem.itemId
              );
              const [itemName, itemData] = entry;

              // 检查是否为可升级物品
              const upgradeConfig = itemupgrades.find(config => config.name === itemName);
              const isUpgradable = upgradeConfig && itemName in SyndicatedItems;
              const bonusValue = warehouseItem.bonus || 0;

              const itemLines = [
                `${itemName}`,
                `类型：${itemData.type} | 持有数量：${warehouseItem.quantity}`,
                `效果：${itemData.effects}`,
              ];

              // 如果是可升级物品，添加升级加成信息
              if (isUpgradable) {
                itemLines.push(`升级加成：${bonusValue}%`);
              }

              itemLines.push(
                `描述：${itemData.description}`,
                '――――――――――――――'
              );

              return itemLines.join('\n');
            }).join('\n')
          );
        }

        return message.join('\n');
      });

    ctx.command('ggcevo/使用 [itemName] [target]')
      .action(async (argv, itemName, target) => {
        const session = argv.session

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取玩家档案
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
        if (!profile) return '🔒 需要先绑定游戏句柄。'

        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

        // 黑名单检查
        if (await ctx.database.get('ggcevo_blacklist', { handle }).then(r => r.length)) {
          return '⛔ 您已被列入黑名单。'
        }

        try {
          if (!itemName) return '请输入“使用 物品名称 (可选目标)”使用仓库中的物品。'

          const warehouseItems = await ctx.database.get('ggcevo_warehouse', { handle })

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
          await ctx.database.set('ggcevo_warehouse',
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
      .usage('输入“科技”查看列表，或“科技 科技名称”查看详细信息')
      .action(async ({ session }, techName) => {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取玩家档案
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
        if (!profile) return '🔒 需要先绑定游戏句柄。'

        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

        // 阵营验证
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle })
        if (!careerData || careerData.group !== '人类联盟') {
          return '🚫 该功能需要【人类联盟】阵营权限'
        }

        // 罗马数字转换映射
        const romanNumerals = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

        // 检查情报副官折扣
        const isIntelligenceOfficer = careerData?.career === '情报副官'

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

        // 黑名单检查
        if (await ctx.database.get('ggcevo_blacklist', { handle }).then(r => r.length)) {
          return '⛔ 您已被列入黑名单。';
        }

        // 阵营验证
        const [career] = await ctx.database.get('ggcevo_careers', { handle });

        // 获取科技等级
        const [tech] = await ctx.database.get('ggcevo_tech', { handle, techId: 1 });
        const techLevel = tech?.level || 0;  // 默认等级为0

        // 检查仓库中的物品加成
        const warehouseItems = await ctx.database.get('ggcevo_warehouse', { handle });
        let itemBonusRate = 0;
        let miningRobotBonus = 0;

        // 检查自动采掘机器人
        const miningItem = warehouseItems.find(item => item.itemId === 8); // ID 8对应自动采掘机器人
        if (miningItem && career.group === '辛迪加海盗') {
          // 基础加成10% + 额外bonus加成
          miningRobotBonus = (10 + miningItem.bonus) / 100;
          itemBonusRate += miningRobotBonus;
        }

        // 处理挖矿操作
        const [record] = await ctx.database.get('ggcevo_Mining', { handle });
        const [sign] = await ctx.database.get('ggcevo_sign', { handle });

        // 开始挖矿或更新记录
        if (!record) {
          await ctx.database.create('ggcevo_Mining', {
            handle,
            startTime: new Date(),
            totalMined: 0  // 初始化总收益
          });
          return '⛏️ 首次挖矿作业已开始，请至少等待1小时。\n💡 提示：基础收益为每半小时4枚金币';
        }

        // 计算持续时间
        const nowtime = new Date();
        const chinaStart = record.startTime;
        const duration = Math.floor(
          (nowtime.getTime() - chinaStart.getTime()) / 1000 / 60
        );

        // 当持续时间不足时
        if (duration < 60) {
          const remaining = 60 - duration;
          return [
            '⛏️ 挖矿进行中',
            `🕒 开始时间：${record.startTime.toLocaleString('zh-CN', { hour12: false })}`,
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
        const maxHalfHours = (career?.group === '人类联盟' && techLevel === 5) ? 96 : 48;
        halfHours = Math.min(halfHours, maxHalfHours);
        base = Math.min(base, maxHalfHours * 4);

        // 初始化加成值
        let techBonusRate = 0;
        let careerBonusRate = 0;
        let shipBonusRate = 0;
        let minerBonusRate = 0; // 深空矿工独立加成

        // 人类联盟享受科技加成
        if (career?.group === '人类联盟') {
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
        const [equippedShip] = await ctx.database.get('ggcevo_spaceship', {
          handle,
        });

        // 检查飞船是否在允许的加成列表中
        if (equippedShip) {
          const allowedShips = {
            'TX-12星际巡洋舰': 0.05,
            'TX-12S隐形巡洋舰': 0.10
          };

          // 查找飞船名称（根据id匹配）
          for (const [name, data] of Object.entries(spaceship)) {
            if (data.id === equippedShip.id) {
              shipName = name;
              break;
            }
          }

          // 如果飞船在允许列表中，应用加成
          if (shipName && allowedShips[shipName]) {
            shipBonusRate = allowedShips[shipName];
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

          // 更新挖矿表
          await ctx.database.set('ggcevo_Mining', { handle }, {
            startTime: new Date(),
            totalMined: (record.totalMined || 0) + total
          });
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
          `🕒 开始时间：${record.startTime.toLocaleString('zh-CN', { hour12: false })}`,
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
          if (techLevel === 5 && career?.group === '人类联盟') {
            reportLines.push(`▸ ⏱️ 单次挖矿时间上限增加至48小时`);
          }
        }

        // 在报告中添加总收益显示
        reportLines.push(`🏆 历史总挖矿收益：${record.totalMined + total}金币`);

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

          // 黑名单检查
          if (await ctx.database.get('ggcevo_blacklist', { handle }).then(r => r.length)) {
            return '⛔ 您已被列入黑名单。';
          }

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
          const [careerData] = await ctx.database.get('ggcevo_careers', { handle });

          // 获取关键系统固件科技等级
          const [systemFirmwareTech] = await ctx.database.get('ggcevo_tech', { handle, techId: 5 }).catch(() => [{ level: 0 }]);
          const techLevel = Math.min(systemFirmwareTech?.level || 0, 5);

          // 计算可完成的次数（核心修改点）
          const completableTimes = Math.floor(taskData.progress / taskConfig.target);
          const remainingProgress = taskData.progress % taskConfig.target;
          const newCompletions = taskData.Completions + completableTimes;

          // === 奖励计算逻辑 ===
          // 计算总基础奖励（不含任何加成）
          const baseTotal = taskConfig.price * completableTimes;

          // 计算基础加成（科技和职业）
          let baseBonus = 0;
          if (techLevel > 0) {
            // 计算基础加成
            baseBonus = (careerData?.group === '人类联盟' && ['舰长', '情报副官'].includes(careerData?.career))
              ? [0, 10, 20, 30, 40, 50][techLevel]
              : [0, 5, 10, 15, 20, 25][techLevel];
          }

          // 舰长职业额外加成
          const captainBonus = (careerData?.group === '人类联盟' && careerData.career === '舰长') ? 50 : 0;

          // 总加成百分比
          const totalBonus = baseBonus + captainBonus;

          // 计算实际总奖励（应用所有加成）
          const totalReward = totalBonus > 0
            ? Math.round(baseTotal * (1 + totalBonus / 100))
            : baseTotal;

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

          // 显示总奖励信息（区分有无加成情况）
          if (totalBonus > 0) {
            response.push(`💰 获得奖励：${totalReward}金币 (基础值: ${baseTotal}金币)`);
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

    ctx.command('ggcevo/购买保护卡', '花费600金币购买一周PK保护卡')
      .alias('购买pk保护卡')
      .action(async ({ session }) => {
        try {

          const Curfew = fixedCurfewCheck(session, config)
          if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

          // 验证用户绑定状态
          const userId = session.userId;
          const [profile] = await ctx.database.get('sc2arcade_player', { userId });
          if (!profile) return '🔒 请先绑定游戏句柄。';

          // 生成用户句柄
          const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

          // 检查黑名单状态
          const isBlacklisted = await ctx.database.get('ggcevo_blacklist', { handle });
          if (isBlacklisted.length > 0) return '⛔ 您已被列入黑名单。';

          // 获取用户金币
          const [signRecord] = await ctx.database.get('ggcevo_sign', { handle });
          if (!signRecord) return '您还没有签到记录，请先签到一次。';

          const currentGold = signRecord.totalRewards;
          const protectionCost = 600; // 修改为600金币

          // 验证金币是否足够
          if (currentGold < protectionCost) {
            return `金币不足，购买保护卡需要${protectionCost}金币（当前：${currentGold}金币）`;
          }

          // 添加确认购买步骤
          await session.send(`⚠️ 请问您是否花费${protectionCost}金币购买一周的PK保护卡？\n回复"是"购买，或回复其他内容退出`);

          const confirm = await session.prompt(30000);
          if (confirm !== '是') return '已取消购买操作，金币未扣除。';

          // 计算保护起止时间
          const startTime = new Date();
          const endTime = new Date();
          endTime.setDate(startTime.getDate() + 7); // 7天保护期

          // 格式化时间显示
          const formatTime = (date: Date) => {
            return date.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
          };

          // 检查现有保护卡是否存在重叠
          const existingProtections = await ctx.database.get('ggcevo_pk_protection', {
            handle,
            endTime: { $gt: startTime },
            status: 'active'
          });

          if (existingProtections.length > 0) {
            const nearestEnd = existingProtections.reduce((max, p) =>
              p.endTime > max ? p.endTime : max, new Date(0)
            );
            return `您已拥有保护卡（至 ${formatTime(nearestEnd)}），请到期后再购买`;
          }

          // 数据库事务：扣金币+添加保护卡
          await ctx.database.withTransaction(async () => {
            // 扣减金币
            await ctx.database.set('ggcevo_sign', handle, {
              totalRewards: currentGold - protectionCost
            });

            // 添加保护卡记录
            await ctx.database.create('ggcevo_pk_protection', {
              handle,
              startTime,
              endTime,
              status: 'active'
            });
          });

          return `✅ 成功购买PK保护卡！\n` +
            `💰 扣除金币: ${protectionCost}\n` +
            `⏱️ 生效时间: ${formatTime(startTime)}\n` +
            `🛡️ 保护结束: ${formatTime(endTime)}`;

        } catch (error) {
          console.error('购买保护卡出错:', error);
          return '购买过程中发生错误，请稍后再试';
        }
      });

    ctx.command('ggcevo/开启军械库防爆门')
      .alias('打开军械库防爆门')
      .action(async (argv) => {
        const session = argv.session;

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'


        // 1. 获取玩家绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 请先绑定游戏句柄。';

        const { regionId, realmId, profileId } = profile;
        const handle = `${regionId}-S2-${realmId}-${profileId}`;

        // 检查黑名单状态
        const isBlacklisted = await ctx.database.get('ggcevo_blacklist', { handle });
        if (isBlacklisted.length > 0) return '⛔ 您已被列入黑名单。';

        // 2. 检查人类阵营
        const [careerData] = await ctx.database.get('ggcevo_careers', { handle });
        if (!careerData || careerData.group !== '人类联盟') {
          return '⚠️ 您不属于人类阵营，无法执行此操作';
        }

        // 3. 检查职业
        const validCareers = ['警卫员下士', '警卫长', '情报副官'];
        if (!careerData.career || !validCareers.includes(careerData.career)) {
          return `⚠️ 您的职业(${careerData.career || '未设置'})不是警卫员下士、警卫长或情报副官`;
        }

        // 4. 检查权限
        const [permission] = await ctx.database.get('ggcevo_permissions', { handle });
        if (!permission || !permission.explosiondoorauthority || permission.explosiondoorauthority < 1) {
          return '⚠️ 您没有操作军械库防爆门的权限';
        }

        // 5. 获取用户已拥有的传奇武器
        const userWeapons = await ctx.database.get('ggcevo_weapons', { handle });
        const ownedLegendaryIds = userWeapons
          .filter(weapon => weapon.weaponId >= 101 && weapon.weaponId <= 108) // 传奇武器ID范围
          .map(weapon => weapon.weaponId);

        // 6. 获取所有传奇武器配置
        const allLegendaryWeapons = Object.entries(weaponConfig)
          .filter(([_, config]) => config.category === "传奇武器")
          .map(([name, config]) => ({ name, ...config }));

        // 7. 过滤掉用户已拥有的传奇武器
        const availableLegendaryWeapons = allLegendaryWeapons
          .filter(weapon => !ownedLegendaryIds.includes(weapon.id));

        if (availableLegendaryWeapons.length === 0) {
          return '⚠️ 您已经拥有所有传奇武器，无法获得新武器。';
        }

        // 8. 随机选择一把传奇武器
        const randomIndex = Math.floor(Math.random() * availableLegendaryWeapons.length);
        const awardedWeapon = availableLegendaryWeapons[randomIndex];

        // 9. 使用事务更新数据库
        await ctx.database.withTransaction(async () => {
          // 扣除权限
          await ctx.database.set('ggcevo_permissions', { handle }, {
            explosiondoorauthority: permission.explosiondoorauthority - 1
          });

          // 添加新武器到武器库
          await ctx.database.upsert('ggcevo_weapons', [{
            handle,
            weaponId: awardedWeapon.id,
            level: 0,
            modificationSlots: 1,
            installedMods: [],
            equipped: false,
            comboCount: 0,
          }]);
        });

        return [
          `🎉 军械库防爆门已开启！`,
          `✨ 您获得了传奇武器：${awardedWeapon.name}`,
          `🔧 武器类型：${awardedWeapon.type}`,
          `⚔️ 基础伤害：${awardedWeapon.damage}`,
          `📖 描述：${awardedWeapon.description}`,
        ].join('\n');
      });

    ctx.command('ggcevo/技能 [异形名称]')
      .usage('查询异形技能，输入"技能"查看所有异形，输入"技能 异形名称"查询详细技能')
      .action(async ({ session }, unitName) => {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 收集所有异形名称（去重排序）
        const allUnits = new Set<string>();
        bossPool.forEach(boss => {
          allUnits.add(boss.main.name);
          boss.minions.forEach(minion => allUnits.add(minion.name));
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

        // 查找匹配的异形（支持模糊匹配）
        const searchName = unitName.trim().toLowerCase();
        const matchedUnits = sortedUnits.filter(name =>
          name.toLowerCase().includes(searchName)
        );

        // 模糊匹配结果处理
        if (matchedUnits.length === 0) {
          return `未找到名称包含"${unitName}"的异形，请输入完整名称或部分关键词`;
        }
        if (matchedUnits.length > 1) {
          return [
            `找到多个包含"${unitName}"的异形：`,
            ...matchedUnits.map(name => `▸ ${name}`),
            '请选择具体异形名称查询'
          ].join('\n');
        }

        // 精确匹配异形单位
        const targetUnit = matchedUnits[0];
        let skills: string[] = [];
        let foundUnitType: string | null = null;

        // 在bossPool中查找异形技能配置
        bossPool.some(boss => {
          // 检查主宰单位
          if (boss.main.name === targetUnit) {
            skills = boss.main.passive || [];
            foundUnitType = '主宰';
            return true;
          }
          // 检查子代单位
          const minion = boss.minions.find(m => m.name === targetUnit);
          if (minion) {
            skills = minion.passive || [];
            foundUnitType = '子代';
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

        // 递归添加技能详情（带层级）
        const addSkillDetail = (skillName: string, indentLevel = 0, visited = new Set<string>()) => {
          // 避免循环引用
          if (visited.has(skillName)) {
            allSkillDetails.push(`${'  '.repeat(indentLevel)}▸ ${skillName}：[递归终止 - 避免循环引用]`);
            return;
          }
          visited.add(skillName);

          // 检查技能配置是否存在
          const config = passiveConfig[skillName];
          if (!config) {
            allSkillDetails.push(`${'  '.repeat(indentLevel)}▸ ${skillName}：技能未定义`);
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
          allSkillDetails.push(`${indent}▸ ${skillName}：\n    ${desc}`);

          // 添加衍生技能（如果有）
          const derivedSkills = config.derivedSkills || [];
          if (derivedSkills.length > 0) {
            // 添加衍生技能标题
            const derivedTitle = indentLevel === 0 ? '↓ 一级衍生技能 ↓' :
              indentLevel === 1 ? '↓ 二级衍生技能 ↓' : '↓ 衍生技能 ↓';
            allSkillDetails.push(`${indent}  ${derivedTitle}`);

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

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 物品配置（每个物品的基础掉落概率）
        const possibleItems = [
          { id: 2, name: "闪光弹", type: '手榴弹', chance: 0.1 },
          { id: 4, name: "脉冲手雷", type: '手榴弹', chance: 0.1 },
          { id: 9, name: "莫洛托夫燃烧弹", type: '手榴弹', chance: 0.05 },
          { id: 10, name: "铝热炸弹", type: '爆破物', chance: 0.05 },
        ];

        // 获取玩家基础信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';
        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;
        const name = session.username;

        // 黑名单检查
        if (await ctx.database.get('ggcevo_blacklist', { handle }).then(r => r.length)) {
          return '⛔ 您已被列入黑名单。';
        }

        // 解析目标用户
        if (galaxyName) {
          const parsedUser = h.parse(galaxyName)[0];
          if (parsedUser && parsedUser.type === 'at') return '禁止探索群友。';
        }

        // 阵营验证
        const [career] = await ctx.database.get('ggcevo_careers', { handle });

        // 职业相关信息
        const careerName = career?.career;
        const careerCoinBonus = careerName === '总工程师' ? 50 : 0;
        // 新增：总工程师成功率加成
        const engineerSuccessBonus = careerName === '总工程师' ? 0.1 : 0;

        // 新增：破坏者职业效果
        let demolitionsBonus = 0;
        let bomberBonusItem = '';
        if (careerName === '破坏者') {
          demolitionsBonus = 0.2;
          bomberBonusItem = '爆破物';
        }

        // 新增：纵火狂职业效果
        let arsonistBonus = 0;
        let molotovBonusItem = '';
        if (careerName === '纵火狂') {
          arsonistBonus = 0.2;
          molotovBonusItem = '莫洛托夫燃烧弹';
        }

        // 获取玩家飞船信息
        const [shipRecord] = await ctx.database.get('ggcevo_spaceship', { handle });
        let shipBonus = 0;
        let plunderRateBonus = 0;
        let isBehemoth = false;
        let isStealthShip = false;
        let shipSuccessBonus = 0;

        if (shipRecord) {
          const ship = Object.values(spaceship).find(s => s.id === shipRecord.id);
          if (ship) {
            switch (ship.id) {
              case 2: // TX-12S隐形巡洋舰
                shipBonus = 5;
                isStealthShip = true;
                shipSuccessBonus = 0.1;
                break;
              case 3: // TX-12A突击巡洋舰
                shipBonus = 20;
                plunderRateBonus = 20;
                shipSuccessBonus = 0.2;
                break;
              case 4: // 庞兽号歼星舰
                shipBonus = 30;
                plunderRateBonus = 30;
                isBehemoth = true;
                shipSuccessBonus = 0.6;
                break;
              default:
                shipBonus = ship.explorebonus || 0;
            }
          }
        }

        // 获取反应堆科技等级
        const [techReactor] = await ctx.database.get('ggcevo_tech', { handle, techId: 6 });
        const techLevel = techReactor?.level || 0;
        let techBonusRate = 0;
        let careerBonusRate = 0;

        if (career?.group === '人类联盟' && techLevel > 0) {
          const baseRates = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
          techBonusRate = baseRates[techLevel];
          const specialCareers = ['总工程师', '情报副官'];
          if (specialCareers.includes(careerName)) careerBonusRate = baseRates[techLevel];
        }

        // 获取探索记录
        const [record] = await ctx.database.get('ggcevo_explore', { handle });
        const now = new Date();

        // 处理探索状态
        if (record && record.status === '探索中') {
          const duration = Math.floor((now.getTime() - record.startTime.getTime()) / 1000 / 60);
          const remainingMinutes = 12 * 60 - duration;

          if (remainingMinutes > 0) {
            return [
              '🪐 正在进行探索任务',
              `🌌 星系：${record.galaxy}`,
              `⏱️ 开始时间：${record.startTime.toLocaleString('zh-CN', { hour12: false })}`,
              `⏳ 剩余时间：${Math.floor(remainingMinutes / 60)}小时${remainingMinutes % 60}分钟`,
              '💡 提示：探索将持续12小时，完成后才可再次进行探索'
            ].join('\n');
          } else {
            // ==== 探索完成 - 开始结算 ====
            const returnsIncrement = (record.returns || 0) + 1;
            const galaxyData = galaxy[record.galaxy];

            // 计算实际成功率
            let successRate = galaxyData.success;
            if (career?.group === '人类联盟' && record.galaxy === '联盟星系') successRate += 0.1;
            else if (career?.group === '辛迪加海盗' && record.galaxy === '辛迪加星系') successRate += 0.1;

            // 添加总工程师成功率加成
            successRate += engineerSuccessBonus;
            successRate += shipSuccessBonus;
            successRate = Math.min(successRate, 1);

            // 基础金币奖励
            let baseCoinReward = Math.floor(Math.random() * 51) + 50;
            const galaxyBonusPercent = galaxyData.bonus * 100;

            // 详细加成效果
            const bonusEffects = [];

            if (galaxyBonusPercent) {
              bonusEffects.push(`▸ 🌌 ${record.galaxy}：金币+${galaxyBonusPercent.toFixed(0)}%`);
            }

            if (shipBonus || shipSuccessBonus) {
              let shipType = shipRecord ? getSpaceshipNameById(shipRecord.id) : "未知飞船";
              if (shipBonus) bonusEffects.push(`▸ 🚀 ${shipType}：金币+${shipBonus}%`);
              if (shipSuccessBonus) bonusEffects.push(`▸ 🛸 ${shipType}：成功率+${Math.round(shipSuccessBonus * 100)}%`);
            }

            if (record.plunderbonus) {
              const sign = record.plunderbonus > 0 ? '+' : '';
              bonusEffects.push(`▸ ⚔️ 掠夺事件：${sign}${record.plunderbonus}%金币`);
            }

            // 添加总工程师成功率加成提示
            if (engineerSuccessBonus > 0) {
              bonusEffects.push(`▸ 🔧 总工程师职业：成功率+${Math.round(engineerSuccessBonus * 100)}%`);
            }

            // 计算物品掉落加成
            let itemDropBonus = 0;

            // 陨石星系的物品掉落加成
            if (record.galaxy === '陨石星系') {
              itemDropBonus += 0.1;
              bonusEffects.push(`▸ 🌠 陨石星系效果：物品获得概率+10%`);
            }

            // 科技和职业的掉落加成
            if (career?.group === '人类联盟' && techLevel === 5 && ['情报副官', '总工程师'].includes(careerName)) {
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

            // 新增：破坏者职业效果提示
            if (demolitionsBonus > 0) {
              bonusEffects.push(`▸ 💣 破坏者职业：${bomberBonusItem}获得概率+${demolitionsBonus * 100}%`);
            }

            // 新增：纵火狂职业效果提示
            if (arsonistBonus > 0) {
              bonusEffects.push(`▸ 🔥 纵火狂职业：${molotovBonusItem}获得概率+${arsonistBonus * 100}%`);
            }

            // 计算总加成系数
            const totalBonusMultiplier = 1 + (
              galaxyBonusPercent +
              shipBonus +
              (record.plunderbonus || 0) +
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

            // 更新金币总额
            const [signRecord] = await ctx.database.get('ggcevo_sign', { handle });
            let newTotalRewards = finalCoin;
            if (signRecord) {
              newTotalRewards += signRecord.totalRewards;
              await ctx.database.set('ggcevo_sign', { handle }, { totalRewards: newTotalRewards });
            } else {
              await ctx.database.create('ggcevo_sign', {
                handle,
                lastSign: null,
                monthlyDays: 0,
                totalRewards: finalCoin
              });
            }

            // 物品奖励处理（包含破坏者和纵火狂效果）
            let itemRewards = [];
            if (isSuccess) {
              // 获取当前星系可获得的物品
              const availableItems = galaxyData.available;

              // 遍历所有可能的物品
              for (const item of possibleItems) {
                // 检查当前星系是否提供该物品
                if (availableItems.includes(item.name)) {
                  // 应用物品掉落加成（加法计算）
                  let dropRate = item.chance + itemDropBonus;

                  // 新增：应用破坏者职业加成
                  if (careerName === '破坏者' && item.type === bomberBonusItem) {
                    dropRate += demolitionsBonus;
                  }

                  // 新增：应用纵火狂职业加成
                  if (careerName === '纵火狂' && item.name === molotovBonusItem) {
                    dropRate += arsonistBonus;
                  }

                  if (Math.random() < dropRate) {
                    const [existing] = await ctx.database.get('ggcevo_warehouse', {
                      handle,
                      itemId: item.id
                    });

                    // 新增：职业额外掉落机制
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

                    if (existing) {
                      await ctx.database.set('ggcevo_warehouse', {
                        handle,
                        itemId: item.id
                      }, { quantity: existing.quantity + finalQuantity });
                    } else {
                      await ctx.database.create('ggcevo_warehouse', {
                        handle,
                        itemId: item.id,
                        quantity: finalQuantity,
                        bonus: 0
                      });
                    }
                    // 显示数量
                    itemRewards.push(`${item.name}${extraDrop > 0 ? `×${finalQuantity}` : ''}`);
                  }
                }
              }
            }

            // 更新探索记录
            await ctx.database.set('ggcevo_explore', { handle }, {
              status: '空闲',
              startTime: null,
              galaxy: null,
              returns: returnsIncrement,
              plunderbonus: 0
            });

            // 构建结算信息
            const isRewardModified = finalCoin !== baseCoinReward;
            const coinDisplay = isRewardModified
              ? `💰 金币 +${finalCoin}（基础值 ${baseCoinReward}）`
              : `💰 金币 +${finalCoin}`;

            const resultMessage = [
              isSuccess ? '🎉 探索成功！' : '⚠️ 探索失败！',
              `🌌 星系：${record.galaxy}`,
              `🔮 实际成功率：${(successRate * 100).toFixed(1)}%`,
              coinDisplay,
              ...(itemRewards.length > 0
                ? [`🎁 获得物品：${itemRewards.join('、')}`]
                : []),
              ...(bonusEffects.length > 0
                ? [
                  '',
                  '⚡ 加成效果：',
                  ...bonusEffects
                ]
                : []),
              '',
              `🏆 已探索次数：${returnsIncrement}`,
              '💡 输入"探索 星系名称"开始下一轮探索'
            ].filter(Boolean).join('\n');

            return resultMessage;
          }
        }

        // 如果没有提供星系名称，显示可探索星系列表
        if (!galaxyName) {
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

        // 检查星系是否存在
        if (!galaxy[galaxyName]) {
          return `❌ 未知的星系："${galaxyName}"`;
        }

        // ======= 优化后的掠夺事件处理 =======
        const basePlunderRate = 0.2;
        const actualPlunderRate = basePlunderRate + (plunderRateBonus / 100);
        const canPlunder = Math.random() < actualPlunderRate;
        let plunderHandled = false;

        if (canPlunder) {
          // 获取可掠夺目标（排除隐形巡洋舰持有者但附加条件）
          const explorers = await ctx.database.get('ggcevo_explore', {
            galaxy: galaxyName,
            status: '探索中',
            plunderbonus: { $gte: 0 },
            handle: { $ne: handle }
          });

          if (explorers.length > 0) {
            const shipHandles = explorers.map(e => e.handle);
            const ships = await ctx.database.get('ggcevo_spaceship', {
              handle: { $in: shipHandles }
            });

            const shipMap = new Map(ships.map(ship => [ship.handle, ship.id]));

            // 修改1：TX-12S防掠夺条件变更
            const plunderTargets = explorers.filter(explorer => {
              const shipId = shipMap.get(explorer.handle);
              // 仅当TX-12S用户无加成时才保护
              return !(shipId === 2 && explorer.plunderbonus <= 0);
            });

            if (plunderTargets.length > 0) {
              const target = plunderTargets[Math.floor(Math.random() * plunderTargets.length)];
              const targetShipId = shipMap.get(target.handle) || 0;
              const targetShipType = getSpaceshipNameById(targetShipId);

              // 获取玩家飞船类型
              const playerShipType = shipRecord ? getSpaceshipNameById(shipRecord.id) : "未知型号";

              let isTargetBehemoth = false;
              let defenseNote = '';
              if (targetShipId === 4) isTargetBehemoth = true;

              // 新增：识别双方飞船型号
              const sameShipType = shipRecord?.id === targetShipId;

              let baseSuccessRate = sameShipType ? 50 : // 修改2：相同型号固定50%
                isBehemoth ? 80 : // 庞兽号基础成功率
                  shipRecord?.id === 3 ? 60 : // 突击巡洋舰
                    50; // 默认成功率

              // 庞兽号防御效果
              if (isTargetBehemoth && !isBehemoth && !sameShipType) {
                baseSuccessRate -= 30;
                defenseNote = '⚠️ 目标飞船为庞兽号歼星舰，掠夺成功率降低30%！';
              }

              // 相同型号提示
              if (sameShipType) {
                defenseNote = `⚠️ 检测到相同型号飞船「${playerShipType}」，掠夺成功率固定为50%！`;
              }

              await session.send([
                `❗ 您在探索过程中发现了【${target.name}】的飞船`,
                `🚀 对方飞船：${targetShipType}`,
                defenseNote,
                `🎯 掠夺成功率：${baseSuccessRate}%`,
                `⏱️ （30秒内输入"是"来进行掠夺）`
              ].filter(line => line !== '').join('\n'));

              try {
                const response = await session.prompt(30000);
                if (response === '是') {
                  const success = Math.random() < baseSuccessRate / 100;
                  let playerBonus, targetBonus;

                  if (success) {
                    playerBonus = 20;
                    targetBonus = -20;
                  } else {
                    playerBonus = -20;
                    targetBonus = 20;
                  }

                  // 获取当前玩家的探索记录
                  const [currentRecord] = await ctx.database.get('ggcevo_explore', { handle });

                  await ctx.database.upsert('ggcevo_explore', [{
                    handle,
                    name,
                    startTime: new Date(),
                    galaxy: galaxyName,
                    returns: currentRecord?.returns || 0,
                    plunderbonus: (currentRecord?.plunderbonus || 0) + playerBonus, // 累加加成值
                    status: '探索中'
                  }], ['handle']);

                  const [targetRecord] = await ctx.database.get('ggcevo_explore', { handle: target.handle });
                  await ctx.database.set('ggcevo_explore', { handle: target.handle }, {
                    plunderbonus: (targetRecord.plunderbonus || 0) + targetBonus
                  });

                  await session.send(
                    success
                      ? `✅ 掠夺成功！您获得${playerBonus}%金币加成，${target.name}的金币收益被降低了20%。`
                      : `❌ 掠夺失败！您的金币收益被降低20%，${target.name}获得了20%的金币收益加成。`
                  );
                  plunderHandled = true;
                }
              } catch (error) {
                // 忽略超时错误
              }
            }
          }
        }
        // ======= 掠夺事件处理结束 =======

        // 开始新的探索任务
        if (!plunderHandled) {
          await ctx.database.upsert('ggcevo_explore', [{
            handle,
            name,
            startTime: new Date(),
            galaxy: galaxyName,
            returns: record?.returns || 0,
            plunderbonus: 0,
            status: '探索中'
          }], ['handle']);
        }

        // 计算预计成功率
        const galaxyData = galaxy[galaxyName];
        let estimatedRate = galaxyData.success;
        if (career?.group === '人类联盟' && galaxyName === '联盟星系') estimatedRate += 0.1;
        else if (career?.group === '辛迪加海盗' && galaxyName === '辛迪加星系') estimatedRate += 0.1;

        // 添加总工程师成功率加成
        estimatedRate += engineerSuccessBonus;
        estimatedRate += shipSuccessBonus;
        estimatedRate = Math.min(estimatedRate, 1) * 100;

        // 探索开始信息
        return [
          `🚀 开始探索 ${galaxyName}`,
          `⏱️ 开始时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
          `⏳ 持续时间：12小时`,
          `📊 预计成功率：${estimatedRate.toFixed(0)}%`,
          `📦 可获得物品：${galaxyData.available.join('、') || '无'}`,
          `💰 预计可获得50-100金币`
        ].join('\n');
      });

    // 创建飞船ID到飞船名称的映射
    const shipIdToName = {};
    for (const [name, data] of Object.entries(spaceship)) {
      shipIdToName[data.id] = name;
    }

    // 1. 飞船信息指令 - 查询玩家当前拥有的飞船
    ctx.command('ggcevo/飞船信息')
      .action(async ({ session }) => {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取玩家基础信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';
        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        // 获取飞船记录
        const [shipRecord] = await ctx.database.get('ggcevo_spaceship', { handle });

        // 获取金币余额（从签到表）
        const [signRecord] = await ctx.database.get('ggcevo_sign', { handle });
        const coins = signRecord?.totalRewards || 0;

        if (!shipRecord) {
          return [
            '🚀 您目前没有拥有任何飞船',
            '购买飞船指令：购买飞船 [飞船名称]',
            '可购买飞船列表：' + Object.keys(spaceship).join(', ')
          ].join('\n');
        }

        // 通过ID获取飞船名称和详情
        const shipName = shipIdToName[shipRecord.id];
        if (!shipName) return '⚠️ 飞船配置数据异常，请联系管理员';
        const ship = spaceship[shipName];

        // 格式化信息
        return [
          `🚀 飞船名称：${shipName}`,
          `📝 描述：${ship.description}`,
          `⛏️ 挖矿加成：+${ship.miningbonus}%金币`,
          `🔭 探索加成：+${ship.explorebonus}%金币`,
          `💡 特殊效果：${ship.effect || '无'}`,
          `📅 获得时间：${shipRecord.createTime.toLocaleString('zh-CN', { hour12: false })}`,
        ].join('\n');
      });

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
        if ((await ctx.database.get('ggcevo_blacklist', { handle })).length) {
          return '⛔ 您已被列入黑名单。';
        }

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
            `💡 提示：购买飞船后使用"飞船信息"查看您的飞船`
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
        const [existingShip] = await ctx.database.get('ggcevo_spaceship', { handle });
        const now = new Date();

        if (existingShip) {
          // 获取原有飞船名称
          const existingShipName = shipIdToName[existingShip.id] || '未知飞船';

          // 已有飞船时提示替换
          await session.send(
            `⚠️ 您已拥有飞船【${existingShipName}】，是否替换为【${shipName}】?\n` +
            `✔️ 更换需支付 ${ship.price}金币（原飞船无退款）\n` +
            '请在30秒内输入"是"确认更换，或输入其他内容取消。'
          );

          const confirm = await session.prompt(30000);
          if (confirm !== '是') return '🚫 已取消购买';

          // 更新飞船记录 (保留原有状态)
          await ctx.database.set('ggcevo_spaceship', { handle }, {
            id: ship.id,
            createTime: now
          });
        } else {
          // 第一次购买，创建飞船记录（设置状态为空闲）
          await ctx.database.create('ggcevo_spaceship', {
            handle,
            id: ship.id,
            createTime: now
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
          existingShip ? `🔁 已替换原有飞船` : '🚀 祝你星系探险愉快！',
          '\n📡 使用"飞船信息"查看您的飞船详情' // 新增的提示
        ].join('\n');
      });

    ctx.command('ggcevo/升级物品 [itemName]', '升级辛迪加海盗物品')
      .usage('输入"升级物品"查看可升级列表，或"升级物品 物品名称"进行升级')
      .action(async ({ session }, itemName) => {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取玩家基础信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true });
        if (!profile) return '🔒 需要先绑定游戏句柄。';
        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`;

        // 黑名单检查
        if ((await ctx.database.get('ggcevo_blacklist', { handle })).length) {
          return '⛔ 您已被列入黑名单。';
        }

        // 获取用户阵营信息
        const [career] = await ctx.database.get('ggcevo_careers', { handle });
        if (!career) return '🚫 仅限辛迪加海盗阵营使用';

        if (career.group !== '辛迪加海盗') {
          return `🚫 仅限辛迪加海盗阵营使用`;
        }

        // 检查是否为指挥官职业用于折扣计算
        const isCommander = career.career === '指挥官';

        // 无参数时显示可升级物品列表
        if (!itemName) {
          // 获取用户仓库中的所有物品
          const warehouseItems = await ctx.database.get('ggcevo_warehouse', { handle });

          // 过滤可升级物品
          const upgradableItems = [];

          // 遍历仓库物品
          for (const item of warehouseItems) {
            // 从配置中查找物品名称
            const [itemName, itemConfig] = Object.entries(SyndicatedItems)
              .find(([name, config]) => config.id === item.itemId) || [];

            if (!itemName || !itemConfig) continue;

            // 查找升级配置
            const upgradeConfig = itemupgrades.find(cfg => cfg.name === itemName);
            if (!upgradeConfig) continue;

            // 检查是否达到最大升级
            if (item.bonus >= upgradeConfig.maxBonus) continue;

            // 计算实际升级费用（考虑指挥官折扣）
            const baseCost = upgradeConfig.upgradeCostBase;
            const actualCost = isCommander ? Math.floor(baseCost * 0.5) : baseCost;

            upgradableItems.push({
              name: itemName,
              currentBonus: item.bonus,
              maxBonus: upgradeConfig.maxBonus,
              cost: actualCost,
              discount: isCommander ? `(原价: ${baseCost} 红晶)` : '',
              // 新增: 存储升级区间信息
              upgradeRange: `${upgradeConfig.minUpgrade}%~${upgradeConfig.maxUpgrade}%`
            });
          }

          if (upgradableItems.length === 0) {
            return '🚫 当前没有可升级的物品';
          }

          // 构建折扣明细消息
          const discountNotice = [];
          if (isCommander) {
            discountNotice.push(
              '💰 指挥官职业效果：',
              '▸ 🎖️ 升级费用：50%折扣',
              '▸ ⚡ 升级加成：50%概率触发双倍提升'
            );
          }

          // 格式化列表输出
          const msgLines = [
            '💎 可升级物品列表',
            ...discountNotice,
            '====================',
            ...upgradableItems.map(item => {
              return [
                `▸ ${item.name}：`,
                `  当前升级加成: ${item.currentBonus}% / ${item.maxBonus}%`,
                `  每次升级提升: ${item.upgradeRange}`,
                `  升级消耗: ${item.cost} 红晶 ${item.discount}`
              ].join('\n');
            }),
            '====================',
            `使用"升级物品 物品名称"进行升级`
          ];

          return msgLines.join('\n');
        }

        // --- 物品升级逻辑部分 ---

        // 查找物品配置
        const itemConfig = SyndicatedItems[itemName];
        if (!itemConfig) return `🚫 未找到物品【${itemName}】的配置信息`;

        // 查找升级配置
        const upgradeConfig = itemupgrades.find(cfg => cfg.name === itemName);
        if (!upgradeConfig) return `🚫 物品【${itemName}】缺少升级配置`;

        // 获取用户仓库中的物品
        const warehouseItems = await ctx.database.get('ggcevo_warehouse', {
          handle,
          itemId: itemConfig.id
        });

        if (!warehouseItems || warehouseItems.length === 0) {
          return `🚫 您的仓库中没有【${itemName}】`;
        }
        const warehouseItem = warehouseItems[0];

        if (warehouseItem.bonus >= upgradeConfig.maxBonus) {
          return `🚫 【${itemName}】已达到最大升级上限(${upgradeConfig.maxBonus}%)`;
        }

        // 应用50%折扣（指挥官职业）- 只应用折扣但不显示提示
        let upgradeCost = upgradeConfig.upgradeCostBase;
        if (isCommander) {
          upgradeCost = Math.floor(upgradeCost * 0.5);
        }

        // 检查红晶是否足够
        if (career.redcrystal < upgradeCost) {
          return `🚫 红晶不足！升级需要${upgradeCost}红晶，您当前有${career.redcrystal}红晶`;
        }

        // 计算本次基础升级数值
        const baseUpgradeValue = Math.floor(
          Math.random() * (upgradeConfig.maxUpgrade - upgradeConfig.minUpgrade + 1)
        ) + upgradeConfig.minUpgrade;

        // 新增指挥官双倍效果判断
        let actualUpgrade = baseUpgradeValue;
        let doubleEffect = false;

        if (isCommander && Math.random() < 0.5) { // 50%概率触发双倍
          actualUpgrade *= 2;  // 提升值翻倍
          doubleEffect = true; // 标记触发双倍效果

          // 确保不超过最大上限
          actualUpgrade = Math.min(
            actualUpgrade,
            upgradeConfig.maxBonus - warehouseItem.bonus
          );
        } else {
          // 非双倍时的上限处理
          actualUpgrade = Math.min(
            actualUpgrade,
            upgradeConfig.maxBonus - warehouseItem.bonus
          );
        }

        // 更新红晶数量
        const newRedCrystal = career.redcrystal - upgradeCost;
        await ctx.database.upsert('ggcevo_careers', [{
          handle: handle,
          redcrystal: newRedCrystal,
        }], ['handle']);

        // 更新物品加成
        const totalBonus = warehouseItem.bonus + actualUpgrade;
        await ctx.database.upsert('ggcevo_warehouse', [{
          handle: handle,
          itemId: itemConfig.id,
          bonus: totalBonus,
          upgrades: warehouseItem.upgrades + 1
        }], ['handle', 'itemId']);

        return `✅ 【${itemName}】升级成功！\n` +
          `- 消耗红晶: ${upgradeCost} (基础值: ${upgradeConfig.upgradeCostBase} 红晶)\n` +
          `- 本次提升: ${actualUpgrade}%${doubleEffect ? ` (基础值:${baseUpgradeValue}%)` : ''}\n` +  // 双倍提示放在提升值后面
          `- 当前加成: ${totalBonus}%\n` +
          `- 剩余红晶: ${newRedCrystal}`;
      });

    ctx.guild()
      .command('ggcevo/init', '初始化群组全局配置', { authority: 3 })
      .option('reset', '-r 重置已存在配置') // 可选：添加重置选项
      .action(async ({ session, options }) => {
        const groupId = session.guildId;
        const now = new Date();

        // 检查是否已存在配置
        const existing = await ctx.database.get('ggcevo_global_stats', { groupId });

        if (existing.length > 0 && !options.reset) {
          return '配置已存在！如需重置请使用 -r 选项';
        }

        // 执行初始化操作（存在则更新，不存在则创建）
        await ctx.database.upsert('ggcevo_global_stats', [{
          groupId,
          updatedAt: now,
          rankdate: now
        }]);

        return `群组 ${groupId} 配置已${existing.length ? '重置' : '初始化'}\n` +
          `排名更新时间: ${now.toLocaleString()}\n` +
          `胜点榜基准日: ${now.toLocaleDateString()}`;
      });

    ctx.command('ggcevo/竞猜 [itemId] [amount] [guess]', '参与竞猜游戏')
      .usage('输入"竞猜"查看可竞猜项目，"竞猜 项目ID 金额 内容"进行竞猜')
      .example('竞猜 1 500 寒冰王蛇')
      .action(async ({ session }, itemId, amount, guess) => {
        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
        if (!profile) return '🔒 需要先绑定游戏句柄'

        // 获取当前账号信息
        const { regionId, realmId, profileId } = profile
        const handle = `${regionId}-S2-${realmId}-${profileId}`
        const username = session.username

        // 黑名单检查
        if ((await ctx.database.get('ggcevo_blacklist', { handle })).length) {
          return '⛔ 您已被列入黑名单。';
        }

        const [signInfo] = await ctx.database.get('ggcevo_sign', { handle })
        if (!signInfo) return '⚠️ 账号数据异常，请重试'
        const userCoins = signInfo.totalRewards

        // 过滤可用竞猜项目 (状态为open)
        const availableItems = GUESSING_ITEMS.filter(item => item.status === 'open')

        // 无参数显示竞猜列表
        if (!itemId) {
          return [
            '🎯 可参与竞猜项目 🎯',
            '使用"竞猜 项目ID 金额 内容"下注',
            '=================================',
            ...availableItems.map(item =>
              `▸ [ID:${item.id}] ${item.description}\n   赔率: ${item.odds}x | 投注范围: ${item.minBet}-${item.maxBet}金币`
            ),
            '=================================',
          ].join('\n')
        }

        // 检查项目ID有效性
        const parsedItemId = parseInt(itemId)
        if (isNaN(parsedItemId)) return '⚠️ 项目ID必须是数字\n使用"竞猜 项目ID 金额 内容"下注'

        const targetItem = availableItems.find(item => item.id === parsedItemId)
        if (!targetItem) return '⚠️ 无效的项目ID或项目不可用\n使用"竞猜 项目ID 金额 内容"下注'

        // 只输入项目ID时显示详细信息
        if (!amount && !guess) {
          // 检查用户是否已下注
          const [userBet] = await ctx.database.get('ggcevo_guess', {
            handle,
            itemId: parsedItemId
          })

          const wins = userBet?.wins || 0
          const betInfo = (userBet && userBet.amount > 0)
            ? `已下注: ${userBet.amount}金币 (内容:${userBet.guessContent})`
            : '尚未下注'

          return [
            `📋 项目详情 [ID:${parsedItemId}]`,
            `描述: ${targetItem.description}`,
            `赔率: ${targetItem.odds}x`,
            `投注范围: ${targetItem.minBet}-${targetItem.maxBet}金币`,
            `猜中次数: ${wins} 次`,
            `您的状态: ${betInfo}`,
          ].join('\n')
        }

        // 检查是否提供了金额和内容
        if (!amount) return '⚠️ 格式错误，请使用"竞猜 项目ID 金额 内容"下注'
        if (!guess) return '⚠️ 格式错误，请使用"竞猜 项目ID 金额 内容"下注'

        // 检查金额有效性
        const betAmount = parseInt(amount)
        if (isNaN(betAmount) || betAmount < 1) return '⚠️ 参数错误，请使用"竞猜 项目ID 金额 内容"下注'

        // 最小投注验证
        if (betAmount < targetItem.minBet) {
          return `⚠️ 下注金额必须≥${targetItem.minBet}金币 (当前项目最低投注)`
        }

        // 最大投注验证 - 新增部分
        if (betAmount > targetItem.maxBet) {
          return `⚠️ 下注金额不能超过${targetItem.maxBet}金币 (当前项目最高投注)`
        }

        // 余额检查
        if (betAmount > userCoins) return `⚠️ 金币不足，当前账户只有 ${userCoins} 金币`

        // 检查用户是否已参与且未结算
        const [existingBet] = await ctx.database.get('ggcevo_guess', {
          handle,
          itemId: parsedItemId,
          amount: { $gt: 0 }  // 只查找金额大于0的未结算记录
        })

        if (existingBet) {
          return '⛔ 您已参与该项目竞猜，禁止重复下注\n' +
            `当前下注内容: ${existingBet.guessContent}\n` +
            `当前下注金额: ${existingBet.amount}金币`
        }

        // 验证竞猜内容（只能是主宰的名字）
        const validBossNames = bossPool.map(pool => pool.main.name)
        if (!validBossNames.includes(guess)) {
          return `⚠️ 无效的主宰名字，可用选项：\n${validBossNames.join('、')}`
        }

        // 写入竞猜记录
        const recordData = {
          handle,
          name: username,
          itemId: parsedItemId,
          guessContent: guess,
          amount: betAmount,
          createdAt: new Date()
        }

        try {
          await ctx.database.upsert('ggcevo_guess', [recordData])

          // 扣除用户金币
          await ctx.database.set('ggcevo_sign', { handle }, {
            totalRewards: userCoins - betAmount
          })

          return [
            '✅ 竞猜下注成功！',
            `项目ID: ${parsedItemId}`,
            `项目描述: ${targetItem.description}`,
            `竞猜内容: ${guess}`,
            `投入金额: ${betAmount} 金币`,
            `如猜中将获得: ${Math.floor(betAmount * targetItem.odds)} 金币`,
            '⏳ 每个项目只能下注一次',
          ].join('\n')
        } catch (e) {
          ctx.logger('ggcevo').error(e)
          return '⚠️ 竞猜提交失败，请重试'
        }
      })

    ctx.command('ggcevo/兑换资源 [name] [amount]')
      .alias('兑换')
      .usage('输入"兑换资源"查看可兑换物品列表\n输入"兑换资源 物品名称 [数量]"进行兑换')
      .action(async ({ session }, name, amount) => {

        const Curfew = fixedCurfewCheck(session, config)
        if (!Curfew) return '⛔ 宵禁时段 (18:00-24:00) 禁止在群聊中使用咕咕之战指令。\n请添加C.O.R.E为好友使用私聊指令，好友验证信息为【咕咕之战】。'

        // 获取用户绑定信息
        const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId })
        if (!profile) return '🔒 需要先绑定游戏句柄'
        const handle = `${profile.regionId}-S2-${profile.realmId}-${profile.profileId}`

        // 黑名单检查
        if ((await ctx.database.get('ggcevo_blacklist', { handle })).length) {
          return '⛔ 您已被列入黑名单。'
        }

        // 可兑换物品映射表
        const exchangeItems = {
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
            table: 'ggcevo_careers',
            display: '1张资源兑换券 → 1红晶',
            preCheck: async () => {
              const [career] = await ctx.database.get('ggcevo_careers', { handle })
              if (!career || career.group !== '辛迪加海盗') {
                return `⚠️ 兑换失败：仅限【辛迪加海盗】组织成员兑换，您当前属于【${career?.group || '无'}】`
              }
              return null
            }
          },

          // === 物品兑换 ===
          '资源兑换券': {
            type: 'item',
            costItemId: 2,     // 消耗：ItemID=2 (兑换券)
            costAmount: 1,     // 每张兑换券消耗数量
            gainItemId: 8,     // 获得：ItemID=8 (资源兑换券)
            gainAmount: 20,    // 获得数量
            display: '1张兑换券 → 20张资源兑换券'
          }
          // 可在此继续添加其他物品兑换...
        }

        // 无参数时显示可兑换物品列表
        if (!name) {
          // 查询用户持有的相关物品
          const [resourceCoupon] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 8 })   // 资源兑换券
          const [exchangeCoupon] = await ctx.database.get('ggcevo_backpack', { handle, itemId: 2 })    // 兑换券

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
            '"兑换资源 金币 5" → 兑换500金币（消耗5张资源券）',
            '"兑换资源 资源兑换券 2" → 兑换40张资源券（消耗2张兑换券）'
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

    ctx.command('异形刷新权重', '查询当前主宰刷新权重')
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

          // 关联BOSS名称并排序
          const sortedList = weights.map(w => {
            const boss = bossPool.find(b => b.id === w.bossId);
            return {
              id: w.bossId,
              name: boss?.main?.name || `未知BOSS(${w.bossId})`,
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

          let reply = '当前BOSS刷新权重（按权重从高到低）：\n';
          reply += '===========================\n';

          sortedList.forEach(boss => {
            reply += `【${boss.name}】\n`;
            reply += `▸ 权重：${boss.weight}\n`;
            reply += `▸ 上次刷新：${dateFormat(boss.lastSpawn)}\n`;
            reply += '---------------------------\n';
          });

          return reply;
        } catch (err) {
          ctx.logger.error('BOSS权重查询失败', err);
          return '查询BOSS权重时发生错误，请检查服务器日志';
        }
      });





  }





















  ctx.command('ggcevo/签到奖励')
    .action(({ }) => {
      return `
签到金币奖励：
每天获得50-100金币
--------------
签到红晶奖励(辛迪加财务经理职业加成)：
每天签到获得5枚红晶
`.trim()
    })

  ctx.command('ggcevo/pk规则')
    .action(({ }) => {
      return `
⚔️【全新PK规则】⚔️  
1️⃣ 阵营限制  
仅限「人类联盟」与「辛迪加海盗」成员参与PK  
未加入阵营玩家请使用「加入」指令选择阵营  
      
2️⃣ 人类联盟保护机制  
新成员享有30天保护期（从加入阵营日起算）
保护期内不可被挑战  
首次主动发起PK即视为放弃保护期（永久开启PK功能）  
      
3️⃣ 战斗惩罚调整  
人类联盟被动应战的PK战败 ➜ 仅损失1%金币
辛迪加海盗PK战败 ➜ 随机1%-5%损失金币  
      
4️⃣ 每日限制  
主动发起PK次数：3次/日  
PK同玩家限战：1次/日  
被PK次数上限：5次/日  
      
🔥【战力系统升级】🔥  
1️⃣ 战力组成  
武器加成 + 职业加成 
      
2️⃣ 武器加成
每拥有一把武器 ➜ + 基础伤害 x 100
      
每一把武器强化等级带来指数级战力增长：
等级1 ➜ +1000  
等级2 ➜ +3000 
等级3 ➜ +6000 
等级4 ➜ +10000  
等级5 ➜ +15000  
等级6 ➜ +21000 
      
每改装一个通用模块 ➜ +2000
每改装一个专属模块 ➜ +4000
      
3️⃣ 职业加成
联盟新兵：+1000  
深空矿工，医疗专家，情报副官，总工程师，舰长，机械化专家：+2500
警卫员下士，警卫长，武器中士：+3500
辛迪加炮灰新兵：+2000
清洁工，辛迪加财务经理，计算机专家，指挥官，装甲兵，破坏者，征募官：+3000 
能量武器专家，枪手，猩红杀手，纵火狂：+4000
`.trim()
    })

  ctx.command('ggcevo/击败奖励')
    .alias('击杀奖励')
    .action(({ }) => {
      return `
🌟 异形主宰击败奖励规则 🌟
🏆 伤害榜奖励（按伤害排名）：
1️⃣ 第1名: 
   35 资源兑换券
2️⃣ 第2名: 
   30 资源兑换券
3️⃣ 第3名: 
   25 资源兑换券
🏅 第4-10名: 
   20 资源兑换券
🎖 第11-20名: 
   15 资源兑换券
💫 第21-50名: 
   10 资源兑换券
💝 其他参与者:
   5 资源兑换券
           
🌈 精灵双倍祈愿生效期间，获得双倍的资源兑换券
         
💡 特殊说明：
1. 奖励自动发放到账户，无需手动领取
2. 精灵双倍祈愿可通过“祈愿”指令概率获得
3. 排名根据实际造成伤害计算
`.trim()
    })

  ctx.command('ggcevo/祈愿系统')
    .action(({ }) => {
      return `
🎋 祈愿系统
祈愿是连接星界的神秘仪式，消耗50金币可换取随机祈愿效果！通过智慧与运气的交织，助你在咕咕之战路上突破瓶颈。效果持续7天​​ ，冷却期间无法再次祈愿。
      
🍀 ​​普通祈愿池（95%概率）​​
🦗 ​​蚱蜢优购​​：下一次购买武器(非传奇)享有20%的折扣
🦊 ​​灵狐升运​​：下一次升级武器享有20%的折扣
👑 ​​王权增幅​​：攻击伤害提高5%
🍊 ​​金柚赐福​​：立即获得3张资源兑换券
🪙 ​​夜市赠礼​​：立即获得5枚咕咕币
      
🔮 ​​稀有祈愿池（5%概率）​​
🗡️ ​​悲鸣之锋​​：攻击伤害提高10%，武器每等级提高5%伤害
🧚 ​​精灵双倍​​：下一次击败主宰时可获得双倍的资源兑换券
🐾 ​​喵喵财源​​：签到获得双倍的金币和咕咕币
🎵 ​​暴击韵律​​：攻击暴击率提高20%
⚠️ ​​酥手空空​​：立即失去50枚金币（可触发彩蛋）
`.trim()
    })

  ctx.command('ggcevo/赛季奖励')
    .alias('排名奖励')
    .action(({ }) => {
      return `
🏆 赛季排名奖励规则：
🥇 第1名：
   100 咕咕币 + 🥇 赛季冠军勋章
🥈 第2名：
   90 咕咕币 + 🥈 赛季亚军勋章
🥉 第3名：
   80 咕咕币 + 🥉 赛季季军勋章
🏅 第4-10名：
   60 咕咕币 + 🏅 赛季前十勋章
🎖 第11-20名：
   40 咕咕币 + 🎖 赛季前二十勋章
💝 参与奖励：
▸ 所有积分 > 0 玩家：20 咕咕币
▸ 所有积分 ≤ 0 玩家：10 咕咕币
      
📦 勋章系统：
● 每个勋章对应专属成就
● 可永久保存在背包中
● 动态赛季名称显示（如：🥇S1赛季冠军勋章）
      
📌 重要说明：
1. 结算后自动发放所有奖励
2. 勋章可通过背包查看
3. 每个赛季持续2个月，可通过“胜点榜”指令查看
`.trim()
    })





}
