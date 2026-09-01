/**
 * 个人中心店铺管理 / 系统管理入口标签约束（走查验收真源）
 */

/** 店铺管理中禁止再出现的入口 */
export const PROFILE_STORE_FORBIDDEN_LABELS = ['约课规则', '学员转校'] as const;

/** 系统管理中禁止再出现的入口（改由首页校区卡片切换身份） */
export const PROFILE_SYSTEM_FORBIDDEN_LABELS = ['切换身份'] as const;

export function assertProfileMenuLabels(labels: string[]): {
  ok: boolean;
  forbidden: string[];
} {
  const forbidden = [...PROFILE_STORE_FORBIDDEN_LABELS, ...PROFILE_SYSTEM_FORBIDDEN_LABELS].filter(
    (label) => labels.includes(label),
  );
  return { ok: forbidden.length === 0, forbidden };
}
