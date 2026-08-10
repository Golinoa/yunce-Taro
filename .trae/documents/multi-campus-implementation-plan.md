# 多校区（单机构 + 多校区）支持实现计划

## 一、背景与目标

竞品小程序只做了单门店的「门店详情 / 店铺管理」，没有真正按校区隔离课表、班级、场地等数据。本项目已有校区设置、角色权限矩阵和 mock 数据中的 `campusId` 字段，但业务页面尚未按校区过滤，也缺少场地/教室管理。

本计划的目标是在 **不破坏现有功能** 的前提下，把「校区」做成全局数据维度，落地：
1. 全局校区状态与切换组件。
2. 班级、排课、学员、教师、场地按校区隔离。
3. 教师跨校区上课开关（默认关闭）。
4. 家长端按孩子所在校区自动聚合，不手动切换。
5. 场地 / 教室管理页面。
6. 为约课页顶部校区切换预留数据能力（UI 后续由产品补充设计）。

## 二、已确认的产品决策

- **模型**：单机构 + 多校区。
- **教师跨校区**：可开关，默认关闭；关闭时教师只绑定一个校区，开启时可绑定多个校区。
- **家长端**：不手动切换校区，按孩子所在校区自动聚合展示。
- **场地管理**：按校区隔离，一个校区下可维护多个场地，每个场地下可维护多个教室。
- **约课页顶部校区切换**：本期只预留数据能力，不改动 UI。
- **实施优先级**：全局校区状态 → 校区切换组件 → 业务数据按校区过滤 → 场地管理 → 表单层校区字段。

## 三、数据模型变更

### 3.1 新增场地 / 教室模型（`src/types/campus.ts`）

```ts
export interface Venue {
  id: string;
  campusId: string;
  name: string;
  address?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  venueId: string;
  campusId: string;
  name: string;
  capacity?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface VenueFormData {
  name: string;
  address?: string;
  status: 'active' | 'inactive';
}

export interface RoomFormData {
  venueId: string;
  name: string;
  capacity?: number;
  status: 'active' | 'inactive';
}
```

### 3.2 补齐业务数据 `campusId`

| 类型 | 变更 | 说明 |
|---|---|---|
| `Student` | 新增 `campus_id?: string` | 学员归属校区 |
| `TeacherUIModel` | 新增 `campusIds: string[]`、`canCrossCampus: boolean` | 教师校区绑定与跨校区开关 |
| `Schedule` | 新增 `campus_id?: string` | 排课继承班级校区 |
| `LessonRecord` | 新增 `campus_id?: string` | 消课记录归属校区 |

`Class` / `ClassBookingSlot` 已含 `campus_id`，无需新增。

### 3.3 Mock 数据

- `src/data/mock-database.ts` 新增 `VENUES`、`ROOMS` 常量，覆盖已有 3 个校区。
- `src/data/teacher.ts` 的 mock 数据把单 `campus` 字段升级为 `campusIds` + `canCrossCampus`。

## 四、Store 变更：`src/stores/campus.ts`

新增状态与方法：

```ts
interface CampusState {
  currentCampusId: string;
  allowedCampusIds: string[];
  setCurrentCampusId: (id: string) => void;
  initCurrentCampus: (identityCampusIds?: string[]) => void;
  setAllowedCampusIds: (ids: string[]) => void;
  // ... 原有字段
}
```

行为：
- `currentCampusId` 持久化到 `Taro.setStorageSync('yunce_current_campus_id')`。
- `fetchCampuses` 完成后，若 `currentCampusId` 为空，自动设置为主校区。
- `allowedCampusIds` 在登录后由 `AuthProvider` 根据当前身份写入：
  - `admin` / `principal`：全部校区。
  - `teacher` / `assistant`：`currentIdentity.campusIds`。
  - `parent`：不写入（家长不手动切换）。

## 五、Service 层变更

### 5.1 班级 / 排课 / 学员 / 消课（`src/services/student.ts`）

为以下方法追加可选 `campusId` 参数，mock 模式在 `src/data/students.ts` 的过滤函数中追加校区过滤：

| Service | 方法签名 |
|---|---|
| `studentService` | `getByTeacher(teacherId, campusId?)` |
| `classService` | `getByTeacher(teacherId, campusId?)` |
| `scheduleService` | `getByTeacher(teacherId, campusId?)` |
| `lessonRecordService` | `getByTeacher(teacherId, campusId?)` |

非 mock 模式在 URL 追加 `&campusId=xxx`；`campusId === 'all'` 时表示管理员查看全部校区汇总。

### 5.2 教师（`src/services/teacher.ts`）

```ts
getList(campusId?: string): Promise<TeacherUIModel[]>
getActiveList(campusId?: string): Promise<TeacherUIModel[]>
```

mock 数据按 `Teacher.campusIds` 包含关系过滤。

### 5.3 场地 / 教室（新增 `src/services/venue.ts` + `src/data/venue.ts`）

