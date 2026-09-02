import { describe, expect, it } from 'vitest';
import { buildCheckinBaseline } from './checkin-status';

describe('buildCheckinBaseline (Q2-2)', () => {
  it('按 leave > checked > absent 生成基线', () => {
    const map = buildCheckinBaseline(['a', 'b', 'c'], new Set(['a', 'b']), new Set(['b']));
    expect(map.get('a')).toBe('checked');
    expect(map.get('b')).toBe('leave');
    expect(map.get('c')).toBe('absent');
  });
});
