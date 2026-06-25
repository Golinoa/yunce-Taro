# 第二阶段：P1 功能补全 + 硬编码消除

> 优先级：高
> 前置依赖：第一阶段完成
> 子阶段顺序：2A → 2B → 2C → 2D → 2E → 2F

---

## 2A. 教师列表硬编码消除（跨模块共性 G3）

### TASK-05: 动态获取在职教师列表

#### 问题描述

班级表单和创建弹窗中教师列表硬编码为 `TEACHER_LIST = ['王老师','李老师','张老师','赵老师']`，与教师管理模块数据不联动。不同校区教师不同，离职教师不应出现。

**当前现状：**
- `package-course/pages/classes/useClasses.ts` — `export const TEACHER_LIST = [...]`
- `package-course/pages/class-form/index.tsx` — `const TEACHER_LIST = [...]`
- `package-course/pages/classes/CreateClassSheet.tsx` — 引用 `TEACHER_LIST`

#### 实现方案

##### 步骤 1：新增教师列表 Service 方法

在 `src/services/teacher.ts` 中确保有获取在职教师列表的方法：

```typescript
/** 获取在职教师列表（用于班级表单选择器） */
async getActiveTeachers(campusId?: string): Promise<Teacher[]>
```

##### 步骤 2：删除硬编码常量

- 删除 `useClasses.ts` 中的 `export const TEACHER_LIST`
- 删除 `class-form/index.tsx` 中的 `const TEACHER_LIST`

##### 步骤 3：改为动态获取

在 `useClasses.ts` 和 `class-form/index.tsx` 中：

```typescript
const [teacherOptions, setTeacherOptions] = useState<Teacher[]>([]);

useEffect(() => {
  teacherService.getActiveTeachers().then(setTeacherOptions).catch(() => {});
}, []);

// 选择器中使用
options={teacherOptions.map(t => ({ label: t.name, value: t.id }))}
```

##### 步骤 4：CreateClassSheet 同步修改

`CreateClassSheet.tsx` 通过 props 接收教师列表，或内部自行获取。

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/teacher.ts` | 修改 | 确保 `getActiveTeachers` 方法 |
| `src/package-course/pages/classes/useClasses.ts` | 修改 | 删除 `TEACHER_LIST`，改为动态获取 |
| `src/package-course/pages/class-form/index.tsx` | 修改 | 删除 `TEACHER_LIST`，改为动态获取 |
| `src/package-course/pages/classes/CreateClassSheet.tsx` | 修改 | 引用动态教师列表 |

#### 验收标准

- [ ] 删除所有 `TEACHER_LIST` 硬编码常量
- [ ] 教师列表从 `teacherService.getActiveTeachers()` 动态获取
- [ ] 仅显示在职教师（status=active）
- [ ] 班级表单、创建弹窗、编辑弹窗均使用动态列表
- [ ] TypeScript 编译无错误

#### 依赖

无

---

## 2B. 学员管理补全

### TASK-06: 删除学员级联提示 + 软删除

#### 问题描述

删除确认弹窗只显示"确认删除该学员吗？"，未提示关联数据影响。审查报告确认方案为：软删除 + 冻结课包 + 家长解绑。

**当前现状：**
- `studentService.deleteStudent()` 直接删除
- 确认弹窗无关联数据展示

#### 实现方案

##### 步骤 1：获取学员关联数据统计

在 `studentService` 中新增方法：

```typescript
/** 获取学员关联数据统计（用于删除确认弹窗） */
async getStudentDependencies(studentId: string): Promise<{
  activePackages: number;
  frozenPackages: number;
  lessonRecords: number;
  boundParents: number;
}>
```

##### 步骤 2：修改删除确认弹窗

在学员详情页删除操作中：

```typescript
const deps = await studentService.getStudentDependencies(studentId);
const { confirm } = await Taro.showModal({
  title: '删除学员',
  content: `该学员有 ${deps.activePackages} 个进行中课包、${deps.lessonRecords} 条消课记录、${deps.boundParents} 位绑定家长，删除后课包将冻结、家长绑定将解除。确认删除？`,
  confirmColor: '#ef4444',
});
```

##### 步骤 3：实现软删除

修改 `studentService.deleteStudent()`：
- 标记学员 `status = 'deleted'`
- 冻结所有课包 `status = 'frozen'`
- 解除家长绑定关系
- 保留消课记录（不删除）

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/student.ts` | 修改 | 新增 `getStudentDependencies`，修改 `deleteStudent` 为软删除 |
| `src/data/students.ts` | 修改 | mock 实现软删除逻辑 |
| `src/package-student/pages/student-detail/index.tsx` | 修改 | 删除确认弹窗展示关联数据 |

