/**
 * 门店入驻提交闸门（纯函数，便于 Vitest）
 *
 * - 未登录：禁止直接打 API，须先存草稿并引导登录
 * - 已登录无邮箱：软提示可「下次再说」，不硬挡
 */
import type { Profile } from '@/types/profile';
import type { StoreEntryFormData } from '@/types/store-entry';

export type StoreEntrySubmitGate =
  | { kind: 'login_required' }
  | { kind: 'email_soft_prompt' }
  | { kind: 'ready' };

export function resolveStoreEntrySubmitGate(input: {
  isLoggedIn: boolean;
  profile: Profile | null | undefined;
  /** 本会话已点「下次再说」 */
  emailPromptSkipped: boolean;
}): StoreEntrySubmitGate {
  if (!input.isLoggedIn) {
    return { kind: 'login_required' };
  }
  const hasEmail = Boolean(input.profile?.email?.trim());
  if (!hasEmail && !input.emailPromptSkipped) {
    return { kind: 'email_soft_prompt' };
  }
  return { kind: 'ready' };
}

/** 从草稿恢复表单关键字段（登录回跳 / 驳回重提） */
export function applyStoreEntryDraftToForm(
  draft: StoreEntryFormData | null,
): Partial<StoreEntryFormData> | null {
  if (!draft?.name?.trim()) return null;
  return {
    name: draft.name,
    type: draft.type,
    region: Array.isArray(draft.region) ? draft.region : [],
    address: draft.address || '',
    locationName: draft.locationName || '',
    latitude: draft.latitude,
    longitude: draft.longitude,
    contactName: draft.contactName || '',
    contactPhone: draft.contactPhone || '',
  };
}
