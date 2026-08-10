/**
 * 主营业态分类配置
 * 用于校区详情页「主营业态」多选标签选择
 */

export interface BusinessSubCategory {
  /** 子项唯一标识 */
  id: string;
  /** 子项显示名称 */
  name: string;
}

export interface BusinessCategory {
  /** 主项唯一标识 */
  id: string;
  /** 主项显示名称 */
  name: string;
  /** 子项列表（为空表示该主项无子项） */
  children: BusinessSubCategory[];
}

/** 已选营业态：主项 ID + 该主项下选中的子项 ID 列表 */
export interface SelectedBusinessCategory {
  categoryId: string;
  subIds: string[];
}

/**
 * 全量主营业态列表
 * 来源：产品提供的业态标签表
 */
export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  {
    id: 'fitness',
    name: '健身',
    children: [
      { id: 'fitness_gym', name: '综合健身房' },
      { id: 'fitness_pt', name: '健身私教工作室' },
      { id: 'fitness_cf', name: 'CrossFit (CF)' },
      { id: 'fitness_hyrox', name: 'HYROX' },
    ],
  },
  {
    id: 'yoga',
    name: '瑜伽',
    children: [
      { id: 'yoga_normal', name: '瑜伽' },
      { id: 'yoga_pilates', name: '普拉提' },
      { id: 'yoga_aerial', name: '空中瑜伽' },
    ],
  },
  {
    id: 'art',
    name: '艺术',
    children: [
      { id: 'art_dance', name: '舞蹈' },
      { id: 'art_fine', name: '美术' },
      { id: 'art_music', name: '音乐' },
      { id: 'art_calligraphy', name: '书法/国画' },
      { id: 'art_speech', name: '口才/表演' },
    ],
  },
  {
    id: 'martial',
    name: '武道',
    children: [
      { id: 'martial_bjj', name: '柔术(BJJ)' },
      { id: 'martial_judo', name: '柔道' },
      { id: 'martial_karate', name: '空手道' },
      { id: 'martial_taekwondo', name: '跆拳道' },
      { id: 'martial_boxing', name: '拳击' },
      { id: 'martial_muaythai', name: '泰拳' },
      { id: 'martial_mma', name: '综合格斗(MMA)' },
      { id: 'martial_wrestling', name: '摔跤' },
      { id: 'martial_sanda', name: '散打' },
      { id: 'martial_wushu', name: '中国武术' },
      { id: 'martial_weapon', name: '持械格斗（击剑/兵击）' },
    ],
  },
  {
    id: 'fitness_kids',
    name: '体能',
    children: [
      { id: 'fitness_kids_normal', name: '儿童体能' },
      { id: 'fitness_kids_sensory', name: '感统训练' },
      { id: 'fitness_kids_exam', name: '体考体测' },
    ],
  },
  {
    id: 'steam',
    name: '科创',
    children: [
      { id: 'steam_robot', name: '机器人' },
      { id: 'steam_coding', name: '少儿编程' },
      { id: 'steam_drone', name: '无人机' },
      { id: 'steam_science', name: '科学实验' },
    ],
  },
  {
    id: 'chess',
    name: '棋类',
    children: [
      { id: 'chess_go', name: '围棋' },
      { id: 'chess_chinese', name: '中国象棋' },
      { id: 'chess_international', name: '国际象棋' },
    ],
  },
  {
    id: 'ball',
    name: '球类',
    children: [
      { id: 'ball_basketball', name: '篮球' },
      { id: 'ball_football', name: '足球' },
      { id: 'ball_badminton', name: '羽毛球' },
      { id: 'ball_pingpong', name: '乒乓球' },
      { id: 'ball_tennis', name: '网球' },
      { id: 'ball_volleyball', name: '排球' },
      { id: 'ball_golf', name: '高尔夫' },
      { id: 'ball_billiards', name: '台球' },
      { id: 'ball_baseball', name: '棒垒球' },
    ],
  },
  {
    id: 'water',
    name: '水上',
    children: [
      { id: 'water_swim', name: '游泳' },
      { id: 'water_dive', name: '潜水' },
      { id: 'water_sail', name: '帆船/皮划艇' },
      { id: 'water_surf', name: '冲浪/桨板' },
    ],
  },
  {
    id: 'ice',
    name: '冰雪',
    children: [
      { id: 'ice_skate', name: '滑冰' },
      { id: 'ice_ski', name: '滑雪' },
      { id: 'ice_hockey', name: '冰球' },
    ],
  },
  {
    id: 'skate',
    name: '轮滑',
    children: [
      { id: 'skate_roller', name: '轮滑' },
      { id: 'skate_board', name: '滑板' },
    ],
  },
  {
    id: 'outdoor',
    name: '户外',
    children: [
      { id: 'outdoor_camp', name: '营地/研学' },
      { id: 'outdoor_climb', name: '攀岩' },
      { id: 'outdoor_cycling', name: '骑行' },
      { id: 'outdoor_archery', name: '射箭' },
    ],
  },
  {
    id: 'academic',
    name: '学科',
    children: [],
  },
  {
    id: 'equestrian',
    name: '马术',
    children: [],
  },
  {
    id: 'other',
    name: '其他',
    children: [],
  },
] as const;

/** 主项 ID → 主项名称 映射 */
export const BUSINESS_CATEGORY_MAP: Record<string, string> = BUSINESS_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.id] = category.name;
    return acc;
  },
  {} as Record<string, string>,
);

/** 子项 ID → 子项名称 映射 */
export const BUSINESS_SUB_CATEGORY_MAP: Record<string, string> = BUSINESS_CATEGORIES.reduce(
  (acc, category) => {
    category.children.forEach((child) => {
      acc[child.id] = child.name;
    });
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * 将已选营业态格式化为展示文本
 * 规则：
 * - 有子项的主项，展示为「主项·子项」
 * - 无子项的主项，仅展示主项名
 * - 多个用「; 」分隔
 */
export function formatBusinessCategories(selected: SelectedBusinessCategory[]): string {
  if (!selected.length) return '';

  const parts = selected
    .map((item) => {
      const category = BUSINESS_CATEGORIES.find((c) => c.id === item.categoryId);
      if (!category) return '';

      if (!category.children.length) {
        return category.name;
      }

      if (!item.subIds.length) {
        return category.name;
      }

      return item.subIds
        .map((subId) => {
          const sub = category.children.find((c) => c.id === subId);
          return sub ? `${category.name}·${sub.name}` : '';
        })
        .filter(Boolean)
        .join('；');
    })
    .filter(Boolean);

  return parts.join('；');
}
