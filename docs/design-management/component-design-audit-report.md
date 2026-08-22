# 云策教务 Taro 微信小程序 - 组件级设计审计报告

> 审计范围：`src/components/` 目录下全部组件
> 审计目标：找出"设计割裂、组件配色系统紊乱"的具体证据，为组件级设计系统重构提供依据
> 审计日期：2026-08-16
> 审计说明：本报告仅做审查与记录，未修改原项目任何代码

---

## 一、组件清单（按功能分类）

经扫描，`src/components/` 共包含 **约 100+ 个组件**（含嵌套子目录）。按功能分类如下：

### 1.1 基础通用组件（10 个）

| 组件路径 | 功能说明 |
|---------|---------|
| `src/components/Avatar/index.tsx` | 全局头像（图片/文字头像） |
| `src/components/Card/index.tsx` | 统一卡片容器 |
| `src/components/CardHeader/index.tsx` | 卡片标题行（带圆点） |
| `src/components/Empty/index.tsx` | 空状态 |
| `src/components/Loading/index.tsx` | 加载状态 |
| `src/components/Icon/index.tsx` | MDI 图标组件 |
| `src/components/Modal/index.tsx` | 通用居中弹框 |
| `src/components/Dialog/index.tsx` | 居中弹窗容器 |
| `src/components/PageContainer/index.tsx` | 页面容器 |
| `src/components/SwappableCard/index.tsx` | 可滑动卡片 |

### 1.2 表单组件（8 个）

| 组件路径 | 功能说明 |
|---------|---------|
| `src/components/FormInput/index.tsx` | 统一表单输入框 |
| `src/components/FormCell/index.tsx` | 表单单元格（左标签右输入） |
| `src/components/FormRow/index.tsx` | 表单行（兼容 Taro reconciler） |
| `src/components/SheetInput/index.tsx` | 底部弹窗内输入框 |
| `src/components/Switch/index.tsx` | 开关组件 |
| `src/components/Stepper/index.tsx` | 步进器 |
| `src/components/InlineSelector/index.tsx` | 内联选择器 |
| `src/components/InlineDropdown/index.tsx` | 内联下拉 |

### 1.3 弹窗/Sheet 组件（14 个）

| 组件路径 | 功能说明 |
|---------|---------|
| `src/components/BottomSheet/index.tsx` | 统一底部弹窗 |
| `src/components/PickerSheet/index.tsx` | 底部单列选择器 |
| `src/components/DatePickerSheet/index.tsx` | 底部日期选择器 |
| `src/components/TimePickerSheet/index.tsx` | 底部时间选择器 |
| `src/components/CalendarMonthSheet/index.tsx` | 月份选择弹窗 |
| `src/components/AgreementSheet/index.tsx` | 协议确认弹窗 |
| `src/components/LoginIssueSheet/index.tsx` | 登录问题弹窗 |
| `src/components/PageIntroSheet/index.tsx` | 页面介绍弹窗 |
| `src/components/TooltipSheet/index.tsx` | 提示弹窗 |
| `src/components/ConfirmDialog/index.tsx` | 确认弹窗 |
| `src/components/AgreementDialog/index.tsx` | 协议弹窗 |
| `src/components/LoginDecisionDialog/index.tsx` | 登录决策弹窗 |
| `src/components/LoginHelpDialog/index.tsx` | 登录帮助弹窗 |
| `src/components/LoginFlowPopover/index.tsx` | 登录流程气泡 |

### 1.4 卡片/列表组件（10 个）

| 组件路径 | 功能说明 |
|---------|---------|
| `src/components/ContactList/index.tsx` | 联系人列表 |
| `src/components/home/TodayScheduleCard/index.tsx` | 今日课表卡片 |
| `src/components/home/StatCard/index.tsx` | 首页统计卡片 |
| `src/components/lead/LeadCard/index.tsx` | 线索卡片 |
| `src/components/schedule/ScheduleCard/index.tsx` | 排课卡片 |
| `src/components/teacher/TeacherCard/index.tsx` | 教师卡片 |
| `src/components/teacher/SalaryItem/index.tsx` | 薪资项卡片 |
| `src/components/statistics/KpiCard/index.tsx` | KPI 卡片 |
| `src/components/profile/ProfileHeader/index.tsx` | 个人中心头部 |
| `src/components/campus/CampusCard/index.tsx` | 校区卡片 |

### 1.5 业务组件（按模块，约 60+ 个）

| 模块 | 代表组件 |
|-----|---------|
| `home/` | KingKongSection, HourProgress, TodoList, RecentLessonList, RecentRecordItem 等 |
| `lead/` | LeadStatusBadge, FollowUpSheet, ConvertSheet, BookTrialByClassSheet 等 |
| `lesson/` | ClassSelector, StudentCard, StudentCheckinList, LessonConsumptionList 等 |
| `teacher/` | SalaryTab, ScheduleTab, TeacherTab, FilterBar, SalaryRuleEditor 等 |
| `statistics/` | KpiCard, FinanceKpi, OperationKpi, RankList, FilterBar 等 |
| `profile/` | ProfileMenu, ProfileGrid, ProfileStats, ProfileAbout 等 |
| `campus/` | CampusSwitcher, CampusTrigger 等 |
| `schedule/` | CalendarSwiper, ScheduleCardMenu, VenueBookingCard 等 |
| `package/` | PackageSelectSheet, StudentSelectSheet 等 |
| `booking/` | BookingControlSheet, TeacherBookingSwitchSheet 等 |
| `student/` | StudentAvatar, MemberActionSheet 等 |
| `class/` | ClassAvatar 等 |
| `proxy-booking/` | ProxyUserSelectSheet 等 |
| `reschedule/` | WorkflowHeaderCard 等 |

