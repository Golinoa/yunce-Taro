/**
 * 临时调课记录
 * 仅覆盖某一天的课程实例，不修改班级长期排课规则。
 */
export interface TemporaryReschedule {
  id: string;
  teacher_id: string;
  class_id: string;
  schedule_id: string;
  source_date: string;
  target_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}
