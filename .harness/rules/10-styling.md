---
last_updated: 2026-09-12
status: active
source: SCSS 迁移专项 + 硬编码色值散落事故
---

# R10 样式铁律（UnoCSS + Token + rpx）

## 五条硬性

1. **禁止新增 SCSS 文件**——已有 `src/styles/` 遗留文件只减不增。
2. **禁止内联 style**——除非是动态计算值（如 ECharts 配置）。
3. **颜色必须走设计 Token**——禁止硬编码色值。
4. **尺寸单位用 rpx**——禁止 `px` / `rem`（UnoCSS `presetRemRpx` 会自动转换）。
5. **新增样式规则进 `uno.config.ts`**——禁止把复杂样式散落在组件里。

## 典型案例

❌ 硬编码色值

```tsx
<View style={{ background: '#f5faf8' }}>
<Text className="text-[#D94040]">
```

✅ FIX:

```tsx
<View className="bg-muted">
<Text className="text-destructive">
```

📖 See: ../wiki/design-tokens.md

---

❌ 内联 style（非动态值）

```tsx
<View style={{ border: '3rpx solid #D5E8E0', backgroundColor: '#f5faf8' }}>
```

✅ FIX: 在 `uno.config.ts` 的 `rules` / `shortcuts` 中定义后使用类名；一次性样式直接用 UnoCSS 原子类拼。

📖 See: ../wiki/design-tokens.md

---

❌ 使用 `px` 单位

```tsx
<Text className="text-[14px]">
```

✅ FIX: `<Text className="text-[28rpx]">`（@375 设计稿基准）。

---

❌ 引入 SCSS

```tsx
import './index.scss';
```

✅ FIX: 删除 import，样式改 UnoCSS 类名；复杂样式提取到 `uno.config.ts`。迁移后删除原 SCSS 文件。

---

❌ 用 CSS 伪元素做装饰

✅ FIX: 用真实 `<View>` 元素代替 `::before` / `::after`——小程序端伪元素支持不稳定。

```tsx
<View className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rpx] h-[6rpx] rounded-[4rpx] bg-primary" />
```

## 新增规则放哪

| 判断 | 归属 |
| --- | --- |
| 需要特殊 CSS 属性（渐变、阴影、半透明） | `uno.config.ts` 的 `rules` |
| 组合多个原子类 | `uno.config.ts` 的 `shortcuts` |
| 只用一次 | 直接内联 UnoCSS 原子类，不新增规则 |

## 安全区

❌ 底部操作栏被 Home Indicator 遮挡

✅ FIX: 底栏用 `pb-safe` / `pb-safe-bar`；自定义导航用 `pt-nav-safe`。

📖 See: ../wiki/design-tokens.md
