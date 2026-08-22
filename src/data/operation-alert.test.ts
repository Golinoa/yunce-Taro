/**
 * 课时不足预警「触发即提醒一次」去重规则回归测试
 * 覆盖用户口径（2026-08-22）：
 * - 扣课时后剩余降到阈值（默认 5）→ 立即触发一次
 * - 同一学员同一轮预警不重复推送（duplicate）
 * - 剩余回升（撤销/充值）清除记录后，再次下降可重新触发
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkThresholdAlert,
  resetStudentAlert,
  isStudentAlerted,
  __resetOperationAlertsForTest,
} from '@/data/operation-alert';
import { setAlertThreshold, DEFAULT_ALERT_THRESHOLD_HOURS } from '@/utils/alert-config';

describe('课时不足预警触发与去重', () => {
  beforeEach(() => {
    __resetOperationAlertsForTest();
    setAlertThreshold(DEFAULT_ALERT_THRESHOLD_HOURS); // 默认 5
  });

  it('剩余降到阈值（≤5）首次触发 → triggered，并记录已提醒', () => {
    expect(checkThresholdAlert('s1', 5)).toBe('triggered');
    expect(isStudentAlerted('s1')).toBe(true);
  });

  it('同一年级再次进入（剩余仍在阈值内）→ duplicate，不重复推送', () => {
    checkThresholdAlert('s1', 5);
    expect(checkThresholdAlert('s1', 4)).toBe('duplicate');
    expect(checkThresholdAlert('s1', 0)).toBe('duplicate');
  });

  it('剩余高于阈值 → none，不触发也不记录', () => {
    expect(checkThresholdAlert('s2', 6)).toBe('none');
    expect(isStudentAlerted('s2')).toBe(false);
  });

  it('剩余 0 为强制提醒：阈值设为 0 时仍触发', () => {
    setAlertThreshold(0);
    expect(checkThresholdAlert('s3', 0)).toBe('triggered');
  });

  it('剩余回升（reset）后再次降到阈值 → 可重新触发新一轮预警', () => {
    checkThresholdAlert('s1', 5);
    expect(checkThresholdAlert('s1', 3)).toBe('duplicate');
    resetStudentAlert('s1'); // 充值/撤销回补后剩余回升
    expect(isStudentAlerted('s1')).toBe(false);
    expect(checkThresholdAlert('s1', 4)).toBe('triggered'); // 新一轮
  });
});
