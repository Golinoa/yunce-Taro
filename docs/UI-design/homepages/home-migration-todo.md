# 首页迁移 TODO 清单

> 生成时间：2026-06-20
> 最后更新：2026-06-20
> 设计稿：`docs/UI-design/homepages/`
> 迁移规范：`docs/UI-design/homepages/migration-spec.md`
> 目标页面：`src/pages/home/index.tsx`

---

## 迁移进度总览

| Phase | 描述 | 状态 |
|-------|------|------|
| Phase 1 | Mock 接口对齐 | ✅ 已完成 |
| Phase 2 | 样式对齐 | ✅ 已完成 |
| Phase 3 | 组件工程化重构 | ✅ 部分完成 |
| Phase 4 | 功能补全 | ⬜ 待执行 |
| Phase 5 | 清理与验证 | ⬜ 待执行 |

---

## 一、现状分析

### 1.1 页面结构

| 区域 | 组件 | 状态 |
|------|------|------|
| 渐变背景层 | `app.scss` + `SilkRibbonCanvas` | 已实现，需微调 |
| 头部问候语 | 页面内联 | 已实现 |
| 统计概览卡片 | `StatsOverview` | 已实现 |
| 快捷入口 | 页面内联 | 已实现 |
| 今日课表 | `TodayScheduleCard` | 已实现 |
| 最近消课 | `RecentRecordItem` | 已实现 |
| 家长端 | `ChildSelector` + `HourProgress` + 页面内联 | 已实现 |

### 1.2 数据流

```
页面 → homeService (src/services/home.ts) → mock函数 (src/data/home.ts)
```

### 1.3 已有 Mock 接口（src/data/home.ts）

| Mock 函数 | Service 方法 | 页面是否调用 |
|-----------|-------------|-------------|
| `mockGetTeacher` | `getTeacher` | ✅ |
| `mockGetStudents` | `getStudents` | ❌ 未使用 |
| `mockGetTodaySchedules` | `getTodaySchedules` | ✅ |
| `mockGetRecentRecords` | `getRecentRecords` | ✅ |
| `mockGetStudentPackages` | `getStudentPackages` | ❌ 未使用 |
| `mockGetTotalRemainingHours` | `getTotalRemainingHours` | ❌ 未使用 |
| `mockGetUnreadCount` | `getUnreadCount` | ❌ 未使用 |
| `mockGetTodayRecordCount` | `getTodayRecordCount` | ✅ |
| `mockGetStudentsByParent` | `getStudentsByParent` | ✅ |
| `mockGetSchedulesByStudent` | `getSchedulesByStudent` | ✅ |
| `mockGetRecordsByStudent` | `getRecordsByStudent` | ✅ |
| `mockGetPackagesByStudent` | `getPackagesByStudent` | ✅ |

---

## 二、Mock 接口缺失分析

### 2.1 设计稿需要但 Mock 未实现的接口

| # | 接口描述 | 设计稿区域 | 优先级 |
|---|---------|-----------|--------|
| 1 | **统计数据按时段查询** — 当前 `getTodayRecordCount` 只返回今日数量，设计稿 StatsOverview 有 today/week/lastWeek/month 四个时段，需要 `getStatsByPeriod(teacherId, period)` 返回 `{ checkinCount, leaveCount, lessonHours, lessonAmount }` | 统计概览卡片 | **P0** |
| 2 | **校区列表切换** — 头部校区名+切换箭头，需要 `getCampusList()` 或复用 campusStore | 头部区域 | P1（已有 campusStore） |
| 3 | **未读通知数** — `mockGetUnreadCount` 已存在但页面未调用 | 头部区域 | P2 |
| 4 | **学生快速列表** — `mockGetStudents` 已存在但页面未调用，设计稿有"我的学生"横向滚动列表 | 教师端 | P2 |

### 2.2 页面硬编码 Mock 数据问题

| # | 位置 | 问题 | 修复方案 |
|---|------|------|---------|
| 1 | `index.tsx` L130-133 | `statsData` 的 `leaveCount=0, lessonHours=todayCount, lessonAmount=0` 是硬编码计算 | 新增 `mockGetStatsByPeriod` 接口 |
| 2 | `index.tsx` L37-68 | `QUICK_ENTRIES` 配置硬编码在页面内 | 提取到 `src/data/home.ts` 作为常量导出 |
| 3 | `RecentRecordItem` | `formatDateCN` 函数在组件内定义，应使用 dayjs | 统一使用 dayjs 格式化 |

---

## 三、迁移步骤

### Phase 1：Mock 接口对齐（P0，必须先完成）

- [x] **1.1** 新增 `mockGetStatsByPeriod(teacherId, period)` 到 `src/data/home.ts`
  - 返回类型：`{ checkinCount: number; leaveCount: number; lessonHours: number; lessonAmount: number }`
  - 根据 period 参数返回不同的 mock 数据
- [x] **1.2** 在 `src/services/home.ts` 新增 `getStatsByPeriod` 方法
- [x] **1.3** 修改 `StatsOverview` 组件，类型定义从 Service 层统一导出
- [x] **1.4** 修改 `index.tsx`，用 `homeService.getStatsByPeriod` 替换硬编码的 statsData 计算
- [x] **1.5** 提取 `QUICK_ENTRIES` 到 `src/data/home.ts` 作为 `HOME_QUICK_ENTRIES` 常量导出
- [x] **1.6** 页面改为从 `homeService.getQuickEntries()` 获取快捷入口配置

### Phase 2：样式对齐（对齐 migration-spec.md 差异清单）

