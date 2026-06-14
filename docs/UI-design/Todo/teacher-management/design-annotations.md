# 教师管理模块 - 设计标注

> 本文档记录教师管理模块的 UI 实现标注，包括组件映射、设计 Token 使用、关键尺寸和交互说明。

---

## 一、设计 Token 映射

### 1.1 颜色使用

| 场景 | Token / 值 | 说明 |
|------|-----------|------|
| 渐变头部 | `linear-gradient(135deg, #5ec8a8, #7dd8be)` | 主色渐变，非 Token 标准渐变（更浅） |
| 主色文字/图标 | `hsl(var(--primary))` / `#5EC8A8` | 标准 primary |
| 薪资强调色 | `#d4a24e` / amber | 薪资模块专属色，非标准 Token |
| 薪资渐变 | `linear-gradient(135deg, #d4a24e, #c4922e)` | 快捷发薪卡片、批量发放按钮 |
| 信息色 | `hsl(var(--info))` / `#6BA3D6` | 助教标签、排课时间线 |
| 危险色 | `hsl(var(--destructive))` | 离职确认、扣款 |
| 成功色 | `hsl(var(--success))` | 补发、已发放状态 |
| 卡片背景 | `hsl(var(--card))` | 白色 #FFFFFF |
| 页面背景 | `hsl(var(--background))` | 浅绿 #FAFDFB |
| 边框 | `hsl(var(--border))` | #D5E8E0 |

### 1.2 非标准颜色说明

以下颜色在设计中使用但不在全局 Token 中，属于模块级扩展色：

| 颜色 | 值 | 用途 |
|------|-----|------|
| amber | `#d4a24e` | 薪资模块主色（待确认/已确认状态、金额高亮） |
| amber-dark | `#c4922e` | amber 的深色变体（渐变终点） |
| amber-10 | `#FFF8E1` / `#faf6ee` | amber 浅底色（备注背景、提醒卡片） |
| amber-bg | `#FFF8E1` | amber 背景色 |
| primary-bg | `hsl(var(--secondary))` | 主色浅底（选中态背景） |
| info-bg | `#f0f5fb` | 信息色浅底 |
| red-50 | `#FFEBEE` | 危险色浅底（扣款选中态） |
| green-50 | `#E8F5E9` | 成功色浅底（补发选中态） |

> **建议**：将 amber 系列颜色纳入全局 Token，避免硬编码。

---

## 二、组件尺寸标注

### 2.1 渐变头部

| 属性 | 值 | 说明 |
|------|-----|------|
| 顶部安全距离 | `48px` | 状态栏 + 导航栏高度 |
| 水平内边距 | `20px` | 两侧 |
| 标题字号 | `20px` / font-weight 700 | "教师管理" |
| 添加按钮 | `height: 32px; padding: 0 12px; border-radius: 16px` | 胶囊按钮 |
| 统计Chip | `flex: 1; padding: 8px 4px; border-radius: 10px` | 三等分 |
| 统计数值 | `16px` / font-weight 700 | 白色 |
| 统计标签 | `10px` | 白色 80% 透明度 |
| 胶囊Tab | `border-radius: 14px; padding: 4px` | 外框 |
| 单个Tab | `padding: 10px 0; border-radius: 10px` | 内部 |

### 2.2 教师卡片

| 属性 | 值 | 说明 |
|------|-----|------|
| 卡片圆角 | `rounded-card` → 16px | |
| 卡片内边距 | `p-4` → 16px | |
| 卡片间距 | `mb-3` → 12px | |
| 左侧色条 | `6rpx` 宽 | lead=primary, assist=info, parttime=amber |
| 头像尺寸 | `size="lg"` | |
| 姓名字号 | `text-lg` / font-bold | |
| 角色标签 | `px-2 py-[2rpx] rounded-tag text-xs` | |
| 课时数字 | `text-2xl font-extrabold` | primary 色 |
| 薪资状态行 | `mt-3 pt-3 border-t border-border/50` | 分隔线 |

### 2.3 薪资卡片

| 属性 | 值 | 说明 |
|------|-----|------|
| 勾选框 | `44rpx × 44rpx; border-radius: 8px` | 左上角 |
| 金额 | `text-xl font-extrabold text-amber` | 右侧 |
| 明细Chip | `flex gap-2 flex-wrap` | 底部 |
| 选中态 | `bg-amber-50/50 border border-amber/40` | 边框高亮 |

### 2.4 底部弹窗

| 属性 | 值 | 说明 |
|------|-----|------|
| 顶部圆角 | `40rpx` | `radius.sheet` |
| 拖拽手柄 | `64rpx × 8rpx; border-radius: 4px` | 居中 |
| 标题栏 | `px-10 py-4; border-bottom: 2rpx solid` | |
| 最大高度 | `80vh` | 可配置 |
| 遮罩 | `bg-black/45` | 半透明 |
| 动画 | `300ms ease-in-out` | translateY |

