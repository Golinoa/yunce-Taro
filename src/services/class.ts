/**
 * 班级 Service（Q2-4，从 student.ts 抽出）
 */
import type { Class } from '@/types/class';
import type { Student } from '@/types/student';
import { packageService } from '@/services/package';
import { API_PAGE_SIZE_BATCH, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

interface BackendClassListItem {
  capacity?: null | number;
  color?: null | string;
  createdAt: string;
  endTime?: null | string;
  grade?: null | string;
  id: string;
  location?: null | string;
  name: string;
  note?: null | string;
  schedule?: null | string;
  scheduleCount?: number;
  startTime?: null | string;
  status?: 'ACTIVE' | 'DISBANDED';
  studentCount?: number;
  subject?: null | string;
  totalLessons?: null | number;
  type?: null | string;
  usedLessons?: null | number;
}

interface BackendClassListResponse {
  list: BackendClassListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendClassDetailResponse {
  capacity?: null | number;
  color?: null | string;
  createdAt: string;
  endTime?: null | string;
  id: string;
  location?: null | string;
  name: string;
  note?: null | string;
  recentLessons?: Array<{
    duration?: number;
    id: string;
    lessonDate: string;
  }>;
  schedule?: null | string;
  schedules?: Array<{
    dayOfWeek?: number;
    endTime: string;
    id: string;
    startTime: string;
  }>;
  startTime?: null | string;
  status?: 'ACTIVE' | 'DISBANDED';
  students?: Array<{
    avatar?: null | string;
    gender?: null | 'FEMALE' | 'MALE';
    id: string;
    joinedAt: string;
    name: string;
    phone?: null | string;
  }>;
  subject?: null | string;
  teacher?: {
    id: string;
    nickname?: null | string;
  } | null;
  totalLessons?: null | number;
  type?: null | string;
  usedLessons?: null | number;
}


/** getScheduledClassIds 仅需 schedules 列表分页壳 */
interface BackendScheduleListResponse {
  list: BackendScheduleListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}


const mapBackendGender = (gender?: null | 'FEMALE' | 'MALE'): Student['gender'] => {
  if (gender === 'MALE') return 'male';
  if (gender === 'FEMALE') return 'female';
  return undefined;
};

const mapBackendClassStatus = (status?: 'ACTIVE' | 'DISBANDED'): Class['status'] =>
  status === 'ACTIVE' ? 'active' : 'ended';

const resolveInviteCode = (inviteCode?: null | string): string => {
  const code = inviteCode?.trim();
  return code || '请联系老师';
};

function mapBackendClassListItem(item: BackendClassListItem): Class {
  const ended = item.status === 'DISBANDED';
  const type = ended ? 'ended' : item.type === 'limited' ? 'limited' : 'unlimited';
  return {
    id: item.id,
    name: item.name,
    teacher_id: '',
    created_at: item.createdAt,
    updated_at: item.createdAt,
    type,
    status: mapBackendClassStatus(item.status),
    schedule: item.schedule || undefined,
    total_lessons: item.totalLessons ?? undefined,
    used_lessons: item.usedLessons ?? 0,
    capacity: item.capacity ?? undefined,
    color: (item.color as Class['color']) || 'primary',
    student_count: item.studentCount ?? 0,
    note: item.note || item.location || undefined,
    start_time: item.startTime || undefined,
    end_time: item.endTime || undefined,
  };
}

function mapBackendClassDetail(item: BackendClassDetailResponse): Class {
  const ended = item.status === 'DISBANDED';
  const type = ended ? 'ended' : item.type === 'limited' ? 'limited' : 'unlimited';
  return {
    id: item.id,
    name: item.name,
    teacher_id: item.teacher?.id || '',
    created_at: item.createdAt,
    updated_at: item.createdAt,
    type,
    status: mapBackendClassStatus(item.status),
    schedule: item.schedule || undefined,
    total_lessons: item.totalLessons ?? undefined,
    used_lessons: item.usedLessons ?? item.recentLessons?.length ?? 0,
    capacity: item.capacity ?? undefined,
    color: (item.color as Class['color']) || 'primary',
    student_count: item.students?.length || 0,
    note: item.note || item.location || undefined,
    weekdays: item.schedules
      ?.map((schedule) => {
        const dayMap: Record<number, string> = {
          1: '一',
          2: '二',
          3: '三',
          4: '四',
          5: '五',
          6: '六',
          7: '日',
        };
        return dayMap[schedule.dayOfWeek ?? 0];
      })
      .filter((day): day is string => Boolean(day)),
    start_time: item.startTime || item.schedules?.[0]?.startTime,
    end_time: item.endTime || item.schedules?.[0]?.endTime,
  };
}


// ============================================
// 班级 Service
// ============================================
export const classService = {
  /** 教师名下班级（分批拉全，课程管理按分类再前端过滤） */
  getByTeacher: async (_teacherId: string, campusId?: string): Promise<Class[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendClassListResponse>(`/classes?${params.toString()}`);
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
    return list.map(mapBackendClassListItem);
  },
  getById: async (classId: string): Promise<Class | null> => {
    try {
      const cls = await get<BackendClassDetailResponse>(`/classes/${classId}`);
      return mapBackendClassDetail(cls);
    } catch {
      return null;
    }
  },
  /** 校区班级列表（家长调课选补课班用；真实环境按校区过滤教师可见班级） */
  getByCampus: async (campusId: string): Promise<Class[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendClassListResponse>(`/classes?${params.toString()}`);
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
    return list.map(mapBackendClassListItem);
  },
  getStudents: async (classId: string): Promise<Student[]> => {
    const withPackages = async (base: Student[]): Promise<Student[]> => {
      if (base.length === 0) return base;
      return Promise.all(
        base.map(async (student) => {
          if (student.course_packages && student.course_packages.length > 0) return student;
          try {
            const packages = await packageService.getByStudent(student.id);
            return {
              ...student,
              course_packages: packages.map((pkg) => ({
                id: pkg.id,
                name: pkg.name,
                type: pkg.type,
                total_hours: pkg.total_hours,
                remaining_hours: pkg.remaining_hours,
                purchased_remaining: pkg.purchased_remaining,
                bonus_remaining: pkg.bonus_remaining,
                status: pkg.status,
                subject_id: pkg.subject_id,
                fee_amount: pkg.fee_amount,
                fee_method: pkg.fee_method,
                created_at: pkg.created_at,
              })),
            };
          } catch {
            return student;
          }
        }),
      );
    };

    const list = await get<
      Array<{
        avatar?: null | string;
        gender?: null | 'FEMALE' | 'MALE';
        id: string;
        joinedAt: string;
        name: string;
        phone?: null | string;
        remainingHours?: null | number;
      }>
    >(`/classes/${classId}/students`);
    const mapped = list.map((item) => {
      const remaining = Number(item.remainingHours);
      return {
        id: item.id,
        name: item.name,
        teacher_id: '',
        invite_code: resolveInviteCode(null),
        avatar_url: item.avatar || undefined,
        gender: mapBackendGender(item.gender),
        phone: item.phone || undefined,
        status: 'active' as const,
        created_at: item.joinedAt,
        updated_at: item.joinedAt,
        // 若后端已带 remainingHours，先写成单包摘要，避免全 0；无则后续 withPackages 补齐
        course_packages:
          Number.isFinite(remaining) && remaining >= 0
            ? [
                {
                  id: `summary-${item.id}`,
                  name: '课时',
                  type: 'hour_package' as const,
                  total_hours: remaining,
                  remaining_hours: remaining,
                  purchased_remaining: remaining,
                  bonus_remaining: 0,
                  status: 'active' as const,
                  created_at: item.joinedAt,
                },
              ]
            : undefined,
      };
    });
    return withPackages(mapped);
  },
  getStudentCount: async (classId: string) => (await classService.getStudents(classId)).length,
  /**
   * 获取所有"已排课"的班级 id 列表（用于课程管理·班课列表区分已/未排课）
   * 真实后端：联调时按 teacher/admin 权限返回
   */
  getScheduledClassIds: async (): Promise<string[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await get<BackendScheduleListResponse>(`/schedules?${params.toString()}`);
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
    const ids = new Set<string>();
    for (const item of list) {
      const classId =
        (item as { classId?: string; class_id?: string }).classId ??
        (item as { class_id?: string }).class_id;
      if (classId) ids.add(classId);
    }
    return Array.from(ids);
  },
  create: async (data: Omit<Class, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await post<BackendClassListItem>('/classes', {
      name: data.name,
      schedule: data.schedule,
      subject: data.subject_id,
      type: data.type === 'limited' ? 'limited' : 'unlimited',
      totalLessons: data.type === 'limited' ? data.total_lessons : null,
      capacity: data.capacity ?? null,
      note: data.note,
      color: data.color,
      teachers: data.teachers,
      startTime: data.start_time,
      endTime: data.end_time,
    });
    return mapBackendClassListItem(created);
  },
  update: async (classId: string, data: Partial<Class>) => {
    const updated = await put<BackendClassListItem>(`/classes/${classId}`, {
      name: data.name,
      schedule: data.schedule,
      subject: data.subject_id,
      type: data.type === 'limited' ? 'limited' : data.type === 'ended' ? 'unlimited' : data.type,
      totalLessons: data.type === 'limited' ? data.total_lessons : null,
      capacity: data.capacity ?? null,
      note: data.note,
      color: data.color,
      teachers: data.teachers,
      startTime: data.start_time,
      endTime: data.end_time,
    });
    return mapBackendClassListItem(updated);
  },
  remove: async (classId: string) => {
    await del(`/classes/${classId}`);
    return;
  },
  /** 停课：课表隐藏该班排课/开放时段，可恢复 */
  pause: async (classId: string) => classService.update(classId, { status: 'paused' }),
  /** 恢复上课 */
  resume: async (classId: string) => classService.update(classId, { status: 'active' }),
  removeStudent: async (classId: string, studentId: string) =>
    del(`/classes/${classId}/students/${studentId}`),
  addStudents: async (classId: string, studentIds: string[]) => {
    for (const studentId of studentIds) {
      await post(`/classes/${classId}/students`, { studentId });
    }
    return;
  },
  transferStudent: async (classId: string, targetClassId: string, studentId: string) => {
    await post(`/classes/${classId}/transfer`, {
      studentId,
      targetClassId,
    });
    return;
  },
  end: async (classId: string) => {
    await post(`/classes/${classId}/end`, {});
    return;
  },
};


