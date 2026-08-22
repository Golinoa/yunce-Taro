/**
 * 会员卡记录 Mock 数据
 */
import { COURSE_PACKAGES, type CoursePackage } from '@/data/mock-database';
import type { CardType } from '@/types/card-type';
import type { CardTypeStatKey, MemberCard, MemberCardDetail } from '@/types/member-card';

/**
 * 会员卡剩余次数（次卡）派生：以关联课包 remainingHours 之和为准（单一数据源），
 * 消除「只写不读」导致的课后失同步（L-11-A）；无关联课包时回退存储值（兼容历史种子数据）。
 */
function deriveRemainingCount(card: MemberCardDetail): number {
  if (card.cardTypeKind !== 'count') return card.remainingCount ?? 0;
  const linked = COURSE_PACKAGES.filter((p) => p.memberCardId === card.id);
  if (linked.length === 0) return card.remainingCount ?? 0;
  return linked.reduce((sum, p) => sum + (p.remainingHours || 0), 0);
}

/** 写回会员卡剩余次数（保持存储与派生一致） */
function syncCardRemainingCount(card: MemberCardDetail): MemberCardDetail {
  card.remainingCount = deriveRemainingCount(card);
  return card;
}

const MOCK_MEMBER_CARDS: MemberCardDetail[] = [
  {
    id: 'mc_001',
    cardTypeId: 'card-001',
    cardTypeName: '美术素描年卡',
    cardTypeKind: 'count',
    cardTypeCount: 40,
    cardTypeValidDays: 380,
    cardTypeFreezeCount: 20,
    cardTypeFreezeDays: 20,
    studentId: 'stu-001',
    studentName: '张小明',
    studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=张小明',
    studentPhone: '13800001101',
    status: 'active',
    remainingCount: 32,
    purchaseAt: '2026-07-17 08:40',
    activatedAt: '2026-07-17 08:40',
    expiredAt: '2027-08-20',
    frozenCount: 0,
    frozenDays: 0,
    purchasePrice: 298000,
    source: '发套餐卡',
    operatorName: '李老师',
    operatorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Li',
  },
  {
    id: 'mc_002',
    cardTypeId: 'card-002',
    cardTypeName: '硬笔书法年卡',
    cardTypeKind: 'count',
    cardTypeCount: 40,
    cardTypeValidDays: 380,
    cardTypeFreezeCount: 20,
    cardTypeFreezeDays: 20,
    studentId: 'stu-002',
    studentName: '赵小红',
    studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=赵小红',
    studentPhone: '13800001102',
    status: 'active',
    remainingCount: 40,
    purchaseAt: '2026-07-17 08:40',
    activatedAt: '2026-07-17 08:40',
    expiredAt: '2027-08-20',
    frozenCount: 0,
    frozenDays: 0,
    purchasePrice: 0,
    source: '发套餐卡',
    operatorName: '发套餐卡【#】',
    cardNo: '11LPN72JIOG',
    cardPermission: '普通课程卡',
    campusName: '盛睿艺术',
    totalGiftCount: 0,
    remainingGiftCount: 0,
    consumedValue: 0,
    remainingValue: 0,
    ownerName: '',
    cardBenefits: '可参加硬笔书法常规班课程，含材料费',
    remark: '年卡套餐，含免费冻卡 20 次',
  },
  {
    id: 'mc_003',
    cardTypeId: 'card-004',
    cardTypeName: '30天舞蹈月卡',
    cardTypeKind: 'time',
    cardTypeValidDays: 30,
    cardTypeFreezeCount: 0,
    cardTypeFreezeDays: 0,
    studentId: 'stu-003',
    studentName: '李子轩',
    studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=李子轩',
    studentPhone: '13800001103',
    status: 'active',
    remainingDays: 12,
    purchaseAt: '2026-07-20 14:00',
    activatedAt: '2026-07-20 14:00',
    expiredAt: '2026-08-19',
    frozenCount: 0,
    frozenDays: 0,
    purchasePrice: 99000,
    source: '小程序购买',
    operatorName: '前台小张',
  },
  {
    id: 'mc_004',
    cardTypeId: 'card-005',
    cardTypeName: '综合储值卡',
    cardTypeKind: 'stored',
    cardTypeValidDays: 365,
    cardTypeFreezeCount: 0,
    cardTypeFreezeDays: 0,
    studentId: 'stu-004',
    studentName: '陈雨萱',
    studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=陈雨萱',
    studentPhone: '13800001104',
    status: 'active',
    remainingAmount: 65400,
    purchaseAt: '2026-06-15 09:30',
    activatedAt: '2026-06-15 09:30',
    expiredAt: '2027-06-15',
    frozenCount: 0,
    frozenDays: 0,
    purchasePrice: 100000,
    source: '前台充值',
    operatorName: '前台小李',
  },
];

/**
 * 根据卡种 ID 与统计维度查询会员卡记录
 */
export const mockGetMemberCardsByCardType = async (
  cardTypeId: string,
  stat: CardTypeStatKey,
): Promise<MemberCardDetail[]> => {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300));

  const list = MOCK_MEMBER_CARDS.filter((item) => item.cardTypeId === cardTypeId);
  list.forEach((c) => syncCardRemainingCount(c));

  switch (stat) {
    case 'sold':
      return list;
    case 'inUse':
      return list.filter((item) => item.status === 'active');
    case 'usedUp':
      return list.filter((item) => item.status === 'usedUp');
    case 'notActivated':
      return list.filter((item) => item.status === 'notActivated');
    case 'frozen':
      return list.filter((item) => item.status === 'frozen');
    default:
      return list;
  }
};

