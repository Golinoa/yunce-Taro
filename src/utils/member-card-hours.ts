/**
 * 次数卡的「总课时」统一口径 —— **单一事实源**。
 *
 * 背景（B3）：此前 3 处各写一份算法且互相矛盾：
 *   · 卡详情   = cardTypeCount - totalGiftCount（赠课越多显示越少，疑似 bug）
 *   · 卡编辑   = cardTypeCount
 *   · 卡包面板 = cardTypeCount（不含后充的赠课 ⇒ 低估）
 *
 * 口径（2026-09-26 用户确认）：**总课时含赠课** = cardTypeCount + totalGiftCount。
 * 不变式：发卡时 `remainingCount = 卡种次数`、`totalGiftCount = 开卡赠送`；
 * 追加时两者同步累加 ⇒ 总课时 = 发卡初值 + Σ(买入 + 赠送)。
 *
 * `totalCount` 是由发卡 / 追加 / 迁移链路维护的**快照**——卡种模板可被编辑，
 * 实时取卡种会让存量卡的「共 X 次」跟着漂移；历史卡为空 ⇒ 回落上述公式（与快照等价）。
 */
import type { MemberCardDetail } from '@/types/member-card';

export const getMemberCardTotalCount = (
  card: Pick<MemberCardDetail, 'totalCount' | 'cardTypeCount' | 'totalGiftCount' | 'cardTypeKind'>,
): number | undefined => {
  // 非次数卡（储值/月卡等）没有「共 X 次」概念
  if (card.cardTypeKind !== 'count') return undefined;
  // 快照优先（发卡/追加链路维护，不受卡种模板编辑影响）
  if (typeof card.totalCount === 'number') return card.totalCount;
  // 历史卡回落：卡种次数 + 累计赠送
  if (card.cardTypeCount == null) return undefined;
  return card.cardTypeCount + (card.totalGiftCount ?? 0);
};

/**
 * 次数卡的「**付费部分**总次数」（不含赠送）—— 单一事实源。
 *
 * 与「总课时含赠课」是**两个不同口径**，别混用：
 *   · 展示「共 X 次」、统计学员总课时 ⇒ 用 `getMemberCardTotalCount()`（含赠课）；
 *   · 算退费、算"购卡剩余" ⇒ 用本函数（赠送的课时不折现）。
 *
 * ⚠️ 2026-09-26 review 修复：此前退费公式**混用了两个口径** ——
 * 分子取 `remainingCount`（**含**赠课剩余）、分母取 `cardTypeCount - totalGiftCount`（**不含**赠课），
 * 导致比例可能 > 1（例：卡种 10 次 + 赠 5 次全未用 ⇒ 15/5 = 300% ⇒ **退费金额是实付的 3 倍**）。
 */
export const getMemberCardPaidTotalCount = (
  card: Pick<MemberCardDetail, 'totalCount' | 'cardTypeCount' | 'totalGiftCount' | 'cardTypeKind'>,
): number | undefined => {
  if (card.cardTypeKind !== 'count') return undefined;
  const total = getMemberCardTotalCount(card);
  if (total == null) return undefined;
  return Math.max(total - (card.totalGiftCount ?? 0), 0);
};

/**
 * 次数卡的「付费部分**剩余**次数」—— 与详情页「购卡剩余」展示同一口径。
 *
 * 用「付费总次数 − 已消耗」而非 `remainingCount`（后者含赠送剩余），
 * 保证比例恒 ≤ 1，退费不会超过实付。
 */
export const getMemberCardPaidRemainingCount = (
  card: Pick<
    MemberCardDetail,
    'totalCount' | 'cardTypeCount' | 'totalGiftCount' | 'consumedValue' | 'cardTypeKind'
  >,
): number | undefined => {
  const paidTotal = getMemberCardPaidTotalCount(card);
  if (paidTotal == null) return undefined;
  return Math.max(paidTotal - (card.consumedValue ?? 0), 0);
};
