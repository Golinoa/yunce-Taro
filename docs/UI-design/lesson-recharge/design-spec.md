# 课时充值模块 UI 设计说明

> 原型文件：`lesson-recharge.html`（浏览器打开即可预览）

---

## 一、业务定位

**课时充值**是教师端后台操作，用于给学员手动充值课时。核心特征：
- **教师操作**，非学员自助
- **收费仅记录**，不接入真实支付
- **支持分期付款**记录（复用 InstallmentPanel 组件）
- 选择课包模板可自动填充课时、有效期、价格

---

## 二、页面流程

```
选择学员 → 选择课包(模板/自定义) → 课包信息(仅自定义时显示) → 赠送课时(选填) → 收费信息(选填,含分期) → 确认充值
```

### 2.1 选择学员
- 渐变色学生信息卡片，展示姓名、手机号、剩余课时、进行中课包数、已消课次
- 点击卡片或"更换学员"打开底部弹窗选择
- 从路由参数 `studentId` 可预选学员

### 2.2 选择课包
- **浮窗模式**：页面只展示已选课包摘要卡片，点击打开底部浮窗选择
- 已选摘要卡片展示：图标 + 名称 + 描述 + 标签(课时/有效期) + 价格 + "更改"按钮
- 浮窗内展示课包模板列表，每项展示：图标 + 名称 + 描述 + 标签(课时/有效期) + 价格 + radio
- 选中模板后隐藏课包信息卡片（信息已在摘要卡片中展示），自动填充收费金额
- 浮窗底部"自定义课包"虚线框，点击展开名称+课时+有效期+金额输入，确认后关闭浮窗

### 2.3 课包信息（仅自定义课包时显示）
- 选择模板时：课包信息卡片完全隐藏，课时/有效期/价格已在摘要卡片中展示
- 自定义课包时：显示编辑模式，课时步进器（-/+）+ 有效期天数输入 + 快捷标签
- 有效期留空或0表示永久有效

### 2.4 赠送课时（选填）
- 步进器（-/+按钮）+ 数字输入框，默认0，与快捷标签同行排列
- 快捷标签：0/+1/+2/+4
- 赠送>0时显示提示：`赠送 X 课时，合计到账 Y 课时`
- 赠送课时不计入收费金额

### 2.5 收费信息（选填，仅记录）
- 金额输入（带 ¥ 前缀）
- 支付方式：微信/支付宝/现金/转账/其他
- **分期付款开关**：打开后展示分期面板
  - 三列摘要：总金额 / 首笔金额 / 待付金额
  - 期数选择：2期/3期/6期/12期
  - 还款计划卡片：每期金额 + 日期
  - 剩余金额提示（超出/未分配）

### 2.6 备注（选填）

### 2.7 底部按钮
- 固定底部，显示操作摘要：`确认充值 · 26课时（含赠送2） · ¥2,400`
- 必填项（学员+课包+课时）未完成时禁用

---

## 三、设计标注

### 3.1 颜色 Token

| Token | 色值 | 用途 |
|-------|------|------|
| --primary | #5EC8A8 | 主色，按钮、选中态、课包标签 |
| --primary-dark | #4AB893 | 主色深，按钮渐变终点 |
| --primary-bg | #f0faf5 | 主色背景，选中卡片底色、标签底色 |
| --destructive | #D94040 | 危险色，必填标记、超分配提示 |
| --destructive-bg | #fef2f2 | 危险色背景 |
| --border | #D5E8E0 | 边框色 |
| --bg-page | #F5FAF8 | 页面背景色 |
| --bg | #FFFFFF | 卡片背景色 |
| --success | #3ABF6E | 成功色，赠送课时、已付金额 |
| --success-bg | #edf9f1 | 成功色背景 |
| --amber | #d4a24e | 琥珀色，有效期标签、待付金额 |
| --amber-bg | #faf6ee | 琥珀色背景 |
| --purple | #9b7ed8 | 紫色，永久有效标签 |
| --purple-bg | #f3f0fb | 紫色背景 |
| --accent | #e88aaa | 强调色，分期首期标记 |
| --accent-bg | #fdf0f4 | 强调色背景 |
| --info | #6ba3d6 | 信息色，体验课图标 |
| --info-bg | #f0f5fb | 信息色背景 |
| --text | #2d4a3e | 主文字色 |
| --text-sec | #7a9a8e | 次要文字色 |
| --text-light | #a0b8ad | 辅助文字色 |

