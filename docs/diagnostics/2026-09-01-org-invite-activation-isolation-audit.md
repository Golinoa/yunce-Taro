# 检查报告：机构主体 / 校区邀请码临时化 / 机构激活 / 数据隔离收口

> **日期**：2026-09-01  
> **对照**：`yunce-backend/docs/PM/index.html`「后端业务能力 · 还需要做」  
> **口径**：只检查、附代码证据；不改业务代码  
> **结论总判**：**部分已具备骨架，上线闭环未收口** — 邀请临时化与会员激活较成熟；**租户隔离仍有 P0 泄漏**

---

## 总览

| 主题 | 状态 | 一句话 |
|------|------|--------|
| 机构主体（入驻→审核→默认校区） | **部分完成** | store-entry 可建 PENDING 机构；审核变 ACTIVE + OWNER + 默认 Campus；**未**自动挂 CampusUser / 校长 Teacher |
| 校区邀请码临时化 | **基本完成** | `CampusInvite` 有过期/单次/取消；FE staff-invite 可选 30m～7d；与永久 `Teacher.inviteCode` 已区分 |
| 机构级激活逻辑 | **基本完成** | `redeem-activation-code` 兑会员档位/延期；**≠** 机构 `status` 审核激活（两套语义） |
| 机构数据隔离进一步收口 | **未达上线** | JWT/中间件有骨架，但 **微信登录可不带 org**、**校长统计全局**、**教师列表无 org 过滤** |

与 PM 文案「还需要做」对照：**三项都还需要继续收口**，其中隔离是当前最大上线风险。

---

## 1. 机构主体与校区邀请码临时化

### 已具备

| 能力 | 证据 |
|------|------|
| 门店入驻建机构 `PENDING` + `FREE` | `store-entry.service.ts` |
| 运营审核 → `ACTIVE` + `OrganizationUser` OWNER + 默认主校区 | `admin.store-entry.service.ts` L107–148 |
| `CampusInvite`：过期、PENDING/USED/EXPIRED/CANCELLED、10 位码、accept 建 Teacher+成员 | `campus-invite.service.ts` |
| 临时 TTL：`expireMinutes` / `expireDays`；默认 **2 天**（未传时） | `campus-invite.validator.ts` L50–55 |
| FE：员工邀请页时长选项 + landing 预览/接受 | `staff-invite`、`campus-invite-landing` |
| 禁止教师自助注册 | `auth.service.ts` findOrCreateProfile TEACHER → Forbidden |

### 缺口 / 风险

| ID | 严重度 | 问题 | 证据 |
|----|--------|------|------|
| O-01 | P1 | 审核通过**不**创建校长 `CampusUser` / `Teacher`，校长侧依赖 OWNER 解析，与「校区校长」RBAC 不完全同构 | `admin.store-entry.service.ts` 止于 Campus create |
| O-02 | P2 | 文档仍写默认 7 天，代码默认 2 天 | FIX 文档 vs `DEFAULT_EXPIRE_DAYS` |
| O-03 | P1 | `alreadyJoined` 再 accept **不刷新**租户 JWT | `campus-invite.controller.ts` |
| O-04 | 口径 | 永久码 `Teacher.inviteCode`（拉新/家长）≠ 临时 `CampusInvite`（员工加入）— 产品需在文案上分清 | schema + auth share |

### 产品目标链路

```
创建机构 → 创建校区 → 临时邀请码 → 教师加入
```

**代码层**：邀请生成→预览→accept→Teacher **已打穿**。  
**未打穿**：新校长审核后若只走微信登录且 JWT 无 org（见 §3），后续「邀请员工」可能仍断。

---

## 2. 机构级激活逻辑

### 两套「激活」勿混

| 语义 | 含义 | 入口 |
|------|------|------|
| **机构审核激活** | `Organization.status` PENDING→ACTIVE，可作租户用 | 运营审核 store-entry |
| **会员/套餐激活** | 兑 `ActivationCode` → 写 `MembershipGrant`、延长 `expireAt`、可能升 `versionCode` | `POST /organization/redeem-activation-code` |

兑码**不会**改 `status`（保持 ACTIVE）；新机构默认 FREE、无 expire。

### 已具备

