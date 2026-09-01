/**
 * Empty 组件图标解析：mdi-* 一律走 Icon，禁止把图标名当文案渲染。
 * 未知 mdi 名回落到 mdi-inbox。
 */

export const EMPTY_ICON_FALLBACK = 'mdi-inbox';

export type EmptyIconKind = 'mdi' | 'emoji';

export interface EmptyIconResolved {
  kind: EmptyIconKind;
  /** mdi 名或 emoji/其它展示串；kind=mdi 时永不等于原始未知名以外的「当文案」路径 */
  value: string;
}

/** 解析 Empty 的 icon prop，供组件与单测共用 */
export function resolveEmptyIcon(icon: string | undefined | null): EmptyIconResolved {
  const raw = String(icon ?? '').trim();
  if (!raw) {
    return { kind: 'mdi', value: EMPTY_ICON_FALLBACK };
  }
  if (raw.startsWith('mdi-')) {
    return { kind: 'mdi', value: raw };
  }
  return { kind: 'emoji', value: raw };
}

/** UI 实际传给 Icon 的 name：未知名由调用方用 hasMdiPath 再 fallback；此处只保证 mdi 前缀策略 */
export function resolveEmptyMdiName(
  icon: string | undefined | null,
  hasPath: (name: string) => boolean,
): string {
  const resolved = resolveEmptyIcon(icon);
  if (resolved.kind !== 'mdi') {
    return EMPTY_ICON_FALLBACK;
  }
  return hasPath(resolved.value) ? resolved.value : EMPTY_ICON_FALLBACK;
}
