import dayjs from 'dayjs';
import { syncTeacherView } from '@/data/mock-database';
import type {
  TeacherUIModel,
  SalaryModel,
  SalarySettings,
  TeacherAccessScope,
  TeacherIdentity,
  SalaryTemplate,
  SalaryRuleConfig,
  ApplyTemplateResult,
  SendResult,
  PayMethod,
  CategoryLessonFeeItem,
} from '@/types/teacher';
import { normalizeSalaryStatus } from '@/types/teacher';
import { isTempImagePath, uploadImage } from '@/utils/image-upload';
// 循环依赖（mock-database ↔ data/teacher）：仅在函数内/宏任务延迟后调用 syncTeacherView，初始化期安全

// ============================================
// 常量池
// ============================================

/** 头像颜色池 */
export const AVATAR_COLORS = [
  '#5EC8A8',
  '#E89BB8',
  '#6BA3D6',
  '#D4A24E',
  '#9B7ED8',
  '#F0A0A0',
  '#7BC8E8',
  '#B8D45E',
];

/** 校区列表 */
export const CAMPUS_OPTIONS = [
  { label: '全部校区', value: 'all' },
  { label: '曦绘艺术', value: 'center' },
  { label: '南区分校', value: 'south' },
  { label: '东区分校', value: 'east' },
];

/** 科目列表 */
export const SUBJECT_OPTIONS = [
  { label: '全部科目', value: 'all' },
  { label: '钢琴', value: 'piano' },
  { label: '声乐', value: 'vocal' },
  { label: '乐理', value: 'theory' },
  { label: '书法', value: 'calligraphy' },
  { label: '美术', value: 'art' },
  { label: '吉他', value: 'guitar' },
  { label: '舞蹈', value: 'dance' },
  { label: '架子鼓', value: 'drum' },
  { label: '小提琴', value: 'violin' },
];

/** 角色选项 */
export const ROLE_OPTIONS = [
  { label: '全部岗位', value: 'all' },
  { label: '主讲', value: 'lead' },
  { label: '助教', value: 'assist' },
  { label: '兼职', value: 'parttime' },
];

/** 状态选项 */
export const STATUS_OPTIONS = [
  { label: '在职', value: 'active' },
  { label: '已离职', value: 'resigned' },
  { label: '全部状态', value: 'all' },
];

/** 员工身份预设选项 */
export const TEACHER_IDENTITY_OPTIONS = [
  { label: '校长', value: 'principal' },
  { label: '老师', value: 'teacher' },
  { label: '助教', value: 'assistant' },
  { label: '前台', value: 'reception' },
];

/** 性别选项 */
export const GENDER_OPTIONS = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '保密', value: 'other' },
];

/** 身份标签色（bg 用 UnoCSS rules 定义的安全类名，text 色需在 Text 元素上单独设置） */
export const IDENTITY_TAG_MAP: Record<TeacherIdentity, { bg: string; text: string }> = {
  principal: { bg: 'bg-warning-bg', text: 'text-warning' },
  teacher: { bg: 'bg-success-bg', text: 'text-success' },
  assistant: { bg: 'bg-info-bg', text: 'text-info' },
  reception: { bg: 'bg-primary-10', text: 'text-primary' },
};

const DEFAULT_IDENTITY_MAP: Record<TeacherUIModel['role'], TeacherIdentity> = {
  lead: 'teacher',
  assist: 'assistant',
  parttime: 'teacher',
};

/** 根据总课时费生成分类课时费（默认全部归入班课，保留结构完整性） */
function buildCategoryLessonFees(totalAmount: number): CategoryLessonFeeItem[] {
  return [
    { categoryId: 'cat-group', categoryName: '团课', amount: 0, records: [] },
    { categoryId: 'cat-private', categoryName: '私教', amount: 0, records: [] },
    {
      categoryId: 'cat-class',
      categoryName: '班课',
      amount: totalAmount,
      records:
        totalAmount > 0
          ? [
              {
                date: '08-01',
                courseName: '基础班',
                hours: 2,
                amount: Math.round(totalAmount * 0.4),
              },
              {
                date: '08-05',
                courseName: '进阶班',
                hours: 1.5,
                amount: Math.round(totalAmount * 0.35),
              },
              {
                date: '08-12',
                courseName: '小组课',
                hours: 1,
                amount: Math.round(totalAmount * 0.25),
              },
            ]
          : [],
    },
  ];
}

// ============================================
// Mock 数据生成辅助
// ============================================

/** 当前年月 */
const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth() + 1;

