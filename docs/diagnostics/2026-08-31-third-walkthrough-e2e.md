# 双端第三次全面走查 + 测环境全量回归 / E2E（2026-08-31）

> **口径**：代码走查 + 测环境 `https://dev.chancore.cn` API E2E + FE vitest + BE test:ci 抽样。  
> **非真机 UI E2E**（仓库无 miniprogram-automator / Playwright weapp 套件）。  
> Canvas：`third-walkthrough-launch-gate.canvas.tsx`

---

## 1. 总判（上线条件）

| 门禁 | 结果 | 说明 |
|------|------|------|
| E1–E4 紧急项回归 | **PASS** | 校长学员/首页、`/teachers/me`、slots/batch |
| 测环境 API E2E（42 项） | **42/42 PASS** | `scripts/e2e-regression-dev.mjs` → `dev.chancore.cn` |
| FE vitest | **132/132 PASS** | 27 files（demock 后） |
| BE `test:ci` | **未过** | 103 suites：97 pass / **6 fail**；1267 tests：1228 pass / **39 fail** |
| 微信真机 / DevTools 页面矩阵 | **未自动化** | 需人工按三角色清单点一遍 |
| **生产上线** | **暂不满足** | BE 单测红、notWired 面、家长学员列表空、隐私开关关、无真机 E2E |
| **测环境日常真链路开发** | **基本满足** | 三角色登录 + 教务主路径 API 绿；本轮修了 2 个 P0 |

---

## 2. 本轮执行动作

1. 新增全量回归脚本：`yunceTaro/scripts/e2e-regression-dev.mjs`  
   - 覆盖：infra / auth / principal / teacher / parent / rbac-deny / emergency-E1-E4  
   - 产物：`docs/diagnostics/_e2e-regression-latest.json`
2. FE：`npm test -- --run` → 132 PASS  
3. BE：`npm run test:ci` → 6 suites FAIL（含 todo routes 500、public operation-content 404、home.service 期望漂移等；**不全是本轮引入**）  
4. 静态走查：`notWired` / 占位 Toast / Mock 残留  
5. **现场修复并重启 API 后复测**：
   - 校长课包列表缺 `PRINCIPAL` → `course-package.routes.ts` 放行 PRINCIPAL  
   - 数据中心 finance 500：`MemberCard` 无 `campusId` → 改为 `student: { campusId }`  

---

## 3. API E2E 结果（测环境）

目标：`https://dev.chancore.cn` · 版本 `1.2.9-internal.20` · 生成时间见 JSON

| Suite | Pass | Fail |
|-------|-----:|-----:|
| infra | 1 | 0 |
| auth | 3 | 0 |
| principal | 17 | 0 |
| teacher | 6 | 0 |
| parent | 7 | 0 |
| rbac-deny | 4 | 0 |
| emergency-E1-E4 | 4 | 0 |
| **合计** | **42** | **0** |

复跑：

```bash
cd yunceTaro
API_ROOT=https://dev.chancore.cn OUT_JSON=docs/diagnostics/_e2e-regression-latest.json \
  node scripts/e2e-regression-dev.mjs
```

---

## 4. 第三次页面 / 契约走查缺陷

### P0（本轮已修）

| ID | 问题 | 修复 |
|----|------|------|
| W3-01 | 校长 `GET /course-packages` 403（仅 TEACHER\|PARENT） | 路由加 PRINCIPAL |
| W3-02 | `GET /data-center/finance` 500（MemberCard.campusId 非法字段） | 按 `student.campusId` 过滤 |

### P1（上线前应清）

| ID | 问题 | 影响面 |
|----|------|--------|
| W3-03 | `parent1` `GET /students/` 返回 `n=0`（home/parent 仍 200） | 成长档案/多孩切换种子或列表解析 |
| W3-04 | BE `test:ci` 39 fail | 发布门禁不可信 |
| W3-05 | `notWired`：校区删/设主、薪资模型、发薪日、节假日、营业时间、科目/场地/教室写、课包模板、部分家长绑定旧 API、教师个人薪资规则/扣款改删 | 对应设置页点写 → 明确失败 Toast（不假成功，但仍不可用） |
| W3-06 | 会员卡 `member-card.ts` 仍 TODO 真 API | 会员卡业务页 |
| W3-07 | 占位：「功能开发中」profile/系统设置；评价即将上线；线索签到/代约；学员批量延期/黑名单 | UX 可接受则标 known；提审文案需一致 |

### P2 / 卫生

| ID | 问题 |
|----|------|
| W3-08 | `__usePrivacyCheck__: false` — 提审前需打开隐私指引 |
| W3-09 | 无 weapp UI E2E；合法域名 / Clash DIRECT 依赖人工 |
| W3-10 | BE swagger YAML 告警（class/schedule/student routes 注释截断）— 不挡启动，污染日志 |
| W3-11 | 多份 nodemon 历史进程易占端口；改代码后 `/mnt/d` 上 nodemon 偶发不热更，需 `start.sh` 重启 |

### 相对二次走查

二次走查 4 个 P0（E1–E4）在测环境 **均已 PASS**。本轮新暴露并修复 W3-01/W3-02。

---

## 5. 三角色人工联调清单（DevTools，未跑自动化）

用 `npm run dev:weapp:dev` + DEV 切换器，至少各点一遍：

**校长**：首页 → 学员 → 课表/开放约保存 → 课包 → 数据 Tab 财务 → 请假审批 → 员工  
**教师**：首页待办（无越权跳）→ 学员 → 点名 → 台账/工资单（me）→ 负例进统计应拦截  
**家长**：绑定/首页 → 约班/我的课程 → 私教/场地 → 请假 → 成长档案；确认子女列表非空  

---

## 6. 上线 Gate 建议（下一刀）

1. 修 BE `test:ci` 红（或出已知豁免清单并签字）  
2. 查清 parent1 学员列表空（种子 `StudentParent` vs 列表过滤）  
3. 真机走完 §5 矩阵并截图  
4. 提审前：隐私开关、合法域名、订阅消息门禁（若启用）  
5. 对 W3-05 notWired 写入口：藏入口或本迭代实装  

---

## 7. 关联产物

- E2E 脚本：`yunceTaro/scripts/e2e-regression-dev.mjs`  
- 报告 JSON：`yunceTaro/docs/diagnostics/_e2e-regression-latest.json`  
- BE 修复：`course-package.routes.ts`、`data-center.service.ts`  
- 二次走查：`2026-08-31-dual-app-secondary-walkthrough.md`  
- Demock 计划：`2026-08-31-demock-dev-plan.md` Phase G  
