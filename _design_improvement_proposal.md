# 云策教务小程序 - 组件级设计系统改进方案

> 本方案基于对 `src/components/` 的完整审计，在不改动原项目代码的前提下，提出组件提取、Token 精简与视觉统一的方向，并附可预览的效果文件。

---

## 一、现状诊断

项目已建立 `theme.ts` + `app.scss` + `uno.config.ts` 的 Token 体系，但实际组件层存在严重割裂：

| 维度 | 问题 | 典型表现 |
|------|------|---------|
| **背景色** | 未统一使用 `bg-card` | `Card`、`BottomSheet`、`Modal`、`LeadCard`、`CampusCard` 等大量使用 `bg-white` |
| **状态标签** | 同一业务语义多套视觉 | `LeadCard` 与 `LeadStatusBadge` 各自硬编码 `#fff7ed/#f59e0b` 等色值 |
| **按钮/图标渐变** | 硬编码渐变与阴影 | `SalaryItem`、`KingKongSection`、`WorkflowHeaderCard` 使用内联 `linear-gradient` |
| **UnoCSS 层** | 配置即硬编码 | `uno.config.ts` 中 40+ 处硬编码色值/渐变/阴影被全局复用 |
| **Token 体系** | 过度扩展、语义混乱 | `extendedColors` 含 80+ 业务化 Token，如 `scheduleBlueBgg`、`avatarCoralDeepDark` |
| **圆角/阴影/字号** | 多版本并存 | 卡片圆角从 `14rpx` 到 `40rpx`，字号大量使用 `text-[22rpx]` |

---

## 二、组件提取与分级治理

### 2.1 组件分层模型

建议将现有 100+ 组件按职责重新分层，优先统一 **基础层** 与 **模式层**：

```
┌─────────────────────────────────────────┐
│  业务层（60+）                           │
│  TodayScheduleCard / LeadCard / KPI...  │
├─────────────────────────────────────────┤
│  模式层（15+）                           │
│  StatusBadge / DataCard / ListItem /    │
│  GradientHeader / ActionBar...          │
├─────────────────────────────────────────┤
│  基础层（12）                            │
│  Button / Card / FormInput / BottomSheet│
│  Modal / Dialog / Avatar / Badge / Tag  │
│  Empty / Loading / Icon                 │
└─────────────────────────────────────────┘
```

### 2.2 基础层组件统一规范（P0）

| 组件 | 当前问题 | 统一方向 |
|------|---------|---------|
| `Card` | `bg-white` + `rounded-[32rpx]` | 使用 `bg-card rounded-card shadow-soft` |
| `BottomSheet` | `bg-white` + `rounded-t-[40rpx]` | 使用 `bg-card rounded-t-sheet` |
| `Modal/Dialog` | `bg-white` + 独立遮罩 | 使用 `bg-card rounded-card`，遮罩统一为 `overlay` |
| `FormInput` | capsule 变体硬编码阴影 | 使用 `border-input bg-background`，阴影走 Token |
| `ActionButton` | 底部栏 `bg-white/95` | 使用 `bg-card/95 backdrop-blur` |
| `Avatar` | 8 色硬编码 | 使用 `accent/warning/info/success` 等语义 Token 轮询 |
| `Badge/Tag` | 多版本硬编码 | 统一为 `StatusBadge`，基于 `variant` + `tone` |

### 2.3 模式层组件提取（P1）

从现有业务组件中提取可复用模式，避免同类卡片重复实现：

| 模式组件 | 来源组件 | 用途 |
|----------|---------|------|
| `StatusBadge` | `LeadStatusBadge`、`LeadCard` 状态标签、`SalaryItem` 角色标签 | 统一状态/角色/分类标签 |
| `DataCard` | `StatCard`、`KpiCard`、`ProfileStats` | 渐变头部上的数据卡片 |
| `ListItem` | `ScheduleCard`、`TeacherCard`、`LessonConsumptionList` | 左图/左标 + 中内容 + 右操作 |
| `GradientHeader` | `ProfileHeader` gradient 变体、`home` 头部 | 顶部渐变背景 + 安全区适配 |
| `ActionBar` | `ActionButton` 非固定模式、`SalaryItem` 操作区 | 底部或卡片内操作按钮组 |
| `IconButton` | `KingKongSection`、`ProfileMenu` | 图标 + 文字快捷入口 |

---

## 三、精简后的 Token 体系

### 3.1 核心语义 Token（必须全部接入）

