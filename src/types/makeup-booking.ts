/**
 * 补课预约：学员临时加入某班某课次（教师代约 / 家长调课）
 */
export interface MakeupBooking {
  id: string;
  student_id: string;
  student_name?: string;
  class_id: string;
  class_name?: string;
  campus_id?: string;
  lesson_date: string;
  start_time: string;
  end_time: string;
  teacher_id: string;
  teacher_name?: string;
  /** 来源：teacher=教师端约补课；parent=家长调课 */
  source: 'teacher' | 'parent';
  /** 关联请假/调课申请 ID（家长调课时） */
  leave_request_id?: string;
  /** 原班级（家长从原课调来） */
  original_class_id?: string;
  /**
   * 「哪一节」的排课编号（Schedule.id）。
   * 有了它就能按编号定位课节 —— 同日临时调课改了时段也不会失配。
   * 家长请假自动生成的补课拿不到 ⇒ 为 null，读取端按「班级+日期+时段」兜底。
   */
  schedule_id?: string | null;
  note?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_by: string;
  created_at: string;
  updated_at: string;
}
