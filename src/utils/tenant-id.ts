/**
 * 租户 ID 解析：organizationId 只能是接口/JWT 下发的真实机构 id，
 * 禁止用中文店名 / profileId / userId 冒充。
 *
 * 生产默认 UUID；测环境种子允许 opaque id（如 org-yunce）。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_ORG_ID_RE = /^[a-z0-9][a-z0-9_-]{2,64}$/i;
const NON_ORG_PREFIX_RE = /^(profile|user|identity|teacher|parent|student)[-_]/i;

/** 判断字符串是否为标准 UUID */
export function isTenantUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(String(value).trim()));
}

/**
 * 是否为可用的真实 organizationId（UUID 或合法 opaque id）。
 * 函数名历史遗留含 Uuid，语义=「真实机构 id」。
 */
export function isUuidOrganizationId(value: string | null | undefined): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  // 中文店名、邮箱、空格等一律拒绝
  if (/[\u4e00-\u9fff\s@.]/.test(raw)) return false;
  if (UUID_RE.test(raw)) return true;
  if (NON_ORG_PREFIX_RE.test(raw)) return false;
  return OPAQUE_ORG_ID_RE.test(raw);
}

/**
 * 从候选中取第一个合法租户 id；禁止等于展示名 / profileId 等冒充值。
 */
export function pickRealTenantId(
  candidates: Array<string | null | undefined>,
  forbidden: Array<string | null | undefined> = [],
): string {
  const blocked = new Set(
    forbidden
      .map((item) =>
        String(item || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value || !isUuidOrganizationId(value)) continue;
    if (blocked.has(value.toLowerCase())) continue;
    return value;
  }
  return '';
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary =
    typeof atob === 'function'
      ? atob(normalized + pad)
      : Buffer.from(normalized + pad, 'base64').toString('binary');
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * 仅解码 access_token payload（不验签）；用于把 JWT 内真实 organizationId/campusId 写入 Profile。
 */
export function decodeAccessTokenClaims(token: string | null | undefined): {
  organizationId?: string;
  campusId?: string;
} {
  if (!token || typeof token !== 'string') return {};
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return {};
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
    return {
      organizationId:
        typeof payload.organizationId === 'string' ? payload.organizationId : undefined,
      campusId: typeof payload.campusId === 'string' ? payload.campusId : undefined,
    };
  } catch {
    return {};
  }
}