#### 验收标准

- [ ] 删除确认弹窗展示关联数据量
- [ ] 删除后学员标记为 `deleted`
- [ ] 删除后课包冻结
- [ ] 删除后家长绑定解除
- [ ] 消课记录保留不删除

---

### TASK-07: 欠课学员充值入口

#### 问题描述

欠课学员卡片显示了欠课徽章，但无操作入口。审查报告确认：欠课=课时透支（负数），引导充值。

#### 实现方案

##### 步骤 1：学员列表欠课提示条增加"去充值"按钮

在学员列表页，欠课学员卡片底部提示条：

```tsx
<View className="flex items-center justify-between">
  <Text className="text-warning text-[24rpx]">⚠️ 课时不足，剩余 {remaining} 课时</Text>
  <View
    className="px-[16rpx] py-[8rpx] rounded-full bg-warning/10"
    onClick={() => Taro.navigateTo({
      url: `/package-course/pages/package-form/index?studentId=${student.id}`
    })}
  >
    <Text className="text-warning text-[24rpx]">去充值</Text>
  </View>
</View>
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-student/pages/students/index.tsx` | 修改 | 欠课提示条增加"去充值"按钮 |

#### 验收标准

- [ ] 欠课学员卡片显示"去充值"按钮
- [ ] 点击跳转充值页并预填学员信息
- [ ] 按钮样式使用 warning 色系

---

### TASK-08: 课包卡片续费入口

#### 问题描述

学员详情页课包 Tab 中，余额不足的课包卡片没有续费快捷入口。

#### 实现方案

在课包卡片中，当 `remaining_hours` 低于阈值时显示"续费"按钮：

```tsx
{pkg.remaining_hours <= 3 && pkg.status === 'active' && (
  <View
    className="px-[16rpx] py-[8rpx] rounded-full bg-primary/10"
    onClick={() => Taro.navigateTo({
      url: `/package-course/pages/package-form/index?studentId=${studentId}&packageId=${pkg.id}`
    })}
  >
    <Text className="text-primary text-[24rpx]">续费</Text>
  </View>
)}
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-student/pages/student-detail/index.tsx` | 修改 | 课包卡片增加续费按钮 |

#### 验收标准

- [ ] 余额 ≤3 课时的活跃课包显示"续费"按钮
- [ ] 点击跳转充值页并预填学员+课包信息
- [ ] 已冻结/已过期课包不显示续费按钮

---

### TASK-09: 科目筛选动态获取

#### 问题描述

学员列表筛选栏的科目选项硬编码，与校区设置模块不联动。

#### 实现方案

