/**
 * 课表卡片纯判定测试（Q2-1）
 *
 * 原先覆盖的「卡片操作可见性」一组函数已随课表卡片左滑一并删除，
 * 只保留历史课 / 未开课判定。
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { isHistoricalClassCard, isUpcomingClassCard } from '@/utils/schedule-card-actions';

const NOW = dayjs('2026-09-02T10:00:00');

describe('isHistoricalClassCard / isUpcomingClassCard', () => {
  it('历史与未开课判定', () => {
    expect(isHistoricalClassCard('upcoming', NOW.subtract(1, 'day'), NOW)).toBe(true);
    expect(isHistoricalClassCard('done', NOW, NOW)).toBe(true);
    expect(isHistoricalClassCard('upcoming', NOW, NOW)).toBe(false);
    expect(isUpcomingClassCard('upcoming')).toBe(true);
    expect(isUpcomingClassCard('urgent')).toBe(true);
    expect(isUpcomingClassCard('active')).toBe(false);
  });
});
