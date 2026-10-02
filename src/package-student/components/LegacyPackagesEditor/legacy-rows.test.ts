import { describe, expect, it } from 'vitest';
import { toFenAmount, validateLegacyRows, type LegacyRow } from './index';

const row = (patch: Partial<LegacyRow> = {}): LegacyRow => ({
  subjectId: 'sub-1',
  remainingCount: '10',
  purchaseAmount: '',
  expiredAt: '',
  remark: '迁移',
  ...patch,
});

describe('toFenAmount（期初缴费金额 元 → 分）', () => {
  it('正常换算并四舍五入到分', () => {
    expect(toFenAmount('100')).toBe(10000);
    expect(toFenAmount('99.9')).toBe(9990);
    expect(toFenAmount('0.01')).toBe(1);
    expect(toFenAmount('1234.56')).toBe(123456);
  });

  it('留空 / 空串 = 0（不填金额不算错）', () => {
    expect(toFenAmount('')).toBe(0);
    expect(toFenAmount(undefined)).toBe(0);
    expect(toFenAmount('   ')).toBe(0);
  });

  it('非法与负数一律 0，不产生负账', () => {
    expect(toFenAmount('abc')).toBe(0);
    expect(toFenAmount('-5')).toBe(0);
    expect(toFenAmount('NaN')).toBe(0);
  });
});

describe('validateLegacyRows 金额校验', () => {
  it('金额留空通过', () => {
    expect(validateLegacyRows([row()])).toBeNull();
  });

  it('金额为合法数字通过', () => {
    expect(validateLegacyRows([row({ purchaseAmount: '0' })])).toBeNull();
    expect(validateLegacyRows([row({ purchaseAmount: '1280.50' })])).toBeNull();
  });

  it('金额为负数或非数字时拒绝', () => {
    expect(validateLegacyRows([row({ purchaseAmount: '-1' })])).toContain('缴费金额');
    expect(validateLegacyRows([row({ purchaseAmount: 'abc' })])).toContain('缴费金额');
  });
});
