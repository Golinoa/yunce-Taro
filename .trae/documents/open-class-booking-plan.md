# 排课页支持「固定排课」与「开放预约」双模式 - 实现方案

## Summary

在现有排课页内增加「固定排课 / 开放预约」二级切换：
- **固定排课**：保持现有班级课表、点名、消课逻辑不变。
- **开放预约**：仅展示 `schedule_mode === 'open'` 的班级；点击进入「班级时段配置页」，由校区/老师设置可约时段池、最大人数、已约人数、自动开班条件。
- **自动开班**：支持两种触发条件——约满开班、到上课时间自动开班，并可按班级「自己设置」；触发后自动生成当日的 `Schedule` 与对应 `LessonRecord`，老师即可在排课页点名消课。
- 家长端约课 UI 本次不实现，预约人数先在老师配置页通过调整 `current_count` / 模拟预约记录来验证。

## Current State Analysis

| 项 | 现状 |
|---|---|
| 类型定义 | ✅ `src/types/class.ts` 已新增 `ClassScheduleMode`、`ClassBookingSlot`；`Class` 已加 `schedule_mode`、`auto_open_type`、`min_open_count`。 |
| Mock 班级 | ✅ `src/data/mock-database.ts` 已增加 `scheduleMode`、`autoOpenType`、`minOpenCount` 字段；`cls-004`、`cls-005` 已设为 `open`。 |
| 数据文件 | ✅ `src/data/class-booking.ts` 已创建，包含 `CLASS_BOOKING_SLOTS`、`CLASS_BOOKING_RECORDS` 及 CRUD / 自动开班函数。 |
| Service | ✅ `src/services/class-booking.ts` 已创建并导出 `classBookingService`；`src/services/index.ts` 已导出。 |
| 排课页 | ✅ `src/pages/schedule/index.tsx` 已新增 `scheduleSubMode` 二级 Tab 与开放班级列表。 |
| 配置页 | ✅ `src/package-lead/pages/class-slot-config/index.tsx` 已创建，含日期选择、时段配置、自动开班条件、模拟预约、休息切换、保存逻辑；`index.config.ts` 已创建。 |
| 注册 | ⚠️ `app.config.ts` 仍未注册 `class-slot-config`，`app.tsx` 未显式 import。 |
| 代码缺陷 | ⚠️ `class-slot-config/index.tsx` 组件名 `ClassSlotConfigPage` 与默认导出 `ClassSlotConfig` 不一致，会导致编译失败；页面含少量内联 `style`，需迁移为 UnoCSS。 |

## Proposed Changes

### 1. 类型模型扩展

文件：`src/types/class.ts`

- 给 `Class` 增加班级级自动开班配置：
  ```ts
  /** 自动开班条件 */
  auto_open_type?: 'manual' | 'full' | 'time' | 'full_or_time';
  /** 最少预约人数（仅 full/full_or_time 有效），默认等于 max_count */
  min_open_count?: number;
  ```
- 给 `ClassBookingSlot` 增加：
  ```ts
  /** 本时段自动开班条件，未设置时继承班级配置 */
  auto_open_type?: 'manual' | 'full' | 'time' | 'full_or_time';
  /** 已生成的排课 ID，避免重复开班 */
  opened_schedule_id?: string;
  ```

文件：新建 `src/types/class-booking.ts`

- 新增 `ClassBookingRecord`（预约记录）：
  ```ts
  export interface ClassBookingRecord {
    id: string;
    slot_id: string;
    class_id: string;
    student_id: string;
    student_name?: string;
    parent_id?: string;
    status: 'pending' | 'confirmed' | 'cancelled';
    created_at: string;
    updated_at: string;
  }
  ```

### 2. Mock 数据层

文件：修改 `src/data/mock-database.ts`

- `Class` 接口增加 `scheduleMode?: 'fixed' | 'open'`、`autoOpenType?: ...`、`minOpenCount?: number`（保持与现有 snake_case 类型映射的 mock 层一致，Service 层再做 map）。
- 修正 `cls-004` 的 `scheduleMode: 'open'` 字段合法化，并为 `cls-005` 也增加 `scheduleMode: 'open'` 以方便测试。

文件：新建 `src/data/class-booking.ts`

