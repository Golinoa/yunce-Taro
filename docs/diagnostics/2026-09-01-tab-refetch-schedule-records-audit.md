> **历史资料（2026-09-08 收口）**：保留问题背景与证据；其中完成度、待办、命令和旧方案未经当前版本复验，不作为开发指令。当前工作从 [模块联调入口](../../../yunce-back/yunce-backend/docs/development/README.md) 开始。

# 诊断 · Tab 反复拉库 + 课表记录失败（2026-09-01）

> 环境：测环境 `dev.chancore.cn` · 账号 `principal1@yunce.com`  
> 产品真源已锁：`docs/PM/current/2026-09-01-store-entry-product-glossary.md`（默认头像 + **客户端拉数企业级**）

---

## 1. 现象

- Tab 来回点：首页/课表每次 `useDidShow` 全量打接口，日志可见大量 prisma + home/todos/schedules。
- 课表提示「课表记录加载失败」：
  - `GET /lesson-records/by-range` → **403**
  - `GET /temporary-reschedules` → **404**

---

## 2. 根因（证据）

| 问题     | 根因                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tab 打库 | `pages/home` `useDidShow` 非首屏即 `loadData`；`pages/schedule` `useDidShow` **无条件** `loadMonthRecords` + `loadTemporaryReschedules` |
| 403      | `lesson-record.routes` 读接口 `requireRole(['TEACHER','PARENT'])`，**管理员 PRINCIPAL 被拒**（种子校长登录必现）                        |
| 404      | 后端 **未挂载** `temporary-reschedules` 路由；前端却当硬依赖                                                                            |

用户少时：点一次查一次 = 人为制造高峰；用户多时会挤垮 DB/API（非“有没有用户”问题，是放大系数问题）。

---

## 3. 已做修复（本轮）

1. **口径**：glossary 写入默认头像 sgpk + Tab 缓存/TTL 企业级规则；已 render HTML。
2. **403**：lesson-records 读接口加入 `PRINCIPAL`。
3. **404**：`temporaryRescheduleService.getByTeacherAndRange` 失败降级本地 storage，不炸课表。
4. **TTL**：首页 / 课表辅助数据 Tab 再进入 **60s 内跳过全量**；写后 refresh signal 仍强制刷。

---

## 4. 后续落地（2026-09-01 第二轮 · 已完成）

详见 **[`2026-09-01-fix-schedule-visibility-principal.md`](./2026-09-01-fix-schedule-visibility-principal.md)**：

- Service：PRINCIPAL 按 `organizationId` 看机构全部消课/排课/班级（不再当家长、不强制本人教师档）。
- FE：课表失败改为空白/缓存，禁止失败 toast。
- 口径与坑点册：glossary + [`recurring-pitfall-registry.md`](./recurring-pitfall-registry.md)（**PITFALL-001 已 6 次告警**）。

仍开放：`temporary-reschedules` 真路径统一（**PITFALL-002**）。

---

## 5. 历史「可选加深」（部分已做）

- ~~后端补齐 temporary-reschedules / 或正式下线~~ → **未结**，见坑点册 002。
- 统计/消息等其它 Tab 同样 TTL。
- 写操作统一打 `SCHEDULE_REFRESH_SIGNAL` / home invalidate。

验收：管理员登录 → 课表消课范围 **200 空或有数据**（非 403）；Tab 连点 1 分钟内 **不应**每点一次打 home 全量。
