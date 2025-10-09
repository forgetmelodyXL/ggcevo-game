export const SyndicatedItems = {
  'E-2能量炸弹': {
    id: 1,
    type: '爆破物',
    description: '一种小型的机械装置，用于吸收空间站能量并进行爆破',
    price: 0,
    redCrystalCost: 0,
    condition: '空间站哨枪塔存活',
    effects: '对空间站哨枪塔造成其当前血量值的伤害(获得等同于伤害值的金币)',
  },
  '闪光弹': {
    id: 2,
    type: '手榴弹',
    description: '非致命军用炸药',
    price: 75,
    redCrystalCost: 0,
    condition: '无法对建筑目标，重型目标和具有免疫闪光技能的目标使用',
    effects: '使目标的技能层数减少10层',
  },
  'CRED-17': {
    id: 3,
    type: '设备工具',
    description: '一个小型辛迪加机器人，可以破坏电子银行账户',
    price: 0,
    redCrystalCost: 50,
    condition: '辛迪加海盗阵营',
    effects: '每日签到金币奖励+50%；可使用红晶升级',
  },
  '脉冲手雷': {
    id: 4,
    type: '手榴弹',
    description: '电磁脉冲干扰机械目标和灵能目标',
    price: 75,
    redCrystalCost: 0,
    condition: '无法对没有能量的目标使用',
    effects: '消耗目标500点能量',
  },
  'MP3播放器': {
    id: 5,
    type: '设备工具',
    description: '这是一款未来派音乐设备',
    price: 0,
    redCrystalCost: 20,
    condition: '辛迪加海盗阵营',
    effects: '主动发起的PK对战结果为失败时上交给对方的金币-50%',
  },
  '雷达面罩': {
    id: 6,
    type: '设备工具',
    description: '一个复杂的雷达面罩，用于远距离侦察或探测隐藏单位',
    price: 0,
    redCrystalCost: 20,
    condition: '辛迪加海盗阵营',
    effects: '使用武器攻击时，无视目标10%的减伤效果',
  },
  '气喇叭': {
    id: 7,
    type: '设备工具',
    description: '气喇叭一直被用于展示纯粹的勇气',
    price: 0,
    redCrystalCost: 30,
    condition: '辛迪加海盗阵营',
    effects: '主动发起的PK对战结果为胜利时将获得辛迪加海盗总部发放的等额抢夺金币作为奖励（最多额外获得200金币）',
  },
  '自动采掘机器人': {
    id: 8,
    type: '设备工具',
    description: '建造机器人，用于自动采集太空矿物',
    price: 0,
    redCrystalCost: 20,
    condition: '辛迪加海盗阵营',
    effects: '挖矿获得的金币收益提高10%；可使用红晶升级',
  },
  '莫洛托夫燃烧弹': {
    id: 9,
    type: '手榴弹',
    description: '一种轻型手榴弹，含有易燃物质',
    price: 0,
    redCrystalCost: 0,
    condition: '无法对免疫燃烧的目标和空中目标使用',
    effects: '使目标的燃烧层数增加5层',
  },
  '铝热炸弹': {
    id: 10,
    type: '爆破物',
    description: '铝热炸弹能够轻易破坏安全门',
    price: 0,
    redCrystalCost: 0,
    condition: '无法对空中目标使用',
    effects: '对目标造成100伤害；对建筑目标造成3倍伤害（目标血量最多降低至1点）',
  },
}
















