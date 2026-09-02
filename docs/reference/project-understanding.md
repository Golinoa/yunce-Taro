# 云策教务（松果排课）· 项目理解速查

> 目的：快速建立对项目架构、规范、现状的认知，便于后续「按要求开发」。
> 阅读顺序：技术栈 → 目录架构 → 铁律 → 现有模块清单 → 新增功能流水线 → 构建/调试 → 避坑。

---

## 一、这是什么项目

- **产品**：「松果排课」机构端教务 SaaS 小程序（多角色：校长 / 教师 / 家长 / 顾问）。
- **形态**：Taro 4.x 跨端小程序，**当前主力编译目标是微信小程序（`weapp`）**，同时保留 swan/alipay/tt/h5/rn 等脚本。
- **当前状态**：**Mock 驱动**——所有数据来自 `src/data/*` 内存 mock，Service 层用 `mockXxx` 函数实现；联调时只需把 Service 一行改成 `request.ts` 的 API 调用即可。
- **4 个主 Tab**：首页 `pages/home`、课表 `pages/schedule`、数据 `pages/statistics`、我的 `pages/profile`。

## 二、技术栈（锁定，禁止替换）

| 维度 | 规范 | 禁止 |
|------|------|------|
| 框架 | Taro 4.x + **React 18（函数组件 + Hooks）** | class 组件、Vue |
| 语言 | **TypeScript 严格模式** | 隐式 any、`@ts-ignore` |
| 样式 | **UnoCSS 原子类 + rpx 单位**（`presetRemRpx` 自动 baseFontSize=14 / 375 屏宽） | SCSS 文件、内联 style、px/rem |
| 状态 | **Zustand**（全局状态唯一来源） | Redux/MobX、组件内 useState 管全局 |
| 日期 | **dayjs** | moment、硬编码月份/年份 |
| 类名拼接 | **classnames（cn）** | 模板字符串拼 className |
| 路由守卫 | `withRouteGuard`（HOC） | 自行实现 |

## 三、目录架构（src/）

```
src/
├── app.config.ts      # 路由（pages + 6 个 subPackages）+ TabBar + 窗口
├── app.scss           # 唯一保留的全局 SCSS（CSS 变量声明 + keyframes），不可新增其它 scss
├── app.tsx            # 应用入口（仅 import './app.scss'，无业务）
├── theme.ts           # 设计 Token 单一数据源（HSL 色板 + 间距/圆角/字号/阴影 + 多主题）
├── components/
│   ├── <Base>.tsx      # 通用基础组件（扁平）：BottomSheet/FormInput/Card/Icon/Avatar/...
│   └── <module>/       # 业务组件按模块分目录：teacher/ lesson/ home/ schedule/ course/ ...
├── pages/             # 主包页面（kebab-case 目录 + index.tsx + index.config.ts）
├── package-*/         # 分包根目录：package-student / teacher / course / settings / statistics / lead
├── services/          # Service 层（接口契约，当前 mock），统一从 index.ts 导出
├── stores/            # Zustand Store，统一从 index.ts 导出
├── types/             # TS 类型定义，统一从 index.ts 导出
├── data/              # Mock 数据与常量（mockXxx 函数），统一从 index.ts 导出
├── utils/             # 工具：request/auth/route-guard/format/logger/navigation/...
├── constants/         # 业务常量
└── styles/            # 遗留 SCSS（待迁移，禁止新增）
```

**依赖方向（禁止循环）**：`types ← data ← services ← stores ← pages/components`。

## 四、必须刻进肌肉记忆的「铁律」

1. **样式零 SCSS / 零内联硬编码色值**：颜色一律用 Token 类名（`text-primary`/`bg-card`/`border-border`），复杂样式在 `uno.config.ts` 的 `rules`/`shortcuts` 里加。仅 ECharts 等运行时场景可用 `theme.ts` 的 `hexColors`。
2. **单位只有 rpx**：`text-[28rpx]`、`py-[20rpx]`，禁止 px/rem。
3. **先查后写**：新增 UI 前先翻 `components/` 是否已有可复用组件（见下方清单），禁止重复造轮子。
4. **弹窗必须封装为独立 Sheet 组件**，且外层只用 `<BottomSheet visible={x} ...>`，禁止页面内联手写弹窗、禁止 `show + visible` 双 prop。
5. **输入框必须用 `<FormInput>`**，禁止裸 `<Input>`。
6. **页面只 import `@/services`**，禁止直接 import `@/data/*`（Service 是唯一数据出口）。
7. **Mock 数据只放 `src/data/`**，禁止在组件里硬编码 mock。
8. **薪资状态机单向**：`pending→confirmed→sending→teacher_confirmed→archived`，禁止反向。
9. **TS 类型完整**：Props 接口必须 `export`；常量 `UPPER_SNAKE_CASE`；回调 `handle` 前缀；`useCallback/useMemo` 包裹且依赖数组完整；每个组件有 JSDoc（使用场景+功能）。

## 五、现有模块 / 页面清单（按需复用或扩展）

**主包页面**：home / schedule / booking / my-course / venue-booking / index（启动）/ login+3子页 / register+2子页 / role-switch+add / statistics / finance-data / member-data / card-data / salary-data / record-transaction / profile+edit / child-detail / children / notifications / agreement / about / store-entry。

