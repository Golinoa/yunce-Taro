import { describe, expect, it } from 'vitest';
import { getLessonRecordPriority, isWithinLessonOperateWindow } from './lesson-operate';

describe('lesson-operate helpers (Q2-2)', () => {
  it('30 天窗口内外', () => {
    const now = new Date('2026-09-02T12:00:00');
    expect(isWithinLessonOperateWindow('2026-08-10', now)).toBe(true);
    expect(isWithinLessonOperateWindow('2026-07-01', now)).toBe(false);
  });

  it('记录优先级：normal > leave > cancelled', () => {
    expect(getLessonRecordPriority({ status: 'normal' } as never)).toBeGreaterThan(
      getLessonRecordPriority({ status: 'leave' } as never),
    );
    expect(getLessonRecordPriority({ status: 'leave' } as never)).toBeGreaterThan(
      getLessonRecordPriority({ status: 'cancelled' } as never),
    );
  });
});
