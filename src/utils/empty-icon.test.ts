import { describe, expect, it } from 'vitest';
import { EMPTY_ICON_FALLBACK, resolveEmptyIcon, resolveEmptyMdiName } from './empty-icon';

describe('empty-icon', () => {
  it('mdi-* 一律按图标处理，不把名称当 emoji 文案', () => {
    expect(resolveEmptyIcon('mdi-book-education-outline')).toEqual({
      kind: 'mdi',
      value: 'mdi-book-education-outline',
    });
    expect(resolveEmptyIcon('mdi-calendar-blank-outline')).toEqual({
      kind: 'mdi',
      value: 'mdi-calendar-blank-outline',
    });
  });

  it('未知 mdi 名回落到 inbox，避免 UI 显示 mdi-xxx 字符串', () => {
    const hasPath = (name: string) => name === 'mdi-inbox';
    expect(resolveEmptyMdiName('mdi-totally-unknown-icon', hasPath)).toBe(EMPTY_ICON_FALLBACK);
    expect(resolveEmptyMdiName('mdi-book-education-outline', (n) => n.includes('book'))).toBe(
      'mdi-book-education-outline',
    );
  });

  it('非 mdi 仍可作为 emoji 兼容', () => {
    expect(resolveEmptyIcon('📭')).toEqual({ kind: 'emoji', value: '📭' });
  });
});