```ts
export const venueService = {
  getList: (campusId?: string) => Promise<Venue[]>,
  getById: (id: string) => Promise<Venue | null>,
  create: (data: VenueFormData) => Promise<Venue>,
  update: (id: string, data: Partial<VenueFormData>) => Promise<Venue | null>,
  remove: (id: string) => Promise<boolean>,
};

export const roomService = {
  getList: (campusId?: string, venueId?: string) => Promise<Room[]>,
  getById: (id: string) => Promise<Room | null>,
  create: (data: RoomFormData) => Promise<Room>,
  update: (id: string, data: Partial<RoomFormData>) => Promise<Room | null>,
  remove: (id: string) => Promise<boolean>,
};
```

### 5.4 统计（`src/services/statistics.ts`）

所有 KPI / 趋势 / 排行方法追加可选 `campusId`，mock 计算按 `STUDENTS.campusId` / `LESSON_RECORDS.campusId` 过滤。

## 六、可复用 UI 组件

### 6.1 `src/components/campus/CampusSwitcher/index.tsx`

- 基于 `BottomSheet`，高度 `70vh`。
- Props：`visible`、`currentCampusId`、`options`、`onSelect`、`onClose`。
- 选项用 `allowedCampusIds` 过滤；当前选中项高亮。
- 家长角色不渲染触发按钮。

### 6.2 `src/components/campus/CampusTrigger/index.tsx`

- 顶部胶囊按钮：显示当前校区名 + 下拉箭头。
- 点击打开 `CampusSwitcher`。

### 6.3 主包显式引用

在 `src/app.tsx` 中增加：

```ts
import '@/components/campus/CampusSwitcher';
import '@/components/campus/CampusTrigger';
```

避免跨分包共享模块被 Taro 提取到 `sub-common/`。

## 七、场地 / 教室管理页面

### 7.1 新增页面

| 页面 | 路径 | 说明 |
|---|---|---|
| 场地列表 | `src/package-settings/pages/venue-list/index.tsx` | 按校区展示场地卡片及教室数量 |
| 场地表单 | `src/package-settings/pages/venue-form/index.tsx` | 新增 / 编辑场地 |
| 教室表单 | `src/package-settings/pages/room-form/index.tsx` | 新增 / 编辑教室，归属某场地 |

### 7.2 入口

- `src/app.config.ts` 的 `package-settings` 分包注册上述页面。
- `src/package-settings/pages/campus-settings/index.tsx` 的 `CAMPUS_ITEMS` 新增「场地 / 教室管理」入口。
- `src/data/onboarding.ts` 的 `venue` 步骤 route 改为 `/package-settings/pages/venue-list/index`。

### 7.3 实现要点

- 顶部使用 `CampusTrigger` + `CampusSwitcher` 切换校区。
- 列表使用 `Card` / 已有卡片组件，无新增 SCSS。
- 表单使用 `FormInput`，删除 / 停用使用 `ConfirmDialog`。

## 八、表单层校区字段更新

### 8.1 班级表单（`src/package-course/pages/class-form/index.tsx`）

- 校区选项用 `allowedCampusIds` 过滤。
- 新建时默认值取 `useCampusStore.currentCampusId`。
- 教师单校区时禁用校区选择。

### 8.2 学员表单（`src/package-student/pages/student-form/index.tsx`）

- 新增「所属校区」字段，使用 `PickerSheet` 单选。
- 默认 `currentCampusId`。
- 保存时把 `campus_id` 写入 service。

### 8.3 排课 / 课节表单

- `src/package-course/pages/schedule-form/index.tsx`
- `src/package-course/pages/lesson-form/index.tsx`
- `src/package-course/pages/lesson-edit/index.tsx`

教室选择器选项从 `roomService.getList(currentCampusId)` 获取，替换硬编码 `ROOM_OPTIONS`。创建排课时 `campus_id` 继承班级 `campus_id`。

### 8.4 教师表单（新增 / 编辑教师）

- 在 `src/components/teacher/EditTeacherSheet/index.tsx` 或教师表单页新增：
  - 开关「允许跨校区上课」，默认关闭。
  - 校区选择：关闭时单选，开启时多选。
- 教师列表 / 详情展示校区标签，多校区时显示「中心校区等 2 个校区」。

## 九、业务页面按校区过滤

### 9.1 首页（`src/pages/home/index.tsx`）

- 把现有内联校区选择替换为 `CampusTrigger + CampusSwitcher`。
- `loadData` 中按 `currentCampusId` 过滤今日课表、待办、最近消课。

### 9.2 排课页（`src/pages/schedule/index.tsx`）

- 头部下方渲染 `CampusTrigger`（仅机构端角色）。
- `loadBaseData` 中：

```ts
const campusId = isStaffRole(currentRole) ? currentCampusId : undefined;
const [scheduleList, classList] = await Promise.all([
  scheduleService.getByTeacher(currentUserId, campusId),
  classService.getByTeacher(currentUserId, campusId),
]);
```

