/**
 * 会员页营销话术：默认文案 + 匹配引擎
 * Admin 可覆盖同 tipId 的 title/body。
 */
import Taro from '@tarojs/taro';
import { isUnlimitedQuota } from '@/constants/membership-plans';
import type { OrganizationQuotaUsage } from '@/services/organization';

export type MembershipTipTone = 'up' | 'warn' | 'urgent' | 'ok';

export type MembershipLifecycle = 'inactive' | 'active' | 'expiring_30' | 'expiring_7' | 'expired';

export type MembershipTipTrigger =
  | 'always'
  | 'members_full'
  | 'employees_full'
  | 'both_full'
  | 'members_warn'
  | 'employees_warn';

export interface MembershipTipDef {
  tipId: string;
  scene: string;
  tone: MembershipTipTone;
  priority: number;
  title: string;
  body: string;
  lifecycles?: MembershipLifecycle[];
  versionCodes?: string[];
  trigger: MembershipTipTrigger;
}

export interface MatchedMembershipTip {
  tipId: string;
  tone: MembershipTipTone;
  title: string;
  body: string;
  scene: string;
}

const DISMISS_KEY = 'yunce:membership-tip-dismiss';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 远程覆盖合并：同 tipId 覆盖本地默认；新 tipId 追加 */
export function mergeMembershipTips(
  defaults: MembershipTipDef[],
  overrides: Array<Partial<MembershipTipDef> & { tipId: string }> | null | undefined,
): MembershipTipDef[] {
  if (!overrides?.length) return defaults;
  const map = new Map(defaults.map((t) => [t.tipId, { ...t }]));
  for (const raw of overrides) {
    if (!raw?.tipId) continue;
    const prev = map.get(raw.tipId);
    map.set(raw.tipId, {
      tipId: raw.tipId,
      scene: raw.scene ?? prev?.scene ?? '',
      tone: (raw.tone as MembershipTipTone) ?? prev?.tone ?? 'up',
      priority: raw.priority ?? prev?.priority ?? 100,
      title: raw.title ?? prev?.title ?? '',
      body: raw.body ?? prev?.body ?? '',
      lifecycles: (raw.lifecycles as MembershipLifecycle[] | undefined) ?? prev?.lifecycles,
      versionCodes: raw.versionCodes ?? prev?.versionCodes,
      trigger: (raw.trigger as MembershipTipTrigger) ?? prev?.trigger ?? 'always',
    });
  }
  return [...map.values()].sort((a, b) => a.priority - b.priority);
}

export const DEFAULT_MEMBERSHIP_TIPS: MembershipTipDef[] = [
  {
    tipId: 'E-A',
    scene: '到期后召回',
    tone: 'urgent',
    priority: 10,
    lifecycles: ['expired'],
    trigger: 'always',
    title: '会员已到期，部分能力暂不可用',
    body: '机构数据仍保留。续费即可恢复；若名额长期紧张，也可直接升级旗舰。',
  },
  {
    tipId: 'E-MEM',
    scene: '到期后 · 会员已满',
    tone: 'urgent',
    priority: 8,
    lifecycles: ['expired'],
    trigger: 'members_full',
    title: '会员已到期，会员名额此前已满',
    body: '续费可恢复使用；升级旗舰后会员不限，招生时不必再腾名额。',
  },
  {
    tipId: 'E-EMP',
    scene: '到期后 · 员工已满',
    tone: 'urgent',
    priority: 9,
    lifecycles: ['expired'],
    trigger: 'employees_full',
    title: '会员已到期，员工名额此前已满',
    body: '续费可恢复使用；升级旗舰后员工不限，扩编时不必再为名额让步。',
  },
  {
    tipId: 'X-A',
    scene: '快到期 ≤7 天',
    tone: 'urgent',
    priority: 20,
    lifecycles: ['expiring_7'],
    trigger: 'always',
    title: '会员将于 {n} 天后到期',
    body: '建议本周完成续费，以免课表与营销能力临时停用。',
  },
  {
    tipId: 'W-A',
    scene: '将到期 ≤30 天',
    tone: 'warn',
    priority: 30,
    lifecycles: ['expiring_30'],
    trigger: 'always',
    title: '会员将于 {n} 天后到期',
    body: '提前续费可避免权益中断，排课与学员数据保持连续可用。',
  },
  {
    tipId: 'A-BOTH',
    scene: '生效中 · 双项已满',
    tone: 'up',
    priority: 40,
    lifecycles: ['active'],
    trigger: 'both_full',
    versionCodes: ['FREE', 'BASIC', 'STANDARD', 'TRIAL'],
    title: '会员与员工名额均已满',
    body: '升级旗舰版后双项均不限，规模扩展时更从容。',
  },
  {
    tipId: 'A-EMP',
    scene: '生效中 · 员工已满',
    tone: 'up',
    priority: 41,
    lifecycles: ['active'],
    trigger: 'employees_full',
    versionCodes: ['FREE', 'BASIC', 'STANDARD', 'TRIAL'],
    title: '员工名额已满',
    body: '继续加人可能受阻。旗舰版员工不限，扩编时不必再为名额让步。',
  },
  {
    tipId: 'A-MEM',
    scene: '生效中 · 会员已满',
    tone: 'up',
    priority: 42,
    lifecycles: ['active'],
    trigger: 'members_full',
    versionCodes: ['FREE', 'BASIC', 'STANDARD', 'TRIAL'],
    title: '会员名额已满',
    body: '后续招生可能被挡住。旗舰版会员不限，旺季也无需临时腾挪名额。',
  },
  {
    tipId: 'A-EMP-W',
    scene: '生效中 · 员工将满',
    tone: 'warn',
    priority: 50,
    lifecycles: ['active'],
    trigger: 'employees_warn',
    versionCodes: ['FREE', 'BASIC', 'STANDARD', 'TRIAL'],
    title: '员工名额即将用尽（{used}/{max}）',
    body: '提前提醒：旗舰版员工不限，需要扩容时可一次到位。',
  },
  {
    tipId: 'A-MEM-W',
    scene: '生效中 · 会员将满',
    tone: 'warn',
    priority: 51,
    lifecycles: ['active'],
    trigger: 'members_warn',
    versionCodes: ['FREE', 'BASIC', 'STANDARD', 'TRIAL'],
    title: '会员名额即将用尽（{used}/{max}）',
    body: '提前提醒：旗舰版会员不限，避免招生中断。',
  },
  {
    tipId: 'N-A',
    scene: '未开通 / 众创',
    tone: 'up',
    priority: 80,
    lifecycles: ['inactive'],
    trigger: 'always',
    versionCodes: ['FREE', 'TRIAL'],
    title: '教务已就绪，招生环节也可一并打通',
    body: '成长版含线索溯源与营销获客，便于把试听转化留在同一套系统里。',
  },
];

