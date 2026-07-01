import { Schema } from 'koishi'

export interface CareerSkill {
  name: string
  description: string
  // 技能效果：百分比加成（正数为增益，负数为减益）
  effect?: (baseValue: number) => number
}

export interface Career {
  id: string
  name: string
  faction: 'human' | 'syndicate'
  description: string
  skills: CareerSkill[]
}

export const careers: Career[] = [
  // ===== 人类阵营 =====
  {
    id: 'deep_miner',
    name: '深空矿工',
    faction: 'human',
    description: '在宇宙深处挖掘珍贵矿藏的专业人员。',
    skills: [
      {
        name: '高效采矿',
        description: '挖矿产生的收益 +50%',
        effect: (baseValue: number) => baseValue * 1.5,
      },
    ],
  },
  // TODO: 添加其他人类职业...

  // ===== 辛迪加海盗阵营 =====
  {
    id: 'energy_weapon_expert',
    name: '能量武器专家',
    faction: 'syndicate',
    description: '精通各类能量武器的辛迪加海盗。',
    skills: [
      {
        name: '能量精通',
        description: '能量武器伤害 +20%',
        effect: (baseValue: number) => baseValue * 1.2,
      },
    ],
  },
  // TODO: 添加其他辛迪加海盗职业...
]

export const CareerSchema = Schema.object({
  careerId: Schema.string().description('职业 ID'),
})
