# 薪资管理页面表单优化实施计划

## Context

当前新增课程页 `src/package-course/pages/course-form/index.tsx` 已形成稳定的表单范式：

- `Card` 卡片容器分组
- 本地 `FormRow`：左侧标签 + 右侧值/输入框的行内布局
- `FormInput variant="ghost"` 行内输入
- `PickerSheet` / `BottomSheet` 选择器
- `FormErrors` 字段级校验 + 红色错误提示
- `ScrollView` + 固定底部提交/删除按钮

薪资模块的表单页与此范式存在明显差距：模板表单页使用裸 `FormInput`，员工工资设置页由 `SalaryRuleEditor` 内部渲染保存按钮，薪资详情页编辑态使用零散 `FormInput` 拼凑，且均无统一校验。本次优化目标是将薪资相关表单收敛到 course-form 的统一范式，提升一致性、可维护性和用户体验。

## Scope

### 必须改造

1. `src/components/FormRow/index.tsx`（新增共享组件）
2. `src/package-course/pages/course-form/index.tsx`（复用共享 `FormRow`，删除本地定义）
3. `src/package-teacher/pages/salary-template-form/index.tsx`
4. `src/package-teacher/pages/salary-form/index.tsx`
5. `src/package-teacher/pages/salary-detail/index.tsx`
6. `src/components/teacher/SalaryRuleEditor/index.tsx` 及其局部文件

### 不改造

- `salary-home`：入口页无表单。
- `salary-payment`：以列表/统计为主，月份选择已使用 `MonthPickerSheet`。
- `salary-settings`：以列表为主，搜索框保持占位状态。
- `SalaryRuleEditor` 的复杂业务逻辑（阶梯计算、课程分组数据结构）保持不变。

## Implementation Strategy

### 1. 提取共享 `FormRow` 组件

将 course-form 中本地 `FormRow` 迁移到 `src/components/FormRow/index.tsx`，导出 `FormRowProps` 接口，保持现有视觉和交互：

- 左标签 + 必填星号 + `HintPopover`
- 右值/输入区，支持 `editable` 模式、`onClick` 选择模式
- 行内红色错误提示（圆点感叹号 + 文字）
- 使用 `FormInput variant="ghost"`、`Icon`、`cn`

### 2. 改造 `salary-template-form`

- 用 `Card` 包裹基本信息区。
- 使用 `FormRow` 替换裸 `FormInput`：
  - 模板名称（`required`，校验非空）
  - 简短描述
  - 设为默认模板（左侧说明，右侧 `Switch`）
- 新增 `SalaryTemplateFormErrors` 与 `validate`。
- `handleSave` 先校验，失败时提示并返回。
- `<SalaryRuleEditor showSaveButton={false} ... />`，页面底部增加固定保存按钮。
- `ScrollView` 底部加 `pb-[180rpx]`，避免被固定按钮遮挡。

### 3. 改造 `salary-form`

- 在 `SalaryRuleEditor` 上方增加模板套用展示 `Card + FormRow`：
  - 显示当前已套用模板名（未套用显示“未套用”）
  - 点击打开已有 `PickerSheet`
  - 套用后同步更新展示文案
- `<SalaryRuleEditor showSaveButton={false} ... />`，页面底部固定保存按钮。
- 页面整体包 `ScrollView`，底部加内边距。

### 4. 改造 `salary-detail`

- 薪资构成区外层改为 `Card`。
- 编辑态四项改为 `FormRow`：
  - 底薪（元）
  - 课时费（元，标签显示 `课时费 (X课时 × ¥Y)`）
  - 全勤奖（元）
  - 绩效奖金（元）
- 新增 `SalaryDetailFormErrors` 与 `validate`，校验非负数字。
- `handleSaveEdit` 先校验再保存。
- 底部“核对无误 / 确认发放”按钮保持不变。

### 5. 完整重构 `SalaryRuleEditor`

#### 5.1 Props 扩展

```ts
showSaveButton?: boolean; // 默认 true，保持兼容
```

薪资两页传 `showSaveButton={false}`，由页面固定按钮触发保存。

#### 5.2 统一使用 `FormRow`

以下字段改为 `FormRow` 行内布局：

- 固定底薪金额（`baseMode === 'fixed'`）
- 医社保开启后的公司缴交金额、个人缴交金额
- 统一课时费（`lessonFeeMode === 'unified'`）
- 按课程分类单独设置的各项补贴

#### 5.3 字段级校验

新增 `SalaryRuleEditorErrors` 类型，覆盖：

- `fixedBaseAmount?: string`
- `insurance?: { companyAmount?: string; personalAmount?: string }`
- `unifiedLessonRate?: string`
- `baseTiers?: Record<id, { perfThreshold?: string; baseAmount?: string }>`
- `commissionTiers?: Record<id, { perfThreshold?: string; rate?: string }>`
- `lessonTiers?: Record<groupType, Record<id, { threshold?: string; rate?: string }>>`
- `categoryExtraFees?: Record<id, string>`

保存前执行校验，错误通过 `FormRow`/`GradientRow` 透传展示。

#### 5.4 同文件局部组件拆分

将重复 UI 逻辑抽为同文件局部组件（不新建目录）：

- `BasisCalcTabs`：计费口径 + 计算方式选项卡
- `TierList`：底薪/提成阶梯列表
- `CourseGroupList`：按课程设置模式下的团课/私教分组
- `TierGroupCard`：按月课量阶梯模式下的分组卡片

#### 5.5 类型清理

- 移除 `onInput={(e: any) => ...}`，使用 `FormInput` 标准事件类型。
- 移除不必要的 `as any`。

### 6. 回归更新 `course-form`

- 删除本地 `FormRow` 定义。
- 改为 `import FormRow from '@/components/FormRow';`。
- 确认样式、校验、行为无回归。

## Validation

| 页面/组件 | 校验类型 | 关键规则 |
|---|---|---|
| `salary-template-form` | `SalaryTemplateFormErrors` | 模板名称非空 |
| `salary-form` | 由 `SalaryRuleEditor` 内部校验 + 模板选择有效 | 规则数值有效 |
| `salary-detail` | `SalaryDetailFormErrors` | base/lessonFee/attend/perf 非负数字 |
| `SalaryRuleEditor` | `SalaryRuleEditorErrors` | 固定底薪、医社保、统一课时费、各阶梯数值有效 |

## Verification

修改完成后依次执行：

```powershell
npm run typecheck
npm run lint
npm run format:check
Remove-Item -Recurse -Force dist
$env:VITE_USE_MOCK="true"
npm run build:weapp
```

## Critical Files

- `src/components/FormRow/index.tsx`（新增）
- `src/package-course/pages/course-form/index.tsx`
- `src/package-teacher/pages/salary-template-form/index.tsx`
- `src/package-teacher/pages/salary-form/index.tsx`
- `src/package-teacher/pages/salary-detail/index.tsx`
- `src/components/teacher/SalaryRuleEditor/index.tsx`
- `src/components/teacher/SalaryRuleEditor/GradientRow.tsx`