export function resolveLifecycle(
  quota: OrganizationQuotaUsage | null | undefined,
): MembershipLifecycle {
  if (!quota) return 'inactive';
  const code = quota.versionCode;
  const expireAt = quota.expireAt ? new Date(quota.expireAt).getTime() : null;
  const now = Date.now();

  if (code === 'FREE' || code === 'TRIAL') {
    if (expireAt && expireAt < now) return 'expired';
    return 'inactive';
  }
  if (expireAt && expireAt < now) return 'expired';
  if (expireAt) {
    const days = Math.ceil((expireAt - now) / (24 * 60 * 60 * 1000));
    if (days <= 7) return 'expiring_7';
    if (days <= 30) return 'expiring_30';
  }
  return 'active';
}

function isFull(current: number, max: number): boolean {
  if (isUnlimitedQuota(max) || max <= 0) return false;
  return current >= max;
}

function ratioOf(current: number, max: number): number {
  if (isUnlimitedQuota(max) || max <= 0) return 0;
  return current / max;
}

function matchTrigger(tip: MembershipTipDef, quota: OrganizationQuotaUsage): boolean {
  const memFull = isFull(quota.members.current, quota.members.max);
  const empFull = isFull(quota.employees.current, quota.employees.max);
  const memWarn = !memFull && ratioOf(quota.members.current, quota.members.max) >= 0.9;
  const empWarn = !empFull && ratioOf(quota.employees.current, quota.employees.max) >= 0.9;

  switch (tip.trigger) {
    case 'always':
      return true;
    case 'members_full':
      return memFull && !empFull;
    case 'employees_full':
      return empFull && !memFull;
    case 'both_full':
      return memFull && empFull;
    case 'members_warn':
      return memWarn;
    case 'employees_warn':
      return empWarn;
    default:
      return false;
  }
}

function fillTemplate(text: string, ctx: { n?: number; used?: number; max?: number }): string {
  return text
    .replace(/\{n\}/g, ctx.n === undefined ? '' : String(ctx.n))
    .replace(/\{used\}/g, ctx.used === undefined ? '' : String(ctx.used))
    .replace(/\{max\}/g, ctx.max === undefined ? '' : String(ctx.max));
}

export function matchMembershipTip(
  quota: OrganizationQuotaUsage | null | undefined,
  tips: MembershipTipDef[] = DEFAULT_MEMBERSHIP_TIPS,
  dismissedIds: string[] = [],
): MatchedMembershipTip | null {
  if (!quota) return null;
  const lifecycle = resolveLifecycle(quota);
  const dismissed = new Set(dismissedIds);

  let daysLeft: number | undefined;
  if (quota.expireAt) {
    const t = new Date(quota.expireAt).getTime();
    if (Number.isFinite(t)) {
      daysLeft = Math.max(0, Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)));
    }
  }

  const tip = tips
    .filter((item) => !dismissed.has(item.tipId))
    .filter((item) => !item.lifecycles || item.lifecycles.includes(lifecycle))
    .filter((item) => !item.versionCodes || item.versionCodes.includes(quota.versionCode))
    .filter((item) => matchTrigger(item, quota))
    .sort((a, b) => a.priority - b.priority)[0];

  if (!tip) return null;

  const empFocus = tip.trigger === 'employees_warn' || tip.trigger === 'employees_full';
  const ctx = {
    n: daysLeft,
    used: empFocus ? quota.employees.current : quota.members.current,
    max: empFocus ? quota.employees.max : quota.members.max,
  };

  return {
    tipId: tip.tipId,
    tone: tip.tone,
    title: fillTemplate(tip.title, ctx),
    body: fillTemplate(tip.body, ctx),
    scene: tip.scene,
  };
}

export function loadDismissedTipIds(): string[] {
  try {
    const raw = Taro.getStorageSync(DISMISS_KEY);
    if (!raw) return [];
    const map = JSON.parse(String(raw)) as Record<string, number>;
    const now = Date.now();
    return Object.entries(map)
      .filter(([, ts]) => now - ts < DISMISS_TTL_MS)
      .map(([id]) => id);
  } catch {
    return [];
  }
}

export function dismissMembershipTip(tipId: string): void {
  try {
    const raw = Taro.getStorageSync(DISMISS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(String(raw)) : {};
    map[tipId] = Date.now();
    Taro.setStorageSync(DISMISS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
