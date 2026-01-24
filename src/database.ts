declare module 'koishi' {
  interface Tables {
    ggcevo_backpack: Backpack
    ggcevo_sign: SignRecord
    ggcevo_welfare: WelfareClaim
    ggcevo_activity: ActivityInfo
    ggcevo_rank: RankRecord
    ggcevo_punishment: PunishmentRecord
    ggcevo_exchange: ExchangeLog
    ggcevo_adminbenefit: AdminBenefit
    ggcevo_blacklist: Blacklist
    ggcevo_pk: PKProfile
    ggcevo_pk_logs: PKLogs
    ggcevo_weapons: WeaponInventory
    ggcevo_boss: BossInfo
    ggcevo_boss_damage: BossDamage
    ggcevo_damage_logs: damageLogs
    ggcevo_boss_weights: bossweights
    ggcevo_wish: WishRecord
    ggcevo_careers: CareerInfo
    ggcevo_warehouse: Warehouse
    ggcevo_tech: TechProgress
    ggcevo_Mining: MiningRecord
    ggcevo_task: TaskProgress
    ggcevo_permissions: Permissions
    ggcevo_pk_protection: PKProtection
    ggcevo_spaceship: spaceship
    ggcevo_explore: explore
    ggcevo_global_stats: GlobalStats
    ggcevo_guess: guess


    roulettes: Roulette
    roulette_groups: RouletteGroup


  }
}

export interface Backpack {
  handle: string
  itemId: number
  quantity: number
}

export interface SignRecord {
  handle: string
  lastSign: Date
  monthlyDays: number
  totalRewards: number
  totalPulls: number
  pityCounter: number
  fullPityCount: number
  bigPrizeCount: number
}

export interface WelfareClaim {
  handle: string
  activity: number
  lastdate: Date
}

export interface ActivityInfo {
  id: number
  name: string
  description: string
  itemId: number
  quantity: number
  startTime: Date
  endTime: Date
  creator: string
  status: '未开始' | '进行中' | '已结束'
}

export interface RankRecord {
  handle: string
  name: string
  rank: number
  wins: number
  matches: number
  rankseason: string
  Blacklist: boolean
}

export interface PunishmentRecord {
  id: number
  handle: string
  qq: string
  level: string
  reason: string
  count: number
  reviewer: string
  date: Date
  comment?: string
}

export interface ExchangeLog {
  userId: string
  handle: string
  item: string
  type: string
  date: Date
  GlobalLimit: boolean
  season: string
}

export interface AdminBenefit {
  userId: string
  handle: string
  signmonth: number
  lastSign: Date
}

export interface Blacklist {
  handle: string
  name: string
  createdAt: Date
}

export interface PKProfile {
  handle: string
  name: string
  total: number
  wins: number
  todayCount: number
  lastPK: Date
  enable: boolean
  lastToggle: Date
}

export interface PKLogs {
  id: number
  initiator_handle: string
  target_handle: string
  date: Date
}

export interface WeaponInventory {
  handle: string
  weaponId: number
  level: number
  modificationSlots: number
  installedMods: string[]
  equipped: boolean
  comboCount: number // 新增：记录连续攻击次数的计数器
  pityCounter: number
}

export interface BossInfo {
  name: string
  groupId: number
  type: string
  HP: number
  energy: number
  armorReductionLayers: number
  tags: string[]
  skills: string[]
  skillStacks: number
  skillStatus: number   // 新增：表示技能当前的状态值
  statusLayers: number
  radiationLayers: number
  coldLayers: number
  burnLayers: number
  lastWeaponName: string
  isActive: boolean
  respawnTime: Date
}

export interface BossDamage {
  handle: string
  playerName: string
  totalDamage: number
  attackCount: number
  bossGroupId: number
  lastattackDate: Date
}

export interface WishRecord {
  id: number
  handle: string
  wishname: string
  startTime: Date
  endTime: Date
  isused: boolean
}

export interface CareerInfo {
  handle: string
  group: string
  career: string
  redcrystal: number
  date: Date
}

export interface Warehouse {
  handle: string
  itemId: number
  quantity: number
  bonus: number
  upgrades: number
}

export interface TechProgress {
  handle: string
  techId: number
  level: number
}

export interface MiningRecord {
  handle: string
  startTime: Date
  totalMined: number
}

export interface TaskProgress {
  handle: string
  taskId: number
  progress: number
  Completions: number
}

export interface Permissions {
  handle: string
  legendarypermissions: number
  explosiondoorauthority: number
}

export interface PKProtection {
  id: number // 自增ID（主键）
  handle: string // 用户唯一标识
  startTime: Date // 保护起始时间
  endTime: Date // 保护结束时间
  /**
   * 保护状态（建议添加）
   * active - 保护中
   * expired - 已过期
   * canceled - 手动取消
   */
  status: 'active' | 'expired' | 'canceled'
}

export interface spaceship {
  handle: string
  id: number
  createTime: Date
}

export interface explore {
  handle: string
  name: string
  startTime: Date
  galaxy: string
  returns: number
  plunderbonus: number
  status: string
}

// 新增的全局量表接口
export interface GlobalStats {
  groupId: string
  updatedAt: Date
  rankdate: Date
}

export interface guess {
  handle: string
  name: string
  itemId: number
  guessContent: string
  amount: number
  wins: number
  createdAt: Date
}

export interface damageLogs {
  id: number
  handle: string
  date: Date
}

export interface bossweights {
  bossId: number
  weight: number
  lastSpawn: Date
}




export interface Roulette {
  id: number
  items: string[]
}

export interface RouletteGroup {
  id: number
  name: string
  items: number[]
}

