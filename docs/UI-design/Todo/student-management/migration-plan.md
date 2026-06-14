# 学员管理模块迁移计划

> 将 `student-management.html` 原型设计迁移到 Taro 小程序项目

---

## 一、现状分析

### 1.1 现有页面

| 页面 | 文件 | 现状 |
|------|------|------|
| 学员列表 | `pages/students/index.tsx` | 基础列表，无筛选/统计/进度条/课包标签 |
| 学员详情 | `pages/student-detail/index.tsx` | 功能完整但视觉待优化，Tab样式旧版 |

### 1.2 核心差距

| # | 设计稿 | 现有代码 | 差距 |
|---|--------|----------|------|
| 1 | 渐变头部（标题+搜索+统计融入底色） | ❌ 缺失 | 重构头部区域 |
| 2 | 头部内搜索框（半透明白色+毛玻璃） | ✅ 已有搜索框 | 样式需重构为融入头部底色 |
| 3 | 头部内排序按钮（搜索框右侧，半透明图标按钮） | ❌ 缺失 | 新增组件 |
| 4 | 头部内统计摘要（4格半透明卡片） | ❌ 缺失 | 新增组件 |
| 5 | 筛选栏（课时状态+科目双下拉并排，直角风格） | ❌ 缺失 | 新增组件 |
| 6 | 卡片左边框状态色 | ❌ 缺失 | 新增样式 |
| 7 | 卡片内课包标签行 | ❌ 缺失 | 新增展示 |
| 8 | 卡片内课时进度条 | ❌ 缺失 | 新增展示 |
| 9 | 卡片即将过期提示 | ❌ 缺失 | 新增展示 |
| 10 | 卡片欠课徽章+提示条 | ❌ 缺失 | 新增展示 |
| 11 | 课时数字预警色（绿/黄/红/粉） | ❌ 缺失 | 新增逻辑 |
| 12 | 头像渐变色循环分配 | ❌ 缺失 | 新增逻辑 |
| 13 | 详情页Tab栏样式（圆角胶囊） | 旧版下划线 | 重构样式 |
| 14 | 详情页底部三按钮（充值/编辑/删除） | 双按钮 | 新增充值入口 |
| 15 | 课包卡片赠送标签 | ❌ 缺失 | 新增展示 |
| 16 | 记录卡片时间轴样式 | ✅ 已有 | 样式需对齐 |
| 17 | 删除确认弹窗 | ❌ 缺失 | 新增组件 |
| 18 | Toast通知 | ❌ 缺失 | 新增组件 |
| 19 | 搜索清除按钮 | ❌ 缺失 | 新增交互 |
| 20 | 添加学员按钮（头部右上角，半透明胶囊） | ❌ 缺失 | 新增入口 |

---

## 二、页面结构（更新后）

### 2.1 学员列表页

```
┌─────────────────────────────┐
│ 渐变头部 (#5ec8a8 → #7dd8be)│
│  学员管理        [添加学员]  │ ← 标题行
│  🔍 搜索框...        [排序]  │ ← 搜索栏（半透明+毛玻璃）
│  ┌────┐┌────┐┌────┐┌────┐   │ ← 统计摘要（半透明卡片）
│  │ 9  ││ 4  ││ 2  ││ 2  │   │   总学员/充足/不足/欠课
│  │总学员││充足 ││不足 ││欠课 │   │
│  └────┘└────┘└────┘└────┘   │
├─────────────────────────────┤
│ 课时状态 ▼  │  科目 ▼       │ ← 筛选栏（双下拉并排，直角）
├─────────────────────────────┤
│ ┌───────────────────────┐   │
│ │ 头像  姓名  手机号  课时│   │ ← 学生卡片
│ │ 课包标签行             │   │
│ │ 进度条                 │   │
│ └───────────────────────┘   │
│ ┌───────────────────────┐   │
│ │ ...更多卡片            │   │
│ └───────────────────────┘   │
└─────────────────────────────┘
```

### 2.2 学员详情页

```
┌─────────────────────────────┐
│ 渐变头部：头像+姓名+编辑      │
│ 地址/备注                    │
│ 统计三栏                     │
├─────────────────────────────┤
│ 课时记录│课包│请假│家长       │ ← Tab栏（胶囊圆角）
├─────────────────────────────┤
│ Tab内容区                    │
│ - 课时记录：时间轴卡片        │
│ - 课时套餐：进度条卡片        │
│ - 请假记录：状态卡片          │
│ - 家长绑定：邀请码+列表       │
├─────────────────────────────┤
│ [充值]  [编辑]  [删除]       │ ← 底部操作栏
└─────────────────────────────┘
```

