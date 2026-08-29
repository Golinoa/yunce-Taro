/**
 * 订阅消息弹框/弹窗文案预设（业务页只传 presetId）
 */
import type {
  SubscribePromptPresetId,
  SubscribeRenewPresetId,
  SubscribeTemplateGroup,
} from '@/types/subscribe-message';

export const SUBSCRIBE_TEMPLATE_GROUPS: SubscribeTemplateGroup[] = [
  'class_remind',
  'schedule_change',
  'lesson_result',
  'todo_remind',
  'package_alert',
  'approval_pending',
  'approval_result',
  'calendar_add',
  'calendar_change',
  'org_membership_alert',
  'org_membership_renew_result',
];

export const SUBSCRIBE_GROUP_LABELS: Record<SubscribeTemplateGroup, string> = {
  class_remind: '上课提醒',
  schedule_change: '课表变动',
  lesson_result: '上课情况',
  todo_remind: '待办提醒',
  package_alert: '课时账户',
  approval_pending: '待审批',
  approval_result: '审批结果',
  calendar_add: '日程同步',
  calendar_change: '日程变更',
  org_membership_alert: '机构会员到期',
  org_membership_renew_result: '机构续费结果',
};

/** Mock / 联调前占位模板 ID */
export const MOCK_TMPL_IDS: Record<SubscribeTemplateGroup, string> = {
  class_remind: 'mock-tmpl-class-remind',
  schedule_change: 'mock-tmpl-schedule-change',
  lesson_result: 'mock-tmpl-lesson-result',
  todo_remind: 'mock-tmpl-todo-remind',
  package_alert: 'mock-tmpl-package-alert',
  approval_pending: 'mock-tmpl-approval-pending',
  approval_result: 'mock-tmpl-approval-result',
  calendar_add: 'mock-tmpl-calendar-add',
  calendar_change: 'mock-tmpl-calendar-change',
  org_membership_alert: 'mock-tmpl-org-membership',
  org_membership_renew_result: 'mock-tmpl-org-membership-renew',
};

export interface SubscribePromptPresetConfig {
  title: string;
  body: string;
  primaryText: string;
  secondaryText: string;
  tertiaryText?: string;
  groups: readonly SubscribeTemplateGroup[];
  scene: string;
  primaryAction: 'requestAuth' | 'navigate' | 'dismissOnly';
}

