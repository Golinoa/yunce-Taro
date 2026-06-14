# 班级管理模块迁移计划

> 将 `class-final.html` 原型设计迁移到 Taro 小程序项目中

---

## 一、现状分析

### 1.1 现有页面

| 页面 | 文件 | 现状 |
|------|------|------|
| 班级列表 | `pages/classes/index.tsx` | 简单列表，无筛选/搜索/分组 |
| 班级详情 | `pages/class-detail/index.tsx` | 基础信息+学生列表，无上课记录 |
| 创建/编辑 | `pages/class-form/index.tsx` | 仅名称+备注+选学生，缺少类型/时间/老师 |
| 消课 | `pages/class-checkin/index.tsx` | 孤立页面，无入口可达 |
| 消课表单 | `pages/lesson-form/index.tsx` | 当前实际消课入口 |

### 1.2 核心差距

| 设计功能 | 现有实现 | 差距 |
|---------|---------|------|
| Tab筛选（全部/进行中/已结课） | 无 | 需新增 |
| 紧凑横条卡片 | 简单列表卡片 | 需重写 |
| 循环课/课时制区分 | 无类型字段 | 需扩展数据模型 |
| 已结课紫色主题 | 无结课状态 | 需新增状态 |
| 星期多选+时间段 | 文本输入 | 需重写表单 |
| 授课老师选择 | 无 | 需新增 |
| 消课签到学生勾选 | 固定扣1课时 | 需重写 |
| 学生左滑调班/移除 | 仅移除 | 需新增调班 |
| 调班弹窗 | 无 | 需新增 |
| 上课记录展开 | 无 | 需新增 |
| 学生详情底部操作 | 无操作按钮 | 需新增 |
| 骨架屏加载 | 无 | 需新增 |

### 1.3 数据模型差距

当前 `Class` 接口仅6个字段，缺少：`type`、`status`、`schedule`、`weekdays`、`start_time`、`end_time`、`total_lessons`、`used_lessons`、`teachers`、`start_date`、`end_date`、`color`、`student_count`。

---

## 二、迁移策略

### 2.1 原则

1. **UnoCSS 原子化样式**：所有新样式使用 UnoCSS class，不创建 SCSS 文件
2. **自适应写法**：使用 `presetRemRpx`（baseFontSize=12, screenWidth=375），所有尺寸用 rem 单位自动转 rpx
3. **设计 Token 对齐**：颜色、圆角、阴影使用 `theme.ts` 和 `uno.config.ts` 中已定义的 token
4. **组件复用**：抽取可复用组件到 `src/components/`
5. **渐进迁移**：按优先级分批实施，每批可独立验证

### 2.2 样式映射表

| 原型 CSS | UnoCSS 类名 | 说明 |
|---------|------------|------|
| `color: var(--primary)` | `text-primary` | 主色文字 |
| `background: var(--primary)` | `bg-primary` | 主色背景 |
| `background: var(--primary-bg)` | `bg-primary-10` 或 `bg-muted` | 主色浅底 |
| `border: 1px solid var(--border)` | `border border-border` | 边框 |
| `border-radius: 12px` | `rounded-md` (12rpx) | 圆角 |
| `font-size: 13px` | `text-sm` (24rpx) | 字号 |
| `font-weight: 600` | `font-semibold` | 字重 |
| `padding: 14px` | `p-3_d5` (21rpx≈14px) | 内边距 |
| `gap: 8px` | `gap-2` (16rpx≈8px) | 间距 |
| `box-shadow: ...` | `shadow-card` | 阴影 |
| `background: linear-gradient(...)` | `bg-gradient-primary` | 渐变 |

### 2.3 新增 UnoCSS 规则

迁移时需要在 `uno.config.ts` 的 `rules` 中补充：

