import { describe, expect, it } from 'vitest';
import { buildCheckinBaseline } from './checkin-status';

describe('buildCheckinBaseline (Q2-2)', () => {
  it('按 leave > checked > absent 生成基线', () => {
    const map = buildCheckinBaseline(['a', 'b', 'c'], new Set(['a', 'b']), new Set(['b']));
    expect(map.get('a')).toBe('checked');
    expect(map.get('b')).toBe('leave');
    expect(map.get('c')).toBe('absent');
  });

  it('空学员名单得到空基线', () => {
    const map = buildCheckinBaseline([], new Set(['x']), new Set(['y']));
    expect(map.size).toBe(0);
  });

  it('仅签到 / 仅请假 / 两边都无时落 absent', () => {
    const onlyChecked = buildCheckinBaseline(['s1'], new Set(['s1']), new Set());
    expect(onlyChecked.get('s1')).toBe('checked');

    const onlyLeave = buildCheckinBaseline(['s2'], new Set(), new Set(['s2']));
    expect(onlyLeave.get('s2')).toBe('leave');

    const neither = buildCheckinBaseline(['s3'], new Set(), new Set());
    expect(neither.get('s3')).toBe('absent');
  });
});
