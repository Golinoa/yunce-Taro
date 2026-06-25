# 第一阶段：P0 核心数据流打通

> 优先级：最高
> 前置依赖：无
> 预计任务数：4

---

## TASK-01: 课包拆分购买/赠送课时 + FIFO 扣减

### 问题描述

当前 `CoursePackage` 类型只有统一的 `remaining_hours`，消课扣减时无法区分购买课时和赠送课时。审查报告确认方案为 **FIFO 先进先出**：先扣购买课时，再扣赠送课时。

**当前现状：**
- `CoursePackage.remaining_hours: number` — 统一剩余课时
- `packageService.deductHours()` — 统一扣减，不区分来源
- 消课日志未记录扣减来源（purchased/bonus）

### 实现方案

#### 步骤 1：扩展 CoursePackage 类型

在 `src/types/course-package.ts` 中新增字段：

```typescript
export interface CoursePackage {
  // ... 现有字段保留
  /** 购买课时剩余 */
  purchased_remaining: number;
  /** 赠送课时剩余 */
  bonus_remaining: number;
  /** 总剩余课时（计算属性：purchased_remaining + bonus_remaining） */
  remaining_hours: number; // 保留，由前两者计算得出
}
```

#### 步骤 2：更新 mock 数据

在 `src/data/students.ts` 中，所有课包数据新增 `purchased_remaining` 和 `bonus_remaining` 字段。规则：
- 旧课包无拆分信息 → `purchased_remaining = remaining_hours`, `bonus_remaining = 0`
- 新充值课包 → 按模板比例拆分（如买10赠2 → purchased=10, bonus=2）
- 老生导入课包 → `purchased_remaining = remaining_hours`, `bonus_remaining = 0`

#### 步骤 3：实现 FIFO 扣减逻辑

在 `src/data/students.ts` 中修改 `mockDeductPackageHours`：

```typescript
function mockDeductPackageHours(
  packageId: string,
  hours: number
): CoursePackage | null {
  const pkg = findPackageById(packageId);
  if (!pkg) return null;

  let remaining = hours;
  let purchasedDeduct = 0;
  let bonusDeduct = 0;

  // FIFO：先扣购买课时
  if (remaining > 0 && pkg.purchased_remaining > 0) {
    const deduct = Math.min(remaining, pkg.purchased_remaining);
    pkg.purchased_remaining -= deduct;
    purchasedDeduct = deduct;
    remaining -= deduct;
  }

  // 再扣赠送课时
  if (remaining > 0 && pkg.bonus_remaining > 0) {
    const deduct = Math.min(remaining, pkg.bonus_remaining);
    pkg.bonus_remaining -= deduct;
    bonusDeduct = deduct;
    remaining -= deduct;
  }

  // 更新总剩余
  pkg.remaining_hours = pkg.purchased_remaining + pkg.bonus_remaining;

  return pkg;
}
```

#### 步骤 4：消课日志记录扣减来源

在 `LessonRecord` 类型中新增字段（`src/types/lesson-record.ts`）：

```typescript
export interface LessonRecord {
  // ... 现有字段保留
  /** 购买课时扣减量 */
  purchased_deduct?: number;
  /** 赠送课时扣减量 */
  bonus_deduct?: number;
}
```

消课提交时记录 `purchased_deduct` 和 `bonus_deduct`。

#### 步骤 5：充值时按模板比例拆分

修改 `mockCreateRecharge`，创建课包时按模板拆分购买/赠送：

```typescript
// 如模板为"买10赠2"，total_hours=12
// → purchased_remaining = 10, bonus_remaining = 2
const purchasedHours = template?.purchased_hours ?? totalHours;
const bonusHours = template?.gift_hours ?? giftHours ?? 0;
```

#### 步骤 6：更新 `pickBestPackage` 匹配逻辑

在 `src/utils/package-helper.ts` 中，课包匹配时按到期日升序排列（最早到期先扣），匹配 FIFO 顺序。

### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/course-package.ts` | 修改 | 新增 `purchased_remaining` / `bonus_remaining` 字段 |
| `src/types/lesson-record.ts` | 修改 | 新增 `purchased_deduct` / `bonus_deduct` 字段 |
| `src/data/students.ts` | 修改 | mock 数据新增字段 + FIFO 扣减逻辑 + 充值拆分 |
| `src/services/student.ts` | 修改 | `deductHours` 接口返回拆分信息 |
| `src/utils/package-helper.ts` | 修改 | 匹配排序按到期日升序 |
| `src/package-course/pages/lesson-form/index.tsx` | 修改 | 提交时记录扣减来源 |

### 验收标准

