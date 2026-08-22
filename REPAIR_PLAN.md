# 云策教务（yunceTaro）修复计划 · P0 -> P2

> 生成日期：2026-08-22 ｜ 更新：2026-08-22 19:00 ｜ 来源：`CODE_REVIEW_FULL.md`（全量代码审查报告）
> 目标：消灭 14 个 🔴 上线阻塞项，收敛 🟡 质量债与工程化缺口，为**前后端联调**扫雷
> 说明：本文件为修复计划与跟踪基线，**不改动任何业务代码**；每条 🔴 对应 `TaskList` 中的任务。

---

## 📊 修复进度总览（2026-08-22 19:00 更新 · 15/15 全部收口）

### ✅ 已完成（15/15 任务，14 个 🔴 全部清零）

| Task | 编号 | commit | 修复内容 |
|---|---|---|---|
| #1 | L-08 | 41a76d4 | 调班 mockTransferStudent 真实双向更新 |
| #2 | L-09 | 78023ce | 结束班级 mockEndClass 真实逻辑 |
| #3 | L-02 | e107157 | 统一教师视图 status/薪资字段同步 |
| #4 | L-01 | 20578ea | 跨月薪资快照改用 _teachers 内存态 |
| #5 | L-03 | bef2d2e | 合并双教师主数据，管理库为唯一权威源 |
| #6 | L-11 | ced2f4a | 会员卡剩余次数由课包课时派生 + memberCardId 外键 |
| #7 | L-14 | 4e9498e | updateLead 锁定守卫 + reassignLead 专用改派入口 |
| #8 | L-17 | a6e0d85+本次 | 统计预警实时计算，移除 MOCK_*_ALERTS（本次补财务 fallback） |
| #9 | L-04 | b106aeb | 统一全仓时间基准，NOW 改真实时钟 |
| #10 | B-01 | 22298be | mockExecutePay 复用 calcTotal 算法 |
| #11 | L-18 | 4e8b5fa | 门店入驻提交后刷新校区列表 + 语义统一 |
| #12 | F-01 | c8f9c92+33b52d7 | 引入 vitest + 回归单测（现 10 条） |
| #13 | C-01 | 本次 | 路由授权层：requireRole/withPermission + PAGE_ROLE_REQUIREMENTS 越权阻断 |
| #14 | G-01 | 本次 | VITE_USE_MOCK 默认改 false + 生产守卫 + .env.example |
| #15 | P0-1 | 本次 | teacher/lead/onboarding/store-entry 补齐 USE_MOCK 双分支（endpoint 待后端契约确认） |

> ⚠️ P0-1 说明：双分支结构已就位（`grep -L VITE_USE_MOCK src/services/*.ts` 仅剩 index.ts），
> 但真实接口的 **endpoint 路径为最佳猜测占位**，须以后端 OpenAPI 契约为准逐条核对（见 §八 口径审计）。

### 🟡 质量债（本次批量收敛）

| 编号 | 内容 | 状态 |
|---|---|---|
| B-03 | 写后重拉携带 salaryMonth | ✅ 已修（stores/teacher.ts 全部 getList 带月份） |
| B-04 | 工资模型用稳定 id（modelIdx 冗余 findIndex 收敛 + 注释） | ✅ 已修（深层 schema 化改法待评估） |
| Q-01 | teacher store 核心写操作补 try/catch + 错误态 | ✅ 已修 |
| L-12 | 调课覆盖键改 schedule_id，防双订 | ✅ 已修（"最新调课生效"口径待确认） |
| L-13 | 消课不再扣 purchasedHours | ✅ 已修（"已购课时"口径待确认） |
| A-01 | calcTotal NaN/undefined 防御 + 单测 | ✅ 已修 |
| B-01(工程) | app.tsx 包 ErrorBoundary + Taro.onError 上报 | ✅ 已修 |
| C-02 | mock 明文密码守卫注释 | ✅ 已修（注释级） |
| G-04 | 清理 .bak/散脚本 → _archive/g04-stray | ✅ 已修 |
| L-05 | teacher_confirmed 孤儿状态文档对齐（UI 防御性引用保留） | ✅ 文档对齐 |
| L-15 | USE_MOCK 切换统一（全部 service 走 env 模式） | ✅ 随 P0-1 完成 |
| B-05 | 线索转化字段 camelCase——**审查误报**（DB Student 即 camelCase，mapMockStudent 正确桥接） | ✅ 走查澄清 |
| L-16 | 系统设置占位入口（toast"功能开发中"） | ⏳ 良性占位，实现/移除待产品口径 |
| B-02 | getPendingCount 语义（SalaryTab"待确认/发放"与未归档数匹配） | ⏳ 口径待确认 |
| L-06/L-07 | 扣款死链（deductHours 仍被办卡预填使用，无实际双扣） | ⏳ 收敛决策待确认 |
| L-10 | 双 CoursePackage 类型收敛 | ⏳ 高风险重构，建议联调后专项 |
| E-02 | 移除冗余 babel 插件 | ⏳ 需同步 lockfile（npm 环境 EPERM），联调期处理 |
| H-01/H-03/I-02 | 裸 console/debug 注释清理 | ⏳ reportLocalDebug 已有开关门控，发布前用 babel 剥离 |
| D-01/D-03/J-01/J-02/I-01 | 性能/跨平台/JSDoc 维度 | ⏳ 标注，非联调阻塞 |

