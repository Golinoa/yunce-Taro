# 项目目录与文件规范

## 一、目录结构总览

```
src/
├── app.config.ts        # 应用配置（页面路由、TabBar、窗口）
├── app.scss             # 全局样式（CSS 变量声明、keyframes）
├── app.tsx              # 应用入口
├── theme.ts             # 设计 Token 单一数据源（颜色/间距/圆角/字号/阴影）
│
├── assets/              # 静态资源
│   └── icons/           # 图标资源（TabBar 图标等）
│
├── components/          # 组件
│   ├── ComponentName/   # 通用基础组件
│   │   └── index.tsx
│   └── module/          # 业务组件（按模块分组）
│       └── ComponentName/
│           └── index.tsx
│
├── pages/               # 页面
│   └── page-name/
│       ├── index.tsx          # 页面组件
│       └── index.config.ts    # 页面配置（definePageConfig）
│
├── services/            # Service 层（接口契约，当前 mock，联调时替换）
│   ├── index.ts         # 统一导出（页面只从此文件导入）
│   ├── auth.ts
│   ├── teacher.ts
│   └── ...
│
├── stores/              # Zustand Store
│   ├── index.ts         # 统一导出
│   ├── teacher.ts
│   └── ...
│
├── types/               # TypeScript 类型定义
│   ├── index.ts         # 统一导出
│   ├── teacher.ts
│   └── ...
│
├── data/                # Mock 数据与常量
│   ├── index.ts         # 统一导出
│   ├── teacher.ts       # mock 函数 + 业务常量
│   └── ...
│
├── utils/               # 工具函数
│   ├── index.ts         # 统一导出
│   ├── request.ts       # 请求封装（Taro.request + 拦截器）
│   ├── auth.tsx         # 认证 Hook + Provider
│   ├── route-guard.tsx  # 路由守卫 HOC
│   ├── format.ts        # 格式化工具
│   └── ...
│
└── styles/              # 遗留 SCSS（待迁移为 UnoCSS 后删除）
    ├── compat.scss
    ├── theme.scss
    └── variables.scss
```

## 二、文件命名规范

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 页面目录 | kebab-case | `teacher-list/`, `student-detail/` |
| 页面组件 | `index.tsx` | `pages/teacher-list/index.tsx` |
| 页面配置 | `index.config.ts` | `pages/teacher-list/index.config.ts` |
| 通用组件目录 | PascalCase | `BottomSheet/`, `FormInput/` |
| 业务组件目录 | PascalCase | `TeacherCard/`, `AddTeacherSheet/` |
| 组件文件 | `index.tsx` | `components/BottomSheet/index.tsx` |
| 类型文件 | kebab-case | `types/teacher.ts`, `types/lesson-record.ts` |
| Service 文件 | kebab-case | `services/teacher.ts` |
| Store 文件 | kebab-case | `stores/teacher.ts` |
| Mock 数据文件 | kebab-case | `data/teacher.ts` |
| 工具函数文件 | kebab-case | `utils/format.ts` |

## 三、导出规范

### 统一导出文件

每个目录必须有 `index.ts` 统一导出，消费方只从目录根导入：

```typescript
// ✅ 从统一出口导入
import { teacherService } from '@/services';
import { Teacher, SalaryStatus } from '@/types';
import { useTeacherStore } from '@/stores';

// ❌ 直接引用内部文件
import { teacherService } from '@/services/teacher';
import { Teacher } from '@/types/teacher';
```

### 组件导出

```typescript
// 组件文件：export default
const BottomSheet: React.FC<BottomSheetProps> = () => { ... };
export default BottomSheet;

// Props 接口：export（具名导出，供外部引用类型）
export interface BottomSheetProps { ... }
```

## 四、新增页面流程

1. 在 `src/pages/page-name/` 创建目录
2. 创建 `index.tsx` 页面组件
3. 创建 `index.config.ts` 页面配置
4. 在 `app.config.ts` 的 `pages` 数组中注册路由
5. 如需 TabBar，在 `app.config.ts` 的 `tabBar.list` 中添加

### 页面配置模板

```typescript
export default definePageConfig({
  navigationBarTitleText: '页面标题',
  navigationBarBackgroundColor: '#5EC8A8',  // 或 '#FAFDFB'
  navigationBarTextStyle: 'white',          // 或 'black'
});
```

### 页面组件模板

```tsx
import React from 'react';
import { View } from '@tarojs/components';
import { useLoad, useDidShow } from '@tarojs/taro';
import PageContainer from '@/components/PageContainer';

const PageName: React.FC = () => {
  useLoad(() => {
    // 页面加载时初始化
  });

  useDidShow(() => {
    // 页面显示时刷新数据
  });

  return (
    <PageContainer title="页面标题">
      <View className="p-4">
        {/* 内容 */}
      </View>
    </PageContainer>
  );
};

export default PageName;
```

## 五、新增模块流程

新增一个业务模块（如"课程管理"）时：

1. `types/course.ts` — 定义类型
2. `data/course.ts` — Mock 数据 + 常量
3. `services/course.ts` — Service 层（接口契约）
4. `stores/course.ts` — Zustand Store
5. `components/course/` — 业务组件
6. `pages/course-list/` + `pages/course-detail/` — 页面
7. 各目录 `index.ts` 统一导出中追加
8. `app.config.ts` 注册路由

## 六、禁止事项

1. **禁止页面内硬编码 mock 数据** — mock 数据放 `src/data/`
2. **禁止页面直接引用 `@/data/`** — 通过 `@/services` 间接引用
3. **禁止在 `src/styles/` 新增 SCSS 文件** — 使用 UnoCSS，遗留文件待迁移
4. **禁止在组件目录外创建 `.tsx` 文件** — 页面放 `pages/`，组件放 `components/`
5. **禁止循环依赖** — types ← data ← services ← stores ← pages/components