- [ ] `CoursePackage` 包含 `purchased_remaining` 和 `bonus_remaining` 字段
- [ ] 消课扣减遵循 FIFO：先购买后赠送
- [ ] 消课日志记录 `purchased_deduct` 和 `bonus_deduct`
- [ ] 充值创建课包时按模板比例拆分购买/赠送
- [ ] 旧课包数据兼容（`bonus_remaining=0`）
- [ ] `remaining_hours` 始终等于 `purchased_remaining + bonus_remaining`
- [ ] TypeScript 编译无错误

### 依赖

无前置任务

---

## TASK-02: 班级消课预览 Sheet

### 问题描述

班级消课模式下，每位学员可能匹配不同课包（科目不同/余额不同），当前直接逐学员循环提交，无预览确认。审查报告确认方案为：确认前展示预览弹窗，每位学员显示课包匹配结果和扣减预览，课时不足学员标记 ⚠️。

**当前现状：**
- `handleClassSubmit` 直接循环提交，无预览步骤
- 课时不足学员直接加入 `failList`，无跳过选项

### 实现方案

#### 步骤 1：新增 `LessonPreviewSheet` 组件

创建 `src/components/lesson/LessonPreviewSheet/index.tsx`：

```typescript
interface PreviewItem {
  studentId: string;
  studentName: string;
  packageName: string;
  deductHours: number;
  purchasedBefore: number;
  bonusBefore: number;
  purchasedAfter: number;
  bonusAfter: number;
  remainingAfter: number;
  status: 'ok' | 'warning' | 'error';
  warningText?: string;
  skipped: boolean;
}

interface LessonPreviewSheetProps {
  visible: boolean;
  items: PreviewItem[];
  onConfirm: (skippedIds: string[]) => void;
  onClose: () => void;
}
```

UI 设计：
- 每位学员一行，显示：姓名 + 课包名 + 扣减预览
- ✅ 正常学员：绿色图标 + "钢琴课包 扣1课时(剩17)"
- ⚠️ 课时不足学员：黄色图标 + "课时不足！剩余0课时" + [跳过] 按钮
- ❌ 无课包学员：红色图标 + "无可用课包" + 自动跳过
- 底部：[取消] [确认消课(N人)]

#### 步骤 2：修改消课提交流程

在 `src/package-course/pages/lesson-form/index.tsx` 中：

1. `handleClassSubmit` 改为先收集预览数据，展示 `LessonPreviewSheet`
2. 用户在 Sheet 中可跳过特定学员
3. 确认后只对未跳过学员执行消课

```typescript
// 修改后的流程：
handleClassSubmit
  → 收集每位签到学员的课包匹配结果
  → 生成 PreviewItem[]
  → setShowPreviewSheet(true)
  → 用户确认
  → handleConfirmPreview(skippedIds)
    → 过滤掉跳过学员
    → 逐学员执行消课（复用现有逻辑）
```

### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/lesson/LessonPreviewSheet/index.tsx` | 新增 | 消课预览弹窗组件 |
| `src/package-course/pages/lesson-form/index.tsx` | 修改 | 班级消课增加预览步骤 |

### 验收标准

- [ ] 班级消课点击"确认消课"后先展示预览 Sheet
- [ ] 预览 Sheet 展示每位学员的课包匹配 + 扣减预览
- [ ] 课时不足学员标记 ⚠️，可点击"跳过"
- [ ] 无课包学员自动跳过
- [ ] 确认后只对未跳过学员执行消课
- [ ] 汇总结果提示：X人成功，Y人跳过
- [ ] 组件使用 BottomSheet 基础组件

### 依赖

- TASK-01（课包拆分购买/赠送，预览需展示拆分后的扣减明细）

---

## TASK-03: 消课撤销功能

### 问题描述

消课是敏感操作，一旦确认无法撤销。误操作（选错学员、填错课时）无法补救。审查报告确认方案为分角色限时撤销。

**当前现状：**
- 消课记录详情页（`lesson-detail/index.tsx`）无撤销入口
- `lessonRecordService` 无撤销方法
- 无撤销时限校验

### 实现方案

#### 步骤 1：扩展 LessonRecord 类型

在 `src/types/lesson-record.ts` 中新增：

```typescript
export interface LessonRecord {
  // ... 现有字段保留
  /** 撤销状态 */
  revoke_status?: 'none' | 'revoked';
  /** 撤销时间 */
  revoked_at?: string;
  /** 撤销人 */
  revoked_by?: string;
  /** 撤销原因 */
  revoke_reason?: string;
}
```

#### 步骤 2：实现撤销 Service 方法

在 `src/services/student.ts` 中新增：

```typescript
/** 撤销消课记录 */
async revokeLessonRecord(
  recordId: string,
  operatorId: string,
  reason: string
): Promise<LessonRecord | null>
```

撤销逻辑：
1. 校验记录是否可撤销（状态为 none + 时限内）
2. 恢复课包余额（`purchased_remaining` / `bonus_remaining` 按扣减量回加）
3. 标记记录为 `revoked`
4. 记录撤销人和原因

