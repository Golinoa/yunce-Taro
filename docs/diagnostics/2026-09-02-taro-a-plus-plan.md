# yunceTaro · 可上线 + 质量 A+ 全套计划

> 日期：2026-09-02  
> 范围：**仅 yunceTaro**（Admin 移出）  
> 输入：上线边界 Review（Taro）+ [三端代码体量与质量评审](三端侧小程序评级 B-)  
> 画布：IDE 打开 `taro-launch-quality-a-plus-plan.canvas.tsx`（可上线 + 质量 A+ 计划）

---

## 目标

| 维度 | 当前 | 目标 |
|------|------|------|
| 上线 | L3 两条主路径断 → **阻断** | P0=0，主路径可宣称闭环 |
| 质量评级 | **B-**（123k LOC · 测试~3% · 巨型页） | **A+**：可拓展 · 可维护 · 可上线 |
| 对标 | 后端 A- | 小程序工程成熟度追平后端量级纪律 |

### A+ 可度量门槛

1. **主路径**：登录 → L1–L4 邀请 → 消课，无断链（真机 VH/V4T/X + 单测）
2. **缺陷**：P0=0；资损类 P1 已修或后端幂等有证
3. **巨型页**：`schedule` / `lesson-form` / `schedule-form` 拆到可维护边界（目标单文件 &lt;800 或 hooks+子组件清晰）
4. **测试**：邀请/鉴权回跳/消课防重/route-guard 有回归包；CI 绿
5. **契约**：热路径无 `notWired`；AGENTS/规则与现状一致
6. **门禁**：`npm run check` + 改 src 后 `build:weapp:mock` 绿

---

## Wave 0 · 阻塞修复（必须先做）

| ID | 问题 | 修法 | 验收 | 估时 |
|----|------|------|------|------|
| **B0-1** | `copyCampusInviteLink` → `package-auth/pages/index?redirect=`，全仓无 redirect 消费 | 改为 `buildCampusInvitePath` 直链（对齐 L2） | 复制链接打开即 `campus-invite-landing`；单测 path | 1h |
| **B0-2** | 「登录并接受」不写 `loginRedirect`；`navigateAfterAuth` 不消费 campus pending | `handleLogin` 写 `LOGIN_REDIRECT_KEY`；或 auth 后优先回落地页 | 未登录→登录→可接受邀请；onboarding 单测 | 2–3h |
| **B0-3** | V3T/X-3 未覆盖上述路径 | 单测 + walkthrough 补测 | `device-walkthrough` 勾选 | 2h |

**出口**：上线结论可改为「可上线（仍须完成邀请真机门禁）」。

### Wave 0 进度（2026-09-02）

| ID | 状态 | Commit / 备份分支 |
|----|------|-------------------|
| 基线 | ✅ | `backup/pre-taro-a-plus-2026-09-02` @ `9fd950c` |
| B0-1 | ✅ | `eb2937e` · `backup/taro-a-plus-b0-1-2026-09-02` |
| B0-2 | ✅ | `3b23316` · `backup/taro-a-plus-b0-2-2026-09-02` |
| B0-2 hotfix | ✅ | `b3a0d1b` · `backup/taro-a-plus-b0-2-hotfix-2026-09-02`（清 loginRedirect，防 accept 后回环） |
| B0-3 | ✅ | `083bbf8` · `backup/taro-a-plus-b0-3-2026-09-02` |

### Wave 1 进度

| ID | 状态 | 说明 |
|----|------|------|
| G1-1 | ✅ | `21991df` · `backup/taro-a-plus-g1-1-2026-09-02` |
| G1-2 | ✅ | 砍「全部已签到」假入口 |
| G1-5 | ✅ | L3 过期/已用满屏分态 |
| G1-6 | ✅ | DeductResult.fifoSplitKnown=false |
| G1-3 / G1-4 | ⏳ 真机 | 无法代跑；见 walkthrough X-3/VH/V4T |

### Wave 2 进度

| ID | 状态 | 说明 |
|----|------|------|
| Q2-2 | ✅ 提交+加载+面板+弹层 | load `f4a8732`；panels `5d7c57f`；sheets `07befdb`；页约 **1832** 行 · `backup/taro-a-plus-q2-2-sheets-2026-09-03` |
| Q2-1 | ✅ 导航+卡片+开放列表 | `e66787d` OpenClass |
| Q2-1 | ✅ +日 Swiper 项 | `ca6decf` · ScheduleDaySwiperItem · `backup/taro-a-plus-q2-1-day-swiper-2026-09-03` |
| Q2-1 | ✅ +loaders hook | `use-schedule-loaders`；页约 **2199** 行 · `backup/taro-a-plus-q2-1-loaders-2026-09-03` |
| Q2-1 | ✅ +batch sheets | `88d9d33` · `ScheduleBatchSheets`；页约 **2053** 行 · `backup/taro-a-plus-q2-1-batch-sheets-2026-09-03` |
| Q2-3 | ✅ 保存+时段+基础/规则卡+弹层/底栏 | timeslots `7ae9469`；base/rule cards；sheets+footer 本提交；页约 **1447** 行 |
| Q2-4 | ✅ | student 已拆；auth 门面 **89** 行 · `e66787d` |
| Q2-5 | ✅ | `82567c0` · … |

