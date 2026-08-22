# 修复计划文档（FIX_PLAN）

> 生成日期：2026-08-22 ｜ 负责人：小程达（WeChatMiniProgramDeveloper）｜ 修复对照表：`CODE_REVIEW_FULL.md`
> 本文件是联调前修复工作的唯一进度源。每次完成一个事项，必须：① 复核当前代码 → ② 实施修复 → ③ `npm run typecheck` 验证 → ④ 更新本文档状态与执行记录 → ⑤ `git` 备份提交。

---

## 0. 重要说明（必读）

1. **git 历史显示已有「阶段 A/B」修复提交**（如 `3dbf99f 教师双库彻底合并`、`adfe2a1 跨库联动打通`、`d1f9067 通知链路打通`）。因此**对照表中的部分 🔴 可能已被修复**。
2. **强制规则**：每个事项开始实施前，必须先读取当前代码复核是否仍需修复。若已修复 → 标记「已关闭(无需修)」并注明 commit；若部分修复 → 仅修剩余部分。
3. 本计划聚焦 **P0（🔴）级**，P1/P2（🟡）列入排期但不阻断联调，仅在联调间隙处理。

---

## 1. 准入标准（Entry / Readiness Criteria）

进入修复实施前，必须满足以下全部条件：

| # | 准入项 | 验证方式 | 状态 |
|---|---|---|---|
| E1 | 已基于 `master` 创建修复专用分支 `fix/integration-readiness` | `git branch --show-current` | ✅ 已建 |
| E2 | 已完成 git 基线备份（当前可恢复点） | 存在基线 commit | ✅ 已做 |
| E3 | Mock 模式编译基线通过（作为回归基准） | `npm run typecheck` 全绿 | ⏳ 待执行 |
| E4 | 联调后端契约（OpenAPI/Swagger）获取方式已明确 | 有契约文档链接或后端负责人 | ⚠️ 待确认（阻塞 F-01/F-02/F-03） |
| E5 | 修复对照表已对齐为权威来源 | `CODE_REVIEW_FULL.md` 存在 | ✅ |

> **E4 阻塞说明**：联调 P0-1/P0-2/P0-3（开关矩阵、契约对齐、桩真实化）依赖后端接口契约。在契约就绪前，先进行所有**不依赖后端**的自包含 P0 修复。

---

## 2. 验收标准（Acceptance Criteria）

### 2.1 整体验收（Done 定义）
- [ ] 全部 P0 🔴 修复完成，且 `npm run typecheck` 全绿、Mock 模式 `build:weapp` 成功
- [ ] 每个修复项均有可度量验收证据（单测断言 / 集成验证 / grep 计数）
- [ ] 生产构建 `VITE_USE_MOCK=false` 且 `BASE_URL` 指向真实后端（`grep` 校验）
- [ ] 越权页面被守卫拦截（E2E 或单测验证）
- [ ] 薪资「实发 == 展示」（`mockExecutePay` 与 `calcTotal` 算法一致）
- [ ] 调班/结束班级在真实后端产生记录，或入口明确禁用并提示

### 2.2 分级验收（按严重度）
| 级别 | 含义 | 验收门槛 |
|---|---|---|
| P0 🔴 | 阻断联调/生产风险 | 必须 100% 关闭，有自动化或可复现验证 |
| P1 🟡 | 联调中暴露的质量/一致性 | 至少人工验证通过，排期闭环 |
| P2 🟢 | 工程债/收尾 | 记录待办，不阻断发版 |

---

## 3. 修复项清单（按优先级）

> 状态图例：⬜ 待复核 ｜ 🔄 进行中 ｜ ✅ 已修复(待验证) ｜ ⚪ 已关闭(无需修) ｜ 🔗 阻塞(待依赖)

### Phase 1 — 联调阻塞·接口接通（依赖后端契约 E4）
| ID | 问题 | 位置 | 修复方案 | 验收标准 | 状态 | 依赖 |
|---|---|---|---|---|---|---|
| F-01 | 开关矩阵缺失：teacher/lead/onboarding/store-entry 无 `VITE_USE_MOCK` 分支 | `services/{teacher,lead,onboarding,store-entry}.ts` | 补齐 `if(USE_MOCK) mock else request()` 双实现，真实分支调 `request.ts` | `grep -L VITE_USE_MOCK src/services/*.ts` 除 index 外为空；`VITE_USE_MOCK=false` 启动可拉真实数据 | 🔗 | E4 |
| F-02 | 接口契约未对齐（camelCase↔snake_case + 成功码） | Service 层 / `mapMockPackage` | 拉 OpenAPI，Service 层统一反序列化；与后端确认成功码 | typecheck 无隐式 any；字段对照表存档 | 🔗 | E4 |
| F-03 | 空实现桩 L-08/L-09 二选一 | `students.ts:1123/1132` | 补真实调用 或 入口禁用+「暂未开放」文案 | 真实后端有记录 或 入口置灰 | 🔗 | E4/F-01 |

