/**
 * 试听线索相关类型定义
 *
 * Lead（试听线索）是正式学员转化前的潜在客户对象，
 * 独立于 Student 模型，避免污染正式教务数据。
 */

// ============================================
// 线索状态
// ============================================

/** 线索状态枚举 */
export type LeadStatus =
  | 'new' // 新建
  | 'pending' // 待预约
  | 'booked' // 已预约
  | 'arrived' // 已到店
  | 'not_arrived' // 未到店
  | 'following' // 待继续跟进
  | 'converted' // 已转化（转正式学员）
  | 'closed'; // 已关闭

/** 线索来源类型 */
export type LeadSourceType = 'share_link' | 'qr' | 'manual';

/** 归属锁定状态 */
export type OwnerLockStatus = 'weak' | 'locked';

/** 归属锁定原因 */
export type OwnerLockReason = 'first_booking' | 'manual_adjust';

// ============================================
// 线索主体
// ============================================

/** 试听线索 */
export interface Lead {
  id: string;
  /** 临时学员 ID，用于预约和试听记录的主索引 */
  trial_student_id: string;
  /** 孩子姓名（必填） */
  child_name: string;
  /** 孩子昵称/区分称呼（选填，辅助区分重名） */
  child_nickname?: string;
  /** 孩子性别 */
  child_gender?: 'male' | 'female';
  /** 孩子年龄/年级 */
  child_age?: string;
  /** 孩子头像（有则真实引用，无则前端按姓名生成色块字） */
  avatar_url?: string;
  /** 家长账号 ID（未注册时为空） */
  parent_user_id?: string;
  /** 家长姓名 */
  parent_name?: string;
  /** 家长手机号 */
  parent_phone?: string;
  /** 首次有效邀约老师 ID */
  first_invite_teacher_id?: string;
  /** 最近一次有效邀约老师 ID */
  latest_invite_teacher_id?: string;
  /** 首次有效预约对应老师 ID */
  booking_teacher_id?: string;
  /** 当前成单归属老师 ID */
  owner_teacher_id?: string;
  /** 建档老师 ID */
  creator_teacher_id: string;
  /** 归属校区 ID */
  campus_id: string;
  /** 线索来源 */
  source_type: LeadSourceType;
  /** 默认展示课程 ID（邀约时携带，非最终预约锁定） */
  source_course_id?: string;
  /** 实际预约课程 ID */
  booking_course_id?: string;
  /** 渠道标记 */
  source_channel?: string;
  /** 归属锁定状态 */
  owner_lock_status: OwnerLockStatus;
  /** 归属锁定原因 */
  owner_lock_reason?: OwnerLockReason;
  /** 最近一次强制改派原因（锁定态经 reassignLead 改派时记录，消除 L-14-A） */
  reassign_reason?: string;
  /** 最近一次改派操作人 ID */
  reassign_operator_id?: string;
  /** 最近一次改派时间 */
  reassign_at?: string;
  /** 线索状态 */
  status: LeadStatus;
  /** 首次触达时间 */
  first_touch_at?: string;
  /** 落地页访问次数 */
  visit_count?: number;
  /** 首次访问客户端 IP */
  first_ip?: string;
  /** 首次访问地区/归属地 */
  first_region?: string;
  /** 最近一次落地页访问时间 */
  last_visit_at?: string;
  /** 首次预约时间 */
  booked_at?: string;
  /** 转化时间 */
  converted_at?: string;
  /** 关闭原因 */
  closed_reason?: string;
  /** 备注 */
  notes?: string;
  /** 是否命中疑似重复 */
  duplicate_hint: boolean;
  /** 是否为试听阶段弱绑定家长 */
  weak_bind_parent: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// 试听预约
// ============================================

/** 试听预约状态 */
export type LeadBookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

/** 课程难度级别 */
export type LeadBookingDifficulty = 'all' | 'basic' | 'intermediate' | 'advanced';

/** 试听模式：团课（基于班级）/ 私教（基于老师时间） */
export type TrialMode = 'group' | 'private';

/** 试听预约 */
export interface LeadBooking {
  id: string;
  /** 关联线索 ID */
  lead_id: string;
  /** 临时学员 ID */
  trial_student_id: string;
  /** 试听模式：团课 / 私教 */
  trial_mode: TrialMode;
  /** 团课模式下关联的班级排课 ID */
  reference_schedule_id?: string;
  /** 团课模式下的时间偏移分钟数：0 表示跟班，-30/+30 表示半跟班 */
  time_offset_minutes?: number;
  /** 团课模式下关联的班级 ID */
  class_id?: string;
  /** 团课模式下关联的班级名称 */
  class_name?: string;
  /** 预约课程 ID */
  course_id: string;
  /** 预约课程名称 */
  course_name: string;
  /** 科目 ID */
  subject_id?: string;
  /** 科目名称 */
  subject_name?: string;
  /** 校区 ID */
  campus_id: string;
  /** 校区名称 */
  campus_name?: string;
  /** 教师 ID（试听授课老师） */
  teacher_id: string;
  /** 教师名称（试听授课老师） */
  teacher_name?: string;
  /** 线索归属老师 ID（绑定老师，可由线索派生） */
  owner_teacher_id?: string;
  /** 线索归属老师名称 */
  owner_teacher_name?: string;
  /** 预约日期 YYYY-MM-DD */
  lesson_date: string;
  /** 开始时间 HH:mm */
  start_time: string;
  /** 结束时间 HH:mm */
  end_time: string;
  /** 教室 */
  room?: string;
  /** 预约状态 */
  status: LeadBookingStatus;
  /** 课程难度（用于展示难度标签） */
  difficulty?: LeadBookingDifficulty;
  /** 预约方式：家长自助 / 老师代约 */
  booking_type: 'self' | 'proxy';
  /** 操作人 ID（代约时为老师 ID） */
  operator_id?: string;
  /** 备注 */
  note?: string;
  /** 孩子姓名（派生预约记录直接携带，无需再查线索表） */
  child_name?: string;
  /** 家长姓名 */
  parent_name?: string;
  /** 家长电话 */
  parent_phone?: string;
  created_at: string;
  updated_at: string;
}

/** 独立试听时段配置状态 */
export type TrialSlotStatus = 'active' | 'closed';

/** 独立试听时段配置 */
export interface TrialSlotConfig {
  id: string;
  /** 课程 ID */
  course_id: string;
  /** 课程名称 */
  course_name: string;
  /** 科目 ID */
  subject_id?: string;
  /** 科目名称 */
  subject_name?: string;
  /** 校区 ID */
  campus_id: string;
  /** 校区名称 */
  campus_name?: string;
  /** 教师 ID */
  teacher_id: string;
  /** 教师名称 */
  teacher_name?: string;
  /** 预约日期 YYYY-MM-DD */
  lesson_date: string;
  /** 开始时间 HH:mm */
  start_time: string;
  /** 结束时间 HH:mm */
  end_time: string;
  /** 教室 */
  room?: string;
  /** 最大试听人数 */
  max_count: number;
  /** 当前已预约人数 */
  current_count: number;
  /** 状态 */
  status: TrialSlotStatus;
  /** 创建老师 ID */
  creator_teacher_id: string;
  /** 创建老师名称 */
  creator_teacher_name?: string;
  /** 备注 */
  note?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// 跟进记录
// ============================================

/** 跟进动作类型 */
export type FollowUpAction =
  | 'phone_call' // 电话回访
  | 'wechat' // 微信追踪
  | 're_invite' // 再次邀约
  | 'push_convert' // 转化推进
  | 'other'; // 其他

/** 家长意向等级 */
export type IntentLevel = 'high' | 'medium' | 'low' | 'none';

/** 跟进记录 */
export interface LeadFollowUp {
  id: string;
  lead_id: string;
  /** 跟进动作 */
  action: FollowUpAction;
  /** 家长意向等级 */
  intent_level?: IntentLevel;
  /** 跟进内容 */
  content: string;
  /** 下次跟进时间 */
  next_follow_up_at?: string;
  /** 操作人 ID */
  operator_id: string;
  /** 操作人名称 */
  operator_name?: string;
  created_at: string;
}

// ============================================
// 转化记录
// ============================================

/** 转化方式 */
export type ConversionType = 'new_student' | 'merge_student';

/** 试听转化记录 */
export interface LeadConversion {
  id: string;
  lead_id: string;
  /** 转化方式 */
  conversion_type: ConversionType;
  /** 转化后的正式学员 ID */
  student_id: string;
  /** 合并到的已有学员 ID（合并模式） */
  merge_to_student_id?: string;
  /** 操作人 ID */
  operator_id: string;
  /** 备注 */
  note?: string;
  created_at: string;
}

// ============================================
// UI 辅助类型
// ============================================

/** 线索列表筛选 Tab（卡片上只展示 待跟进/已预约/已流失 三种） */
export type LeadFilterTab =
  | 'all' // 全部
  | 'following' // 待跟进
  | 'booked' // 已预约
  | 'closed'; // 已流失

/** 线索排序方式 */
export type LeadSort = 'latest' | 'follow_up' | 'name';

/** 线索统计摘要（与卡片展示分类保持一致） */
export interface LeadSummary {
  total: number;
  following: number;
  booked: number;
  closed: number;
  /** 今日试听数（老师视角统计用） */
  today_trial: number;
  /** 待预约数 */
  pending: number;
  /** 已转化数 */
  converted: number;
}

/** 线索卡片展示模型 */
export interface LeadCardModel {
  id: string;
  trial_student_id: string;
  child_name: string;
  child_nickname?: string;
  avatar_url?: string;
  parent_phone?: string;
  parent_name?: string;
  status: LeadStatus;
  source_type: LeadSourceType;
  booking_course_name?: string;
  owner_teacher_name?: string;
  owner_lock_status: OwnerLockStatus;
  latest_follow_up_at?: string;
  next_follow_up_at?: string;
  created_at: string;
}

/** 新增线索表单数据 */
export interface LeadFormData {
  child_name: string;
  child_nickname?: string;
  child_gender?: 'male' | 'female';
  child_age?: string;
  parent_name?: string;
  parent_phone?: string;
  campus_id: string;
  subject_id?: string;
  source_course_id?: string;
  source_type?: string;
  notes?: string;
}
