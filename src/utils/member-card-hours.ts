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