```ts
// 主题色
primary / primary-foreground / primary-soft / primary-glow / primary-dark
secondary / secondary-foreground
accent / accent-foreground / accent-glow

// 表面与背景
background / foreground / foreground-secondary / foreground-muted
card / card-foreground / muted / muted-foreground

// 边框与输入
border / border-light / input / input-border / ring

// 状态色（用于按钮、标签、提示）
success / success-foreground / success-bg / success-border
warning / warning-foreground / warning-bg / warning-border
destructive / destructive-foreground / destructive-bg / destructive-border
info / info-foreground / info-bg / info-border

// 圆角（语义化）
radius-xs / radius-sm / radius-md / radius-lg / radius-xl
radius-card / radius-input / radius-sheet / radius-button / radius-tag / radius-round

// 阴影（语义化）
shadow-card / shadow-soft / shadow-float / shadow-popup / shadow-elegant

// 间距（语义化）
spacing-xs / spacing-sm / spacing-md / spacing-lg / spacing-xl / page-padding
```

### 3.2 删除/合并的 Token

| 待删除/合并 | 原因 | 替代方案 |
|------------|------|---------|
| `extendedColors` 中 80+ 业务 Token | 语义层级混乱 | 按用途归入 `success/warning/info` 等通用状态 Token |
| `avatarMint/avatarPink/...` | 头像专用色过多 | 使用 `primary/accent/warning/info/success/destructive` 6 色轮询 |
| `scheduleBlueBg/scheduleBlueBgg/...` | 课表专用色 | 使用 `primary/info/success/warning` 语义 Token |
| `badgeOrangeBg/badgeBlueBg/...` | 徽章专用色 | 统一为 `bg-warning/10 text-warning` 等 |
| `petal-*` | 仅 KPI 渐变使用 | 改用 `primary/accent/warning/success/destructive` 语义渐变 |
| `form-border` / `form-border-light` | app.scss 中硬编码 | 使用 `border-input` |

---

## 四、关键组件改进规格

### 4.1 Card 容器

```tsx
// 改进后
<View className="bg-card rounded-card shadow-soft p-card">
  {children}
</View>
```

| 属性 | 当前 | 改进 |
|------|------|------|
| 背景 | `bg-white` | `bg-card` |
| 圆角 | `rounded-[32rpx]` | `rounded-card`（32rpx） |
| 阴影 | `shadow-soft` | 保持 `shadow-soft` |
| padding | `p-5` / `p-8` | `p-card-md` / `p-card-lg` |

### 4.2 StatusBadge 状态标签（新增统一组件）

```tsx
interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: 'primary' | 'warning' | 'success' | 'destructive' | 'muted';
  variant?: 'filled' | 'outlined' | 'ghost';
  size?: 'sm' | 'md';
}
```

| 状态 | 当前硬编码 | 改进后 |
|------|-----------|--------|
| 待跟进 | `bg-[#fff7ed] text-[#f59e0b]` | `bg-warning/10 text-warning` |
| 已预约 | `bg-[#eff6ff] text-[#3b82f6]` | `bg-primary/10 text-primary` |
| 已流失 | `bg-[#f3f4f6] text-[#6b7280]` | `bg-muted text-muted-foreground` |
| 已完成 | 自定义 `course-tag-done` | `bg-success/10 text-success` |

### 4.3 Button 按钮

```tsx
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fixed?: boolean;
}
```

| 变体 | 样式 |
|------|------|
| primary | `bg-gradient-primary text-primary-foreground` |
| secondary | `bg-secondary text-secondary-foreground` |
| outline | `border-2 border-primary text-primary bg-transparent` |
| ghost | `text-primary` |
| success | `bg-success text-success-foreground` |
| warning | `bg-warning text-warning-foreground` |
| danger | `bg-destructive text-destructive-foreground` |

### 4.4 FormInput 输入框

```tsx
// default 变体
<View className="bg-input/50 border border-input rounded-input focus-within:border-primary focus-within:bg-card">
  <Input className="text-base text-foreground" />
</View>

// capsule 变体
<View className="bg-card border border-border rounded-full shadow-soft">
  <Input className="text-center text-base text-foreground" />
</View>
```

### 4.5 Avatar 头像

```ts
const AVATAR_GRADIENTS = [
  'bg-gradient-primary',     // primary
  'bg-gradient-accent',      // accent
  'bg-class-amber',          // warning
  'bg-class-info',           // info
  'bg-kpi-green',            // success
  'bg-class-red',            // destructive
];
```

