# 表单 / 输入框规范

## 一、核心原则

1. **禁止裸 Input** — 所有输入框必须使用 `FormInput` 组件包裹
2. **容器控制尺寸** — 输入框高度由外层容器 padding 控制，不在 Input 上设 height/line-height
3. **Textarea 统一高度** — `min-h-[120rpx]`

## 二、FormInput 用法

```tsx
import FormInput from '@/components/FormInput';

// 基础
<FormInput
  label="姓名"
  value={name}
  onInput={(v) => setName(v)}
  placeholder="请输入姓名"
/>

// 必填
<FormInput
  label="手机号"
  required
  value={phone}
  onInput={(v) => setPhone(v)}
  placeholder="请输入手机号"
  type="number"
/>

// 带前缀
<FormInput
  label="每月发薪日"
  prefix="每月"
  suffix="号"
  value={payDay}
  onInput={(v) => setPayDay(v)}
  placeholder="15"
  type="number"
/>

// 错误状态
<FormInput
  label="金额"
  value={amount}
  onInput={(v) => setAmount(v)}
  error="请输入有效金额"
/>
```

## 三、小程序 Input 陷阱

### 问题：Input 直接设 height/line-height 不生效

小程序 `<Input>` 组件的高度由内部样式控制，直接设置 `height` 和 `line-height` 无法让文字垂直居中。

### 解决方案：容器控制

```tsx
// ❌ 错误 — Input 上设高度
<Input className="h-[80rpx] leading-[80rpx]" />

// ✅ 正确 — 外层容器控制
<View className="py-[14rpx] px-[20rpx] rounded-xl bg-muted">
  <Input className="text-sm text-foreground" />
</View>
```

### FormInput 已内置此方案

FormInput 组件内部已处理容器样式，直接使用即可：

```tsx
<FormInput label="标签" value={val} onInput={setVal} />
```

## 四、Textarea 规范

```tsx
<Textarea
  className="w-full bg-muted rounded-xl p-3 text-sm min-h-[120rpx] text-foreground"
  placeholder="请输入..."
  value={value}
  onInput={(e) => setValue(e.detail.value)}
  maxlength={200}
/>
```

| 属性 | 值 | 说明 |
|------|-----|------|
| className | `w-full bg-muted rounded-xl p-3 text-sm min-h-[120rpx] text-foreground` | 统一样式 |
| maxlength | 200 | 默认最大长度 |
| placeholder | 业务定义 | 提示文字 |

## 五、表单校验

```tsx
const validate = (): string | null => {
  if (!name.trim()) return '请输入姓名';
  if (!phone.trim()) return '请输入手机号';
  if (!/^1\d{10}$/.test(phone)) return '手机号格式不正确';
  return null;
};

const handleSubmit = () => {
  const error = validate();
  if (error) {
    Taro.showToast({ title: error, icon: 'none' });
    return;
  }
  // 提交逻辑
};
```

## 六、表单状态重置

弹窗打开时重置内部状态：

```tsx
useEffect(() => {
  if (visible) {
    setName('');
    setPhone('');
    setError('');
  }
}, [visible]);
```
