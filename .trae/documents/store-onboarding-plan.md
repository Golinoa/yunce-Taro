# 个人信息页「店铺管理」配置引导实现计划

## 上下文

在教师角色的个人中心页（`src/pages/profile/index.tsx`），「店铺管理」模块目前直接以 8 宫格（`ProfileGrid`）形式展示 8 个入口。产品希望为新用户增加一个配置引导态：在 6 项基础配置（门店、场地、员工、课程、卡种、薪资）未全部完成前，显示进度条、步骤角标和「配置进度 X/6」文案；全部完成后自动隐藏引导元素，恢复为简洁的 8 宫格。

## 需求理解

* **触发页面**：个人中心 → 教师视图 → 店铺管理区域。

* **引导对象**：仅教师/校长角色可见；家长视图不受影响。

* **6 个配置步骤**：

  1. 门店管理
  2. 场地管理
  3. 员工管理
  4. 课程管理
  5. 卡种管理
  6. 薪资管理

* **两种展示态**：

  * 引导态：显示标题、进度条、「配置进度 X/6」、8 个入口网格，前 6 个入口根据完成度显示绿色对勾或橙色序号角标。

  * 正常态：与现有 `ProfileGrid` 一致，仅显示 8 个入口图标与文字，无进度相关元素。

* **切换条件**：当且仅当 6 个步骤全部完成时，从引导态切换为正常态；切换后再次进入页面不再显示引导元素（除非后端状态回退）。

## 推荐的实现方案

### 1. 文件结构与新增/修改清单

#### 新增文件

| 文件路径                                               | 说明                                   |
| -------------------------------------------------- | ------------------------------------ |
| `src/types/onboarding.ts`                          | onboarding 步骤 key、步骤项、进度数据类型定义       |
| `src/data/onboarding.ts`                           | Mock 数据层：基于 mock-database 计算 6 步完成状态 |
| `src/services/onboarding.ts`                       | Service 层统一出口，遵循 `USE_MOCK` 开关       |
| `src/components/profile/StoreOnboarding/index.tsx` | 店铺管理引导态卡片组件                          |
| `src/components/profile/StoreOnboarding/types.ts`  | 组件 Props 类型                          |

#### 修改文件

| 文件路径                          | 说明                         |
| ----------------------------- | -------------------------- |
| `src/services/index.ts`       | 导出 `onboardingService`     |
| `src/pages/profile/index.tsx` | 根据完成度条件渲染引导态或正常态           |
| `uno.config.ts`               | 补充橙色进度条相关原子类（若现有 token 不足） |

### 2. 类型定义（`src/types/onboarding.ts`）

```typescript
import type { IconName } from '@/components/Icon';

export type StoreOnboardingStepKey =
  | 'campus'
  | 'venue'
  | 'staff'
  | 'course'
  | 'package'
  | 'salary';

export interface StoreOnboardingStep {
  key: StoreOnboardingStepKey;
  label: string;
  icon: IconName;
  route: string;
  completed: boolean;
}

export interface StoreOnboardingProgress {
  total: number;
  completed: number;
  steps: StoreOnboardingStep[];
}
```

### 3. 各步骤「完成」判定规则

| 步骤   | key       | 判定规则                                                   | 依赖数据                                                |
| ---- | --------- | ------------------------------------------------------ | --------------------------------------------------- |
| 门店管理 | `campus`  | 当前身份可访问的校区列表非空                                         | `campusService.getList()`                           |
| 场地管理 | `venue`   | 当前校区下至少存在 1 个有效场地/教室                                   | 建议新增 `venueService`；mock 阶段先用 `SCHEDULES.room` 去重兜底 |
| 员工管理 | `staff`   | 当前机构/校区下 `TEACHERS` 中 `status === 'active'` 数量 ≥ 1     | `teacherService.getList()`                          |
| 课程管理 | `course`  | 当前机构/校区下 `CLASSES` 中 `status === 'active'` 数量 ≥ 1      | `classService.getList()`                            |
| 卡种管理 | `package` | 当前机构下 `COURSE_PACKAGES` 中 `status === 'active'` 数量 ≥ 1 | `packageService.getList()`                          |
| 薪资管理 | `salary`  | 当前机构下至少存在 1 条薪资模板                                      | `salaryModelCampusService.getList()`                |