---

## 二、UnoCSS 配置审计（`uno.config.ts`）

### 2.1 rules 中仍存在大量硬编码色值（无法随主题切换）

| 规则名 | 硬编码色值/问题 | 所在行 |
|-------|----------------|--------|
| `bg-gradient-wechat` | `#22C55E`, `#16A34A` | ~231 |
| `shadow-wechat` | `rgba(34, 197, 94, 0.35)` | ~232 |
| `bg-petal-blue` | `#C5D8F5`, `#D8E5F8`, `#E8F0FC` | ~236 |
| `bg-petal-purple` | `#D8D5F0`, `#E5E2F7`, `#F0EEFB` | ~240 |
| `bg-petal-orange` | `#F0E0C0`, `#F5ECD5`, `#FDF6E8` | ~244 |
| `bg-petal-red` | `#F0D0D0`, `#F5E0E0`, `#FDF0F0` | ~248 |
| `bg-petal-cyan` | `#C0E8E8`, `#D5F0F0`, `#E8F8F8` | ~252 |
| `bg-finance-dark` | `#2a2a2a`, `#1a1a1a`, `#0f0f0f` | ~311 |
| `bg-card-orange` | `#FCA45C`, `#FF8A2A`, `#F57C00` | ~317 |
| `bg-card-gray` | `#9CA3AF`, `#6B7280`, `#4B5563` | ~323 |
| `bg-progress-orange` | `#FF8A2A`, `#FCA45C` | ~359 |
| `bg-progress-orange-track` | `rgba(255, 138, 42, 0.15)` | ~361 |
| `icon-glass-*` 系列 | 全部使用 `rgba(...)` 硬编码（如 `rgba(139, 92, 246, 0.15)`） | ~659-700 |
| `bg-white/92` 等 | `rgba(255, 255, 255, 0.92)` 等 | ~703-713 |
| `bg-white/8` 至 `bg-white/25` | `rgba(255,255,255,0.08)` 至 `0.25` | ~706-711 |
| `course-type-art-*` 等 | `#ec4899`, `#8B5CF6`, `#f43f5e`, `#0EA5E9`, `#6366f1` 及对应 rgba | ~729-743 |

### 2.2 shortcuts 中硬编码迁移类名泛滥

| shortcut 名 | 硬编码问题 | 所在行 |
|------------|-----------|--------|
| `bg-campus-card` | `#f8fbf9` | ~945 |
| `border-campus-card` | `#eef4f0` | ~946 |
| `text-gold` | `#ffe082` | ~947 |
| `text-gold-soft` | `rgba(255,224,130,0.95)` | ~948 |
| `text-pink-soft` | `#ffc1cc` | ~949 |
| `text-pink-light` | `rgba(255,193,204,0.95)` | ~950 |
| `bg-f5faf8` | `#F5F8FC` | ~952 |
| `bg-f0faf5` | `#F0F5FC` | ~953 |
| `bg-d5e8e0` | `#D5E2F5` | ~966 |
| `border-b-d5e8e0` | `2rpx solid #D5E2F5` | ~967 |
| `border-b-e8e8e8` | `2rpx solid #e8e8e8` | ~968 |
| `border-d5e8e0` | `2rpx solid #D5E2F5` | ~970 |
| `border-dashed-d5e8e0` | `#FAFBFD`, `4rpx dashed #D5E2F5` | ~975 |
| `bg-primary-20` | `rgba(59, 110, 245, 0.2)` | ~976 |
| `bg-f5faf8-border-d5e8e0` | `#F5F8FC`, `3rpx solid #D5E2F5` | ~980 |
| `bg-gradient-primary-dark2` | `linear-gradient(135deg, #3B6EF5, #2563EB)` | ~981 |
| `bg-login-gradient` | `#F0F4FF`, `#F5F8FF`, `#FFFFFF` | ~984 |
| `bg-login-glow` | `rgba(59,110,245,0.12)`, `rgba(59,110,245,0.03)` | ~988 |
| `bg-login-orb` | `rgba(255,255,255,0.55)`, `rgba(255,255,255,0.7)`, `rgba(255,255,255,0.9)`, `rgba(59,110,245,0.18)` | ~991 |
| `shadow-login-btn` | `rgba(59,110,245,0.25)` | ~997 |
| `shadow-wechat-btn` | `rgba(7,193,96,0.25)` | ~998 |
| `text-wechat` | `#07C160` | ~1001 |
| `bg-gradient-principal`（shortcut） | `#FBBF24`, `#F59E0B` | ~1038 |
| `bg-gradient-teacher`（shortcut） | `#6B95F5`, `#3B6EF5` | ~1039 |
| `bg-gradient-parent`（shortcut） | `#A78BFA`, `#8B5CF6` | ~1040 |

### 2.3 rules 命名与语义混乱

| 问题 | 说明 |
|-----|------|
| `rounded-md` 与 `rounded-2xl` 并存 | 既有 Tailwind 预设的 `rounded-md`，又有自定义 `rounded-md: 12rpx`，造成语义冲突 |
| `border-t` / `border-2` 被重定义 | 覆盖 Tailwind 默认行为，分别为 `2rpx solid` 和 `4rpx solid` |
| `text-md` shortcut | 把 `text-md` 定义为 `28rpx`，但 Tailwind 标准中无 `text-md`，属于非标扩展 |
| `w-5` / `h-6` 等尺寸规则 | 在 rules 中硬编码为 `30rpx` / `36rpx`，与 Tailwind 默认值冲突 |

