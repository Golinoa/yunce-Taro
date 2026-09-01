# Walkthrough 点对点连通性报告（本地）

> **日期**：2026-09-01  
> **环境**：`http://127.0.0.1:3000/api/app/v1` · 账号 `principal1@yunce.com`  
> **范围**：登录 JWT org、班课、课表、科目/假期/薪资、临时调课、点对点邀请  

---

## 结论

**主链路已打通；邀请 HTTP create 仍依赖你本地 API 进程热加载一次新代码。**

| 路径 | 判定 | 说明 |
|------|------|------|
| POST `/auth/password-login` → JWT `organizationId` | ✅ | `role=PRINCIPAL`，org/campus 均 present |
| GET `/classes` | ✅ | 5 条 |
| GET `/schedules` + `/schedules/today` | ✅ | 列表 5 条；今日结构正常 |
| GET `/subjects` / `/holidays` | ✅ | 200（当前种子空列表，属数据非断链） |
| GET `/teachers/salary-settings` + templates/models | ✅ | settings 有字段；模板/模型空列表 |
| GET `/attendance/reschedules` | ✅ | 1 条 |
| GET `/campus-invites`（`member:invite`） | ✅ | 种完 RBAC 后 200 |
| POST `/campus-invites` 点对点（HTTP） | ⚠️ | 运行中进程仍用旧 `uuid()` 校验 → 400（种子 ID 为 `campus-center`） |
| `createCampusInvite` service 点对点 | ✅ | `targetTeacherId=teacher-004` 写入成功并已 cancel 清理 |

课程分类：FE stub `[]` + store 默认班课/团课/私教 → **产品预期内 STUB**，非断链。

---

## 本轮已修

1. **local-dev 脚本清理**  
   仅保留：`start.cmd` / `start.sh` · `stop.cmd` / `stop.sh` · `check-dev.cmd`

2. **校长 JWT 无 org 时列表/写上下文回退**（对齐 classes/RBAC）  
   - `resolveStaffWriteContext` → DB `resolvePrincipalOrganizationId(user.userId)`  
   - `schedule.controller` list / today 同回退  
   - `class.controller` 原先误用 `req.user.id`（Profile 业务 id）→ 改为 `req.user.userId`

3. **本地 RBAC 空表导致邀请 403**  
   - 新增幂等 `prisma/seed-rbac.ts` + `npm run db:seed:rbac`  
   - `seed.dev-reset` 结束时补种 RBAC（避免下次重置再丢权限）  
   - 已对本库执行 `db:seed:rbac`（`org_owner` 含 `member:invite`）

4. **邀请校验过严**  
   - `campus-invite.validator`：`campusId` / `targetTeacherId` 改为非空业务 ID（兼容种子 `campus-center` / `teacher-004`）  
   - **HTTP 未绿**：WSL nodemon 未吃到 Windows 侧文件变更；**请你本地停/启一次 API** 后再打 `POST /campus-invites`

---

## HTTP 探测摘要（最后一次）

```
PASS auth / classes / schedules / subjects / holidays / salary* / reschedules / teachers / campuses / campus-invites.list
FAIL campus-invites.create.point-to-point — 400 校区 ID 格式不正确（旧进程）
```

原始 JSON：`yunce-backend/docs/diagnostics/2026-09-01-walkthrough-connectivity-probe.json`

---

## 你需要做的一步

1. 用 `scripts/local-dev/stop.cmd` → `start.cmd` 重载 API（吃到 validator + org 回退代码）  
2. 小程序：员工详情 →「邀请绑定微信」→ 生成码（应带 `targetTeacherId`）  
3. 可选复核：`npm run db:seed:rbac`（已种过可跳过）
