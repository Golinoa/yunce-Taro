# 接口定义与 Service 层规范

## 一、分层架构

```
页面/组件 → Service 层 → Mock / API
                ↑
          Store 层（状态缓存）
```

- **Service 层**：接口契约，定义业务可用的操作
- **Mock 层**（`src/data/`）：当前实现，联调时替换
- **API 层**（`src/utils/request.ts`）：联调后使用，Service 层切换即可

## 二、Service 编写规范

### 文件结构

```typescript
// src/services/teacher.ts

/**
 * Service 层 — 教师管理 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import type { TeacherUIModel, SalaryModel, Deduction } from '@/types/teacher';
import { mockGetTeachers, mockAddTeacher, ... } from '@/data/teacher';

export const teacherService = {
  /** 获取教师列表 */
  getList: () => mockGetTeachers(),
  // 联调时替换为:
  // getList: () => get<TeacherUIModel[]>('/api/teachers'),

  /** 获取教师详情 */
  getById: (id: string) => mockGetTeacherById(id),
  // 联调时替换为:
  // getById: (id: string) => get<TeacherUIModel>(`/api/teachers/${id}`),

  /** 添加教师 */
  add: (teacher: TeacherUIModel) => mockAddTeacher(teacher),
  // 联调时替换为:
  // add: (teacher: Omit<TeacherUIModel, 'id'>) => post<TeacherUIModel>('/api/teachers', teacher),
};
```

### 命名规范

| 操作 | 方法名 | 示例 |
|------|--------|------|
| 查询列表 | `getList` / `getAll` | `teacherService.getList()` |
| 查询详情 | `getById` | `teacherService.getById(id)` |
| 新增 | `add` / `create` | `teacherService.add(data)` |
| 更新 | `update` | `teacherService.update(id, data)` |
| 删除 | `remove` / `delete` | `teacherService.remove(id)` |
| 业务操作 | 动词开头 | `teacherService.confirmSalary(id)` |
| 批量操作 | `batch` 前缀 | `teacherService.batchConfirm(ids)` |

### 返回值规范

```typescript
// Service 方法返回 Promise，类型由泛型指定
export const teacherService = {
  // 返回完整类型
  getList: () => mockGetTeachers(),                    // → TeacherUIModel[]

  // 返回单个对象
  getById: (id: string) => mockGetTeacherById(id),     // → TeacherUIModel | null

  // 返回 void（操作类）
  confirmSalary: (id: string) => mockConfirmSalary(id), // → void
};
```

## 三、统一导出

```typescript
// src/services/index.ts
// 页面只从此文件导入，不直接引用 @/data/*

export { teacherService, salaryModelService, salarySettingsService, teacherScheduleService } from './teacher';
export { studentService, ... } from './student';
export { authService } from './auth';
export { homeService } from './home';
export { feedbackService } from './feedback';
```

### 导入规范

```typescript
// ✅ 从统一出口导入
import { teacherService } from '@/services';

// ❌ 直接引用内部文件
import { teacherService } from '@/services/teacher';

// ❌ 页面直接引用 mock 数据
import { mockGetTeachers } from '@/data/teacher';
```

## 四、Mock 数据规范

### 文件结构

```typescript
// src/data/teacher.ts

// 1. 常量定义
export const ROLE_OPTIONS = [...];
export const SUBJECT_OPTIONS = [...];

// 2. Mock 数据
const MOCK_TEACHERS: TeacherUIModel[] = [...];

// 3. Mock 函数（模拟异步）
export function mockGetTeachers(): TeacherUIModel[] {
  return MOCK_TEACHERS;
}

export function mockAddTeacher(teacher: TeacherUIModel): TeacherUIModel {
  MOCK_TEACHERS.push(teacher);
  return teacher;
}
```

### Mock 函数规范

1. **函数名 `mock` 前缀** — `mockGetTeachers`, `mockAddTeacher`
2. **同步返回** — 当前 mock 直接返回数据，联调时 Service 层切换为异步
3. **可变数据** — mock 函数直接操作内存数组，模拟增删改
4. **类型完整** — mock 数据必须符合对应的 TypeScript 类型

## 五、请求工具层

### `src/utils/request.ts`

已封装的请求工具：

| 函数 | 用途 |
|------|------|
| `request<T>(options)` | 核心请求函数 |
| `get<T>(url, params?)` | GET 请求 |
| `post<T>(url, data?)` | POST 请求 |
| `put<T>(url, data?)` | PUT 请求 |
| `del<T>(url, data?)` | DELETE 请求 |

### API 响应格式

```typescript
interface ApiResponse<T = unknown> {
  code: number;    // 0 或 200 表示成功
  data: T;         // 业务数据
  message: string; // 提示信息
}
```

### 联调切换

Service 层只需修改一行即可从 mock 切换到 API：

```typescript
// Mock 阶段
getList: () => mockGetTeachers(),

// 联调阶段（只改这一行）
getList: () => get<TeacherUIModel[]>('/api/teachers'),
```

## 六、错误处理

### Service 层

```typescript
// Service 层不处理 UI 提示，只抛出错误
export const teacherService = {
  confirmSalary: async (id: string) => {
    // mock 阶段直接操作
    // API 阶段由 request.ts 自动处理 401 等状态码
    return mockConfirmSalary(id);
  },
};
```

### 页面层

```typescript
// 页面层处理 UI 提示
const handleConfirm = async () => {
  try {
    await teacherService.confirmSalary(id);
    Taro.showToast({ title: '操作成功', icon: 'success' });
  } catch (err) {
    if (err instanceof ApiError) {
      Taro.showToast({ title: err.message, icon: 'none' });
    } else {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }
};
```

## 七、新增接口流程

1. `types/xxx.ts` — 定义请求/响应类型
2. `data/xxx.ts` — 编写 mock 函数
3. `services/xxx.ts` — 定义 Service 接口契约
4. `services/index.ts` — 追加导出
5. 页面/Store 中通过 `import { xxxService } from '@/services'` 使用
