import dayjs from 'dayjs';
import type {
  TeacherUIModel,
  SalaryModel,
  SalarySettings,
  TeacherAccessScope,
} from '@/types/teacher';

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
  { label: '中心校区', value: 'center' },
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

// ============================================
// Mock 数据生成辅助
// ============================================

/** 当前年月 */
const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth() + 1;

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

/** 生成月度发薪历史 */
function genPayHistory(
  months: number,
  baseAmount: number,
  variance: number = 500,
  startMonth?: number,
): TeacherUIModel['payHistory'] {
  const history: TeacherUIModel['payHistory'] = [];
  const sm = startMonth ?? Math.max(1, CUR_MONTH - months);
  for (let m = sm; m < CUR_MONTH; m++) {
    const amount = baseAmount + Math.round((Math.random() - 0.3) * variance);
    history.push({
      month: `${CUR_YEAR}-${String(m).padStart(2, '0')}`,
      amount,
      status: 'paid',
      paidAt: `${CUR_YEAR}-${String(m).padStart(2, '0')}-15`,
    });
  }
  return history;
}

// ============================================
// Mock 教师数据 - 覆盖各种场景
// ============================================

const rawMockTeachers: Omit<TeacherUIModel, 'accessScope' | 'accessScopeText'>[] = [
  // ===== 中心校区 - 主讲 =====
  {
    id: 'teacher-001',
    name: '王老师',
    role: 'lead',
    roleText: '主讲',
    subject: '钢琴',
    phone: '138****6789',
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
    initial: '王',
    deductions: [{ id: 'd1', reason: '迟到扣款', amount: 200, type: 'deduct' }],
    status: 'active',
    campus: 'center',
    classRateOverrides: [
      { className: '钢琴基础班', rate: 120 },
      { className: '钢琴进阶班', rate: 150 },
    ],
    payHistory: genPayHistory(5, 8600, 800),
  },
  {
    id: 'teacher-002',
    name: '李老师',
    role: 'lead',
    roleText: '主讲',
    subject: '声乐',
    phone: '139****1234',
    hours: 36,
    students: 15,
    classes: 5,
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    salaryStatus: 'pending',
    modelIdx: 0,
    color: AVATAR_COLORS[1],
    initial: '李',
    deductions: [],
    status: 'active',
    campus: 'center',
    payHistory: genPayHistory(5, 7200, 600),
  },
  {
    id: 'teacher-009',
    name: '刘老师',
    role: 'lead',
    roleText: '主讲',
    subject: '小提琴',
    phone: '131****0123',
    hours: 30,
    students: 12,
    classes: 4,
    base: 3000,
    rate: 120,
    attend: 500,
    perf: 700,
    salaryStatus: 'confirmed',
    modelIdx: 0,
    color: AVATAR_COLORS[0],
    initial: '刘',
    deductions: [{ id: 'd3', reason: '请假扣款', amount: 300, type: 'deduct' }],
    status: 'active',
    campus: 'center',
    payHistory: genPayHistory(4, 7000, 500),
  },
  {
    id: 'teacher-010',
    name: '黄老师',
    role: 'lead',
    roleText: '主讲',
    subject: '乐理',
    phone: '130****4567',
    hours: 20,
    students: 20,
    classes: 3,
    base: 3000,
    rate: 80,
    attend: 500,
    perf: 700,
    salaryStatus: 'pending',
    modelIdx: 0,
    color: AVATAR_COLORS[3],
    initial: '黄',
    deductions: [],
    status: 'resigned',
    campus: 'center',
    resignType: 'quit',
    resignDate: '2025-06-01',
    resignReason: '个人发展',
    payHistory: genPayHistory(3, 5800, 400),
  },
  {
    id: 'teacher-011',
    name: '郑老师',
    role: 'lead',
    roleText: '主讲',
    subject: '钢琴',
    phone: '158****3321',
    hours: 38,
    students: 16,
    classes: 5,
    base: 3000,
    rate: 110,
    attend: 500,
    perf: 700,
    salaryStatus: 'confirmed',
    modelIdx: 0,
    color: AVATAR_COLORS[5],
    initial: '郑',
    deductions: [{ id: 'd4', reason: '代课2节', amount: 220, type: 'bonus' }],
    status: 'active',
    campus: 'center',
    classRateOverrides: [{ className: '钢琴考级班', rate: 140 }],
    payHistory: genPayHistory(5, 8400, 700),
  },

  // ===== 中心校区 - 助教 =====
  {
    id: 'teacher-003',
    name: '张老师',
    role: 'assist',
    roleText: '助教',
    subject: '钢琴',
    phone: '137****5678',
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
    initial: '张',
    deductions: [{ id: 'd2', reason: '代课3节', amount: 240, type: 'bonus' }],
    status: 'active',
    campus: 'center',
    payHistory: genPayHistory(4, 3600, 300),
  },
  {
    id: 'teacher-012',
    name: '林老师',
    role: 'assist',
    roleText: '助教',
    subject: '声乐',
    phone: '159****8876',
    hours: 20,
    students: 8,
    classes: 3,
    base: 0,
    rate: 80,
    attend: 0,
    perf: 0,
    salaryStatus: 'pending',
    modelIdx: 1,
    color: AVATAR_COLORS[6],
    initial: '林',
    deductions: [],
    status: 'active',
    campus: 'center',
    payHistory: genPayHistory(3, 2800, 200),
  },

  // ===== 南区分校 - 主讲 =====
  {
    id: 'teacher-004',
    name: '陈老师',
    role: 'lead',
    roleText: '主讲',
    subject: '书法/美术',
    phone: '136****9012',
    hours: 34,
    students: 14,
    classes: 5,
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    salaryStatus: 'pending',
    modelIdx: 0,
    color: AVATAR_COLORS[3],
    initial: '陈',
    deductions: [],
    status: 'active',
    campus: 'south',
    payHistory: genPayHistory(5, 6800, 500),
  },
  {
    id: 'teacher-013',
    name: '何老师',
    role: 'lead',
    roleText: '主讲',
    subject: '美术',
    phone: '177****5543',
    hours: 28,
    students: 12,
    classes: 4,
    base: 3000,
    rate: 90,
    attend: 500,
    perf: 700,
    salaryStatus: 'paid',
    modelIdx: 0,
    color: AVATAR_COLORS[4],
    initial: '何',
    deductions: [],
    status: 'active',
    campus: 'south',
    payHistory: genPayHistory(5, 6200, 400),
  },

  // ===== 南区分校 - 助教 =====
  {
    id: 'teacher-005',
    name: '赵老师',
    role: 'assist',
    roleText: '助教',
    subject: '美术',
    phone: '135****3456',
    hours: 16,
    students: 8,
    classes: 3,
    base: 0,
    rate: 80,
    attend: 0,
    perf: 0,
    salaryStatus: 'confirmed',
    modelIdx: 1,
    color: AVATAR_COLORS[4],
    initial: '赵',
    deductions: [],
    status: 'active',
    campus: 'south',
    payHistory: genPayHistory(4, 2400, 200),
  },
  {
    id: 'teacher-014',
    name: '钱老师',
    role: 'assist',
    roleText: '助教',
    subject: '书法',
    phone: '188****2211',
    hours: 18,
    students: 7,
    classes: 3,
    base: 0,
    rate: 80,
    attend: 0,
    perf: 0,
    salaryStatus: 'pending',
    modelIdx: 1,
    color: AVATAR_COLORS[7],
    initial: '钱',
    deductions: [{ id: 'd5', reason: '全勤奖励', amount: 200, type: 'bonus' }],
    status: 'active',
    campus: 'south',
    payHistory: genPayHistory(3, 2600, 200),
  },

  // ===== 南区分校 - 已离职 =====
  {
    id: 'teacher-015',
    name: '冯老师',
    role: 'lead',
    roleText: '主讲',
    subject: '书法',
    phone: '166****9900',
    hours: 0,
    students: 0,
    classes: 0,
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    salaryStatus: 'paid',
    modelIdx: 0,
    color: AVATAR_COLORS[2],
    initial: '冯',
    deductions: [],
    status: 'resigned',
    campus: 'south',
    resignType: 'expire',
    resignDate: '2025-04-30',
    resignReason: '合同到期',
    payHistory: genPayHistory(3, 5600, 300, 1),
  },

  // ===== 东区分校 - 兼职 =====
  {
    id: 'teacher-006',
    name: '周老师',
    role: 'parttime',
    roleText: '兼职',
    subject: '吉他',
    phone: '134****7890',
    hours: 16,
    students: 6,
    classes: 2,
    base: 0,
    rate: 100,
    attend: 0,
    perf: 0,
    salaryStatus: 'paid',
    modelIdx: 1,
    color: AVATAR_COLORS[5],
    initial: '周',
    deductions: [],
    payRemark: '试用期薪资',
    status: 'active',
    campus: 'east',
    payHistory: genPayHistory(3, 3200, 300),
  },
  {
    id: 'teacher-007',
    name: '吴老师',
    role: 'parttime',
    roleText: '兼职',
    subject: '舞蹈',
    phone: '133****2345',
    hours: 14,
    students: 5,
    classes: 2,
    base: 0,
    rate: 100,
    attend: 0,
    perf: 0,
    salaryStatus: 'paid',
    modelIdx: 1,
    color: AVATAR_COLORS[6],
    initial: '吴',
    deductions: [],
    status: 'active',
    campus: 'east',
    payHistory: genPayHistory(4, 2800, 200),
  },
  {
    id: 'teacher-008',
    name: '孙老师',
    role: 'parttime',
    roleText: '兼职',
    subject: '架子鼓',
    phone: '132****6789',
    hours: 8,
    students: 3,
    classes: 1,
    base: 0,
    rate: 100,
    attend: 0,
    perf: 0,
    salaryStatus: 'paid',
    modelIdx: 1,
    color: AVATAR_COLORS[7],
    initial: '孙',
    deductions: [],
    status: 'active',
    campus: 'east',
    payHistory: genPayHistory(3, 1600, 200),
  },
  {
    id: 'teacher-016',
    name: '杨老师',
    role: 'parttime',
    roleText: '兼职',
    subject: '吉他',
    phone: '155****4432',
    hours: 12,
    students: 4,
    classes: 2,
    base: 0,
    rate: 90,
    attend: 0,
    perf: 0,
    salaryStatus: 'pending',
    modelIdx: 1,
    color: AVATAR_COLORS[0],
    initial: '杨',
    deductions: [{ id: 'd6', reason: '课时调整+1', amount: 90, type: 'bonus' }],
    status: 'active',
    campus: 'east',
    payHistory: genPayHistory(2, 2200, 200),
  },

  // ===== 东区分校 - 已离职 =====
  {
    id: 'teacher-017',
    name: '许老师',
    role: 'parttime',
    roleText: '兼职',
    subject: '舞蹈',
    phone: '186****7788',
    hours: 0,
    students: 0,
    classes: 0,
    base: 0,
    rate: 100,
    attend: 0,
    perf: 0,
    salaryStatus: 'paid',
    modelIdx: 1,
    color: AVATAR_COLORS[3],
    initial: '许',
    deductions: [],
    status: 'resigned',
    campus: 'east',
    resignType: 'dismiss',
    resignDate: '2025-05-15',
    resignReason: '教学考核不达标',
    payHistory: genPayHistory(2, 2000, 200, 1),
  },

  // ===== 中心校区 - 更多兼职 =====
  {
    id: 'teacher-018',
    name: '沈老师',
    role: 'parttime',
    roleText: '兼职',
    subject: '架子鼓',
    phone: '199****1122',
    hours: 10,
    students: 4,
    classes: 1,
    base: 0,
    rate: 110,
    attend: 0,
    perf: 0,
    salaryStatus: 'confirmed',
    modelIdx: 1,
    color: AVATAR_COLORS[1],
    initial: '沈',
    deductions: [],
    status: 'active',
    campus: 'center',
    payHistory: genPayHistory(2, 1800, 200),
  },
  {
    id: 'teacher-019',
    name: '韩老师',
    role: 'parttime',
    roleText: '兼职',
    subject: '小提琴',
    phone: '176****3344',
    hours: 6,
    students: 2,
    classes: 1,
    base: 0,
    rate: 120,
    attend: 0,
    perf: 0,
    salaryStatus: 'pending',
    modelIdx: 1,
    color: AVATAR_COLORS[4],
    initial: '韩',
    deductions: [],
    status: 'active',
    campus: 'center',
    payHistory: [],
  },
];