---

## 三、Token 体系审计（`src/theme.ts` + `src/app.scss`）

### 3.1 Token 命名混乱、语义不清

1. **核心 Token 与扩展 Token 层级混乱**
   - `colors` 中已定义 `primary/secondary/accent/background/card/...` 等基础语义色
   - 却又在 `extendedColors` / `extendedHexColors` 中大量扩展：`pageBg`, `pageBgSecondary`, `pageBgTertiary`, `foregroundTertiary`, `foregroundQuaternary`, `divider`, `dividerLight`, `dividerStrong`, `successBg`, `warningBg`, `errorBg`, `infoBg` 等
   - 同一语义存在多个版本：如 `success` vs `successBg` vs `mint` vs `mintForeground`

2. **命名风格不统一**
   - 驼峰：`primaryGlow`, `primarySoft`, `foregroundSecondary`
   - 连字符（CSS 变量）：`--primary-glow`, `--primary-soft`, `--foreground-secondary`
   - 无规律缩写：`Bgg`（`scheduleBlueBgg`）、`bg`/`fg` 混用

3. **语义过度扩展**
   - `avatarMint`, `avatarMintDark`, `avatarMintLight`, `avatarPink`, `avatarPinkDark`, `avatarPinkLight` 等 17+ 个头像专用色
   - `scheduleBlueBg`, `scheduleBlueText`, `scheduleBlueLight`, `scheduleBlueBorder`, `scheduleBlueBgg` 等 9+ 个课表专用色
   - `badgeOrangeBg`, `badgeOrangeText`, `badgeOrangeBorder`, `badgeBlueBg`, `badgeBlueText`, `badgeBlueBorder`, `badgeGrayBg`, `badgeGrayBorder` 等 8 个徽章专用色
   - 这些本可统一为 `badge-warning-bg/text/border`、`avatar-accent-bg` 等通用语义 Token

### 3.2 多主题实现不彻底

1. `theme.ts` 中 `blueTheme` / `coralTheme` / `orangeTheme` 仅覆盖了部分 Token
2. `hexThemeColors` 对 `extendedHexColors` 的覆盖不完整，珊瑚/橙色主题下仍使用蓝色主题的扩展色
3. `app.scss` 中 `.theme-coral` / `.theme-orange` 重复定义了大量与默认主题相同或相近的变量，维护成本高

### 3.3 app.scss 中仍存在硬编码工具类

| 类名 | 硬编码问题 | 所在行 |
|-----|-----------|--------|
| `.form-border` | `hsl(165, 20%, 78%)` | ~469 |
| `.form-border-light` | `hsl(168, 25%, 88%)` | ~472 |
| `.form-border-error` | `hsl(0, 70%, 65%)` | ~475 |
| `.glass-card-bg` | `rgba(255, 255, 255, 0.92)` | ~480 |
| `.icon-glass` | 大量 `rgba(...)` | ~485-492 |
| `.icon-glass-purple` 等 | 大量 `rgba(...)` | ~494-525 |
| `.kingkong-section` | `48rpx 48rpx 0 0` 圆角、特定阴影 | ~547 |
| `.tab-item-v14` | 硬编码字号/字重/颜色 | ~572 |
| `.course-time-normal` 等 | 硬编码渐变参数 | ~644-659 |
| `.recent-group-v14` | 硬编码 `28rpx` 圆角、特定阴影 | ~673 |
| `.bar-fill-green` 等 | 硬编码渐变 | ~690-702 |

---

## 四、抽样组件审查结果（30 个代表性组件）

### 4.1 基础通用组件

#### 4.1.1 `Card/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-white`（应使用 `bg-card`） |
| 硬编码圆角 | `rounded-[32rpx]`（与 theme 中 `radius.card=32` 一致，但未使用 Token 类名） |
| padding 使用 Tailwind 默认 | `p-5` / `p-8` 对应 20rpx / 32rpx，但与 theme.spacing 中的命名未对齐 |

```tsx
// 源码片段
'bg-white rounded-[32rpx]',
```

#### 4.1.2 `CardHeader/index.tsx`

| 问题 | 证据 |
|-----|------|
| 圆点颜色完全硬编码 | `DOT_COLORS` 中 `primary: '#5EC8A8'`, `info: '#6BB5D4'`, `warning: '#E8C468'`, `accent: '#E89BB8'`, `muted: 'rgba(0,0,0,0.35)'`, `destructive: '#D94040'` |
| 使用内联 style | `style={{ background: resolvedColor }}` |

```tsx
const DOT_COLORS: Record<string, string> = {
  primary: '#5EC8A8',
  info: '#6BB5D4',
  warning: '#E8C468',
  accent: '#E89BB8',
  muted: 'rgba(0,0,0,0.35)',
  destructive: '#D94040',
};
```

#### 4.1.3 `Avatar/index.tsx`

| 问题 | 证据 |
|-----|------|
| 头像配色硬编码 | `AVATAR_COLORS` 8 个颜色全部硬编码：`#5EC8A8`, `#E89BB8`, `#6BA3D6`, `#D4A24E`, `#9B7ED8`, `#F0A0A0`, `#7BC8E8`, `#B8D45E` |
| 使用内联 style | `style={{ background: getAvatarColor(name) }}` |

