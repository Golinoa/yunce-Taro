/**
 * 「我的预约」统一卡片模型
 * 各业务源映射到此结构后，由列表页做状态筛选与时间线排序。
 */

/** 预约来源类型（预留扩展，不做页面分栏） */
export type MyBookingSourceType =
  | 'trial_group'
  | 'trial_private'
  | 'class_open'
  | 'group'
  | 'private'
  | 'venue';

/** 统一状态枚举（与试听状态口径对齐，其他业务映射进来） */
export type MyBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'cancelled';

/** 跳转详情所需载荷 */
export interface MyBookingNavigatePayload {
  bookingId: string;
  leadId?: string;
  classId?: string;
  roomId?: string;
  lessonDate?: string;
  trialMode?: 'group' | 'private';
  parentBookingId?: string;
}

export interface MyBookingCard {
  id: string;
  sourceType: MyBookingSourceType;
  /** 学员 / 预约人姓名 */
  title: string;
  /** 课程名 / 班级名 / 场地名 */
  subtitle: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  status: MyBookingStatus;
  /** 为何出现在「我的」：授课 / 代约 / 场地负责人 … */
  relationLabel: string;
  /** 关联角色（权限判定用，可选） */
  relationKind?:
    | 'teacher'
    | 'operator'
    | 'owner'
    | 'venue_manager'
    | 'venue_booker'
    | 'class_teacher';
  navigatePayload: MyBookingNavigatePayload;
  /** 可选：家长电话（场地/试听） */
  phone?: string;
}

export interface MyBookingDateRange {
  startDate: string;
  endDate: string;
}
