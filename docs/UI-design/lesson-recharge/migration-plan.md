# 课时充值模块迁移计划

> 将 `lesson-recharge.html` 原型设计迁移到 Taro 小程序项目 `pages/package-form/index.tsx`

---

## 一、现状分析

### 1.1 现有页面

| 页面 | 文件 | 现状 |
|------|------|------|
| 课时充值 | `pages/package-form/index.tsx` | 基础表单：学生选择+套餐名称+课时+有效期+费用，无课包模板选择、无赠送课时、无分期 |

### 1.2 核心差距

| 设计功能 | 现有实现 | 差距 |
|---------|---------|------|
| 学生信息卡片（渐变+统计） | 简单 Picker 选择 | 需重写为学生卡片组件 |
| 课包模板浮窗选择 | 无 | 需新增，复用 BottomSheet |
| 课包摘要卡片（选中后展示） | 无 | 需新增 |
| 自定义课包（浮窗内表单） | 仅套餐名称输入 | 需扩展 |
| 课包信息编辑（仅自定义时显示） | 无，直接输入课时 | 需新增条件渲染 |
| 赠送课时（步进器+快捷标签） | 无 | 需新增 |
| 分期付款面板 | 无 | 需新增，复用 InstallmentPanel |
| 底部摘要按钮（课时+金额） | 简单保存按钮 | 需重写 |
| 备注 | 无 | 需新增 |
| 快捷课时标签 | 有（1/3/5/10/15/20/25/30） | 需调整为设计稿标签（10/16/24/36/48） |
| 有效期输入 | 日期选择器+天数输入+日期范围 | 需简化为天数输入（0=永久） |

### 1.3 数据模型差距

当前 `CoursePackage` 接口缺少：`gift_hours`（赠送课时）、`template_id`（关联课包模板）、`installment_enabled`、`installment_period`、`installment_schedule`。

---

## 二、迁移策略

### 2.1 原则

1. **UnoCSS 原子化样式**：所有新样式使用 UnoCSS class，不创建 SCSS 文件
2. **自适应写法**：使用 `presetRemRpx`（baseFontSize=12, screenWidth=375），所有尺寸用 rem 单位自动转 rpx
3. **设计 Token 对齐**：颜色、圆角、阴影使用 `theme.ts` 和 `uno.config.ts` 中已定义的 token
4. **组件复用**：抽取可复用组件到 `src/components/`，复用已有 BottomSheet/ChipPicker/InstallmentPanel
5. **渐进迁移**：按优先级分批实施，每批可独立验证

### 2.2 样式映射表

| 原型 CSS | UnoCSS 类名 | 说明 |
|---------|------------|------|
| `color: var(--primary)` | `text-primary` | 主色文字 |
| `background: var(--primary)` | `bg-primary` | 主色背景 |
| `background: var(--primary-bg)` | `bg-primary-10` 或 `bg-muted` | 主色浅底 |
| `background: var(--bg-page)` | `bg-page` | 页面背景 |
| `border: 1px solid var(--border)` | `border border-border` | 边框 |
| `border-radius: 16px` | `rounded-2xl` (32rpx) | 卡片圆角 |
| `border-radius: 12px` | `rounded-xl` (24rpx) | 输入框圆角 |
| `border-radius: 24px` | `rounded-3xl` (48rpx) | 按钮圆角 |
| `font-size: 14px` | `text-md` (28rpx) | 正文 |
| `font-size: 16px` | `text-lg` (32rpx) | 标题 |
| `font-size: 12px` | `text-xs` (24rpx) | 辅助 |
| `font-size: 11px` | `text-[22rpx]` | 最小字号 |
| `padding: 16px` | `p-4` (32rpx) | 卡片内边距 |
| `gap: 12px` | `gap-3` (24rpx) | 卡片间距 |
| `box-shadow: var(--shadow)` | `shadow-soft` | 卡片阴影 |

### 2.3 设计 Token → 项目 Token 映射

| 设计 Token | 项目 Token | 色值 |
|-----------|-----------|------|
| --primary | --primary / text-primary | #5EC8A8 |
| --destructive | --destructive / text-destructive | #D94040 |
| --border | --border / border-border | #D5E8E0 |
| --bg-page | bg-page / --background | #F5FAF8 |
| --success | --success / text-success | #3ABF6E |
| --amber | --amber / text-amber | #d4a24e |
| --purple | --purple / text-purple | #9b7ed8 |
| --accent | --accent / text-accent | #e88aaa |

---

## 三、分批迁移计划

### P0 - 数据模型扩展（前置依赖）

**目标**：扩展类型定义和 Mock 数据，为 UI 迁移提供数据支撑

| 任务 | 文件 | 说明 |
|------|------|------|
| 扩展 RechargeFormData | `src/types/course-package.ts` | 新增 gift_hours/template_id/installment 字段 |
| 新增 ScheduleItem 类型 | `src/types/course-package.ts` | 从 InstallmentPanel 提取公共类型 |
| 新增 mockGetPackageTemplates | `src/data/students.ts` | 获取课包模板列表 |
| 新增 mockCreateRecharge | `src/data/students.ts` | 充值（含赠送课时+分期） |

### P1 - 学生信息卡片（核心体验）

**目标**：替换简单 Picker 为渐变学生信息卡片