---

## 三、交互标注

### 3.1 薪资状态流转

```
待确认(pending) → 已确认(confirmed) → 已发放(paid)
     ↓ 确认按钮        ↓ 发放按钮(二次确认)     ↓ 终态
```

- 确认：直接切换状态，Toast 提示
- 发放：弹出 PayConfirmSheet，需二次确认 + 可选备注
- 批量操作：先勾选 → 批量确认/批量发放

### 3.2 弹窗交互

| 弹窗 | 触发位置 | 关闭方式 | 提交校验 |
|------|---------|---------|---------|
| AddTeacherSheet | 头部"添加教师" | 遮罩/无取消按钮 | 姓名必填 |
| EditTeacherSheet | 详情页右上角"✎" | 遮罩/无取消按钮 | 姓名必填 |
| PayConfirmSheet | 发放按钮 | 遮罩/取消按钮 | 无 |
| DeductionSheet | 工资单详情"+" | 遮罩/无取消按钮 | 原因+金额必填 |
| SalaryModelSheet | 设置页"新建/编辑" | 遮罩/无取消按钮 | 名称必填 |
| PaymentSettingsSheet | 设置页"修改" | 遮罩/无取消按钮 | 无 |
| MonthPicker | 历史月份标题 | 遮罩/选择后自动关闭 | 无 |
| 离职确认 | 详情页"标记离职" | 遮罩/取消按钮 | 无 |

### 3.3 筛选交互

- 三维筛选互斥：角色/科目/状态
- 下拉菜单全宽展示，点击外部关闭
- 选中项高亮 + ✓ 标记
- 选择后自动关闭并刷新列表

### 3.4 排课交互

- 周导航左右切换，点击日期查看课表
- 今日高亮（绿色背景），选中日期蓝色
- 有课日期底部圆点标记
- 教师标签可点击跳转详情

---

## 四、组件文件映射

| 组件 | 路径 | 页面引用 |
|------|------|---------|
| TeacherCard | `src/components/teacher/TeacherCard/` | 教师列表-教师Tab |
| SalaryItem | `src/components/teacher/SalaryItem/` | 教师列表-薪资Tab |
| FilterBar | `src/components/teacher/FilterBar/` | 教师列表-教师Tab |
| MonthPicker | `src/components/teacher/MonthPicker/` | 教师列表-薪资Tab-历史 |
| PayConfirmSheet | `src/components/teacher/PayConfirmSheet/` | 教师列表/教师详情/薪资详情 |
| AddTeacherSheet | `src/components/teacher/AddTeacherSheet/` | 教师列表-头部 |
| EditTeacherSheet | `src/components/teacher/EditTeacherSheet/` | 教师详情-头部 |
| SalaryModelSheet | `src/components/teacher/SalaryModelSheet/` | 教师列表-薪资Tab-设置 |
| PaymentSettingsSheet | `src/components/teacher/PaymentSettingsSheet/` | 教师列表-薪资Tab-设置 |
| DeductionSheet | `src/components/teacher/DeductionSheet/` | 薪资详情-扣款/补发 |
| BottomSheet | `src/components/BottomSheet/` | 所有弹窗的基础组件 |
| Avatar | `src/components/Avatar/` | 教师卡片/详情/薪资项 |

---

## 五、页面文件映射

| 页面 | 路径 | 说明 |
|------|------|------|
| 教师列表 | `src/pages/teacher-list/` | 三Tab主页（教师/薪资/排课） |
| 教师详情 | `src/pages/teacher-detail/` | 四Tab详情（薪资/课时/反馈/排课） |
| 薪资详情 | `src/pages/salary-detail/` | 工资单详情（状态流转+金额构成） |

---

## 六、状态管理

| Store | 路径 | 核心方法 |
|-------|------|---------|
| useTeacherStore | `src/stores/teacher.ts` | addTeacher, updateTeacher, resignTeacher, confirmSalary, batchConfirm, executePay, addDeduction, updateSettings |

---

## 七、待优化项

1. **amber 色系**：建议纳入全局 Token，当前硬编码在多处
2. **渐变头部**：使用固定色值 `#5ec8a8 → #7dd8be`，与 Token primary 渐变不同
3. **弹窗表单**：AddTeacherSheet/EditTeacherSheet 无独立取消按钮，依赖遮罩关闭
4. **SalaryModelSheet**：自定义模型参数输入未做联动校验
5. **DeductionSheet**：快捷原因与手动输入可同时存在，需注意去重逻辑