- 导出 `CLASS_BOOKING_SLOTS: ClassBookingSlot[]`：包含 cls-004、cls-005 在未来 7 天的若干时段，部分 `status: 'active'`，部分 `status: 'rest'`，部分 `current_count >= max_count`。
- 导出 `CLASS_BOOKING_RECORDS: ClassBookingRecord[]`：对应已满时段的模拟预约学生。
- 提供 mock CRUD 函数：`mockGetSlotsByClass`、`mockSaveClassDaySlots`、`mockDeleteSlot`、`mockGetRecordsBySlot`、`mockAddBookingRecord`、`mockRemoveBookingRecord`。

### 3. Service 层

文件：新建 `src/services/class-booking.ts`

```ts
export const classBookingService = {
  getSlotsByClass: (classId: string, lessonDate: string) => Promise<ClassBookingSlot[]>;
  saveClassDaySlots: (classId: string, lessonDate: string, slots: Omit<ClassBookingSlot, 'id'>[]) => Promise<ClassBookingSlot[]>;
  deleteSlot: (id: string) => Promise<void>;
  getRecordsBySlot: (slotId: string) => Promise<ClassBookingRecord[]>;
  addBookingRecord: (slotId: string, studentId: string) => Promise<ClassBookingRecord>;
  removeBookingRecord: (recordId: string) => Promise<void>;
  /** 检查并自动开班，返回已开班的 scheduleIds */
  autoOpenSlotsIfNeeded: (classId: string, lessonDate: string) => Promise<string[]>;
};
```

- 所有 mock 函数以 `mock` 前缀命名，受 `USE_MOCK` 统一开关控制。
- `autoOpenSlotsIfNeeded` 逻辑：
  1. 取某班某日所有 `status === 'active'` 且未开班的 slot。
  2. 计算每个 slot 的有效 `auto_open_type`（slot 级 > 班级级）。
  3. 若 `full`/`full_or_time` 且 `current_count >= effectiveMinCount`，或 `time`/`full_or_time` 且当前时间 >= slot.start_time，则创建 Schedule 与 LessonRecord，并回写 `opened_schedule_id`。
  4. 创建 Schedule 时 `day_of_week` 由 `lesson_date` 推导，`class_id` 指向开放班级。
  5. 创建 LessonRecord：从 `CLASS_BOOKING_RECORDS` 取该 slot 的 `confirmed` 记录，为每个学生生成一条 status='normal' 的记录；若无记录，则生成一条 0 人数的占位记录，保证排课页卡片可见。

文件：修改 `src/services/index.ts`

- 导出 `classBookingService`。

### 4. 排课页改造

文件：`src/pages/schedule/index.tsx`

- 新增状态：`const [scheduleSubMode, setScheduleSubMode] = useState<'fixed' | 'open'>('fixed');`
- 在「排课」视图下的头部区域（`ScheduleBookingSwitch` 下方）渲染二级 Tab：
  - 标签：「固定排课」「开放预约」。
  - 样式复用已有胶囊切换风格，使用 UnoCSS Token。
- **固定排课**：保持现有 `renderSwiperItem` + `buildCardsForDate` 逻辑。
- **开放预约**：
  - 日期选择仍用 `CalendarWeekSelector` / Swiper。
  - 列表改为展示 `schedule_mode === 'open'` 的班级卡片。
  - 卡片信息：班级名、老师、科目、当前已约时段数 / 总开放时段数。
  - 点击卡片跳转 `/package-lead/pages/class-slot-config/index?classId=xxx&date=xxx`。
  - 空状态：「当前日期暂无开放预约班级」。
- `loadBaseData` 中仍拉取 `classService.getByTeacher`，用于判断班级 `schedule_mode`。

### 5. 新增班级时段配置页

文件：新建 `src/package-lead/pages/class-slot-config/index.tsx`

UI 参考 `src/package-lead/pages/trial-slot-config/index.tsx`：
- 顶部日期选择（最近 7 天）。
- 班级信息区：班级头像、名称、老师、自动开班条件设置。
- 时段网格：30 分钟间隔（08:00–21:30）。
- 每个时段块显示：时间、`current_count/max_count`、角标（课/休/团/已开班）。
- 点击选中，底部双按钮：
  - 左：选中 1 个且未开班 →「代预约」（模拟增加一名学生预约）；多选不激活。
  - 右：根据选中状态显示「设为休息」「取消休息」。
- 点击「已开班」时段 → 提示「已生成课节，请返回排课页点名」。
- 设置区：
  - 自动开班条件 ActionSheet（手动 / 约满 / 到时间 / 约满或到时间）。
  - 最大可约人数、最少开班人数。
