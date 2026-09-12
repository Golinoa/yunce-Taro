---
last_updated: 2026-09-12
status: active
owner: @product
source: 角色体系混乱导致的权限误判
---

# R60 角色与身份铁律（硬性）

> **触发条件**：涉及 `UserRole`、`orgRole`、`campusRole`、`identity`、角色文案、权限判定的任何改动，**必须先读完两份文档再动手**：
>
> - 技术口径：[`../../Docs/2026-09-11-role-naming-rules.md`](../../Docs/2026-09-11-role-naming-rules.md)
> - 业务口径（用户已拍板）：[`../../Docs/2026-09-11-role-boundary.md`](../../Docs/2026-09-11-role-boundary.md)
>
> 两份冲突时以**业务边界**为准，并反馈修订技术文档。

## 八条硬约束

1. **四层不得压成一维**——`L0 员工身份` / `L1 登录身份` / `L2 机构角色` / `L3 校区岗位` 各司其职。`UserRole` 现状是错误示范，不要再加码。

   ❌ 用一个 `UserRole` 同时表达机构角色和校区岗位
   ✅ FIX: 按 L0–L3 分别取用，判定时明确写清是哪一层。

2. **`orgRole` 只取大写 `OWNER` / `ADMIN` / `MEMBER`**

   ❌ `orgRole = 'principal'` / `'teacher'` / `'assistant'`
   ✅ FIX: 那些属于 L0/L3，不放进 `orgRole`。

3. **判机构管理员用 `OWNER || ADMIN`**

   ❌ 只判 `OWNER` 就把 `ADMIN` 当遗漏去"补"成另一种角色
   ✅ FIX: `isOrgAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN'`，按需再叠加 L1/L3 的 `PRINCIPAL`。

4. **权限判定与展示名称分离**

   ❌ 直接用后端返回的 `roleText` 显示
   ✅ FIX: `OWNER` 显示「管理员」，`ADMIN` 走 `identity` 显示「校长 / 店长 / 馆长」；文案统一走 `src/constants/role-glossary.ts`。
   > 后端两处 `ROLE_TEXT_MAP` 对 `principal` 给出「校长」「店长」两种中文，不可直接采信。

5. **`assistant`（助教）是后端正式身份**——不得删除或合并到 `reception`。`assist` 是 `Teacher.role` 的职位值，不是身份名。

6. **禁止混淆两个 ADMIN**——机构管理员（`OrganizationUserRole.ADMIN`）与平台运营管理员（`PlatformRole.ADMIN`）同名但完全无关。

7. **改角色判定必须同步核对单测假数据**——假数据用了错误字面量会让测试"保护"错误行为（见技术文档 C4）。

8. **前端隐藏入口不等于权限**——接口失败也要有无权限态，配合 `route-guard` / permission，不能只靠不显示按钮。

## 自检

- [ ] 是否把 L0–L3 压成了一维？
- [ ] `orgRole` 取值是否全大写且只有 OWNER/ADMIN/MEMBER？
- [ ] 权限判定与展示文案是否分离？
- [ ] 单测假数据是否同步？
