# 关 Mock → 双环境真链路联调 · 任务计划（待审阅）

> **日期**：2026-08-31  
> **目标**：备份后完全移除前端 Mock 体系；一套前端代码走真实 API；编译期只切换两个基址（生产 / 开发测试）；本机测环境灌 mock 衍生数据并联调；身份切换器保留但改为接口读用户切换。  
> **状态**：执行中（A/B/C/D/E 主干已落地，F 拆 Mock 待继续，G 联调进行中）  
> **关联**：`2026-08-31-emergency-todo.md`（E1–E4 真链路已修：校长角色解析 + `/teachers/me` + slots/batch）

---

## 0. 现状核对（计划依据）

| 项 | 现状 |
|----|------|
| 本机 API | `:3000` `/health` 正常；MySQL/Redis healthy |
| 公网入口 | `dev.chancore.cn` 530；`devops.chancore.cn` 超时（隧道/frp 未起） |
| 启停脚本 | **坏**：`scripts/local-dev/` 仅剩 `start.cmd` / `stop.cmd` / `check-dev.cmd`，**缺少** `start.sh` / `stop.sh`（cmd 调 WSL bash 必挂） |
| FE 指向 | `dev:weapp:dev` → `https://dev.chancore.cn/api/app/v1` + `VITE_USE_MOCK=false`（脚本已有） |
| Mock 残留 | 大量 `isUseMock()` 分支（auth/student/teacher/lead/home…）；`dev:weapp:mock` / `build:weapp:mock` 仍在 |
| 身份切换器 | `MockIdentitySwitcher` 仅 mock 包显示，读本地 `MOCK_SWITCH_ACCOUNTS` |
| 种子 | `db:seed:frontend-mock` 已灌主干（8 用户等）；私教预约等未灌 |
| Git 备份 | FE `c6543f3`/`1993ce0` ahead 3；BE `08e831c` ahead 2；admin monorepo `d4fa92a` ahead 2；**均未 push** |
| 文件备份 | `_backups/20260831-*` 多份；另有 README |

**你指定的双接口口径（本计划采用）**

| 环境 | API 基址 | 编译命令（拟定） |
|------|----------|------------------|
| 生产 | `https://api.chancore.cn/api/app/v1` | `build:weapp:prod` / 默认正式包 |
| 开发测试 | `https://dev.chancore.cn/api/app/v1` | `dev:weapp:dev` / `build:weapp:dev` |

> 说明：此前临时用过 `devops.chancore.cn`（frp）。若你最终只保留 **dev.chancore.cn**，计划里以 CF Tunnel 为准，devops 作废弃或备用注明。请在审阅时拍板。

---

## 1. 原则（锁定）

1. **一套业务代码、零 Mock 运行时分支**（`isUseMock` / `data/*` mock / `mock-stub` 全部下线）。  
2. **环境差只在编译注入**：`TARO_API_BASE_URL`（+ 必要 debug 开关）；禁止再靠 `VITE_USE_MOCK=true` 跑日常。  
3. **测环境数据来自「从前端 mock 提炼的种子」**，落本机 MySQL；不合理字段改种子/修库，不回 Mock。  
4. **身份切换器保留**：仅 develop/测试包显示；列表与切会话走后端接口（读用户/切换 token 或 switchIdentity）。  
5. **真链路先于拆 Mock**：E1–E4（校长角色、`/teachers/me`、开放约 batch）与关键缺 API 要先能跑通，再删 Mock，避免「删了也测不了」。  
6. **先备份、再动刀**；每阶段有验收门，门不过不进下一阶段。

---

## 2. 任务先后顺序（建议）

### Phase A — 止血底座（0.5 天）

| # | 任务 | 产出 / 验收 |
|---|------|-------------|
| A1 | **修复 local-dev 启停脚本** | 恢复 `start.sh` / `stop.sh`（或改 cmd 不依赖缺失 sh）；双击 `start.cmd` 能起 Docker+API；`check-dev.cmd` 测通本机 health |
| A2 | **打通公网入口** | 选定并跑通 `dev.chancore.cn`（cloudflared）或明确改回 devops；`curl https://…/health` = ok |
| A3 | **备份快照（关 Mock 前）** | ① 三端再打一次 `chore: backup 2026-08-31 pre-demock` ② `_backups/` 全量拷 FE+BE（含 prisma）③ 可选：打 git tag `backup/pre-demock-20260831`（本地即可） |
| A4 | **备份核对清单签字** | 文档写明 SHA / 路径；确认未 push 也有本地可回滚点 |

