---
last_updated: 2026-09-12
status: active
---

# Skill: 新增业务弹窗

## 前置

- [ ] 检索已有 Sheet（`wiki/component-catalog.md`），同模块已存在就扩展而非新建
- [ ] 读 `.harness/rules/30-sheets-and-forms.md`

## 步骤

1. **建目录** `src/components/{module}/XxxSheet/index.tsx`（PascalCase）
2. **套模板**

   ```tsx
   import React, { useState, useEffect } from 'react';
   import { View } from '@tarojs/components';
   import BottomSheet from '@/components/BottomSheet';
   import FormInput from '@/components/FormInput';

   export interface XxxSheetProps {
     visible: boolean;
     onConfirm: (value: string) => void;
     onClose: () => void;
   }

   /**
    * XxxSheet - 功能简述
    * 使用场景：在哪个页面、什么操作触发
    * 功能：具体功能描述
    * 相关组件：关联的其他 Sheet
    */
   const XxxSheet: React.FC<XxxSheetProps> = ({ visible, onConfirm, onClose }) => {
     const [value, setValue] = useState('');

     useEffect(() => {
       if (visible) {
         setValue('');
       }
     }, [visible]);

     const handleConfirm = () => {
       if (!value.trim()) return;
       onConfirm(value);
     };

     return (
       <BottomSheet visible={visible} title="标题" onClose={onClose}>
         <View className="px-4 pb-6">
           <FormInput label="标签" value={value} onInput={setValue} placeholder="请输入…" />
           <View className="flex gap-3 mt-6">
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
         </View>
       </BottomSheet>
     );
   };

   export default XxxSheet;
   ```

3. **页面侧状态**（三件套：目标对象 + 开关 + 三个 handler）

   ```tsx
   const [showXxxSheet, setShowXxxSheet] = useState(false);
   const [xxxTarget, setXxxTarget] = useState<Xxx | null>(null);

   const handleOpenXxx = (t: Xxx) => { setXxxTarget(t); setShowXxxSheet(true); };
   const handleCloseXxx = () => { setShowXxxSheet(false); setXxxTarget(null); };
   const handleConfirmXxx = () => { /* 业务 */ handleCloseXxx(); };
   ```

4. **样式**：内容区统一 `px-4 pb-6`；Textarea 用 `min-h-[120rpx]`；底部按钮用 `pb-safe`
5. **加入 `components/{module}/index.ts` 聚合导出**
6. **交互涉及 ScrollView** → 必须走 `useOverlayScrollFreeze`（见 `rules/90-scroll-interaction.md`）

## 检查

- [ ] `BottomSheet` 只传 `visible`，没有 `show`
- [ ] 打开时重置内部状态
- [ ] 输入框用 `FormInput`，没有裸 `<Input>`
- [ ] 没有手写 `fixed` 蒙层
