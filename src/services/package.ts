/**
 * 课包 / 课包模板 Service（Q2-4，从 student.ts 抽出）
 */
import type {
  CoursePackage,
  CoursePackageTemplate,
  DeductResult,
  FeeMethod,
  PackageType,
  PackageTransaction,
  RechargeFormData,
  RefundFormData,
} from '@/types/course-package';
import { notWired } from '@/utils/not-wired';
import type { PaginatedResponse } from '@/utils/pagination';
import { API_PAGE_SIZE_BATCH, asPaginatedResponse, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

interface BackendPackageListItem {
  createdAt: string;
  feeAmount?: null | number;
  feeMethod?: null | string;
  giftHours?: null | number;
  id: string;
  name: string;
  note?: null | string;
  remainingHours: number;
  status?: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  studentId: string;
  studentName?: string;
  totalHours: number;
  usedHours: number;
  validEnd?: null | string;
  validStart?: null | string;
}

interface BackendPackageListResponse {
  list: BackendPackageListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendActivePackageItem extends BackendPackageListItem {
  feeAmount?: null | number;
  feeMethod?: null | string;
  giftHours?: null | number;
  note?: null | string;
  studentAvatar?: null | string;
  type?: null | string;
  validDays?: null | number;
}

interface BackendPackageMutationResponse {
  createdAt?: string;
  feeAmount?: null | number;
  feeMethod?: null | string;
  giftHours?: null | number;
  id: string;
  name?: string;
  note?: null | string;
  remainingHours: number;
  status?: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  studentId?: string;
  totalHours: number;
  usedHours: number;
  validEnd?: null | string;
  validStart?: null | string;
}

interface BackendRechargeRecord {
  amount?: number;
  createdAt: string;
  hours?: number;
  id: string;
  method?: null | string;
  packageId: string;
  packageName?: null | string;
  studentId?: string;
  studentName?: string;
}

interface BackendPackageTransactionRecord {
  amount?: number;
  createdAt: string;
  feeMethod?: null | string;
  giftHours?: number;
  id: string;
  operatorName?: null | string;
  packageId?: string;
  packageName?: null | string;
  purchasedHours?: number;
  reason?: null | string;
  studentId?: string;
  studentName?: string;
  studentAvatar?: null | string;
  type?: 'RECHARGE' | 'REFUND';
}

const mapBackendPackageType = (type?: string | null): PackageType | undefined => {
  if (type === 'hour_package' || type === 'term' || type === 'monthly' || type === 'trial') {
    return type;
  }
  return undefined;
};

const mapBackendPackageStatus = (
  status?: 'ACTIVE' | 'DEPLETED' | 'EXPIRED',
): CoursePackage['status'] => {
  if (status === 'ACTIVE') return 'active';
  if (status === 'EXPIRED') return 'expired';
  return 'completed';
};

const derivePackageHourSplit = (
  totalHoursInput?: number | null,
  remainingHoursInput?: number | null,
  giftHoursInput?: number | null,
) => {
  const totalHours = Math.max(Number(totalHoursInput ?? 0), 0);
  const remainingHours = Math.min(Math.max(Number(remainingHoursInput ?? 0), 0), totalHours);
  const giftHours = Math.min(Math.max(Number(giftHoursInput ?? 0), 0), totalHours);

  const bonusRemaining = remainingHours > giftHours ? giftHours : remainingHours;
  const purchasedRemaining = Math.max(remainingHours - bonusRemaining, 0);

  return {
    totalHours,
    remainingHours,
    giftHours,
    purchasedRemaining,
    bonusRemaining,
  };
};

function mapBackendPackage(
  item: BackendPackageListItem | BackendActivePackageItem | BackendPackageMutationResponse,
): CoursePackage {
  const totalHours = Number(item.totalHours ?? 0);
  const usedHours = Number(item.usedHours ?? 0);
  const remainingHours = Number(item.remainingHours ?? Math.max(totalHours - usedHours, 0));
  const giftHours = 'giftHours' in item ? (item.giftHours ?? 0) : 0;
  const split = derivePackageHourSplit(totalHours, remainingHours, giftHours);

  return {
    id: item.id,
    teacher_id: '',
    student_id: 'studentId' in item && item.studentId ? item.studentId : '',
    name: item.name || '课时包',
    type: 'type' in item ? mapBackendPackageType(item.type) : undefined,
    total_hours: split.totalHours,
    remaining_hours: split.remainingHours,
    purchased_remaining: split.purchasedRemaining,
    bonus_remaining: split.bonusRemaining,
    status: mapBackendPackageStatus(item.status),
    start_date: 'validStart' in item ? item.validStart || undefined : undefined,
    end_date: 'validEnd' in item ? item.validEnd || undefined : undefined,
    expiry_date: 'validEnd' in item ? item.validEnd || undefined : undefined,
    fee_amount: 'feeAmount' in item ? (item.feeAmount ?? undefined) : undefined,
    fee_method:
      'feeMethod' in item && item.feeMethod
        ? (item.feeMethod as FeeMethod) || undefined
        : undefined,
    note: 'note' in item ? item.note || undefined : undefined,
    gift_hours: split.giftHours || undefined,
    valid_days: 'validDays' in item ? (item.validDays ?? undefined) : undefined,
    created_at: 'createdAt' in item && item.createdAt ? item.createdAt : new Date().toISOString(),
    updated_at: 'createdAt' in item && item.createdAt ? item.createdAt : new Date().toISOString(),
  };
}

function mapBackendPackageTransaction(item: BackendPackageTransactionRecord): PackageTransaction {
  return {
    id: item.id,
    type: item.type === 'REFUND' ? 'refund' : 'recharge',
    student_id: item.studentId || '',
    student_name: item.studentName || '学员',
    student_avatar: item.studentAvatar || undefined,
    package_id: item.packageId || undefined,
    package_name: item.packageName || undefined,
    purchased_hours: item.purchasedHours,
    gift_hours: item.giftHours ?? 0,
    fee_amount: Math.max(0, Number(item.amount) || 0),
    fee_method: item.feeMethod ? (item.feeMethod as FeeMethod) : undefined,
    refund_amount: item.type === 'REFUND' ? Math.max(0, Number(item.amount) || 0) : undefined,
    reason: item.reason || undefined,
    operator_name: item.operatorName || undefined,
    created_at: item.createdAt,
  };
}

/** 课包列表缓存（当前仅 invalidate；保留 API 供充值/退费后清缓存） */
const packagesCache = new Map<string, CoursePackage[]>();

export function invalidatePackagesCache(studentId?: string) {
  if (studentId) {
    packagesCache.delete(studentId);
  } else {
    packagesCache.clear();
  }
}

// ============================================
// 课包 Service
// ============================================
export const packageService = {
  /** 获取学员的课包列表（分批拉全） */
  getByStudent: async (studentId: string): Promise<CoursePackage[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        studentId,
      });
      const data = await get<BackendPackageListResponse>(`/course-packages?${params.toString()}`);
      return asPaginatedResponse(data, page, pageSize);
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendPackage);
  },

  /** 获取课包详情 */
  getById: async (packageId: string): Promise<CoursePackage | null> => {
    try {
      const pkg = await get<BackendPackageMutationResponse>(`/course-packages/${packageId}`);
      return mapBackendPackage(pkg);
    } catch {
      return null;
    }
  },

  /** 创建课包 */
  create: async (data: Omit<CoursePackage, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await post<BackendPackageMutationResponse>('/course-packages', {
      studentId: data.student_id,
      name: data.name,
      totalHours: data.total_hours,
      giftHours: data.gift_hours,
      feeAmount: data.fee_amount,
      feeMethod: data.fee_method,
      validStart: data.start_date,
      validEnd: data.end_date || data.expiry_date,
    });
    return mapBackendPackage(created);
  },

  /** 更新课包 */
  update: async (packageId: string, data: Partial<CoursePackage>) => {
    const updated = await put<BackendPackageMutationResponse>(`/course-packages/${packageId}`, {
      name: data.name,
      totalHours:
        data.total_hours !== undefined
          ? data.total_hours + (data.gift_hours || 0)
          : data.remaining_hours !== undefined
            ? data.remaining_hours
            : undefined,
      giftHours: data.gift_hours,
      validEnd: data.end_date || data.expiry_date,
      feeAmount: data.fee_amount,
      feeMethod: data.fee_method,
      note: data.note,
    });
    return mapBackendPackage(updated);
  },

  /** 扣减课时；BE 仅回 remainingHours，拆分字段标记 fifoSplitKnown=false */
  deductHours: async (
    packageId: string,
    hours: number,
  ): Promise<{ pkg: CoursePackage; deduct: DeductResult }> =>
    post<BackendPackageMutationResponse>(`/course-packages/${packageId}/deduct`, {
      hours,
    }).then((pkg) => {
      const remaining = Math.max(pkg.remainingHours, 0);
      return {
        pkg: mapBackendPackage(pkg),
        deduct: {
          // 未拆分：不假装 FIFO；整笔量仅作兼容字段
          purchased_deduct: hours,
          bonus_deduct: 0,
          purchased_remaining: remaining,
          bonus_remaining: 0,
          remaining_hours: remaining,
          fifoSplitKnown: false,
        },
      };
    }),

  /** 获取学员的活跃课包 */
  getActiveByStudent: async (studentId: string): Promise<CoursePackage[]> => {
    const data = await get<BackendActivePackageItem[]>(
      `/course-packages/active?studentId=${encodeURIComponent(studentId)}`,
    );
    return data.map(mapBackendPackage);
  },

  /** 自动匹配最优课包 */
  pickBest: async (_packages: CoursePackage[], _hoursNeeded: number, _subjectId?: string) =>
    notWired('student.pickBest'),

  /** 课时充值（含赠送课时+分期） */
  createRecharge: async (data: RechargeFormData): Promise<CoursePackage> =>
    post<BackendPackageMutationResponse>('/course-packages', {
      studentId: data.student_id,
      name: data.name,
      totalHours: data.total_hours + (data.gift_hours || 0),
      giftHours: data.gift_hours,
      feeAmount: data.fee_amount,
      feeMethod: data.fee_method,
      note: data.note,
    }).then(mapBackendPackage),

  /** 提交退费记录 */
  createRefund: async (data: RefundFormData): Promise<PackageTransaction> => {
    const created = await post<BackendPackageTransactionRecord>('/course-package-refunds', {
      studentId: data.student_id,
      packageId: data.package_id,
      amount: data.refund_amount,
      reason: data.reason,
      operatorId: data.operator_id,
      operatorName: data.operator_name,
    });
    return mapBackendPackageTransaction(created);
  },

  /**
   * 获取课包流水（充值 + 退费），分页拉取
   * 首屏建议 pageSize=30；勿一次 pageSize=100 当全部
   */
  getTransactions: async (
    _teacherId: string,
    options?: {
      studentId?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<PaginatedResponse<PackageTransaction>> => {
    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.max(1, options?.pageSize || 30);
    const studentId = options?.studentId;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (studentId) {
      params.set('studentId', studentId);
    }

    const data = await get<{
      list: BackendPackageTransactionRecord[];
      pagination?: PaginatedResponse<unknown>['pagination'];
    }>(`/package-transactions?${params.toString()}`);
    const list = (data.list || []).map(mapBackendPackageTransaction);
    const pagination = data.pagination || {
      page,
      pageSize,
      total: list.length,
      totalPages: 1,
    };
    return { list, pagination };
  },

  /** 获取教师的充值记录（按时间倒序） */
  getRechargeRecords: async (_teacherId: string, studentId?: string) => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '30',
    });
    const data = await get<
      BackendPackageListResponse | { list: BackendRechargeRecord[]; pagination: unknown }
    >(`/recharges?${params.toString()}`);
    const list = 'list' in data ? data.list : [];
    return (list as BackendRechargeRecord[])
      .filter((item) => !studentId || item.studentId === studentId)
      .map((item) => ({
        id: item.id,
        packageId: item.packageId,
        studentId: item.studentId || '',
        studentName: item.studentName || '学员',
        packageName: item.packageName || '',
        totalHours: item.hours ?? item.amount ?? 0,
        giftHours: 0,
        hours: item.hours ?? item.amount ?? 0,
        feeAmount: item.amount,
        feeMethod: item.method || undefined,
        method: item.method || '',
        createdAt: item.createdAt,
      }));
  },
};

