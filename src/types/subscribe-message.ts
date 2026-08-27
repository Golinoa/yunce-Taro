/**
 * 微信订阅消息 — 类型定义
 * 契约：docs/todo/09-subscribe-message-api-contract.md
 */

export type SubscribeTemplateGroup =
  | 'class_remind'
  | 'schedule_change'
  | 'lesson_result'
  | 'todo_remind'
  | 'package_alert'
  | 'approval_pending'
  | 'approval_result'
  | 'calendar_add'
  | 'calendar_change'
  | 'org_membership_alert'
  | 'org_membership_renew_result';

export type SubscribeAuthStatus = 'accept' | 'reject' | 'ban' | 'filter';

export type SubscribeFlowId =
  | 'E01'
  | 'E02A'
  | 'E03'
  | 'E04'
  | 'E05'
  | 'E06'
  | 'E07'
  | 'E08'
  | 'E09'
  | 'E10'
  | 'E11'
  | 'E12'
  | 'E18'
  | 'E19'
  | 'E20'
  | 'E21'
  | 'E22'
  | 'E23'
  | 'E24'
  | 'E25';

export type SubscribePromptPresetId =
  | 'student_created'
  | 'student_join_class_op'
  | 'student_join_class_teacher'
  | 'student_join_class_parent'
  | 'bind_child'
  | 'post_class_parent'
  | 'recharge_success'
  | 'card_issue_success'
  | 'class_created'
  | 'lead_created'
  | 'teacher_created'
  | 'salary_slip_send'
  | 'collab_todo_new'
  | 'teacher_missed_wechat'
  | 'quota_depleted'
  | 'quota_reactivate'
  | 'booking_success_remind_auth'
  | 'calendar_sync_enable';

export type SubscribeRenewPresetId =
  | 'checkin_renew'
  | 'schedule_renew'
  | 'class_view_renew'
  | 'post_class_renew'
  | 'lead_follow_renew'
  | 'salary_confirm_renew';

export type SubscribePromptAction = 'primary' | 'secondary' | 'tertiary' | 'dismiss';

export type SubscribeSheetAction = 'primary' | 'secondary' | 'dismiss';

export interface SubscribeQuotaDto {
  group: SubscribeTemplateGroup;
  tmplId: string;
  remain: number;
  lowThreshold: number;
  notifyEnabled: boolean;
  displayCoveredUntil?: string;
  needsReactivate?: boolean;
}

export interface SubscribePendingPromptDto {
  id: string;
  presetId: SubscribePromptPresetId;
  eventCode: string;
  payload: Record<string, string>;
  templateGroups: SubscribeTemplateGroup[];
  scene: string;
  priority: number;
}

export interface SubscribeBootstrapDto {
  templates: Array<{
    group: SubscribeTemplateGroup;
    tmplId: string;
    title: string;
    enabled: boolean;
  }>;
  quotas: SubscribeQuotaDto[];
  pendingPrompts: SubscribePendingPromptDto[];
  lowQuotaGroups: SubscribeTemplateGroup[];
}

export interface SubscribeAuthReportItem {
  tmplId: string;
  group: SubscribeTemplateGroup;
  status: SubscribeAuthStatus;
}

export interface SubscribeAuthReportBody {
  scene: string;
  role?: string;
  campusId?: string;
  items: SubscribeAuthReportItem[];
  clientRequestId: string;
  userId?: string;
}

export interface SubscribeAuthReportResult {
  quotas: SubscribeQuotaDto[];
}

export interface SubscribeFlowContext {
  studentId?: string;
  studentName?: string;
  childName?: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  campusId?: string;
  role?: string;
  title?: string;
  groupLabel?: string;
  /** 预约成功文案，如「团课·泳班初级」 */
  bookingLabel?: string;
  /** 薪资批次人数等 */
  count?: string;
  navigateUrl?: string;
}

export interface OpenPromptInput {
  presetId: SubscribePromptPresetId;
  variables?: Record<string, string>;
  tertiaryText?: string;
  showTertiary?: boolean;
}

export interface OpenRenewSheetInput {
  presetId: SubscribeRenewPresetId;
  scene: string;
  groups: SubscribeTemplateGroup[];
  role?: string;
  campusId?: string;
}