**分包（subPackages）**：
- `package-student`：学员、学员详情/表单、转校、家长绑定、会员卡发卡/详情/编辑、跟进记录。
- `package-teacher`：教师列表/表单/详情、薪资详情/调整/考勤/首页/发放/设置/表单/模板。
- `package-course`：班级、课程、课包、约课规则、消课、排课、批量改期、请假、记录等 23 页（最大分包）。
- `package-settings`：校区设置（子校区/发薪日/节假日/科目/通知/数据）、场馆、系统、主题、反馈、帮助、群发通知。
- `package-statistics`：预警详情。
- `package-lead`：邀约/线索、试听排期、代约、邀请落地页等。

**高频可复用基础组件**（开发前先在 `src/components` 找）：`BottomSheet`、`FormInput`、`FormCell`/`FormRow`、`Card`/`CardHeader`、`PageContainer`、`Icon`、`Avatar`、`ChipPicker`、`SegmentedControl`、`Stepper`、`StarRating`、`Empty`、`Loading`、`ActionButton`、`Dialog`/`ConfirmDialog`、`PickerSheet`/`DatePickerSheet`/`TimePickerSheet`、`SwappableCard`（左滑露出操作）。

**业务组件示例**（按模块）：`teacher/*`（TeacherCard、Add/EditTeacherSheet、DeductionSheet、ConfirmSalarySheet、PayConfirmSheet…）、`lesson/LessonConsumptionList`、`home/*`（CampusCard、KingKongSection、TodayScheduleCard、TodoList）、`schedule/*`、`course/*`、`student/*`、`lead/*`、`profile/*`。

## 六、新增一个功能的标准流水线

> 以「新增业务模块 X」为例，全程遵守分层与导出规范：

1. `types/x.ts` — 定义类型（请求/响应/UI 模型），并 `export` 接口；在 `types/index.ts` 追加导出。
2. `data/x.ts` — 常量 + `mockXxx()` 函数（内存可变数组模拟增删改）。
3. `services/x.ts` — 定义 `xService` 接口契约，调用 `mockXxx`；在 `services/index.ts` 导出。
4. `stores/x.ts`（如需全局态）— Zustand store；在 `stores/index.ts` 导出。选择性订阅避免重渲染。
5. `components/{module}/` — 复用/新建组件（弹窗封装为 Sheet，输入框用 FormInput）。
6. `pages/` 或 `package-*/pages/` — 页面（kebab-case + `index.tsx` + `index.config.ts`），用 `useLoad/useDidShow` 取数，异常在页面层 `Taro.showToast`。
7. `app.config.ts` — 注册路由（分包则加进对应 subPackages）。
8. 若改了 `uno.config.ts` 的 `rules/shortcuts`，确保复用优先。

## 七、构建 / 调试命令（务必用 Mock 模式）

```bash
# 安装依赖
npm install

# 开发（自动开 Mock + 热更新）
npm run dev:weapp          # = build:weapp --watch

# 生产编译（！！必须先删 dist 并强制 Mock，否则网络异常/登录失败）
$env:VITE_USE_MOCK="true"; npm run build:weapp     # PowerShell
# 或 Bash: VITE_USE_MOCK=true npm run build:weapp

# 质量门禁（pre-commit 也会跑）
npm run typecheck          # tsc --noEmit
npm run lint               # eslint src
npm run format:check       # prettier 检查
npm run check              # typecheck + lint + format 全量
```

> 编译铁律：`build:weapp` 是生产模式会自动禁用 Mock，导致 `BASE_URL` 空、请求全失败。**每次改完代码必须删 `dist` 目录 + 用 `VITE_USE_MOCK=true` 重新编译**。

## 八、常见坑（来自真实代码经验）

- **受控 Input 在 PC 端微信小程序会被重置**：`FormInput` 的 `onInput` 必须 `return e.detail.value`（已封装好，业务里用 `onInput={(v)=>setV(v)}` 即可）。
- **小程序 `<Input>` 不能直设 height/line-height**：由外层容器 padding 控制，直接用 `FormInput`。
- **CSS 伪元素不可用**：用 `<View>` 元素替代 `::before/::after`（如 Tab 下划线指示器）。
- **主题切换**：`theme.ts` 含 blue/coral/orange 三套色板 + `applyTheme()`，颜色全部走 CSS 变量（`hsl(var(--primary))`），新增颜色请加 Token 而非硬编码。
- **分包与预下载**：进课表页预下载 `package-lead`（`preloadRule`）——新增跨分包跳转注意体积。
- **安全区**：底部操作栏用 `pb-safe` / `pb-safe-bar`，自定义导航栏用 `pt-nav-safe`。

## 九、一眼看懂的关键文件

| 文件 | 作用 |
|------|------|
| `src/theme.ts` | 所有设计 Token（颜色/间距/圆角/字号/阴影/多主题）唯一来源 |
| `uno.config.ts` | UnoCSS 主题色 + rules（渐变/半圆角/半透明/语义色）+ shortcuts（按钮/标签/表单/Chip） |
| `src/app.config.ts` | 全部路由 + TabBar + 分包 + 预下载 |
| `src/components/FormInput` | 统一输入框（一定要用，别裸 Input） |
| `src/components/BottomSheet` | 所有弹窗底座 |
| `src/services/*` / `src/stores/*` / `src/types/*` | 数据/状态/类型三层，入口均在 index.ts |
| `src/utils/request.ts` | 联调切换点（mock→真实 API） |
| `src/utils/route-guard.tsx` | 登录守卫 HOC |

---
*本文件为项目理解速查，随开发推进可补充具体模块细节。*
