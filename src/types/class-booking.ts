/**
 * 班级开放预约记录
 * 用于开放预约制班级：家长选择时段预约后生成，约满/到点后据此开班。
 */
export interface ClassBookingRecord {
  id: string;
  /** 关联时段 ID */
  slot_id: string;
  /** 关联班级 ID */
  class_id: string;
  /** 预约学员 ID */
  student_id: string;
  /** 学员名称（冗余展示） */
  student_name?: string;
  /** 预约家长 ID */
  parent_id?: string;
  /** 记录状态 */
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
}
