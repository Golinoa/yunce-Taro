import { describe, expect, it } from 'vitest';
import { STORE_ENTRY_IDENTITY_COPY } from './store-entry-copy';

describe('STORE_ENTRY_IDENTITY_COPY', () => {
  it('含管理员与门店入驻、运营审核文案', () => {
    expect(STORE_ENTRY_IDENTITY_COPY.optionTitle).toContain('门店入驻');
    expect(STORE_ENTRY_IDENTITY_COPY.optionDesc).toContain('管理员');
    expect(STORE_ENTRY_IDENTITY_COPY.optionDesc).toContain('运营审核');
    expect(STORE_ENTRY_IDENTITY_COPY.bindOrgTitle).toBe('绑定机构');
    expect(STORE_ENTRY_IDENTITY_COPY.bindOrgDesc).toMatch(/学员|员工/);
    expect(STORE_ENTRY_IDENTITY_COPY.footerHint).toContain('选择身份');
    expect(STORE_ENTRY_IDENTITY_COPY.formTitle).toBe('门店入驻');
    expect(STORE_ENTRY_IDENTITY_COPY.formTitle).not.toMatch(/注册门店账户/);
    expect(STORE_ENTRY_IDENTITY_COPY.formSubtitle).toContain('运营审核');
    expect(STORE_ENTRY_IDENTITY_COPY.aboutCta).not.toMatch(/免审|校长独立创建/);
    expect(STORE_ENTRY_IDENTITY_COPY.aboutShareSlogan).not.toMatch(/免审|5 分钟免费开通/);
  });
});