---

## 三、样式映射

### 3.1 CSS → UnoCSS 类名

| 设计CSS | UnoCSS 类名 |
|---------|-------------|
| `background: var(--bg)` | `bg-background` |
| `border-radius: 16px` | `rounded-[32rpx]` |
| `box-shadow: var(--shadow)` | `shadow-soft` |
| `background: linear-gradient(135deg, #5ec8a8, #7dd8be)` | `bg-gradient-primary` |
| `background: rgba(255,255,255,0.25)` | `bg-white/25` |
| `backdrop-filter: blur(4px)` | `backdrop-blur-sm` |
| `padding: 16px` | `p-4` |
| `margin-bottom: 12px` | `mb-3` |
| `font-size: 16px; font-weight: 700` | `text-[32rpx] font-bold` |
| `font-size: 12px; color: var(--text-sec)` | `text-[24rpx] text-muted-foreground` |
| `border: 1.5px solid var(--border)` | `border-2 border-input` |
| `border-radius: 24px` | `rounded-[48rpx]` |

### 3.2 Token 映射

| 设计Token | 项目Token |
|-----------|----------|
| `--primary: #5EC8A8` | `--color-primary: #5EC8A8` |
| `--amber: #d4a24e` | `--color-amber: #d4a24e` |
| `--destructive: #D94040` | `--color-destructive: #D94040` |
| `--border: #D5E8E0` | `--color-input: #D5E8E0` |
| `--bg-page: #F5FAF8` | `--color-gradient-subtle` |

---

## 四、分批迁移计划

### P0 - 数据模型扩展（前置依赖）

| 任务 | 文件 | 说明 |
|------|------|------|
| 新增 StudentSort 类型 | `src/types/student.ts` | `'default'\|'hours-desc'\|'hours-asc'\|'name-asc'\|'name-desc'` |
| 新增 StudentFilter 类型 | `src/types/student.ts` | `'all'\|'sufficient'\|'low'\|'expiring'\|'expired'\|'owe'` |
| 新增 SubjectFilter 类型 | `src/types/student.ts` | `'all'\|'piano'\|'vocal'\|'theory'\|'calligraphy'\|'general'` |
| 新增 StudentSummary 类型 | `src/types/student.ts` | 统计摘要数据结构（含 owe 字段） |
| 新增 PackageTag 类型 | `src/types/student.ts` | 课包标签展示数据 |
| 新增 OweInfo 类型 | `src/types/student.ts` | 欠课信息（缺课节数+缺课日期列表） |
| 新增 getStudentSummary | `src/services/student.ts` | 获取统计摘要 |
| 新增 filterStudents | `src/services/student.ts` | 按课时状态+科目组合筛选 |

### P1 - 学员列表页增强

| 任务 | 文件 | 说明 |
|------|------|------|
| **渐变头部区域** | `pages/students/index.tsx` | 标题+添加按钮+搜索框+排序+统计摘要，融入渐变底色 |
| SortSelect 组件 | `components/SortSelect/index.tsx` | 搜索框右侧排序图标按钮，半透明风格，点击展开排序下拉 |
| FilterBar 组件 | `components/FilterBar/index.tsx` | 课时状态+科目双下拉并排筛选栏，直角风格 |
| SummaryBar 组件 | `components/SummaryBar/index.tsx` | 4格半透明统计摘要卡片（融入头部底色） |
| StudentCard 重构 | `components/StudentCard/index.tsx` | 新增课包标签+进度条+预警色+欠课徽章+欠课提示 |
| 头像渐变色逻辑 | `utils/avatar-color.ts` | 按序号分配5组渐变色 |
| 课时预警逻辑 | `utils/hours-status.ts` | 返回 normal/warn/danger/owe |
| 集成筛选+排序 | `pages/students/index.tsx` | 接入FilterBar（双下拉组合筛选）+ SortSelect（排序联动） |

### P2 - 学员详情页优化