#### 步骤 3：实现撤销时限校验

```typescript
function canRevoke(record: LessonRecord, role: UserRole): boolean {
  if (record.revoke_status === 'revoked') return false;
  const created = new Date(record.lesson_date);
  const now = new Date();
  const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  if (role === 'teacher') return hoursDiff <= 24;
  if (role === 'principal') return hoursDiff <= 24 * 7;
  return false;
}
```

#### 步骤 4：消课详情页增加撤销入口

在 `src/package-course/pages/lesson-detail/index.tsx` 中：
- 记录状态为 `none` 且在时限内 → 显示"撤销消课"按钮
- 点击后弹出确认 Sheet（需填写撤销原因）
- 确认后调用 `revokeLessonRecord`
- 撤销成功后刷新页面

#### 步骤 5：消课记录列表标识

在消课记录列表中，已撤销记录显示"已撤销"标签，灰色样式。

### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/lesson-record.ts` | 修改 | 新增撤销相关字段 |
| `src/data/students.ts` | 修改 | 新增 `mockRevokeLessonRecord` |
| `src/services/student.ts` | 修改 | 新增 `revokeLessonRecord` 方法 |
| `src/package-course/pages/lesson-detail/index.tsx` | 修改 | 增加撤销入口和确认 Sheet |

### 验收标准

- [ ] 消课详情页显示"撤销消课"按钮（时限内）
- [ ] 教师 24h 内可撤销，校长 7 天内可撤销
- [ ] 撤销需填写原因
- [ ] 撤销后恢复课包余额（购买/赠送分别回加）
- [ ] 撤销后记录标记为"已撤销"
- [ ] 超出时限显示提示："已超过撤销时限"
- [ ] 已撤销记录在列表中显示"已撤销"标签

### 依赖

- TASK-01（撤销需按 `purchased_deduct` / `bonus_deduct` 分别回加余额）

---

## TASK-04: 跨科目消课标记

### 问题描述

单人消课时，如果班级科目与课包科目不匹配，当前仅提示"已自动发起课包科目变更申请"，但无实际处理。审查报告确认方案为**审计模式**：消课正常进行但标记为"跨科目"，推送通知给校长，不做审批阻断。

**当前现状：**
- `pickBestPackage` 优先匹配同学科目课包
- 跨科目时匹配到非同学科目课包，无特殊标记
- 无通知推送

### 实现方案

#### 步骤 1：扩展 LessonRecord 类型

在 `src/types/lesson-record.ts` 中新增：

```typescript
export interface LessonRecord {
  // ... 现有字段保留
  /** 是否跨科目消课 */
  is_cross_subject?: boolean;
  /** 课包科目 */
  package_subject?: string;
  /** 班级科目 */
  class_subject?: string;
}
```

#### 步骤 2：消课提交时检测跨科目

在 `src/package-course/pages/lesson-form/index.tsx` 的 `handleSingleSubmit` 中：

```typescript
// 匹配课包后检查科目
const isCrossSubject = matchedSubject && classSubject
  && matchedSubject.id !== classSubject.id;

if (isCrossSubject) {
  // 标记跨科目
  recordData.is_cross_subject = true;
  recordData.package_subject = matchedSubject.name;
  recordData.class_subject = classSubject.name;

  // 推送通知给校长
  await notificationService.send({
    sender_id: profile?.id || '',
    receiver_id: principalId, // 机构校长 ID
    title: `跨科目消课提醒`,
    content: `${student.name} 在「${classSubject.name}」班级使用了「${matchedSubject.name}」课包消课 ${hoursUsed} 课时`,
    related_id: selectedStudent.id,
  });
}
```

#### 步骤 3：消课详情页展示跨科目标记

在消课记录详情中，跨科目记录显示提示条："本次消课为跨科目消课（班级：钢琴，课包：通用）"。

#### 步骤 4：消课表单提示

匹配到跨科目课包时，在课包选择区域显示黄色提示："该课包科目与班级不一致，消课将标记为跨科目"。

### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/lesson-record.ts` | 修改 | 新增跨科目相关字段 |
| `src/package-course/pages/lesson-form/index.tsx` | 修改 | 检测跨科目 + 标记 + 通知 |
| `src/package-course/pages/lesson-detail/index.tsx` | 修改 | 展示跨科目标记 |

### 验收标准

- [ ] 跨科目消课自动标记 `is_cross_subject = true`
- [ ] 跨科目消课推送通知给校长
- [ ] 消课详情页展示跨科目提示条
- [ ] 消课表单匹配跨科目课包时显示黄色提示
- [ ] 跨科目消课正常扣减，不阻断流程

### 依赖

- TASK-01（课包科目匹配依赖 `CoursePackage` 的科目关联）