- 路由 + service 兑码、作废/过期/重复使用校验 — `organization.service.ts` ~515–692  
- FE 会员页 `redeemActivationCode` — `services/organization.ts`  
- 配额：过期付费档在 assert 时按 FREE 执行（软降级）— `quota.service.ts`

### 缺口

| ID | 严重度 | 问题 |
|----|--------|------|
| A-01 | P1 | UI 展示档 vs 执行档可能不一致（展示仍用真实 versionCode） |
| A-02 | P2 | 无定时硬降级任务（仅请求时 soft enforce）— 需产品确认是否够用 |
| A-03 | 运维 | 测环境需预置 ActivationCode + Plan，否则走查兑码空转 |

---

## 3. 机构数据隔离进一步收口

### 已具备骨架

- ADR-0001：JWT 带 `organizationId`/`campusId`；按服务自过滤  
- `requireAuth` 注入 tenant；RBAC 依赖 `user.organizationId`  
- 密码登录 / invite accept / `switchAuthContext` 可签发带租户 token  
- 部分列表（如学员校长视角）缺 org 则空列表

### P0 泄漏（实锤）

#### I-01 校长统计「该机构」实为全库

```801:806:yunce-back/yunce-backend/src/auth/auth.service.ts
  if (profile.role === Role.PRINCIPAL) {
    // PRINCIPAL 角色统计：该机构下教师数和学生数
    const [teacherCount, studentCount] = await Promise.all([
      prisma.teacher.count({ where: { status: 'active' } }),
      countStudents({ status: 'ACTIVE' }),
    ]);
```

注释写机构，查询**无** `organizationId` → 多租户下数字串台。

#### I-02 教师列表无租户 where

```71:74:yunce-back/yunce-backend/src/teacher/teacher.service.ts
export const listTeachers = async (query: TeacherListQuery) => {
  const { page, pageSize, role, subject, status, keyword } = query;
  const where: Prisma.TeacherWhereInput = {};
```

可跨机构列出员工。

#### I-03 微信/初始化登录 JWT 可不带 org

`initializeUserWithTransaction` → `mintSessionAndTokens` **无租户字段**；`wechatLogin` 走该路径。refresh 只复制旧 payload → **一旦登录无 org，刷新也无 org**。  
密码登录有 `resolvePrimaryTenantForUser`；路径不一致。

#### I-04 遗留空字符串 organizationId

`attachBusinessRecords` 仍可写 `organizationId: ''`（教师自助已禁，路径未删）；同类空 org 风险在 card-type/statistics 等处需扫。

---

## 建议收口顺序（上线前）

1. **隔离 P0**：`listTeachers` + 校长 count 强制 `organizationId`；登录全路径注入 primary tenant（含微信）；禁写空 org。  
2. **机构主体**：审核通过补齐校长 CampusUser（及如需 Teacher）；微信登录后能开 staff-invite。  
3. **激活**：走查兑码闭环 + 文档写清「审核 ACTIVE ≠ 会员激活」；按产品决定是否硬降级。  
4. **邀请**：TTL 文档对齐；alreadyJoined 补发租户 token。

---

## 真机/测环境冒烟（建议）

1. 两机构各有教师/学员 → 校长 A 看员工列表与 `/auth/me` 统计 **仅 A**。  
2. 门店入驻 → 运营通过 → 微信重登 → JWT 含 org → 发 30min 邀请码 → 第二人 accept → 教师身份。  
3. 过期/已用邀请码拒绝。  
4. 兑运营激活码 → expireAt/档位变化；重复兑 409。  
5. 校长 token 直调他机构 studentId → 应 403/空，不得 200 出数据。

---

## 对 PM「还需要做」的答复

> 「机构主体与校区邀请码临时化、机构级激活逻辑、机构数据隔离进一步收口」

| 子项 | 是否可勾掉 |
|------|------------|
| 校区邀请码临时化 | **大体可勾**（剩文档/二次 accept/入驻校长角色补齐） |
| 机构级激活逻辑 | **会员兑码可勾骨架**；与审核激活语义需文档化；测环境种子必备 |
| 机构主体完整闭环 | **未勾完**（审核后身份/JWT 不稳） |
| 数据隔离进一步收口 | **不可勾** — 仍有全局统计与教师列表跨租户风险 |

**本检查会话不修代码**；若要修，请另开修项目会话并以上表 P0 为交接范围。
