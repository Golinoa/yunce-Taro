---
last_updated: 2026-09-12
status: active
source: 历史重构沉淀 + 多次 Code Review
---

# R00 技术栈与依赖方向（硬性）

## 锁定表（禁止擅自替换）

| 项 | 必须用 | 禁止 |
| --- | --- | --- |
| 框架 | Taro 4.x + React 18 **函数组件 + Hooks** | 类组件、Vue、擅自升 / 降大版本 |
| 语言 | TypeScript 严格模式 | 隐式 any、`@ts-ignore`、滥用 `as any` |
| 样式 | UnoCSS 原子类 + `rpx` + 设计 Token | 新增 SCSS、非动态内联 style、`px`/`rem` |
| 状态 | Zustand | Redux / MobX / 用页面 `useState` 管跨页全局态 |
| 日期 | dayjs | moment、硬编码月 / 年文案 |
| 类名 | `classnames`（`cn`） | 模板字符串拼 `className` |
| 图标 | `<Icon name="mdi-xxx" />` | 内联 SVG、随手用 `<Image>` 当图标 |
| 路径别名 | `@/` | 深层相对路径 `../../..` |

## 依赖方向（禁止反向 / 循环）

```
types ← services ← stores ← pages/components
              utils 可横向复用
```

❌ 反向依赖或循环依赖（如 `services` 反向 import `pages`）

✅ FIX: 类型下沉到 `src/types/`，共享逻辑下沉到 `src/utils/`；页面之间不互相 import。

📖 See: ../wiki/directory-structure.md

## 导出约定

❌ `import { teacherService } from '@/services/teacher'`

✅ FIX: `import { teacherService } from '@/services'`——每一层都必须从 `index.ts` 聚合出口导入，消费方不得穿透到内部文件。

📖 See: ../wiki/directory-structure.md

## 命名约定

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 页面目录 | kebab-case | `teacher-list/` |
| 组件目录 | PascalCase + `index.tsx` | `BottomSheet/index.tsx` |
| 事件处理 | `handle` 前缀 | `handleSubmit`、`handleClose` |
| 常量 | `UPPER_SNAKE_CASE`，提到文件顶部或 `src/constants/` | `FAB_VIEW_TOGGLE_DELAY_MS` |
| Mock 函数 | `mock` 前缀（仅测试文件） | `mockTeacherList()` |
| 类型文件 | kebab-case | `types/lesson-record.ts` |

## 代码质量底线

❌ 组件没有 JSDoc、Props 接口不导出、Hooks 依赖数组缺失

✅ FIX: 每个组件顶部写 JSDoc（使用场景 + 功能 + 相关组件）；`export interface XxxProps`；`useCallback` / `useMemo` 依赖写全。

📖 See: ../skills/code-review.md
