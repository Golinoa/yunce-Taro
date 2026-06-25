/**
 * 请假/调课类型
 */
export type LeaveType = 'leave' | 'reschedule';

/**
 * 请假审批状态
 */
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

/**
 * 请假/调课申请 (leave_requests 表)
 */
export interface LeaveRequest {
  id: string;
  parent_id: string;
  student_id: string;
  teacher_id: string;
  type: LeaveType;
  original_date: string;
  end_date?: string; // 请假结束日期
  new_date?: string; // 调课时的新日期
  reason?: string;
  status: LeaveStatus;
  created_at: string;
  updated_at: string;
  // 关联查询字段
  student?: {
    name: string;
  };
}
