# B13 · 架构级评估：独立分包 + 入口调度页（仅调研，不实施）

> 立项日期：2026-09-16 ｜ 范围：只读调研，不动业务代码、不改分包配置
> 结论速览：**当前不做独立分包**。B12 已腾出空间，平台硬限余量充足；独立分包是大改、回归面覆盖全量页面，收益不抵风险。

## 1. 背景与目标

计划 B13 要求量化评估「把主包瘦身为入口 / 加载调度页、教师端 / 家长端拆成独立分包」的可行性与收益。完成标准：
1. 主包可降到多少；
2. 需解除的共享依赖清单（已知 `@/constants/brand`/`@/components/Card` 跨 7 分包、`@/stores/campus`/`@/components/PageContainer` 跨 6）；
3. 独立分包「自包含」约束下的改造范围与回归面；
4. 与 B12 的方案对比结论。

## 2. 方法

- 扫描前端 `src/**/*.{ts,tsx}` 共 **884 个文件**；
- 识别 7 个分包根：`package-auth` / `package-course` / `package-lead` / `package-settings` / `package-statistics` / `package-student` / `package-teacher`（其余 `pages/`、`src` 根为**主包**）；
- 以 `scripts/verify-shared-modules.mjs` 的 `SHARED_LIST`（21 个跨分包共享模块，唯一真源）为核对基准，统计每个模块被多少个**不同分包**实际 `import`（共 260 处引用）；
- 主包构成引用 B12 实测（`build:weapp:prod` 后 postbuild 审计）。

## 3. 主包现状（B12 实测基线）

| 指标 | 值 |
| --- | --- |
| 改造前主包 | 1528.7KB |
| B12 回收后主包 | **1470.2KB（1.4357MB）** |
| 净降 | 58.5KB |
| 平台硬限 | 单包 ≤2MB / 总 ≤30MB（官方文档） |
| 当前余量 | **约 484KB**（远未触顶） |

主包构成（B12 实测，单位 KB）：`common.js` 676.9（框架 + 跨分包共享模块大头）、`taro.js` 127.3、`app-origin.wxss` 122.3、`app.js` 120.6、tabBar `pages/` 268、`assets/images` 176、`base.wxml` 72。

## 4. 共享依赖清单（实测，按跨分包数降序）

| 模块 | 跨分包数 | 使用它的分包 |
| --- | --- | --- |
| `@/constants/brand` | **6** | auth, course, lead, settings, student, teacher |
| `@/components/Card` | **6** | course, lead, settings, statistics, student, teacher |
| `@/stores/campus` | **5** | auth, course, lead, settings, student |
| `@/components/PageContainer` | **5** | course, lead, settings, student, teacher |
| `@/components/FormRow` | 4 | course, settings, student, teacher |
| `@/components/SegmentedControl` | 4 | course, statistics, student, teacher |
| `@/components/student/StudentAvatar` | 3 | course, lead, student |
| `@/constants/lead` | 2 | lead, student |
| `@/components/lead/LeadCard` | 2 | lead, student |
| `@/components/InstallmentPanel` | 2 | course, student |
| `@/components/reschedule/WorkflowHeaderCard` | 2 | course, student |
| `@/services/member-card` | 2 | course, student |
| `@/components/ChipPicker` | 1 | course |
| `@/components/lead/TrialBookingView` | 1 | lead |
| `@/services/card-type` | 1 | course |
| `@/services/student` | 1 | student |
| `@/components/student/StudentListCard` | 1 | student |
| `@/components/QuestionHint` | 0 | （仅主包） |
| `@/components/lead/TrialBookingSkeleton` | 0 | （仅主包） |
| `@/components/lead/BookTrialByClassSheet` | 0 | （仅主包） |
| `@/stores/subscribe-auth` | 0 | （仅主包） |

**分布直方图**（跨分包数 → 模块数）：`{0:4, 1:5, 2:5, 3:1, 4:2, 5:2, 6:2}`。

> **对计划「13 真共享」估计的修正**：计划 B12 节写「33 个中约 20 个疑似 ≤1 分包使用、13 个真共享」。本次实测 `SHARED_LIST` 实际为 **21 个**，其中被 ≥2 个分包使用的「真共享」为 **12 个**，仅被 1 个分包使用的 5 个、仅主包使用的 4 个。建议后续把那 9 个（1 或 0 分包）从 `SHARED_LIST` 移出、下沉到对应分包入口（见 §5 候选），但本次**仅调研不改**。

## 5. 若做独立分包：自包含约束下的改造范围与回归面

独立分包要求「分包内页面不依赖主包运行时（除基础库）」。对本项目而言，冲突点在于：

1. **4 个高频跨分包模块**（brand / Card / campus / PageContainer，跨 5–6 分包）必须二选一：
   - 留在主包共享运行时 → 独立分包失去「主包瘦身」意义（主包仍 ≥~1MB）；
   - 复制到每个独立分包 → 包体膨胀 + 多份维护，且 `campus` store / 登录态这类**全局单例**无法简单复制（需改依赖注入 / 事件桥）。
2. **12 个 ≥2 分包模块**同理，复制成本高、易漂移。
3. **跨分包跳转与共享态**：`stores/campus`（校区切换）、`stores/subscribe-auth`（订阅鉴权）、登录态目前由主包持有；拆独立分包后需改造成「分包间共享 chunk」或跨分包通信，回归面覆盖**全部 7 分包 ~110 个页面**。
4. **`common.js` 676.9KB** 是 webpack 运行时 + 框架 + 上述共享模块的集合，独立分包无法消除它（它是小程序基础运行所需）。

**改造范围**：重排 `app.config.ts` 分包结构、迁移页面与依赖、重构全局 store / 登录态、改跨分包跳转、补独立分包构建与缺页校验。工作量估计为「架构演进级」，非上线前紧急项。

## 6. 与 B12 的对比结论

| 维度 | B12（已做） | 独立分包（B13 提案） |
| --- | --- | --- |
| 主包收益 | 1470.2KB，+58.5KB 余量 | 理论可再降 ~80–150KB（下沉 9 个过 pin 模块 + 图片 / wxss 裁剪），但核心共享 ≥1MB 无法消除 |
| 风险 | 低（逐项解 pin，单点可回退） | 高（全量页面回归、全局态重构） |
| 是否阻塞上线 | 否 | 否 |
| 当前紧迫度 | 已完成 | **不紧迫** |

**结论：当前不做独立分包**。理由：
- 平台硬限 2M，当前 1470.2KB，**余量约 484KB**，TanStack Query（B8/B9/B10）等后续功能空间充足；
- 主包瘦身该做的（解 pin / 图片上云 / wxss 裁剪）属 B12 范畴且已落地大部分，独立分包的大改收益边际；
- 真共享模块（尤其 brand / Card / campus / PageContainer）使独立分包要么保共享运行时（不瘦身）、要么复制（膨胀 + 漂移），投入产出比低。

**建议**：把独立分包纳入下一轮「架构演进」立项。本轮仅采纳 §4 的低成本修正——将 9 个过 pin 模块（1 或 0 分包使用）从 `SHARED_LIST` 移出并下沉到对应分包入口，作为 B12 的延续微调（可选，非阻塞）。

## 7. 停止条件遵守

- ✅ 只调研不实施；未改 UI、未改 `app.config.ts` 分包配置、未改 `SHARED_LIST`。
- 本报告所有数字来自静态扫描与 B12 实测，未运行真机 / 未改构建。
