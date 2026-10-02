import { describe, expect, it } from 'vitest';
import { resolveRechargeCounts } from './index';

describe('resolveRechargeCounts（追加/赠送二选一，2026-10-02）', () => {
  it('只填追加次数 ⇒ 通过', () => {
    expect(resolveRechargeCounts('10', '')).toEqual({ ok: true, amount: 10, gift: 0 });
  });

  it('只填赠送次数 ⇒ 通过（amount 归 0，只送不买合法）', () => {
    expect(resolveRechargeCounts('', '5')).toEqual({ ok: true, amount: 0, gift: 5 });
  });

  it('两者都填 ⇒ 通过', () => {
    expect(resolveRechargeCounts('10', '2')).toEqual({ ok: true, amount: 10, gift: 2 });
  });

  it('都留空 ⇒ 至少填一项', () => {
    expect(resolveRechargeCounts('', '')).toEqual({
      ok: false,
      message: '追加次数与赠送次数至少填一项',
    });
  });

  it('都填 0 ⇒ 至少填一项', () => {
    expect(resolveRechargeCounts('0', '0')).toEqual({
      ok: false,
      message: '追加次数与赠送次数至少填一项',
    });
  });

  it('非整数或负数 ⇒ 拒绝', () => {
    expect(resolveRechargeCounts('1.5', '')).toEqual({
      ok: false,
      message: '追加次数必须是非负整数',
    });
    expect(resolveRechargeCounts('', '-3')).toEqual({
      ok: false,
      message: '赠送次数必须是非负整数',
    });
  });
});