export const initDefaultItems = {
  '咕咕币': { id: 1, type: '抽奖道具', description: '用于进行抽奖' },
  '兑换券': { id: 2, type: '兑换货币', description: '用于兑换赞助物品' },
  '扭蛋币': { id: 3, type: '抽奖道具', description: '用于进行宠物扭蛋' },
  't3级宠物扭蛋': { id: 4, type: '宠物蛋', description: '用于兑换t3系列宠物' },
  't2级宠物扭蛋': { id: 5, type: '宠物蛋', description: '用于兑换t2系列宠物' },
  't1级宠物扭蛋': { id: 6, type: '宠物蛋', description: '用于兑换t1系列宠物' },
  't0级宠物扭蛋': { id: 7, type: '宠物蛋', description: '用于兑换t0系列宠物' },
  '资源兑换券': { id: 8, type: '兑换货币', description: '用于兑换咕咕之战资源' },
  '🥇先行者赛季冠军勋章': { id: 101, type: '勋章', description: '' },
  '🥈先行者赛季亚军勋章': { id: 102, type: '勋章', description: '' },
  '🥉先行者赛季季军勋章': { id: 103, type: '勋章', description: '' },
  '🏅先行者赛季前十勋章': { id: 104, type: '勋章', description: '' },
  '🎖先行者赛季前二十勋章': { id: 105, type: '勋章', description: '' },
  '🥇S1赛季冠军勋章': { id: 106, type: '勋章', description: '' },
  '🥈S1赛季亚军勋章': { id: 107, type: '勋章', description: '' },
  '🥉S1赛季季军勋章': { id: 108, type: '勋章', description: '' },
  '🏅S1赛季前十勋章': { id: 109, type: '勋章', description: '' },
  '🎖S1赛季前二十勋章': { id: 110, type: '勋章', description: '' },
  '🥇S2赛季冠军勋章': { id: 111, type: '勋章', description: '' },
  '🥈S2赛季亚军勋章': { id: 112, type: '勋章', description: '' },
  '🥉S2赛季季军勋章': { id: 113, type: '勋章', description: '' },
  '🏅S2赛季前十勋章': { id: 114, type: '勋章', description: '' },
  '🎖S2赛季前二十勋章': { id: 115, type: '勋章', description: '' },
  '🥇S3赛季冠军勋章': { id: 116, type: '勋章', description: '' },
  '🥈S3赛季亚军勋章': { id: 117, type: '勋章', description: '' },
  '🥉S3赛季季军勋章': { id: 118, type: '勋章', description: '' },
  '🏅S3赛季前十勋章': { id: 119, type: '勋章', description: '' },
  '🎖S3赛季前二十勋章': { id: 120, type: '勋章', description: '' },
}

// 物品配置映射
export const itemConfig = {
  '拾荒者': { quality: 't3', type: '皮肤', cost: 3, quantity: 8, isLimited: false },
  '劳工': { quality: 't3', type: '皮肤', cost: 3, quantity: 8, isLimited: false },
  '老兵': { quality: 't2', type: '皮肤', cost: 4, quantity: 5, isLimited: false },
  '合成人': { quality: 't2', type: '皮肤', cost: 4, quantity: 5, isLimited: false },
  '阿斯塔特': { quality: 't1', type: '皮肤', cost: 5, quantity: 4, isLimited: false },
  '皇家指挥官': { quality: 't1', type: '皮肤', cost: 5, quantity: 4, isLimited: false },
  '个性开场白': { quality: 't1', type: '入场特效', cost: 5, quantity: 4, isLimited: false },
  '史蒂夫': { quality: 't0', type: '皮肤', cost: 6, quantity: 1, isLimited: true },
  'ep4': { quality: 't0', type: '物品', cost: 6, quantity: 3, isLimited: false },
  '小狗': { quality: 't3', type: '宠物', cost: 3, quantity: 6, isLimited: false },
  '小猫': { quality: 't3', type: '宠物', cost: 3, quantity: 6, isLimited: false },
  '小黄鸭': { quality: 't3', type: '宠物', cost: 3, quantity: 6, isLimited: false },
  '萌萌熊': { quality: 't2', type: '宠物', cost: 4, quantity: 5, isLimited: false },
  '荆棘蜥蜴': { quality: 't2', type: '宠物', cost: 4, quantity: 5, isLimited: false },
  '萌宠小狗': { quality: 't1', type: '宠物', cost: 5, quantity: 3, isLimited: false },
  '熔岩虫': { quality: 't1', type: '宠物', cost: 5, quantity: 3, isLimited: false },
  '尸甲虫': { quality: 't1', type: '宠物', cost: 5, quantity: 3, isLimited: false },
  '绿毛虫': { quality: 't0', type: '宠物', cost: 6, quantity: 2, isLimited: false },
  '妙蛙种子': { quality: 't0', type: '宠物', cost: 6, quantity: 2, isLimited: false },
  '皮卡丘': { quality: 't0', type: '宠物', cost: 6, quantity: 2, isLimited: false },
  '哆啦A梦': { quality: 't0', type: '宠物', cost: 6, quantity: 2, isLimited: false },
}