```tsx
const AVATAR_COLORS = [
  '#5EC8A8', '#E89BB8', '#6BA3D6', '#D4A24E',
  '#9B7ED8', '#F0A0A0', '#7BC8E8', '#B8D45E',
];
```

#### 4.1.4 `BottomSheet/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | 多处使用 `bg-white`（应使用 `bg-card`） |
| 硬编码圆角 | `rounded-t-[40rpx]`（theme 中 `radius.sheet=40`） |
| 遮罩硬编码 | `bg-black/45` / `bg-black/0` |

```tsx
'absolute bottom-0 left-0 right-0 rounded-t-[40rpx] bg-white overflow-hidden',
```

#### 4.1.5 `Modal/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-white` |
| 硬编码圆角 | `rounded-[28rpx]` |
| 遮罩硬编码 | `bg-black/45` |

```tsx
'relative flex flex-col w-full max-w-[600rpx] max-h-[80vh] rounded-[28rpx] bg-white shadow-card',
```

#### 4.1.6 `Loading/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-white` |
| 硬编码圆角 | `rounded-[36rpx]` |
| 字号硬编码 | `text-[32rpx]`, `text-[24rpx]`, `text-[22rpx]`, `text-[20rpx]` |

```tsx
className={`w-full rounded-[36rpx] bg-white border-[2rpx] border-solid border-border-light shadow-card ...`}
```

### 4.2 表单组件

#### 4.2.1 `FormInput/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-white`, `bg-primary-5` |
| 硬编码边框 | `border-white/70` |
| 硬编码阴影 | `shadow-[0_12rpx_40rpx_rgba(59,110,245,0.10)]` |
| 硬编码圆角 | `rounded-full`, `rounded-2xl` |
| 多行输入框使用内联 style | `style={{ minHeight, height: minHeight, ...inputStyle }}` |

```tsx
'py-[24rpx] px-[36rpx] rounded-full bg-white border-[2rpx] border-white/70 shadow-[0_12rpx_40rpx_rgba(59,110,245,0.10)]'
```

#### 4.2.2 `FormCell/index.tsx`

| 问题 | 证据 |
|-----|------|
| 字号硬编码 | `text-[30rpx]` |
| 输入框直接使用原生 Input | 未通过 `FormInput` 包裹（违反组件铁律） |

```tsx
<Input className="flex-1 text-right text-[30rpx] text-foreground placeholder:text-muted-foreground bg-transparent" />
```

#### 4.2.3 `FormRow/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-primary-5` |
| 硬编码圆角 | `rounded-[16rpx]` |
| 使用内联 style | `style={{ color: 'var(--foreground)' }}` |
| 直接使用原生 Input | 虽然通过 FormInput variant="ghost"，但 `inputStyle` 使用 CSS 变量字符串 |

```tsx
inputStyle={!editable ? { color: 'var(--foreground)' } : undefined}
```

#### 4.2.4 `Switch/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码滑块颜色 | `bg-white` |
| 尺寸硬编码 | `w-[96rpx] h-[56rpx]` |

```tsx
'absolute top-[4rpx] w-[48rpx] h-[48rpx] rounded-full bg-white shadow-sm'
```

#### 4.2.5 `Stepper/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-white` |
| 硬编码尺寸 | `w-[72rpx] h-[72rpx]`, `w-[112rpx] h-[72rpx]` |
| 中间数值区硬编码白色背景 | `bg-white` |

```tsx
<View className="w-[112rpx] h-[72rpx] flex items-center justify-center border-l-2 border-r-2 border-input bg-white">
```

### 4.3 弹窗组件

#### 4.3.1 `ConfirmDialog/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-white`, `bg-muted` |
| 硬编码圆角 | `rounded-[28rpx]`, `rounded-[16rpx]` |
| 遮罩硬编码 | `bg-black/45` |
| 取消按钮文字颜色 | `text-foreground-secondary`（语义正确） |

```tsx
'relative w-full max-w-[620rpx] rounded-[28rpx] bg-white px-[32rpx] pb-[28rpx] pt-[32rpx]'
```

#### 4.3.2 `PickerSheet/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码背景色 | `bg-white` |
| 硬编码圆角 | `rounded-t-[32rpx]`（外层 BottomSheet 已经是 40，内部又覆盖为 32） |
| 选择器高度硬编码 | `h-[480rpx]` |

```tsx
<BottomSheet ... className="rounded-t-[32rpx]">
  <View className="bg-white">
```

#### 4.3.3 `DatePickerSheet/index.tsx`

| 问题 | 证据 |
|-----|------|
| 与 PickerSheet 同样问题 | `bg-white`, `rounded-t-[32rpx]` |
| 确认按钮颜色语义不统一 | 使用 `text-schedule-attend` 而非 `text-primary` |

```tsx
<Text className={cn('text-[32rpx] active:opacity-70', isValid ? 'text-schedule-attend' : 'text-muted-foreground')}>
  确认
</Text>
```

#### 4.3.4 `AgreementSheet/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码阴影 | `shadow-login-btn`（专属规则） |
| 硬编码圆角 | `rounded-full` |

```tsx
'bg-primary active:opacity-90 transition-opacity shadow-login-btn'
```

### 4.4 卡片/列表组件

#### 4.4.1 `SwappableCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 默认圆角硬编码 | `radiusClassName = 'rounded-[14rpx]'` |
| action 按钮颜色部分硬编码 | `bg-foreground-secondary`（无对应 Token，且颜色语义为前景色） |