### 3.2 尺寸 Token（px → rpx）

| Token | px | rpx | 用途 |
|-------|-----|------|------|
| 页面边距 | 16px | 32rpx | content 左右 padding |
| 卡片圆角 | 16px | 32rpx | card border-radius |
| 卡片内边距 | 16px | 32rpx | card padding |
| 卡片间距 | 12px | 24rpx | card margin-bottom |
| 输入框圆角 | 12px | 24rpx | input border-radius |
| 按钮圆角 | 24px | 48rpx | submit-btn border-radius |
| 按钮高度 | 48px | 96rpx | submit-btn 高度 |
| 标签圆角 | 16px | 32rpx | quick-tag/gift-tag border-radius |
| 浮窗圆角 | 20px | 40rpx | sheet 顶部圆角 |
| 学生卡片圆角 | 20px | 40rpx | stu-card border-radius |
| 课包图标 | 48×48px | 96rpx | ts-icon 尺寸 |
| 头像 | 48×48px | 96rpx | stu-card avatar |
| 步进器按钮 | 36×36px | 72rpx | hours-input-wrap button |
| 步进器高度 | 36px | 72rpx | hours-input-wrap input height |
| 赠送输入框宽度 | 140px | 280rpx | gift-input-wrap width |
| 赠送输入框高度 | 34px | 68rpx | gift-input-wrap input height |
| 分期摘要圆角 | 10px | 20rpx | inst-sum-item border-radius |
| 开关 | 48×28px | 96×56rpx | toggle-switch |

### 3.3 字号 Token

| Token | px | rpx | 用途 |
|-------|-----|------|------|
| 标题 | 16px | 32rpx | 卡片标题、按钮文字、课包名称 |
| 正文 | 14px | 28rpx | 课包选项名称、表单标签、支付方式 |
| 辅助 | 12px | 24rpx | 描述文字、标签、按钮副文字 |
| 最小 | 11px | 22rpx | 统计标签、手机号、课包描述 |
| 页面标题 | 20px | 40rpx | navbar h1 |
| 学生姓名 | 18px | 36rpx | stu-card name |
| 统计数字 | 22px | 44rpx | stat-val |
| 价格大字 | 17px | 34rpx | ts-price |
| 步进器数字 | 16px | 32rpx | hours-input input |
| 标签文字 | 10px | 20rpx | ts-tag、tpl-tag |

### 3.4 微信适配

| 项目 | 值 | 说明 |
|------|-----|------|
| 导航栏高度 | 44px (iOS) | 系统导航栏 |
| 胶囊避让右侧 | 87px | 右上角胶囊按钮宽度 |
| 底部安全区 | env(safe-area-inset-bottom) | iPhone X+ 底部避让 |
| 点击目标最小 | 44px | 所有可点击区域 ≥ 44px |
| 页面最大宽度 | 414px | phone-frame max-width |
| 浮窗最大高度 | 70vh | sheet max-height |
| 遮罩透明度 | rgba(0,0,0,0.45) | overlay background |

### 3.5 阴影与动效

| Token | 值 | 用途 |
|-------|-----|------|
| 卡片阴影 | 0 4px 20px -4px rgba(54,73,67,0.1) | card box-shadow |
| 底栏阴影 | 0 -2px 12px rgba(0,0,0,0.06) | bottom-bar box-shadow |
| 手机框阴影 | 0 12px 48px rgba(0,0,0,0.12) | phone-frame box-shadow |
| 浮窗滑入 | translateY(100%) → 0, 0.3s ease | sheet transition |
| 按钮缩放 | scale(0.97), 0.15s | submit-btn:active |
| 卡片缩放 | scale(0.98), 0.15s | tpl-selected-card:active |
| Toast | translateY(-20px) → 0, 0.25s | toast transition |

