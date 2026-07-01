import { Context, Schema } from 'koishi'
import 'koishi-plugin-ggcevo-sign'
import { careers } from './careers'
import { weapons } from './weapons'


export const name = 'ggcevo-game'

export const inject = {
  required: ['database'],
}

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

declare module 'koishi' {
  interface Tables {
    ggcevo_player_profile: PlayerProfile
    ggcevo_player_actions: PlayerActions
    ggcevo_player_weapons: PlayerWeapon
  }
}

export interface PlayerProfile {
  user_id: string               // 游戏句柄（主键）
  human_career_id: string       // 人类阵营职业 ID
  syndicate_career_id: string   // 辛迪加海盗阵营职业 ID
  created_at: Date              // 创建时间
  updated_at: Date              // 更新时间
}

export interface PlayerActions {
  user_id: string               // 游戏句柄（主键）
  mining_start_time: Date       // 挖矿开始时间
  updated_at: Date              // 更新时间
}

export interface PlayerWeapon {
  id: number                     // 主键（自增）
  user_id: string                // 游戏句柄
  weapon_id: string              // 武器 ID
  weapon_name: string            // 武器名称
  weapon_level: number           // 武器等级（默认0）
  weapon_module: string         // 武器模块（默认空，每把武器仅能装一个）
  count: number                  // 数量
  purchased_at: Date             // 购买时间
}