**说明**：

* mock 阶段优先复用现有 Service，不直接引用 `mock-database`。

* 多校区身份需按 `currentIdentity.campusIds` 过滤门店、场地、员工、课程、卡种。

* 场地管理建议预先约定独立接口契约，mock 用 `SCHEDULES.room` 兜底，联调时替换为真实 venue 接口，Service 层返回值类型不变。

### 4. Service 与 Mock 设计

#### `src/services/onboarding.ts`

```typescript
/**
 * Onboarding Service — 店铺配置引导
 */
import { mockGetStoreProgress } from '@/data/onboarding';
import type { StoreOnboardingProgress } from '@/types/onboarding';

export const onboardingService = {
  getStoreProgress: (): Promise<StoreOnboardingProgress> => mockGetStoreProgress(),
  // 联调时替换为:
  // getStoreProgress: () => get<StoreOnboardingProgress>('/api/onboarding/store-progress'),
};
```

#### `src/data/onboarding.ts`

核心逻辑：

1. 引入现有 mock 数据（通过现有 Service 或 mock-database）。
2. 按当前机构/校区过滤。
3. 计算 6 个布尔值。
4. 组装 `StoreOnboardingProgress`。

注意：`mockSalaryModels` 未在 `src/data/campus.ts` 中导出，应通过 `salaryModelCampusService.getList()` 获取。

### 5. 组件设计（`src/components/profile/StoreOnboarding`）

* **Props**：

  * `data: StoreOnboardingProgress` — 进度数据。

  * `loading?: boolean` — 加载态。

  * `onStepClick: (step: StoreOnboardingStep) => void` — 步骤点击回调。

  * `className?: string` — 额外类名。

* **渲染内容**：

  * 标题行：左侧「店铺管理」，右侧「配置进度 X/6」。

  * 橙色进度条：`completed / total` 宽度比例。

  * 8 个入口网格（4 列 × 2 行），前 6 个步骤显示角标：

    * 已完成：右上角绿色圆形对勾。

    * 未完成：右上角橙色圆形序号（1-6）。

  * 后 2 个入口（学员信箱、促销工具）无角标。

* **样式**：全部使用 UnoCSS，图标颜色统一使用现有 `#ffa06c`，进度条使用橙色主题 token。

### 6. 页面集成（`src/pages/profile/index.tsx`）

1. 引入 `StoreOnboarding`、`onboardingService` 和相关类型。
2. 新增状态：

   * `storeProgress: StoreOnboardingProgress | null`

   * `loadingStoreProgress: boolean`
3. 在 `useDidShow` 和 `useEffect` 中调用 `loadStoreProgress`（仅教师角色）。
4. 步骤点击：有路由则 `Taro.navigateTo`，无路由则 `handlePlaceholder`。
5. 条件渲染：

   * `storeProgress && storeProgress.completed < storeProgress.total` → 渲染 `StoreOnboarding`

   * 否则 → 渲染原有 `ProfileGrid`
6. 请求失败时降级为渲染原有 `ProfileGrid`，避免阻断用户操作。

### 7. 样式要点

* 进度条宽度不通过内联 `style` 动态设置，而是根据 `completed/total` 映射到预设宽度类（如 `w-0`、`w-1/6`、…、`w-full`），避免违反「禁止内联 style」规则。

* 新增/复用 UnoCSS 工具类：

  * `bg-progress-orange`：橙色进度条填充色。

  * `bg-progress-orange-track`：进度条轨道色。

  * `text-profile-orange`：已存在，用于「配置进度 X/6」文字。

  * `bg-profile-orange-solid`：已存在，用于未完成步骤序号角标。

  * `bg-success` + `text-white`：已完成对勾角标。

## 业务边界情况与处理策略

