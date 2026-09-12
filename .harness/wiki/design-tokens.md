---
last_updated: 2026-09-12
status: active
---

# 设计 Token 使用表

> 单一数据源：`src/theme.ts`（JS/TS 运行时）→ 手动同步 `app.scss`（CSS 变量）。
> 改 token → 两处都改 → 全局生效。**禁止硬编码色值 / 尺寸 / 圆角。**

## 常用色（UnoCSS 类名）

| Token | 类名示例 | 用途 |
| --- | --- | --- |
| primary `#3B6EF5` | `text-primary` / `bg-primary` | 主按钮、选中态、链接 |
| primarySoft | `bg-primary/20` 系列 | 导航栏 / 头部渐变背景 |
| secondary | `bg-secondary` | 次级按钮底色 |
| accent `#8B5CF6` | `text-accent` / `bg-accent` | 强调、花瓣紫 |
| background `#f8f9fa` | `bg-background` | 页面底色 |
| card `#FFFFFF` | `bg-card` / `border-border` | 卡片、表单 |
| muted `#f0f2f5` | `bg-muted` / `text-muted-foreground` | 占位、禁用、次级文字 |
| foreground / foregroundSecondary | `text-foreground` / `text-foreground-secondary` | 主 / 次文本 |
| danger `#ef4444` | `text-danger` / `bg-danger` | 危险操作、报错、删除 |

## 尺寸与单位

- **单位一律 rpx**（designWidth 375），`text-[28rpx]`、`py-[20rpx]`。禁止 `px` / `rem`（UnoCSS presetRemRpx 自动转换）。
- **唯一例外**：`PickerView` 的 `indicatorStyle` 高度必须 `px`（96rpx → 48px），写 rpx 被微信静默忽略。见 `rules/90-scroll-interaction.md`。

## 新增规则

- 新增原子类 / shortcut 必须进 `uno.config.ts` 的 rules / shortcuts，禁止散落硬编码值。
- 业务色（如状态色映射）优先从 `theme.ts` 取，页面不得写死色值。
