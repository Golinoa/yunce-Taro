> **历史资料（2026-09-08 收口）**：保留问题背景与证据；其中完成度、待办、命令和旧方案未经当前版本复验，不作为开发指令。当前工作从 [模块联调入口](../../../yunce-back/yunce-backend/docs/development/README.md) 开始。

# 修复记录 · 管理员课表可见范围 + 空态非失败（2026-09-01）

> **状态**：已落地（BE service + routes + FE 静默空态）  
> **产品真源**：[`2026-09-01-store-entry-product-glossary.md`](./2026-09-01-store-entry-product-glossary.md)（课表可见 + 空态）  
> **坑点册**：[`recurring-pitfall-registry.md`](./recurring-pitfall-registry.md)  
> **前置诊断**：[`2026-09-01-tab-refetch-schedule-records-audit.md`](./2026-09-01-tab-refetch-schedule-records-audit.md)

---

## ⚠ 坑点告警（须读）

关联 **PITFALL-001** 已累计 **6 次**（>3）：管理员教务读权限反复「routes 放行 / service 仍当教师或家长」。  
**不要**只改 `requireRole` 就结案；必须连 **可见范围（organizationId）** 与 **空态 UX** 一起验收。

另：**PITFALL-002**（`/temporary-reschedules` 死链）已 **5 次**，本轮仅 FE 降级，**真接口仍未统一**。

---

## 1. 产品口径（统一）

| 角色                                           | 可见                           | 无数据 / 无权限                                               |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| 管理员 / 校长（`PRINCIPAL`、机构 OWNER/ADMIN） | **本机构全部**排课、班级、消课 | **空列表 / 空白页**                                           |
| 教师 / 助教（`TEACHER`）                       | **仅本人**                     | 同上                                                          |
| 家长                                           | 绑定孩子相关                   | 同上                                                          |
| 其他                                           | 无                             | 空列表；**禁止** 403 失败页、禁止「课表加载失败」类打断 toast |

**禁止**：把管理员当家长鉴权；管理员读课表 **不得**强制先有教师档案。

---

## 2. 问题成立（3 条件）

| #   | 条件            | 本轮证据                                                                                                                                                                                |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 可写复现        | `principal1@yunce.com`（昵称万老师 / 13800000001）→ 原 `GET /lesson-records/by-range` **403**；排课列表旧逻辑按 `teacher-principal-001` 滤，种子排课均在 `teacher-001` → 机构课表不可见 |
| 2   | 定位层级        | 路由 `requireRole`；**service** `getRecordsByRange`/`listLessonRecords`/`listSchedules`/`listClasses`；FE schedule toast                                                                |
| 3   | 位置 + 无损方案 | 见下节；教师/家长分支保留；无权限返回 `[]`                                                                                                                                              |

---

## 3. 根因分层

| 层                | 问题                                                                                           | 修复                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Routes            | 读消课曾缺 `PRINCIPAL`（audit 已补）                                                           | 保持 `PRINCIPAL \| TEACHER \| PARENT`                                                                  |
| Service 消课      | 非 TEACHER 走 `resolveParentAuthorizedStudentIds`（管理员当家长）                              | `applyLessonRecordVisibility`：PRINCIPAL→`organizationId`；TEACHER→`teacherId`；PARENT→孩子；else→`[]` |
| Service 排课/班级 | `listSchedules`/`listClasses` 默认 `teacherId=actor`；controller 强制 `resolveActingTeacherId` | PRINCIPAL 按机构列出；读列表 **不**依赖教师档                                                          |
| FE                | `loadBaseData` / `refreshDateData` toast 失败                                                  | 静默 log；保留缓存或空白                                                                               |
| 临时调课          | 404 死链（PITFALL-002）                                                                        | 已有 catch→本地；**真路径仍待拍板**                                                                    |

---

## 4. 代码锚点

| 文件                                              | 变更要点                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lesson-record/lesson-record.service.ts`      | `applyLessonRecordVisibility`；list/month/range/detail 传 `organizationId` |
| `src/lesson-record/lesson-record.controller.ts`   | 传入 `req.user.organizationId`                                             |
| `src/schedule/schedule.service.ts` + `controller` | PRINCIPAL 机构范围；可选 `campusId` query                                  |
| `src/class/class.service.ts` + `controller`       | 同上                                                                       |
| `yunceTaro/src/pages/schedule/index.tsx`          | 去掉失败打断 toast                                                         |
| 单测                                              | `getRecordsByRange` / `listSchedules` PRINCIPAL 用例                       |

---

## 5. 验收（测环境）

账号：`principal1@yunce.com` / `123456`

| 接口                                 | 期望                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `GET /lesson-records/by-range?...`   | **200**，`data` 为数组（可空）                                          |
| `GET /schedules?page=1&pageSize=100` | **200**，能看到机构排课（种子验证：5 条属 `teacher-001`，管理员仍可见） |
| `GET /classes?...`                   | **200**，机构班级                                                       |
| 小程序课表页                         | **无**「课表加载失败 / 课表记录加载失败」打断；无数据则空白             |

依赖：Docker `yunce-dev-mysql` / `yunce-dev-redis` 需 Up；API `npm run dev` 已加载最新代码。

---

## 6. 未结项（避免再次误判为「已修完」）

| 项                              | 说明                                                                |
| ------------------------------- | ------------------------------------------------------------------- |
| `/temporary-reschedules` 真接口 | 仍 404；需对齐 `/attendance/reschedules` 或下线文档路径             |
| 写路径教务                      | 本轮聚焦 **读可见范围**；创建/改排课仍走教师身份解析                |
| Jest 本地 preset                | WSL 下曾报 `ts-jest` preset；以接口冒烟 + 已写用例为准，CI 环境再跑 |

---

## 7. 文档同步清单

- [x] glossary 课表可见口径
- [x] 本修复记录 + HTML
- [x] recurring-pitfall-registry 计数 + 告警
- [x] 更新 tab-refetch audit 后续状态
- [x] 同步 `yunceTaro/docs/diagnostics/`
