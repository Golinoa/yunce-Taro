# 状态管理规范

## 一、Zustand Store 结构

```
src/stores/
├── teacher.ts    # 教师相关状态
├── student.ts    # 学员相关状态
├── class.ts      # 班级相关状态
├── home.ts       # 首页相关状态
└── index.ts      # 统一导出
```

## 二、Store 编写规范

```typescript
import { create } from 'zustand';

interface TeacherState {
  // 状态
  teachers: Teacher[];
  selectedIds: string[];
  pendingPayAction: PendingPayAction | null;

  // 操作
  setTeachers: (teachers: Teacher[]) => void;
  toggleSelect: (id: string) => void;
  confirmSalary: (id: string) => void;
  executePay: (remark: string) => void;
}

const useTeacherStore = create<TeacherState>((set, get) => ({
  // 初始状态
  teachers: [],
  selectedIds: [],
  pendingPayAction: null,

  // 操作实现
  setTeachers: (teachers) => set({ teachers }),

  toggleSelect: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter((i) => i !== id)
      : [...state.selectedIds, id],
  })),

  confirmSalary: (id) => set((state) => ({
    teachers: state.teachers.map((t) =>
      t.id === id ? { ...t, salaryStatus: 'confirmed' } : t
    ),
  })),

  executePay: (remark) => {
    const { pendingPayAction, teachers } = get();
    if (!pendingPayAction) return;
    // 业务逻辑...
    set({ pendingPayAction: null });
  }),
}));
```

## 三、状态使用规范

### 页面中读取状态

```tsx
// ✅ 选择性订阅，避免不必要的重渲染
const teachers = useTeacherStore((s) => s.teachers);
const selectedIds = useTeacherStore((s) => s.selectedIds);

// ❌ 订阅整个 store
const store = useTeacherStore();
```

### 页面中调用操作

```tsx
// ✅ 直接从 store 调用
const confirmSalary = useTeacherStore((s) => s.confirmSalary);

// ✅ 或在回调中通过 getState 获取
const handleConfirm = () => {
  useTeacherStore.getState().confirmSalary(id);
};
```

### 跨组件通信

```tsx
// ✅ 通过 store 共享状态
// A 组件设置
useTeacherStore.getState().setPendingPayAction({ type: 'batch', ids: [...] });

// B 组件读取
const pendingPayAction = useTeacherStore((s) => s.pendingPayAction);
```

## 四、数据流规范

页面/组件 → Zustand Store → Service → 真实 API → 状态更新。跨页状态沿用 Zustand；缓存 TTL、写后失效与切机构清理见统一模块指南。src/data 已删除，测试替身仅限测试文件。

## 五、禁止事项

1. **禁止组件内管理全局状态** — 全局状态必须在 Zustand Store 中管理
2. **禁止 prop drilling 超过 2 层** — 超过时提升到 Store
3. **禁止在 Store 中存储 JSX** — Store 只存数据，渲染逻辑在组件中
4. **禁止直接修改 state** — 必须通过 set() 或 action 函数
