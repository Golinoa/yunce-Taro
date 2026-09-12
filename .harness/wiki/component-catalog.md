---
last_updated: 2026-09-12
status: active
---

# 组件清单与 Props

> 写任何 UI 前**先查这里**，能复用就不新写。完整目录见 `src/components/`。
> 组件结构铁律见 `rules/20-components.md`，弹窗 / 表单见 `rules/30-sheets-and-forms.md`。

## 必查强制组件（不得绕过）

| 组件 | 替代禁止对象 | 说明 |
| --- | --- | --- |
| `FormInput` | 裸 `<Input>` | 所有输入框必须用它包裹（含聚焦、适配、占位规范） |
| `BottomSheet` | 页面内联蒙层 | 底部弹层容器，**只传 `visible` 单 prop** |
| `Dialog` / `ConfirmDialog` | 自己写确认框 | 居中弹窗 / 二次确认 |
| `Card` / `CardHeader` | 自己拼卡片容器 | 统一卡片样式 |
| `Empty` | 手写空态 | 列表空数据占位 |
| `Loading` | 手写 loading | 加载态 |

## 通用基础组件（常用）

| 组件 | 用途 | 关键 Props |
| --- | --- | --- |
| `BottomSheet` | 底部弹窗 | `visible`, `title`, `onClose`, `maxHeight` |
| `FormInput` | 表单输入框 | `label`, `required`, `prefix`, `type`, `error` |
| `Card` / `CardHeader` | 内容卡片 | `className`, `children` / `title`, `subtitle`, `action` |
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
| `SwappableCard` | 可左滑卡片 | 见 [swappable-schedule-card.md](swappable-schedule-card.md) |

> 其余：`Switch`、`InlineDropdown`、`InlineSelector`、`ImageUploader`/`ImageUploaderList`、`TodoCard`、`TodoQuadrantIcon`、`ErrorBoundary`、`HintPopover`、`QuestionHint`、`TooltipSheet`、`AccentBarCard`。

## 业务组件（按模块在 `components/` 下分目录）

`booking / business / campus / class / course / data-center / home / lead / lesson / member-card / my-todos / package / profile / proxy-booking / reschedule / schedule / statistics / student / subscribe / teacher`

常见业务组件：`RoleCard`、`RoleSwitchSheet`、`RegisterStepper`、`MockIdentitySwitcher`（仅开发）、`ContactList`、`StudentMultiSelectSheet`。

## 业务组件清单（模块明细）

| 模块 | 组件 | 用途 |
| --- | --- | --- |
| schedule | `SwappableScheduleCard` | 可左滑露出操作按钮的卡片容器（排课 / 约课列表） |
| teacher | `TeacherCard` | 教师卡片（含薪资状态标签） |
| teacher | `AddTeacherSheet` / `EditTeacherSheet` | 添加 / 编辑教师弹窗 |
| teacher | `DeductionSheet` | 扣款 / 补发弹窗 |
| teacher | `ConfirmSalarySheet` | 确认工资弹窗 |
| teacher | `PayConfirmSheet` | 确认发放弹窗（单人 + 批量） |
| teacher | `ResignSheet` | 离职确认弹窗 |
| teacher | `SalaryModelSheet` | 工资模型新建 / 编辑弹窗 |
| teacher | `PaymentSettingsSheet` | 发放设置弹窗 |
| teacher | `SalaryItem` / `FilterBar` / `MonthPicker` | 薪资条目 / 筛选栏 / 月份选择器 |
| home | `ChildSelector` / `HourProgress` / `RecentRecordItem` / `ScheduleTimeline` / `StatCard` / `StudentQuickList` | 首页业务组件 |
| lesson | `ClassSelector` / `StudentCard` / `StudentCheckinList` | 班级 / 学员签到相关 |
| statistics | `BarChart` / `ChartContainer` / `FilterBar` / `KpiCard` / `RankList` / `TimeSelector` | 图表与统计 |

> 注意：teacher 模块 8 个 Sheet 均遵循 `rules/30-sheets-and-forms.md` 模板。统计图表相关走 ECharts 小程序兼容方案（动态值可用内联 style，见 `rules/10-styling.md`）。

## 弹窗 / 表单类 Sheet（独立组件，封装在 `components/` 下）

- 弹窗类：`AccountLoginSheet`、`BindEmailSheet`、`BindOrgSheet`、`AgreementSheet`、`PageIntroSheet`、`LoginIssueSheet`、`RelationConfirmSheet`、`TooltipSheet`
- 选择器类：`PickerSheet`、`DatePickerSheet`、`TimePickerSheet`、`TimeRangePicker`、`MonthPickerSheet`（teacher/）、`ChipPicker`
- 表单类：`SheetInput`、`FormCell`、`FormRow`、`FormInput`、`ImageUploaderList`、`EvaluateSheet`

> 注意：`PickerView` 类滚轮组件有 `indicatorStyle` px 铁律，见 `rules/90-scroll-interaction.md`。