---

## 四、与现有组件的复用关系

| 组件 | 来源 | 复用方式 |
|------|------|----------|
| InstallmentPanel | `src/components/InstallmentPanel` | 直接复用，分期付款面板 |
| ChipPicker | `src/components/ChipPicker` | 复用，支付方式/期数选择 |
| BottomSheet | `src/components/BottomSheet` | 复用，学员/课包选择弹窗 |
| PickerItem | `src/components/PickerItem` | 复用，课包选择列表项 |
| Card / CardHeader | `src/components/Card` | 复用，卡片容器 |
| FormInput | `src/components/FormInput` | 复用，表单输入 |

---

## 五、数据模型

### 5.1 充值表单数据

```typescript
interface RechargeFormData {
  student_id: string;          // 学员ID（必填）
  template_id?: string;        // 课包模板ID（选模板时必填）
  name: string;                // 课包名称（默认"课时充值"）
  total_hours: number;         // 充值课时数（必填，模板时只读）
  valid_days?: number;         // 有效天数（0=永久，模板时只读）
  gift_hours?: number;         // 赠送课时（选填，默认0，不计入收费）
  fee_amount?: number;         // 收费金额（选填，仅记录）
  fee_method?: FeeMethod;      // 支付方式（选填）
  installment_enabled?: boolean; // 是否分期
  installment_period?: number;   // 分期期数
  installment_schedule?: ScheduleItem[]; // 分期计划
  note?: string;               // 备注
}
```

### 5.2 课包模板（CoursePackageTemplate）

复用已有类型 `src/types/course-package.ts`：
- `hour_package`：课时包，lesson_count必填
- `term`：期课，lesson_count + valid_days必填
- `monthly`：月卡，valid_days必填
- `trial`：体验课，默认1课时7天

### 5.3 分期计划（ScheduleItem）

复用 InstallmentPanel 组件的类型：
```typescript
interface ScheduleItem {
  period: number;    // 期数序号
  amount: string;    // 金额
  date: string;      // 计划日期
  reminder: boolean; // 是否提醒
}
```

---

## 六、与现有页面的路由关系

```
首页 → 课时充值（/pages/package-form/index）
学员详情 → 课时充值（带 studentId 参数）
消课页面 → 课时充值（课包不足时引导充值）
```

---

## 七、关键交互逻辑

1. **选择课包模板** → 课包信息卡片隐藏，信息已在摘要卡片中展示；自动填充收费金额
2. **选择自定义课包** → 课包信息卡片显示编辑模式，可手动输入课时/有效期/金额
3. **赠送课时** → 独立于课包课时，不计入收费金额；底部按钮显示合计课时（含赠送）
4. **分期开关** → 需先填写金额才能开启；开启后自动按期数均分金额
5. **分期金额校验** → 各期金额之和需等于总金额，超出/不足实时提示
6. **底部按钮** → 实时显示合计课时（含赠送）和金额摘要

---

## 八、组件交互规格

### 8.1 学生信息卡片 (StudentCard)

| 属性 | 规格 |
|------|------|
| 背景 | `linear-gradient(135deg, #5EC8A8, #7dd8bc)` |
| 圆角 | 20px (40rpx) |
| 内边距 | 20px (40rpx) |
| 头像 | 48×48px 圆形，白底+主色首字 |
| 统计项 | 三列：剩余课时 / 进行中课包 / 已消课次 |
| 统计数字 | 22px 加粗，白色 |
| 统计标签 | 11px，白色75%透明度 |
| 装饰圆 | 右上100px+右下60px，白色8%/6%透明度 |
| 点击 | 整卡片可点击，打开学员选择弹窗 |
| 更换链接 | 右侧"更换学员"下划线文字 |

### 8.2 课包摘要卡片 (PackageSummaryCard)