/**
 * 根据学员 ID 查询会员卡记录
 */
export const mockGetMemberCardsByStudent = async (
  studentId: string,
): Promise<MemberCardDetail[]> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return MOCK_MEMBER_CARDS.filter((item) => item.studentId === studentId).map(syncCardRemainingCount);
};

/**
 * 根据会员卡 ID 查询详情
 */
export const mockGetMemberCardById = async (id: string): Promise<MemberCardDetail | null> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const card = MOCK_MEMBER_CARDS.find((item) => item.id === id);
  return card ? syncCardRemainingCount(card) : null;
};

/**
 * 更新会员卡信息
 */
export const mockUpdateMemberCard = async (
  id: string,
  data: Partial<MemberCardDetail>,
): Promise<MemberCardDetail | null> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const index = MOCK_MEMBER_CARDS.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const prev = MOCK_MEMBER_CARDS[index];
  MOCK_MEMBER_CARDS[index] = { ...prev, ...data };
  const updated = MOCK_MEMBER_CARDS[index];

  // 打通：次卡剩余次数调整 → 同步关联课包剩余课时（L-11 修复）
  // 以 memberCardId 稳定外键关联，放弃脆弱的 name.includes('会员卡') 字符串匹配（L-11-B）；
  // 差额法 + 不变量约束：增次视为充值（totalHours 与 remainingHours 同步增长，usedHours 单向派生不被钳零，L-11-C）。
  if (updated.cardTypeKind === 'count' && data.remainingCount !== undefined) {
    const target = data.remainingCount || 0;
    const linked = COURSE_PACKAGES.filter((p) => p.memberCardId === updated.id);
    if (linked.length > 0) {
      const currentRemaining = linked.reduce((s, p) => s + (p.remainingHours || 0), 0);
      const delta = target - currentRemaining;
      if (delta > 0) {
        // 充值：总量与剩余同步增长，usedHours 保持不变（不变量：usedHours = totalHours - remainingHours）
        const primary = linked[0];
        primary.totalHours = (primary.totalHours || 0) + delta;
        primary.remainingHours = (primary.remainingHours || 0) + delta;
      } else if (delta < 0) {
        // 减次：按 FIFO 从各关联课包扣减剩余，clamp 到 [0, totalHours]
        let toCut = -delta;
        for (const p of linked) {
          if (toCut <= 0) break;
          const cut = Math.min(toCut, p.remainingHours || 0);
          p.remainingHours = (p.remainingHours || 0) - cut;
          toCut -= cut;
        }
      }
      // 不变量收口：usedHours 单向派生 + 用尽即 finished
      for (const p of linked) {
        p.usedHours = Math.max((p.totalHours || 0) - (p.remainingHours || 0), 0);
        if ((p.remainingHours || 0) <= 0) p.status = 'finished';
      }
    }
    // 回写派生后的剩余次数，保持存储与读取一致
    updated.remainingCount = deriveRemainingCount(updated);
  }

  return updated;
};

/** 生成唯一会员卡 ID */
function generateMemberCardId(): string {
  return `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 根据卡种类型计算初始剩余值 */
function getInitialRemaining(cardType: CardType): {
  remainingCount?: number;
  remainingDays?: number;
  remainingAmount?: number;
} {
  if (cardType.kind === 'count') {
    return { remainingCount: cardType.count };
  }
  if (cardType.kind === 'time') {
    return { remainingDays: cardType.validDays };
  }
  return {};
}

/**
 * 为学员发放会员卡
 */
export const mockIssueMemberCard = async (
  data: Omit<
    MemberCard,
    'id' | 'status' | 'purchaseAt' | 'activatedAt' | 'expiredAt' | 'frozenCount' | 'frozenDays'
  > & { cardType: CardType },
): Promise<MemberCardDetail> => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const { cardType, ...base } = data;
  const now = new Date();
  const purchaseAt = now.toISOString().replace('T', ' ').slice(0, 16);
  const expiredAt = cardType.validDays
    ? new Date(now.getTime() + cardType.validDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : undefined;

  const remaining = getInitialRemaining(cardType);

  const card: MemberCardDetail = {
    id: generateMemberCardId(),
    status: 'active',
    purchaseAt,
    activatedAt: purchaseAt,
    expiredAt,
    frozenCount: 0,
    frozenDays: 0,
    cardTypeKind: cardType.kind,
    cardTypeCount: cardType.count,
    cardTypeValidDays: cardType.validDays,
    cardTypeFreezeCount: cardType.freezeCount,
    cardTypeFreezeDays: cardType.freezeDays,
    ...remaining,
    ...base,
  };

  MOCK_MEMBER_CARDS.unshift(card);

  // 打通：次卡发卡同步为学员创建课包（学员"剩余课时/次数"与会员卡联动）
  if (cardType.kind === 'count' && (cardType.count || 0) > 0 && base.studentId) {
    const count = cardType.count || 0;
    const pkg: CoursePackage = {
      id: `pkg-${Date.now()}`,
      studentId: base.studentId,
      classId: '',
      name: `${cardType.name}（会员卡）`,
      memberCardId: card.id,
      type: 'hour_package',
      subjectId: '',
      totalHours: count,
      purchasedHours: count,
      bonusHours: 0,
      usedHours: 0,
      remainingHours: count,
      pricePerHour: cardType.price ? Math.round(cardType.price / count) : 0,
      totalAmount: cardType.price || 0,
      paymentMethod: 'wechat',
      status: 'active',
      purchaseDate: purchaseAt.split(' ')[0],
      expireDate: expiredAt,
    };
    COURSE_PACKAGES.push(pkg);
  }

  return card;
};