**门禁**：本机 + 选定公网域名 health 绿；备份 SHA 记入 `emergency-todo` 或本计划附录。

---

### Phase B — 双环境路由与联调入口（0.5 天）

| # | 任务 | 产出 / 验收 |
|---|------|-------------|
| B1 | **统一前端环境脚本** | 仅保留：`dev:weapp:dev` / `build:weapp:dev`（测）、`build:weapp:prod`（产）；废弃或隐藏 `*:mock`（先标 deprecated，C 阶段删除） |
| B2 | **文档与合法域名** | SOP：`dev.chancore.cn`；微信 request 合法域名；Clash DIRECT |
| B3 | **`.env` 联调键** | `ALLOW_MOCK_AUTH=true`（测环境短信未齐时）；CORS 含开发工具来源 |
| B4 | **冒烟：真 API 登录** | 种子账号手机号登录 → 进首页（此时 Mock 开关仍可暂留 false 路径） |

**门禁**：微信开发者工具用 **dev 包** 打到测环境，网络面板无 mock 内存假成功。

---

### Phase C — 真链路阻塞修复（与拆 Mock 并行前置，1～2 天）

> 二次走查 P0：不修则校长/教师真链路仍断。

| # | 任务 | 说明 |
|---|------|------|
| C1 | E1+E2 角色矩阵 | 教务 API `PRINCIPAL \| TEACHER`（students / home/teacher / class / schedule 写等） |
| C2 | E3 `GET /teachers/me` | 台账/工资单改 me；停用 profile.id 猜 Teacher |
| C3 | E4 class-booking 写 | batch 保存/删除 **或** 测环境先藏开放约配置入口 |
| C4 | 补测环境缺接口清单 | 对照 `notWired` / 软失败 API，列「本周必接 / 可藏入口」 |

**门禁**：校长能进学员列表；教师能开工资单；开放约配置不假失败（或入口已藏）。

---

### Phase D — Mock 数据 → 测库（1 天）

| # | 任务 | 产出 / 验收 |
|---|------|-------------|
| D1 | **盘点前端 mock 实体** | 对照 `mock-database` / `data/*`：用户、机构、班课/团课、私教、场地、课包、请假、消课、线索… |
| D2 | **扩展 `seed-frontend-mock`** | 补私教预约、团课开放时段、场地占用、多孩家长、不合理字段清洗规则 |
| D3 | **数据合理性调整** | 过期课包、假 0、错误角色绑定、冲突排课等改种子或一次性 SQL |
| D4 | **幂等重灌流程** | `migrate deploy` + `db:seed:frontend-mock` 文档化；禁止碰生产库 |

**门禁**：种子账号矩阵可登录；家长能看到课表/约课相关数据；校长能看学员/班级。

---

### Phase E — 身份切换器改造（0.5～1 天）

| # | 任务 | 产出 / 验收 |
|---|------|-------------|
| E1 | **后端：测环境可切换账号列表** | 如 `GET /dev/switchable-users`（仅 `NODE_ENV=development` 或显式 `ALLOW_DEV_SWITCH=true`）；返回种子用户摘要 |
| E2 | **后端：切换会话** | 复用/扩展 `switchIdentity` 或签发目标用户 token（严格限测环境） |
| E3 | **前端：Switcher 去 Mock 依赖** | 改名如 `DevIdentitySwitcher`；`isUseMock` → `isDevApiEnv()`（基址为 dev.chancore.cn 或编译 flag） |
| E4 | **安全** | 生产包编译剔除入口；后端生产拒绝该路由 |

**门禁**：测包左上角可切校长/教师/家长；切后请求身份与列表一致；生产包无入口。

---

### Phase F — 拆除 Mock 系统（1～2 天，分域）

**顺序建议（由浅入深）**

1. 构建脚本：删除 `dev:weapp:mock` / `build:weapp:mock` / mock stub 生成  
2. `build-env`：删除 `isUseMock`；仅留 `getApiBaseUrl`  
3. services：逐文件删 mock 分支（auth → home → student → teacher → schedule → lead → …）  
4. 删除 `src/data/*` mock、`mock-stub/`、`mock-loaders`（测试改 fixture 或 MSW/不测 UI mock）  
5. 单测：凡依赖 `isUseMock()` 的改为真契约 mock（vi.mock request）或标 skip 后补  

**门禁**：全仓 `rg isUseMock|VITE_USE_MOCK|mock-stub|loadXxxMock` 为零（测试夹具除外约定目录）；`build:weapp:dev` + `build:weapp:prod` 均成功。

---