| 任务 | 文件 | 说明 |
|------|------|------|
| Tab栏样式重构 | `pages/student-detail/index.tsx` | 胶囊圆角样式替换下划线 |
| 底部操作栏重构 | `pages/student-detail/index.tsx` | 三按钮：充值/编辑/删除 |
| 课包卡片增强 | `pages/student-detail/index.tsx` | 新增赠送标签、共享标签 |
| 记录卡片样式对齐 | `pages/student-detail/index.tsx` | 时间轴+详情区样式 |

### P3 - 交互优化

| 任务 | 文件 | 说明 |
|------|------|------|
| 下拉刷新 | `pages/students/index.tsx` | usePullDownRefresh |
| 卡片点击反馈 | `pages/students/index.tsx` | press-scale 动效 |
| 搜索防抖+清除 | `pages/students/index.tsx` | 300ms 防抖 + 清除按钮 |
| 空状态优化 | `pages/students/index.tsx` | 区分无数据/无搜索结果 |
| 详情页充值跳转 | `pages/student-detail/index.tsx` | 携带学生ID跳转课时充值页 |
| 删除确认弹窗 | `components/DeleteModal/index.tsx` | 二次确认弹窗 |
| Toast通知 | `components/Toast/index.tsx` | 成功/错误提示 |
| 筛选组合联动 | `pages/students/index.tsx` | 课时状态+科目双维度组合筛选 |
| 排序功能集成 | `pages/students/index.tsx` | 接入SortSelect，支持排序+筛选联动 |

---

## 五、组件抽取

### 5.1 新增组件

| 组件 | 路径 | 说明 |
|------|------|------|
| StudentHeader | `components/StudentHeader/index.tsx` | 渐变头部区域：标题+添加按钮+搜索框+排序+统计摘要，融入底色 |
| SortSelect | `components/SortSelect/index.tsx` | 排序下拉框（搜索框右侧图标按钮，半透明风格） |
| FilterBar | `components/FilterBar/index.tsx` | 筛选栏（课时状态+科目双下拉并排，直角风格） |
| SummaryBar | `components/SummaryBar/index.tsx` | 统计摘要栏（半透明卡片，融入头部底色） |
| StudentCard | `components/StudentCard/index.tsx` | 学员卡片（左边框+进度条+过期提示+欠课徽章+欠课提示） |
| PackageCard | `components/PackageCard/index.tsx` | 课包卡片（详情用） |
| RecordCard | `components/RecordCard/index.tsx` | 课时记录卡片（详情用） |
| DeleteModal | `components/DeleteModal/index.tsx` | 删除确认弹窗 |
| Toast | `components/Toast/index.tsx` | 全局Toast通知 |

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| Avatar | 头像展示 |
| Empty | 空状态 |
| PageContainer | 页面容器+安全区 |
| Icon | 图标 |

---

## 六、关键组件规格

### 6.1 StudentHeader（渐变头部）

| 区域 | 规格 |
|------|------|
| 背景 | `linear-gradient(135deg, #5ec8a8, #7dd8be)` |
| 上内边距 | 48px（含状态栏） |
| 标题行 | 标题20px白色加粗 + 添加学员按钮（半透明白色22%+毛玻璃，32px高，圆角16px） |
| 搜索框 | 半透明白色25%+毛玻璃，圆角12px，白色文字/图标，9px 12px内边距 |
| 排序按钮 | 搜索框右侧，36×36px，半透明白色22%+毛玻璃，圆角10px，仅图标 |
| 统计摘要 | 4格半透明卡片（20%+毛玻璃，圆角10px），白色数字16px加粗，标签10px 80%透明度 |
| 警告色数字 | 课时不足：`#ffe082`，欠课：`#ffc1cc` |

### 6.2 FilterBar（筛选栏）

| 属性 | 规格 |
|------|------|
| 布局 | 双下拉等分flex，中间1px #f0f0f0分隔线 |
| 背景 | 白色 |
| 圆角 | 无（直角） |
| 触发器内边距 | 11px 12px |
| 触发器字号 | 13px，font-weight 500 |
| 触发器颜色 | 默认 `--text-sec`，选中 `--primary` + font-weight 600 |
| 箭头图标 | 14×14px，展开时 rotate(180deg) |
| 下拉面板 | 直角顶部，底部圆角12px，阴影 `0 8px 24px rgba(0,0,0,0.12)` |
| 选项内边距 | 10px 12px |
| 选项圆角 | 8px |
| 选项选中态 | `--primary-bg` 背景 + `--primary` 文字 + 加粗 + 勾选图标 |
| 互斥逻辑 | 开一个下拉自动关闭另一个 |
| 点击外部 | 关闭所有下拉 |

