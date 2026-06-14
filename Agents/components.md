# 组件开发规范

## 一、组件清单（开发前必查）

### 通用基础组件（`src/components/`）

| 组件 | 用途 | 关键 Props |
|------|------|-----------|
| `BottomSheet` | 底部弹窗 | `visible`, `title`, `onClose`, `maxHeight` |
| `FormInput` | 表单输入框 | `label`, `required`, `prefix`, `type`, `error` |
| `Card` | 内容卡片 | `className`, `children` |
| `CardHeader` | 卡片头部 | `title`, `subtitle`, `action` |
| `Avatar` | 头像 | `src`, `name`, `size` |
| `Icon` | 图标 | `name`, `size`, `color` |
| `ChipPicker` | 标签选择器 | `options`, `value`, `onChange`, `multiSelect` |
| `SegmentedControl` | 分段控制器 | `options`, `value`, `onChange` |
| `Stepper` | 步进器 | `value`, `min`, `max`, `onChange` |
| `StarRating` | 星级评分 | `value`, `onChange`, `readonly` |
| `Empty` | 空状态 | `title`, `description`, `action` |
| `Loading` | 加载状态 | `text` |
| `PageContainer` | 页面容器 | `title`, `loading`, `onBack` |
| `ActionButton` | 底部操作按钮 | `text`, `onClick`, `disabled`, `variant` |
| `ContactList` | 联系人列表 | `contacts`, `onSelect` |
| `CircleCheckbox` | 圆形复选框 | `checked`, `onChange` |
| `PickerItem` | 选择器项 | `label`, `value`, `selected`, `onPress` |
| `SheetInput` | 弹窗内输入框 | `label`, `value`, `onInput` |
| `InstallmentPanel` | 分期面板 | `installments`, `onChange` |

### 业务组件（`src/components/{module}/`）

| 模块 | 组件 | 用途 |
|------|------|------|
| teacher | `TeacherCard` | 教师卡片（含薪资状态标签） |
| teacher | `AddTeacherSheet` | 添加教师弹窗 |
| teacher | `EditTeacherSheet` | 编辑教师弹窗 |
| teacher | `DeductionSheet` | 扣款/补发弹窗 |
| teacher | `ConfirmSalarySheet` | 确认工资弹窗 |
| teacher | `PayConfirmSheet` | 确认发放弹窗（单人+批量） |
| teacher | `ResignSheet` | 离职确认弹窗 |
| teacher | `SalaryModelSheet` | 工资模型新建/编辑弹窗 |
| teacher | `PaymentSettingsSheet` | 发放设置弹窗 |
| teacher | `SalaryItem` | 薪资条目 |
| teacher | `FilterBar` | 筛选栏 |
| teacher | `MonthPicker` | 月份选择器 |
| home | `ChildSelector` | 孩子切换器 |
| home | `HourProgress` | 课时进度环 |
| home | `RecentRecordItem` | 最近记录项 |
| home | `ScheduleTimeline` | 排课时间线 |
| home | `StatCard` | 统计卡片 |
| home | `StudentQuickList` | 学员快捷列表 |
| lesson | `ClassSelector` | 班级选择器 |
| lesson | `StudentCard` | 学员卡片 |
| lesson | `StudentCheckinList` | 学员签到列表 |
| statistics | `BarChart` | 柱状图 |
| statistics | `ChartContainer` | 图表容器 |
| statistics | `FilterBar` | 筛选栏 |
| statistics | `KpiCard` | KPI 卡片 |
| statistics | `RankList` | 排行榜 |
| statistics | `TimeSelector` | 时间选择器 |

## 二、组件开发流程

```
1. 查清单 → 是否已有可复用组件？
   ├─ 有 → 复用，检查 Props 是否满足需求
   └─ 无 → 新建组件

2. 新建组件规范：
   ├─ 目录：src/components/{module}/ComponentName/index.tsx
   ├─ 命名：PascalCase
   ├─ 导出：export default ComponentName
   ├─ Props：export interface ComponentNameProps
   └─ JSDoc：使用场景 + 功能说明

3. 弹窗组件 → 遵循 sheets.md 规范
4. 表单组件 → 遵循 forms.md 规范
```

## 三、组件接口设计原则

1. **Props 最小化** — 只传必要数据，组件内部自行派生
2. **回调命名** — `on` 前缀：`onClose`, `onConfirm`, `onChange`, `onSubmit`
3. **布尔 Props** — 用语义化名称：`disabled` 而非 `isDisabled`，`loading` 而非 `isLoading`
4. **可选 Props** — 提供默认值，消费方无需处理 undefined
5. **children** — 需要自定义内容时用 `children`，否则用 Props 控制

## 四、组件分层

```
src/components/
├── base/          # 原子组件（未来迁移目标）：Icon, Avatar, Button
├── form/          # 表单组件：FormInput, ChipPicker, SegmentedControl
├── feedback/      # 反馈组件：BottomSheet, Toast, Empty, Loading
├── business/      # 业务组件：TeacherCard, SalaryItem, StudentPickerSheet
└── layout/        # 布局组件：PageContainer, Card, CardHeader
```

> 当前为扁平结构，新组件按模块分目录。待组件数量超过 40 个时启动分层迁移。