从 `subjectService` 动态获取校区科目列表，替换硬编码选项。

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-student/pages/students/index.tsx` | 修改 | 科目筛选从 `subjectService` 动态获取 |

#### 验收标准

- [ ] 科目筛选列表从 `subjectService` 动态获取
- [ ] 切换校区后科目列表更新

---

### TASK-10: 搜索方案优化（本地优先 + 后端兜底）

#### 问题描述

当前搜索为前端实时过滤，学员数 >200 时不可行。

#### 实现方案

```typescript
// 搜索策略
// 1. 本地数据 <200 条 → 即时前端过滤
// 2. 本地数据 ≥200 条 → 300ms 防抖 + 后端搜索（最少2字符）
// 3. 本地无结果 → 显示"搜索更多"按钮 → 触发后端搜索
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-student/pages/students/index.tsx` | 修改 | 搜索逻辑改为本地优先+后端兜底 |

#### 验收标准

- [ ] 本地数据 <200 时即时过滤
- [ ] 本地数据 ≥200 时 300ms 防抖后端搜索
- [ ] 本地无结果时显示"搜索更多"按钮
- [ ] 后端搜索最少 2 个字符触发

---

## 2C. 班级管理补全

### TASK-11: 调班确认弹窗

#### 问题描述

调班弹窗点击目标班级后无确认操作，直接关闭。

#### 实现方案

在 `TransferSheet.tsx` 中，点击目标班级后弹出确认：

```typescript
const { confirm } = await Taro.showModal({
  title: '确认调班',
  content: `将「${studentName}」从「${currentClassName}」调至「${targetClassName}」？`,
  confirmText: '确认调班',
});
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-course/pages/class-detail/TransferSheet.tsx` | 修改 | 增加调班确认弹窗 |

#### 验收标准

- [ ] 点击目标班级后弹出确认弹窗
- [ ] 确认后执行调班（原班级移除 + 新班级添加）
- [ ] 取消则关闭弹窗不操作

---

### TASK-12: 移除学员确认弹窗

#### 问题描述

移除学员直接执行，无确认提示。

#### 实现方案

在 `useClassDetail.ts` 的 `handleStudentLongPress` 中增加确认：

```typescript
const { confirm } = await Taro.showModal({
  title: '移除学员',
  content: `确认将「${studentName}」从班级移除？该学员的课时记录将保留。`,
  confirmColor: '#ef4444',
});
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-course/pages/class-detail/useClassDetail.ts` | 修改 | 移除学员增加确认弹窗 |

#### 验收标准

- [ ] 移除学员前弹出确认弹窗
- [ ] 确认后执行移除
- [ ] 提示课时记录将保留

---

### TASK-13: 班级关联校区

#### 问题描述

创建/编辑班级时无校区选择，班级未关联校区。

#### 实现方案

##### 步骤 1：Class 类型新增 campus_id

```typescript
export interface Class {
  // ... 现有字段
  campus_id?: string;
  campus_name?: string;
}
```

##### 步骤 2：班级表单增加校区选择

从 `useCampusStore` 获取校区列表，表单增加校区 Picker。

##### 步骤 3：班级列表按校区分组显示

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/class.ts` | 修改 | 新增 `campus_id` / `campus_name` |
| `src/package-course/pages/class-form/index.tsx` | 修改 | 增加校区选择 |
| `src/data/students.ts` | 修改 | mock 数据新增校区字段 |

#### 验收标准

- [ ] 创建/编辑班级可选择校区
- [ ] 班级数据包含 `campus_id`
- [ ] 默认选中当前主校区

---

### TASK-14: 学员选择器改用 ID 匹配

#### 问题描述

班级表单中学员选择器使用姓名匹配，同名学员会冲突。

#### 实现方案

将 `selectedStudentIds` 的比较逻辑全部改为 ID 匹配，确保 `Set<string>` 存储的是学员 ID 而非姓名。

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-course/pages/class-form/index.tsx` | 修改 | 学员选择改用 ID |
| `src/package-course/pages/classes/CreateClassSheet.tsx` | 修改 | 学员选择改用 ID |

#### 验收标准

- [ ] 学员选择器使用 ID 作为唯一标识
- [ ] 同名学员可正确区分

---

## 2D. 教师管理补全

### TASK-15: 班级计费覆盖预留

#### 问题描述

教师详情页展示了"班级计费覆盖"，但薪资计算仍用统一费率。

#### 实现方案

首期用统一费率，数据模型预留 `classRates` 字段：

```typescript
export interface SalaryModel {
  // ... 现有字段
  /** 班级差异化费率（二期实现） */
  class_rates?: ClassRateOverride[];
}
```

在教师详情页标注"统一费率模式"，差异化计费入口显示"即将推出"。

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/teacher.ts` | 修改 | 预留 `class_rates` 字段 |
| `src/components/teacher/SalaryModelSheet/index.tsx` | 修改 | 标注"统一费率" |