| 状态 | 样式 |
|------|------|
| 已选模板 | 1.5px 主色边框 + 主色浅底 + 实心图标 |
| 未选择 | 2px 虚线边框 + 灰底 + 灰色图标 |

**已选摘要卡片**：
- 左侧图标 48×48px 圆角12px 白底
- 中间：名称15px加粗 + 描述12px灰色 + 标签行(课时/有效期)
- 右侧：价格17px加粗主色 + "更改"11px主色+箭头

**未选择占位卡片**：
- 左侧图标 48×48px 圆角12px 灰底
- 中间：标题14px加粗 + 描述12px浅灰
- 右侧：右箭头20px

### 8.3 课包选择浮窗 (PackagePickerSheet)

| 属性 | 规格 |
|------|------|
| 最大高度 | 70vh |
| 顶部圆角 | 20px (40rpx) |
| Handle | 36×4px 圆角2px，边框色 |
| 标题 | 16px 加粗 |
| 关闭按钮 | 28×28px 圆形灰底 |

**课包选项**：
- 间距 8px，圆角12px，1.5px边框
- 选中态：主色边框+主色浅底
- 图标 42×42px 圆角10px
- Radio 20×20px 圆形，选中主色填充+白色勾

**自定义课包**：
- 2px 虚线边框，居中文字
- 展开后：名称+课时+有效期+金额输入，确认按钮

### 8.4 步进器 (StepperInput)

| 属性 | 规格 |
|------|------|
| 整体 | flex行，灰底+1.5px边框，圆角10px |
| 按钮 | 36×36px，透明底，主色文字 |
| 输入框 | 居中，16px加粗 |
| 单位 | 右侧11px灰色 |
| 聚焦 | 边框主色+白底 |

### 8.5 赠送课时 (GiftHoursInput)

| 属性 | 规格 |
|------|------|
| 输入框宽度 | 140px (280rpx) |
| 输入框高度 | 34px (68rpx) |
| 快捷标签 | 0/+1/+2/+4，圆角16px |
| 选中标签 | 成功色边框+成功色填充+白字 |
| 提示条 | 成功色背景，12px，圆角8px |
| 提示内容 | "赠送 X 课时，合计到账 Y 课时" |

### 8.6 底部按钮 (SubmitButton)

| 属性 | 规格 |
|------|------|
| 圆角 | 24px (48rpx) |
| 高度 | 48px (96rpx) |
| 背景 | `linear-gradient(135deg, #5EC8A8, #4AB893)` |
| 文字 | 16px 加粗白色 |
| 副文字 | 12px 白色85%透明度 |
| 禁用态 | 边框色背景，not-allowed |
| 按下 | scale(0.97)，0.15s |
| 底栏 | 白底+顶部阴影，底部安全区 |

---

## 九、状态流转

### 9.1 页面状态

```
初始态 → 选中学员 → 选中课包 → 填写信息 → 可提交
  │          │           │           │
  │          │           │           └─ 必填完成：底部按钮可用
  │          │           └─ 模板：隐藏课包信息 / 自定义：显示编辑
  │          └─ 显示学生卡片+统计
  └─ 底部按钮禁用
```

### 9.2 课包选择状态

```
未选择 → 选择模板 → 已选摘要(模板)
  │                    │
  │                    └─ 课包信息隐藏，金额自动填充
  │
  └→ 选择自定义 → 已选摘要(自定义) → 课包信息编辑
                                          │
                                          └─ 手动输入课时/有效期/金额
```

### 9.3 赠送课时状态

```
gift_hours = 0 → 隐藏提示
gift_hours > 0 → 显示提示："赠送 X 课时，合计到账 Y 课时"
                  Y = total_hours + gift_hours
```

### 9.4 分期付款状态

```
金额为空 → 分期开关禁用
金额已填 → 可开启分期
  │
  ├─ 关闭 → 隐藏分期面板
  └─ 开启 → 显示分期面板
              │
              ├─ 选择期数 → 自动均分金额
              ├─ 修改某期金额 → 实时计算剩余
              └─ 剩余≠0 → 红色/绿色提示
```
