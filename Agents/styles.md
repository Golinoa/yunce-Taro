# 样式规范

## 一、核心原则

1. **纯 UnoCSS** — 禁止创建 SCSS 文件，禁止内联 style（动态计算值除外）
2. **设计 Token 单一数据源** — `src/theme.ts` → `app.scss` → `uno.config.ts`
3. **rpx 单位** — 所有尺寸使用 rpx，禁止 px/rem

## 二、Token 引用方式

| 场景 | 引用方式 | 示例 |
|------|----------|------|
| 颜色（UnoCSS 类名） | `text-{token}` / `bg-{token}` | `text-primary`, `bg-card`, `border-border` |
| 颜色（半透明） | UnoCSS rules | `bg-primary-10`, `bg-destructive-5` |
| 颜色（JS 运行时） | `import { hsl, hexColors } from '@/theme'` | `hexColors.primary` |
| 渐变 | UnoCSS rules | `bg-gradient-primary`, `bg-gradient-amber` |
| 阴影 | UnoCSS theme/shortcuts | `shadow-soft`, `shadow-card`, `shadow-float` |
| 圆角 | UnoCSS theme | `rounded-xl`, `rounded-2xl`, `rounded-b-60rpx` |
| 间距 | UnoCSS 原子类 | `p-3`, `px-4`, `mb-6`, `gap-2` |

## 三、禁止的写法

```tsx
// ❌ 硬编码色值
<View style={{ background: '#f5faf8' }}>
<Text className="text-[#D94040]">

// ❌ 内联 style（非动态值）
<View style={{ border: '3rpx solid #D5E8E0', backgroundColor: '#f5faf8' }}>

// ❌ px 单位
<Text className="text-[14px]">

// ❌ SCSS 文件
import './index.scss'

// ❌ CSS 伪元素实现装饰
// 用 View 元素替代 ::before / ::after
```

## 四、正确的写法

```tsx
// ✅ Token 颜色
<View className="bg-muted">
<Text className="text-destructive">

// ✅ UnoCSS rules（复杂样式）
<View className="form-input-wrap">

// ✅ rpx 单位
<Text className="text-[28rpx]">

// ✅ View 替代伪元素
<View className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rpx] h-[6rpx] rounded-[4rpx] bg-primary" />
```

## 五、新增样式规则流程

```
1. 检查 uno.config.ts shortcuts 是否已有
   ├─ 有 → 直接使用
   └─ 无 → 检查是否跨组件复用
       ├─ 复用 → 在 uno.config.ts rules/shortcuts 中新增
       └─ 单次 → 内联 UnoCSS 原子类，不新增规则
```

### rules vs shortcuts 选择

| 类型 | 用途 | 示例 |
|------|------|------|
| rules | 需要特殊 CSS 属性（渐变、阴影、半透明） | `bg-gradient-primary`, `bg-primary-10` |
| shortcuts | 组合多个原子类 | `chip-active`, `press-scale`, `form-input-wrap` |

## 六、样式迁移检查清单

从 SCSS 迁移到 UnoCSS 时：

1. [ ] 所有类名替换为 UnoCSS 原子类
2. [ ] 硬编码色值替换为 Token（`text-primary`、`bg-card` 等）
3. [ ] px 替换为 rpx
4. [ ] CSS 伪元素替换为 View 元素
5. [ ] 复杂样式提取到 uno.config.ts rules/shortcuts
6. [ ] 删除 SCSS 文件和 import 语句
7. [ ] 编译验证无新增错误