export const PROMPT_PRESETS: Record<SubscribePromptPresetId, SubscribePromptPresetConfig> = {
  student_created: {
    title: '跟进提醒',
    body: '已为 {studentName} 建档。是否开启跟进提醒？课时不足或到期时将通过微信服务通知您。',
    primaryText: '开启提醒',
    secondaryText: '暂不需要',
    groups: ['todo_remind', 'package_alert'],
    scene: 'student_create_success',
    primaryAction: 'requestAuth',
  },
  student_join_class_op: {
    title: '班级变动',
    body: '学员已加入 {className}。是否订阅班级变动提醒？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    tertiaryText: '查看班级',
    groups: ['schedule_change', 'class_remind'],
    scene: 'class_assign_op',
    primaryAction: 'requestAuth',
  },
  student_join_class_teacher: {
    title: '任课提醒',
    body: '学员 {studentName} 已加入您任课的 {className}。是否订阅任课提醒？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    tertiaryText: '查看班级',
    groups: ['class_remind', 'schedule_change', 'todo_remind'],
    scene: 'class_assign_teacher',
    primaryAction: 'requestAuth',
  },
  student_join_class_parent: {
    title: '上课提醒',
    body: '{childName} 已进入班级 {className}。是否订阅上课提醒？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    groups: ['class_remind', 'schedule_change', 'lesson_result'],
    scene: 'class_assign_parent',
    primaryAction: 'requestAuth',
  },
  bind_child: {
    title: '孩子通知',
    body: '是否接收 {childName} 的上课与课时通知？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    groups: ['lesson_result', 'class_remind', 'package_alert'],
    scene: 'bind_child',
    primaryAction: 'requestAuth',
  },
  post_class_parent: {
    title: '课程完成',
    body: '{childName} 本节课程已完成。是否订阅点名结果通知？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    groups: ['lesson_result', 'class_remind'],
    scene: 'post_class_parent',
    primaryAction: 'requestAuth',
  },
  recharge_success: {
    title: '续费跟进',
    body: '是否为 {studentName} 开启续费跟进提醒？',
    primaryText: '开启提醒',
    secondaryText: '稍后',
    tertiaryText: '邀请家长',
    groups: ['package_alert', 'todo_remind'],
    scene: 'package_recharge_success',
    primaryAction: 'requestAuth',
  },
  card_issue_success: {
    title: '开卡跟进',
    body: '是否为 {studentName} 开启开卡跟进提醒？',
    primaryText: '开启提醒',
    secondaryText: '稍后',
    tertiaryText: '邀请家长',
    groups: ['package_alert', 'todo_remind'],
    scene: 'member_card_issue_success',
    primaryAction: 'requestAuth',
  },
  class_created: {
    title: '班级提醒',
    body: '是否订阅班级课表与变动提醒？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    groups: ['schedule_change', 'todo_remind'],
    scene: 'class_create_success',
    primaryAction: 'requestAuth',
  },
  lead_created: {
    title: '跟进提醒',
    body: '是否订阅线索跟进到期提醒？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    groups: ['todo_remind'],
    scene: 'lead_create_success',
    primaryAction: 'requestAuth',
  },
  teacher_created: {
    title: '人事提醒',
    body: '已为 {teacherName} 建档。是否订阅待办与发薪相关提醒？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    groups: ['todo_remind'],
    scene: 'teacher_create_success',
    primaryAction: 'requestAuth',
  },
  salary_slip_send: {
    title: '工资单已发送',
    body: '已为 {count} 位员工发送工资单。是否订阅下月发薪提醒？',
    primaryText: '订阅提醒',
    secondaryText: '稍后',
    groups: ['todo_remind'],
    scene: 'salary_slip_sent',
    primaryAction: 'requestAuth',
  },
  collab_todo_new: {
    title: '新待办',
    body: '你有新的待办：{title}',
    primaryText: '查看待办',
    secondaryText: '稍后',
    groups: [],
    scene: 'collab_todo_entry',
    primaryAction: 'navigate',
  },
  teacher_missed_wechat: {
    title: '任课通知',
    body: '您有任课班级事项未通过微信发出（可发送次数不足）。',
    primaryText: '查看班级',
    secondaryText: '稍后',
    groups: [],
    scene: 'teacher_missed_wechat',
    primaryAction: 'navigate',
  },
  quota_depleted: {
    title: '次数已用完',
    body: '{groupLabel} 的微信服务通知次数为 0。上课、点名、待办等重要事项仍会在小程序内通知您。是否补充订阅消息授权？',
    primaryText: '去补充授权',
    secondaryText: '知道了',
    groups: [],
    scene: 'quota_depleted_prompt',
    primaryAction: 'navigate',
  },
  quota_reactivate: {
    title: '继续提醒',
    body: '还要继续收到 {groupLabel} 的微信提醒吗？',
    primaryText: '继续提醒',
    secondaryText: '关闭这类提醒',
    groups: [],
    scene: 'quota_reactivate',
    primaryAction: 'navigate',
  },
  booking_success_remind_auth: {
    title: '预约成功',
    body: '{bookingLabel} 已预约成功。是否开启开始前提醒？',
    primaryText: '开启提醒',
    secondaryText: '暂不需要',
    groups: ['class_remind'],
    scene: 'booking_success_remind',
    primaryAction: 'requestAuth',
  },
  calendar_sync_enable: {
    title: '日历同步',
    body: '开启后，将自动把未来一周课表写入手机日历，并在课表变动时同步更新。',
    primaryText: '开启同步',
    secondaryText: '暂不',
    groups: ['calendar_add', 'calendar_change'],
    scene: 'calendar_sync_enable',
    primaryAction: 'requestAuth',
  },
  login_opt_in: {
    title: '开启消息通知',
    body: '同意后，小程序可通过微信服务通知向您推送上课、调课、点名等提醒。授权成功将同时攒下可发送次数。',
    primaryText: '开启并授权',
    secondaryText: '暂不开启',
    groups: ['class_remind', 'schedule_change', 'lesson_result', 'todo_remind'],
    scene: 'login_opt_in',
    primaryAction: 'requestAuth',
  },
};

