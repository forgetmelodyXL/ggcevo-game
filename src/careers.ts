import { Context } from 'koishi'
import { weaponConfig } from './weapons'
import { SyndicatedItems } from './items'

// 空间站船员职业配置项
export const spaceStationCrewConfig = [
  {
    professionName: '深空矿工',
    effect: '挖矿的金币收益提高50%',
    costcoins: 2000,
  },
  {
    professionName: '警卫员下士',
    effect: 'HP上限增加50点；攻击获得的金币+25%',
    costcoins: 2000,
  },
  {
    professionName: '警卫长',
    effect: 'HP上限增加25点；攻击伤害+5%；攻击获得的金币+25%',
    costcoins: 3000,
  },
  {
    professionName: '武器中士',
    effect: '攻击伤害+15%；购买任意武器享有25%的折扣',
    costcoins: 3000,
  },
  {
    professionName: '医疗专家',
    effect: '',
    costcoins: 2000,
  },
  {
    professionName: '情报副官',
    effect: '升级空间站科技享有10%的折扣',
    costcoins: 3000,
  },
  {
    professionName: '总工程师',
    effect: '探索获得的金币收益提高50%；探索的成功率提高10%',
    costcoins: 2000,
  },
  {
    professionName: '舰长',
    effect: '完成任务奖励+50%',
    costcoins: 2000,
  },
  {
    professionName: '机械化专家',
    effect: '机甲形态攻击伤害+50%',
    costcoins: 3000,
  },
]

// 辛迪加海盗职业配置项
export const syndicatePirateConfig = [
  {
    professionName: '能量武器专家',
    effect: '能量武器攻击伤害+20%',
    costredcrystal: 30,
  },
  {
    professionName: '清洁工',
    effect: '每次攻击额外获得1枚红晶',
    costredcrystal: 20,
  },
  {
    professionName: '枪手',
    effect: '武器等级上限为7级; 升级武器享有10%的折扣',
    costredcrystal: 40,
  },
  {
    professionName: '猩红杀手',
    effect: '“侦察步枪”攻击伤害+15%; 使用“侦察步枪”攻击时每1点护甲改为减少0点伤害',
    costredcrystal: 30,
  },
  {
    professionName: '纵火狂',
    effect: '热能武器攻击伤害+20%; 探索获得莫洛托夫燃烧弹的概率提高20%并且有10%的概率额外获得1个；使用莫洛托夫燃烧弹的效果提高100%',
    costredcrystal: 30,
  },
  {
    professionName: '辛迪加财务经理',
    effect: '每日签到额外获得3枚红晶',
    costredcrystal: 20,
  },
  {
    professionName: '计算机专家',
    effect: '黑市订购设备工具类享有50%折扣；PK时的胜率+10%',
    costredcrystal: 20,
  },
  {
    professionName: '指挥官',
    effect: '',
    costredcrystal: 30,
  },
  {
    professionName: '装甲兵',
    effect: '',
    costredcrystal: 40,
  },
  {
    professionName: '破坏者',
    effect: '黑市订购爆破物类享有50%折扣；探索获得爆破物的概率提高20%并且有10%的概率额外获得1个；使用爆破物的效果提高50%',
    costredcrystal: 30,
  },
  {
    professionName: '征募官',
    effect: '',
    costredcrystal: 20,
  },
]