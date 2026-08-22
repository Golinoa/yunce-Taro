/**
 * 运营预警「课时不足」规则回归测试
 * 覆盖用户口径（2026-08-22）：
 * - 常规提醒：剩余课时 ≤ 阈值（默认 5）→ 触发预警
 * - 强制提醒：剩余 0 课时（最后一节课用完）→ 阈值设为 0 时仍必须触发
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { mockGetOperationAlerts } from '@/data/statistics';
import {
  setAlertThreshold,
  getAlertThreshold,
  DEFAULT_ALERT_THRESHOLD_HOURS,
} from '@/utils/alert-config';

describe('运营预警「课时不足」规则', () => {
  beforeEach(() => {
    // 重置为默认阈值
    setAlertThreshold(DEFAULT_ALERT_THRESHOLD_HOURS);
  });

  it('默认阈值为 5 课时', () => {
    expect(DEFAULT_ALERT_THRESHOLD_HOURS).toBe(5);
    expect(getAlertThreshold()).toBe(5);
  });

  it('常规提醒：剩余课时 ≤ 阈值（默认 5）触发预警', async () => {
    setAlertThreshold(5);
    const alerts = await mockGetOperationAlerts();
    const opAlert = alerts.find((a) => a.type === 'operation' && a.id !== 'op-stable');
    expect(opAlert).toBeTruthy();
    // 预警明细里剩余课时最大的学员 ≤ 5（"已用尽"按剩余 0 计）
    const maxRemaining = Math.max(
      ...opAlert!.details.map((d) => {
        const m = /剩余 (\d+) 课时/.exec(d.info);
        if (m) return Number(m[1]);
        return d.info.includes('已用尽') ? 0 : Infinity;
      }),
    );
    expect(maxRemaining).toBeLessThanOrEqual(5);
  });

  it('强制提醒：阈值设为 0 时，剩余 0 课时的学员仍必须出现在预警中', async () => {
    setAlertThreshold(0);
    const alerts = await mockGetOperationAlerts();
    const opAlert = alerts.find((a) => a.type === 'operation' && a.id !== 'op-stable');
    // 剩余 0 课时的学员被强制提醒（info 文案为"课时已用尽"）
    expect(opAlert).toBeTruthy();
    expect(opAlert!.details.some((d) => d.info.includes('已用尽'))).toBe(true);
    // 且预警标题体现"已用尽"
    expect(opAlert!.title).toContain('已用尽');
  });

  it('阈值调大（如 100）时预警覆盖更多学员（含剩余 0 的）', async () => {
    setAlertThreshold(100);
    const alerts = await mockGetOperationAlerts();
    const opAlert = alerts.find((a) => a.type === 'operation' && a.id !== 'op-stable');
    expect(opAlert).toBeTruthy();
    // 排序后剩余 0 的最前，且显示"已用尽"
    expect(opAlert!.details[0]?.info.includes('已用尽')).toBe(true);
  });
});