export function apply(ctx: Context, config: Config) {
  // 获取玩家游戏句柄
  const getHandle = async (session: any): Promise<string | null> => {
    const [profile] = await ctx.database.get('sc2arcade_player', { userId: session.userId, isActive: true })
    if (!profile) return null
    const { regionId, realmId, profileId } = profile
    return `${regionId}-S2-${realmId}-${profileId}`
  }

  // 创建玩家职业表
  ctx.model.extend('ggcevo_player_profile', {
    user_id: 'string',
    human_career_id: 'string',
    syndicate_career_id: 'string',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  }, {
    primary: 'user_id',
  })

  // 创建玩家操作记录表
  ctx.model.extend('ggcevo_player_actions', {
    user_id: 'string',
    mining_start_time: 'timestamp',
    updated_at: 'timestamp',
  }, {
    primary: 'user_id',
  })

  // 创建玩家武器表
  ctx.model.extend('ggcevo_player_weapons', {
    id: 'unsigned',
    user_id: 'string',
    weapon_id: 'string',
    weapon_name: 'string',
    weapon_level: 'unsigned',
    weapon_module: 'string',
    count: 'unsigned',
    purchased_at: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
  })

  // 人类职业列表
  ctx.command('game/人类职业', '查看所有人类阵营职业详情')
    .action(async () => {
      const humanCareers = careers.filter(c => c.faction === 'human')
      if (humanCareers.length === 0) {
        return '目前没有可用的的人类职业。'
      }
      const lines = humanCareers.map(c => {
        const skillsText = c.skills.map(s => `  · ${s.name}：${s.description}`).join('\n')
        return `【${c.name}】\n  ${c.description}\n  技能：\n${skillsText}`
      })
      return `===== 人类阵营职业 =====\n\n${lines.join('\n\n')}`
    })

  // 海盗职业列表
  ctx.command('game/海盗职业', '查看所有辛迪加海盗阵营职业详情')
    .action(async () => {
      const pirateCareers = careers.filter(c => c.faction === 'syndicate')
      if (pirateCareers.length === 0) {
        return '目前没有可用的辛迪加海盗职业。'
      }
      const lines = pirateCareers.map(c => {
        const skillsText = c.skills.map(s => `  · ${s.name}：${s.description}`).join('\n')
        return `【${c.name}】\n  ${c.description}\n  技能：\n${skillsText}`
      })
      return `===== 辛迪加海盗阵营职业 =====\n\n${lines.join('\n\n')}`
    })

  // 人类转职
  ctx.command('game/人类转职 <name:string>', '选择一个人类阵营职业')
    .action(async (argv, name) => {
      const { session } = argv
      const handle = await getHandle(session)
      if (!handle) {
        return '🔒 需要先绑定游戏句柄。\n💡 使用 `绑定句柄` 命令进行绑定。'
      }
      if (!name) {
        return '❌ 请输入职业名称！\n使用 `人类职业` 查看可选职业。'
      }

      const matchedCareers = careers.filter(c => c.faction === 'human' && c.name.includes(name))
      if (matchedCareers.length === 0) {
        return `❌ 不存在名为"${name}"的人类职业！\n使用 \`人类职业\` 查看可选职业。`
      }
      if (matchedCareers.length > 1) {
        const names = matchedCareers.map(c => c.name).join('、')
        return `❌ 名称"${name}"匹配多个职业：${names}\n请输入更完整的职业名称。`
      }

      const career = matchedCareers[0]
      const [profile] = await ctx.database.get('ggcevo_player_profile', { user_id: handle })

      if (profile?.human_career_id === career.id) {
        return `❌ 你已经是 ${career.name} 了！无法重复转职。`
      }
      if (profile?.human_career_id) {
        const existing = careers.find(c => c.id === profile.human_career_id)
        return `❌ 你已经有职业 ${existing?.name || profile.human_career_id} 了！每个阵营只能选择一个职业。`
      }

      const now = new Date()
      if (profile) {
        await ctx.database.upsert('ggcevo_player_profile', [{
          user_id: handle,
          human_career_id: career.id,
          updated_at: now,
        }])
      } else {
        await ctx.database.create('ggcevo_player_profile', {
          user_id: handle,
          human_career_id: career.id,
          syndicate_career_id: '',
          created_at: now,
          updated_at: now,
        })
      }

      const skillsText = career.skills.map(s => `\n  · ${s.name}：${s.description}`).join('')
      return `✅ 转职成功！\n阵营：人类\n职业：${career.name}\n技能：${skillsText}`
    })

  // 海盗转职
  ctx.command('game/海盗转职 <name:string>', '选择一个辛迪加海盗阵营职业')
    .action(async (argv, name) => {
      const { session } = argv
      const handle = await getHandle(session)
      if (!handle) {
        return '🔒 需要先绑定游戏句柄。\n💡 使用 `绑定句柄` 命令进行绑定。'
      }
      if (!name) {
        return '❌ 请输入职业名称！\n使用 `海盗职业` 查看可选职业。'
      }

      const matchedCareers = careers.filter(c => c.faction === 'syndicate' && c.name.includes(name))
      if (matchedCareers.length === 0) {
        return `❌ 不存在名为"${name}"的海盗职业！\n使用 \`海盗职业\` 查看可选职业。`
      }
      if (matchedCareers.length > 1) {
        const names = matchedCareers.map(c => c.name).join('、')
        return `❌ 名称"${name}"匹配多个职业：${names}\n请输入更完整的职业名称。`
      }

      const career = matchedCareers[0]
      const [profile] = await ctx.database.get('ggcevo_player_profile', { user_id: handle })

      if (profile?.syndicate_career_id === career.id) {
        return `❌ 你已经是 ${career.name} 了！无法重复转职。`
      }
      if (profile?.syndicate_career_id) {
        const existing = careers.find(c => c.id === profile.syndicate_career_id)
        return `❌ 你已经有职业 ${existing?.name || profile.syndicate_career_id} 了！每个阵营只能选择一个职业。`
      }

      const now = new Date()
      if (profile) {
        await ctx.database.upsert('ggcevo_player_profile', [{
          user_id: handle,
          syndicate_career_id: career.id,
          updated_at: now,
        }])
      } else {
        await ctx.database.create('ggcevo_player_profile', {
          user_id: handle,
          human_career_id: '',
          syndicate_career_id: career.id,
          created_at: now,
          updated_at: now,
        })
      }

      const skillsText = career.skills.map(s => `\n  · ${s.name}：${s.description}`).join('')
      return `✅ 转职成功！\n阵营：辛迪加海盗\n职业：${career.name}\n技能：${skillsText}`
    })

  // 挖矿
  ctx.command('game/挖矿', '进行太空采掘矿石')
    .action(async (argv) => {
      const { session } = argv
      const handle = await getHandle(session)
      if (!handle) {
        return '🔒 需要先绑定游戏句柄。\n💡 使用 `绑定句柄` 命令进行绑定。'
      }

      const [actions] = await ctx.database.get('ggcevo_player_actions', { user_id: handle })
      const now = new Date()

      // 还未开始挖矿，开始挖矿
      if (!actions?.mining_start_time) {
        await ctx.database.upsert('ggcevo_player_actions', [{
          user_id: handle,
          mining_start_time: now,
          updated_at: now,
        }])
        return '🚀 正在进行的太空采掘矿石行动...\n💡 采矿完成后再次输入 `/game/挖矿` 领取收益。'
      }

      const startTime = new Date(actions.mining_start_time)
      const elapsedMs = now.getTime() - startTime.getTime()
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60))
      const minMinutes = 30
      const maxMinutes = 48 * 60 // 48小时
      const goldPerInterval = 4  // 每30分钟4金币

      if (elapsedMinutes < minMinutes) {
        const remaining = minMinutes - elapsedMinutes
        return `⏳ 采矿时间不足，还需等待 ${remaining} 分钟。\n当前采矿进度：${elapsedMinutes}/${minMinutes} 分钟`
      }

      // 计算实际可收获的间隔数（最多存储48小时）
      const actualMinutes = Math.min(elapsedMinutes, maxMinutes)
      const intervals = Math.floor(actualMinutes / minMinutes)
      let goldEarned = intervals * goldPerInterval

      // 获取玩家职业，应用深空矿工技能
      const [profile] = await ctx.database.get('ggcevo_player_profile', { user_id: handle })
      const humanCareer = careers.find(c => c.id === profile?.human_career_id)
      const deepMinerSkill = humanCareer?.skills.find(s => s.name === '高效采矿')
      if (deepMinerSkill?.effect) {
        goldEarned = Math.floor(deepMinerSkill.effect(goldEarned))
      }

      // 领取收益
      const [backpackItem] = await ctx.database.get('ggcevo_backpack', { user_id: handle, item_id: 1 })
      if (backpackItem) {
        await ctx.database.upsert('ggcevo_backpack', [{
          id: backpackItem.id,
          user_id: handle,
          item_id: 1,
          count: backpackItem.count + goldEarned,
        }])
      } else {
        await ctx.database.create('ggcevo_backpack', {
          user_id: handle,
          item_id: 1,
          count: goldEarned,
        })
      }

      // 重置挖矿时间
      await ctx.database.upsert('ggcevo_player_actions', [{
        user_id: handle,
        mining_start_time: now,
        updated_at: now,
      }])

      const hours = Math.floor(actualMinutes / 60)
      const mins = actualMinutes % 60
      const timeStr = hours > 0 ? `${hours}小时${mins > 0 ? mins + '分钟' : ''}` : `${actualMinutes}分钟`

      let bonusInfo = ''
      if (deepMinerSkill) {
        bonusInfo = `\n⭐ 职业加成：${humanCareer.name} · ${deepMinerSkill.name} 生效！`
      }

      return `⛏️ 采矿收获！\n─────────────\n采矿时长：${timeStr}\n累计收益：${goldEarned} 金币${bonusInfo}\n─────────────\n🚀 正在进行的太空采掘矿石行动...\n💡 下次领取请稍后再来。`
    })

  // 武器库
  ctx.command('game/武器库 [category:string]', '查看武器库')
    .action(async (argv, category) => {
      const categories = ['实弹武器', '能量武器', '热能武器']
      if (!category) {
        const lines = categories.map(c => {
          const count = weapons.filter(w => w.weaponCategory === c).length
          return `【${c}】 共 ${count} 种武器`
        }).join('\n')
        return `===== 武器库 =====\n\n${lines}\n\n💡 使用 \`武器库 实弹武器\` 查看详细列表`
      }

      if (!categories.includes(category)) {
        return `❌ 不存在 "${category}" 不是有效的武器类型！\n可用类型：${categories.join('、')}`
      }

      const matchedWeapons = weapons.filter(w => w.weaponCategory === category)
      if (matchedWeapons.length === 0) {
        return `目前没有可用的${category}。`
      }

      const lines = matchedWeapons.map(w => {
        const tagEffectsText = w.tagEffects.length > 0
          ? `  标签特性：\n${w.tagEffects.map(t => `    · 对 ${t.tag}：造成 ${Math.floor(t.damageMultiplier * 100)}% 伤害`).join('\n')}`
          : ''
        const skillsText = w.skills.length > 0
          ? `  特殊技能：\n${w.skills.map(s => `    · ${s.name}：${s.description}`).join('\n')}`
          : ''
        const armorText = w.armorInteraction === 'reduce'
          ? `  护甲：目标每拥有1点护甲，伤害减少 ${w.armorReduction || 1} 点`
          : w.armorInteraction === 'ignore'
            ? `  护甲：无视目标护甲`
            : w.armorInteraction === 'pierce'
              ? `  护甲：穿透目标护甲`
              : `  护甲：绕过目标护甲`
        const redCrystalText = w.redCrystalPrice !== null
          ? `  红晶价格：${w.redCrystalPrice} 红晶`
          : `  红晶价格：不可购买`
        const airText = w.canAttackAir ? `可攻击飞行目标` : `无法攻击飞行目标`

        return `【${w.name}】\n  ${w.description}\n  武器科技等级：${w.techLevel}级\n  伤害类型：${w.damageType}\n  基础伤害：${w.baseDamage}\n${armorText}\n  金币价格：${w.price} 金币\n${redCrystalText}\n  对空：${airText}${tagEffectsText ? '\n' + tagEffectsText : ''}${skillsText ? '\n' + skillsText : ''}`
      })

      return `===== ${category} =====\n\n${lines.join('\n\n')}`
    })

  // 购买武器
  ctx.command('game/购买武器 <name:string>', '使用金币购买武器')
    .action(async (argv, name) => {
      const { session } = argv
      const handle = await getHandle(session)
      if (!handle) {
        return '🔒 需要先绑定游戏句柄。\n💡 使用 `绑定句柄` 命令进行绑定。'
      }
      if (!name) {
        return '❌ 请输入武器名称！\n使用 `武器库` 查看可购买武器。'
      }

      const matchedWeapons = weapons.filter(w => w.name.includes(name))
      if (matchedWeapons.length === 0) {
        return `❌ 不存在名为"${name}"的武器！\n使用 \`武器库\` 查看可购买武器。`
      }
      if (matchedWeapons.length > 1) {
        const names = matchedWeapons.map(w => w.name).join('、')
        return `❌ 名称"${name}"匹配多个武器：${names}\n请输入更完整的武器名称。`
      }

      const weapon = matchedWeapons[0]

      // 查询玩家金币背包
      const [goldItem] = await ctx.database.get('ggcevo_backpack', {
        user_id: handle,
        item_id: 1,
      })
      const goldCount = goldItem?.count || 0

      if (goldCount < weapon.price) {
        return `❌ 金币不足！\n需要 ${weapon.price} 金币，当前拥有 ${goldCount} 金币。`
      }

      const now = new Date()

      // 扣除金币
      if (goldItem) {
        await ctx.database.upsert('ggcevo_backpack', [{
          id: goldItem.id,
          user_id: handle,
          item_id: 1,
          count: goldCount - weapon.price,
        }])
      }

      // 增加武器
      const [existingWeapon] = await ctx.database.get('ggcevo_player_weapons', {
        user_id: handle,
        weapon_id: weapon.id,
      })
      if (existingWeapon) {
        await ctx.database.upsert('ggcevo_player_weapons', [{
          id: existingWeapon.id,
          user_id: handle,
          weapon_id: weapon.id,
          weapon_name: weapon.name,
          weapon_level: existingWeapon.weapon_level || 0,
          weapon_module: existingWeapon.weapon_module || '',
          count: existingWeapon.count + 1,
          purchased_at: now,
        }])
      } else {
        await ctx.database.create('ggcevo_player_weapons', {
          user_id: handle,
          weapon_id: weapon.id,
          weapon_name: weapon.name,
          weapon_level: 0,
          weapon_module: '',
          count: 1,
          purchased_at: now,
        })
      }

      return `✅ 购买成功！\n─────────────\n武器：${weapon.name}\n消耗：${weapon.price} 金币\n剩余：${goldCount - weapon.price} 金币\n剩余武器数量：1`
    })
}
