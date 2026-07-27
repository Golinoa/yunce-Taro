# 云策教务（松果排课）— Code Wiki

> 版本：1.0.0 | 框架：Taro 4.1.9 + React 18 + TypeScript | 目标平台：微信小程序
>
> 生成日期：2026-07-18

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术架构](#2-技术架构)
3. [目录结构](#3-目录结构)
4. [核心模块详解](#4-核心模块详解)
   - 4.1 [应用入口与配置](#41-应用入口与配置)
   - 4.2 [页面层（Pages）](#42-页面层pages)
   - 4.3 [组件层（Components）](#43-组件层components)
   - 4.4 [服务层（Services）](#44-服务层services)
   - 4.5 [状态管理（Stores）](#45-状态管理stores)
   - 4.6 [类型定义（Types）](#46-类型定义types)
   - 4.7 [数据层（Data/Mock）](#47-数据层datamock)
   - 4.8 [工具层（Utils）](#48-工具层utils)
   - 4.9 [常量与品牌配置](#49-常量与品牌配置)
5. [设计体系](#5-设计体系)
   - 5.1 [Design Token 系统](#51-design-token-系统)
   - 5.2 [UnoCSS 配置](#52-unocss-配置)
6. [路由与分包](#6-路由与分包)
7. [认证与权限](#7-认证与权限)
8. [构建与部署](#8-构建与部署)
9. [依赖关系图](#9-依赖关系图)
10. [工程化规范](#10-工程化规范)

---

## 1. 项目概览

**云策教务**（品牌名「松果排课」）是一款面向教育培训机构的**微信小程序**，提供教务管理全流程数字化能力，包括：

| 核心能力 | 说明 |
|----------|------|
| 排课管理 | 日历视图排课、批量调课、请假管理 |
| 学员管理 | 学员档案、课时套餐、消课/充课记录、签到 |
| 教师管理 | 教师列表、薪资模型、发薪确认、考勤 |
| 班级管理 | 班级创建/编辑、学员分配、签到打卡 |
| 试听线索 | 潜客跟进、试听预约、转化管理、分享邀请 |
| 数据统计 | 多维度统计报表、预警、趋势图表 |
| 校区设置 | 多校区管理、薪资模型、节假日、营业时间 |
| 认证体系 | 多身份（校长/教师/家长）注册登录、角色切换 |

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 框架 | Taro | 4.1.9 |
| UI 库 | React | 18.x |
| 语言 | TypeScript（严格模式） | 5.x |
| 样式 | UnoCSS 原子化 + rpx 单位 | 66.7.x |
| 状态管理 | Zustand | 4.5.x |
| 日期处理 | dayjs | 1.11.x |
| 类名拼接 | classnames | 2.5.x |
| 校验 | ajv | 8.20.x |
| 构建 | Webpack 5 | 5.78.x |
| 代码质量 | ESLint + Prettier + Husky + lint-staged | — |

### 2.2 架构分层

```
┌──────────────────────────────────────────┐
│              Pages（页面层）               │
│   主包页面 + 6 个分包（subPackages）       │
├──────────────────────────────────────────┤
│           Components（组件层）             │
│   通用基础组件 + 按模块分组的业务组件       │
├──────────────────────────────────────────┤
│            Stores（状态层）                │
│   Zustand Store — 全局状态管理             │
├──────────────────────────────────────────┤
│           Services（服务层）               │
│   接口契约层 — Mock/Real 一键切换           │
├──────────────────────────────────────────┤
│      Data + Types（数据与类型层）          │
│   Mock 数据 / 常量 / TypeScript 类型定义   │
├──────────────────────────────────────────┤
│            Utils（工具层）                 │
│   请求封装 / 认证 / 路由守卫 / 格式化       │
├──────────────────────────────────────────┤
│          Theme + UnoCSS（设计体系）         │
│   Design Token / CSS 变量 / 原子化类名     │
└──────────────────────────────────────────┘
```

### 2.3 数据流

```
用户交互 → Page/Component
  ↓ 调用
Service 层（Mock/Real 切换）
  ↓ 内部
Data 层（Mock 数据）或 Request 工具（真实 API）
  ↓ 返回
Store 层（Zustand 更新状态）
  ↓ 响应式
Page/Component 重新渲染
```

**关键约束**：
- 页面只从 `@/services` 导入，禁止直接引用 `@/data`
- Service 层通过 `VITE_USE_MOCK` 环境变量切换 Mock/Real
- Store 层调用 Service 层获取数据，不直接调用 Data 层

---

## 3. 目录结构

```
yunce/
├── config/                    # Taro 构建配置
│   ├── index.ts               # 主配置（Webpack5 + UnoCSS + 路径别名）
│   ├── dev.ts                 # 开发环境配置
│   └── prod.ts                # 生产环境配置
├── scripts/                   # 构建脚本
│   ├── postbuild-weapp-fixes.mjs  # 微信小程序构建后修复
│   └── optimize-images.mjs        # 图片压缩优化
├── native/                    # 原生组件（ECharts Canvas）
│   └── components/EcCanvas/
├── src/                       # 源码根目录
│   ├── app.config.ts          # 应用路由 + TabBar + 分包配置
│   ├── app.tsx                # 应用入口（AuthProvider 包裹）
│   ├── app.scss               # 全局样式（CSS 变量声明）
│   ├── theme.ts               # Design Token 单一数据源
│   ├── assets/                # 静态资源（图标/图片）
│   ├── components/            # 组件（详见 4.3）
│   ├── pages/                 # 主包页面（详见 4.2）
│   ├── package-course/        # 课程管理分包
│   ├── package-lead/          # 试听线索分包
│   ├── package-settings/      # 设置分包
│   ├── package-statistics/    # 统计分包
│   ├── package-student/       # 学员分包
│   ├── package-teacher/       # 教师分包
│   ├── services/              # 服务层（详见 4.4）
│   ├── stores/                # 状态管理（详见 4.5）
│   ├── types/                 # 类型定义（详见 4.6）
│   ├── data/                  # Mock 数据（详见 4.7）
│   ├── constants/             # 业务常量
│   ├── utils/                 # 工具函数（详见 4.8）
│   └── styles/                # 遗留 SCSS（待迁移为 UnoCSS）
├── Agents/                    # AI 编码规范文档
├── docs/                      # UI 设计稿 / 迁移计划
├── package.json               # 项目依赖
├── tsconfig.json              # TypeScript 配置
├── uno.config.ts              # UnoCSS 配置
└── project.config.json        # 微信小程序项目配置
```

---

## 4. 核心模块详解

### 4.1 应用入口与配置

#### `src/app.tsx` — 应用入口

- 顶层包裹 `<AuthProvider>`，为全局提供认证状态
- 导入跨分包共享模块（防止 Taro MiniSplitChunksPlugin 误拆分）
- 引入 `uno.css`（UnoCSS 原子化样式）

#### `src/app.config.ts` — 应用配置

| 配置项 | 说明 |
|--------|------|
| `pages` | 主包 14 个页面路由 |
| `subPackages` | 6 个分包（student/teacher/course/settings/statistics/lead） |
| `tabBar` | 4 个 Tab：首页、课表、统计、我的 |
| `preloadRule` | 课表页预下载 `package-lead` 分包 |
| `window` | 导航栏蓝色 `#3B6EF5`，标题「松果排课」 |

### 4.2 页面层（Pages）

#### 主包页面

| 页面路径 | 功能 | 关键组件/逻辑 |
|----------|------|---------------|
| `pages/home/index` | 首页仪表盘 | ChildSelector, StatsOverview, TodayScheduleCard, TodoList, RecentLessonList |
| `pages/schedule/index` | 课表/排课 | CalendarWeekSelector, ScheduleTimeline, ScheduleBookingSwitch |
| `pages/booking/index` | 预约排课 | BookingControlSheet, ScheduleForm |
| `pages/statistics/index` | 数据统计 | IncomeTab, LessonTab, FinanceAnalysis, OperationKpi |
| `pages/profile/index` | 个人中心 | ProfileHeader, ProfileGrid, ProfileMenu, ProfileStats |
| `pages/login/index` | 登录 | LoginFlowPopover, AccountLoginSheet, LoginDecisionDialog |
| `pages/login/forgot-account` | 找回账号 | — |
| `pages/login/forgot-password` | 重置密码 | — |
| `pages/login/contact-support` | 联系客服 | — |
| `pages/register/index` | 注册流程 | RegisterStepper, RoleCard |
| `pages/register/role-select` | 选择角色 | RoleCard |
| `pages/register/role-info` | 补全角色信息 | FormInput |
| `pages/role-switch/index` | 角色切换 | RoleSwitchSheet |
| `pages/role-switch/add-role` | 新增身份 | RoleCard |
| `pages/notifications/index` | 通知列表 | — |
| `pages/agreement/index` | 用户协议 | — |

#### 分包页面

| 分包 | 页面 | 功能 |
|------|------|------|
| **package-student** | `students` | 学员列表 |
| | `student-detail` | 学员详情 |
| | `student-form` | 新增/编辑学员 |
| | `student-transfer` | 学员转校 |
| | `parent-bind` | 家长绑定 |
| **package-teacher** | `teacher-list` | 教师列表 |
| | `teacher-detail` | 教师详情 |
| | `salary-detail` | 薪资详情 |
| | `attendance` | 考勤管理 |
| **package-course** | `classes` | 班级列表 |
| | `class-detail` | 班级详情（含签到/添加学员/转班） |
| | `class-form` | 创建/编辑班级 |
| | `class-checkin` | 课堂签到 |
| | `course-packages` | 课程套餐管理 |
| | `package-form` | 创建/编辑套餐 |
| | `lesson-form/edit/supplement/detail` | 排课/编辑/补课/详情 |
| | `schedule-form` | 排课表单 |
| | `booking-rule` | 预约规则 |
| | `teacher-booking-config` | 教师预约配置 |
| | `booking-record-detail` | 预约记录详情 |
| | `batch-reschedule-select/confirm` | 批量调课选择/确认 |
| | `records` | 消课记录 |
| | `recharge-records` | 充课记录 |
| | `leave-request` | 请假申请 |
| **package-settings** | `campus-settings` | 校区设置（含子校区/发薪日/节假日/科目/通知/数据） |
| | `feedback` | 意见反馈 |
| | `notification-send` | 发送通知 |
| **package-statistics** | `alert-detail` | 预警详情 |
| **package-lead** | `my-invite` | 我的邀请 |
| | `lead-form` | 新增/编辑线索 |
| | `lead-detail` | 线索详情 |
| | `trial-booking` | 试听预约 |
| | `proxy-booking-form` | 代预约表单 |
| | `trial-slots` | 试听时段 |
| | `trial-slot-config` | 试听时段配置 |
| | `invite-qrcode` | 邀请二维码 |
| | `invite-landing` | 邀请落地页 |

### 4.3 组件层（Components）

#### 通用基础组件

| 组件 | 路径 | 说明 |
|------|------|------|
| **BottomSheet** | `components/BottomSheet/` | 底部弹窗，`visible` 单 prop 模式，所有业务弹窗的基础 |
| **FormInput** | `components/FormInput/` | 统一输入框，禁止直接使用 `<Input>` |
| **Card** | `components/Card/` | 卡片容器，统一卡片样式 |
| **CardHeader** | `components/CardHeader/` | 卡片头部 |
| **PageContainer** | `components/PageContainer/` | 页面容器，统一页面结构与导航 |
| **Modal** | `components/Modal/` | 弹出对话框 |
| **ConfirmDialog** | `components/ConfirmDialog/` | 确认对话框（确认/取消） |
| **Icon** | `components/Icon/` | 图标组件，支持 MDI 图标集 |
| **Avatar** | `components/Avatar/` | 头像，支持图片/默认图标/加载失败回退 |
| **Empty** | `components/Empty/` | 空状态展示 |
| **Loading** | `components/Loading/` | 加载状态 |
| **SegmentedControl** | `components/SegmentedControl/` | 分段控制器 |
| **ChipPicker** | `components/ChipPicker/` | 芯片选择器（单选/多选） |
| **Stepper** | `components/Stepper/` | 步进器（数字增减） |
| **RegisterStepper** | `components/RegisterStepper/` | 注册步骤指示器 |
| **RoleCard** | `components/RoleCard/` | 角色卡片（校长/教师/家长） |
| **RoleSwitchSheet** | `components/RoleSwitchSheet/` | 角色切换弹窗 |
| **CircleCheckbox** | `components/CircleCheckbox/` | 圆形复选框 |
| **StarRating** | `components/StarRating/` | 星级评分 |
| **PickerItem** | `components/PickerItem/` | 选择器项 |
| **QuestionHint** | `components/QuestionHint/` | 问号提示 |
| **InstallmentPanel** | `components/InstallmentPanel/` | 分期面板 |
| **AgreementDialog** | `components/AgreementDialog/` | 协议对话框 |
| **AgreementSheet** | `components/AgreementSheet/` | 协议弹窗 |
| **ContactList** | `components/ContactList/` | 联系人列表 |
| **CalendarMonthSheet** | `components/CalendarMonthSheet/` | 月份日历弹窗 |
| **CalendarWeekSelector** | `components/CalendarWeekSelector/` | 周日历选择器 |
| **ActionButton** | `components/ActionButton/` | 操作按钮 |
| **SheetInput** | `components/SheetInput/` | 弹窗内输入框 |

#### 登录相关组件

| 组件 | 说明 |
|------|------|
| AccountLoginSheet | 账号登录弹窗 |
| LoginDecisionDialog | 登录方式选择对话框 |
| LoginFlowPopover | 登录流程引导气泡 |
| LoginHelpDialog | 登录帮助对话框 |
| LoginIssueSheet | 登录问题弹窗 |

#### 业务组件（按模块分组）

| 模块 | 组件 | 说明 |
|------|------|------|
| **home** | ChildSelector | 孩子选择器 |
| | HourProgress | 课时进度条 |
| | KingKongSection | 快捷入口金刚区 |
| | RecentLessonList | 最近课程列表 |
| | RecentRecordItem | 最近记录项 |
| | ScheduleTimeline | 排课时间线 |
| | SilkRibbonCanvas | 丝带画布动画 |
| | StatCard | 统计卡片 |
| | StatsOverview | 统计概览 |
| | StudentQuickList | 学员快捷列表 |
| | TodayScheduleCard | 今日排课卡片 |
| | TodoList | 待办事项 |
| **booking** | BookingControlSheet | 预约控制弹窗 |
| **schedule** | ScheduleActionButton | 排课操作按钮 |
| | ScheduleBookingSwitch | 排课/预约切换 |
| | ScheduleCard | 排课卡片 |
| | ScheduleCardMenu | 排课卡片菜单 |
| **lesson** | ClassSelector | 班级选择器 |
| | LessonConsumptionList | 消课记录列表 |
| | LessonPreviewSheet | 课程预览弹窗 |
| | StudentCard | 学员卡片 |
| | StudentCheckinList | 学员签到列表 |
| **lead** | BookTrialByClassSheet | 按班级预约试听弹窗 |
| | ConvertSheet | 转化弹窗 |
| | FollowUpSheet | 跟进弹窗 |
| | InviteQrSection | 邀请二维码区域 |
| | LeadCard | 线索卡片 |
| | LeadStatusBadge | 线索状态徽章 |
| | TrialBookingSkeleton | 试听预约骨架屏 |
| | TrialBookingView | 试听预约视图 |
| **student** | MemberActionSheet | 成员操作弹窗 |
| | StudentAvatar | 学员头像 |
| **teacher** | AddTeacherSheet | 添加教师弹窗 |
| | ConfirmSalarySheet | 确认薪资弹窗 |
| | DeductionSheet | 扣款弹窗 |
| | EditTeacherSheet | 编辑教师弹窗 |
| | FilterBar | 筛选栏 |
| | MonthPicker | 月份选择器 |
| | PayConfirmSheet | 发薪确认弹窗 |
| | PaymentSettingsSheet | 发薪设置弹窗 |
| | ResignSheet | 离职弹窗 |
| | SalaryItem | 薪资项 |
| | SalaryModelSheet | 薪资模型弹窗 |
| | SalaryTab | 薪资 Tab |
| | ScheduleTab | 排课 Tab |
| | TeacherCard | 教师卡片 |
| | TeacherTab | 教师 Tab |
| **statistics** | AlertSheet | 预警弹窗 |
| | BarChart | 柱状图 |
| | ChartContainer | 图表容器 |
| | DateRangeSheet | 日期范围弹窗 |
| | FilterBar | 筛选栏 |
| | FinanceAnalysis | 财务分析 |
| | FinanceKpi | 财务 KPI |
| | KpiCard | KPI 卡片 |
| | OperationKpi | 运营 KPI |
| | RankList | 排行列表 |
| | RankTabs | 排行 Tab |
| | TimeSelector | 时间选择器 |
| | TrendSection | 趋势区域 |
| **package** | PackageSelectSheet | 套餐选择弹窗 |
| | StudentSelectSheet | 学员选择弹窗 |
| **profile** | ProfileGrid | 个人中心网格 |
| | ProfileHeader | 个人中心头部 |
| | ProfileMenu | 个人中心菜单 |
| | ProfileStats | 个人中心统计 |
| | ProfileSupport | 个人中心支持 |
| **campus** | CampusCard | 校区卡片 |
| **class** | ClassAvatar | 班级头像 |
| **proxy-booking** | ProxyUserSelectSheet | 代预约用户选择弹窗 |
| **reschedule** | WorkflowHeaderCard | 调课流程头部卡片 |

### 4.4 服务层（Services）

服务层是页面与数据的唯一中间层，所有页面通过 `@/services` 统一导出入口访问数据。

#### `src/services/index.ts` — 统一导出

```typescript
// 认证
export { login, wechatLogin, phoneLogin, registerStep1/2/3, getSession, switchIdentity, ... } from './auth';
// 学员
export { studentService, packageService, lessonRecordService, ... } from './student';
// 教师
export { teacherService, salaryModelService, salarySettingsService, ... } from './teacher';
// 校区
export { campusService, salaryModelCampusService, holidayService, ... } from './campus';
// 首页
export { homeService } from './home';
// 统计
export { statisticsService } from './statistics';
// 线索
export { leadService } from './lead';
// 反馈/上传/临时调课
export { feedbackService, uploadService, temporaryRescheduleService } from '...';
```

#### 服务模块详情

| 服务文件 | 导出对象 | 核心功能 |
|----------|----------|----------|
| `auth.ts` | `login`, `wechatLogin`, `phoneLogin`, `registerStep1/2/3`, `getSession`, `switchIdentity`, `addIdentity`, `logout` | 认证全流程：多方式登录、分步注册、多身份切换、会话管理 |
| `student.ts` | `studentService`, `packageService`, `lessonRecordService`, `leaveService`, `classService`, `scheduleService`, `notificationService` | 学员/套餐/消课/请假/班级/排课/通知 CRUD |
| `teacher.ts` | `teacherService`, `salaryModelService`, `salarySettingsService`, `teacherScheduleService` | 教师 CRUD、薪资模型、发薪设置、排课 |
| `campus.ts` | `campusService`, `salaryModelCampusService`, `payDaySettingsService`, `holidayService`, `businessHoursService`, `notifyService`, `campusDataService`, `subjectService` | 校区/薪资/发薪日/节假日/营业时间/通知/科目 |
| `home.ts` | `homeService` | 首页统计、快捷入口、运营内容 |
| `statistics.ts` | `statisticsService` | 多维度数据统计 |
| `lead.ts` | `leadService` | 线索 CRUD、试听预约、跟进、转化 |
| `feedback.ts` | `feedbackService` | 提交反馈 |
| `upload.ts` | `uploadService` | 图片上传 |
| `temporary-reschedule.ts` | `temporaryRescheduleService` | 临时调课 |

#### Mock/Real 切换机制

每个 Service 函数内部通过 `USE_MOCK` 标志判断：

```typescript
const USE_MOCK = process.env.VITE_USE_MOCK !== 'false';

export async function someAction() {
  if (USE_MOCK) return mockSomeAction(); // 走 Mock
  return await get('/api/endpoint');       // 走真实 API
}
```

联调时只需将 `VITE_USE_MOCK` 设为 `false`，或修改 Service 层对应函数即可。

### 4.5 状态管理（Stores）

使用 Zustand 进行全局状态管理，所有 Store 通过 `src/stores/index.ts` 统一导出。

#### `src/stores/index.ts`

```typescript
export { useStudentStore } from './student';
export { useClassStore } from './class';
export { usePackageTemplateStore } from './package-template';
export { useTeacherStore } from './teacher';
export { useCampusStore } from './campus';
export { useAgreementStore } from './agreement';
export { useLeadStore } from './lead';
```

#### Store 详情

| Store | 文件 | 状态字段 | 核心 Actions |
|-------|------|----------|-------------|
| **useTeacherStore** | `teacher.ts` | `teachers[]`, `salaryModels[]`, `filter`, `selectedIds[]`, `settings`, `pendingPayAction`, `loading`, `error` | `fetchTeachers`, `fetchAll`, `setFilter`, `getFilteredTeachers`, `confirmSalary`, `batchConfirm`, `executePay`, `addTeacher`, `updateTeacher`, `resignTeacher`, `addDeduction`, `createSalaryModel`, `getActiveCount`, `getPendingCount`, `getTotalHours`, `getTotalSalary` |
| **useStudentStore** | `student.ts` | 学员列表、筛选、套餐、消课记录 | 学员 CRUD、套餐管理、消课/充课 |
| **useClassStore** | `class.ts` | 班级列表、当前班级 | 班级 CRUD、学员分配 |
| **useCampusStore** | `campus.ts` | 校区列表、当前校区设置 | 校区 CRUD、设置管理 |
| **useLeadStore** | `lead.ts` | 线索列表、筛选、跟进 | 线索 CRUD、跟进、转化 |
| **useAgreementStore** | `agreement.ts` | 协议同意状态 | 标记同意/检查状态 |
| **usePackageTemplateStore** | `package-template.ts` | 套餐模板列表 | 模板 CRUD |

#### 教师薪资计算

`useTeacherStore` 中包含关键的计算函数 `calcTotal`：

```typescript
export function calcTotal(t: TeacherUIModel): number {
  const lessonFee = t.hours * t.rate;
  let total = t.base + lessonFee + t.attend + t.perf;
  t.deductions.forEach((d) => {
    total += d.type === 'bonus' ? d.amount : -d.amount;
  });
  return Math.max(0, total);
}
```

薪资公式：`总薪资 = 底薪 + (课时 × 课时费) + 全勤奖 + 绩效 ± 扣款/补发`

### 4.6 类型定义（Types）

所有业务类型通过 `src/types/index.ts` 统一导出。

#### 类型文件与关键类型

| 文件 | 关键类型 | 说明 |
|------|----------|------|
| `profile.ts` | `UserRole`, `Profile`, `AuthSession`, `Identity` | 用户角色（principal/teacher/parent）、认证会话、身份 |
| `teacher.ts` | `Teacher`, `TeacherUIModel`, `SalaryStatus`, `SalaryModel`, `Deduction`, `TeacherFilter`, `PendingPayAction`, `SalarySettings` | 教师全量类型，薪资状态机 pending→confirmed→paid |
| `student.ts` | `Student`, `StudentParent` | 学员与家长 |
| `class.ts` | `Class`, `ClassDetail`, `ClassStudent`, `CheckinRecord`, `ClassColor` | 班级、学员、签到 |
| `course-package.ts` | `CoursePackage`, `PackageStatus`, `FeeMethod`, `PackageTransaction` | 课时套餐、状态、费用方式、交易记录 |
| `schedule.ts` | `Schedule`, `ScheduleColor`, `DayOfWeek` | 排课 |
| `lead.ts` | `Lead`, `LeadStatus`, `LeadBooking`, `TrialSlotConfig`, `LeadFollowUp`, `LeadConversion`, `LeadFormData` | 线索全量类型，状态流转：new→pending→booked→arrived/not_arrived→following→converted/closed |
| `campus.ts` | `CampusUIModel`, `CampusFormData`, `SalaryModel`, `PayDaySettings`, `Holiday`, `BusinessHours` | 校区设置全量类型 |
| `lesson-record.ts` | `LessonRecord` | 消课记录 |
| `leave-request.ts` | `LeaveRequest`, `LeaveType`, `LeaveStatus` | 请假 |
| `notification.ts` | `Notification`, `NotificationType` | 通知 |
| `feedback.ts` | `Feedback` | 反馈 |
| `subject.ts` | `Subject` | 科目 |
| `temporary-reschedule.ts` | `TemporaryReschedule` | 临时调课 |

#### 状态机

**薪资状态**：`pending → confirmed → paid`（严格单向，禁止反向跳转）

**线索状态**：`new → pending → booked → arrived/not_arrived → following → converted/closed`

### 4.7 数据层（Data/Mock）

| 文件 | 说明 |
|------|------|
| `data/index.ts` | Mock 数据入口（对应 `@/mock` 路径别名） |
| `data/mock-database.ts` | 模拟数据库，包含测试账号、测试密码等 |
| `data/mock/index.ts` | Mock 数据聚合入口 |
| `data/mock/statistics-base.ts` | 统计 Mock 基础数据 |
| `data/auth.ts` | 认证相关 Mock 函数（mock 前缀命名） |
| `data/teacher.ts` | 教师相关 Mock 数据与函数 |
| `data/student.ts` | 学员相关 Mock 数据 |
| `data/campus.ts` | 校区相关 Mock 数据 |
| `data/home.ts` | 首页 Mock 数据 |
| `data/statistics.ts` | 统计 Mock 数据 |
| `data/lead.ts` | 线索 Mock 数据 |
| `data/feedback.ts` | 反馈 Mock 数据 |
| `data/generate-students.js` | 学员数据生成脚本 |

**命名规范**：Mock 函数统一使用 `mock` 前缀（如 `mockLogin`、`mockGetSession`），联调时只改 Service 层一行即可切换。

### 4.8 工具层（Utils）

| 工具文件 | 导出 | 核心功能 |
|----------|------|----------|
| **`request.ts`** | `request`, `get`, `post`, `put`, `del`, `ApiError`, `ApiResponse` | HTTP 请求封装：Taro.request + 自动 Token 注入 + 401 跳转登录 + 超时处理 + 错误分类 |
| **`auth.tsx`** | `AuthProvider`, `useAuth`, `AuthState`, `isStaffRole` | React Context 认证状态：多方式登录/注册/角色切换/草稿持久化 |
| **`route-guard.tsx`** | `withAuth` | 路由守卫 HOC：未登录跳转登录页，登录后回原页 |
| **`format.ts`** | `formatDateCN` | 日期中文格式化、金额格式化 |
| **`navigation.ts`** | `navigateTo`, `isTabBarPage` | 安全页面跳转、TabBar 页面判断 |
| **`avatar-color.ts`** | `getAvatarGradient` | 头像渐变色按索引/名字哈希分配 |
| **`booking-rules.ts`** | 预约规则管理 | 读写预约规则配置、格式化截止时间 |
| **`booking-one-on-one.ts`** | 一对一预约配置 | 教师预约配置创建/读写/开放日摘要 |
| **`hours-status.ts`** | `getHoursStatus` | 课时状态判断：根据课时数量和套餐状态返回卡片状态/颜色 |
| **`package-helper.ts`** | `selectBestPackage`, `isTrialPackage` | 最优套餐选择算法、试听包判断 |
| **`account.ts`** | 账号格式验证 | 账号长度/格式校验 |
| **`alert-read.ts`** | 预警已读管理 | 标记/检查预警详情已读状态 |
| **`parent-bookings.ts`** | 家长预约查询 | 家长端预约列表处理 |
| **`reschedule-date.ts`** | 调课日期处理 | 调课日期计算与校验 |
| **`visible-schedules.ts`** | 可见排课筛选 | 根据日期/教师/班级过滤可见排课 |
| **`logger.ts`** | `logError`, `logWarn` | 安全日志输出（仅开发环境） |
| **`local-debug.ts`** | `reportLocalDebug` | 本地调试信息上报 |
| **`use-date-swiper-window.ts`** | `useDateSwiperWindow` | 日期滑动窗口 Hook |
| **`use-nav-safe-height.ts`** | `useNavSafeHeight` | 导航安全区高度 Hook |

#### `request.ts` 请求流程

```
调用 get/post/put/del
  ↓
request() 核心函数
  ↓ 注入 Bearer Token
  ↓
Taro.request 发起请求
  ↓
HTTP 状态码检查
  ├─ 2xx + {code, data, message} → 解包返回 data
  ├─ 2xx + 直接数据 → 直接返回
  ├─ 401 → 清除 Token + 跳转登录
  └─ 其他 → 抛出 ApiError
```

#### `auth.tsx` 认证状态

`AuthProvider` 包裹整个应用，提供 `useAuth()` Hook：

| 方法 | 说明 |
|------|------|
| `signInWithUsername(username, password)` | 账号密码登录 |
| `signInWithWechat(code)` | 微信一键登录 |
| `signInWithPhone(phone, code)` | 手机号验证码登录 |
| `signInWithEmailCode(email, code)` | 邮箱验证码登录 |
| `signUpStep1/2/3(...)` | 分步注册 |
| `switchIdentity(identityId)` | 切换身份 |
| `addIdentity(role, roleInfo)` | 新增身份 |
| `validateInviteCode(code)` | 验证邀请码 |
| `refreshProfile()` | 刷新用户资料 |
| `signOut()` | 退出登录 |

会话持久化：登录成功后将 `profile` 和 `session` 写入 Taro Storage，应用启动时从 Storage 恢复。

### 4.9 常量与品牌配置

| 文件 | 内容 |
|------|------|
| `constants/brand.ts` | `BRAND_NAME_ZH='松果排课'`、`BRAND_NAME_EN='SONGGUO'`、`BRAND_LOGO`、`BRAND_FALLBACK_ORG_NAME` |
| `constants/lead.ts` | 线索状态元数据 `LEAD_STATUS_META`、来源 `LEAD_SOURCE_META`、筛选 Tab `LEAD_FILTER_TAB_OPTIONS`、跟进动作 `FOLLOW_UP_ACTION_META`、意向等级 `INTENT_LEVEL_META`、试听模式 `TRIAL_MODE_META` |

---

## 5. 设计体系

### 5.1 Design Token 系统

`src/theme.ts` 是所有设计值的**单一数据源**：

| Token 类别 | 导出 | 说明 |
|------------|------|------|
| **颜色** | `colors` | HSL 值，涵盖主题色/状态色/花瓣五色/身份角色色/图表色板 |
| **HEX 颜色** | `hexColors` | 快捷 HEX 引用（用于 ECharts 等无法使用 CSS 变量的场景） |
| **间距** | `spacing` | xs=8 / sm=16 / md=24 / lg=32 / xl=48 / pagePadding=32 (rpx) |
| **圆角** | `radius` | 基础 + 组件级语义（card=32 / input=24 / sheet=40 / tag=20 / headerBottom=60） |
| **字号** | `fontSize` | xs=22 / sm=24 / md=28 / lg=32 / xl=36 / ... / 5xl=64 (rpx) |
| **字重** | `fontWeight` | normal=400 / medium=500 / semibold=600 / bold=700 |
| **阴影** | `shadows` | elegant / soft / card / cardHover / float / popup / rollcall |
| **渐变** | `gradients` | primary / accent / subtle |
| **排课颜色** | `scheduleColors` | primary / info / accent / lavender |
| **班级颜色** | `classColors` | primary / accent / amber / info / purple |
| **动画** | `animation` | durationFast=150 / durationBase=250 / durationSlow=350 |

**工具函数**：

| 函数 | 说明 |
|------|------|
| `hsl(hslValue)` | HSL Token → `hsl()` CSS 字符串 |
| `hsla(hslValue, alpha)` | HSL Token → `hsla()` 带透明度 CSS 字符串 |
| `generateCSSVars(overrides?)` | 生成 CSS 变量声明对象 |
| `applyTheme(overrides?)` | 运行时主题切换（Taro 4.x `setPageStyle`） |

**修改原则**：改 `theme.ts` → 同步 `app.scss` → 全局生效

### 5.2 UnoCSS 配置

`uno.config.ts` 定义了完整的原子化样式系统：

#### Presets

| Preset | 说明 |
|--------|------|
| `presetApplet()` | 小程序适配 |
| `presetRemRpx({ baseFontSize: 14, screenWidth: 375 })` | rem → rpx 自动转换 |
| `presetIcons({ scale: 1.2, cdn: 'esm.sh/' })` | 图标支持（MDI 图标集） |

#### 自定义 Rules（部分重要规则）

| Rule | 说明 |
|------|------|
| `bg-gradient-primary` | 主题色渐变背景 |
| `bg-petal-blue/purple/orange/red/cyan` | 花瓣五色渐变（KPI 卡片） |
| `bg-kpi-green/orange/blue/purple/amber` | KPI 深色渐变 |
| `bg-progress-primary/purple` | 进度条渐变 |
| `icon-glass` / `icon-glass-purple/...` | 快捷入口图标毛玻璃效果 |
| `bg-glass-25/15` | 毛玻璃背景 |
| `gradient-text` | 渐变文字 |
| `animate-float` / `animate-pulse-ring` | 浮动/脉冲动画 |
| `pt-safe` / `pt-nav-safe` / `pb-safe-bottom` | 安全区 padding |
| `scrollbar-hide` | 隐藏滚动条 |
| `line-clamp-2` | 两行截断 |

#### 自定义 Shortcuts（部分重要快捷方式）

| Shortcut | 说明 |
|----------|------|
| `center` / `center-col` | 居中布局 |
| `press-scale` / `press-bg` | 交互反馈（按下缩小/变灰） |
| `btn-primary` / `btn-secondary` | 全局按钮规范 |
| `tag` / `tag-primary/purple/amber` | 全局标签规范 |
| `stat-card` / `stat-value` / `stat-label` | 统计卡片规范 |
| `form-input-wrap` / `form-input-focus` | 表单输入框规范 |
| `segment-wrap/item/active/inactive` | 分段控制器规范 |
| `chip/chip-active/chip-inactive` | 芯片选择器规范 |
| `state-disabled` / `state-loading` | 禁用/加载态 |

---

## 6. 路由与分包

### 主包页面（14 个）

```
pages/home/index          → 首页（Tab）
pages/schedule/index      → 课表（Tab）
pages/statistics/index    → 统计（Tab）
pages/profile/index       → 我的（Tab）
pages/login/index         → 登录
pages/login/forgot-account/index
pages/login/forgot-password/index
pages/login/contact-support/index
pages/register/index
pages/register/role-select
pages/register/role-info
pages/role-switch/index
pages/role-switch/add-role
pages/notifications/index
pages/agreement/index
pages/booking/index
pages/index/index         → 引导页
```

### 分包策略

| 分包 | 页面数 | 功能域 |
|------|--------|--------|
| `package-student` | 5 | 学员管理 |
| `package-teacher` | 4 | 教师管理 |
| `package-course` | 18 | 课程/排课/套餐/签到/请假 |
| `package-settings` | 9 | 校区设置/反馈/通知 |
| `package-statistics` | 1 | 预警详情 |
| `package-lead` | 9 | 试听线索/邀请 |

### 预加载策略

```typescript
preloadRule: {
  'pages/schedule/index': {
    packages: ['package-lead'],
    network: 'all',
  },
}
```

进入课表页后预下载 `package-lead` 分包，加速排课/预约 Tab 切换。

---

## 7. 认证与权限

### 7.1 多身份体系

系统支持三种用户角色：

| 角色 | 标识色 | 说明 |
|------|--------|------|
| `principal`（校长） | 琥珀色 `#F59E0B` | 机构管理员，拥有全部权限 |
| `teacher`（教师） | 蓝色 `#3B6EF5` | 教师权限（校长权限的子集） |
| `parent`（家长） | 紫色 `#8B5CF6` | 家长端，查看孩子课表/套餐/签到 |

### 7.2 认证流程

```
┌─────────────────┐
│   登录页面       │
│ 账号/微信/手机   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ AuthProvider     │
│ persistAuth()    │ → Taro Storage 存储 session + profile
└────────┬────────┘
         ↓
┌─────────────────┐
│  路由守卫        │
│  withAuth() HOC  │ → 未登录跳转 /pages/login/index
└─────────────────┘
```

### 7.3 Token 管理

- Token 存储在 Taro Storage，key 为 `yunce-edu-auth-token`
- 每次请求自动注入 `Authorization: Bearer <token>`
- Token 过期检测：比较 `expires_at * 1000 < Date.now()`
- 401 响应：清除 Token + 跳转登录页

### 7.4 注册流程

```
Step1: 创建账号（用户名 + 密码 + 可选邀请码）
  ↓ 获取 tempToken
Step2: 选择角色（校长/教师/家长）
  ↓ 保存到草稿
Step3: 补全角色信息（机构名/科目/孩子姓名等）
  ↓ 完成注册，获取正式 session
```

注册草稿持久化到 Taro Storage，跨步骤不丢失。

---

## 8. 构建与部署

### 8.1 构建配置

| 配置文件 | 说明 |
|----------|------|
| `config/index.ts` | 主配置：Webpack5 + UnoCSS 插件 + tsconfig-paths + 文件系统缓存 + Source Map 关闭 |
| `config/dev.ts` | 开发环境：禁用自动打开浏览器 |
| `config/prod.ts` | 生产环境：关闭 Source Map |
| `babel.config.js` | Babel：React + TypeScript + Webpack5 |
| `tsconfig.json` | TypeScript：路径别名 `@/*` → `src/*` |
| `project.config.json` | 微信小程序项目配置 |

#### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_USE_MOCK` | `'true'` | 是否启用 Mock 数据 |
| `TARO_API_BASE_URL` | `'/api/app/v1'` | API 基础路径 |
| `TARO_OUTPUT_DIR` | `'dist'` | 构建输出目录 |
| `TARO_ENABLE_LOCAL_DEBUG` | `'false'` | 启用本地调试上报 |

#### Webpack 配置要点

- **编译器**：Webpack5（`prebundle.enable: false`）
- **缓存**：文件系统持久化缓存（`node_modules/.cache/webpack/weapp`）
- **UnoCSS**：通过 `@unocss/webpack` 插件注入
- **路径别名**：通过 `TsconfigPathsPlugin` 解析 tsconfig paths
- **Source Map**：小程序端关闭（减少包体积，主包 2MB 限制）
- **PostCSS**：`pxtransform` + CSS Modules
- **资源复制**：`src/assets/images` → `dist/assets/images`

### 8.2 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev:weapp` | 开发模式（自动 Mock + 热更新） |
| `npm run build:weapp` | 生产构建（自动禁用 Mock） |
| `$env:VITE_USE_MOCK="true"; npm run build:weapp` | **推荐**：生产构建 + 强制 Mock |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | 格式合规检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run check` | 全量检查（typecheck + lint + format） |
| `npm run optimize:images` | 图片压缩优化 |

### 8.3 构建后处理

| 脚本 | 说明 |
|------|------|
| `scripts/postbuild-weapp-fixes.mjs` | 修复微信小程序组件依赖路径 |
| `scripts/optimize-images.mjs` | 基于 sharp 压缩图片 |

### 8.4 编译铁律

**禁止直接使用 `npm run build:weapp`**（会禁用 Mock，导致网络异常）。

正确方式：
1. 删除 `dist` 目录
2. 执行 `$env:VITE_USE_MOCK="true"; npm run build:weapp`

---

## 9. 依赖关系图

### 9.1 模块依赖

```
pages/ ──→ services/ ──→ data/ (Mock) 或 utils/request (API)
  │              │
  ↓              ↓
components/    types/
  │
  ↓
stores/ ──→ services/
  │
  ↓
utils/ ──→ services/auth (仅 auth.tsx)
```

### 9.2 严格依赖方向

```
types  ←  data  ←  services  ←  stores  ←  pages/components
                                              ↑
                                    utils (横向依赖)
```

- `types`：被所有层依赖，不依赖任何层
- `data`：依赖 `types`，被 `services` 引用
- `services`：依赖 `data` + `types` + `utils/request`，被 `stores` + `pages` 引用
- `stores`：依赖 `services` + `types`，被 `pages` 引用
- `pages/components`：依赖 `services` + `stores` + `types` + `utils` + `components`

### 9.3 路径别名

| 别名 | 映射 |
|------|------|
| `@/*` | `src/*` |
| `@/pages/*` | `src/pages/*` |
| `@/components/*` | `src/components/*` |
| `@/utils/*` | `src/utils/*` |
| `@/types/*` | `src/types/*` |
| `@/mock/*` | `src/data/*` |
| `@/services/*` | `src/services/*` |
| `@/stores/*` | `src/stores/*` |

### 9.4 NPM 依赖

#### 运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `@tarojs/*` | 4.1.9 | Taro 框架全家桶（components/react/runtime/taro/cli） |
| `react` / `react-dom` | ^18.0.0 | UI 框架 |
| `zustand` | ^4.5.0 | 状态管理 |
| `dayjs` | ^1.11.10 | 日期处理 |
| `classnames` | ^2.5.0 | 类名拼接 |
| `ajv` | ^8.20.0 | JSON Schema 校验 |
| `@mdi/js` | ^7.4.47 | MDI 图标集 |
| `@babel/runtime` | ^7.21.5 | Babel 运行时 |

#### 开发依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `unocss` / `@unocss/webpack` / `@unocss/preset-icons` | ^66.7.0 | UnoCSS 原子化样式 |
| `unocss-applet` | ^0.12.2 | 小程序 UnoCSS 适配 |
| `typescript` | ^5.1.0 | 类型检查 |
| `eslint` + plugins | ^8.12.0 | 代码规范 |
| `prettier` | ^3.8.4 | 代码格式化 |
| `husky` + `lint-staged` | ^9.1.7 / ^17.0.7 | Git 钩子 + 暂存文件检查 |
| `sharp` | ^0.35.2 | 图片压缩 |
| `webpack` | 5.78.0 | 构建工具 |

---

## 10. 工程化规范

### 10.1 代码质量工具链

| 工具 | 触发 | 说明 |
|------|------|------|
| ESLint | `npm run lint` / pre-commit | TypeScript + React + Import + Prettier 规则 |
| Prettier | `npm run format` / pre-commit | 统一缩进/分号/引号/尾逗号 |
| TypeScript | `npm run typecheck` | 严格类型检查（`strictNullChecks: true`） |
| Husky | `git commit` | Git 钩子管理 |
| lint-staged | pre-commit | 只检查暂存文件，提升提交速度 |

### 10.2 提交流程

```
git commit
  → husky pre-commit 钩子
    → lint-staged
      → *.ts/*.tsx: eslint --fix + prettier --write
      → *.scss/*.css/*.json/*.md: prettier --write
        → 全部通过 → 提交成功
        → 有 error → 提交被拒绝
```

### 10.3 审查清单

| 检查项 | 要求 |
|--------|------|
| 组件复用 | 新增 UI 前先查 `src/components/` 是否有可复用组件 |
| 弹窗封装 | 必须用 `BottomSheet`，业务弹窗封装为独立 Sheet 组件 |
| 输入框 | 必须用 `FormInput` 包裹，禁止裸 `<Input>` |
| 样式 | 使用 UnoCSS Token，禁止硬编码色值/尺寸，禁止内联 style |
| SCSS | 禁止新增 SCSS 文件，遗留文件待迁移 |
| 类型 | TypeScript 类型完整，禁止隐式 any |
| Mock | Mock 数据放 `src/data/`，禁止组件内硬编码 |
| 数据流 | 页面只引用 `@/services`，禁止直接引用 `@/data` |
| 状态机 | 薪资状态单向流转，禁止反向跳转 |

### 10.4 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件目录 | PascalCase | `BottomSheet/`, `LeadCard/` |
| 组件文件 | `index.tsx` | `BottomSheet/index.tsx` |
| 页面目录 | kebab-case | `teacher-list/`, `student-detail/` |
| 页面文件 | `index.tsx` | `teacher-list/index.tsx` |
| 事件处理 | handle 前缀 | `handleSubmit`, `handleClose` |
| 常量 | UPPER_SNAKE_CASE | `AUTH_TOKEN_KEY`, `TEST_PASSWORD` |
| Mock 函数 | mock 前缀 | `mockLogin`, `mockGetSession` |
| 类型/接口 | export 具名 | `export interface TeacherUIModel { ... }` |
| 类名拼接 | classnames (cn) | `cn('base-class', { active: isActive })` |

---

> 文档基于源码分析自动生成，涵盖项目架构、模块职责、关键接口、依赖关系与运行方式。
> 详细 AI 编码规范见 `AGENTS.md` 及 `Agents/` 目录下各专项文档。
