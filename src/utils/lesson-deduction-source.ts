/**
 * 点名消课「扣哪本账」——前端唯一口径。
 *
 * ## 背景
 *
 * 系统里有两本账：旧课包（遗留，已封存写入口但存量还在消耗）和会员卡（新账本）。
 * 点名页此前**只找旧课包** ⇒ 只有会员卡的学员拿不到可用课时，直接点不了名
 * （2026-10-02 本地库实测：11 个在册学员里 5 个属于这种情况）。
 *
 * ## 口径（写死在这里，别处不再各挑一次）
 *
 * 1. **旧课包优先**：只要该学员有可用的旧课包，行为与改前**完全一致**（零回归）；
 * 2. 没有旧课包才找会员卡，且必须满足：
 *    - 次数卡（`count`）—— 时间卡/储值卡没有"课时"概念；
 *    - `status === 'active'` —— 未激活 / 冻结 / 已用完都不能扣；
 *    - 可用剩余（`remainingCount + remainingGiftCount`）≥ 本节需要的课时；
 *    - **科目匹配**：卡种科目 = 班级科目；班级没配科目时任意卡可用。
 *      科目不匹配的卡**绝不使用** —— 扣错科目等于把别的课的次数划掉。
 * 3. 都没找到 ⇒ 返回 `null`，由调用方按既有逻辑提示"无可用课时"。
 */

import type { CoursePackage } from '@/types/course-package';
import type { MemberCardDetail } from '@/types/member-card';
import { pickBestPackage } from '@/utils/package-helper';

export interface LessonDeductionSource {
  kind: 'memberCard' | 'package';
  /** 旧课包 id 或会员卡 id（提交时分别对应 package_id / memberCardId） */
  id: string;
  /** 展示用名称 */
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
  /** 该学员可用的旧课包（`packageService.getActiveByStudent`） */
  packages?: CoursePackage[];
  /** 该学员的会员卡（`memberCardService.getByStudent`） */
  memberCards?: MemberCardDetail[];
  hoursNeeded: number;
  subject?: DeductionSubject;
}

/**
 * 决定这次消课扣哪本账：旧课包优先，没有才用会员卡。
 *
 * 返回 `null` = 两本账都没有可用课时（调用方按既有逻辑处理：报错或欠课）。
 */
export function resolveLessonDeduction(input: ResolveDeductionInput): LessonDeductionSource | null {
  const { packages, memberCards, hoursNeeded, subject } = input;

  /**
   * ⚠️ **旧课包这条路径必须与改前逐字等价**：调用 `pickBestPackage` 时**不传科目**。
   *
   * 调用方给的 `subject` 是"这一节要上的科目"（有时是班级科目、有时是学员课包科目），
   * 而 `pickBestPackage(pkgs, hours, subjectId)` 的第二优先级会用科目挑包 ——
   * 传进去等于**悄悄改变了存量选包结果**（同一个学员可能被换着扣不同的包），
   * 而本节要修的只是"没有旧课包时用会员卡"。科目匹配只用于**挑会员卡**。
   */
  const pkg = pickBestPackage(packages ?? [], hoursNeeded);
  if (pkg) return { kind: 'package', id: pkg.id, name: pkg.name };

  const card = pickMemberCardForLesson(memberCards ?? [], hoursNeeded, subject);
  if (card) return { kind: 'memberCard', id: card.id, name: card.cardTypeName };

  return null;
}

/**
 * 消课后的剩余，用于给家长的提示文案。
 *
 * **一律以后端返回的 `remaining_hours` 为准**（它就是扣减后的权威值）；
 * 拿不到时才本地推算，且必须按"这一笔实际扣的是哪本账"算：
 * 用课包余额推算、却拿会员卡的余额去减，会把家长通知里的数字写错。
 */
export function resolveRemainingAfterDeduct(
  backendRemaining: number | null | undefined,
  source: LessonDeductionSource,
  pkg: CoursePackage | undefined,
  card: MemberCardDetail | undefined,
  hoursUsed: number,
): number {
  if (backendRemaining != null) return backendRemaining;
  if (source.kind === 'package') {
    return Math.max((pkg?.remaining_hours ?? 0) - hoursUsed, 0);
  }
  return Math.max(getMemberCardRemaining(card) - hoursUsed, 0);
}
