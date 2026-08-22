/**
 * 会员卡记录 Mock 数据
 */
import { COURSE_PACKAGES, type CoursePackage } from '@/data/mock-database';
import type { CardType } from '@/types/card-type';
import type { CardTypeStatKey, MemberCard, MemberCardDetail } from '@/types/member-card';

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
  return MOCK_MEMBER_CARDS.filter((item) => item.studentId === studentId);
};

/**
 * 根据会员卡 ID 查询详情
 */
export const mockGetMemberCardById = async (id: string): Promise<MemberCardDetail | null> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return MOCK_MEMBER_CARDS.find((item) => item.id === id) || null;
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

  // 打通：次卡剩余次数调整 → 同步学员课包剩余课时（差额法，避免覆盖消课已扣减值）
  if (updated.cardTypeKind === 'count' && data.remainingCount !== undefined && updated.studentId) {
    const pkg = COURSE_PACKAGES.find(
      (p) => p.studentId === updated.studentId && p.name.includes('会员卡'),
    );
    if (pkg) {
      const diff = (data.remainingCount || 0) - (prev.remainingCount || 0);
      pkg.remainingHours = Math.max((pkg.remainingHours || 0) + diff, 0);
      pkg.usedHours = Math.max((pkg.totalHours || 0) - pkg.remainingHours, 0);
      if (pkg.remainingHours <= 0) pkg.status = 'finished';
    }
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
