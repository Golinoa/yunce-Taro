# 代码审查 Checklist

## 一、每次提交必检

### 组件复用

- [ ] 新增 UI 元素前，是否检查了 `src/components/` 已有组件？
- [ ] 弹窗是否封装为独立 Sheet 组件（非页面内联）？
- [ ] 输入框是否使用 FormInput（非裸 Input）？
- [ ] 底部弹窗是否使用 BottomSheet（非手写弹窗）？

### 样式规范

- [ ] 是否使用 UnoCSS 原子类（无 SCSS 文件）？
- [ ] 是否使用设计 Token（无硬编码色值 `#xxx`）？
- [ ] 是否使用 rpx 单位（无 px/rem）？
- [ ] 是否有内联 style（应提取为 UnoCSS 规则）？
- [ ] 新增样式规则是否在 `uno.config.ts` 中定义？

### TypeScript

- [ ] Props 接口是否导出？
- [ ] 是否有隐式 any（应显式类型注解）？
- [ ] 是否有 @ts-ignore 或 as any（应修复类型）？
- [ ] 未使用的变量/导入是否已清理？

### 代码质量

- [ ] 组件是否有 JSDoc 注释（使用场景 + 功能）？
- [ ] 事件处理是否用 handle 前缀？
- [ ] 常量是否提取为 UPPER_SNAKE_CASE？
- [ ] useCallback/useMemo 依赖数组是否完整？

## 二、常见问题速查

### Q: Input 文字不居中

**原因**：小程序 Input 组件直接设 height/line-height 不生效
**方案**：使用 FormInput 组件，或外层容器控制 padding

```tsx
// ❌
<Input className="h-[80rpx] leading-[80rpx]" />

// ✅
<FormInput label="姓名" value={name} onInput={setName} />
```

### Q: BottomSheet 动画缺失

**原因**：使用了 `show` + `visible` 双 prop 模式
**方案**：只传 `visible`

```tsx
// ❌
<BottomSheet show={showSheet} visible={showSheet}>

// ✅
<BottomSheet visible={showSheet}>
```

### Q: 弹窗关闭后状态残留

**原因**：弹窗关闭时未重置内部状态
**方案**：在 `useEffect` 中监听 `visible` 变化重置

```tsx
useEffect(() => {
  if (visible) {
    setName('');
    setPhone('');
  }
}, [visible]);
```

### Q: 新增色值散落各处

**原因**：未通过 Token 体系管理
**方案**：在 `theme.ts` 新增 Token → 同步 `app.scss` → 在 `uno.config.ts` 新增规则

### Q: TypeScript 编译报 CommonEventFunction 未定义

**原因**：`@tarojs/components` 类型定义问题
**方案**：忽略 node_modules 中的类型错误，检查项目源码是否有新增错误

```bash
npx tsc --noEmit 2>&1 | findstr "error TS" | findstr /V "node_modules"
```

## 三、文件结构规范

### 新增页面

```
src/pages/page-name/
├── index.tsx          # 页面组件
└── index.config.ts    # 页面配置（definePageConfig）
```

### 新增组件

```
src/components/module/ComponentName/
└── index.tsx          # 组件 + Props 接口 + JSDoc
```

### 新增弹窗

```
src/components/module/XxxSheet/
└── index.tsx          # 遵循 sheets.md 模板
```

## 四、Git 提交规范

```
feat: 新增 XX 功能
fix: 修复 XX 问题
refactor: 重构 XX 模块
style: 样式调整（不影响逻辑）
chore: 构建/配置变更
```