```tsx
const radiusClassName = 'rounded-[14rpx]';
// ...
return 'bg-foreground-secondary active:opacity-80';
```

#### 4.4.2 `ContactList/index.tsx`

| 问题 | 证据 |
|-----|------|
| 多处硬编码背景色 | `bg-white` |
| 使用全局 shortcut `contact-card` | 该 shortcut 定义在 uno.config.ts 中：`bg-background rounded-2xl p-[24rpx] border-[2rpx] border-solid border-border`，本身无硬编码但语义是背景色 |

```tsx
<View className="w-[144rpx] flex-shrink-0 py-[18rpx] px-[12rpx] rounded-xl border-[2rpx] border-solid border-border bg-white">
```

#### 4.4.3 `home/TodayScheduleCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码 hsl 语法 | `text-[hsl(var(--warning))]`, `border-[hsl(var(--warning)/0.3)]`, `bg-[hsl(var(--warning)/0.3)]` |
| 状态样式依赖 v14 专属规则 | `course-time-urgent-v14`, `course-time-done-v14`, `course-time-ended-v14` |
| 圆角不统一 | `rounded-[24rpx]` |

```tsx
const TIME_AREA_STYLE = {
  bg: 'course-time-normal',
  text: 'text-[hsl(var(--warning))]',
  border: 'border-[hsl(var(--warning)/0.3)]',
};
```

#### 4.4.4 `home/StatCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码半透明背景 | `bg-white/20` |
| 硬编码文字颜色 | `text-white` |
| 未使用 Token | 该卡片用于渐变头部上，直接写死白色 |

```tsx
<View className="flex-1 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 text-white">
```

#### 4.4.5 `lead/LeadCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 状态标签样式完全硬编码 | `bg-[#fff7ed] text-[#f59e0b] border border-[#fbbf24]` 等 |
| 背景硬编码 | `bg-white` |
| 圆角硬编码 | `rounded-[24rpx]` |

```tsx
const CARD_STATUS_META: Record<CardLeadStatus, { label: string; className: string }> = {
  pending: { label: '待跟进', className: 'bg-[#fff7ed] text-[#f59e0b] border border-[#fbbf24]' },
  booked: { label: '已预约', className: 'bg-[#eff6ff] text-[#3b82f6] border border-[#60a5fa]' },
  lost: { label: '已流失', className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#9ca3af]' },
};
```

#### 4.4.6 `lead/LeadStatusBadge/index.tsx`

| 问题 | 证据 |
|-----|------|
| 与 LeadCard 重复的状态样式硬编码 | 同样的 `#fff7ed`, `#f59e0b`, `#fbbf24` 等 |
| 同一状态标签存在两个独立实现 | LeadCard 内联定义 + LeadStatusBadge 组件 |

```tsx
const DISPLAY_META: Record<DisplayStatus, { label: string; className: string }> = {
  following: { label: '待跟进', className: 'bg-[#fff7ed] text-[#f59e0b] border border-[#fbbf24]' },
  booked: { label: '已预约', className: 'bg-[#eff6ff] text-[#3b82f6] border border-[#60a5fa]' },
  lost: { label: '已流失', className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#9ca3af]' },
};
```

#### 4.4.7 `schedule/ScheduleCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 圆角不统一 | `rounded-[14rpx]` |
| 标签背景使用 Token 但尺寸不一 | `rounded-[8rpx]`, `px-[12rpx] py-[4rpx]` |

```tsx
'relative rounded-[14rpx] bg-card px-[24rpx] py-[22rpx] shadow-card'
```

#### 4.4.8 `teacher/TeacherCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 圆角混用 px 与 rpx | `rounded-[16px]`（px）与项目要求的 rpx 单位冲突 |
| 边框宽度使用 px | `border-l-[3px]` |
| 数字金额颜色语义不一致 | 未发放用 `text-amber`，已归档用 `text-success` |

```tsx
'bg-card rounded-[16px] p-4 mb-3 shadow-card active:scale-[0.98] transition-transform border-l-[3px]'
```

#### 4.4.9 `teacher/SalaryItem/index.tsx`

| 问题 | 证据 |
|-----|------|
| 按钮渐变完全硬编码 | `linear-gradient(135deg, #D4A24E, #c4922e)` 和 `linear-gradient(135deg, #3ABF6E, #2ea55a)` |
| 按钮阴影硬编码 | `rgba(212,162,78,0.35)`, `rgba(58,191,110,0.35)` |
| 使用内联 style | `style={{ background: ..., boxShadow: ... }}` |
| 角色标签引用不存在的 class | `bg-amber-bg`（实际 uno.config.ts 中无此规则，应为 `bg-amber-10`） |

```tsx
style={{
  background: 'linear-gradient(135deg, #D4A24E, #c4922e)',
  boxShadow: '0 3px 10px rgba(212,162,78,0.35)',
}}
```

#### 4.4.10 `statistics/KpiCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 顶部卡片硬编码半透明背景 | `bg-primary-foreground/20` |
| 次级卡片圆角使用 Tailwind 默认 | `rounded-2xl` |
| 字号使用 Tailwind 默认 | `text-2xl`, `text-3xl` |

```tsx
className={`flex-1 bg-primary-foreground/20 backdrop-blur-sm rounded-2xl p-3 text-center ${...}`}
```

#### 4.4.11 `profile/ProfileHeader/index.tsx`

| 问题 | 证据 |
|-----|------|
| 默认变体背景硬编码 | `bg-card` 较好，但 gradient 变体高度 `pb-[380rpx]` 硬编码 |
| gradient 变体头像边框硬编码 | `border-border` |