统一使用语义色渐变，删除 8 个硬编码色值。

---

## 五、UnoCSS 配置层清理方向

### 5.1 规则层（Rules）

| 规则类型 | 处理方式 |
|----------|---------|
| `bg-petal-*` | 删除，改用 `bg-primary/10` 等语义背景 |
| `bg-finance-dark` | 标记为业务私有，或接入 `foreground` Token |
| `bg-card-orange` / `bg-card-gray` | 删除，会员卡状态用 `warning` / `muted` |
| `icon-glass-*` | 接入 `accent/10`、`warning/10` 等 Token |
| `course-type-art-*` | 删除，课程类型统一使用 `primary/accent/warning/info/success` |
| `bg-white/8` 等 | 删除，使用 `bg-card/8` 或 `bg-white` 原生透明度 |

### 5.2 Shortcuts 层

| shortcut | 处理方式 |
|----------|---------|
| `bg-campus-card`、`border-campus-card` | 改为 `bg-success-bg border-success-border` |
| `text-gold` 等 | 删除或归入品牌专用 Token |
| `bg-f5faf8` 等迁移类 | 全部替换为语义 Token |
| `bg-gradient-primary-dark2` | 与 `bg-gradient-primary` 合并 |
| `bg-login-*` | 标记为登录页私有，或接入 Token |

---

## 六、视觉风格定调

### 6.1 默认主题（采集蓝）

- **Primary**: `#3B6EF5`（品牌蓝，用于主按钮、选中态、关键数据）
- **Accent**: `#8B5CF6`（花瓣紫，用于强调、图表第二色）
- **Background**: `#F8F9FA`（浅灰背景，降低视觉疲劳）
- **Card**: `#FFFFFF`（纯白卡片，保持清爽）
- **Success/Warning/Destructive**: `#10B981` / `#F59E0B` / `#EF4444`

### 6.2 设计原则

1. **少即是多**：减少渐变使用，主按钮保留渐变，其余使用纯色或半透明背景。
2. **语义优先**：所有组件颜色必须对应 Token，禁止硬编码。
3. **层级清晰**：通过 `card` > `background` > `muted` 三层表面建立空间感。
4. **圆角有秩**：
   - 大卡片：`32rpx`
   - 列表项/小卡片：`16rpx`
   - 底部弹窗顶部：`40rpx`
   - 按钮/标签：`48rpx` / `20rpx`
5. **阴影克制**：仅使用 `shadow-card`（轻）、`shadow-soft`（中）、`shadow-float`（浮层）。

---

## 七、迁移路线图（不改动原代码阶段）

### 阶段 1：设计系统定稿（当前）

- [x] 完成组件审计
- [x] 输出改进方案（本文档）
- [x] 输出视觉预览（`_component_design_showcase.html`）

### 阶段 2：Token 精简（建议后续执行）

1. 在 `theme.ts` 中清理 `extendedColors`，保留核心语义 Token。
2. 同步精简 `app.scss` 中的 CSS 变量。
3. 在 `uno.config.ts` 中删除硬编码规则，补充语义 shortcut。

### 阶段 3：基础组件重构

1. 重构 `Card`、`BottomSheet`、`Modal`、`FormInput`、`ActionButton`。
2. 新增 `StatusBadge`、`DataCard`、`ListItem`、`IconButton` 模式组件。
3. 统一 `Avatar` 配色方案。

### 阶段 4：业务组件迁移

1. 按模块逐个替换业务组件中的硬编码色值。
2. 优先处理 P0 组件：`LeadCard`、`SalaryItem`、`KingKongSection`、`WorkflowHeaderCard`。
3. 建立组件使用规范文档，防止新增组件继续硬编码。

---

## 八、验收标准

当完成重构后，应满足：

- [ ] 所有基础组件背景色使用 `bg-card` 或 `bg-background`，无 `bg-white` 硬编码。
- [ ] 状态标签仅通过 `StatusBadge` 组件实现，无分散硬编码。
- [ ] `uno.config.ts` 中无硬编码色值/渐变/阴影规则（除微信绿等无法替代的品牌色）。
- [ ] 主题切换（蓝/珊瑚/橙）时，所有组件颜色正确联动。
- [ ] 同一类型组件圆角、阴影、字号统一。
- [ ] `npm run check` 通过。

---

*方案基于不改动原项目代码的前提制定，所有改进方向与展示效果均可在 `_component_design_showcase.html` 中预览。*