- 保存时调用 `classBookingService.saveClassDaySlots`，成功后调用 `autoOpenSlotsIfNeeded`，并向页面发送刷新信号。

文件：新建 `src/package-lead/pages/class-slot-config/index.config.ts`

```ts
export default definePageConfig({
  navigationStyle: 'custom',
  disableScroll: true,
});
```

### 6. 注册与显式 import

文件：修改 `src/app.config.ts`

- 在 `package-lead` 分包页面列表追加：`'pages/class-slot-config/index'`。

文件：修改 `src/app.tsx`

- 显式 import 该页面组件（空引用即可），避免 Taro 分包 sub-common 提取问题。

### 7. 编译验证

```bash
npm run typecheck
npm run lint
Remove-Item -Recurse -Force dist
$env:VITE_USE_MOCK="true"; npm run build:weapp
```

## Remaining Steps（本次需完成）

基于当前实现状态，剩余工作如下：

### A. 修复 `class-slot-config` 编译与样式问题

文件：`src/package-lead/pages/class-slot-config/index.tsx`

1. **修复默认导出名称**：将 `export default ClassSlotConfig` 改为 `export default ClassSlotConfigPage`，与组件声明一致。
2. **迁移内联 `style` 为 UnoCSS 类名**：
   - 条件阴影：使用 `shadow-[...]` 原子类替代 `style={{ boxShadow: ... }}`。
   - 静态尺寸/定位：使用 UnoCSS 的 `w-[40rpx]`、`h-[40rpx]`、`translate-x-[-50%]` 等替代。
   - 三角形折角：使用 `clip-path` 或已有三角形样式类，避免 `style={{ borderTop/borderLeft }}`。
3. **保持行为不变**：日期选择、时段选中/休息切换、代预约、自动开班条件、保存逻辑均保持不变。

### B. 注册页面与显式 import

文件：`src/app.config.ts`

- 在 `package-lead` 分包页面列表追加 `'pages/class-slot-config/index'`。

文件：`src/app.tsx`

- 显式 import 该页面组件（空引用），与已有跨分包共享模块保持一致，避免 Taro `MiniSplitChunksPlugin` 将相关依赖提取到 `sub-common` 导致运行时错误：
  ```ts
  import '@/package-lead/pages/class-slot-config';
  ```

### C. 编译验证

```bash
npm run typecheck
npm run lint
Remove-Item -Recurse -Force dist
$env:VITE_USE_MOCK="true"; npm run build:weapp
```

## Assumptions & Decisions

1. **不混原则**：一个班级的 `schedule_mode` 在创建时确定，排课页仅按该模式展示；本次不增加切换模式的 UI，仅 mock 数据预设。
2. **家长端延后**：家长约课页面后续独立设计，本次通过老师在配置页调整 `current_count` 和 `ClassBookingRecord` 来验证「约满开班」链路。
3. **自动开班位置**：逻辑放在 `classBookingService.autoOpenSlotsIfNeeded`，在 slot 保存、页面加载时触发；不依赖定时任务。
4. **重复开班防护**：`ClassBookingSlot.opened_schedule_id` 非空即视为已开班，不再重复生成 Schedule。
5. **无真实学生时的占位**：若 slot 没有 booking 记录但到时间自动开班，生成一条 0 人 LessonRecord，保证老师能在排课页看到卡片并补录/点名。
6. **样式规范**：全部使用 UnoCSS 类名与 Token，不新增 SCSS 文件，不内联 style（动态值除外）。

## Verification

1. 打开排课页 → 顶部「排课 / 约课」切换正常。
2. 切换到「排课」，出现二级 Tab「固定排课 / 开放预约」。
3. 「固定排课」下原有班级课表、点名功能正常。
4. 「开放预约」下只展示 `schedule_mode='open'` 的班级（如声乐初级班、童声合唱团）。
5. 点击开放班级进入「班级时段配置页」，可切换日期、设置时段、修改最大人数与自动开班条件。
6. 将某时段 `current_count` 调到 >= `max_count` 并保存，返回排课页后该班级在对应日期生成课节，可点击进入点名。
7. 或将自动开班条件设为「到时间」，等待（或调整系统时间）到 slot 开始时间后，排课页出现对应课节。
8. `npm run typecheck`、`npm run lint`、`VITE_USE_MOCK=true npm run build:weapp` 均通过。
