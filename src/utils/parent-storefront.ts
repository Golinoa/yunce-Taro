/**
 * 家长门店切换纯函数（列表 key / 展示 / 同机构判定）
 */
import type { ParentStorefrontItem } from '@/types/storefront';

export function storefrontKey(organizationId: string, campusId: string): string {
  return `${organizationId}:${campusId}`;
}

export function storefrontKeyOf(
  item: Pick<ParentStorefrontItem, 'organizationId' | 'campusId'>,
): string {
  return storefrontKey(item.organizationId, item.campusId);
}

export function formatStorefrontTitle(
  item: Pick<ParentStorefrontItem, 'organizationName' | 'campusName'>,
): string {
  const org = (item.organizationName || '').trim();
  const campus = (item.campusName || '').trim();
  if (org && campus) return `${org} · ${campus}`;
  return org || campus || '门店';
}

export function formatStorefrontStudents(item: Pick<ParentStorefrontItem, 'students'>): string {
  const names = (item.students || []).map((s) => s.name).filter(Boolean);
  if (names.length === 0) return '';
  return `学员：${names.join('、')}`;
}

export function isSameOrgStorefront(
  item: Pick<ParentStorefrontItem, 'organizationId'>,
  currentOrganizationId?: string | null,
): boolean {
  const current = (currentOrganizationId || '').trim();
  if (!current) return false;
  return item.organizationId === current;
}
