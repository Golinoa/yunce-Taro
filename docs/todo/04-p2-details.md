# 第四阶段：P2 细节优化 + 体验提升

> 优先级：中
> 前置依赖：无硬性依赖，可与第五阶段并行
> **状态：已完成** ✅

---

## TASK-31: 单人消课增加"关联班级"选填项 — ⏭️ 跳过

### 跳过原因

单人消课本身就是独立消课场景，不需要关联班级。如果学员在班级里消课，应使用"班级消课"模式。需求逻辑不合理，经用户确认跳过。

---

## TASK-32: 导出工资记录 — ⏭️ 跳过

### 跳过原因

经用户确认不做，跳过。

---

## TASK-33: 课时单价与科目关联统一 — ✅ 已完成

### 实现方案

删除科目时检查 `courseCount > 0`，有关联课包时阻止删除并提示课包数量。

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/package-settings/pages/campus-settings/subjects.tsx` | `handleDelete` 增加 `courseCount > 0` 校验，阻止删除并提示 |

### 验收结果

- [x] 删除科目时检查关联课包
- [x] 有关联时阻止删除并提示
- [x] 无关联时正常删除

---

## TASK-34: 校区设置编辑回填完善 — ✅ 已完成（无需修改）

### 排查结果

逐项排查所有编辑表单，确认回填均完整：

| 页面 | 回填状态 |
|------|---------|
| 薪资模板编辑（pay-day） | ✅ `handleOpenEditModel` 正确回填 name/type/base/rate/attend/perf |
| 发薪日修改（pay-day） | ✅ `setPickerDay(payDaySettings.fixedDay)` 回填 |
| 假期管理（holidays） | ✅ 只有新增/删除，无编辑（设计如此） |
| 通知设置（notify） | ✅ 只有开关切换，无编辑表单 |
| 校区编辑（sub-campus） | ✅ `handleOpenEdit` 正确回填所有字段 |
| 运营数据（campus-data） | ✅ 纯展示页，无编辑 |

---

## TASK-35: 假期管理简化 — ✅ 已完成

### 实现方案

按用户要求：校长自主管理假期，不预置任何法定节假日，只提供新增/删除功能。

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/types/campus.ts` | 移除 `HolidayType` 类型和 `type` 字段 |
| `src/types/index.ts` | 移除 `HolidayType` 导出 |
| `src/data/campus.ts` | 删除法定节假日预置数据（h1-h7），保留自定义假期（h8-h10），移除 `type` 字段 |
| `src/package-settings/pages/campus-settings/holidays.tsx` | 移除 `type: 'custom'` 传入，更新注释 |

### 验收结果

- [x] 移除法定/自定义区分
- [x] 不预置任何法定节假日
- [x] 只保留新增/删除功能

---

## TASK-36: 全局表单校验排查 — ✅ 已完成

### 补全校验明细

| 模块 | 新增校验 | 修改文件 |
|------|---------|---------|
| 学员表单 | `feeAmount` 金额非负校验 | `useStudentForm.ts` |
| 课包表单 | `effectiveFeeAmount` 金额非负、`customPrice` 价格非负、`customValidDays` 有效天数非负 | `usePackageForm.ts` |
| 消课表单 | `hoursUsed > 0`（单人+班级模式均校验） | `lesson-form/index.tsx` |
| 班级表单 | `startTime < endTime`、课时制 `startDate ≤ endDate` | `class-form/index.tsx` |

### 额外清理

- 移除 `lesson-form` 中未使用的 `relatedClassId` 状态（TASK-31 残留）

### 验收结果

- [x] 所有表单必填字段有校验
- [x] 手机号格式校验（已有）
- [x] 金额/课时正数校验（新增）
- [x] 时间段/日期范围校验（新增）
- [x] 校验失败时提示具体字段
- [x] `tsc --noEmit` 零错误通过
