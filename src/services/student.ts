/**
 * Service 层 — 学员相关 API（真实后端）
 */

import type { FeeMethod } from '@/types/course-package';
import type { Student } from '@/types/student';
import { studentParentService } from '@/services/student-parents';
import { mapBackendPackageType } from '@/services/package';
import { notWired } from '@/utils/not-wired';
import { API_PAGE_SIZE_BATCH, asPaginatedResponse, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

interface BackendStudentListItem {
  avatar?: null | string;
  birthday?: null | string;
  classCount?: number;
  createdAt: string;
  gender?: null | 'FEMALE' | 'MALE';
  id: string;
  inviteCode?: null | string;
  name: string;
  parentCount?: number;
  phone?: null | string;
  remark?: null | string;
  status?: 'ACTIVE' | 'GRADUATED' | 'INACTIVE';
  totalHours?: number;
  usedHours?: number;
}

interface BackendStudentListResponse {
  list: BackendStudentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendStudentDetailResponse {
  avatar?: null | string;
  birthday?: null | string;
  classes?: Array<{
    id: string;
    name: string;
    schedule?: null | string;
    subject?: null | string;
  }>;
  coursePackages?: Array<{
    id: string;
    name: string;
    status?: string;
    totalHours: number;
    type?: null | string;
    usedHours: number;
    validEnd?: null | string;
  }>;
  createdAt: string;
  gender?: null | 'FEMALE' | 'MALE';
  id: string;
  inviteCode?: null | string;
  name: string;
  parents?: Array<{
    bindStatus?: string;
    id: string;
    profile?: {
      avatar?: null | string;
      nickname?: null | string;
      phone?: null | string;
    } | null;
    relation?: null | string;
  }>;
  phone?: null | string;
  recentLessons?: Array<{
    content?: null | string;
    duration?: number;
    id: string;
    lessonDate: string;
    status?: string;
  }>;
  remark?: null | string;
  status?: 'ACTIVE' | 'GRADUATED' | 'INACTIVE';
  teacher?: {
    id: string;
    institution?: null | string;
    nickname?: null | string;
  } | null;
}

const mapBackendGender = (gender?: null | 'FEMALE' | 'MALE'): Student['gender'] => {
  if (gender === 'MALE') return 'male';
  if (gender === 'FEMALE') return 'female';
  return undefined;
};

const mapBackendStudentStatus = (
  status?: 'ACTIVE' | 'GRADUATED' | 'INACTIVE',
): Student['status'] => {
  return status === 'ACTIVE' ? 'active' : 'deleted';
};

const resolveInviteCode = (inviteCode?: null | string): string => {
  const code = inviteCode?.trim();
  return code || '请联系老师';
};

function mapBackendStudentListItem(item: BackendStudentListItem): Student {
  const totalHours = Number(item.totalHours ?? 0);
  const usedHours = Number(item.usedHours ?? 0);

  return {
    id: item.id,
    name: item.name,
    teacher_id: '',
    invite_code: resolveInviteCode(item.inviteCode),
    avatar_url: item.avatar || undefined,
    gender: mapBackendGender(item.gender),
    birthday: item.birthday || undefined,
    phone: item.phone || undefined,
    note: item.remark || undefined,
    status: mapBackendStudentStatus(item.status),
    created_at: item.createdAt,
    updated_at: item.createdAt,
    course_packages:
      totalHours > 0 || usedHours > 0
        ? [
            {
              id: `${item.id}-aggregate-package`,
              name: '课时汇总',
              total_hours: totalHours,
              remaining_hours: Math.max(totalHours - usedHours, 0),
              purchased_remaining: Math.max(totalHours - usedHours, 0),
              bonus_remaining: 0,
              status: 'active',
              created_at: item.createdAt,
            },
          ]
        : [],
  };
}

function mapBackendStudentDetail(item: BackendStudentDetailResponse): Student {
  return {
    id: item.id,
    name: item.name,
    teacher_id: item.teacher?.id || '',
    invite_code: resolveInviteCode(item.inviteCode),
    avatar_url: item.avatar || undefined,
    gender: mapBackendGender(item.gender),
    birthday: item.birthday || undefined,
    phone: item.phone || undefined,
    note: item.remark || undefined,
    status: mapBackendStudentStatus(item.status),
    created_at: item.createdAt,
    updated_at: item.createdAt,
    course_packages: (item.coursePackages || []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      type: 'type' in pkg ? mapBackendPackageType(pkg.type) : undefined,
      total_hours: pkg.totalHours,
      remaining_hours: Math.max(pkg.totalHours - pkg.usedHours, 0),
      purchased_remaining: Math.max(pkg.totalHours - pkg.usedHours, 0),
      bonus_remaining: 0,
      status:
        pkg.status === 'ACTIVE' ? 'active' : pkg.status === 'EXPIRED' ? 'expired' : 'completed',
      created_at: pkg.validEnd || item.createdAt,
    })),
  };
}