```tsx
'mx-[32rpx] mt-[24rpx] mb-[24rpx] px-[32rpx] py-[36rpx] rounded-[32rpx] bg-card shadow-soft'
```

#### 4.4.12 `campus/CampusCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 多处硬编码背景色 | `bg-white` |
| 硬编码圆角 | `rounded-[40rpx]` |
| 装饰区域使用内联 style | `background: linear-gradient(...)`, `box-shadow: ...` |
| 统计分隔线使用硬编码 shortcut | `border-t-d5e8e0`（对应 `#D5E2F5`） |
| ActionSheet 使用硬编码文字颜色 | `itemColor: '#333'` |

```tsx
style={{
  background:
    campus.type === 'partner'
      ? 'linear-gradient(135deg, transparent 50%, hsl(43 74% 66% / 0.1) 50%)'
      : 'linear-gradient(135deg, transparent 50%, hsl(168 55% 58% / 0.08) 50%)',
}}
```

### 4.5 其他业务组件补充

#### 4.5.1 `home/KingKongSection/index.tsx`

| 问题 | 证据 |
|-----|------|
| 图标渐变完全硬编码 | 8 组 `from/to` 色值：`#FF6B6B`, `#FF922B`, `#4DABF7`, `#845EF7` 等 |
| 多处使用内联 style | `style={{ background: ..., clipPath: ... }}` |
| 文字颜色使用 hsl 字符串 | `text-[hsl(var(--warning))]` |

```tsx
const HOME_GRID_GRADIENTS = [
  { from: '#FF6B6B', to: '#FFA94D', deg: 135 },
  { from: '#FF922B', to: '#FCC419', deg: 135 },
  // ...
];
```

#### 4.5.2 `profile/ProfileMenu/index.tsx`

| 问题 | 证据 |
|-----|------|
| 整体使用 Token 较规范 | `bg-card`, `text-foreground`, `text-muted-foreground` |
| 但图标背景色映射有限 | 仅支持 6 种语义色，扩展性不足 |

```tsx
const ICON_BG_STYLES: Record<MenuIconColor, string> = {
  primary: 'bg-primary-10',
  accent: 'bg-purple-10',
  warning: 'bg-amber-10',
  info: 'bg-info-bg',
  success: 'bg-success-bg',
  destructive: 'bg-destructive-10',
};
```

#### 4.5.3 `student/StudentAvatar/index.tsx`

| 问题 | 证据 |
|-----|------|
| 使用工具函数获取渐变 | `getAvatarGradientByName` 来自 `utils/avatar-color.ts`，可能包含硬编码 |
| 默认 src 硬编码 | `BRAND_LOGO` 作为兜底 |
| 文字颜色硬编码 | `text-white` |

```tsx
style={!showImage ? { background: getAvatarGradientByName(avatarName) } : undefined}
```

#### 4.5.4 `ActionButton/index.tsx`

| 问题 | 证据 |
|-----|------|
| 底部固定栏背景硬编码半透明 | `bg-white/95` |
| 使用全局 shortcut `btn-primary` | 规范但未使用 Token 命名 |

```tsx
<View className="fixed bottom-0 left-0 right-0 z-100 bg-white/95 backdrop-blur-sm border-t border-border">
```

#### 4.5.5 `CalendarMonthSheet/index.tsx`

| 问题 | 证据 |
|-----|------|
| 大量硬编码色值 | `#f8fafc`, `#ef4444`, `#c8ced8`, `#ffffff`, `#111827`, `#b7bfcc` |
| 使用内联 style | `style={{ backgroundColor: isSelected ? '#ffffff' : '#ef4444' }}` |
| 硬编码 rgba | `rgba(239, 68, 68, 0.08)` |

```tsx
style={{ backgroundColor: isSelected ? '#ffffff' : '#ef4444' }}
```

#### 4.5.6 `SheetInput/index.tsx`

| 问题 | 证据 |
|-----|------|
| 背景/边框完全硬编码 | `#f5faf8`, `#D5E8E0`, `#E46767` |
| 多处使用内联 style | `style={{ backgroundColor: '#f5faf8', border: '2rpx solid #D5E8E0' }}` |

```tsx
const normalStyle = {
  backgroundColor: '#f5faf8',
  border: '2rpx solid #D5E8E0',
};
```

#### 4.5.7 `proxy-booking/ProxyUserSelectSheet/index.tsx`

| 问题 | 证据 |
|-----|------|
| 多处硬编码色值 | `#ff8a4c`, `#cccccc`, `#e0e0e0` |
| 图标颜色硬编码 | `color="#94a3b8"`, `color="#999999"`, `color="#3B6EF5"` |
| 复选框样式硬编码 | `border-[#ff8a4c] bg-[#ff8a4c]` |

```tsx
checked ? 'border-[#ff8a4c] bg-[#ff8a4c]' : 'border-[#cccccc] bg-white'
```

#### 4.5.8 `class/ClassAvatar/index.tsx`

| 问题 | 证据 |
|-----|------|
| 硬编码阴影 | `shadow-[0_10rpx_30rpx_rgba(0,0,0,0.22)]` |
| 硬编码边框颜色 | `border-white`, `bg-white` |

```tsx
'flex-shrink-0 overflow-hidden rounded-full border-[6rpx] border-white bg-white shadow-[0_10rpx_30rpx_rgba(0,0,0,0.22)]'
```

#### 4.5.9 `reschedule/WorkflowHeaderCard/index.tsx`