#### 验收标准

- [ ] `SalaryModel` 类型预留 `class_rates` 字段
- [ ] UI 标注当前为统一费率模式

---

### TASK-16: 工资模型切换历史一致性

#### 问题描述

切换工资模型后，历史数据一致性规则未实现。

#### 实现方案

在 `teacherService` 中实现规则：

```typescript
// 已发放 → 冻结，不可变
// 已确认未发放 → 可重算
// 待确认 → 按新模型计算
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/teacher.ts` | 修改 | 模型切换时按状态处理历史数据 |
| `src/data/teacher.ts` | 修改 | mock 实现状态判断逻辑 |

#### 验收标准

- [ ] 已发放月份冻结不变
- [ ] 已确认未发放月份可重算
- [ ] 待确认月份按新模型计算

---

### TASK-17: 年月选择器动态化

#### 问题描述

年月选择器初始值硬编码。

#### 实现方案

使用 `dayjs()` 动态获取当前年月：

```typescript
const [pickerYear, setPickerYear] = useState(dayjs().year());
const [pickerMonth, setPickerMonth] = useState(dayjs().month() + 1);
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/teacher/MonthPicker/index.tsx` | 修改 | 初始值改为 dayjs 动态获取 |

#### 验收标准

- [ ] 年月选择器默认当前年月
- [ ] 无硬编码日期

---

### TASK-18: 批量确认提示 + 补发金额校验

#### 问题描述

1. 批量确认薪资无提示
2. 补发/扣款金额无正数校验

#### 实现方案

1. 批量确认前弹出轻量确认："确认 X 位教师的薪资？"
2. 补发/扣款金额输入限制为正数

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-teacher/pages/teacher-list/index.tsx` | 修改 | 批量确认增加提示 |
| `src/components/teacher/DeductionSheet/index.tsx` | 修改 | 金额正数校验 |

#### 验收标准

- [ ] 批量确认前弹出确认提示
- [ ] 补发/扣款金额必须为正数
- [ ] 输入负数时提示错误

---

## 2E. 课时充值补全

### TASK-19: 课包到期提醒

#### 问题描述

充值成功后无到期提醒机制。

#### 实现方案

1. 充值成功后提示到期日
2. 创建到期提醒通知（到期前 7/3/1 天推送）

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-course/pages/package-form/usePackageForm.ts` | 修改 | 充值成功后提示到期日 |

#### 验收标准

- [ ] 充值成功 Toast 显示到期日
- [ ] 课包数据包含到期日字段

---

### TASK-20: 充值记录列表页

#### 问题描述

充值记录入口不明确，无独立页面。

#### 实现方案

新增充值记录列表页：

```
src/package-course/pages/recharge-records/
  ├── index.tsx
  └── index.config.ts
```