/** 薪资月份可选范围：以当前月为基准的前后窗口，消除硬编码 07/08 与真实时钟的错位（L-04） */
function shiftMonthKey(base: string, delta: number): string {
  const [y, m] = base.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
const MOCK_CURRENT_MONTH_KEY = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
const MOCK_MIN_MONTH_KEY = shiftMonthKey(MOCK_CURRENT_MONTH_KEY, -2);
const MOCK_MAX_MONTH_KEY = shiftMonthKey(MOCK_CURRENT_MONTH_KEY, 1);

const ACCESS_SCOPE_TEXT_MAP: Record<TeacherAccessScope, string> = {
  self: '仅自己授课',
  subject: '本科目全部学员',
  org: '全机构教学数据',
};

const ACCESS_SCOPE_OVERRIDE_MAP: Record<string, TeacherAccessScope> = {
  'teacher-001': 'self',
  'teacher-002': 'subject',
  'teacher-004': 'org',
  'teacher-011': 'subject',
};

/** 生成月度发薪历史 — 仅覆盖 7 月 */
function genPayHistory(
  _months: number,
  baseAmount: number,
  variance: number = 500,
  _startMonth?: number,
): TeacherUIModel['payHistory'] {
  const history: TeacherUIModel['payHistory'] = [];
  // 仅生成 7 月的历史（7月已发放，8月待确认/待发放）
  for (let m = 7; m < CUR_MONTH; m++) {
    const amount = baseAmount + Math.round((Math.random() - 0.3) * variance);
    history.push({
      month: `${CUR_YEAR}-${String(m).padStart(2, '0')}`,
      amount,
      status: 'archived',
      paidAt: `${CUR_YEAR}-${String(m).padStart(2, '0')}-15`,
    });
  }
  return history;
}

// ============================================
// Mock 教师数据 - 覆盖各种场景
// ============================================

const rawMockTeachers: Omit<TeacherUIModel, 'accessScope' | 'accessScopeText'>[] = [
  // 在职 - 与登录账号体系对齐（BASE_TEACHERS/USERS/IDENTITIES：teacher-00x = 张/李/王/赵老师）
  {
    id: 'teacher-001',
    name: '张老师',
    avatar: '',
    identity: 'teacher',
    role: 'lead',
    roleText: '主讲',
    subject: '钢琴',
    phone: '13800000011',
    hours: 42,
    students: 18,
    classes: 6,
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    salaryStatus: 'pending',
    modelIdx: 0,
    color: AVATAR_COLORS[0],
    initial: '张',
    deductions: [],
    lateFine: 2,
    otherFine: 0,
    bonusAmount: 0,
    socialInsurance: 0,
    status: 'active',
    campusIds: ['campus-center'],
    canCrossCampus: false,
    campus: 'center',
    payHistory: genPayHistory(3, 8600, 800),
  },
  {
    id: 'teacher-002',
    name: '李老师',
    avatar: '',
    identity: 'teacher',
    role: 'lead',
    roleText: '主讲',
    subject: '声乐',
    phone: '13800000012',
    hours: 36,
    students: 15,
    classes: 5,
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    salaryStatus: 'confirmed',
    modelIdx: 0,
    color: AVATAR_COLORS[1],
    initial: '李',
    deductions: [],
    status: 'active',
    campusIds: ['campus-center'],
    canCrossCampus: false,
    campus: 'center',
    payHistory: genPayHistory(3, 7200, 600),
  },
  {
    id: 'teacher-003',
    name: '王老师',
    avatar: '',
    identity: 'teacher',
    role: 'lead',
    roleText: '主讲',
    subject: '舞蹈',
    phone: '13800000013',
    hours: 24,
    students: 10,
    classes: 4,
    base: 0,
    rate: 80,
    attend: 0,
    perf: 0,
    salaryStatus: 'confirmed',
    modelIdx: 1,
    color: AVATAR_COLORS[2],
    initial: '王',
    deductions: [],
    status: 'active',
    campusIds: ['campus-east'],
    canCrossCampus: false,
    campus: 'east',
    payHistory: genPayHistory(3, 3600, 300),
  },
  {
    id: 'teacher-004',
    name: '赵老师',
    avatar: '',
    identity: 'teacher',
    role: 'lead',
    roleText: '主讲',
    subject: '书法',
    phone: '13800000014',
    hours: 0,
    students: 0,
    classes: 0,
    base: 0,
    rate: 0,
    attend: 0,
    perf: 0,
    salaryStatus: 'confirmed',
    modelIdx: 1,
    color: AVATAR_COLORS[3],
    initial: '赵',
    deductions: [],
    status: 'active',
    campusIds: ['campus-west'],
    canCrossCampus: false,
    campus: 'west',
    payHistory: genPayHistory(3, 2400, 200),
  },
  // 机构创建者（万老师）：跨校区授课（与 USERS.user-principal-001 对应）
  {
    id: 'teacher-principal-001',
    name: '万老师',
    avatar: '',
    identity: 'principal',
    role: 'lead',
    roleText: '校长',
    subject: '',
    phone: '13800000001',
    hours: 42,
    students: 18,
    classes: 6,
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    salaryStatus: 'pending',
    modelIdx: 0,
    color: AVATAR_COLORS[0],
    initial: '万',
    deductions: [],
    lateFine: 0,
    otherFine: 0,
    bonusAmount: 0,
    socialInsurance: 0,
    status: 'active',
    campusIds: ['campus-center', 'campus-east', 'campus-west'],
    canCrossCampus: true,
    campus: 'center',
    payHistory: genPayHistory(3, 8600, 800),
  },
  // 已离职
  {
    id: 'teacher-005',
    name: '陈老师',
    avatar: '',
    identity: 'teacher',
    role: 'lead',
    roleText: '主讲',
    subject: '书法',
    phone: '13600000005',
    hours: 0,
    students: 0,
    classes: 0,
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    salaryStatus: 'archived',
    modelIdx: 0,
    color: AVATAR_COLORS[4],
    initial: '陈',
    deductions: [],
    status: 'resigned',
    campusIds: ['campus-center'],
    canCrossCampus: false,
    campus: 'center',
    resignType: 'quit',
    resignDate: '2025-06-01',
    resignReason: '个人发展',
    payHistory: genPayHistory(2, 5600, 300, 1),
  },
];

export const mockTeachers: TeacherUIModel[] = rawMockTeachers.map((teacher) => {
  const accessScope = ACCESS_SCOPE_OVERRIDE_MAP[teacher.id] || 'self';
  return {
    ...teacher,
    identity: teacher.identity ?? DEFAULT_IDENTITY_MAP[teacher.role],
    showInPrivateList: teacher.showInPrivateList ?? teacher.role === 'lead',
    promoImages: teacher.promoImages ?? [],
    lateFine: teacher.lateFine ?? 0,
    otherFine: teacher.otherFine ?? 0,
    bonusAmount: teacher.bonusAmount ?? 0,
    socialInsurance: teacher.socialInsurance ?? 0,
    companySocialInsurance: teacher.companySocialInsurance ?? 0,
    categoryLessonFees:
      teacher.categoryLessonFees ?? buildCategoryLessonFees(teacher.hours * teacher.rate),
    accessScope,
    accessScopeText: ACCESS_SCOPE_TEXT_MAP[accessScope],
  };
});

// ============================================
// Mock 工资模型
// ============================================

export const mockSalaryModels: SalaryModel[] = [
  {
    id: 'teacher-m1',
    name: '标准主讲',
    type: 'standard',
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    isDefault: true,
    teacherCount: 6,
  },
  {
    id: 'teacher-m2',
    name: '纯课时',
    type: 'hourly',
    base: 0,
    rate: 80,
    attend: 0,
    perf: 0,
    teacherCount: 8,
  },
  {
    id: 'teacher-m3',
    name: '自定义',
    type: 'custom',
    base: 0,
    rate: 0,
    attend: 0,
    perf: 0,
    teacherCount: 0,
  },
];

// ============================================
// Mock 发薪设置
// ============================================

export const mockSalarySettings: SalarySettings = {
  payDay: 15,
  pushDaysBefore: 1,
  autoConfirm: false,
  pushEnabled: true,
};

// ============================================
// Mock 排课数据
// ============================================

/** 排课数据 - 按日期分组 */

export const mockScheduleData: Record<
  string,
  Array<{
    time: string;
    title: string;
    desc: string;
    teachers: Array<{ name: string; role: 'lead' | 'assist' }>;
    rate: string;
    campus: string;
    subject: string;
  }>
> = (() => {
  // 生成本周的排课数据
  const data: Record<
    string,
    Array<{
      time: string;
      title: string;
      desc: string;
      teachers: Array<{ name: string; role: 'lead' | 'assist' }>;
      rate: string;
      campus: string;
      subject: string;
    }>
  > = {};
  const today = dayjs();

  // 周一到周五的课表模板
  const templates: Array<
    Array<{
      time: string;
      title: string;
      desc: string;
      teachers: Array<{ name: string; role: 'lead' | 'assist' }>;
      rate: string;
      campus: string;
      subject: string;
    }>
  > = [
    // 周一
    [
      {
        time: '09:00',
        title: '钢琴基础班',
        desc: 'A301教室 · 8人 · 1.5h',
        teachers: [{ name: '王老师', role: 'lead' }],
        rate: '¥120/课时',
        campus: 'center',
        subject: 'piano',
      },
      {
        time: '10:30',
        title: '声乐小组课',
        desc: 'B205教室 · 6人 · 1.5h',
        teachers: [{ name: '李老师', role: 'lead' }],
        rate: '¥100/课时',
        campus: 'center',
        subject: 'vocal',
      },
      {
        time: '14:00',
        title: '钢琴进阶班',
        desc: 'A301教室 · 5人 · 1.5h',
        teachers: [
          { name: '王老师', role: 'lead' },
          { name: '张老师', role: 'assist' },
        ],
        rate: '主讲¥120·助教¥60',
        campus: 'center',
        subject: 'piano',
      },
      {
        time: '16:00',
        title: '乐理课',
        desc: 'B102教室 · 10人 · 1h',
        teachers: [{ name: '王老师', role: 'lead' }],
        rate: '¥80/课时',
        campus: 'center',
        subject: 'theory',
      },
    ],
    // 周二
    [
      {
        time: '09:00',
        title: '声乐基础班',
        desc: 'A201教室 · 8人 · 1.5h',
        teachers: [{ name: '李老师', role: 'lead' }],
        rate: '¥100/课时',
        campus: 'center',
        subject: 'vocal',
      },
      {
        time: '10:30',
        title: '钢琴基础班',
        desc: 'B301教室 · 6人 · 1.5h',
        teachers: [
          { name: '王老师', role: 'lead' },
          { name: '张老师', role: 'assist' },
        ],
        rate: '主讲¥120·助教¥60',
        campus: 'center',
        subject: 'piano',
      },
      {
        time: '14:00',
        title: '书法班',
        desc: 'C102教室 · 8人 · 2h',
        teachers: [{ name: '陈老师', role: 'lead' }],
        rate: '¥100/课时',
        campus: 'south',
        subject: 'calligraphy',
      },
      {
        time: '16:00',
        title: '乐理课',
        desc: 'B102教室 · 10人 · 1h',
        teachers: [{ name: '王老师', role: 'lead' }],
        rate: '¥80/课时',
        campus: 'center',
        subject: 'theory',
      },
    ],
    // 周三
    [
      {
        time: '09:00',
        title: '声乐基础班',
        desc: 'A201教室 · 8人 · 1.5h',
        teachers: [{ name: '李老师', role: 'lead' }],
        rate: '¥100/课时',
        campus: 'center',
        subject: 'vocal',
      },
      {
        time: '10:30',
        title: '钢琴基础班',
        desc: 'B301教室 · 6人 · 1.5h',
        teachers: [
          { name: '王老师', role: 'lead' },
          { name: '张老师', role: 'assist' },
        ],
        rate: '主讲¥120·助教¥60',
        campus: 'center',
        subject: 'piano',
      },
      {
        time: '14:00',
        title: '美术创意课',
        desc: 'D201教室 · 10人 · 1.5h',
        teachers: [
          { name: '陈老师', role: 'lead' },
          { name: '赵老师', role: 'assist' },
        ],
        rate: '主讲¥100·助教¥50',
        campus: 'east',
        subject: 'art',
      },
      {
        time: '16:00',
        title: '吉他入门班',
        desc: 'E102教室 · 6人 · 1h',
        teachers: [{ name: '周老师', role: 'lead' }],
        rate: '¥100/课时',
        campus: 'east',
        subject: 'guitar',
      },
    ],
    // 周四
    [
      {
        time: '09:00',
        title: '声乐进阶班',
        desc: 'A201教室 · 5人 · 1.5h',
        teachers: [{ name: '李老师', role: 'lead' }],
        rate: '¥120/课时',
        campus: 'center',
        subject: 'vocal',
      },
      {
        time: '10:30',
        title: '钢琴一对一',
        desc: 'A302教室 · 1人 · 1h',
        teachers: [{ name: '王老师', role: 'lead' }],
        rate: '¥150/课时',
        campus: 'center',
        subject: 'piano',
      },
      {
        time: '14:00',
        title: '书法班',
        desc: 'C102教室 · 8人 · 2h',
        teachers: [{ name: '陈老师', role: 'lead' }],
        rate: '¥100/课时',
        campus: 'south',
        subject: 'calligraphy',
      },
      {
        time: '15:30',
        title: '舞蹈基础班',
        desc: 'F201教室 · 12人 · 1.5h',
        teachers: [{ name: '吴老师', role: 'lead' }],
        rate: '¥80/课时',
        campus: 'south',
        subject: 'dance',
      },
      {
        time: '17:00',
        title: '架子鼓课',
        desc: 'G101教室 · 4人 · 1h',
        teachers: [{ name: '周老师', role: 'lead' }],
        rate: '¥120/课时',
        campus: 'east',
        subject: 'drum',
      },
    ],
    // 周五
    [
      {
        time: '09:00',
        title: '钢琴进阶班',
        desc: 'A301教室 · 5人 · 1.5h',
        teachers: [{ name: '王老师', role: 'lead' }],
        rate: '¥150/课时',
        campus: 'center',
        subject: 'piano',
      },
      {
        time: '10:30',
        title: '小提琴启蒙班',
        desc: 'A203教室 · 4人 · 1.5h',
        teachers: [{ name: '刘老师', role: 'lead' }],
        rate: '¥120/课时',
        campus: 'center',
        subject: 'violin',
      },
      {
        time: '14:00',
        title: '美术创意课',
        desc: 'D201教室 · 10人 · 1.5h',
        teachers: [
          { name: '陈老师', role: 'lead' },
          { name: '赵老师', role: 'assist' },
        ],
        rate: '主讲¥100·助教¥50',
        campus: 'east',
        subject: 'art',
      },
      {
        time: '16:00',
        title: '吉他入门班',
        desc: 'E102教室 · 6人 · 1h',
        teachers: [{ name: '周老师', role: 'lead' }],
        rate: '¥100/课时',
        campus: 'east',
        subject: 'guitar',
      },
    ],
  ];

  for (let i = 0; i < 5; i++) {
    // 计算本周一到周五的日期
    const monday = today.startOf('week').add(1, 'day'); // 周一
    const date = monday.add(i, 'day').format('YYYY-MM-DD');
    data[date] = templates[i];
  }

  return data;
})();

// ============================================
// Mock 数据库（内存存储，支持增删改查）
// ============================================

// 教师管理库唯一数据源。用 var（无 TDZ）+ getter 兜底，容忍 ESM 循环初始化顺序差异
let _teachers: TeacherUIModel[] = [...mockTeachers];
let _salaryModels: SalaryModel[] = [...mockSalaryModels];
let _settings: SalarySettings = { ...mockSalarySettings };

/** 教师管理库唯一数据源 getter（供 mock-database 派生统一教师视图；初始化未完成时返回空数组） */
export function getManagedTeachers(): TeacherUIModel[] {
  return _teachers || [];
}

// ============================================
// 跨月内存存储（修复 L-01：非当前月视图读写同一份持久化数据，避免跨月静默丢失）
// ============================================
const monthlyTeachers: Record<string, TeacherUIModel[]> = {};

function currentMonthKey(): string {
  return `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
}

interface MonthStore {
  month: string;
  isCurrent: boolean;
  get: () => TeacherUIModel[];
  set: (next: TeacherUIModel[]) => void;
}

/**
 * 解析某月份对应的教师数据存储：
 * - 当前月 → 唯一可写源 `_teachers`
 * - 其它月 → 持久化的 `monthlyTeachers[month]`（首次访问由 genMonthSnapshot 种子，之后读写同一份，跨月不再静态重置）
 */
function getMonthStore(month?: string): MonthStore {
  const key = month && month !== currentMonthKey() ? month : currentMonthKey();
  if (key === currentMonthKey()) {
    return {
      month: key,
      isCurrent: true,
      get: () => _teachers,
      set: (next) => {
        _teachers = next;
      },
    };
  }
  if (!monthlyTeachers[key]) {
    monthlyTeachers[key] = genMonthSnapshot(key);
  }
  return {
    month: key,
    isCurrent: false,
    get: () => monthlyTeachers[key],
    set: (next) => {
      monthlyTeachers[key] = next;
    },
  };
}

/** 教师增删改后同步统一教师视图（mock-database.TEACHERS） */
function syncUnifiedTeachers() {
  syncTeacherView();
}

// 首次同步：模块求值完成后延迟到宏任务，确保 mock-database 已完成初始化
if (typeof setTimeout !== 'undefined') {
  setTimeout(() => {
    try {
      syncUnifiedTeachers();
    } catch {
      // 初始化竞态下静默（视图首次构建已含基础数据）
    }
  }, 0);
}

/** 模拟网络延迟 */
function delay(ms: number = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock API 实现
// ============================================

/** 基于月份字符串生成确定性随机数种子 (0-1) */
function monthSeed(month: string): number {
  let hash = 0;
  for (let i = 0; i < month.length; i++) {
    hash = (hash << 5) - hash + month.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

/** 生成某月份的教师薪资快照（基本信息不变，薪资数据按月份变化） */
function genMonthSnapshot(month: string): TeacherUIModel[] {
  const currentMonthKey = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
  const isFuture = month > currentMonthKey;
  const isPast = month < currentMonthKey;

  return _teachers.map((t) => {
    // 基于月份和教师 ID 生成该教师的确定性因子
    const teacherSeed = monthSeed(`${month}-${t.id}`);
    const factor = 0.7 + teacherSeed * 0.6; // 0.7 ~ 1.3

    const hours = Math.max(0, Math.round(t.hours * factor));
    const base = t.base;
    const attend = Math.round(t.attend * factor);
    const perf = Math.round(t.perf * factor);

    // 历史月份默认已归档；未来月份待核对；当前月使用内存状态
    let salaryStatus: TeacherUIModel['salaryStatus'] = normalizeSalaryStatus(t.salaryStatus);
    if (isPast) salaryStatus = 'archived';
    else if (isFuture) salaryStatus = 'pending';

    // 为不同月份生成少量扣款/奖金差异
    const deductions: TeacherUIModel['deductions'] = [];
    if (teacherSeed > 0.75) {
      deductions.push({
        id: `d-${month}-${t.id}`,
        reason: '月度奖金',
        amount: Math.round(100 + teacherSeed * 400),
        type: 'bonus',
      });
    } else if (teacherSeed < 0.15) {
      deductions.push({
        id: `d-${month}-${t.id}`,
        reason: '迟到扣款',
        amount: Math.round(50 + teacherSeed * 150),
        type: 'deduct',
      });
    }

    return {
      ...t,
      hours,
      base,
      attend,
      perf,
      salaryStatus,
      deductions,
    };
  });
}

/** 获取教师列表 */
export async function mockGetTeachers(
  campusId?: string,
  month?: string,
): Promise<TeacherUIModel[]> {
  await delay();
  const currentMonthKey = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;

  // 非 7、8 月返回空数据
  if (month && (month < MOCK_MIN_MONTH_KEY || month > MOCK_MAX_MONTH_KEY)) {
    return [];
  }
  if (!month && (currentMonthKey < MOCK_MIN_MONTH_KEY || currentMonthKey > MOCK_MAX_MONTH_KEY)) {
    return [];
  }

  let teachers = month && month !== currentMonthKey ? getMonthStore(month).get() : [..._teachers];
  if (campusId) {
    teachers = teachers.filter((t) => t.campusIds?.includes(campusId));
  }
  return teachers;
}

/** 获取在职教师列表（用于班级表单选择器） */
export async function mockGetActiveTeachers(campusId?: string): Promise<TeacherUIModel[]> {
  await delay();
  let teachers = _teachers.filter((t) => t.status === 'active');
  if (campusId) {
    teachers = teachers.filter((t) => t.campusIds?.includes(campusId));
  }
  return teachers;
}

/** 获取单个教师 */
export async function mockGetTeacherById(id: string): Promise<TeacherUIModel | null> {
  await delay(100);
  return _teachers.find((t) => t.id === id) || null;
}

/** 处理宣传图临时路径上传 */
async function normalizePromoImages(images?: string[]): Promise<string[]> {
  if (!images || images.length === 0) return [];
  return Promise.all(images.map((url) => (isTempImagePath(url) ? uploadImage(url) : url)));
}

/** 添加教师 */
export async function mockAddTeacher(
  teacher: TeacherUIModel,
  month?: string,
): Promise<TeacherUIModel> {
  await delay(200);
  const promoImages = await normalizePromoImages(teacher.promoImages);

  // 新员工未配置薪资规则时，自动套用当前默认模板；无默认模板则保持空配置
  let salaryRule = teacher.salaryRule;
  let salaryTemplateId = teacher.salaryTemplateId;
  const defaultTpl = !salaryRule ? _salaryTemplates.find((t) => t.isDefault) : undefined;
  if (defaultTpl) {
    salaryRule = { ...defaultTpl.config };
    salaryTemplateId = defaultTpl.id;

    // 更新模板使用人数
    const tplIdx = _salaryTemplates.findIndex((t) => t.id === defaultTpl.id);
    if (tplIdx !== -1) {
      _salaryTemplates[tplIdx] = {
        ..._salaryTemplates[tplIdx],
        teacherCount: (_salaryTemplates[tplIdx].teacherCount ?? 0) + 1,
      };
      _salaryTemplates = [..._salaryTemplates];
    }
  }

  const newTeacher: TeacherUIModel = {
    ...teacher,
    identity: teacher.identity ?? 'teacher',
    showInPrivateList: teacher.showInPrivateList ?? teacher.role === 'lead',
    promoImages,
    salaryRule,
    salaryTemplateId,
  };
  const store = getMonthStore(month);
  store.set([...store.get(), newTeacher]);
  if (store.isCurrent) syncUnifiedTeachers(); // 新增教师同步到统一教师视图（班级/排课/统计立即可见）
  return newTeacher;
}

/** 更新教师 */
export async function mockUpdateTeacher(
  id: string,
  updates: Partial<TeacherUIModel>,
  month?: string,
): Promise<TeacherUIModel | null> {
  await delay(200);
  const store = getMonthStore(month);
  let arr = store.get();
  const idx = arr.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const promoImages =
    updates.promoImages !== undefined ? await normalizePromoImages(updates.promoImages) : undefined;
  arr[idx] = {
    ...arr[idx],
    ...updates,
    ...(promoImages !== undefined ? { promoImages } : {}),
  };
  arr = [...arr];
  store.set(arr);
  if (store.isCurrent) syncUnifiedTeachers(); // 教师信息变更同步到统一视图（学员/班级关联名实时更新）
  return arr[idx];
}

/** 确认薪资 */
export async function mockConfirmSalary(id: string, month?: string): Promise<boolean> {
  await delay(150);
  const store = getMonthStore(month);
  const arr = store.get();
  const idx = arr.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  if (normalizeSalaryStatus(arr[idx].salaryStatus) === 'pending') {
    arr[idx] = { ...arr[idx], salaryStatus: 'confirmed' };
    store.set([...arr]);
  }
  return true;
}

/** 批量确认薪资 */
export async function mockBatchConfirm(ids: string[], month?: string): Promise<boolean> {
  await delay(200);
  const store = getMonthStore(month);
  store.set(
    store.get().map((t) => {
      const status = normalizeSalaryStatus(t.salaryStatus);
      return ids.includes(t.id) && status === 'pending' ? { ...t, salaryStatus: 'confirmed' } : t;
    }),
  );
  return true;
}

/** 生成流水单号 */
function genSerialNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  return `SAL${date}${time}${random}`;
}

/** 发放薪资 */
/** 计算教师薪资总额（含扣款/补发）；UI 展示与 mockExecutePay 实发共用同一算法，消除 B-01 实发≠展示 */
export function calcTotal(t: TeacherUIModel): number {
  // A-01：所有数值入口做 Number 兜底，NaN/undefined/空集合返回确定值而非 NaN
  const categorySum = t.categoryLessonFees?.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const lessonFee = categorySum ?? (Number(t.hours) || 0) * (Number(t.rate) || 0);
  let total = (Number(t.base) || 0) + lessonFee + (Number(t.attend) || 0) + (Number(t.perf) || 0);
  total -= t.socialInsurance || 0;
  total -= t.lateFine || 0;
  total -= t.otherFine || 0;
  total += t.bonusAmount || 0;
  t.deductions.forEach((d) => {
    total += d.type === 'bonus' ? Number(d.amount) || 0 : -(Number(d.amount) || 0);
  });
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

export async function mockExecutePay(
  ids: string[],
  remark?: string,
  payMethod?: string,
  month?: string,
): Promise<boolean> {
  await delay(200);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const monthKey = month ?? `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
  const finalPayMethod = (payMethod || 'other') as PayMethod;
  const store = getMonthStore(month);
  store.set(
    store.get().map((t) => {
      const status = normalizeSalaryStatus(t.salaryStatus);
      if (ids.includes(t.id) && status === 'sending') {
        const total = calcTotal(t);
        const serialNo = genSerialNo();
        return {
          ...t,
          salaryStatus: 'archived' as const,
          payRemark: remark || '',
          payMethod: finalPayMethod,
          paidAt: now,
          serialNo,
          payHistory: [
            ...(t.payHistory || []),
            {
              month: monthKey,
              amount: Math.max(0, total),
              status: 'archived' as const,
              paidAt: now,
              remark,
              payMethod: finalPayMethod,
              serialNo,
            },
          ],
        };
      }
      return t;
    }),
  );
  return true;
}

/** 发送工资单（供老师核对） */
export async function mockSendSalarySlip(
  ids: string[],
  remark?: string,
  month?: string,
): Promise<SendResult> {
  await delay(300);
  const result: SendResult = { success: [], failed: [] };
  const store = getMonthStore(month);
  store.set(
    store.get().map((t) => {
      const status = normalizeSalaryStatus(t.salaryStatus);
      if (!ids.includes(t.id) || status !== 'confirmed') return t;
      // 模拟极少数发送失败（没有关注公众号）
      if (t.id === 'teacher-004') {
        result.failed.push({ id: t.id, name: t.name, reason: '未关注公众号' });
      } else {
        result.success.push(t.id);
      }
      // 发送成功或失败都进入「确认中」状态，失败仅做提醒
      return {
        ...t,
        salaryStatus: 'sending' as const,
        payRemark: remark || t.payRemark,
      };
    }),
  );
  return result;
}

/** 离职教师 */
export async function mockResignTeacher(
  id: string,
  resignType: string,
  reason?: string,
): Promise<boolean> {
  await delay(200);
  _teachers = _teachers.map((t) =>
    t.id === id
      ? {
          ...t,
          status: 'resigned' as const,
          resignType: resignType as TeacherUIModel['resignType'],
          resignDate: new Date().toISOString().slice(0, 10),
          resignReason: reason,
        }
      : t,
  );
  syncUnifiedTeachers(); // 离职教师同步到统一视图
  return true;
}

/** 添加扣款/补发 */
export async function mockAddDeduction(
  teacherId: string,
  deduction: { id: string; reason: string; amount: number; type: 'deduct' | 'bonus' },
): Promise<boolean> {
  await delay(150);
  _teachers = _teachers.map((t) =>
    t.id === teacherId ? { ...t, deductions: [...t.deductions, deduction] } : t,
  );
  return true;
}

/** 更新扣款/补发 */
export async function mockUpdateDeduction(
  teacherId: string,
  deductionId: string,
  updates: { reason?: string; amount?: number; type?: 'deduct' | 'bonus' },
): Promise<boolean> {
  await delay(150);
  _teachers = _teachers.map((t) =>
    t.id === teacherId
      ? {
          ...t,
          deductions: t.deductions.map((d) => (d.id === deductionId ? { ...d, ...updates } : d)),
        }
      : t,
  );
  return true;
}

/** 删除扣款/补发 */
export async function mockDeleteDeduction(
  teacherId: string,
  deductionId: string,
): Promise<boolean> {
  await delay(150);
  _teachers = _teachers.map((t) =>
    t.id === teacherId ? { ...t, deductions: t.deductions.filter((d) => d.id !== deductionId) } : t,
  );
  return true;
}

/** 获取工资模型列表 */
export async function mockGetSalaryModels(): Promise<SalaryModel[]> {
  await delay(100);
  return [..._salaryModels];
}

/** 创建工资模型 */
export async function mockCreateSalaryModel(model: SalaryModel): Promise<SalaryModel> {
  await delay(200);
  _salaryModels = [..._salaryModels, model];
  return model;
}

/** 更新工资模型 — 切换时按薪资状态处理历史数据一致性 */
export async function mockUpdateSalaryModel(
  id: string,
  updates: Partial<SalaryModel>,
): Promise<SalaryModel | null> {
  await delay(200);
  const idx = _salaryModels.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  _salaryModels[idx] = { ..._salaryModels[idx], ...updates };
  _salaryModels = [..._salaryModels];

  // 工资模型切换后，按薪资状态处理教师历史数据一致性
  // 规则：已发放 → 冻结不变；已确认未发放 → 可重算；待确认 → 按新模型计算
  // B-04：教师以 modelIdx 关联工资模型（数组下标）。模型列表仅追加/原位更新、从不重排，
  // 故 findIndex 结果稳定；若未来支持删除/排序模型，需改为在教师上存 modelId 稳定外键。
  const newModel = _salaryModels[idx];
  _teachers = _teachers.map((t) => {
    if (t.modelIdx !== idx) return t;
    // 仅更新待确认教师的费率参数，已核对及之后状态保持不变
    if (normalizeSalaryStatus(t.salaryStatus) === 'pending') {
      return {
        ...t,
        base: newModel.base,
        rate: newModel.rate,
        attend: newModel.attend,
        perf: newModel.perf,
      };
    }
    return t;
  });

  return _salaryModels[idx];
}

/** 获取发薪设置 */
export async function mockGetSettings(): Promise<SalarySettings> {
  await delay(100);
  return { ..._settings };
}

/** 更新发薪设置 */
export async function mockUpdateSettings(
  updates: Partial<SalarySettings>,
): Promise<SalarySettings> {
  await delay(200);
  _settings = { ..._settings, ...updates };
  return { ..._settings };
}

/** 获取排课数据 */
export async function mockGetScheduleData() {
  await delay(100);
  return { ...mockScheduleData };
}

/** 重置所有 mock 数据（开发调试用） */
export function mockResetAll(): void {
  _teachers = [...mockTeachers];
  _salaryModels = [...mockSalaryModels];
  _settings = { ...mockSalarySettings };
}

// ============================================
// 薪资规则配置 — 工厂函数
// ============================================

/** 创建默认空薪资规则配置 */
export function createDefaultSalaryRule(): SalaryRuleConfig {
  return {
    baseMode: 'fixed',
    fixedBaseAmount: 0,
    baseTiers: [],
    insurance: {
      enabled: false,
      companyAmount: '',
      personalAmount: '',
    },
    lessonFeeMode: 'unified',
    unifiedLessonRate: 80,
    courseGroupFees: [
      {
        categoryId: 'cat-class',
        groupType: 'class',
        groupName: '班课',
        useRevenueShare: false,
        courses: [],
      },
      {
        categoryId: 'cat-group',
        groupType: 'group',
        groupName: '团课',
        useRevenueShare: false,
        courses: [],
      },
      {
        categoryId: 'cat-private',
        groupType: 'private',
        groupName: '私教课',
        useRevenueShare: false,
        courses: [],
      },
    ],
    attendanceTiers: [{ id: 'a1', minCount: '', maxCount: '', rate: '' }],
    lessonTierGroups: [
      {
        type: 'group',
        name: '团课课时费阶梯',
        enabled: true,
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        tiers: [{ id: 't1', threshold: '', rate: '' }],
      },
      {
        type: 'private',
        name: '私教课时费阶梯',
        enabled: true,
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        tiers: [{ id: 't2', threshold: '', rate: '' }],
      },
    ],
    perfTiers: [{ id: 'p1', threshold: '', rate: '' }],
    categoryLessonFees: [
      {
        id: 'cl-class',
        categoryId: 'cat-class',
        name: '班课',
        groupType: 'class',
        algorithm: 'default',
        fixedRate: '',
        tiers: [{ id: 'ct1', threshold: '', rate: '' }],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [{ id: 'cp1', threshold: '', rate: '' }],
        perfPayoutMode: 'revenue_share',
      },
      {
        id: 'cl-group',
        categoryId: 'cat-group',
        name: '团课',
        groupType: 'group',
        algorithm: 'default',
        fixedRate: '',
        tiers: [{ id: 'ct2', threshold: '', rate: '' }],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [{ id: 'cp2', threshold: '', rate: '' }],
        perfPayoutMode: 'revenue_share',
      },
      {
        id: 'cl-private',
        categoryId: 'cat-private',
        name: '私教课',
        groupType: 'private',
        algorithm: 'default',
        fixedRate: '',
        tiers: [{ id: 'ct3', threshold: '', rate: '' }],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [{ id: 'cp3', threshold: '', rate: '' }],
        perfPayoutMode: 'revenue_share',
      },
    ],
    categoryExtraFees: [{ id: 'e1', name: '担任助教', rate: '', description: '助教课时补贴' }],
    commissionMode: 'personal_perf',
    commissionTiers: [{ id: 'cm1', perfThreshold: '', rate: '' }],
  };
}

// ============================================
// Mock 薪资模板数据
// ============================================

/** 兼职书法老师-A档模板（默认） */
function createParttimeTemplate(): SalaryTemplate {
  return {
    id: 'tpl-001',
    name: '兼职书法老师·A档',
    summary: '兼职80/次',
    isDefault: true,
    teacherCount: 1,
    createdAt: '2026-01-15',
    updatedAt: '2026-07-20',
    config: {
      baseMode: 'fixed',
      fixedBaseAmount: 0,
      baseTiers: [],
      insurance: { enabled: false, companyAmount: '', personalAmount: '' },
      lessonFeeMode: 'unified',
      unifiedLessonRate: 80,
      courseGroupFees: [
        {
          categoryId: 'cat-class',
          groupType: 'class',
          groupName: '班课',
          useRevenueShare: false,
          courses: [],
        },
        {
          categoryId: 'cat-group',
          groupType: 'group',
          groupName: '团课',
          useRevenueShare: false,
          courses: [
            {
              id: 'c1',
              courseId: 'course-002',
              courseName: '书法基础班',
              useRevenueShare: false,
              rate: 80,
            },
          ],
        },
        {
          categoryId: 'cat-private',
          groupType: 'private',
          groupName: '私教课',
          useRevenueShare: false,
          courses: [],
        },
      ],
      attendanceTiers: [{ id: 'a1', minCount: '', maxCount: '', rate: '' }],
      lessonTierGroups: [
        {
          type: 'group',
          name: '团课课时费阶梯',
          enabled: true,
          feeBasis: 'hours',
          calcMethod: 'tier_unified',
          tiers: [{ id: 't1', threshold: '', rate: '' }],
        },
        {
          type: 'private',
          name: '私教课时费阶梯',
          enabled: true,
          feeBasis: 'hours',
          calcMethod: 'tier_unified',
          tiers: [{ id: 't2', threshold: '', rate: '' }],
        },
      ],
      perfTiers: [{ id: 'p1', threshold: '', rate: '' }],
      categoryLessonFees: [
        {
          id: 'cl-class',
          categoryId: 'cat-class',
          name: '班课',
          groupType: 'class',
          algorithm: 'default',
          fixedRate: '',
          tiers: [{ id: 'ct1', threshold: '', rate: '' }],
          feeBasis: 'hours',
          calcMethod: 'tier_unified',
          perfTiers: [{ id: 'cp1', threshold: '', rate: '' }],
          perfPayoutMode: 'revenue_share',
        },
        {
          id: 'cl-group',
          categoryId: 'cat-group',
          name: '团课',
          groupType: 'group',
          algorithm: 'default',
          fixedRate: '',
          tiers: [{ id: 'ct2', threshold: '', rate: '' }],
          feeBasis: 'hours',
          calcMethod: 'tier_unified',
          perfTiers: [{ id: 'cp2', threshold: '', rate: '' }],
          perfPayoutMode: 'revenue_share',
        },
        {
          id: 'cl-private',
          categoryId: 'cat-private',
          name: '私教课',
          groupType: 'private',
          algorithm: 'default',
          fixedRate: '',
          tiers: [{ id: 'ct3', threshold: '', rate: '' }],
          feeBasis: 'hours',
          calcMethod: 'tier_unified',
          perfTiers: [{ id: 'cp3', threshold: '', rate: '' }],
          perfPayoutMode: 'revenue_share',
        },
      ],
      categoryExtraFees: [{ id: 'e1', name: '担任助教', rate: '', description: '助教课时补贴' }],
      commissionMode: 'personal_perf',
      commissionTiers: [{ id: 'cm1', perfThreshold: '', rate: '' }],
    },
  };
}

const _mockTemplates: SalaryTemplate[] = [createParttimeTemplate()];

let _salaryTemplates: SalaryTemplate[] = [..._mockTemplates];

/** 模拟网络延迟 */
function tplDelay(ms: number = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 获取薪资模板列表 */
export async function mockGetSalaryTemplates(): Promise<SalaryTemplate[]> {
  await tplDelay(100);
  return [..._salaryTemplates];
}

/** 获取单个薪资模板 */
export async function mockGetSalaryTemplateById(id: string): Promise<SalaryTemplate | null> {
  await tplDelay(100);
  return _salaryTemplates.find((t) => t.id === id) || null;
}

/** 创建薪资模板 */
export async function mockCreateSalaryTemplate(
  data: Omit<SalaryTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<SalaryTemplate> {
  await tplDelay(200);
  const newTpl: SalaryTemplate = {
    ...data,
    id: `tpl-${Date.now()}`,
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  // 保持默认模板唯一：新模板设为默认时，取消其他模板默认状态
  if (newTpl.isDefault) {
    _salaryTemplates = _salaryTemplates.map((t) => ({ ...t, isDefault: false }));
  }
  _salaryTemplates = [..._salaryTemplates, newTpl];
  return newTpl;
}

/** 更新薪资模板 */
export async function mockUpdateSalaryTemplate(
  id: string,
  updates: Partial<Omit<SalaryTemplate, 'id'>>,
): Promise<SalaryTemplate | null> {
  await tplDelay(200);
  const idx = _salaryTemplates.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  // 保持默认模板唯一：当前模板设为默认时，取消其他模板默认状态
  if (updates.isDefault) {
    _salaryTemplates = _salaryTemplates.map((t) => (t.id === id ? t : { ...t, isDefault: false }));
  }

  _salaryTemplates[idx] = {
    ..._salaryTemplates[idx],
    ...updates,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  _salaryTemplates = [..._salaryTemplates];
  return _salaryTemplates[idx];
}

/** 删除薪资模板（默认模板也可删除，删除后不再自动指定新的默认模板） */
export async function mockDeleteSalaryTemplate(id: string): Promise<boolean> {
  await tplDelay(200);
  const idx = _salaryTemplates.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  _salaryTemplates = _salaryTemplates.filter((t) => t.id !== id);
  return true;
}

/** 套用薪资模板到多个教师 */
export async function mockApplySalaryTemplate(
  templateId: string,
  teacherIds: string[],
): Promise<ApplyTemplateResult> {
  await tplDelay(300);
  const tpl = _salaryTemplates.find((t) => t.id === templateId);
  if (!tpl) return { success: false, appliedIds: [], message: '模板不存在' };

  const applied: string[] = [];
  const failed: string[] = [];

  _teachers = _teachers.map((t) => {
    if (!teacherIds.includes(t.id)) return t;
    applied.push(t.id);
    return {
      ...t,
      salaryRule: { ...tpl.config },
      salaryTemplateId: tpl.id,
    };
  });

  // 更新模板 teacherCount
  const tplIdx = _salaryTemplates.findIndex((t) => t.id === templateId);
  if (tplIdx !== -1) {
    _salaryTemplates[tplIdx] = {
      ..._salaryTemplates[tplIdx],
      teacherCount: _teachers.filter((t) => t.salaryTemplateId === templateId).length,
    };
    _salaryTemplates = [..._salaryTemplates];
  }

  return {
    success: true,
    appliedIds: applied,
    failedIds: failed,
    message: `成功套用给 ${applied.length} 位教练`,
  };
}

/** 获取教师薪资规则配置 */
export async function mockGetTeacherSalaryRule(
  teacherId: string,
): Promise<SalaryRuleConfig | null> {
  await tplDelay(100);
  const teacher = _teachers.find((t) => t.id === teacherId);
  if (!teacher) return null;
  // 如果教师有套用模板或自定义规则
  if (teacher.salaryRule) return { ...teacher.salaryRule };
  // 如果有模板ID
  if (teacher.salaryTemplateId) {
    const tpl = _salaryTemplates.find((t) => t.id === teacher.salaryTemplateId);
    if (tpl) return { ...tpl.config };
  }
  // 返回默认配置
  return createDefaultSalaryRule();
}

/** 更新教师薪资规则配置 */
export async function mockUpdateTeacherSalaryRule(
  teacherId: string,
  config: SalaryRuleConfig,
  templateId?: string,
): Promise<boolean> {
  await tplDelay(200);
  const idx = _teachers.findIndex((t) => t.id === teacherId);
  if (idx === -1) return false;
  _teachers[idx] = {
    ..._teachers[idx],
    salaryRule: { ...config },
    salaryTemplateId: templateId,
  };
  _teachers = [..._teachers];

  // 更新模板 teacherCount
  if (templateId) {
    const tplIdx = _salaryTemplates.findIndex((t) => t.id === templateId);
    if (tplIdx !== -1) {
      _salaryTemplates[tplIdx] = {
        ..._salaryTemplates[tplIdx],
        teacherCount: _teachers.filter((t) => t.salaryTemplateId === templateId).length,
      };
      _salaryTemplates = [..._salaryTemplates];
    }
  }
  return true;
}

/** 把当前教师的薪资规则配置复制给其他教师（不创建模板） */
export async function mockCopySalaryRuleToTeachers(
  sourceTeacherId: string,
  targetTeacherIds: string[],
): Promise<{ success: boolean; copiedIds: string[]; failedIds: string[]; message?: string }> {
  await tplDelay(300);
  const source = _teachers.find((t) => t.id === sourceTeacherId);
  if (!source)
    return { success: false, copiedIds: [], failedIds: targetTeacherIds, message: '源员工不存在' };

  const ruleToCopy = source.salaryRule ? { ...source.salaryRule } : createDefaultSalaryRule();
  const copiedIds: string[] = [];
  const failedIds: string[] = [];

  _teachers = _teachers.map((t) => {
    if (!targetTeacherIds.includes(t.id)) return t;
    if (t.id === sourceTeacherId) return t;
    copiedIds.push(t.id);
    return {
      ...t,
      salaryRule: ruleToCopy,
      salaryTemplateId: source.salaryTemplateId,
    };
  });

  targetTeacherIds.forEach((id) => {
    if (id === sourceTeacherId) return;
    if (!copiedIds.includes(id)) failedIds.push(id);
  });

  return {
    success: failedIds.length === 0,
    copiedIds,
    failedIds,
    message: `成功复制给 ${copiedIds.length} 位员工`,
  };
}