### Wave 3 进度

| ID | 状态 | 说明 |
|----|------|------|
| Q3-1 | ✅ | eslint `no-restricted-imports`：`src/pages/**`、`src/stores/**`、`src/package-*/pages/**` 禁 `@/data` 与 `**/data/**`（error；当前 0 违规）· `backup/taro-a-plus-q3-gates-2026-09-03` |
| Q3-2 | ✅ 轻量 | AGENTS 已写明**禁止新增 SCSS**；eslint 禁 `*.scss` import 暂跳过（遗留 `invite-landing` 会吵） |
| Q3-3 | ✅ 起步 | AGENTS / rules / PRD：Taro 4 |
| Q3-5 | ✅ | coverage.include + `route-guard.tsx` + `route-guard.test.ts`；lines 门槛 30→35（全量 ~79% 仍过门） |
| Q3-4 | ⏳ | 次级大页队列 |

下一节点：继续削巨型页至 &lt;800；真机 G1-3/4；Q3-4。

---

## Wave 1 · 缺口修复（承诺能力）

| ID | 缺口 | 裁决 | 动作 | 估时 |
|----|------|------|------|------|
| G1-1 | 消课双提交防重入弱 | P1 应修 | `if (submitting) return` + 锁；核后端幂等 | 0.5d |
| G1-2 | 体验课「签到开发中」 | 产品二选一 | 接通 **或** 隐藏 CTA | 0.5–2d |
| G1-3 | VH + V4T 真机未过 | 上线门禁 | 按 `2026-09-02-device-walkthrough.html` | 1–2d |
| G1-4 | X-1..X-5 跨链路回归 | 门禁 | Staging 同会话 | 1d |
| G1-5 | L3 过期/已用 UI 弱于 L2 | 可债顺手 | 满屏分态对齐 | 0.5d |
| G1-6 | `deductHours` 假拆 purchased/bonus | 可债 | 对齐后端契约 | 0.5d |

---

## Wave 2 · 质量修复（B- → A-）

热点（2026-09-02 实测行数）：

| 文件 | 行数 |
|------|------|
| `src/pages/schedule/index.tsx` | 3404 |
| `src/package-course/pages/lesson-form/index.tsx` | 3079 |
| `src/package-course/pages/schedule-form/index.tsx` | 1447 |
| `src/services/student.ts` | 2071 |
| `src/services/auth.ts` | 89（门面；login/session/profile 已拆） |

| ID | 项 | 完成定义 |
|----|-----|----------|
| Q2-1 | 拆 schedule | 主交互不变；模块可测 |
| Q2-2 | 拆 lesson-form | 提交/补录/单人消课分文件；防重入单测 |
| Q2-3 | 拆 schedule-form | 保存路径有回归 |
| Q2-4 | student/auth 神文件收敛 | 按用例拆分，禁止继续堆 |
| Q2-5 | 热路径清 notWired | 登录/邀请/消课路径无 notWired |

---

## Wave 3 · 质量加固（A → A+）

| ID | 项 | 完成定义 |
|----|-----|----------|
| Q3-1 | 分层执法 | pages/stores 禁直连 data；eslint/CI |
| Q3-2 | Token/Uno 分批 | 新代码 100% Token；禁新增 scss |
| Q3-3 | 文档对齐 | 去掉 Taro3/空 mock 漂移 |
| Q3-4 | 次级大页队列 | SalaryRuleEditor / course-form / student-detail / invite-landing |
| Q3-5 | 覆盖率门禁 | invite* / auth-onboarding / route-guard 设下限 |

---

## 明确不做

- Admin / 后端大重构（非本计划范围）
- 无消费者功能新建
- 全站视觉重做
- 无量化前的列表虚拟化
- 与主路径无关的次要页大拆（仅进 Q3-4 队列，不挡上线）

---

## 建议开工顺序

1. **今天**：B0-1 → B0-2 → B0-3  
2. **本周**：G1-1；G1-3/G1-4 真机；G1-2 产品拍板  
3. **下周起**：Q2-2（lesson-form，兼防重入）→ Q2-1 → Q2-3 → Q2-4/5  
4. **持续**：Q3 门禁与次级拆分  

评级路径：`B-` →（P0 清）可上线仍偏 B/B+ →（Q2）`A-` →（Q3）`A+`

---

## 关联

- `Docs/三端上线边界-代码Review提示词.md`
- `docs/diagnostics/2026-09-02-invite-share-auth-p0-plan.md` §11.7
- `docs/diagnostics/2026-09-02-device-walkthrough.html`
- 画布：三端代码体量与质量评审；本计划 canvas
