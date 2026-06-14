# TypeScript 规范

## 一、类型定义规范

### Props 接口

```typescript
// 每个 Sheet 组件必须导出 Props 接口
export interface PayConfirmSheetProps {
  visible: boolean;
  /** 批量发放时传入 action，单人发放时传 teacherName + amount */
  action?: PendingPayAction | null;
  teacherName?: string;
  amount?: number;
  onConfirm: (remark: string) => void;
  onClose: () => void;
}
```

### 业务类型

```typescript
// src/types/teacher.ts

/** 教师状态 */
export type TeacherStatus = 'active' | 'resigned';

/** 薪资状态 — 严格单向流转：pending → confirmed → paid */
export type SalaryStatus = 'pending' | 'confirmed' | 'paid';

/** 离职类型 */
export type ResignType = 'quit' | 'expire' | 'dismiss';

/** 待发放操作 */
export interface PendingPayAction {
  type: 'single' | 'batch';
  ids: string[];
}

/** 教师信息 */
export interface Teacher {
  id: string;
  name: string;
  phone: string;
  subjects: string[];
  campus: string;
  status: TeacherStatus;
  salaryStatus: SalaryStatus;
  // ...
}
```

## 二、命名规范

| 类型 | 命名 | 示例 |
|------|------|------|
| Props 接口 | PascalCase + Props | `TeacherCardProps`, `PayConfirmSheetProps` |
| 业务类型 | PascalCase + Type | `ResignType`, `SalaryStatus` |
| 业务接口 | PascalCase | `Teacher`, `PendingPayAction` |
| 枚举 | PascalCase | `TeacherStatus`（优先用 union type） |
| 泛型 | 单大写字母或语义名 | `T`, `TValue`, `TItem` |

## 三、禁止事项

```typescript
// ❌ 隐式 any
function handleAction(action) { }

// ❌ @ts-ignore
// @ts-ignore
someUnsafeCall();

// ❌ as any
const result = data as any;

// ❌ 未导出 Props 接口
interface Props { ... }  // 其他文件无法引用
const Component: React.FC<Props> = () => { ... };

// ❌ 运行时类型检查用 TypeScript 类型
if (typeof teacher.status === 'active') { }  // TS 类型不存在运行时
```

## 四、正确做法

```typescript
// ✅ 显式类型注解
function handleAction(action: 'confirm' | 'pay') { }

// ✅ 类型守卫
function isTeacher(obj: unknown): obj is Teacher {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}

// ✅ 导出 Props
export interface TeacherCardProps {
  teacher: Teacher;
  onSelect: (id: string) => void;
}

// ✅ union type 替代枚举
type SalaryStatus = 'pending' | 'confirmed' | 'paid';

// ✅ 常量映射表（运行时可用）
const SALARY_STATUS_LABEL: Record<SalaryStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  paid: '已发放',
};
```

## 五、类型文件组织

```
src/types/
├── teacher.ts    # 教师相关类型
├── student.ts    # 学员相关类型
├── class.ts      # 班级相关类型
├── common.ts     # 通用类型（分页、API 响应等）
└── index.ts      # 统一导出
```
