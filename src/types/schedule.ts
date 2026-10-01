/**
 * 排课颜色主题
 * 用户口径（2026-08-23）：排课颜色 = 班级颜色（ClassColor），
 * 保证今日课表与课程管理/班级详情颜色一致。
 */
export type ScheduleColor = 'primary' | 'red' | 'amber' | 'purple' | 'info' | 'teal';

/**
 * 课程类型（左侧时间区配色）
 */
export type CourseType = 'normal' | 'art' | 'music' | 'dance' | 'tech' | 'english';

/**
 * 课程状态
 * - urgent: 即将上课（5分钟内）
 * - upcoming: 待上课
 * - active: 上课中（已到开课时间、未下课）
 * - done: 已点名（已有今日消课记录 / 无学生）
 * - unattended: 未点名（下课但无今日消课记录，提醒色，禁止查看）
 * - ended: 已取消/作废
 */
export type CourseStatus = 'urgent' | 'upcoming' | 'active' | 'done' | 'unattended' | 'ended';

/**
 * 星期枚举（1=周一, 7=周日）
 */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ScheduleRuleStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';

/**
 * 排课信息 (schedules 表)
 */
export interface Schedule {
  id: string;
  teacher_id: string;
  operator_teacher_id?: string;
  assistant_teacher_id?: string;
  student_id?: string;
  class_id?: string;
  day_of_week: DayOfWeek;
  start_time: string; // HH:mm 格式
  end_time: string; // HH:mm 格式
  color?: ScheduleColor;
  note?: string;
  reminder_minutes?: number;
  created_at: string;
  updated_at: string;
  /**
   * 重复规则状态。可操作语义只有两种：`ACTIVE`（进行中）/ `STOPPED`（已停止）。
   * 「停止」只停未来、**不影响已生成的课节与消课记录**（2026-10-02 口径统一：
   * 旧的 `PAUSED` 暂停语义已整套移除，枚举值保留仅为 DB 兼容）。
   */
  rule_status?: ScheduleRuleStatus;
  stopped_at?: string;
  /**
   * 规则有效期（排课表单「开始日期」/「结束日期」，`YYYY-MM-DD`）。
   * 空缺 = 不设限。**展开课次时必须按它收窄**（真源 `isScheduleRuleEffectiveOnDate`），
   * 否则「开始日期=下月」的规则会提前出现在课表上；「删了再重建」还会让历史日期同时渲染老/新两条规则。
   */
  start_date?: string;
  end_date?: string;
  /**
   * 节假日是否跳过（＝排课表单「节假日排课」开关的反值）。
   * true/undefined＝遇放假自动停课；false＝节假日照常上课。
   */
  skip_holiday?: boolean;
  // 关联查询字段
  student?: {
    name: string;
  };
  class_info?: {
    name: string;
  };
  // 课程卡片扩展字段
  /** 课程状态 */
  status?: CourseStatus;
  /** 已点名（签到）人数 */
  checked_count?: number;
  /** 未到人数 */
  absent_count?: number;
  /** 请假人数 */
  leave_count?: number;
  /** 总学员数 */
  total_count?: number;
  /** 教室 */
  room?: string;
  /** 约课标记 */
  tag?: string;
  /** 关联试听/私教预约 ID（首页今日课表合并预约时使用） */
  booking_id?: string;
  /** 试听模式：团课 / 私教 */
  trial_mode?: 'group' | 'private';
  /** 是否含试听学员（团课试听预约） */
  has_trial_student?: boolean;
  /** 课程分类展示名（用户自定义分类，非写死班课/团课/私教） */
  category_label?: string;
  /** 课表项来源：固定排课 / 试听预约 / 场地预约 */
  schedule_kind?: 'schedule' | 'booking' | 'venue';
  /** 场地预约 ID */
  venue_booking_id?: string;
  /** 场地/教室 ID（场地预约跳转用） */
  room_id?: string;
  /** 课程类型（控制左侧时间区配色） */
  course_type?: CourseType;
  /** 授课老师名称 */
  teacher_name?: string;
  /** 操作老师名称 */
  operator_teacher_name?: string;
  /** 助教老师名称 */
  assistant_teacher_name?: string;
}
