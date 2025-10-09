export const spaceship = {
    'TX-12星际巡洋舰': {
        id: 1,
        description: 'TX-12是为商业用途开发的标准通用星际巡洋舰',
        miningbonus: 5,
        explorebonus: 0,
        effect: '',
        price: 500,
    },
    'TX-12S隐形巡洋舰': {
        id: 2,
        description: 'TX-12S是标准星际巡洋舰的改型',
        miningbonus: 10,
        explorebonus: 5,
        effect: '探索的成功率提高10%；当掠夺金币加成≤0时，探索不会被掠夺',
        price: 1500,
    },
    'TX-12A突击巡洋舰': {
        id: 3,
        description: 'TX-12S是标准星际巡洋舰的改型',
        miningbonus: 0,
        explorebonus: 20,
        effect: '探索的成功率提高20%；探索发生掠夺的概率提高10%；掠夺其他飞船的成功率提高10%',
        price: 2000,
    },
    '庞兽号歼星舰': {
        id: 4,
        description: '巨兽级歼星舰的小型化版本',
        miningbonus: 0,
        explorebonus: 30,
        effect: '探索的成功率提高60%；探索发生掠夺的概率提高30%；掠夺其他飞船的成功率提高30%；被其他飞船掠夺的成功率降低30%',
        price: 6000,
    },
}

export const galaxy = {
    '联盟星系': {
        description: '这一片都是人类联盟的地区，但是并非一切都很安全',
        success: 0.6,
        bonus: 0,
        available: ['闪光弹', '脉冲手雷'], // 使用中文名称数组
        effect: '人类联盟阵营探索时成功率提高10%',
    },
    '辛迪加星系': {
        description: '这一片都是辛迪加海盗的地区，充满欺诈与混乱',
        success: 0.4,
        bonus: 0.2, // 金币加成系数（1.2表示+20%）
        available: ['闪光弹', '脉冲手雷'],
        effect: '辛迪加海盗阵营探索时成功率提高10%',
    },
    '陨石星系': {
        description: '这一片星系有着大量的陨石，充满了危险，但可能存在一些有价值的资源',
        success: 0.4,
        bonus: 0,
        available: ['闪光弹', '脉冲手雷', '莫洛托夫燃烧弹', '铝热炸弹'],
        effect: '获得物品的概率提高10%',
    },
}