/**
 * 请假 Service（Q2-4，从 student.ts 抽出）
 */
import type { LeaveRequest } from '@/types/leave-request';
import { API_PAGE_SIZE_BATCH, asPaginatedResponse, fetchAllPages } from '@/utils/pagination';
import { get, post, put } from '@/utils/request';

interface BackendLeaveRequestItem {
  createdAt: string;
  endDate: string;
  id: string;
  parentName?: null | string;
  reason: string;
  startDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  studentAvatar?: null | string;
  studentId: string;
  studentName?: null | string;
}

interface BackendLeaveRequestListResponse {
  list: BackendLeaveRequestItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendLeaveRequestCreateResponse {
  createdAt: string;
  endDate: string;
  id: string;
  reason: string;
  startDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  studentId: string;
  studentName?: null | string;
}

function mapBackendLeaveStatus(status: BackendLeaveRequestItem['status']): LeaveRequest['status'] {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'pending';
  }
}

function mapBackendLeave(
  leave: BackendLeaveRequestItem | BackendLeaveRequestCreateResponse,
): LeaveRequest {
  return {
    id: leave.id,
    parent_id: '',
    student_id: leave.studentId,
    teacher_id: '',
    type: 'leave',
    original_date: leave.startDate,
    end_date: leave.endDate,
    reason: leave.reason,
    status: mapBackendLeaveStatus(leave.status),
    created_at: leave.createdAt,
    updated_at: leave.createdAt,
    student: leave.studentName ? { name: leave.studentName } : undefined,
  };
}

export const leaveService = {
  /** 学员请假列表（分批拉全） */
  getByStudent: async (studentId: string): Promise<LeaveRequest[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        studentId,
      });
      const data = await get<BackendLeaveRequestListResponse>(
        `/leave-requests?${params.toString()}`,
      );
      return asPaginatedResponse(data, page, pageSize);
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendLeave);
  },
  /** 教师请假列表（分批拉全） */
  getByTeacher: async (_teacherId: string): Promise<LeaveRequest[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await get<BackendLeaveRequestListResponse>(
        `/leave-requests?${params.toString()}`,
      );
      return asPaginatedResponse(data, page, pageSize);
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendLeave);
  },
  create: async (
    data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<LeaveRequest> => {
    const created = await post<BackendLeaveRequestCreateResponse>('/leave-requests', {
      studentId: data.student_id,
      startDate: data.original_date,
      endDate: data.end_date || data.original_date,
      reason: data.reason || '',
      ...(data.type === 'reschedule' ? { type: 'reschedule', newDate: data.new_date } : {}),
    });
    return {
      ...mapBackendLeave(created),
      type: data.type,
      new_date: data.new_date,
    };
  },
  updateStatus: async (leaveId: string, status: 'approved' | 'rejected') => {
    await put(`/leave-requests/${leaveId}/approve`, {
      status: status === 'approved' ? 'APPROVED' : 'REJECTED',
    });
    return;
  },
};

export const __leaveMappersForTest = {
  mapBackendLeaveStatus,
  mapBackendLeave,
};