- [x] **2.1** 修正问候语下边距：`mb-[14rpx]` → `mb-[16rpx]`（8px=16rpx）
- [x] **2.2** 修正问候语字号：`text-[42rpx]` → `text-[48rpx]`（24px=48rpx）
- [x] **2.3** 修正校区字号：`text-[24rpx]` → `text-[28rpx]`（14px=28rpx）
- [x] **2.4** 修正校区间距：`gap-[7rpx]` → `gap-[8rpx]`（4px=8rpx）
- [x] **2.5** 修正 Tab 间距：`gap-[14rpx]` → `gap-[16rpx]`（8px=16rpx）
- [x] **2.6** 修正 Tab 下边距：`mb-[35rpx]` → `mb-[40rpx]`（20px=40rpx）
- [x] **2.7** 修正 Tab 内边距：`py-[10rpx] px-[28rpx]` → `py-[12rpx] px-[32rpx]`（6px 16px）
- [x] **2.8** 修正 Tab 字号：`text-[23rpx]` → `text-[26rpx]`（13px=26rpx）
- [x] **2.9** 修正数字字号：`text-[49rpx]` → `text-[56rpx]`（28px=56rpx）
- [x] **2.10** 修正数字下边距：`mb-[7rpx]` → `mb-[8rpx]`（4px=8rpx）
- [x] **2.11** 修正标签字号：`text-[21rpx]` → `text-[24rpx]`（12px=24rpx）
- [x] **2.12** 修正网格行间距：`gap-y-[35rpx]` → `gap-y-[40rpx]`（20px=40rpx）
- [x] **2.13** 修正网格列间距：`gap-x-[14rpx]` → `gap-x-[16rpx]`（8px=16rpx）
- [x] **2.14** 修正图标-标签间距：`gap-[14rpx]` → `gap-[16rpx]`（8px=16rpx）
- [x] **2.15** 修正图标容器尺寸：`w-[91rpx] h-[91rpx]` → `w-[104rpx] h-[104rpx]`（52px=104rpx）
- [x] **2.16** 修正图标容器圆角：`rounded-[24rpx]` → `rounded-[28rpx]`（14px=28rpx）
- [x] **2.17** 修正标签字号：`text-[23rpx]` → `text-[26rpx]`（13px=26rpx）

### Phase 3：组件工程化重构

- [x] **3.1** `RecentRecordItem` — 使用 dayjs 替换手写 `formatDateCN`
- [ ] **3.2** `StudentQuickList` — 未被首页引用，确认是否需要集成到教师端
- [ ] **3.3** `ScheduleTimeline` — 未被首页引用（已被 `TodayScheduleCard` 替代），评估是否删除
- [ ] **3.4** `StatCard` — 未被首页引用（已被 `StatsOverview` 替代），评估是否删除
- [ ] **3.5** 首页页面组件拆分 — 将教师端/家长端视图拆为独立子组件，减少页面体积

### Phase 4：功能补全

- [ ] **4.1** 校区切换 — 头部校区名+箭头点击弹出校区选择器
- [ ] **4.2** 未读通知数 — 头部显示未读通知红点/数字
- [ ] **4.3** 教师端学生快速列表 — 集成 `StudentQuickList` 或类似横向滚动列表
- [ ] **4.4** 下拉刷新 — 使用 `usePullDownRefresh` 实现数据刷新

### Phase 5：清理与验证

- [ ] **5.1** 删除设计稿中不存在的"最近核销/最近消课"区块（如迁移规范要求）
- [ ] **5.2** 清理未使用的组件导入
- [ ] **5.3** TypeScript 类型检查通过
- [ ] **5.4** ESLint 检查通过
- [ ] **5.5** 真机预览验证

---

## 四、关键决策点

### 4.1 设计稿只有教师端，家长端是否保留？

**迁移规范明确指出**："设计稿中不存在的元素（需删除）— 最近核销/最近消课区块、家长端的所有区块"

但家长端是已上线的核心功能，建议：
- **保留家长端代码**，但标记为"项目自定义扩展"
- 教师端严格对齐设计稿
- 家长端后续单独出设计稿再迁移

### 4.2 统计数据时段切换的 Mock 策略

当前 `StatsOverview` 的 `onPeriodChange` 只切换 UI tab，不触发数据刷新。需要：
- Service 层新增 `getStatsByPeriod` 接口
- 页面在 `period` 变化时重新请求数据
- Mock 层根据不同 period 返回差异化数据

### 4.3 废弃组件处理

| 组件 | 状态 | 建议 |
|------|------|------|
| `StudentQuickList` | 首页未引用 | 保留，Phase 4 集成 |
| `ScheduleTimeline` | 被 `TodayScheduleCard` 替代 | 标记 deprecated，暂不删除 |
| `StatCard` | 被 `StatsOverview` 替代 | 标记 deprecated，暂不删除 |

---

## 五、文件变更预估

| 文件 | 操作 |
|------|------|
| `src/data/home.ts` | 新增 `mockGetStatsByPeriod`，提取 `HOME_QUICK_ENTRIES` |
| `src/services/home.ts` | 新增 `getStatsByPeriod`，`getQuickEntries` |
| `src/pages/home/index.tsx` | 重构数据加载逻辑，移除硬编码 |
| `src/components/home/StatsOverview/index.tsx` | 样式微调 |
| `src/components/home/RecentRecordItem/index.tsx` | dayjs 替换 |
| `src/app.scss` | 可能微调（如已有样式基本对齐） |