### 9.3 预约页（`src/pages/booking/index.tsx`）

- 本期 **不显示校区切换 UI**。
- `loadSchedules` 内部使用 `currentCampusId` 过滤，为后续顶部校区切换预留能力。

### 9.4 统计页（`src/pages/statistics/index.tsx` / `useStatistics.ts`）

- 教师端加入 `CampusTrigger`。
- 按 `currentCampusId` 拉取学员、消课记录、KPI。
- 家长端不显示切换，按孩子所在校区自动聚合。

### 9.5 班级列表（`src/package-course/pages/classes/index.tsx`）

- 加入 `CampusTrigger`。
- `classService.getByTeacher(teacherId, currentCampusId)`。

## 十、应用配置更新

`src/app.config.ts` 的 `package-settings` 分包追加：

```ts
'pages/venue-list/index',
'pages/venue-form/index',
'pages/room-form/index',
```

各页面 `definePageConfig`：
- 场地列表页标题「场地管理」。
- 其他页面保持原生导航栏；如需沉浸式校区切换，后续可启用 `navigationStyle: 'custom'`。

## 十一、实施阶段建议

按风险从低到高、依赖从底层到上层执行：

1. **数据层**：新增 Room/Venue 类型、mock 数据；给 Schedule/LessonRecord/Student/TeacherUIModel 补 `campusId`。
2. **Store 层**：扩展 `useCampusStore` 的 `currentCampusId` / `allowedCampusIds`。
3. **Service 层**：给 class / schedule / student / teacher / statistics 方法加 `campusId` 参数；新增 `venueService` / `roomService`。
4. **组件层**：实现 `CampusSwitcher` / `CampusTrigger`；在 `app.tsx` 显式引用。
5. **场地管理页面**：venue-list / venue-form / room-form。
6. **表单层**：class-form / student-form / schedule-form / lesson-form / lesson-edit 接入校区与教室选择。
7. **教师表单**：跨校区开关 + 校区绑定。
8. **页面层**：home / schedule / statistics / classes 接入校区切换与过滤。
9. **联调与验证**：typecheck、lint、mock 编译、真机/模拟器验证。

## 十二、验证清单

### 12.1 静态检查

```powershell
npm run typecheck
npm run lint
npm run format:check
```

### 12.2 Mock 编译

```powershell
Remove-Item -Recurse -Force dist
$env:VITE_USE_MOCK="true"; npm run build:weapp
```

### 12.3 运行时验证

- [ ] 管理员 / 校长登录后，`CampusTrigger` 显示全部校区；切换后首页、课表、统计数据按校区刷新。
- [ ] 教师登录后只显示其 `campusIds` 内的校区；单校区教师无切换入口。
- [ ] 家长端不显示校区切换，课表 / 约课 / 课时记录按孩子所在校区自动聚合。
- [ ] 班级表单新建时默认当前校区，教师单校区时不可修改。
- [ ] 学员表单可正确选择校区并保存。
- [ ] 排课 / 课节表单的教室下拉选项随当前校区变化，不再使用硬编码列表。
- [ ] 场地列表、场地表单、教室表单按校区隔离，CRUD 正常。
- [ ] 教师表单中跨校区开关控制单选 / 多选，保存后教师列表展示正确。
- [ ] 切换校区后重新进入分包页面无 `module not defined` 错误。
- [ ] 无新增 SCSS 文件、无内联 style、全部使用 UnoCSS Token。

## 十三、关键文件

- `src/stores/campus.ts`
- `src/services/student.ts`
- `src/services/teacher.ts`
- `src/services/statistics.ts`
- `src/services/venue.ts`（新增）
- `src/data/mock-database.ts`
- `src/data/students.ts`
- `src/data/teacher.ts`
- `src/data/venue.ts`（新增）
- `src/types/campus.ts`
- `src/types/student.ts`
- `src/types/teacher.ts`
- `src/types/schedule.ts`
- `src/components/campus/CampusSwitcher/index.tsx`（新增）
- `src/components/campus/CampusTrigger/index.tsx`（新增）
- `src/package-settings/pages/venue-list/index.tsx`（新增）
- `src/package-settings/pages/venue-form/index.tsx`（新增）
- `src/package-settings/pages/room-form/index.tsx`（新增）
- `src/pages/home/index.tsx`
- `src/pages/schedule/index.tsx`
- `src/pages/statistics/index.tsx`
- `src/pages/booking/index.tsx`
- `src/package-course/pages/classes/index.tsx`
- `src/package-course/pages/class-form/index.tsx`
- `src/package-course/pages/schedule-form/index.tsx`
- `src/package-course/pages/lesson-form/index.tsx`
- `src/package-course/pages/lesson-edit/index.tsx`
- `src/package-student/pages/student-form/index.tsx`
- `src/app.config.ts`
- `src/app.tsx`