功能：
- 按时间倒序展示充值记录
- 每项显示：学员 + 课包 + 课时 + 金额 + 时间
- 支持按学员筛选
- 从课包列表中筛选 `created_at` 排序

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-course/pages/recharge-records/index.tsx` | 新增 | 充值记录列表页 |
| `src/package-course/pages/recharge-records/index.config.ts` | 新增 | 页面配置 |
| `src/app.config.ts` | 修改 | 注册路由 |

#### 验收标准

- [ ] 充值记录页按时间倒序展示
- [ ] 每项显示学员/课包/课时/金额/时间
- [ ] 支持按学员筛选
- [ ] 课时充值页导航栏"记录"按钮跳转此页

---

### TASK-21: 自定义课包增加科目标签

#### 问题描述

自定义课包表单没有科目选择，影响消课时课包自动匹配。

#### 实现方案

在 `usePackageForm.ts` 中，自定义课包表单增加"关联科目"选项：

```typescript
const [customSubjectId, setCustomSubjectId] = useState<string>('');
// 从 subjectService 获取科目列表
// 选项：科目列表 + "通用"
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-course/pages/package-form/usePackageForm.ts` | 修改 | 自定义课包增加科目选择 |
| `src/package-course/pages/package-form/index.tsx` | 修改 | UI 增加科目选择器 |

#### 验收标准

- [ ] 自定义课包表单有"关联科目"选项
- [ ] 科目列表从 `subjectService` 动态获取
- [ ] 支持"通用"选项

---

### TASK-22: 分期金额校验完善

#### 问题描述

分期面板手动修改某期金额后，剩余期数金额未自动调整。

#### 实现方案

在 `InstallmentPanel` 中：

```typescript
// 手动修改某期金额后
// → 自动均分剩余金额到后续期数
// → 实时显示"剩余金额"提示
const handlePeriodAmountChange = (index: number, amount: number) => {
  const newSchedule = [...schedule];
  newSchedule[index].amount = amount;
  const remaining = totalAmount - newSchedule.slice(0, index + 1).reduce((s, p) => s + p.amount, 0);
  const remainingPeriods = newSchedule.length - index - 1;
  // 均分剩余
  for (let i = index + 1; i < newSchedule.length; i++) {
    newSchedule[i].amount = Math.round(remaining / remainingPeriods * 100) / 100;
  }
  setSchedule(newSchedule);
};
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/InstallmentPanel/index.tsx` | 修改 | 分期金额自动均分 + 实时校验 |

#### 验收标准

- [ ] 手动修改某期金额后自动均分剩余
- [ ] 实时显示剩余金额
- [ ] 各期金额之和 = 总金额
- [ ] 金额不允许为负数

---

## 2F. 添加学员补全

### TASK-23: 老生模式增加"不确定"课时构成

#### 问题描述

老生录入存量课时，课时构成只有"购买/赠送"二选一，缺少"不确定"选项。

#### 实现方案

在 `useStudentForm.ts` 中，老生课时构成改为三选一：

```typescript
type HoursComposition = 'purchased' | 'bonus' | 'mixed';
// purchased → purchased_remaining = total, bonus_remaining = 0
// bonus → purchased_remaining = 0, bonus_remaining = total
// mixed → purchased_remaining = total, bonus_remaining = 0（FIFO 统一扣减）
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-student/pages/student-form/useStudentForm.ts` | 修改 | 增加课时构成三选一 |
| `src/package-student/pages/student-form/index.tsx` | 修改 | UI 增加课时构成选择 |

#### 验收标准

- [ ] 老生课时构成提供"购买/赠送/不确定"三选一
- [ ] "不确定"按混合处理
- [ ] 课包创建时正确设置 `purchased_remaining` / `bonus_remaining`

---

### TASK-24: 联系人上限改为 5 人

#### 问题描述

联系人最多只能添加 2 个，实际业务可能需要 3-5 位。

#### 实现方案

将 `contactCount >= 2` 限制改为 `contacts.length >= 5`。

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-student/pages/student-form/index.tsx` | 修改 | 联系人上限改为 5 |

#### 验收标准

- [ ] 联系人最多可添加 5 个
- [ ] 达到上限时隐藏"添加联系人"按钮

---

### TASK-25: 保存学员后引导分班

#### 问题描述

添加学员时无法直接将学员加入班级，操作路径长。

#### 实现方案

保存成功后弹出底部弹窗：

```typescript
// 保存成功后
const { confirm } = await Taro.showModal({
  title: '学员已创建',
  content: '是否立即分班？',
  confirmText: '立即分班',
  cancelText: '稍后再说',
});
if (confirm) {
  Taro.navigateTo({
    url: `/package-course/pages/class-detail/index?id=select&studentId=${newStudent.id}`
  });
}
```

#### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-student/pages/student-form/useStudentForm.ts` | 修改 | 保存成功后引导分班 |

#### 验收标准

- [ ] 新建学员成功后弹出分班引导
- [ ] 选择"立即分班"跳转班级选择
- [ ] 选择"稍后再说"返回列表