| 编号 | 边界情况              | 处理策略                                                                             |
| -- | ----------------- | -------------------------------------------------------------------------------- |
| 1  | **角色隔离**          | 仅在 `isTeacher` 为 true 时加载和渲染引导组件；家长视图保持原样。                                       |
| 2  | **多校区权限过滤**       | 计算完成状态时按 `currentIdentity.organizationId` 与 `campusIds` 过滤，避免统计不可见校区。            |
| 3  | **加载态**           | 组件支持 `loading` 属性，加载中可显示骨架或占位，避免白屏闪烁。                                            |
| 4  | **请求失败降级**        | 若 `onboardingService.getStoreProgress()` 抛出异常，降级为直接显示原有 8 宫格，不阻断用户。              |
| 5  | **全部完成后隐藏**       | 当 `completed === total` 时条件渲染回退到 `ProfileGrid`；返回页面时通过 `useDidShow` 重新拉取，保证状态最新。 |
| 6  | **部分步骤页面未开发**     | 场地管理等暂无独立页面时，`route` 可临时指向占位页或复用已有页面；点击时给出「功能开发中」提示。                             |
| 7  | **场地数据缺失**        | mock 阶段无独立 venue 表，先用 `SCHEDULES.room` 去重兜底；需文档说明并在联调时切换为真实接口。                   |
| 8  | **mock / 真实接口切换** | `onboardingService` 遵循 `USE_MOCK` 开关，确保生产模式下一行切换。                                |
| 9  | **状态回退**          | 若后端允许状态回退（如删除所有校区后），完成数会减少，引导态会重新出现；组件按当前数据重新渲染。                                 |
| 10 | **缓存一致性**         | 不在本地长期缓存完成状态，每次 `useDidShow` 重新拉取，保证从配置页返回后状态及时更新。                               |
| 11 | **图标与入口一致性**      | onboarding 的 6 个步骤图标、名称、跳转需与 `teacherStoreItems` 前 6 项保持一致，避免用户认知冲突。             |
| 12 | **空机构/未登录**       | 在未获取到 `currentIdentity` 时不发起请求，避免无效调用。                                           |

## 验证 Checklist

### 功能验证

* [ ] 教师角色进入个人中心，未完成 6 步时显示引导态卡片。

* [ ] 家长角色不显示引导态，也不触发相关请求。

* [ ] 6 步全部完成后，「店铺管理」区域恢复为正常 8 宫格。

* [ ] 已完成步骤显示绿色对勾角标，未完成步骤显示橙色序号角标。

* [ ] 点击每个步骤能正确跳转或给出占位提示。

* [ ] 从配置页返回后，进度自动重新计算。

### 数据验证

* [ ] `onboardingService.getStoreProgress()` 在 Mock 模式下返回正确进度。

* [ ] 联调切换为真实接口后，类型保持一致。

* [ ] 多校区身份下，统计按 `campusIds` 过滤。

### 工程化验证

* [ ] 新增组件有 JSDoc 使用场景说明。

* [ ] Props 接口已导出，无隐式 `any`。

* [ ] 未使用内联 `style`。

* [ ] 未新增 SCSS 文件。

* [ ] 未直接引用 `@/data/`，仅通过 `@/services` 取数。

* [ ] `npm run lint` 无 error。

* [ ] `npm run typecheck` 通过。

* [ ] `$env:VITE_USE_MOCK="true"; npm run build:weapp` 编译成功。

## 关键待确认项

1. **UI 布局确认**：图一展示的是「8 宫格 + 进度条/角标」还是「独立的 6 步序列 + 8 宫格」？本计划按「8 宫格 + 进度条/角标」理解，若产品与图一实际不符，可调整为独立 6 步序列组件。
2. **场地管理判定来源**：是否已有独立的场地/教室表？如无，mock 阶段使用 `SCHEDULES.room` 兜底是否可接受？
3. **是否需要本地持久化**：是否需要在本地缓存「已完成」状态，避免每次进入个人中心都闪烁引导态？建议不缓存，通过 `useDidShow` 实时拉取。