// ============================================
// 课包模板 Service
// ============================================
export const packageTemplateService = {
  getByTeacher: async (_teacherId: string): Promise<CoursePackageTemplate[]> => {
    const data = await get<unknown>('/package-templates');
    const rows = Array.isArray(data)
      ? data
      : asPaginatedResponse<Record<string, unknown>>(
          data as PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[] | null,
          1,
          100,
        ).list;
    return rows.map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        teacher_id: String(r.teacherId ?? r.teacher_id ?? ''),
        name: String(r.name ?? ''),
        type: (r.type as CoursePackageTemplate['type']) || 'hour_package',
        price: Number(r.price ?? 0),
        lesson_count: Number(r.lessonCount ?? r.lesson_count ?? 0),
        duration: Number(r.duration ?? 45),
        valid_days: r.validDays != null ? Number(r.validDays) : undefined,
        subject_id: r.subjectId ? String(r.subjectId) : undefined,
        description: r.description ? String(r.description) : undefined,
        created_at: String(r.createdAt ?? r.created_at ?? ''),
        updated_at: String(r.updatedAt ?? r.updated_at ?? ''),
      };
    });
  },

  create: async (data: Omit<CoursePackageTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    const raw = await post<Record<string, unknown>>('/package-templates', {
      name: data.name,
      type: data.type,
      price: data.price,
      lessonCount: data.lesson_count,
      duration: data.duration,
      validDays: data.valid_days,
      description: data.description,
    });
    return {
      id: String(raw.id),
      teacher_id: String(raw.teacherId ?? ''),
      name: String(raw.name ?? data.name),
      type: (raw.type as CoursePackageTemplate['type']) || data.type,
      price: Number(raw.price ?? data.price),
      lesson_count: Number(raw.lessonCount ?? data.lesson_count),
      duration: Number(raw.duration ?? data.duration),
      valid_days: raw.validDays != null ? Number(raw.validDays) : data.valid_days,
      description: raw.description ? String(raw.description) : data.description,
      created_at: String(raw.createdAt ?? ''),
      updated_at: String(raw.updatedAt ?? ''),
    } as CoursePackageTemplate;
  },

  update: async (templateId: string, data: Partial<CoursePackageTemplate>) => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.type !== undefined) body.type = data.type;
    if (data.price !== undefined) body.price = data.price;
    if (data.lesson_count !== undefined) body.lessonCount = data.lesson_count;
    if (data.duration !== undefined) body.duration = data.duration;
    if (data.valid_days !== undefined) body.validDays = data.valid_days;
    if (data.description !== undefined) body.description = data.description;
    await put(`/package-templates/${templateId}`, body);
    const list = await packageTemplateService.getByTeacher('');
    return list.find((t) => t.id === templateId) ?? null;
  },

  remove: async (templateId: string) => {
    await del(`/package-templates/${templateId}`);
  },
};

export { mapBackendPackageType };