```typescript
// 班级类型颜色
['bg-amber-soft', { background: 'linear-gradient(135deg, hsl(43 74% 66%), hsl(43 74% 80%))' }],
['bg-purple-soft', { background: 'linear-gradient(135deg, hsl(260 45% 72%), hsl(260 45% 82%))' }],
// 紫色主题
['text-purple', { color: '#9b7ed8' }],
['bg-purple-10', { background: 'rgba(155, 126, 216, 0.1)' }],
['border-purple', { 'border-color': '#9b7ed8' }],
// 班级卡片渐变图标
['bg-class-primary', { background: 'linear-gradient(135deg, #5EC8A8, #7dd8bc)' }],
['bg-class-accent', { background: 'linear-gradient(135deg, #e88aaa, #f0b3c7)' }],
['bg-class-amber', { background: 'linear-gradient(135deg, #d4a24e, #e8c47a)' }],
['bg-class-info', { background: 'linear-gradient(135deg, #6ba3d6, #93c5e8)' }],
['bg-class-purple', { background: 'linear-gradient(135deg, #9b7ed8, #bda4e8)' }],
```

---

## 三、分批迁移计划

### P0 - 数据模型与基础（前置依赖）

**目标**：扩展类型定义和 Mock 数据，为后续 UI 迁移提供数据支撑

| 任务 | 文件 | 说明 |
|------|------|------|
| 扩展 Class 类型 | `src/types/class.ts` | 新增 type/status/schedule/weekdays/teachers 等字段 |
| 新增 ClassColor 类型 | `src/types/class.ts` | 班级颜色枚举 |
| 更新 Mock 数据 | `src/data/students.ts` | mockGetClassesByTeacher 返回扩展字段 |
| 新增 mockUpdateClass | `src/data/students.ts` | 编辑班级时更新名称/时间/类型 |
| 新增 mockTransferStudent | `src/data/students.ts` | 学生调班 |
| 新增 mockEndClass | `src/data/students.ts` | 结课操作 |

### P1 - 班级列表页（核心体验）

**目标**：实现 Tab 筛选 + 紧凑横条卡片 + 搜索 + 骨架屏

| 任务 | 文件 | 说明 |
|------|------|------|
| Tab 筛选栏 | `pages/classes/index.tsx` | 全部/进行中/已结课，白色背景+绿色下划线 |
| 紧凑横条卡片 | `pages/classes/index.tsx` | 方案E卡片，区分循环/课时/已结课 |
| 搜索功能 | `pages/classes/index.tsx` | 搜索与Tab联动 |
| 骨架屏 | `pages/classes/index.tsx` | 加载时显示骨架卡片 |
| 空状态 | `pages/classes/index.tsx` | 筛选无结果时提示 |
| 分组标题 | `pages/classes/index.tsx` | 长期班/特训班/已结课分组 |
| 卡片左滑删除 | `pages/classes/index.tsx` | 复用现有 Movable 组件或自实现 |

### P2 - 创建/编辑班级

**目标**：完整表单，支持类型/时间/老师/学员

| 任务 | 文件 | 说明 |
|------|------|------|
| 上课类型选择 | `pages/class-form/index.tsx` | 循环/课时制双卡片 |
| 星期多选器 | 新组件 `components/WeekdayPicker/index.tsx` | 7个圆形按钮 |
| 时间段选择 | `pages/class-form/index.tsx` | 开始-结束时间 |
| 日期范围 | `pages/class-form/index.tsx` | 课时制时显示 |
| 授课老师选择 | `pages/class-form/index.tsx` | 多选胶囊按钮 |
| 学员选择器 | 新组件 `components/StudentPicker/index.tsx` | 搜索+多选+计数 |
| 表单校验 | `pages/class-form/index.tsx` | 名称/时间/老师必填 |
| 编辑模式回填 | `pages/class-form/index.tsx` | 自动回填所有字段 |

### P3 - 班级详情页

**目标**：完整详情 + 学生管理 + 上课记录