export interface SubscribeRenewPresetConfig {
  title: string;
  body: string;
  primaryText: string;
  secondaryText: string;
  groups: readonly SubscribeTemplateGroup[];
}

export const RENEW_PRESETS: Record<SubscribeRenewPresetId, SubscribeRenewPresetConfig> = {
  checkin_renew: {
    title: '补充可发送次数',
    body: '是否为下次上课与点名提醒补充 1 次可发送次数？',
    primaryText: '补充 1 次',
    secondaryText: '下次再说',
    groups: ['todo_remind', 'class_remind', 'lesson_result'],
  },
  schedule_renew: {
    title: '课表已更新',
    body: '是否为下次变动提醒补充 1 次可发送次数？',
    primaryText: '补充 1 次',
    secondaryText: '下次再说',
    groups: ['schedule_change', 'class_remind'],
  },
  class_view_renew: {
    title: '上课提醒',
    body: '是否为上课提醒补充 1 次可发送次数？',
    primaryText: '补充 1 次',
    secondaryText: '下次再说',
    groups: ['class_remind'],
  },
  post_class_renew: {
    title: '继续加油',
    body: '是否为下次上课提醒补充 1 次可发送次数？',
    primaryText: '补充 1 次',
    secondaryText: '下次再说',
    groups: ['class_remind'],
  },
  lead_follow_renew: {
    title: '跟进提醒',
    body: '是否为下次跟进提醒补充 1 次可发送次数？',
    primaryText: '补充 1 次',
    secondaryText: '下次再说',
    groups: ['todo_remind'],
  },
  salary_confirm_renew: {
    title: '薪资已核对',
    body: '是否为下月发薪提醒补充 1 次可发送次数？',
    primaryText: '补充 1 次',
    secondaryText: '下次再说',
    groups: ['todo_remind'],
  },
};

const FLOW_PRESET_MAP: Partial<Record<string, SubscribePromptPresetId>> = {
  E01: 'student_created',
  E02A: 'student_join_class_op',
  E03: 'bind_child',
  E06: 'class_created',
  E08: 'recharge_success',
  E09: 'card_issue_success',
  E10: 'lead_created',
  E11: 'teacher_created',
  E21: 'booking_success_remind_auth',
  E22: 'booking_success_remind_auth',
  E23: 'booking_success_remind_auth',
  E24: 'booking_success_remind_auth',
  E19: 'calendar_sync_enable',
};

/** E21–E24 各用独立 scene 上报 auth */
export const BOOKING_FLOW_SCENES: Partial<Record<string, string>> = {
  E21: 'group_booking_success',
  E22: 'private_booking_success',
  E23: 'venue_booking_success',
  E24: 'trial_booking_success',
};

export function getBookingFlowScene(flowId: string): string {
  return BOOKING_FLOW_SCENES[flowId] ?? 'booking_success_remind';
}

export function getFlowPresetId(flowId: string): SubscribePromptPresetId | undefined {
  return FLOW_PRESET_MAP[flowId];
}

/** 将 preset body 中的 {key} 替换为变量 */
export function formatPresetText(
  template: string,
  variables: Record<string, string> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => variables[key] ?? `{${key}}`);
}

export function getPromptPreset(presetId: SubscribePromptPresetId): SubscribePromptPresetConfig {
  const preset = PROMPT_PRESETS[presetId];
  if (!preset) {
    throw new Error(`未知订阅弹框 preset: ${presetId}`);
  }
  return preset;
}

export function getRenewPreset(presetId: SubscribeRenewPresetId): SubscribeRenewPresetConfig {
  const preset = RENEW_PRESETS[presetId];
  if (!preset) {
    throw new Error(`未知订阅弹窗 preset: ${presetId}`);
  }
  return preset;
}
