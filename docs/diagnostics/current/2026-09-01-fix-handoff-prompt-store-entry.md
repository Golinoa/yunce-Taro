# 修复交接提示词 · 门店入驻口径对齐 + 缺口修复（2026-09-01）

> **用法**：整段复制到修项目会话。  
> **产品真源**：`docs/PM/current/2026-09-01-store-entry-product-glossary.md`（已拍板，勿再猜）  
> **主观察点**：`docs/PM/mvp-launch-checklist.html`  
> **宪法**：两端 `AGENTS.md`；禁止回 Mock；测环境真 API。  
> **本包只改代码与代码注释 / UI 文案**；PRD HTML 由诊断会话维护，冲突以 glossary 为准。

---

## 产品锁定（2026-09-01 用户已确认）

1. **管理员** = 入驻获批后的机构拥有者（`OWNER`）。UI **一律显示「管理员」**，不要用「校长」指创建人。  
2. **校长** = 仅校区 RBAC 岗位。  
3. **库内**：继续 `Profile.role = PRINCIPAL`（不改枚举）+ `OrganizationUser.OWNER`。  
4. **两条路径都要运营 Admin 批准**（防泛滥）。无免审。  
5. **分享落地**：未登录可**预览页 + 填表**；**提交时必须登录**（草稿回跳）；**绑邮箱 = 软要求**，提供「下次再说」，**不硬挡提交**。  
6. 批准后系统建**默认主校区**（写全申请单有字段）；预留同机构多校区。  
7. 机构之间隔离。

### 本迭代必补缺口（用户点名）

| ID | 项 |
|----|-----|
| B1 | pending 状态大小写统一 |
| B2 | 批准后 JWT / 会话带 `organizationId` |
| B3 | 批准建 Campus 写入申请单全字段（有则写） |
| B4 | UI/注释文案「管理员」+「门店入驻」+「需运营审核」 |
| B6 | 未登录可预览 store-entry；提交拦截登录；邮箱软绑 |

---

## Part A — 代码注释与 UI 文案

至少触及：

- `auth-onboarding.ts` / `identity-select` / `store-entry*` / `route-guard` / about 分享文案  
- `admin.store-entry.service.ts` / `store-entry.service.ts` 文件头  
- 身份选择：「我是管理员」/「门店入驻，提交后需运营审核」类表述  
- 禁止：「校长独立创建」「免审开机构」「产品偏差：审核」

术语：glossary 名词表。

---

## Part B — 代码缺口（必须修）

### B1 pending 状态大小写（P0）

- create 返回 `'pending'`，GET latest 返回 Prisma `'PENDING'`  
- FE pending 页小写比较 → 刷新易卡死  
- **统一**：API 对外一律大写 `PENDING|APPROVED|REJECTED`；FE 兼容大小写

### B2 批准后租户上下文（P0）

- 批准后管理员 JWT 常无 `organizationId`  
- 修：pending「进入机构端」强制刷会话 / `switchAuthContext`；登录路径对 ACTIVE+OWNER 注入 primary tenant

### B3 批准建校区写全表单（P0/本迭代）

- `Campus.create` 映射 application：name、address/region、phone、lat/lng（schema 有则写），`isMain=true`

### B4 文案「管理员」（P0）

- identity-select / store-entry / route-guard / 关于页 CTA  
- 区分：管理员（OWNER）vs 校区校长

### B5 多校区预留（注释 + 勿挖坑）

- 首校区 `isMain`；后续可 `POST /campuses`  
- FREE `maxCampuses=1` 可保留；勿写死永久单校区

### B6 分享 / 未登录预览（P0 · 已拍板）

- store-entry：**未登录可进、可填、可存草稿**（已有 `STORE_ENTRY_DRAFT_KEY` 则复用）  
- **提交**：无 token → 引导登录/微信登录，成功后回跳继续提交  
- **绑邮箱**：提交成功或提交前弹层可选绑定；按钮「下次再说」→ 仍可提交；Toast 说明用于收审核通过通知  
- 运营分享 path 尽量直达 store-entry（about 二次跳也可，但预览规则相同）

### B7 re-submit 与 `organizationId @unique`

- 与 schema 一致：更新原单 vs 历史记录策略说清并实现一致

---

## Part C — 明确不做（本包）

- 免审直开机构  
- 改 `Profile.role` 新枚举名  
- 家长端深化、付费多校区商业化一次做完  
- 硬拦截「无邮箱不可提交」

---

## 验收

- [ ] 未登录打开入驻页可预览/填表；提交弹出登录；登录后草稿还在可提交  
- [ ] 邮箱提示可「下次再说」且仍能提交  
- [ ] 自然量：登录 → 管理员/门店入驻 → 申请 → Admin 批 → 有主校区（字段齐）→ 进机构端 JWT 有 org  
- [ ] pending 刷新：PENDING/APPROVED/REJECTED 显示正确  
- [ ] UI 可见「管理员」「运营审核」；无「免审独立创建」  
- [ ] 单测：approve Campus 字段；latest 状态契约；未登录提交被拦

改完在 checklist 第 2 步注明代码状态；诊断会话会再渲染 MD。
