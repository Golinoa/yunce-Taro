import { describe, expect, it } from 'vitest';
import { isConsumingRecord, RECORD_STATUS_LABEL } from './student-detail-record-status';

/**
 * 出勤记录状态口径。
 *
 * 判据必须与后端 `lesson-record.service.ts` 的 `consumesPackage = NORMAL || MAKEUP` 一致：
 * 只有真实消耗课时的记录才允许显示 `-X课时`，否则会与「卡包」余额矛盾（R9 验收第 5 条）。
 */
describe('出勤记录状态口径（对齐后端 consumesPackage）', () => {
  it('只有 normal / makeup 消耗课时', () => {
    expect(isConsumingRecord({ status: 'normal' })).toBe(true);
    expect(isConsumingRecord({ status: 'makeup' })).toBe(true);
  });

  it('cancelled / absent / leave 都不消耗课时（不得显示 -X课时）', () => {
    expect(isConsumingRecord({ status: 'cancelled' })).toBe(false);
    expect(isConsumingRecord({ status: 'absent' })).toBe(false);
    expect(isConsumingRecord({ status: 'leave' })).toBe(false);
  });

  it('status 缺省视同 normal（与后端默认值一致）', () => {
    expect(isConsumingRecord({})).toBe(true);
  });

  it('所有非消耗状态都有中文标签，不会渲染成空白', () => {
    (['cancelled', 'absent', 'leave'] as const).forEach((status) => {
      expect(RECORD_STATUS_LABEL[status]).toBeTruthy();
    });
  });
});