### Phase 2 — 自包含 P0 修复（不依赖后端，立即可做）
| ID | 问题 | 位置 | 修复方案 | 验收标准 | 状态 |
|---|---|---|---|---|---|
| G-01 | Mock 默认开（生产风险） | `config/index.ts:14` | 生产构建显式 `VITE_USE_MOCK=false`；CI 校验 | 生产构建不携带 Mock；`grep` 无 mock 泄漏 | ⬜ |
| C-01 | 越权：route-guard 仅鉴权无授权 | `utils/route-guard.tsx:116` | 增加 `withPermission`/角色守卫，低权限拦截 | 低权限账号 URL 直跳被拦截（单测/E2E） | ⬜ |
| B-01 | 薪资算法不一致：实发≠展示 | `data/teacher.ts:917` vs `stores/teacher.ts:25` | `mockExecutePay` 与 `calcTotal` 对齐 | 实发金额 == 展示金额（单测断言） | ⬜ |
| L-01 | 跨月快照读静态 `mockTeachers` | `data/teacher.ts:797` | `genMonthSnapshot` 改读内存 `_teachers` | 写后刷新不丢数据 | ⬜ |
| L-02 | 统一视图硬编码 `status:'active'` | `mock-database.ts:672/692` | `buildTeacherView` 同步真实字段（含离职/薪资） | 导入非 active 教师字段完整 | ⬜ |
| L-03 | 双教师主数据同 ID 分裂 | `mock-database.ts` / `teacher.ts` | 收敛为单一可写源（待复核，git 提交暗示可能已修） | 全仓仅一份教师主数据 | ⬜ |
| L-04 | 时间基准分裂（mock 2026-06 vs 真实时钟） | `mock-database.ts:18` / `teacher.ts:143` | 以后端/系统时间为准统一 `dayjs` | 切换系统时间展示不漂移 | ⬜ |
| L-08 | 调班 `mockTransferStudent` 空实现 | `students.ts:1123` | 见 F-03 | 见 F-03 | ⬜ |
| L-09 | 结束班级 `mockEndClass` 空实现 | `students.ts:1132` | 见 F-03 | 见 F-03 | ⬜ |
| L-11 | 会员卡↔课包脱节（单向失同步） | `data/member-card.ts` | 发卡/上课后双向同步；脆弱 `name.includes` 匹配改 ID 关联 | 发卡→上课后 `会员卡.remaining == 课包.remaining` | ⬜ |
| L-14 | 线索锁定无守卫（可任意改写归属） | `lead.ts:1153 mockUpdateLead` | `mockUpdateLead` 对 `locked` 线索拦截归属变更 | locked 线索 `owner_teacher_id` 不可被改写（单测） | ⬜ |
| L-17 | 统计预警硬编码假数据 | `data/statistics.ts:115-150` | 预警由真实数据聚合生成 | 改数据后预警随之变化 | ⬜ |
| L-18 | 门店入驻提交后不刷新校区 | `pages/store-entry/index.tsx` | 提交后刷新校区列表 / 对齐异步文案 | 提交后校区列表更新 或 文案与行为一致 | ⬜ |

### Phase 3 — 测试与收尾
| ID | 问题 | 位置 | 修复方案 | 验收标准 | 状态 |
|---|---|---|---|---|---|
| F-1T | 零自动化测试 | `package.json` | 引入 vitest + 关键算法单测（薪资/映射/锁定） | `npm test` 可跑，覆盖 P0 算法 | ⬜ |
| Q-01 | Store 写操作无 try/catch 回滚 | `stores/*.ts` | 关键写操作加错误捕获与回滚 | 模拟失败不残留脏状态 | ⬜ |

### Phase 4 — P1/P2 排期（联调间隙处理，不阻断）
- 性能：`useMemo/useCallback` 覆盖、timer 清理、列表虚拟化（D 维度）
- 日志：`console.*` 生产清理、监控接入（H 维度）
- 跨平台：h5/tt API 守卫（J 维度）
- 文档：组件 JSDoc 补全（I 维度）

---

## 4. 执行协议（每个事项的标准循环）

```
1. 复核：读取当前代码，确认该 🔴 仍待修复（或已修→标记关闭）
2. 修复：按 AGENTS.md 规范（UnoCSS/Zustand/Service 单一出口）实施
3. 验证：npm run typecheck 全绿（必要时 Mock 模式 build:weapp）
4. 文档：更新本文件 §3 状态 + §5 执行记录（含 commit 哈希）
5. 备份：git add <改动文件> && git commit -m "fix(<模块>): <简述> (#ID)"
```

> 提交信息规范：`fix(模块): 简述 (#ID)`；例：`fix(teacher): 对齐薪资实发与展示算法 (#B-01)`。
> 每完成一个 Phase 2 事项即提交一次（增量备份）；Phase 1 事项在依赖就绪后批量提交。

---

## 5. 执行记录（每次完成追加一行）

| 日期 | 事项 | commit | 结果 | 备注 |
|---|---|---|---|---|
| 2026-08-22 | 基线备份（计划+对照表） | _待生成_ | ✅ | 创建分支 fix/integration-readiness |

---

## 6. 风险与依赖
- **R1（高）**：F-01/F-02/F-03 依赖后端契约（E4）。在契约就绪前先做 Phase 2 自包含项。
- **R2（中）**：L-03/L-14/B-01 可能已被「阶段A/B」提交部分修复，必须执行前复核，避免重复劳动。
- **R3（中）**：L-04 时间基准改动影响全局时间相关逻辑，需全量回归，建议放 Phase 2 靠后。
- **R4（低）**：编译采用 Mock 模式（`VITE_USE_MOCK=true`），改动后用 `build:weapp` 验证产物。