### Phase G — 全量测试 + 测环境联调（1～2 天）

| # | 任务 | 验收 |
|---|------|------|
| G1 | BE：`npm test` / 关键域 + `verify:sop`（可选） | 全绿或已知豁免清单 |
| G2 | FE：vitest 全量 | 全绿 |
| G3 | 小程序 `build:weapp:dev` | 编译成功；主包体积可接受 |
| G4 | 联调清单（教师×家长×校长） | 绑定→约班/私教→我的课程；场地；请假；员工；台账；对照 `dual-app` 冒烟表 |
| G5 | 记录缺陷 → 只修真链路 | 不再回 Mock |

**门禁**：冒烟清单 P0 全过；遗留进 backlog，不挡「测环境日常开发只走真 API」。

---

## 3. 建议总工期

| 阶段 | 约略 |
|------|------|
| A 底座+备份 | 0.5d |
| B 双环境入口 | 0.5d |
| C P0 真链路 | 1～2d |
| D 种子数据 | 1d |
| E 切换器 | 0.5～1d |
| F 拆 Mock | 1～2d |
| G 测试联调 | 1～2d |
| **合计** | **约 6～9 人日** |

可压缩：C 与 D 部分并行；F 可在 C 门禁后按域滚动删除。

---

## 4. 需要你拍板的问题

1. **公网域名**：只保留 `dev.chancore.cn`，还是 devops 与 dev 双活？  
2. **拆 Mock 节奏**：一次拆光（F 整域），还是按域「真通一门删一门」？  
3. **身份切换安全**：接受「测环境专用 token 签发」吗？（推荐；比共享密码列表更干净）  
4. **E4 开放约**：本迭代实装 batch，还是先藏入口？  
5. **是否现在就修 start.sh**（A1）作为开工第一刀？

---

## 5. 明确不做（本计划边界）

- 不把测库数据推生产  
- 不在生产开启 `ALLOW_DEV_SWITCH` / mock auth  
- 不靠微信 `envVersion` 自动切 API（仍编译期注入，与现 SOP 一致）  
- 不把「紧急待办 E1–E4」留给拆 Mock 之后才发现

---

## 6. 推荐开工顺序（一句话）

**A1 修脚本 → A3 备份 → A2 打通 dev 域名 → B 真 API 冒烟 → C P0 → D 扩种子 → E 切换器 API 化 → F 拆 Mock → G 全测联调。**

请审阅：回复「按此执行」或标注要改的序号（尤其第 4 节拍板项）。

---

## 7. 执行进度（2026-08-31）

| 阶段 | 状态 | 备注 |
|------|------|------|
| A | 完成 | start/stop.sh；dev.chancore.cn health |
| B | 完成 | `dev:weapp:dev` / `build:weapp:dev`；password-login |
| C | 完成 | 校长教务身份；`/teachers/me`；slots/batch |
| D | 完成 | 种子含开放时段 + 私教预约 |
| E | 完成 | DEV 切换器 + 邮箱密码切会话（常量列表） |
| F | 完成（运行时） | 服务层 `isUseMock` 分支已拆；`isUseMock()` 废弃恒 false；`*:mock` 脚本硬失败；`src/data/*` 仍保留供 stub/历史 |
| G | 部分完成 | FE vitest **172/172**；API 三角色冒烟见下 |

### G 冒烟（本机 API）

脚本：`yunceTaro/scripts/smoke-demock-api.mjs`

账号：`*@yunce.com` / `123456`

| 检查项 | 结果 |
|--------|------|
| health | PASS |
| 校长 students / home/teacher / teachers/me | PASS |
| 教师 teachers/me / students | PASS |
| 家长 home/parent / students | PASS（home 已按 profileId/userUuid 解析） |
| class-booking list + batch | PASS |

FE：`npm test -- --run` → 37 files / 172 tests PASS

---

## 8. 需要你介入（到此为止）

以下无法在本会话内代劳，需要你本地操作或拍板：

1. **微信开发者工具联调**  
   - 保持：本机 API + `cloudflared tunnel run yunce-dev`  
   - 执行：`cd yunceTaro && npm run dev:weapp:dev`  
   - 打开 `dist`，合法域名含 `dev.chancore.cn`  
   - 用左上角 **DEV** 切换校长/教师/家长，过一遍绑定→约课→台账

2. ~~是否删光 `src/data/*`~~：**已删**（含 mock-stub / mock-loaders）；类型迁到 `src/types/*`  
3. ~~是否 git commit~~：见本轮备份提交  
4. （可选）`GET /dev/switchable-users` 仍可后续做
