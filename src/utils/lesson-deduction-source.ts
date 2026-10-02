import type { MemberCardDetail } from '@/types/member-card';

/**
 * 点名消课「扣哪张卡」——前端唯一口径。
 *
 * ## 只有一本账
 *
 * 课时**全部记在会员卡**上。
 *
 * ## 口径（写死在这里，别处不再各挑一次）
 *
 * - 次数卡（`count`）—— 时间卡/储值卡没有"课时"概念；
 * - `status === 'active'` —— 未激活 / 冻结 / 已用完都不能扣；
 * - 可用剩余（`remainingCount + remainingGiftCount`）≥ 本节需要的课时；
 * - **科目匹配**：卡种科目 = 班级科目；班级没配科目时任意卡可用。
 *   科目不匹配的卡**绝不使用** —— 扣错科目等于把别的课的次数划掉。
 * - 都不满足 ⇒ 返回 `null`，由调用方提示"无可用课时"。
 */

export interface LessonDeductionSource {
  /** 会员卡 id（提交时对应 `member_card_id`） */
  id: string;
  /** 展示用名称（卡种名） */
  name: string;
}

/** 目标科目（id 与名称都可能藏在两代字段里，两个都给） */
export interface DeductionSubject {
  id?: string;
  name?: string;
}

const normalize = (value?: string) => (value ?? '').replace(/\s/g, '').trim();

/** 会员卡可用剩余（含赠送次数）；传 undefined 时算 0，调用方不必先判空 */
export function getMemberCardRemaining(card?: MemberCardDetail): number {
  return (card?.remainingCount ?? 0) + (card?.remainingGiftCount ?? 0);
}

/** 卡种科目是否匹配目标科目（id / 名称任一命中即可，兼容老数据只填名称） */
export function isCardSubjectMatched(card: MemberCardDetail, subject?: DeductionSubject): boolean {
  const targetId = normalize(subject?.id);
  const targetName = normalize(subject?.name);
  // 班级没配科目 ⇒ 不限制科目，任意卡可用
  if (!targetId && !targetName) return true;

  const cardSubjectId = normalize(card.cardTypeSubjectId);
  const cardSubjectName = normalize(card.cardTypeSubjectName);
  return (
    (!!cardSubjectId && (cardSubjectId === targetId || cardSubjectId === targetName)) ||
    (!!cardSubjectName && (cardSubjectName === targetId || cardSubjectName === targetName))
  );
}

/**
 * 挑一张可用于本次消课的会员卡；没有可用的返回 `null`。
 *
 * 排序：科目匹配优先，其次到期日早的（先到期先消耗），再到购买早的。
 */
export function pickMemberCardForLesson(
  cards: MemberCardDetail[],
  hoursNeeded: number,
  subject?: DeductionSubject,
): MemberCardDetail | null {
  const needed = Math.max(hoursNeeded, 1);
  const usable = (cards ?? []).filter(
    (card) =>
      card.status === 'active' &&
      card.cardTypeKind === 'count' &&
      getMemberCardRemaining(card) >= needed &&
      isCardSubjectMatched(card, subject),
  );
  if (usable.length === 0) return null;

  return (
    [...usable].sort((a, b) => {
      const aMatched = isCardSubjectMatched(a, { id: subject?.id, name: subject?.name }) ? 0 : 1;
      const bMatched = isCardSubjectMatched(b, { id: subject?.id, name: subject?.name }) ? 0 : 1;
      if (aMatched !== bMatched) return aMatched - bMatched;
      const aExpiry = a.expiredAt || '9999-12-31';
      const bExpiry = b.expiredAt || '9999-12-31';
      if (aExpiry !== bExpiry) return aExpiry.localeCompare(bExpiry);
      return (a.purchaseAt || '').localeCompare(b.purchaseAt || '');
    })[0] ?? null
  );
}

export interface ResolveDeductionInput {
  /** 该学员的会员卡（`memberCardService.getByStudent`） */
  memberCards?: MemberCardDetail[];
  hoursNeeded: number;
  subject?: DeductionSubject;
}

/**
 * 决定这次消课扣哪张卡。
 *
 * 返回 `null` = 没有可用课时（调用方按既有逻辑处理：报错或欠课）。
 */
export function resolveLessonDeduction(input: ResolveDeductionInput): LessonDeductionSource | null {
  const card = pickMemberCardForLesson(input.memberCards ?? [], input.hoursNeeded, input.subject);
  if (!card) return null;
  return { id: card.id, name: card.cardTypeName };
}

/**
 * 消课后的剩余，用于给家长的提示文案。
 *
 * **一律以后端返回的 `remaining_hours` 为准**（它就是扣减后的权威值）；拿不到才本地推算。
 */
export function resolveRemainingAfterDeduct(
  backendRemaining: number | null | undefined,
  card: MemberCardDetail | undefined,
  hoursUsed: number,
): number {
  if (backendRemaining != null) return backendRemaining;
  return Math.max(getMemberCardRemaining(card) - hoursUsed, 0);
}
