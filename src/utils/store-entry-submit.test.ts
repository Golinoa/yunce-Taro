import { describe, expect, it } from 'vitest';
import type { Profile } from '@/types/profile';
import { applyStoreEntryDraftToForm, resolveStoreEntrySubmitGate } from './store-entry-submit';

const profileNoEmail = {
  id: 'u1',
  email: '',
  currentContext: { identityId: 'i1', role: 'principal', organizationId: '' },
} as Profile;

const profileWithEmail = {
  ...profileNoEmail,
  email: 'a@b.com',
} as Profile;

describe('resolveStoreEntrySubmitGate', () => {
  it('未登录 → login_required（不直接 fire API）', () => {
    expect(
      resolveStoreEntrySubmitGate({
        isLoggedIn: false,
        profile: null,
        emailPromptSkipped: false,
      }),
    ).toEqual({ kind: 'login_required' });
  });

  it('已登录无邮箱且未跳过 → email_soft_prompt', () => {
    expect(
      resolveStoreEntrySubmitGate({
        isLoggedIn: true,
        profile: profileNoEmail,
        emailPromptSkipped: false,
      }),
    ).toEqual({ kind: 'email_soft_prompt' });
  });

  it('下次再说后仍可 ready（不硬挡提交）', () => {
    expect(
      resolveStoreEntrySubmitGate({
        isLoggedIn: true,
        profile: profileNoEmail,
        emailPromptSkipped: true,
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('已绑邮箱不反复强挡', () => {
    expect(
      resolveStoreEntrySubmitGate({
        isLoggedIn: true,
        profile: profileWithEmail,
        emailPromptSkipped: false,
      }),
    ).toEqual({ kind: 'ready' });
  });
});

describe('applyStoreEntryDraftToForm', () => {
  it('有草稿时恢复关键字段', () => {
    const restored = applyStoreEntryDraftToForm({
      name: '星火',
      type: '总店',
      region: ['广东省', '深圳市', '南山区'],
      address: '科技园',
      locationName: '星火中心',
      contactName: '张三',
      contactPhone: '13800138000',
    });
    expect(restored?.name).toBe('星火');
    expect(restored?.region).toEqual(['广东省', '深圳市', '南山区']);
    expect(restored?.contactPhone).toBe('13800138000');
  });

  it('空草稿返回 null', () => {
    expect(applyStoreEntryDraftToForm(null)).toBeNull();
    expect(
      applyStoreEntryDraftToForm({
        name: '  ',
        type: '总店',
        region: [],
        address: '',
        contactName: '',
        contactPhone: '',
      }),
    ).toBeNull();
  });
});
