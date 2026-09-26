/**
 * 学生信息 (students 表)
 */
import type { FeeMethod, PackageStatus, PackageType } from './course-package';

/**
 * 学员联系方式（最多 5 条）。
 *
 * 结构与 `@/components/ContactList` 的 `ContactItem` **保持一致**，
 * 否则表单状态无法直接作为请求载荷提交。
 */
export interface StudentContact {
  id: string;
  relation: string;
  phone: string;
}

/**
 * 推荐关系里的「对方学员」最小引用（B9 / R8）。
 *
 * 只带 `id / name / status` —— 够展示与跳转，**不携带他人档案明细**。
 */
export interface StudentRelationRef {
  id: string;
  name: string;
  /** ACTIVE / GRADUATED / INACTIVE；INACTIVE 表示已删除（前端应剔除或标注） */
  status: 'ACTIVE' | 'GRADUATED' | 'INACTIVE';
}

export interface Student {
  id: string;
  name: string;
  teacher_id: string;
  /**
   * 学员邀请码（家长绑定用）。
   *
   * **由后端生成**（`pickUniqueStudentInviteCode`），前端不自造、也不提交 ——
   * 此前表单会生成一个随机码放进载荷，但 `mapStudentPayload` 的白名单里没有这个键，
   * 从未上过网络（2026-09-27 review 已清理）。因此这里允许缺省。
   * 读取侧一律走 `resolveInviteCode()` 或 `?.trim()`，已有空值兜底。
   */
  invite_code?: string;
  avatar_url?: string;
  nickname?: string;
  /** 与当前家长的亲属关系（儿子/女儿等），家长端子女卡片展示用 */
  relation?: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: string;
  phone?: string;
  address?: string;
  note?: string;
  parent_id?: string;
  fee_amount?: number;
  fee_method?: FeeMethod;
  /** 所属校区 ID */
  campus_id?: string;
  /** 所属校区名称（冗余展示） */
  campus_name?: string;
  /**
   * 推荐人学员 ID（B9 / R8，**只记关系、无奖励**）。
   * 提交语义：`undefined` = 不修改；`null` = 明确清除；字符串 = 设置。
   */
  referrer_student_id?: null | string;
  /**
   * 推荐人（详情接口回传，仅员工侧返回，家长端没有该字段）。
   * `status` 用于判断是否已软删除。
   */
  referrer_student?: null | StudentRelationRef;
  /** 被推荐人（谁是他推荐来的）；仅员工侧返回 */
  referred_students?: StudentRelationRef[];
  /** 联系方式（最多 5 条） */
  contacts?: StudentContact[];
  /** 已加入的班级 ID 列表（空表示尚未排班） */
  class_ids?: string[];
  status?: 'active' | 'deleted';
  created_at: string;
  updated_at: string;
  // 关联查询字段
  course_packages?: {
    id: string;
    name: string;
    type?: PackageType;
    total_hours: number;
    remaining_hours: number;
    purchased_remaining: number;
    bonus_remaining: number;
    status?: PackageStatus;
    subject_id?: string;
    fee_amount?: number;
    fee_method?: FeeMethod;
    note?: string;
    created_at: string;
  }[];
}

/**
 * 家长-学生绑定关系 (student_parents 表)
 */
export interface StudentParent {
  id: string;
  student_id: string;
  parent_id: string;
  parent?: {
    id: string;
    name: string;
    phone?: string;
    avatar_url?: string;
  };
  created_at: string;
}

// ============================================
// 学员管理 - 排序 / 筛选 / 统计 类型
// ============================================

/** 排序类型 */
export type StudentSort = 'default' | 'hours-desc' | 'hours-asc' | 'name-asc' | 'name-desc';

/** 课时状态筛选 */
export type StudentFilter = 'all' | 'sufficient' | 'low' | 'expiring' | 'expired' | 'owe';

/** 科目筛选 */
export type SubjectFilter = string;

/** 课包标签（卡片展示用） */
export interface PackageTag {
  name: string;
  remainingHours: number;
  color: 'primary' | 'amber' | 'danger' | 'purple' | 'accent' | 'info';
}

/** 欠课信息 */
export interface OweInfo {
  /** 缺课节数 */
  oweCount: number;
  /** 缺课日期列表 */
  oweDates: string[];
}

/** 学员课时进度 */
export interface StudentProgress {
  used: number;
  total: number;
  percentage: number;
  status: 'normal' | 'warn' | 'danger';
}

/** 统计摘要 */
export interface StudentSummary {
  total: number;
  sufficient: number;
  low: number;
  owe: number;
}

/** 学员卡片状态 */
export type StudentCardStatus = 'sufficient' | 'low' | 'expiring' | 'expired' | 'owe';

/** 排序选项配置 */
export const SORT_OPTIONS: { value: StudentSort; label: string }[] = [
  { value: 'default', label: '默认排序' },
  { value: 'hours-desc', label: '课时从多到少' },
  { value: 'hours-asc', label: '课时从少到多' },
  { value: 'name-asc', label: '姓名A-Z' },
  { value: 'name-desc', label: '姓名Z-A' },
];

/** 课时状态筛选选项 */
export const FILTER_OPTIONS: { value: StudentFilter; label: string; dotColor: string }[] = [
  { value: 'all', label: '全部', dotColor: '#a0b8ad' },
  { value: 'sufficient', label: '课时充足', dotColor: '#5EC8A8' },
  { value: 'low', label: '课时不足', dotColor: '#d4a24e' },
  { value: 'expiring', label: '即将过期', dotColor: '#6ba3d6' },
  { value: 'expired', label: '已过期', dotColor: '#D94040' },
  { value: 'owe', label: '欠课', dotColor: '#e88aaa' },
];

/** 科目筛选选项 */
export const SUBJECT_OPTIONS: { value: SubjectFilter; label: string }[] = [
  { value: 'all', label: '全部科目' },
  { value: 'piano', label: '钢琴' },
  { value: 'vocal', label: '声乐' },
  { value: 'theory', label: '乐理' },
  { value: 'calligraphy', label: '书法' },
  { value: 'general', label: '通用' },
];
