/**
 * 操作日志（审计日志）类型定义
 *
 * 设计约束（用户口径 2026-08-22）：
 * - 仅【追加】写入（append-only），不提供修改/删除接口，日志不可篡改
 * - 持久化到后端（mock 阶段落本地 storage），保留最近 90 天
 * - 高权限操作（如编辑课时）必须记录，操作人/角色/时间/详情齐全
 */

/** 值得记录的操作动作枚举 */
export type AuditAction =
  | 'lesson.checkin' // 点名签到（批量消课，汇总一条）
  | 'lesson.record' // 单人消课 / 补课登记
  | 'lesson.edit_hours' // 编辑课时（高权限，仅管理角色）
  | 'lesson.revoke' // 撤销消课
  | 'card.issue' // 会员开卡
  | 'card.recharge' // 会员卡充值/调整剩余
  | 'salary.confirm' // 薪资核对
  | 'salary.pay' // 薪资发放
  | 'salary.send_slip' // 发送工资单
  | 'permission.save' // 保存权限配置
  | 'settings.threshold' // 修改课时不足预警阈值
  | 'class.create' // 创建班级
  | 'class.dissolve' // 解散班级
  | 'lead.create' // 新建线索（谁邀请/录入的）
  | 'lead.follow' // 线索跟进（谁跟进了谁）
  | 'lead.convert' // 线索转化（谁转化了谁 → 正式学员）
  | 'student.transfer' // 学员调班
  | 'staff.add' // 新增教师
  | 'staff.resign' // 教师离职
  | 'store.apply'; // 门店入驻申请

/** 动作 → 中文标签（页面展示用） */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'lesson.checkin': '点名签到',
  'lesson.record': '单人消课/补课',
  'lesson.edit_hours': '编辑课时',
  'lesson.revoke': '撤销消课',
  'card.issue': '会员开卡',
  'card.recharge': '充值/调整剩余',
  'salary.confirm': '薪资核对',
  'salary.pay': '薪资发放',
  'salary.send_slip': '发送工资单',
  'permission.save': '保存权限配置',
  'settings.threshold': '修改预警阈值',
  'class.create': '创建班级',
  'class.dissolve': '解散班级',
  'lead.create': '新建线索',
  'lead.follow': '线索跟进',
  'lead.convert': '线索转化',
  'student.transfer': '学员调班',
  'staff.add': '新增教师',
  'staff.resign': '教师离职',
  'store.apply': '门店入驻申请',
};

/** 单条操作日志 */
export interface AuditLogEntry {
  id: string;
  /** 动作类型 */
  action: AuditAction;
  /** 动作中文标签（写入时固化，避免枚举改名导致历史显示漂移） */
  actionLabel: string;
  /** 操作人 */
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  /** 操作对象类型（如 lesson_record / member_card / salary_batch…） */
  targetType: string;
  targetId?: string;
  /** 人类可读描述（页面语言） */
  detail: string;
  /** 结构化上下文（如 before/after），便于日后对账 */
  meta?: Record<string, unknown>;
  /** 发生时间（ISO 8601） */
  createdAt: string;
}

/** 查询条件 */
export interface AuditLogQuery {
  action?: AuditAction;
  /** 操作人姓名 / 详情关键字模糊匹配 */
  keyword?: string;
  /** 操作人精确过滤（可见范围控制：非管理角色强制为自己的 id） */
  operatorId?: string;
  /** 起始日期 YYYY-MM-DD（含） */
  startDate?: string;
  /** 结束日期 YYYY-MM-DD（含） */
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/** 分页结果 */
export interface AuditLogPage {
  list: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