function mapStudentPayload(data: Partial<Student>) {
  return {
    avatar: data.avatar_url,
    birthday: data.birthday,
    gender: data.gender === 'male' ? 'MALE' : data.gender === 'female' ? 'FEMALE' : undefined,
    name: data.name,
    phone: data.phone,
    remark: data.note,
    campusId: data.campus_id,
  };
}

// ============================================
// 学员 Service
// ============================================
export const studentService = {
  /** 获取教师的学员列表（分批拉全） */
  getByTeacher: async (_teacherId: string, campusId?: string): Promise<Student[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendStudentListResponse>(`/students?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendStudentListItem);
  },
  // 联调时替换为:
  // getByTeacher: (teacherId: string) => get<Student[]>(`/api/teachers/${teacherId}/students`),

  /** 获取家长绑定的学员列表 */
  getByParent: async (_parentId: string): Promise<Student[]> =>
    (await get<BackendStudentListResponse>('/students')).list.map(mapBackendStudentListItem),

  /** 获取学员详情 */
  getById: async (studentId: string): Promise<Student | null> => {
    try {
      const student = await get<BackendStudentDetailResponse>(`/students/${studentId}`);
      return mapBackendStudentDetail(student);
    } catch {
      return null;
    }
  },

  /** 后端搜索学员（最少 2 字符；分批拉全匹配结果） */
  search: async (_teacherId: string, query: string, campusId?: string) => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        keyword: query,
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendStudentListResponse>(`/students?${params.toString()}`);
      return asPaginatedResponse(data, page, pageSize);
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendStudentListItem);
  },

  /** 创建学员 */
  create: async (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await post<BackendStudentListItem>('/students', mapStudentPayload(data));
    return mapBackendStudentListItem(created);
  },

  /** 更新学员 */
  update: async (studentId: string, data: Partial<Student>) => {
    const updated = await put<BackendStudentListItem>(
      `/students/${studentId}`,
      mapStudentPayload(data),
    );
    return mapBackendStudentListItem(updated);
  },

  /** 删除学员（软删除） */
  remove: async (studentId: string) => {
    await del(`/students/${studentId}`);
    return;
  },

  /** 获取学员关联数据统计（用于删除确认弹窗） */
  getDependencies: async (_studentId: string) => notWired('student.getDependencies'),

  /** 重名检测 */
  checkDuplicateName: async (_teacherId: string, name: string, excludeId?: string) => {
    const result = await get<{ duplicate: boolean }>(
      `/students/check-duplicate?name=${encodeURIComponent(name)}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`,
    );
    return result.duplicate;
  },

  /** 获取学员的绑定家长 */
  getParents: studentParentService.getParents,

  /** 解绑家长 */
  removeParent: studentParentService.removeParent,

  /** 通过邀请码查找学员 */
  findByInviteCode: studentParentService.findByInviteCode,

  /**
   * 绑定家长到学员（后端按手机号绑定，非 parentId）
   * @deprecated 业务侧请使用 parent-invite-links；保留以兼容旧调用
   */
  bindParent: studentParentService.bindParent,
};

// ============================================
// 课包 Service（实现见 package.ts）
// ============================================
export { packageService, packageTemplateService, invalidatePackagesCache } from '@/services/package';

// ============================================
// 消课记录 Service（实现见 lesson-record.ts）
// ============================================
export { lessonRecordService } from '@/services/lesson-record';

// ============================================
// 请假 Service（实现见 leave.ts）
// ============================================
export { leaveService } from '@/services/leave';

// ============================================
// 班级 Service（实现见 class.ts）
// ============================================
export { classService } from '@/services/class';

// ============================================
// 排课 Service（实现见 schedule.ts）
// ============================================
export { scheduleService } from '@/services/schedule';

// ============================================
// 通知 Service（实现见 notification.ts）
// ============================================
export { notificationService } from '@/services/notification';

// ============================================
// 工具函数
// ============================================
export { formatDateCN } from '@/utils/format';
export type { FeeMethod };