export const mockTeachers: TeacherUIModel[] = rawMockTeachers.map((teacher) => {
  const accessScope = ACCESS_SCOPE_OVERRIDE_MAP[teacher.id] || 'self';
  return {
    ...teacher,
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

let _teachers: TeacherUIModel[] = [...mockTeachers];
let _salaryModels: SalaryModel[] = [...mockSalaryModels];
let _settings: SalarySettings = { ...mockSalarySettings };

/** 模拟网络延迟 */
function delay(ms: number = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock API 实现
// ============================================

/** 获取教师列表 */
export async function mockGetTeachers(): Promise<TeacherUIModel[]> {
  await delay();
  return [..._teachers];
}

/** 获取在职教师列表（用于班级表单选择器） */
export async function mockGetActiveTeachers(): Promise<TeacherUIModel[]> {
  await delay();
  return _teachers.filter((t) => t.status === 'active');
}

/** 获取单个教师 */
export async function mockGetTeacherById(id: string): Promise<TeacherUIModel | null> {
  await delay(100);
  return _teachers.find((t) => t.id === id) || null;
}

/** 添加教师 */
export async function mockAddTeacher(teacher: TeacherUIModel): Promise<TeacherUIModel> {
  await delay(200);
  _teachers = [..._teachers, teacher];
  return teacher;
}

/** 更新教师 */
export async function mockUpdateTeacher(
  id: string,
  updates: Partial<TeacherUIModel>,
): Promise<TeacherUIModel | null> {
  await delay(200);
  const idx = _teachers.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  _teachers[idx] = { ..._teachers[idx], ...updates };
  _teachers = [..._teachers];
  return _teachers[idx];
}

/** 确认薪资 */
export async function mockConfirmSalary(id: string): Promise<boolean> {
  await delay(150);
  const idx = _teachers.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  if (_teachers[idx].salaryStatus === 'pending') {
    _teachers[idx] = { ..._teachers[idx], salaryStatus: 'confirmed' };
    _teachers = [..._teachers];
  }
  return true;
}

/** 批量确认薪资 */
export async function mockBatchConfirm(ids: string[]): Promise<boolean> {
  await delay(200);
  _teachers = _teachers.map((t) =>
    ids.includes(t.id) && t.salaryStatus === 'pending' ? { ...t, salaryStatus: 'confirmed' } : t,
  );
  return true;
}

/** 发放薪资 */
export async function mockExecutePay(ids: string[], remark?: string): Promise<boolean> {
  await delay(200);
  const now = new Date().toISOString().slice(0, 10);
  const monthKey = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
  _teachers = _teachers.map((t) => {
    if (ids.includes(t.id) && t.salaryStatus === 'confirmed') {
      const total =
        t.base +
        t.hours * t.rate +
        t.attend +
        t.perf +
        t.deductions.reduce((s, d) => s + (d.type === 'bonus' ? d.amount : -d.amount), 0);
      return {
        ...t,
        salaryStatus: 'paid' as const,
        payRemark: remark || '',
        payHistory: [
          ...(t.payHistory || []),
          {
            month: monthKey,
            amount: Math.max(0, total),
            status: 'paid' as const,
            paidAt: now,
            remark,
          },
        ],
      };
    }
    return t;
  });
  return true;
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
  const newModel = _salaryModels[idx];
  _teachers = _teachers.map((t) => {
    if (t.modelIdx !== _salaryModels.findIndex((m) => m.id === id)) return t;
    // 仅更新待确认教师的费率参数，已确认/已发放保持不变
    if (t.salaryStatus === 'pending') {
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
