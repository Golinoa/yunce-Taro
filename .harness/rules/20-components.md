---
last_updated: 2026-09-12
status: active
source: 重复造组件导致的多处 UI 不一致
---

# R20 组件铁律（先查后写）

## 第一条：先查后写

❌ 新增 UI 元素前不看 `src/components/`，直接手写一个新组件

✅ FIX: 先检索组件清单；已有可复用组件就复用，Props 不满足时优先扩展而非新建。

```bash
ls src/components/ && ls src/components/*/
```

📖 See: ../wiki/component-catalog.md

## 结构与命名

❌ 组件放在 `pages/` 下、文件名随意、Props 不导出

✅ FIX:

```
src/components/{module}/ComponentName/index.tsx
```

- 组件目录 PascalCase，文件固定 `index.tsx`
- `export default ComponentName`
- `export interface ComponentNameProps`
- 顶部 JSDoc：使用场景 + 功能 + 相关组件

## Props 设计

- **最小化**：只传必要数据，派生值在组件内部算。
- **回调 `on` 前缀**：`onClose` / `onConfirm` / `onChange` / `onSubmit`。
- **布尔 Props 语义化**：`disabled` 而非 `isDisabled`，`loading` 而非 `isLoading`。
- **可选 Props 给默认值**：消费方不需要处理 `undefined`。
- **需要自定义内容时才用 `children`**，否则用 Props 控制。

## 分层（演进方向）

```
src/components/
├── base/        # 原子：Icon, Avatar, Button
├── form/        # 表单：FormInput, ChipPicker, SegmentedControl
├── feedback/    # 反馈：BottomSheet, Toast, Empty, Loading
├── business/    # 业务：TeacherCard, SalaryItem
└── layout/      # 布局：PageContainer, Card, CardHeader
```

当前仍是扁平结构，新组件按模块分目录；组件数超过 40 个时启动分层迁移。

## 禁止

- 禁止在组件目录外创建 `.tsx` 文件（页面放 `pages/`，组件放 `components/`）。
- 禁止组件内管理跨页全局状态（走 Zustand，见 `50-state-and-types.md`）。
- 禁止 prop drilling 超过 2 层，超了提升到 Store。