| 问题 | 证据 |
|-----|------|
| 渐变完全硬编码 | `bg-[linear-gradient(135deg,#4f7cff_0%,#6ba7ff_100%)]`, `bg-[linear-gradient(135deg,#17b26a_0%,#36c28d_100%)]` |

```tsx
blue: 'bg-[linear-gradient(135deg,#4f7cff_0%,#6ba7ff_100%)]',
green: 'bg-[linear-gradient(135deg,#17b26a_0%,#36c28d_100%)]',
```

#### 4.5.10 `StarRating/index.tsx`

| 问题 | 证据 |
|-----|------|
| 星星颜色硬编码 | `#D1D5DB`, `#F59E0B` |

```tsx
color: '#D1D5DB'
color: '#F59E0B'
```

---

## 五、主要设计割裂点汇总（按严重程度排序）

### P0 - 必须统一（严重影响主题切换与设计一致性）

| 编号 | 割裂点 | 影响范围 | 典型证据 |
|-----|--------|---------|---------|
| P0-1 | **卡片背景色未统一使用 `bg-card`**，大量组件直接写 `bg-white` | Card, BottomSheet, Modal, ContactList, CampusCard, LeadCard, Lesson 相关卡片等 | `Card/index.tsx:52`, `BottomSheet/index.tsx:129`, `Modal/index.tsx:72`, `ContactList/index.tsx:65`, `CampusCard/index.tsx:112`, `LeadCard/index.tsx:72` |
| P0-2 | **状态标签/徽章存在多个独立实现版本**，色值硬编码且不统一 | LeadCard, LeadStatusBadge, SalaryItem, TeacherCard, TodayScheduleCard 等 | `LeadCard/index.tsx:29-37`, `LeadStatusBadge/index.tsx:26-34`, `SalaryItem/index.tsx:189-195` |
| P0-3 | **关键操作按钮渐变与阴影硬编码**，无法随主题切换 | SalaryItem 确认/发放按钮，KingKongSection 图标，WorkflowHeaderCard | `SalaryItem/index.tsx:153-166`, `KingKongSection/index.tsx:18-25`, `WorkflowHeaderCard/index.tsx:14-15` |
| P0-4 | **UnoCSS rules/shortcuts 中大量硬编码色值** 被全局复用 | `uno.config.ts` 中 `bg-petal-*`, `bg-finance-dark`, `bg-card-orange`, `bg-card-gray`, `bg-gradient-wechat`, `icon-glass-*`, `bg-white/*` 等 | `uno.config.ts:231-525`, `659-713` |
| P0-5 | **Token 命名与值不同源**：`theme.ts` 与 `app.scss` 中相同语义色值不一致 | `pageBg` 在 theme.ts 为 `#f6f7fb` 对应 HSL，但 app.scss 无 `--page-bg`；`form-border` 等仅在 app.scss | `theme.ts:244`, `app.scss:469-477` |

### P1 - 建议统一（显著影响视觉一致性）

| 编号 | 割裂点 | 影响范围 | 典型证据 |
|-----|--------|---------|---------|
| P1-1 | **圆角不统一**：同一功能卡片出现 `rounded-[14rpx]`, `rounded-[16rpx]`, `rounded-[24rpx]`, `rounded-[28rpx]`, `rounded-[32rpx]`, `rounded-[40rpx]` | 几乎所有卡片组件 | `ScheduleCard:55`, `LeadCard:72`, `Card:52`, `CampusCard:112`, `BottomSheet:129` |
| P1-2 | **阴影不统一**：既有 `shadow-card`, `shadow-soft`, 又有大量内联 `box-shadow` 和内联 `shadow-[...]` | SalaryItem, CampusCard, FormInput, LoginFlowPopover, ScheduleCardMenu | `SalaryItem/index.tsx:154`, `CampusCard/index.tsx:141`, `FormInput/index.tsx:94` |
| P1-3 | **字号/字重未统一使用 Token**：大量 `text-[22rpx]`, `text-[24rpx]`, `text-[26rpx]`, `text-[28rpx]`, `text-[30rpx]`, `text-[32rpx]` | TodayScheduleCard, LeadCard, CampusCard, SalaryItem, CalendarMonthSheet 等 | 普遍存在 |
| P1-4 | **头像配色硬编码且分散**：Avatar, StudentAvatar, ClassSelector, TeacherTab, ScheduleTab 各自维护一套颜色表 | `Avatar/index.tsx:14-22`, `ClassSelector/index.tsx:28-32`, `TeacherTab/index.tsx:36-40` |
| P1-5 | **hsl 字符串直接写在 className 中**：`text-[hsl(var(--warning))]`, `bg-[hsl(var(--primary)/0.08)]` 等，未封装为语义类名 | TodayScheduleCard, RecentLessonList, LessonConsumptionList, TodoList | `TodayScheduleCard/index.tsx:20-21`, `RecentLessonList/index.tsx:41-42`, `TodoList/index.tsx:49` |
| P1-6 | **单位混用**：部分组件使用 `px` 而非 `rpx`（如 TeacherCard `rounded-[16px]`, `border-l-[3px]`） | TeacherCard 等 | `TeacherCard/index.tsx:34` |

### P2 - 可后续优化（局部影响，可渐进治理）

