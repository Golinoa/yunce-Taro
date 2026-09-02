import { describe, expect, it } from 'vitest';
import { LESSON_OPERATE_WINDOW_DAYS } from '@/utils/schedule-guard';
import { getLessonRecordPriority, isWithinLessonOperateWindow } from './lesson-operate';

describe('lesson-operate helpers (Q2-2)', () => {
  it('30 天窗口内外', () => {
    const now = new Date('2026-09-02T12:00:00');
    expect(isWithinLessonOperateWindow('2026-08-10', now)).toBe(true);
    expect(isWithinLessonOperateWindow('2026-07-01', now)).toBe(false);
  });

  it('窗口边界日含端点；空串/非法日期放行（与实现一致）', () => {
    const now = new Date('2026-09-02T12:00:00');
    // earliest = now 日初 - 30 天 = 2026-08-03
    expect(LESSON_OPERATE_WINDOW_DAYS).toBe(30);
    expect(isWithinLessonOperateWindow('2026-08-03', now)).toBe(true);
    expect(isWithinLessonOperateWindow('2026-08-02', now)).toBe(false);
    // 当日与未来课仍可操作
    expect(isWithinLessonOperateWindow('2026-09-02', now)).toBe(true);
    expect(isWithinLessonOperateWindow('2026-09-10', now)).toBe(true);
    // 产品：缺日期不误拦；非法也不误拦
    expect(isWithinLessonOperateWindow('', now)).toBe(true);
    expect(isWithinLessonOperateWindow('not-a-date', now)).toBe(true);
  });

  it('记录优先级：normal > leave > cancelled', () => {
    expect(getLessonRecordPriority({ status: 'normal' } as never)).toBeGreaterThan(
      getLessonRecordPriority({ status: 'leave' } as never),
    );
    expect(getLessonRecordPriority({ status: 'leave' } as never)).toBeGreaterThan(
      getLessonRecordPriority({ status: 'cancelled' } as never),
    );
  });

  it('记录优先级：makeup≈normal、absent≈leave、缺记录为 0', () => {
    expect(getLessonRecordPriority({ status: 'makeup' } as never)).toBe(
      getLessonRecordPriority({ status: 'normal' } as never),
    );
    expect(getLessonRecordPriority({ status: 'absent' } as never)).toBe(
      getLessonRecordPriority({ status: 'leave' } as never),
    );
    expect(getLessonRecordPriority(undefined)).toBe(0);
    expect(getLessonRecordPriority({ status: 'unknown' as never } as never)).toBe(1);
  });
});
