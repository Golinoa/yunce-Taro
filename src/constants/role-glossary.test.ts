import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_TITLES,
  displayStaffIdentityLabel,
  displayUserRoleLabel,
  matchRoleTitlePresetId,
  normalizeRoleTitles,
} from './role-glossary';

describe('role-glossary', () => {
  it('OWNER 永远显示管理员', () => {
    expect(displayStaffIdentityLabel('principal', DEFAULT_ROLE_TITLES, 'OWNER')).toBe('管理员');
  });

  it('管理层/授课随配置变化', () => {
    const titles = { manager: '校长' as const, teacher: '教练' as const, parent: '会员' as const };
    expect(displayStaffIdentityLabel('principal', titles)).toBe('校长');
    expect(displayStaffIdentityLabel('teacher', titles)).toBe('教练');
    expect(displayUserRoleLabel('parent', titles)).toBe('会员');
    expect(displayUserRoleLabel('admin', titles)).toBe('管理员');
  });

  it('normalize + preset 匹配', () => {
    expect(normalizeRoleTitles({ manager: '馆长', teacher: '教练', parent: '家长' })).toEqual({
      manager: '馆长',
      teacher: '教练',
      parent: '家长',
    });
    expect(matchRoleTitlePresetId({ manager: '馆长', teacher: '教练', parent: '家长' })).toBe(
      'martial',
    );
  });
});
