---
last_updated: 2026-09-12
status: active
---

# R50 状态管理与 TypeScript

## Zustand

❌ 订阅整个 store，导致任意字段变化都重渲染

```tsx
const store = useTeacherStore();
```

✅ FIX: 选择性订阅字段。

```tsx
const teachers = useTeacherStore((s) => s.teachers);
const confirmSalary = useTeacherStore((s) => s.confirmSalary);
```

---

❌ 直接修改 state / 在回调里绕过 action

✅ FIX: 一律通过 `set()` 或 action 函数；需要读当前值用 `get()`。

---

❌ Store 里存 JSX

✅ FIX: Store 只存数据，渲染逻辑留在组件。

## TypeScript

❌ 隐式 any / `@ts-ignore` / `as any`

```tsx
function handleAction(action) {}
```

✅ FIX: 显式类型注解或 union type。

```tsx
function handleAction(action: 'confirm' | 'pay') {}
```

---

❌ 用 TypeScript 类型做运行时判断

```tsx
if (typeof teacher.status === 'active') {}  // TS 类型不存在于运行时
```

✅ FIX: 用类型守卫或常量映射表。

```tsx
const SALARY_STATUS_LABEL: Record<SalaryStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  paid: '已发放',
};
```

---

❌ Props 接口不导出

```tsx
interface Props { ... }
```

✅ FIX: `export interface TeacherCardProps { ... }`

## 其他

- 优先 union type 而非 enum：`type SalaryStatus = 'pending' | 'confirmed' | 'paid'`
- 未使用的变量 / import 必须清理（`noUnusedLocals` 已开启）
- 小程序 `CommonEventFunction` 类型报错来自 `@tarojs/components`，过滤 node_modules 后看项目自身错误：

```bash
npx tsc --noEmit 2>&1 | findstr "error TS" | findstr /V "node_modules"
```

## 类型命名

| 类型 | 命名 | 示例 |
| --- | --- | --- |
| Props 接口 | `PascalCase` + `Props` | `TeacherCardProps`、`PayConfirmSheetProps` |
| 业务类型 | `PascalCase` + `Type` | `ResignType`、`SalaryStatus` |
| 业务接口 | `PascalCase` | `Teacher`、`PendingPayAction` |
| 枚举 | `PascalCase`（优先 union type） | `TeacherStatus` |
| 泛型 | 单大写字母或语义名 | `T`、`TValue`、`TItem` |
