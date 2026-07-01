export type DamageType = '实弹' | '能量' | '魔法'
export type WeaponCategory = '实弹武器' | '能量武器' | '热能武器'
export type ArmorInteraction = 'ignore' | 'reduce' | 'pierce' | 'bypass'
export type TargetType = '地面' | '空中' | '全部'

export interface WeaponTagEffect {
  // 应用标签，如 '轻甲'、'重甲'
  tag: string
  // 伤害倍率
  damageMultiplier: number
}

export interface WeaponSkill {
  name: string
  description: string
}

export interface Weapon {
  id: string
  name: string
  damageType: DamageType
  weaponCategory: WeaponCategory
  techLevel: number               // 武器科技等级
  baseDamage: number             // 基础伤害
  armorInteraction: ArmorInteraction  // 护甲交互方式：ignore=无视，reduce=减少，pierce=穿透，bypass=绕过
  armorReduction?: number         // 护甲每点减少的伤害（仅 armorInteraction=reduce 时使用）
  description: string
  skills: WeaponSkill[]          // 特殊技能
  price: number                 // 金币价格
  redCrystalPrice: number | null // 红晶价格，null 表示不可用红晶购买
  canAttackAir: boolean          // 是否可以攻击空中目标
  tagEffects: WeaponTagEffect[]  // 标签特性效果
}

export const weapons: Weapon[] = [
  // ===== 1级武器科技 =====
  {
    id: 'gauss_rifle',
    name: '高斯步枪',
    damageType: '实弹',
    weaponCategory: '实弹武器',
    techLevel: 1,
    baseDamage: 13,
    armorInteraction: 'reduce',
    armorReduction: 1,
    description: '标准配置武器，中距离作战利器。',
    skills: [],
    price: 100,
    redCrystalPrice: null,
    canAttackAir: true,
    tagEffects: [
      { tag: '轻甲', damageMultiplier: 1.5 },
    ],
  },
  // TODO: 添加更多武器...

]

export const WeaponSchema = {
  weaponId: {
    type: 'string',
    description: '武器 ID',
  },
}
