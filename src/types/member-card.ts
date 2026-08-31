/**
 * 会员卡记录（学员购买的某个卡种实例）
 */

import type { CardTypeKind } from './card-type';

/** 会员卡状态 */
export type MemberCardStatus = 'active' | 'inactive' | 'usedUp' | 'notActivated' | 'frozen';

/** 会员卡记录 */
export interface MemberCard {
  id: string;
  /** 关联卡种 ID */
  cardTypeId: string;
  /** 关联卡种名称 */
  cardTypeName: string;
  /** 关联学员 ID */
  studentId: string;
  /** 学员姓名 */
  studentName: string;
  /** 学员头像 */
  studentAvatar?: string;
  /** 学员手机号 */
  studentPhone?: string;
  /** 会员卡状态 */
  status: MemberCardStatus;
  /** 剩余次数（次卡） */
  remainingCount?: number;
  /** 剩余天数（时间卡） */
  remainingDays?: number;
  /** 剩余金额（储值卡，分） */
  remainingAmount?: number;
  /** 购买时间 */
  purchaseAt: string;
  /** 开卡时间 */
  activatedAt?: string;
  /** 到期时间 */
  expiredAt?: string;
  /** 已冻卡次数 */
  frozenCount: number;
  /** 已冻卡天数 */
  frozenDays: number;
  /** 购买价（分） */
  purchasePrice: number;
  /** 开卡来源 */
  source?: string;
  /** 操作人 ID（开卡老师，账单可查） */
  operatorId?: string;
  /** 操作人名称（开卡/发卡人） */
  operatorName?: string;
  /** 操作人头像 */
  operatorAvatar?: string;
  /** 会员卡号 */
  cardNo?: string;
  /** 备注 */
  remark?: string;
}

/** 会员卡详情（含卡种模板信息，用于列表/详情展示） */
export interface MemberCardDetail extends MemberCard {
  /** 卡种类型 */
  cardTypeKind: CardTypeKind;
  /** 卡种总次数（次卡） */
  cardTypeCount?: number;
  /** 卡种有效天数 */
  cardTypeValidDays: number;
  /** 卡种可冻卡总次数 */
  cardTypeFreezeCount: number;
  /** 卡种可冻卡总天数 */
  cardTypeFreezeDays: number;
  /** 卡权限（如：普通课程卡、VIP卡） */
  cardPermission?: string;
  /** 发卡场馆/校区 */
  campusName?: string;
  /** 赠送总次数（次卡） */
  totalGiftCount?: number;
  /** 赠送剩余次数（次卡） */
  remainingGiftCount?: number;
  /** 已耗卡价值（分） */
  consumedValue?: number;
  /** 剩余价值（分） */
  remainingValue?: number;
  /** 归属员工 */
  ownerName?: string;
  /** 卡片权益说明 */
  cardBenefits?: string;
  /** 备注 */
  remark?: string;
}

/** 卡种统计维度 */
export type CardTypeStatKey = 'sold' | 'inUse' | 'usedUp' | 'notActivated' | 'frozen';

/** 统计维度标签 */
export const CARD_TYPE_STAT_LABELS: Record<CardTypeStatKey, string> = {
  sold: '已售',
  inUse: '在用',
  usedUp: '用完',
  notActivated: '未开卡',
  frozen: '冻卡/停卡',
};