| 编号 | 割裂点 | 影响范围 | 典型证据 |
|-----|--------|---------|---------|
| P2-1 | **废弃的 SCSS 文件仍存在**（虽然标注已废弃，但仍被引用） | `src/styles/theme.scss`, `src/styles/variables.scss` | 两个文件头部均标注"已废弃" |
| P2-2 | **Icon 颜色兜底逻辑复杂**，`color` prop 支持字符串色值，鼓励了硬编码 | `Icon/index.tsx:14-31` | `IconColor` 类型为 `| string` |
| P2-3 | **组件 JSDoc 与实际实现不一致**：如 Card 声称"统一卡片样式"，但使用 `bg-white` 而非 `bg-card` | `Card/index.tsx:5-9` | JSDoc 描述与源码第 52 行矛盾 |
| P2-4 | **shortcuts 中内联 style 迁移类名过多**：`bg-f5faf8`, `border-d5e8e0`, `bg-white` 等把过去内联 style 直接迁移为 shortcut，未接入 Token | `uno.config.ts:944-1000` | 大量 `bg-#` / `border-#` shortcut |
| P2-5 | **BottomSheet 仍保留向后兼容的 `show` prop**，与规范要求的"只传 visible"冲突 | `BottomSheet/index.tsx:22-26` | `show?: boolean` 仍被保留 |

---

## 六、组件分级治理建议

### P0 必须统一（建议优先重构）

1. **`Card` / `BottomSheet` / `Modal` / `Dialog`**：统一背景为 `bg-card`，圆角使用语义 Token（如 `rounded-card` / `rounded-sheet`）
2. **`LeadStatusBadge` + `LeadCard` 状态标签**：合并为单一 `StatusBadge` 组件，使用 `warning/primary/success/muted` 等语义 Token
3. **`SalaryItem` 操作按钮**：用 `btn-primary` / `btn-success` 等语义按钮替代硬编码渐变
4. **`uno.config.ts` 中硬编码 rules/shortcuts**：将 `bg-petal-*`, `bg-card-orange`, `bg-card-gray`, `bg-finance-dark` 等接入 Token 或标记为业务私有
5. **`Avatar` / `StudentAvatar` / `ClassAvatar`**：统一头像配色方案，接入 `accent`, `warning`, `info`, `success` 等 Token

### P1 建议统一（中期治理）

1. **统一卡片圆角规范**：建议基础卡片 `rounded-card(32rpx)`，列表项 `rounded-lg(16rpx)`，弹窗 `rounded-sheet(40rpx)`，标签 `rounded-tag(20rpx)`
2. **统一阴影规范**：区分 `shadow-card`, `shadow-soft`, `shadow-float`, `shadow-popup` 的使用场景，禁止内联 `box-shadow`
3. **统一字号规范**：使用 `text-xs/sm/base/lg/xl/2xl` 等 Token，禁止大量 `text-[XXrpx]`
4. **统一状态色使用**：所有状态标签、进度条、按钮均通过 `bg-primary/10 text-primary` 等语义组合实现
5. **清理 hsl 字符串**：将 `text-[hsl(var(--x))]` 封装为 `text-x` 类名

### P2 可后续优化

1. 删除或清空已废弃的 `theme.scss` / `variables.scss`
2. 限制 `Icon` 的 `color` prop 类型，移除 `| string`，强制使用 Token 名称
3. 修正组件 JSDoc 与实现不一致的问题
4. 逐步清理 shortcuts 中的内联 style 迁移类名
5. 移除 `BottomSheet` 的 `show` prop，统一为 `visible`

---

## 七、核心发现摘要

本次审计共扫描 `src/components/` 下约 **100+ 个组件**，抽样详细审查了 **30 个代表性组件**，并检查了 `uno.config.ts`、`src/theme.ts`、`src/app.scss` 等核心设计配置文件。核心发现如下：

1. **卡片背景色系统紊乱**：本应使用 `bg-card` 的通用卡片容器（Card、BottomSheet、Modal、LeadCard、CampusCard 等）大量直接使用 `bg-white`，导致深色/主题切换时无法统一响应。

2. **状态标签多个实现版本并存**：线索状态在 `LeadCard` 和 `LeadStatusBadge` 中各自硬编码了 `#fff7ed/#f59e0b` 等色值；教师薪资卡片也独立实现了 `VARIANT_CLS`，同一业务语义存在多套视觉。

3. **关键操作按钮硬编码渐变**：`SalaryItem` 的"确认"/"发放"按钮、`KingKongSection` 的 8 个图标渐变、`WorkflowHeaderCard` 的头部渐变均使用内联 `linear-gradient` 和 `rgba` 阴影，完全脱离主题系统。

4. **UnoCSS 配置层本身包含大量硬编码**：`uno.config.ts` 的 `rules` 和 `shortcuts` 中存在 40+ 处硬编码色值/渐变/阴影，并通过全局类名被组件复用，成为设计割裂的"基础设施层"问题。

5. **Token 体系过度扩展且命名混乱**：`theme.ts` 中 `extendedColors` 包含了 80+ 个高度业务化的 Token（如 `scheduleBlueBgg`、`avatarCoralDeepDark`、`badgeOrangeBorder`），语义层级不清，且多主题覆盖不完整。

6. **圆角、阴影、字号未统一**：同一项目内卡片圆角从 `14rpx` 到 `40rpx` 跨度巨大；阴影既有 Token 又有内联；字号大量直接使用 `text-[22rpx]` 等硬编码尺寸。

建议优先治理 **P0 级别**的卡片背景、状态标签、按钮渐变、UnoCSS 硬编码规则四项，可在短期内显著提升设计一致性；**P1/P2** 可通过制定组件设计规范后渐进式重构。

---

*报告结束*
