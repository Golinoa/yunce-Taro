# 第三阶段：首页重构 + TabBar 改造

> 优先级：高
> 前置依赖：第一、二阶段完成
> 涉及全局路由变更，需在功能稳定后执行

---

## TASK-26: TabBar 3→4 改造

### 问题描述

当前 TabBar 为 3 个 Tab（首页/统计/我的），需改为 4 个 Tab（首页/课表/统计/我的），消课流程嵌入课表 Tab。

**当前现状：**

- `app.config.ts` 中 `tabBar.list` 为 3 项
- 无课表 Tab
- 消课入口在首页金刚区

### 实现方案

#### 步骤 1：新增课表页路由和页面

```
src/pages/schedule/
  ├── index.tsx
  └── index.config.ts
```

#### 步骤 2：新增课表 Tab 图标

在 `src/assets/icons/` 中新增课表 Tab 图标（选中/未选中两态）。

#### 步骤 3：修改 app.config.ts

```typescript
tabBar: {
  list: [
    { pagePath: 'pages/home/index', text: '首页', iconPath: '...', selectedIconPath: '...' },
    { pagePath: 'pages/schedule/index', text: '课表', iconPath: '...', selectedIconPath: '...' },
    { pagePath: 'pages/statistics/index', text: '统计', iconPath: '...', selectedIconPath: '...' },
    { pagePath: 'pages/profile/index', text: '我的', iconPath: '...', selectedIconPath: '...' },
  ];
}
```

#### 步骤 4：首页金刚区调整

消课入口从首页金刚区移至课表页，首页金刚区保留：学员管理、班级管理、课包管理、教师管理。

### 涉及文件

| 文件                                 | 操作 | 说明              |
| ------------------------------------ | ---- | ----------------- |
| `src/pages/schedule/index.tsx`       | 新增 | 课表页            |
| `src/pages/schedule/index.config.ts` | 新增 | 页面配置          |
| `src/app.config.ts`                  | 修改 | TabBar 增加课表项 |
| `src/assets/icons/`                  | 新增 | 课表 Tab 图标     |
| `src/pages/home/index.tsx`           | 修改 | 金刚区调整        |

### 验收标准

- [x] TabBar 显示 4 个 Tab：首页/课表/统计/我的
- [x] 课表 Tab 图标正确显示
- [x] 点击课表 Tab 进入课表页
- [ ] 首页金刚区不再包含消课入口 — 用户要求不动首页，此条暂不执行
- [x] 现有 3 个 Tab 功能不受影响

### 依赖

无

---

## TASK-27: 首页重构为方案4（列表信息流式） — ⏭️ 跳过

### 决策说明

经用户确认：**不做方案4重构**。当前 v14 教师首页保留，作为校长/教师首页的基础。教师首页后续全面优化时，再调试各入口的可见权限。

### 原问题描述

当前首页为 v14 方案（渐变头部 + 统计概览 + 金刚区 + Tab），原计划重构为方案4：极简顶栏 + 横向统计胶囊 + 功能列表 + 全宽课程卡。

**当前现状：**

- 渐变头部 + 角色切换
- 统计概览卡片
- 金刚区（8个功能入口）
- 今日课表/待办/最近消课 Tab

### 实现方案

#### 方案4 布局结构

```
┌─────────────────────────┐
│  极简顶栏：问候 + 角色  │
├─────────────────────────┤
│  横向统计胶囊（可滑动）  │
│  [今日消课] [待办] [预警]│
├─────────────────────────┤
│  功能列表                │
│  ┌─────────────────────┐│
│  │ 📋 学员管理  →      ││
│  │ 🏫 班级管理  →      ││
│  │ 📦 课包管理  →      ││
│  │ 👨‍🏫 教师管理  →      ││
│  └─────────────────────┘│
├─────────────────────────┤
│  全宽课程卡（今日课表）  │
│  ┌─────────────────────┐│
│  │ 09:00 钢琴基础班     ││
│  │ 10:30 声乐进阶班     ││
│  │ ...                  ││
│  └─────────────────────┘│
└─────────────────────────┘
```

#### 步骤 1：重构首页组件结构

删除现有首页组件，按方案4重新组织：

