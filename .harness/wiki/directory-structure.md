---
last_updated: 2026-09-12
status: active
---

# 目录结构与命名

## src/ 总览

```
src/
├── app.config.ts        # 应用配置（页面路由、TabBar、窗口、分包）
├── app.scss             # 全局样式（CSS 变量声明、keyframes）
├── app.tsx              # 应用入口
├── theme.ts             # 设计 Token 单一数据源
│
├── assets/icons/        # 图标资源（TabBar 图标等）
│
├── components/          # 组件
│   ├── ComponentName/index.tsx      # 通用基础组件
│   └── module/ComponentName/index.tsx   # 业务组件（按模块分组）
│
├── pages/page-name/
│   ├── index.tsx
│   └── index.config.ts
│
├── services/            # 接口契约层（唯一数据出口）
│   ├── index.ts         # 统一导出
│   └── teacher.ts
│
├── stores/              # Zustand
├── types/               # TypeScript 类型
├── constants/           # 业务常量（运行数据走真实 API）
├── utils/               # 工具函数（request / auth / route-guard / format）
└── styles/              # 遗留 SCSS（待迁移后删除）
```

## 分包

`package-auth` / `package-student` / `package-teacher` / `package-course` / `package-settings` / `package-statistics` / `package-lead`（以 `app.config.ts` 为准）。

主包只放 4 个主 Tab（首页 / 课表 / 数据 / 我的）+ 启动必需。

## 命名

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 页面目录 | kebab-case | `teacher-list/` |
| 页面组件 | `index.tsx` | `pages/teacher-list/index.tsx` |
| 页面配置 | `index.config.ts` | `pages/teacher-list/index.config.ts` |
| 通用 / 业务组件目录 | PascalCase | `BottomSheet/`、`TeacherCard/` |
| 组件文件 | `index.tsx` | `components/BottomSheet/index.tsx` |
| 类型 / Service / Store / 常量 / 工具文件 | kebab-case | `types/lesson-record.ts` |
| 事件处理 | `handle` 前缀 | `handleSubmit` |
| 常量 | UPPER_SNAKE_CASE | `FAB_VIEW_TOGGLE_DELAY_MS` |

## 导出

每个目录必须有 `index.ts` 聚合导出，消费方只从目录根导入：

```ts
import { teacherService } from '@/services';
import { Teacher, SalaryStatus } from '@/types';
import { useTeacherStore } from '@/stores';
```

组件：默认导出组件，具名导出 Props 接口。

```ts
const BottomSheet: React.FC<BottomSheetProps> = () => { ... };
export default BottomSheet;
export interface BottomSheetProps { ... }
```

## 依赖方向

```
types ← services ← stores ← pages / components
utils 可横向复用
```

禁止反向依赖与循环依赖。
