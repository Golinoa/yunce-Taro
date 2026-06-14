# 弹窗开发规范

## 一、BottomSheet 基础组件

### 用法

```tsx
import BottomSheet from '@/components/BottomSheet';

<BottomSheet visible={showSheet} title="标题" onClose={() => setShowSheet(false)}>
  <View className="px-4 pb-6">
    {/* 内容 */}
  </View>
</BottomSheet>
```

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `visible` | boolean | ✅ | 控制渲染 + 动画 |
| `title` | string | ❌ | 标题栏文字 |
| `onClose` | () => void | ❌ | 关闭回调 |
| `maxHeight` | string | ❌ | 最大高度，默认 `80vh` |
| `className` | string | ❌ | 内容区额外类名 |

### 禁止

```tsx
// ❌ 双 prop 模式（已废弃）
<BottomSheet show={showSheet} visible={showSheet}>

// ❌ 页面内联弹窗（必须封装为独立组件）
{showSheet && (
  <View className="fixed inset-0 z-200">
    {/* 手写弹窗逻辑 */}
  </View>
)}
```

## 二、业务 Sheet 组件模板

每个业务弹窗必须封装为独立组件，遵循以下模板：

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Textarea } from '@tarojs/components';
import BottomSheet from '@/components/BottomSheet';
import cn from 'classnames';

interface XxxSheetProps {
  visible: boolean;
  // 业务数据 props
  onConfirm: (/* 参数 */) => void;
  onClose: () => void;
}

/**
 * XxxSheet - 功能简述
 *
 * 使用场景：在哪个页面、什么操作触发
 * 功能：具体功能描述
 * 相关组件：关联的其他 Sheet 组件
 */
const XxxSheet: React.FC<XxxSheetProps> = ({
  visible,
  onConfirm,
  onClose,
}) => {
  // 重置内部状态
  useEffect(() => {
    if (visible) {
      // 重置表单状态
    }
  }, [visible]);

  const handleConfirm = () => {
    // 校验逻辑
    onConfirm(/* 参数 */);
  };

  return (
    <BottomSheet visible={visible} title="标题" onClose={onClose}>
      <View className="px-4 pb-6">
        {/* 内容区 */}
      </View>
    </BottomSheet>
  );
};

export default XxxSheet;
```

## 三、弹窗样式规范

### 内容区

```tsx
// 统一 padding
<View className="px-4 pb-6">
```

### 输入框

```tsx
// Textarea — 统一最小高度
<Textarea
  className="w-full bg-muted rounded-xl p-3 text-sm min-h-[120rpx] text-foreground"
  placeholder="请输入..."
  value={value}
  onInput={(e) => setValue(e.detail.value)}
  maxlength={200}
/>

// 单行输入 — 使用 FormInput
<FormInput
  label="标签"
  value={value}
  onInput={(v) => setValue(v)}
  placeholder="请输入..."
/>
```

### 按钮

```tsx
// 双按钮（取消 + 确认）
<View className="flex gap-3">
  <View
    className="flex-1 py-3 rounded-xl text-center text-sm font-semibold bg-muted text-muted-foreground"
    onClick={onClose}
  >
    取消
  </View>
  <View
    className="flex-1 py-3 rounded-xl text-center text-sm font-semibold bg-primary text-white"
    onClick={handleConfirm}
  >
    确认
  </View>
</View>

// 单按钮
<View
  className="py-[28rpx] rounded-2xl text-center text-base font-semibold text-white bg-gradient-primary"
  onClick={handleConfirm}
>
  确认
</View>
```

### 提示信息

```tsx
// 警告提示
<View className="bg-amber-bg rounded-xl p-4 mb-4">
  <Text className="text-sm text-foreground">提示内容</Text>
</View>

// 危险提示
<View className="bg-destructive-5 rounded-xl p-4 mb-4">
  <Text className="text-sm text-destructive">警告内容</Text>
</View>
```

## 四、弹窗状态管理

```tsx
// 页面中管理弹窗状态
const [showXxxSheet, setShowXxxSheet] = useState(false);
const [xxxTarget, setXxxTarget] = useState<SomeType | null>(null);

// 打开
const handleOpenXxx = (target: SomeType) => {
  setXxxTarget(target);
  setShowXxxSheet(true);
};

// 关闭
const handleCloseXxx = () => {
  setShowXxxSheet(false);
  setXxxTarget(null);
};

// 确认
const handleConfirmXxx = () => {
  // 业务逻辑
  handleCloseXxx();
};
```

## 五、已有 Sheet 组件清单

| 组件 | 路径 | 功能 |
|------|------|------|
| AddTeacherSheet | `components/teacher/` | 添加教师 |
| EditTeacherSheet | `components/teacher/` | 编辑教师 |
| DeductionSheet | `components/teacher/` | 扣款/补发 |
| ConfirmSalarySheet | `components/teacher/` | 确认工资 |
| PayConfirmSheet | `components/teacher/` | 确认发放（单人+批量） |
| ResignSheet | `components/teacher/` | 离职确认 |
| SalaryModelSheet | `components/teacher/` | 工资模型 |
| PaymentSettingsSheet | `components/teacher/` | 发放设置 |