```
src/pages/home/
  ├── index.tsx              # 页面主文件
  ├── useHomeData.ts         # 数据 Hook
  └── components/
      ├── HomeHeader.tsx     # 极简顶栏
      ├── StatCapsule.tsx    # 横向统计胶囊
      ├── FunctionList.tsx   # 功能列表
      └── TodaySchedule.tsx  # 今日课程卡
```

#### 步骤 2：实现各子组件

- **HomeHeader**：问候语 + 角色切换入口 + 通知铃铛
- **StatCapsule**：横向滑动胶囊，3-4 个统计指标
- **FunctionList**：4 个功能入口列表项
- **TodaySchedule**：全宽课程卡，展示今日课表

#### 步骤 3：角色差异化

- **教师**：统计胶囊=今日消课/待办/预警；课程卡=今日课表
- **校长**：统计胶囊=今日营收/消课/新增学员/预警；课程卡=今日概览
- **家长**：统计胶囊=孩子课时/待上课/已消课；课程卡=孩子课表

### 涉及文件

| 文件                                          | 操作 | 说明             |
| --------------------------------------------- | ---- | ---------------- |
| `src/pages/home/index.tsx`                    | 重写 | 方案4布局        |
| `src/pages/home/useHomeData.ts`               | 新增 | 数据 Hook        |
| `src/pages/home/components/HomeHeader.tsx`    | 新增 | 极简顶栏         |
| `src/pages/home/components/StatCapsule.tsx`   | 新增 | 统计胶囊         |
| `src/pages/home/components/FunctionList.tsx`  | 新增 | 功能列表         |
| `src/pages/home/components/TodaySchedule.tsx` | 新增 | 今日课程卡       |
| `src/services/home.ts`                        | 修改 | 新增首页统计 API |

### 验收标准

- [ ] 首页按方案4布局：极简顶栏 + 统计胶囊 + 功能列表 + 课程卡
- [ ] 统计胶囊横向可滑动
- [ ] 功能列表包含 4 个入口（学员/班级/课包/教师）
- [ ] 课程卡展示今日课表
- [ ] 教师/校长/家长三种角色差异化展示
- [ ] 所有样式使用 UnoCSS 原子类
- [ ] 无新增 SCSS 文件

### 依赖

- TASK-26（TabBar 改造后首页金刚区需调整）

---

## TASK-28: 课表页实现

### 问题描述

新增课表 Tab 页，提供日/周视图查看课程安排，点击课程可进入消课签到。

### 实现方案

#### 页面结构

```
src/pages/schedule/
  ├── index.tsx
  ├── index.config.ts
  └── components/
      ├── WeekView.tsx        # 周视图
      ├── DayView.tsx         # 日视图
      └── CourseCard.tsx      # 课程卡片
```

#### 功能

1. **视图切换**：日/周视图切换（SegmentedControl）
2. **周视图**：7 天横向滑动，每天纵向展示课程
3. **日视图**：当天课程时间轴
4. **课程卡片**：班级名 + 时间 + 教室 + 学员数
5. **点击课程**：进入消课表单页（预填班级信息）
6. **日期选择**：顶部日期选择器

#### 数据来源

```typescript
// 从 classService 获取教师关联班级
// 按日期筛选课程安排
// 识别已消课/未消课状态
```

### 涉及文件

| 文件                                           | 操作 | 说明                 |
| ---------------------------------------------- | ---- | -------------------- |
| `src/pages/schedule/index.tsx`                 | 新增 | 课表页主文件         |
| `src/pages/schedule/index.config.ts`           | 新增 | 页面配置             |
| `src/pages/schedule/components/WeekView.tsx`   | 新增 | 周视图               |
| `src/pages/schedule/components/DayView.tsx`    | 新增 | 日视图               |
| `src/pages/schedule/components/CourseCard.tsx` | 新增 | 课程卡片             |
| `src/services/class.ts`                        | 修改 | 新增获取课程安排方法 |

### 验收标准

- [ ] 课表页支持日/周视图切换
- [ ] 周视图 7 天横向滑动
- [ ] 日视图时间轴展示
- [ ] 课程卡片显示班级名/时间/教室/学员数
- [ ] 点击课程跳转消课表单（预填班级）
- [ ] 已消课课程标记"已签到"
- [ ] 日期选择器可切换日期

### 依赖

