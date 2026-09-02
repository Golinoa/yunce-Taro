import { describe, expect, it } from 'vitest';
import { mapBackendPackageType, invalidatePackagesCache } from './package';

describe('package service helpers (Q2-4)', () => {
  it('mapBackendPackageType 仅放行已知类型', () => {
    expect(mapBackendPackageType('hour_package')).toBe('hour_package');
    expect(mapBackendPackageType('trial')).toBe('trial');
    expect(mapBackendPackageType('unknown')).toBeUndefined();
    expect(mapBackendPackageType(null)).toBeUndefined();
  });

  it('invalidatePackagesCache 不抛错', () => {
    expect(() => invalidatePackagesCache('stu-1')).not.toThrow();
    expect(() => invalidatePackagesCache()).not.toThrow();
  });
});
