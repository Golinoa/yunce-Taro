/**
 * 机构绑定 / 分享归属 — Mock 数据层
 *
 * 联调时仅需切换 src/services/organization.ts 的 USE_MOCK，真实请求：
 * - POST /organization/bind                    绑定机构（学员邀请码）
 * - POST /organization/bindings/:id/relation    保存关系
 * - GET  /organization/me                       我的机构状态 + 待确认关系
 * - GET  /share/context?inviteCode=xxx          分享上下文（落地页展示邀请人）
 */
import Taro from '@tarojs/taro';
import { ORGANIZATIONS, STUDENTS, USERS } from '@/data/mock-database';
import type {
  BindOrganizationResult,
  Membership,
  MyOrganizationResult,
  OrganizationInfo,
  PendingRelation,
  ShareContext,
  StudentParentRelation,
} from '@/services/organization';
import type { Profile } from '@/types/profile';

/** mock 待确认关系存储 key（绑定成功写入，关系确认后清除） */
const MOCK_PENDING_RELATION_KEY = 'yunce:mock-pending-relation';
/** 用户资料存储 key（与 data/auth.ts 保持一致） */
const MOCK_PROFILE_KEY = 'yunce-edu-user-profile';

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readStoredProfile(): Profile | null {
  try {
    const raw = Taro.getStorageSync(MOCK_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function readPendingRelation(): PendingRelation | null {
  try {
    const raw = Taro.getStorageSync(MOCK_PENDING_RELATION_KEY);
    return raw ? (JSON.parse(raw) as PendingRelation) : null;
  } catch {
    return null;
  }
}

function writePendingRelation(pending: PendingRelation): void {
  try {
    Taro.setStorageSync(MOCK_PENDING_RELATION_KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}

function clearPendingRelation(): void {
  try {
    Taro.removeStorageSync(MOCK_PENDING_RELATION_KEY);
  } catch {
    /* ignore */
  }
}

/** 绑定机构：学员邀请码 → 自动创建子女（StudentParent BOUND）+ 机构用户 MEMBER */
export async function mockBindOrganization(inviteCode: string): Promise<BindOrganizationResult> {
  await delay();

  const code = (inviteCode || '').trim().toUpperCase();
  // mock 简化：以学员 id 近似匹配邀请码，匹配不到回退第一个学员
  const student = STUDENTS.find((s) => s.id.toUpperCase() === code) || STUDENTS[0];
  if (!student) {
    throw new Error('邀请码无效');
  }

  const organization = ORGANIZATIONS[0];
  const studentParentId = `sp-${Date.now()}`;
  writePendingRelation({
    studentId: student.id,
    studentName: student.name,
    studentParentId,
  });

  return {
    studentId: student.id,
    studentName: student.name,
    organizationId: organization?.id || '',
    studentParentId,
  };
}

/** 保存关系（self/father/mother），持久化后清除待确认关系 */
export async function mockSaveRelation(
  studentParentId: string,
  relation: StudentParentRelation,
): Promise<{ studentParentId: string; relation: StudentParentRelation }> {
  await delay();
  clearPendingRelation();
  return { studentParentId, relation };
}

/** 我的机构状态 + 待确认关系 */
export async function mockGetMyOrganization(): Promise<MyOrganizationResult> {
  await delay();

  const profile = readStoredProfile();
  const identities = profile?.identities || [];
  const first = identities[0];
  const organization: OrganizationInfo | null = first
    ? {
        id: first.organizationId,
        name: first.organizationName,
        status: 'active',
        versionCode: 'FREE',
      }
    : null;

  const pendingRelation = readPendingRelation();

  const memberships: Membership[] = [];
  if (profile && profile.currentContext?.role === 'parent') {
    // mock 简化：从当前用户资料中的 parent_profile 派生一条成员关系
    if (profile.parent_profile?.student_id && profile.parent_profile.student_name) {
      memberships.push({
        studentId: profile.parent_profile.student_id,
        studentName: profile.parent_profile.student_name || '',
        relation:
          profile.parent_profile.relation === 'father' ||
          profile.parent_profile.relation === 'mother' ||
          profile.parent_profile.relation === 'self'
            ? (profile.parent_profile.relation as StudentParentRelation)
            : null,
      });
    }
  }

  return {
    organization,
    pendingRelation,
    memberships,
  };
}

/** 分享上下文：展示「xx 邀请你」 */
export async function mockGetShareContext(inviteCode: string): Promise<ShareContext> {
  await delay();

  const code = (inviteCode || '').trim().toUpperCase();
  const organization = ORGANIZATIONS[0];
  const teacher =
    USERS.find((u) => u.username.toUpperCase() === code) ||
    USERS.find((u) => u.id.toUpperCase().includes(code));
  if (!organization) {
    throw new Error('邀请无效');
  }

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    teacherId: teacher?.id || '',
    teacherName: teacher?.name || '老师',
  };
}
