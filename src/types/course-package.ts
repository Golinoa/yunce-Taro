/**
 * 课时套餐状态
 */
export type PackageStatus = 'active' | 'completed' | 'expired' | 'frozen';

/**
 * 收费方式
 */
export type FeeMethod = 'cash' | 'transfer' | 'wechat' | 'alipay' | 'other';

/**
 * 课程包模板类型
 */
export type PackageType = 'hour_package' | 'term' | 'monthly' | 'trial';

/**
 * 分期计划项
 */
export interface ScheduleItem {
  period: number;
  amount: string;
  date: string;
  reminder: boolean;
}

/**
 * 课程包模板 (course_package_templates 表)
 * 教师创建的可复用课包模板，创建班级时可关联
 *
 * 各类型字段规则（统一用 valid_days 管理有效期）：
 * - 课时包(hour_package): lesson_count必填, valid_days选填(0=永久)
 * - 期课(term): lesson_count必填, valid_days必填(如45天)
 * - 月卡(monthly): valid_days必填(默认30), lesson_count选填(0=不限)
 * - 体验课(trial): lesson_count默认1, valid_days默认7
 *
 * 实际起止日期在学生购买时计算：start_date=购买日, end_date=购买日+valid_days
 */
export interface CoursePackageTemplate {
  id: string;
  teacher_id: string;
  name: string; // 课程包名称，如"暑假特训课包"
  type: PackageType; // 类型：课时包/期课/月卡/体验课
  price: number; // 价格（元）
  lesson_count: number; // 包含课时数（0表示不限）
  duration: number; // 每节课时长（分钟）
  valid_days?: number; // 有效天数（0=永久，期课/月卡必填，体验课默认7）
  subject_id?: string; // 关联科目ID
  description?: string; // 描述
  created_at: string;
  updated_at: string;
}

/**
 * 课时套餐 (course_packages 表)
 * 学生购买的具体课包实例，消课时自动扣减
 *
 * 购买时由模板的 valid_days 计算出 start_date 和 end_date
 * 课时拆分为购买/赠送两部分，消课按 FIFO 先扣购买再扣赠送
 */
export interface CoursePackage {
  id: string;
  teacher_id: string;
  student_id: string;
  name: string;
  type?: PackageType; // 课包类型（来自模板）
  total_hours: number;
  remaining_hours: number; // 总剩余（= purchased_remaining + bonus_remaining）
  /** 购买课时剩余（FIFO 优先扣减） */
  purchased_remaining: number;
  /** 赠送课时剩余（购买课时扣完后才扣减） */
  bonus_remaining: number;
  status: PackageStatus;
  valid_days?: number; // 有效天数（来自模板）
  start_date?: string; // 有效期开始日期（购买时设置）
  end_date?: string; // 有效期结束日期（= start_date + valid_days）
  expiry_date?: string; // 过期日期（兼容旧字段，同 end_date）
  fee_amount?: number;
  fee_method?: FeeMethod;
  note?: string;
  created_at: string;
  updated_at: string;

  // 科目关联（可选，用于课包自动匹配）
  subject_id?: string; // 关联科目ID，null=通用课包
  package_role?: 'owner' | 'sharer'; // 拥有/共享
  shared_with?: string[]; // 共享人列表
  package_tag?: 'hour' | 'gift'; // 课时包/赠送

  // 充值相关（新增）
  template_id?: string; // 关联课包模板ID
  gift_hours?: number; // 赠送课时（不计入收费）
  installment_enabled?: boolean; // 是否分期
  installment_period?: number; // 分期期数
  installment_schedule?: ScheduleItem[]; // 分期计划
}

/**
 * 充值表单数据
 */
export interface RechargeFormData {
  student_id: string;
  template_id?: string;
  name: string;
  total_hours: number;
  valid_days?: number;
  gift_hours?: number;
  fee_amount?: number;
  fee_method?: FeeMethod;
  installment_enabled?: boolean;
  installment_period?: number;
  installment_schedule?: ScheduleItem[];
  note?: string;
  subject_id?: string;
}

/**
 * 退费表单数据
 */
export interface RefundFormData {
  student_id: string;
  package_id: string;
  refund_amount: number;
  reason: string;
  operator_id?: string;
  operator_name?: string;
}

/**
 * 课包流水类型
 */
export type PackageTransactionType = 'recharge' | 'refund';

/**
 * 课包流水记录
 * 统一承载充值和退费，便于学生详情与全局流水页共用
 */
export interface PackageTransaction {
  id: string;
  type: PackageTransactionType;
  student_id: string;
  student_name: string;
  /** 学员头像（引用学员 avatar，禁止用姓名首字冒充） */
  student_avatar?: string;
  package_id?: string;
  package_name?: string;
  purchased_hours?: number;
  gift_hours?: number;
  fee_amount?: number;
  fee_method?: FeeMethod;
  refund_amount?: number;
  reason?: string;
  note?: string;
  operator_id?: string;
  operator_name?: string;
  purchased_remaining_snapshot?: number;
  bonus_remaining_snapshot?: number;
  created_at: string;
}

/**
 * 扣减结果。
 * 注意：当前 BE `POST /course-packages/:id/deduct` 只返回课包 remainingHours，
 * **不返回** FIFO 购买/赠送拆分；`fifoSplitKnown=false` 时勿把 purchased/bonus 当真实拆分。
 */
export interface DeductResult {
  /** 购买课时扣减量（fifoSplitKnown=false 时仅为兼容占位，勿业务依赖） */
  purchased_deduct: number;
  /** 赠送课时扣减量（fifoSplitKnown=false 时为 0 占位） */
  bonus_deduct: number;
  /** 购买课时剩余（未拆分时回填 remaining_hours） */
  purchased_remaining: number;
  /** 赠送课时剩余（未拆分时为 0） */
  bonus_remaining: number;
  /** 总剩余（与后端 remainingHours 对齐，可信） */
  remaining_hours: number;
  /** 后端是否返回了 FIFO 拆分明细 */
  fifoSplitKnown: boolean;
}
