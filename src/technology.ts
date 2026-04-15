// 科技配置
export const Spacestationtechnology = [
  {
    techId: 1,
    techname: '采掘系统',
    careerNames: ['深空矿工', '情报副官'], // 新增职业名称字段
    maxLevel: 5,
    levels: [
      {
        level: 1,
        cost: 500,
        description: '提高挖矿效率，获得的收益提高10%',
        careerBonus: '挖矿的收益额外提高10%'
      },
      {
        level: 2,
        cost: 1750,
        description: '提高挖矿效率，获得的收益提高20%',
        careerBonus: '挖矿的收益额外提高20%'
      },
      {
        level: 3,
        cost: 2950,
        description: '提高挖矿效率，获得的收益提高30%',
        careerBonus: '挖矿的收益额外提高30%'
      },
      {
        level: 4,
        cost: 4250,
        description: '提高挖矿效率，获得的收益提高40%',
        careerBonus: '挖矿的收益额外提高40%'
      },
      {
        level: 5,
        cost: 5375,
        description: '提高挖矿效率，获得的收益提高50%',
        careerBonus: '挖矿的收益额外提高50%，并且单次挖矿时间上限增加至48小时'
      },
    ]
  },
  {
    techId: 2,
    techname: '武器系统',
    careerNames: ['武器中士', '情报副官'], // 新增职业名称字段
    maxLevel: 5,
    levels: [
      {
        level: 1,
        cost: 500,
        description: '提升空间站武器等级，购买I类及以下武器享有25%的折扣',
        careerBonus: '购买I类及以下武器额外享有25%的折扣'
      },
      {
        level: 2,
        cost: 1500,
        description: '提升空间站武器等级，购买II类及以下武器享有25%的折扣',
        careerBonus: '购买II类及以下武器额外享有25%的折扣'
      },
      {
        level: 3,
        cost: 2550,
        description: '提升空间站武器等级，购买III类武器享有25%的折扣',
        careerBonus: '购买III类及以下武器额外享有25%的折扣'
      },
      {
        level: 4,
        cost: 3950,
        description: '提升空间站武器等级，购买IV类及以下武器享有25%的折扣',
        careerBonus: '购买IV类及以下武器额外享有25%的折扣'
      },
      {
        level: 5,
        cost: 4650,
        description: '提升空间站武器等级，购买V类及以下武器享有25%的折扣; 获得传奇武器购买权限1次',
        careerBonus: '购买V类及以下武器额外享有25%的折扣; 升级武器享有20%的折扣'
      },
    ]
  },
  {
    techId: 3,
    techname: '武器升级平台',
    careerNames: ['武器中士', '情报副官'],
    maxLevel: 2,
    levels: [
      {
        level: 1,
        cost: 750,
        description: '重启武器升级站，武器改装通用模块享有5%的折扣',
        careerBonus: '武器改装通用模块额外享有5%的折扣'
      },
      {
        level: 2,
        cost: 1000,
        description: '重启高级武器改装站，武器改装通用模块享有5%的折扣; 武器改装专属模块享有5%的折扣',
        careerBonus: '武器改装通用模块额外享有5%的折扣; 武器改装专属模块额外享有5%的折扣'
      },
    ]
  },
  {
    techId: 4,
    techname: '安防系统',
    careerNames: ['警卫员下士', '警卫长', '情报副官'], // 新增职业名称字段
    maxLevel: 5,
    levels: [
      {
        level: 1,
        cost: 500,
        description: '重启安防参数代码，攻击获得的金币+5%',
        careerBonus: '攻击获得的金币额外+5%'
      },
      {
        level: 2,
        cost: 2050,
        description: '提高空间站安防系统强度，攻击获得的金币+10%',
        careerBonus: '攻击获得的金币额外+10%'
      },
      {
        level: 3,
        cost: 3250,
        description: '进一步提高空间站安防系统强度，攻击获得的金币+15%',
        careerBonus: '攻击获得的金币额外+15%'
      },
      {
        level: 4,
        cost: 4250,
        description: '大幅提高空间站安防系统强度，攻击获得的金币+20%',
        careerBonus: '攻击获得的金币额外+20%'
      },
      {
        level: 5,
        cost: 5350,
        description: '完全恢复空间站安防系统，攻击获得的金币+25%',
        careerBonus: '攻击获得的金币额外+25%; 获得解锁军械库防爆门权限1次，可以随机获得一把传奇武器'
      },
    ]
  },
  {
    techId: 5,
    techname: '关键系统固件',
    careerNames: ['舰长', '情报副官'], // 新增职业名称字段
    maxLevel: 5,
    levels: [
      {
        level: 1,
        cost: 500,
        description: '升级空间站关键系统，完成任务奖励+5%',
        careerBonus: '完成任务奖励额外+5%'
      },
      {
        level: 2,
        cost: 1250,
        description: '升级空间站关键系统，完成任务奖励+10%',
        careerBonus: '完成任务奖励额外+10%'
      },
      {
        level: 3,
        cost: 2250,
        description: '升级空间站关键系统，完成任务奖励+15%',
        careerBonus: '完成任务奖励额外+15%'
      },
      {
        level: 4,
        cost: 2950,
        description: '升级空间站关键系统，完成任务奖励+20%',
        careerBonus: '完成任务奖励额外+20%'
      },
      {
        level: 5,
        cost: 3550,
        description: '升级空间站关键系统，完成任务奖励+25%',
        careerBonus: '完成任务奖励额外+25%；签到金币奖励+100%'
      },
    ]
  },
  {
    techId: 6,
    techname: '反应堆',
    careerNames: ['总工程师', '情报副官'], // 新增职业名称字段
    maxLevel: 5,
    levels: [
      {
        level: 1,
        cost: 500,
        description: '升级空间站聚变反应堆控制，探索的金币收益提高10%',
        careerBonus: '探索的金币收益额外提高10%'
      },
      {
        level: 2,
        cost: 1450,
        description: '升级空间站聚变反应堆控制，探索的金币收益提高20%',
        careerBonus: '探索的金币收益额外提高20%'
      },
      {
        level: 3,
        cost: 2950,
        description: '升级空间站聚变反应堆控制，探索的金币收益提高30%',
        careerBonus: '探索的金币收益额外提高30%'
      },
      {
        level: 4,
        cost: 4250,
        description: '升级空间站聚变反应堆控制，探索的金币收益提高40%',
        careerBonus: '探索的金币收益额外提高40%'
      },
      {
        level: 5,
        cost: 5350,
        description: '升级空间站聚变反应堆控制，探索的金币收益提高50%',
        careerBonus: '探索的金币收益额外提高50%；探索的物品获得概率提高20%'
      },
    ]
  },
]





export const itemupgrades = [
  {
    name: '自动采掘机器人',
    upgradeCostBase: 10, // 升级基础成本
    minUpgrade: 5, // 每次升级最小提升
    maxUpgrade: 15, // 每次升级最大提升
    maxBonus: 90, // 总提升上限
  },
  {
    name: 'CRED-17',
    upgradeCostBase: 10,
    minUpgrade: 5,
    maxUpgrade: 15,
    maxBonus: 50,
  },
]