| 任务 | 文件 | 说明 |
|------|------|------|
| 详情头部 | `pages/class-detail/index.tsx` | 渐变图标+名称+类型标签 |
| 统计卡片 | `pages/class-detail/index.tsx` | 已上课时/总课时/学生数 |
| 上课安排 | `pages/class-detail/index.tsx` | 时间+备注 |
| 课时进度条 | `pages/class-detail/index.tsx` | 循环=拉满，课时制=百分比 |
| 学生列表 | `pages/class-detail/index.tsx` | 头像+姓名+课时+箭头 |
| 学生左滑 | `pages/class-detail/index.tsx` | 调班(绿)+移除(红)，互斥 |
| 添加学员按钮 | `pages/class-detail/index.tsx` | 标题旁"+"按钮 |
| 底部操作栏 | `pages/class-detail/index.tsx` | 消课/编辑/结课 |
| 已结课紫色主题 | `pages/class-detail/index.tsx` | 条件渲染紫色配色 |
| 收费与流水 | `pages/class-detail/index.tsx` | 已结课时显示 |
| 上课记录 | `pages/class-detail/index.tsx` | 可展开签到详情 |

### P4 - 消课与调班

**目标**：完善消课流程，新增调班功能

| 任务 | 文件 | 说明 |
|------|------|------|
| 消课弹窗改造 | `pages/class-detail/index.tsx` | 底部弹窗，签到勾选+老师选择 |
| 调班弹窗 | 新组件 `components/TransferSheet/index.tsx` | 班级列表选择器 |
| 学生详情操作栏 | `pages/student-detail/index.tsx` | 消课/调班/移除按钮 |

### P5 - 优化与收尾

| 任务 | 说明 |
|------|------|
| 下拉刷新 | 班级列表下拉刷新 |
| 页面间数据同步 | 操作后返回自动刷新 |
| 消课页面统一 | 合并 class-checkin 和 lesson-form 的班级模式 |
| 动画优化 | 弹窗进出、卡片展开等过渡动画 |
| 边界情况 | 网络错误、数据为空、权限校验 |

---

## 四、组件抽取计划

从原型中抽取为独立可复用组件：

| 组件 | 路径 | 说明 |
|------|------|------|
| WeekdayPicker | `components/WeekdayPicker/` | 星期多选器 |
| StudentPicker | `components/StudentPicker/` | 学员选择器（搜索+多选） |
| TransferSheet | `components/TransferSheet/` | 调班弹窗 |
| ClassCard | `components/ClassCard/` | 班级卡片（支持3种类型） |
| FilterTabs | `components/FilterTabs/` | 筛选Tab栏 |
| SwipeAction | `components/SwipeAction/` | 左滑操作（调班+移除） |
| LessonSheet | `components/LessonSheet/` | 消课底部弹窗 |
| ScheduleInput | `components/ScheduleInput/` | 上课时间输入（星期+时间段） |
| ProgressBadge | `components/ProgressBadge/` | 课时进度/∞标识 |
| CheckinRecord | `components/CheckinRecord/` | 可展开签到记录卡片 |

---

## 五、注意事项

1. **自适应写法**：所有尺寸使用 rem 单位（如 `p-4` = 48rpx），由 `presetRemRpx` 自动转换，不要硬编码 rpx 值
2. **设计 Token**：颜色使用 `text-primary`、`bg-muted` 等 token 类名，不要直接写 `#5EC8A8`
3. **Taro 限制**：
   - 不支持 `onclick` 内联事件，需用 `onClick={handler}`
   - 不支持 `style` 内联 CSS 变量，需用 `style={{ color: 'var(--primary)' }}`
   - 左滑操作需用 `<MovableArea>` + `<MovableView>` 或自定义 touch 事件
   - 弹窗用 `<Popup>` 组件或自定义
4. **数据流**：页面间通过路由参数传递 ID，数据从 Mock/API 获取，不依赖全局状态
5. **兼容性**：保持与现有页面（首页、统计页、学生页）的设计语言一致
