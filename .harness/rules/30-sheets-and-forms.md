---
last_updated: 2026-09-12
status: active
source: 双 prop 模式导致动画缺失；页面内联弹窗导致状态残留
---

# R30 弹窗与表单铁律

## 弹窗

❌ 手写固定蒙层弹窗

```tsx
{showSheet && (
  <View className="fixed inset-0 z-200">{/* 手写弹窗 */}</View>
)}
```

✅ FIX: 封装为独立 Sheet 组件，内部用 `BottomSheet`。

📖 See: ../skills/new-sheet.md

---

❌ `show` + `visible` 双 prop 模式（已废弃，会导致动画缺失）

```tsx
<BottomSheet show={showSheet} visible={showSheet}>
```

✅ FIX: 只传 `visible`——`visible` 同时控制渲染与动画。

```tsx
<BottomSheet visible={showSheet} title="标题" onClose={() => setShowSheet(false)}>
```

---

❌ 弹窗关闭后内部状态残留

✅ FIX: 在 `useEffect` 中监听 `visible` 重置。

```tsx
useEffect(() => {
  if (visible) {
    setName('');
    setPhone('');
    setError('');
  }
}, [visible]);
```

## 表单

❌ 裸用 `<Input>`，或在 Input 上设 `height` / `line-height`

```tsx
<Input className="h-[80rpx] leading-[80rpx]" />
```

✅ FIX: 一律用 `FormInput`，高度由外层容器 padding 控制（组件已内置）。

```tsx
<FormInput label="姓名" value={name} onInput={(v) => setName(v)} placeholder="请输入姓名" />
```

> 小程序 `<Input>` 内部样式控制高度，直接设 height/line-height 不生效；受控输入在 PC 模拟器上还容易重置。

📖 See: ../wiki/component-catalog.md

---

❌ Textarea 高度各页不一

✅ FIX: 统一 `min-h-[120rpx]`，`maxlength={200}`。

```tsx
<Textarea className="w-full bg-muted rounded-xl p-3 text-sm min-h-[120rpx] text-foreground" ... />
```

## 校验与提交

❌ 提交时不校验，或校验失败静默返回

✅ FIX: `validate()` 返回错误信息，`Taro.showToast({ icon: 'none' })` 提示后 return。

```tsx
const handleSubmit = () => {
  const error = validate();
  if (error) {
    Taro.showToast({ title: error, icon: 'none' });
    return;
  }
  // 提交
};
```
