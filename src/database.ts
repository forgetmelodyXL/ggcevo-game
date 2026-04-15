declare module 'koishi' {
  interface Tables {
    ggcevo_backpack: Backpack
    ggcevo_sign: SignRecord
    ggcevo_welfare: WelfareClaim
    ggcevo_activity: ActivityInfo
    ggcevo_rank: RankRecord
    ggcevo_exchange: ExchangeLog
    ggcevo_adminbenefit: AdminBenefit
    ggcevo_player_stats: PlayerStats
    ggcevo_pk_logs: PKLogs
    ggcevo_weapons: WeaponInventory
    ggcevo_boss: BossInfo
    ggcevo_boss_weights: bossweights
    ggcevo_tech: TechProgress
    ggcevo_task: TaskProgress
  }
}

export interface Backpack {
  handle: string
  itemId: number
  quantity: number
}

export interface SignRecord {
  handle: string
  name: string // 玩家名称
  lastSign: Date
  monthlyDays: number
  totalRewards: number
  totalPulls: number
  pityCounter: number
  fullPityCount: number
  bigPrizeCount: number
  faction: string // 阵营的英文字段
  career: string // 职业
  redcrystal: number // 红水晶
  syndicateCareer: string // 辛迪加职业
  hp: number // HP值
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
  endTime: Date
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

export interface PlayerStats {
  handle: string
  total: number
  wins: number
  todayCount: number
  lastPK: Date
  totalDamage: number
  attackCount: number
  lastattackDate: Date
  wishname: string
  wishUsed: boolean
  lastWishDate: Date
  miningStartTime: Date
  totalMined: number
  spaceshipId: number
  exploreStartTime: Date
  galaxy: string
  exploreSuccessCount: number
  plunderBonus: number
  totalExploreGold: number
  totalExploreItems: number
  buff: number[]
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









export interface TechProgress {
  handle: string
  techId: number
  level: number
}

export interface TaskProgress {
  handle: string
  taskId: number
  progress: number
  Completions: number
}















export interface bossweights {
  groupId: number
  weight: number
  lastSpawn: Date
}