- TASK-26（TabBar 注册课表页路由）

---

## TASK-29: 校长/家长端首页 — ⏭️ 策略调整

### 决策说明

经用户确认，角色首页策略调整如下：

- **校长首页**：当前 v14 教师首页即为校长首页完整版，所有入口可见。
- **教师首页**：基于当前 v14 首页，后续全面优化时再调试各入口的可见权限（如教师管理、校区设置等管理入口对教师隐藏）。
- **家长首页**：家长功能已有基础实现，分散在 `pages/profile/index.tsx`（孩子课时/孩子学习/我的服务）和 `pages/statistics/index.tsx`（家长端 KPI）。后续用户提起时，再在首页做针对性优化。

当前 `pages/home/index.tsx` 中校长/家长角色仍显示"专属首页开发中"占位符，待首页入口权限优化时统一处理。

### 原问题描述

校长和家长端首页当前显示"专属首页开发中"占位符。

### 实现方案

#### 校长首页

```
┌─────────────────────────┐
│  极简顶栏：机构名 + 角色 │
├─────────────────────────┤
│  统计胶囊：              │
│  [今日营收] [消课] [新增] │
├─────────────────────────┤
│  功能列表：              │
│  学员管理 / 班级管理 /   │
│  教师管理 / 校区设置     │
├─────────────────────────┤
│  运营概览卡：            │
│  本月营收 / 出勤率 /     │
│  课时消耗 / 预警         │
└─────────────────────────┘
```

#### 家长首页

```
┌─────────────────────────┐
│  极简顶栏：孩子名 + 角色 │
├─────────────────────────┤
│  统计胶囊：              │
│  [剩余课时] [待上课] [已消]│
├─────────────────────────┤
│  孩子课表：              │
│  今日课程列表            │
├─────────────────────────┤
│  课包概览：              │
│  各课包余额进度条        │
└─────────────────────────┘
```

### 涉及文件

| 文件                                          | 操作 | 说明                      |
| --------------------------------------------- | ---- | ------------------------- |
| `src/pages/home/index.tsx`                    | 修改 | 根据角色渲染不同首页      |
| `src/pages/home/components/PrincipalHome.tsx` | 新增 | 校长首页                  |
| `src/pages/home/components/ParentHome.tsx`    | 新增 | 家长首页                  |
| `src/services/home.ts`                        | 修改 | 新增校长/家长首页数据接口 |

### 验收标准

- [ ] 校长首页展示机构运营概览
- [ ] 家长首页展示孩子课表和课包
- [ ] 三种角色首页差异化展示
- [ ] 删除"专属首页开发中"占位符

### 依赖

- TASK-27（首页重构为方案4结构）

---

## TASK-30: 首页统计 API 定义 — ⏭️ 待后续优化

### 决策说明

由于 TASK-27 已跳过、TASK-29 策略调整，首页统计 API 暂不需要立即定义。待后续首页入口权限优化（教师/校长/家长首页差异化）时，再统一补充 `src/services/home.ts` 和 `src/types/home.ts` 中的统计类型与 mock 数据。

### 原问题描述

首页统计数据接口未定义，当前硬编码。

### 实现方案

在 `src/services/home.ts` 中定义：

```typescript
/** 教师首页统计 */
interface TeacherHomeStats {
  todayLessons: number;
  todayDeductions: number;
  pendingTodos: number;
  warnings: number;
}

/** 校长首页统计 */
interface PrincipalHomeStats {
  todayRevenue: number;
  todayDeductions: number;
  newStudents: number;
  warnings: number;
  monthlyRevenue: number;
  attendanceRate: number;
  hoursConsumed: number;
}

/** 家长首页统计 */
interface ParentHomeStats {
  totalRemaining: number;
  upcomingLessons: number;
  completedLessons: number;
  packages: PackageOverview[];
}
```

### 涉及文件

| 文件                   | 操作 | 说明                     |
| ---------------------- | ---- | ------------------------ |
| `src/services/home.ts` | 修改 | 定义三种角色首页统计接口 |
| `src/types/home.ts`    | 新增 | 首页统计类型定义         |

### 验收标准

- [ ] 三种角色统计类型定义完整
- [ ] Service 方法返回 mock 数据
- [ ] 首页组件从 Service 获取数据

### 依赖

无