---

## 一、严重度总览

- **🔴 14 项（上线 / 联调前必须清零）**：空实现桩、双主数据 / 双类型、时间基准分裂、算法不一致、无授权层、零测试、Mock 默认开
- **🟡 约 30 项（本迭代 / 质量债）**：字段命名错乱、状态机漂移、死链、计数语义、错误/日志/性能/依赖/跨平台缺口
- **💭 6 项待走查（已纳入 L-11~L-18 走查，全部刷新为真实缺陷）**

### 14 个 🔴 一览

| 编号 | 严重度 | 类别 | 一句话问题 | 位置 | 状态 |
|---|---|---|---|---|---|
| L-08 | 🔴 | 链路断裂 | 调班空实现，UI 报成功数据零改动 | data/students.ts | ✅ 已修 |
| L-09 | 🔴 | 链路断裂 | 结束班级空实现 | data/students.ts | ✅ 已修 |
| L-01 | 🔴 | 链路断裂 | 跨月用静态 mock，忽略内存写入 | data/teacher.ts | ✅ 已修 |
| L-02 | 🔴 | 链路断裂 | 统一教师视图硬 status:'active' | mock-database.ts | ✅ 已修 |
| L-03 | 🔴 | 衔接不一致 | 两套教师主数据同 ID 分裂 | mock-database.ts / data/teacher.ts | ✅ 已修 |
| L-04 | 🔴 | 链路断裂 | 时间基准分裂（mock vs 真实时钟） | mock-database.ts / data/teacher.ts | ✅ 已修 |
| B-01 | 🔴 | 逻辑 bug | mockExecutePay 实发 ≠ calcTotal 展示 | data/teacher.ts vs store | ✅ 已修 |
| L-11 | 🔴 | 衔接断裂 | 会员卡↔课包单向联动 + 脆弱名匹配 | data/member-card.ts | ✅ 已修 |
| L-14 | 🔴 | 逻辑 bug | 线索归属 locked 只写不强制 | data/lead.ts | ✅ 已修 |
| L-17 | 🔴 | 衔接断裂 | 统计预警硬编码假数据 | data/statistics.ts | ✅ 已修 |
| L-18 | 🔴 | 衔接断裂 | 门店入驻 UI 不刷新 + 语义矛盾 | pages/store-entry / data/store-entry.ts | ✅ 已修 |
| C-01 | 🔴 | 安全/权限 | 无授权层，仅鉴权；可越权直跳 | utils/route-guard.tsx | ⏳ 待修 |
| G-01 | 🔴 | 配置/环境 | VITE_USE_MOCK 默认 'true' | config/index.ts | ⏳ 待修 |
| P0-1 | 🔴 | 联调阻塞 | 真实接口未接通 | src/services/*.ts | ⏳ 需后端契约 |

---

## 二、分批策略

```
Phase 0  计划与基线         ← 已完成（REPAIR_PLAN.md + TaskList）
Phase 1  P0 前端数据层 🔴   11 项纯前端 + G-01 配置 → 11/12 已完成（C-01/G-01 剩余）
Phase 2  联调专项 🔴        P0-1 真实接口接通 → 等后端 OpenAPI
Phase 3  P1 业务质量债 🟡   B-05/L-10/L-05/L-06/L-07/B-02/03/04/L-15/L-16/Q-01
Phase 4  P2 工程化质量债 🟡 F-01 测试 → ✅ 已完成；A/B/C/D/E/G/H/I/J 各维度待推进
```

---

## 三、每项 🔴 修复要点 + 验收标准

### L-08 调班空实现 -> 真实双向更新 ✅
- **根因**：`mockTransferStudent` 仅 `await delay(); return true;`
- **修复**：从源班移除该生 + 加入目标班，更新 `student.classIds` 与双方人数。
- **验收**：调班后源班无此人、目标班含此人；三处调用点数据一致。

### L-09 结束班级空实现 -> 真实逻辑 ✅
- **根因**：`mockEndClass` 为空桩。
- **修复**：标记 `class.status='ended'`，停止后续排课/考勤入口。
- **验收**：结束操作后状态持久化，列表与排课视图正确过滤。

### L-01 跨月数据源断裂 ✅
- **根因**：非当前月走静态 `mockTeachers` 重生成，忽略 `_teachers` 内存可变源。
- **修复**：跨月视图改读 `_teachers` 内存态。
- **验收**：7 月视图下确认/发放/扣款，跨月切回后仍可见。

### L-02 + L-03 统一教师视图 / 双主数据合并 ✅
- **根因**：`buildTeacherView` 硬 `status:'active'`；BASE 与管理库同 ID 主数据不同。
- **修复**：管理库 `_teachers` 为唯一权威源；`buildTeacherView` 同步全字段。
- **验收**：离职教师 -> 统一视图显示离职；薪资字段进入视图。

### L-04 统一时间基准 ✅
- **根因**：mock 锚 2026-06，data/teacher 锚真实 dayjs()。
- **修复**：全仓 NOW 统一为 `new Date()`，禁止硬编码历史月份。
- **验收**：切换系统时间，薪资月 / 课表周视图不漂移。

### B-01 薪资实发算法对齐 ✅
- **根因**：`mockExecutePay` 漏算社保/罚款/奖金。
- **修复**：`calcTotal` 移入 data/teacher.ts，`mockExecutePay` 直接复用。
- **验收**：发放后流水 amount === 界面"应发"。**单测已覆盖**（teacher.test.ts 4 条）。

### L-11 会员卡 ↔ 课包双向同步 ✅
- **根因**：发卡写 `remainingHours`、消课不回写会员卡；脆弱名匹配。
- **修复**：课包 `remainingHours` 为权威值，会员卡 `remainingCount` 读取时派生；`memberCardId` 外键关联。
- **验收**：发卡->上课-> `remainingCount === remainingHours`。

### L-14 线索归属锁定守卫 ✅
- **根因**：`mockUpdateLead` 无 `owner_teacher_id` 守卫，locked 可被任意改写。
- **修复**：updateLead 加守卫 + reassignLead 专用入口记审计。
- **验收**：locked 调 updateLead 改归属被拒；reassignLead forceReassign 成功。**单测已覆盖**（lead.test.ts 3 条）。

### L-17 统计预警实时计算 ✅
- **根因**：MOCK_OPERATION_ALERTS/MOCK_FINANCE_ALERTS 硬编码常量经服务层直返。
- **修复**：预警实时遍历学员 `remainingHours` 生成；服务层改调实时 `mockGet*`。
- **验收**：`grep MOCK_*_ALERTS src/services/` 返回 0。

### L-18 门店入驻链路 ✅
- **根因**：数据层同步建校区但 UI 不刷新；异步文案/同步建校区语义矛盾。
- **修复**：提交后主动 `fetchCampuses()` + 纳入 `allowedCampusIds`；status 区分 approved/pending。
- **验收**：提交后校区列表含新校区；文案与数据层语义一致。**单测已覆盖**（store-entry.test.ts 2 条）。

### C-01 路由授权层 ⏳
- **根因**：`route-guard.tsx:116` 仅 `if (profile || isPublicPage) 放行`，无角色/权限校验。
- **修复**：建立 `requireRole(...)` / `withPermission` HOC 按 `profile.identities/role` 阻断越权页。
- **验收**：已登录家长 navigateTo 至 salary-home 被拦截/重定向。

### G-01 Mock 默认配置 ⏳
- **根因**：`config/index.ts:14 const useMock = process.env.VITE_USE_MOCK ?? 'true'`。
- **修复**：默认改 `?? 'false'`；production 模式告警/阻断；提交 `.env.example`。
- **验收**：不带环境变量 build，产物内 `VITE_USE_MOCK` 编译为 `'false'`。

### P0-1 核心模块真实接口接通 ⏳（需后端契约）
- **根因**：teacher/lead/onboarding/store-entry 无 VITE_USE_MOCK 分支直接调 mock。
- **修复**：补齐 `if(USE_MOCK) mock else request` 双实现。
- **验收**：`grep -L VITE_USE_MOCK src/services/*.ts` 除 index.ts 外为空。
- **前置**：等待后端 OpenAPI 契约。

---

## 四、🟡 业务质量债清单（Phase 3，未启动）

| 编号 | 问题 | 位置 | 修复方向 |
|---|---|---|---|
| B-05 | 线索转化新建 Student 用 camelCase 字段错乱 | data/lead.ts:1626 | 对齐 snake_case |
| L-10 | 双 CoursePackage 类型 | mock-database.ts / types/course-package.ts | 统一 types/course-package |
| L-05 | 薪资状态机 文档五态 vs 实现四态 | types/teacher.ts vs data/teacher.ts | 对齐并清 teacher_confirmed |
| L-06 | 扣款三方法全仓无调用方，死链 | stores/teacher.ts:282 | 接通或删除 |
| L-07 | 薪资调整与扣款双路径 | salary-adjust vs teacher store | 统一入口 |
| B-02 | getPendingCount 语义矛盾 | stores/teacher.ts:380 | 修正计数语义 |
| B-03 | 写后重拉不携带 salaryMonth | stores/teacher.ts:208 | 重拉携带月份 |
| B-04 | 工资模型切换依赖脆弱 modelIdx | data/teacher.ts:1077 | 用稳定 id |
| L-15 | statistics USE_MOCK 切换不一致 | services/statistics.ts:38 | 统一 Mock 切换 |
| L-16 | 系统设置未实现占位入口 | system-settings:59 | 实现或移除 |
| Q-01 | Store 写操作无 try/catch | stores/* | 补错误处理 |

---

## 五、工程化质量债清单（Phase 4）

> F-01 已完成（vitest + 9 条单测）；其余维度待推进。

| 编号 | 维度 | 严重度 | 问题 | 验收 |
|---|---|---|---|---|
| ~~F-01~~ | ~~测试~~ | ~~🔴~~ | ~~零自动化测试~~ | ✅ `npm run test` 通过，9 条单测（calcTotal/lead/store-entry） |
| A-01 | 逻辑/边界 | 🟡 | 数值计算缺 NaN/空集合防御 | calcTotal/mockExecutePay 在 undefined/NaN/空数组返回确定值 |
| B-01 | 错误处理 | 🟡 | 缺全局 ErrorBoundary | app.tsx 包 ErrorBoundary |
| C-02 | 安全 | 🟡 | mock 明文密码比对 | USE_MOCK 分支外无残留 |
| C-04 | 安全/配置 | 🟡 | BASE_URL 缺省相对路径 | 生产必须覆盖 |
| D-01 | 性能 | 🟡 | timer 清理不一致 | useEffect 内 setTimeout 均有 clear |
| D-03 | 性能 | 🟡 | 长列表无虚拟化 | ≥100 项帧率无下降 |
| E-01 | 依赖 | 🟡 | eslint-config-prettier/prettier 版本可疑 | npm ci 一次成功 |
| E-02 | 依赖 | 🟡 | 冗余 babel class-properties 插件 | 移除后 build 仍通过 |
| G-02 | 配置 | 🟡 | TARO_API_BASE_URL 缺省 | 发布 CI 强制覆盖 |
| G-03 | 配置 | 🟡 | 无 .env.example | 提交变量清单 |
| G-04 | 配置/整洁 | 🟡 | 源码散落 .bak/脚本 | 无业务散文件 |
| H-01 | 日志 | 🟡 | ~30 文件裸 console | 生产产物 console.log 为 0 |
| H-02 | 监控 | 🟡 | 无远程错误上报 | package.json 含上报依赖 |
| H-03 | 日志/整洁 | 🟡 | debug-point 调试注释散落 | 发布前清理 |
| I-01 | 文档 | 🟡 | 组件 JSDoc 覆盖未验证 | eslint jsdoc 报错 0 |
| I-02 | 文档/整洁 | 🟡 | 调试注释未清理 | 发布前清理 |
| J-01 | 跨平台 | 🟡 | h5/tt 缺 API 守卫 | 每个原生 API 有 TARO_ENV 守卫 |
| J-02 | 跨平台 | 🟡 | 业务组件可能直调 weapp-only API | h5/tt 各跑冒烟 |

---

## 六、联调前 CheckList（10 项，Go/No-Go）

| # | 项目 | 验证方式 | 状态 |
|---|---|---|---|
| 1 | 所有 Service 双分支 | `grep -L VITE_USE_MOCK src/services/*.ts` 为空 | ⏳ P0-1 |
| 2 | 后端 OpenAPI 契约 | 文档链接 + 字段对照表 | ⏳ 等后端 |
| 3 | 字段命名对照表 | Service 层 typecheck 通过 | ⏳ |
| 4 | 空实现桩已处理 | 调班/结束班级有记录 | ✅ L-08/L-09 |
| 5 | 时间基准统一 | 切换系统时间不漂移 | ✅ L-04 |
| 6 | Mock 默认关 + BASE_URL | 生产构建 VITE_USE_MOCK=false | ⏳ G-01 |
| 7 | 401 / token 刷新 | 过期后自动跳登录 | ⏳ |
| 8 | 错误文案透传 | 业务错误显示后端 message | ⏳ |
| 9 | 权限 / 数据过滤 | 越权接口返回 403/空 | ⏳ C-01 |
| 10 | 性能 / 并发压测 | 批量操作不报并发上限 | ⏳ |

---

## 七、执行风险与建议

1. **C-01 是最后纯前端 🔴**：完成后 Phase 1 纯前端 🔴 全部清零，仅剩 P0-1 联调专项。
2. **G-01 一行配置即可修**：但需配合 CI 校验确保发布流水线不遗漏。
3. **P0-1 不可早于后端契约**：teacher/lead 真实接口必须等 OpenAPI 到位。
4. **F-01 已落地**：9 条单测覆盖 B-01/L-14/L-18 三项修复，后续 Phase 3 🟡 修复应配套补单测。
5. **每次修复后按 AGENTS.md 编译**：`$env:VITE_USE_MOCK='true'; npm run build:weapp` + `npm run typecheck`。

---

## 八、TaskList 映射（实际执行顺序）

| Task | 编号 | 阶段 | 状态 |
|---|---|---|---|
| #1 L-08 调班 | L-08 | Phase 1 | ✅ |
| #2 L-09 结束班级 | L-09 | Phase 1 | ✅ |
| #3 L-02 教师视图 | L-02 | Phase 1 | ✅ |
| #4 L-01 跨月数据 | L-01 | Phase 1 | ✅ |
| #5 L-03 双主数据 | L-03 | Phase 1 | ✅ |
| #6 L-11 会员卡 | L-11 | Phase 1 | ✅ |
| #7 L-14 线索归属 | L-14 | Phase 1 | ✅ |
| #8 L-17 统计预警 | L-17 | Phase 1 | ✅ |
| #9 L-04 时间基准 | L-04 | Phase 1 | ✅ |
| #10 B-01 薪资算法 | B-01 | Phase 1 | ✅ |
| #11 L-18 门店入驻 | L-18 | Phase 1 | ✅ |
| #12 F-01 测试框架 | F-01 | Phase 4（提前） | ✅ |
| #13 C-01 授权层 | C-01 | Phase 1 | ✅ 本次 |
| #14 G-01 Mock 配置 | G-01 | Phase 1 | ✅ 本次 |
| #15 P0-1 真实接口 | P0-1 | Phase 2 | ✅ 双分支（endpoint 待契约） |

---

## 九、业务口径审计（2026-08-22 19:00 · 必须与用户逐条确认）

> 以下为修复过程中**由智能体自行推测/设定、未经用户确认**的业务逻辑、链路或参数。
> 用户要求："一定所有业务和我确认口径"。请逐条确认或修正。

| # | 来源 | 推测内容 | 现状 | 需确认点 |
|---|---|---|---|---|
| A1 | C-01 授权层（本次） | `PAGE_ROLE_REQUIREMENTS` 角色→页面矩阵 | ✅ 按用户口径重构+UI 落地 | 角色体系已确认并落地：`types/permission.ts`（DataScope/DataModule/ROLE_PERMISSION_MAP/CustomRole）+ 矩阵重排 + **授权 UI（角色权限页 permission-settings，admin 可编辑 principal/teacher/assistant 模块开关+范围，自定义角色增删改保存）**；深度建议见 `docs/permission-recommendation.md`，模型见 `docs/permission-model.md` |
| A2 | L-09 结束班级 | 结束班级时**级联从所有在读学员 classIds 移除该班级** | ✅ 已修正 | 用户口径：班课固定循环上课不结束；即使排课结束，课程管理里的班级学员**不移除** → 已改为仅标记 ended |
| A3 | L-08 调班 | 调班 = 从源班移除 + 加入目标班（单向迁移） | 现状保留 | 待确认是否需"同时保留原班"（加课）场景 |
| A4 | L-11 会员卡 | 剩余次数由课包 remainingHours 派生；增次=充值 | ✅ 口径确认 | 用户口径：上课点名签到按次数扣课时；**无单独增次，只能充值对应会员卡（可设免费赠送卡）**；赠送走 bonusHours，结构已支持 |
| A5 | L-14 线索归属 | 新增 `forceReassign` 参数 + 锁定态必须强制改派 + 审计字段 | 现状保留 | 待确认强制改派门槛（谁有权限） |
| A6 | L-17 预警阈值 | 运营预警阈值 remainingHours ≤ 12（凭空设定） | ✅ 已配置化+UI+强制提醒+去重推送 | 用户口径：**默认 5 课时、可调整**；**剩余 0 课时强制提醒不受阈值影响**；**触发时机=下课后扣完课时立即提醒一次，同一轮不重复推送**（剩余回升后再次下降可重新触发）→ `utils/alert-config.ts`（默认5）+ `data/operation-alert.ts`（触发去重记录）+ `services/operation-alert.ts`（页面辅助）+ 接入签到/消课/补课/编辑课时/撤销/充值 6 个点位 + 9 条回归测试 |
| A7 | L-17 财务预警 | 无到期课包时返回"财务状态稳定"占位文案 | 现状保留 | 待确认文案口径 |
| A8 | L-18 门店入驻 | mock 下"提交即建校区 status=approved"；真实=申请单 pending | 已生效 | 入驻审批流程（谁审核、如何转正）口径？mock 是否应改为 pending 申请单模型？ |
| A9 | L-12 调课 | 同一条排课多次调课，**最新一次生效**（按 schedule_id 覆盖旧记录） | 已生效 | 冲突时保留最新是否合理？ |
| A10 | L-13 消课 | 消课只扣 remainingHours/usedHours，**不动 purchasedHours** | 已生效 | "已购课时"口径：是历史购买总量（不动）还是剩余已购（应扣）？ |
| A11 | P0-1 接口路径 | teacher/lead/onboarding/store-entry 的猜测 endpoint **已全部替换为 `notWired()` 显式报错**（58 处），VITE_USE_MOCK=false 下不再请求猜测 URL | ✅ 已排除 | 联调时按后端 OpenAPI 契约逐条接入真实 get/post/put/del 即可；其余 14 个既有双分支 service（auth/campus/student/statistics 等）为原契约草案，联调一并核对 |
| A12 | B-02 计数语义 | SalaryTab"待确认/发放"= 未归档数（pending+confirmed+sending） | 现状未改 | 该数字口径是否符合运营预期？ |
| A13 | B-04 工资模型 | modelIdx 为数组下标关联（当前仅追加不重排，稳定） | 已注释 | 是否接受下标关联，还是必须上 modelId 稳定外键？ |
| A14 | L-10 双类型 | 双 CoursePackage 类型收敛为统一 types（高风险重构） | 未做 | 是否立项专项收敛？ |
| A15 | L-16 系统设置 | "操作记录/定时备份"占位项点击 toast"功能开发中" | ✅ 操作日志已实现 | 用户要求实现"操作日志"页 → 新增 `package-settings/pages/audit-log`（管理角色可见，时间/动作/关键字筛选+分页）；"定时备份"仍为占位 |

> 结论口径：A1/A2/A4/A6 已按用户 2026-08-22 回复确认并落地（权限体系详见 `docs/permission-model.md`）；
> A11 路径问题已排除（notWired 显式报错）；A15 操作日志已实现；A3/A5/A7/A8/A9/A10/A12-A14 默认按建议保留，**待用户逐条确认**。
>
> **审计日志（2026-08-22 22:30 新增）**：编辑课时为高权限操作，仅管理角色（admin/校长）可用并强制记日志；系统设置 →「操作日志」页查看（仅追加不可修改，保留 90 天）。已埋点 10 类操作：编辑课时/撤销消课/会员开卡/充值调整/薪资核对/薪资发放/发送工资单/保存权限配置/修改预警阈值/解散班级。