**课时状态选项**：all(全部)、sufficient(课时充足)、low(课时不足)、expiring(即将过期)、expired(已过期)、owe(欠课)

**科目选项**：all(全部科目)、piano(钢琴)、vocal(声乐)、theory(乐理)、calligraphy(书法)、general(通用)

**组合筛选**：课时状态与科目可同时生效，取交集

### 6.3 SortSelect（排序下拉）

| 属性 | 规格 |
|------|------|
| 位置 | 搜索框右侧 |
| 触发器 | 36×36px，半透明白色22%+毛玻璃，圆角10px，仅图标 |
| 触发器active | 半透明白色40%，图标白色 |
| 下拉面板 | 右对齐，min-width 140px，圆角12px，白色背景 |
| 选项 | 同通用下拉规格 |

**排序选项**：default(默认排序)、hours-desc(课时从多到少)、hours-asc(课时从少到多)、name-asc(姓名A-Z)、name-desc(姓名Z-A)

### 6.4 StudentCard（学生卡片）

| 属性 | 规格 |
|------|------|
| 背景 | `--bg` |
| 圆角 | 16px |
| 内边距 | 16px |
| 阴影 | `--shadow` |
| 间距 | margin-bottom 12px |
| 左边框 | 3px solid，按状态着色 |
| 头像 | 48×48px 圆形，渐变背景+白色首字 |
| 姓名 | 16px 加粗 |
| 元信息 | 12px，`--text-sec`，点分隔 |
| 课时数字 | 20px 加粗，按状态着色 |
| 课包标签行 | margin-top 10px，gap 6px |
| 进度条 | 4px 高，`--border` 底色 |
| 即将过期提示 | 11px，`--info`，时钟图标+文字 |
| 欠课徽章 | 10px 加粗，`--accent`，圆角4px，`--accent-bg` 背景 |
| 欠课提示条 | 11px，`--accent`，圆角8px，`--accent-bg` 背景 |

**卡片状态与颜色**：

| 状态 | 左边框色 | 课时数字色 | 进度条 |
|------|----------|-----------|--------|
| 正常 (sufficient) | `--primary` | `--primary` | 主色渐变 |
| 课时不足 (low) | `--amber` | `--amber` | 警告渐变 |
| 即将过期 (expiring) | `--info` | `--primary` | 信息渐变 |
| 已过期 (expired) | `--destructive` | `--destructive` | 危险渐变 |
| 欠课 (owe) | `--accent` | `--accent` | 强调渐变 |

---

## 七、注意事项

1. **渐变头部区域**：搜索框、统计摘要均融入头部底色，使用 `rgba(255,255,255,0.25)` + `backdrop-filter: blur(4px)` 实现毛玻璃效果，需注意小程序对 backdrop-filter 的兼容性
2. **筛选栏直角风格**：筛选栏整体无圆角，下拉面板仅底部有圆角（12px），与头部底色直角风格统一
3. **课时预警阈值**：>5 正常、1-5 警告、0 危险，欠课为独立状态，需与后端确认是否需要可配置
4. **筛选逻辑**：`expiring`（即将过期）需定义具体天数（建议30天），`owe`（欠课）需后端提供缺课记录
5. **科目筛选**：科目列表应从后端动态获取，当前硬编码为 piano/vocal/theory/calligraphy/general，后续需改为接口返回
6. **头像渐变色**：5组循环色，需确保色值在项目 theme 中已定义
7. **统计摘要**：需考虑数据实时性，建议随列表一起返回，避免额外请求
8. **详情页充值按钮**：需确认课时充值页路由参数格式（学生ID）
9. **家长视角**：底部操作栏仅显示"家长绑定"按钮，不显示充值/编辑/删除
10. **性能**：列表页学生较多时需考虑虚拟滚动，当前先实现基础版本
11. **搜索**：当前为前端过滤，学生数超过200时需改为后端搜索
12. **下拉刷新**：列表页需支持下拉刷新，详情页可选
13. **欠课数据**：欠课学员的缺课节数和日期列表需后端接口支持，建议在学员列表接口中增加 oweInfo 字段
14. **排序+筛选联动**：排序作用于筛选后的结果集，需确保逻辑正确
15. **添加学员按钮**：位于头部右上角，半透明胶囊样式，点击跳转添加学员页面