| 任务 | 文件 | 说明 |
|------|------|------|
| StudentCard 组件 | `components/StudentCard/index.tsx` | 渐变背景+头像+姓名+手机+统计 |
| 统计数据展示 | `components/StudentCard/index.tsx` | 剩余课时/进行中课包/已消课次 |
| 更换学员弹窗 | 复用 `components/BottomSheet` | 搜索+学员列表 |
| 集成到 package-form | `pages/package-form/index.tsx` | 替换现有 Picker |

### P2 - 课包选择浮窗

**目标**：实现课包模板浮窗选择 + 自定义课包

| 任务 | 文件 | 说明 |
|------|------|------|
| PackagePickerSheet 组件 | `components/PackagePickerSheet/index.tsx` | 底部浮窗，含模板列表+自定义表单 |
| 课包选项卡片 | `components/PackagePickerSheet/index.tsx` | 图标+名称+描述+标签+价格+radio |
| 自定义课包表单 | `components/PackagePickerSheet/index.tsx` | 名称+课时+有效期+金额输入 |
| 已选课包摘要卡片 | `pages/package-form/index.tsx` | 选中后页面展示摘要+更改按钮 |
| 未选择占位卡片 | `pages/package-form/index.tsx` | 虚线框+提示文字 |
| 集成到 package-form | `pages/package-form/index.tsx` | 替换现有套餐名称+快捷课时 |

### P3 - 课包信息与赠送课时

**目标**：条件显示课包信息编辑 + 赠送课时模块

| 任务 | 文件 | 说明 |
|------|------|------|
| 课包信息卡片（仅自定义时显示） | `pages/package-form/index.tsx` | 课时步进器+有效期+快捷标签 |
| 赠送课时模块 | `pages/package-form/index.tsx` | 步进器+快捷标签(0/+1/+2/+4)+合计提示 |
| 底部按钮摘要更新 | `pages/package-form/index.tsx` | 显示合计课时（含赠送）+金额 |

### P4 - 收费信息与分期

**目标**：完善收费信息 + 集成分期付款

| 任务 | 文件 | 说明 |
|------|------|------|
| 金额输入（¥前缀） | `pages/package-form/index.tsx` | 带货币符号的输入框 |
| 支付方式选择 | 复用 `components/ChipPicker` | 微信/支付宝/现金/转账/其他 |
| 分期开关 | `pages/package-form/index.tsx` | Toggle 开关 |
| 分期面板 | 复用 `components/InstallmentPanel` | 摘要+期数+还款计划 |
| 备注输入 | `pages/package-form/index.tsx` | 多行文本输入 |

### P5 - 优化与收尾

| 任务 | 说明 |
|------|------|
| 表单校验 | 学员必选+课包必选+课时>0 |
| 编辑模式回填 | 编辑时自动回填所有字段 |
| 页面间数据同步 | 充值后返回自动刷新学生详情 |
| 骨架屏加载 | 加载时显示骨架卡片 |
| 空状态 | 无学员/无课包时的提示 |
| 边界情况 | 网络错误、数据为空 |

---

## 四、组件抽取计划

从原型中抽取为独立可复用组件：

| 组件 | 路径 | 说明 | 复用已有 |
|------|------|------|---------|
| StudentCard | `components/StudentCard/` | 渐变学生信息卡片 | 否 |
| PackagePickerSheet | `components/PackagePickerSheet/` | 课包选择浮窗 | 底层用 BottomSheet |
| StepperInput | `components/StepperInput/` | 步进器输入（-/+按钮+数字） | 否 |
| GiftHoursInput | `components/GiftHoursInput/` | 赠送课时输入（步进器+快捷标签） | 用 StepperInput |

已有可复用组件：

| 组件 | 路径 | 用途 |
|------|------|------|
| BottomSheet | `components/BottomSheet/` | 学员/课包选择弹窗 |
| ChipPicker | `components/ChipPicker/` | 支付方式/期数选择 |
| InstallmentPanel | `components/InstallmentPanel/` | 分期付款面板 |
| PageContainer | `components/PageContainer/` | 页面容器 |
| ActionButton | `components/ActionButton/` | 操作按钮 |
| FormInput | `components/FormInput/` | 表单输入 |

---

## 五、注意事项

1. **自适应写法**：所有尺寸使用 rem 单位（如 `p-4` = 48rpx），由 `presetRemRpx` 自动转换，不要硬编码 rpx 值
2. **设计 Token**：颜色使用 `text-primary`、`bg-muted` 等 token 类名，不要直接写 `#5EC8A8`
3. **Taro 限制**：
   - 不支持 `onclick` 内联事件，需用 `onClick={handler}`
   - 不支持 `style` 内联 CSS 变量，需用 `style={{ color: 'var(--primary)' }}`
   - 弹窗用 `<Popup>` 组件或自定义 BottomSheet
   - 浮窗内滚动需用 `<ScrollView>`
4. **数据流**：页面间通过路由参数传递 studentId/packageId，数据从 Mock/API 获取
5. **兼容性**：保持与现有页面（首页、学生详情、班级管理）的设计语言一致
6. **赠送课时**：`gift_hours` 独立于 `total_hours`，不计入收费金额，但底部按钮显示合计
7. **课包模板选择**：选模板时隐藏课包信息卡片，自定义时显示编辑模式
