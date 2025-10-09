export const passiveConfig = {
  '异形甲壳': {
    description: '拥有厚重的甲壳，初始获得10%减伤效果，每损失1%最大生命值，额外获得1%减伤效果（最高80%减伤）',
    belong: ['异齿猛兽首领', '异齿猛兽'],
    derivedSkills: []
  },
  '冰霜回复': {
    description: '生命值≤30%时，立即回复自身40%最大生命值，并为所有其他存活异形回复10%最大生命值（生效后移除）',
    belong: ['冰蛇'],
    derivedSkills: []
  },
  '冰霜进化': {
    description: '免疫寒冷伤害，受到寒冷攻击时回复等量生命值',
    belong: ['寒冰王蛇', '冰蛇'],
    derivedSkills: []
  },
  '冰霜环绕': {
    description: '生命值≤30%时，立即回复自身45%最大生命值，清空自身燃烧层数，并使所有存活异形获得「寒霜地狱」技能（生效后移除）',
    belong: ['寒冰王蛇'],
    derivedSkills: ['寒霜地狱']
  },
  '寒霜地狱': {
    description: '受到的伤害降低30%',
    belong: [],
    derivedSkills: []
  },
  '应激甲壳I': {
    description: '受到的伤害降低20%',
    belong: ['狂暴畸变体', '剧毒畸变体'],
    derivedSkills: []
  },
  '应激甲壳II': {
    description: '受到的伤害降低25%',
    belong: ['莽兽'],
    derivedSkills: []
  },
  '求生本能I': {
    description: '濒死时立即回复自身30%最大生命值（生效后移除）',
    belong: ['狂暴畸变体', '剧毒畸变体'],
    derivedSkills: []
  },
  '求生本能II': {
    description: '濒死时立即回复自身50%最大生命值（生效后移除）',
    belong: ['莽兽'],
    derivedSkills: []
  },
  '冷适应': {
    description: '累计承受10次寒冷伤害后，获得「惧热」标签，免疫寒冷伤害并清空自身寒冷层数',
    belong: ['莽兽', '狂暴畸变体', '剧毒畸变体'],
    derivedSkills: []
  },
  '感染空间站': {
    description: '当空间站哨枪塔存活时，自身受到的伤害降低50%',
    belong: ['空间站感染虫'],
    derivedSkills: []
  },
  '病毒云': {
    description: '受到的伤害降低10%',
    belong: ['空间站感染虫', '机械感染虫'],
    derivedSkills: []
  },
  '霉菌滋生': {
    description: '受击后，若空间站哨枪塔存活，为其回复1%最大生命值',
    belong: ['空间站感染虫', '机械感染虫'],
    derivedSkills: []
  },
  '岗哨机枪': {
    description: '每累计承受10次攻击，为所有其他存活异形回复10%最大生命值',
    belong: ['空间站哨枪塔'],
    derivedSkills: []
  },
  '结构装甲': {
    description: '受实弹/能量武器伤害降低20%，受热能武器伤害降低40%',
    belong: ['空间站哨枪塔'],
    derivedSkills: []
  },
  '吸血唾液': {
    description: '受击获得1层「吸血唾液」(上限20层)，每层使受到的伤害降低5%',
    belong: ['吸血蝙蝠首领', '吸血蝙蝠'],
    derivedSkills: []
  },
  '进食': {
    description: '「吸血唾液」≥20层时，下次受击消耗所有层数并回复自身20%最大生命值',
    belong: ['吸血蝙蝠首领', '吸血蝙蝠'],
    derivedSkills: []
  },
  '嗜血狂暴': {
    description: '生命值≤50%时，受击额外获得1层「吸血唾液」且受到的伤害降低20%',
    belong: ['吸血蝙蝠首领'],
    derivedSkills: []
  },
  '吐血': {
    description: '无「吸血唾液」层数时，受到的伤害提高20%',
    belong: ['吸血蝙蝠首领', '吸血蝙蝠'],
    derivedSkills: []
  },
  '超导体': {
    description: '生命值≤10%时，护盾标签永久转换为重甲标签',
    belong: ['亚电主宰者', '亚电能者'],
    derivedSkills: []
  },
  '能量虹吸': {
    description: '生命值≥70%时伤害降低40%，30%-70%时伤害降低20%',
    belong: ['亚电能者'],
    derivedSkills: []
  },
  '能源虹吸': {
    description: '能量值≥80%时伤害降低50%，50%-80%时伤害降低30%',
    belong: ['亚电主宰者'],
    derivedSkills: []
  },
  '电能立场': {
    description: '能量值≥30%时，55%概率免疫非热能伤害（每层寒冷降低5%触发概率，最多降低50%）',
    belong: ['亚电主宰者'],
    derivedSkills: []
  },
  '电能冲击波': {
    description: '受击后回复100点能量',
    belong: ['亚电主宰者'],
    derivedSkills: []
  },
  '脉冲': {
    description: '能量值≥30%时，60%概率为所有存活异形回复100点生命（每层寒冷降低5%触发概率，最多降低50%）',
    belong: ['亚电主宰者'],
    derivedSkills: []
  },
  '能量黑洞': {
    description: '亚电主宰者释放了能量黑洞，所有存活异形受到的伤害降低20%',
    belong: ['亚电主宰者', '亚电能者'],
    derivedSkills: []
  },
  '火焰异形': {
    description: '免疫火焰伤害，受到火焰攻击时回复等量生命值',
    belong: ['烈焰庞兽', '火焰甲虫'],
    derivedSkills: []
  },
  '庞兽狂暴': {
    description: '生命值≤50%时，受到的伤害降低50%',
    belong: ['烈焰庞兽'],
    derivedSkills: []
  },
  '灼烧粘液': {
    description: '受击获得1层「灼烧粘液」（上限20层）；受火焰攻击时消耗所有层数并回复（层数×10）点生命',
    belong: ['烈焰庞兽', '火焰甲虫'],
    derivedSkills: []
  },
  '腐蚀胆汁': {
    description: '「灼烧粘液」≥10层时，下次受击消耗所有层数并为所有存活异形回复1000点生命',
    belong: ['火焰甲虫'],
    derivedSkills: []
  },
  '火焰吐息': {
    description: '「灼烧粘液」≥20层时，下次攻击消耗所有层数并为所有存活异形回复20%最大生命值',
    belong: ['烈焰庞兽'],
    derivedSkills: []
  },
  '太阳耀斑': {
    description: '所有子代阵亡后，移除惧寒标签和孤立无援状态，并清空自身寒冷层数(仅限一次）',
    belong: ['烈焰庞兽'],
    derivedSkills: []
  },
  '燃烧潜地': {
    description: '生命值≤10%时立即回复50%最大生命值（生效后移除）',
    belong: ['火焰甲虫'],
    derivedSkills: []
  },
  '炼狱爆弹': {
    description: '每层「灼烧粘液」使受到的伤害降低5%，子代存活时每层额外降低5%',
    belong: ['烈焰庞兽'],
    derivedSkills: []
  },
  '猎手异形': {
    description: '存在其他存活异形时伤害降低20%，无其他存活异形时伤害提高20%；免疫火焰伤害及寒冷伤害',
    belong: ['狂猎猛禽首领', '狂猎猛禽1', '狂猎猛禽2'],
    derivedSkills: []
  },
  '狂暴': {
    description: '生命值≤50%时，受到的伤害降低50%',
    belong: ['狂猎猛禽1', '狂猎猛禽2'],
    derivedSkills: []
  },
  '伪装': {
    description: '受击记录伤害来源武器名称，下次被同名武器攻击时伤害降低80%',
    belong: ['狂猎猛禽首领', '狂猎猛禽1', '狂猎猛禽2'],
    derivedSkills: []
  },
  '致命一击': {
    description: '受击时5%概率免疫该次伤害',
    belong: ['狂猎猛禽首领'],
    derivedSkills: []
  },
  '星界之风': {
    description: '受击时5%概率为所有存活异形回复200点生命',
    belong: ['宇宙界主', '宇宙战将'],
    derivedSkills: []
  },
  '心灵狂热': {
    description: '生命值<50%时伤害降低20%且「星界之风」触发概率翻倍',
    belong: ['宇宙战将'],
    derivedSkills: []
  },
  '宇宙能量': {
    description: '受击回复等量能量值，能量溢出时转换为生命回复',
    belong: ['宇宙界主'],
    derivedSkills: []
  },
  '复苏': {
    description: '免疫致命伤害，回复60%最大生命与100%能量值，并获得「灵能构造炉」技能（生效后移除）',
    belong: ['宇宙界主'],
    derivedSkills: ['灵能构造炉']
  },
  '光影之刃': {
    description: '受击获得1层「光影之刃」(上限50层)',
    belong: ['宇宙界主'],
    derivedSkills: []
  },
  '远古预兆': {
    description: '受击时1%概率免疫非热能伤害并回复100点能量，每层「光影之刃」使触发概率提升0.5%',
    belong: ['宇宙界主'],
    derivedSkills: []
  },
  '超视距穿梭': {
    description: '能量≥60%时每层「光影之刃」使伤害降低10%，30%-60%时每层降低5%，能量≤10%时每层提高5%',
    belong: ['宇宙界主'],
    derivedSkills: []
  },
  '灵能构造炉': {
    description: '受击时5%概率随机获得以下技能之一：天启超载护盾/塌缩脉冲/地毯式轰炸/轰炸引导',
    belong: [],
    derivedSkills: ['天启超载护盾', '塌缩脉冲', '地毯式轰炸', '轰炸引导']
  },
  '天启超载护盾': {
    description: '受击时10%概率触发，消耗当前「光影之刃」层数的一半（向下取整），并为所有存活异形回复（消耗层数×10）点生命',
    belong: [],
    derivedSkills: []
  },
  '塌缩脉冲': {
    description: '受击后额外获得1层「光影之刃」',
    belong: [],
    derivedSkills: []
  },
  '地毯式轰炸': {
    description: '移除孤立无援状态，受到的伤害降低80%',
    belong: [],
    derivedSkills: []
  },
  '轰炸引导': {
    description: '受击时10%概率触发，消耗当前「光影之刃」层数的一半（向下取整），并回复（消耗层数×10）点能量',
    belong: [],
    derivedSkills: []
  },
  '毒性唾液': {
    description: '受击获得1层「毒性唾液」(上限20层)，每层使受到的伤害降低5%',
    belong: ['猛毒异兽', '剧毒蝙蝠'],
    derivedSkills: []
  },
  '剧毒狂暴': {
    description: '生命值≤50%时，受击额外获得1层「毒性唾液」且受到的伤害降低20%',
    belong: ['猛毒异兽'],
    derivedSkills: []
  },
  '毒气波': {
    description: '受击时，有20%概率获得5层「毒性唾液」',
    belong: ['猛毒异兽', '剧毒蝙蝠'],
    derivedSkills: []
  },
  '淬毒撕咬': {
    description: '「毒性唾液」≥5层时，受击会回复50点生命值；「毒性唾液」≥10层时，受击会回复100点生命值；「毒性唾液」≥15层时，受击会回复150点生命值',
    belong: ['猛毒异兽', '剧毒蝙蝠'],
    derivedSkills: []
  },
  '酸蚀池': {
    description: '每次受击将会从3种酸液中顺序选择一种释放（脓蚀酸池：受到实弹武器伤害降低50%，受到能量武器伤害提高50%；蚀骨酸池：受到能量武器伤害降低50%，受到热能武器伤害提高50%；焦熔酸池：受到热能武器的伤害降低50%，受到实弹武器伤害提高50%）',
    belong: ['猛毒异兽', '剧毒蝙蝠'],
    derivedSkills: []
  },
  '剧毒突袭': {
    description: '「毒性唾液」≥20层时，受击消耗所有层数并强化下5次触发的「酸蚀池」（武器类型对应的增伤和减伤效果翻倍）',
    belong: ['猛毒异兽'],
    derivedSkills: []
  },
  '虫巢思维': {
    description: '每有一只巢穴子代，则受到的伤害降低20%；巢穴子代受到的伤害提高20%',
    belong: ['虫群女王'],
    derivedSkills: []
  },
  '爆虫伏击': {
    description: '血量低于50%时，立即孵化巢穴子代直至上限（生效后移除）',
    belong: ['虫群女王'],
    derivedSkills: []
  },
  '虚弱喷吐': {
    description: '当孵化场存活时，受到的伤害降低80%',
    belong: ['虫群女王'],
    derivedSkills: []
  },
  '治愈虫群': {
    description: '血量低于30%时，立即回复自身40%点生命值，同时回复所有其他存活异形10%点生命值（生效后移除）',
    belong: ['虫群女王'],
    derivedSkills: []
  },
  '释放信息素': {
    description: '所有存活的异形受到的伤害降低20%',
    belong: ['虫群女王'],
    derivedSkills: []
  },
  '恐吓尖啸': {
    description: '每受到10次攻击，如果没有存活的巢穴子代，则随机孵化1只巢穴子代（巢穴雷兽，巢穴战士，巢穴甲虫）',
    belong: ['虫群女王'],
    derivedSkills: []
  },
  '孵化': {
    description: '每受到10次攻击，如果没有存活的巢穴子代，则随机孵化1只巢穴子代（巢穴雷兽，巢穴战士，巢穴甲虫）',
    belong: ['孵化场'],
    derivedSkills: []
  },
  '基因变异': {
    description: '移除孤立无援状态；每次受击叠加1层「基因变异」（上限100层）；每次受击回复100点能量；每受击3次随机获得1个基因技能，累计获得4个基因技能后再次触发则移除全部基因技能',
    belong: ['坏兄弟'],
    derivedSkills: [
      '优化冗余片段', '开天眼', '环境适应', '加快分化',
      '耐力强化', '稳定DNA', '增厚甲壳', '质粒增殖',
      '加速代谢', '组织增生', '模仿生物签名'
    ]
  },
  '优化冗余片段': {
    description: '免疫辐射伤害；清空自身的辐射层数',
    belong: [],
    derivedSkills: []
  },
  '开天眼': {
    description: '免疫闪光弹',
    belong: [],
    derivedSkills: []
  },
  '环境适应': {
    description: '免疫火焰伤害和寒冷伤害；清空自身寒冷层数和燃烧层数',
    belong: [],
    derivedSkills: []
  },
  '加快分化': {
    description: '每次受击回复X点血量（X为「基因变异」层数的一半并向下取整 x 5）',
    belong: [],
    derivedSkills: []
  },
  '耐力强化': {
    description: '当能量≥80%时，受到的伤害降低80%；当能量≥50%时，受到的伤害降低50%；当能量≥30%时，受到的伤害降低30%',
    belong: [],
    derivedSkills: []
  },
  '稳定DNA': {
    description: '伤害来源的武器不受标签影响',
    belong: [],
    derivedSkills: []
  },
  '增厚甲壳': {
    description: '每层「基因变异」使受到的伤害降低1%',
    belong: [],
    derivedSkills: []
  },
  '质粒增殖': {
    description: '免疫脉冲手雷',
    belong: [],
    derivedSkills: []
  },
  '加速代谢': {
    description: '每次受击叠加X层「基因变异」（X为当前拥有的基因技能数量）',
    belong: [],
    derivedSkills: []
  },
  '组织增生': {
    description: '每层「基因变异」使护甲值临时提高0.1点',
    belong: [],
    derivedSkills: []
  },
  '模仿生物签名': {
    description: '受击时1%概率免疫该次伤害，每层「基因变异」提高1%的概率',
    belong: [],
    derivedSkills: []
  },
  '冰悚嚎叫': {
    description: '血量低于50%后，受到的伤害降低30%',
    belong: ['寒冰王蛇'],
    derivedSkills: []
  },
}