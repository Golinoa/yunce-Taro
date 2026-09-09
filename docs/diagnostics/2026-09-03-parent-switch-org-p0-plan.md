> **历史资料（2026-09-08 收口）**：保留问题背景与证据；其中完成度、待办、命令和旧方案未经当前版本复验，不作为开发指令。当前工作从 [模块联调入口](../../../yunce-back/yunce-backend/docs/development/README.md) 开始。

# P0：家长切换机构（切换门店跨机构）迭代计划

> 日期：2026-09-03  
> 目标效果：家长在首页「切换门店」看到扁平列表「机构名 · 校区名」，可跨机构进入；选中 B 机构校区时换 JWT 机构上下文并刷新首页/课表。  
> 示例：A 机构 2 个可见校区 + B 机构 1 个可见校区 → 列表最多 3 行。

---

## 0. 产品约定（验收真源）

| 规则                 | 说明                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| 入口                 | 首页「切换门店」，员工/家长统一入口                                     |
| 家长可见项           | 所绑学员 **所属校区** 并集（扁平，不按机构折叠）                        |
| 展示                 | 主标题 `机构名 · 校区名`；副标题可选学员昵称                            |
| 切换                 | 同机构只切校区；跨机构必须 `switch-context` 换 token                    |
| 非目标（本迭代不做） | 机构一级聚合、课表校区标签改造、学员多所属校区模型、员工所属校区管理 UI |

本迭代 **P0 只保证家长跨机构可切换**；员工侧保持现有「当前机构下校区列表 + 本地 `campusId`」行为，除非顺手修复明显 bug。

---

## 1. 现有代码结构调查

### 1.1 前端（yunceTaro）

| 模块        | 路径                                              | 现状                                                                  |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| 首页入口    | `src/pages/home/index.tsx`                        | `handleConfirmCampus` 仅 `setCurrentCampusId`，不换机构               |
| 切换 Sheet  | `src/components/home/CampusSelectSheet/index.tsx` | 标题「选择上课门店」；只渲染 `campus.name`，无机构名                  |
| 校区 Store  | `src/stores/campus.ts`                            | `fetchCampuses` → `GET /campuses`（受当前 JWT `organizationId` 约束） |
| 会话        | `src/services/auth-session.ts`                    | 有 `refreshSessionForTenant`；**无** `listContexts` / `switchContext` |
| 身份切换    | `switchIdentity`                                  | 直接返回「暂未开放多身份切换」桩                                      |
| 角色切换 UI | `RoleSwitchSheet` / `role-switch`                 | 走本地 identity，**不是**机构切换                                     |

### 1.2 后端（yunce-backend）

| 模块       | 路径                                              | 现状                                                                     |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| 列上下文   | `GET /auth/contexts` → `listAuthContexts`         | 按 `OrganizationUser` 一行一机构；校区来自 **`CampusUser`**              |
| 切换上下文 | `POST /auth/switch-context` → `switchAuthContext` | 校验机构成员；指定 `campusId` 时要求 **`CampusUser` 或机构管理员**       |
| 发 token   | `issueTokensAfterTenantJoin`                      | 可写入 `organizationId` + `campusId`                                     |
| 校区列表   | `GET /campuses` → `listCampuses`                  | **强制当前 `organizationId`**，无机构则空列表                            |
| 家长绑定   | `bindStudentAsParentCore`                         | upsert `OrganizationUser(MEMBER)` + `StudentParent`；**不写 CampusUser** |

### 1.3 数据关系（与本需求相关）

```text
User ── OrganizationUser[]     （家长可多机构）
     └── StudentParent[]       （绑学员）
              └── Student.campusId   （当前：单所属校区）
CampusUser                     （员工任职校区；家长通常没有）
```

---

## 2. 质量评估与缺陷

### 2.1 致命缺陷（不修则 P0 无法达成）

| ID  | 缺陷                                                  | 影响                                          |
| --- | ----------------------------------------------------- | --------------------------------------------- |
| D1  | 前端从未调用 `/auth/contexts`、`/auth/switch-context` | 家长无法在产品里切换机构                      |
| D2  | `switchAuthContext` 对非管理员要求 `CampusUser`       | 家长传 `campusId` → **403 无权切换到该校区**  |
| D3  | 家长门店列表若继续用 `GET /campuses`                  | 只能看到**当前机构**校区，列表凑不出 A+B      |
| D4  | `listAuthContexts` 用 `CampusUser` 填校区             | 家长上下文常缺可用 `campusId`，或只落到主校区 |

### 2.2 体验 / 结构缺陷

| ID  | 缺陷                                                 | 影响                         |
| --- | ---------------------------------------------------- | ---------------------------- |
| D5  | Sheet 只显示校区名                                   | 跨机构时无法区分「哪家机构」 |
| D6  | 确认切换后未统一刷 token / profile / campuses / home | 即使调了 API 也会数据残留    |
| D7  | `currentCampusId` 本地存储无 `organizationId` 维度   | 跨机构后可能误用旧校区 ID    |

### 2.3 相关债

| ID      | 问题                                | 建议                                                     |
| ------- | ----------------------------------- | -------------------------------------------------------- |
| R1 / D9 | `StudentParent.profileId @unique`   | **P0 硬依赖**：先验证第二机构绑定；失败则同迭代改 schema |
| R2      | `InviteRelation.inviteeUserId` 唯一 | 第二机构覆盖归因；非切换阻塞，可后置                     |
| R3      | 学员仅单 `campusId`                 | 「跨校区上课」真多所属后置；P0 按现字段并集              |
| D8      | `/home/parent` 不按 org 过滤        | **P0 硬依赖**，见 §8                                     |

### 2.4 结论

- 账号模型 **意图**支持一家长多机构，但 D9/D8 使闭环不完整。
- 切换链路 **后端半成品 + 权限不适合家长 + 前端未接 + 首页未按租户收敛**。
- 评级：功能缺口 P0；**不可**只接前端；详见 §8 再审查。

---

## 3. 目标架构（本迭代）

```text
家长打开「切换门店」
  → GET /auth/parent-storefronts（或扩展 contexts）
  → 扁平列表：[{ orgId, orgName, campusId, campusName, students[] }]
  → 用户选中一项
  → 若 orgId === 当前 JWT.org：仅 setCurrentCampusId + 刷新首页
  → 若 orgId !== 当前 JWT.org：
        POST /auth/switch-context { organizationId, campusId }
        → 落新 token
        → 更新 profile.currentContext
        → setCurrentCampusId
        → fetchCampuses + 重载首页家长数据
```

**授权规则（家长）：**

- 可切换到的 `(organizationId, campusId)` 当且仅当：存在有效 `StudentParent`（`BOUND` 且 `revokedAt` 空），且对应 `Student.organizationId` 匹配、`Student.campusId` 匹配。
- **不再**要求家长有 `CampusUser`。

**员工（本迭代）：** 仍用现有 `campuses` 列表 + 本地切换；不强制改员工 API。

---

## 4. 迭代详细计划

### Phase A — 后端（含审查硬依赖，约 1–1.5d）

#### A0. 多机构绑定前置（D9）

- 用同一 User 绑 A、B 两机构学员，确认第二条 `StudentParent` 可创建。
- 若撞 `profileId` 唯一约束：迁移去掉全局 `@unique`，保留 `@@unique([studentId, profileId])` 与 `studentId_userId`；绑定/查询统一以 `userId` 为主。

#### A1. 新增家长门店列表接口

**推荐：** `GET /auth/parent-storefronts`（语义清晰，避免把员工 contexts 搅乱）

响应示例：

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "organizationId": "uuid-a",
        "organizationName": "云策艺术",
        "organizationStatus": "ACTIVE",
        "campusId": "uuid-a-main",
        "campusName": "总校区",
        "isMain": true,
        "students": [{ "id": "s1", "name": "小明" }]
      },
      {
        "organizationId": "uuid-a",
        "organizationName": "云策艺术",
        "organizationStatus": "ACTIVE",
        "campusId": "uuid-a-east",
        "campusName": "城东校区",
        "isMain": false,
        "students": [{ "id": "s1", "name": "小明" }]
      },
      {
        "organizationId": "uuid-b",
        "organizationName": "星河琴行",
        "organizationStatus": "ACTIVE",
        "campusId": "uuid-b-main",
        "campusName": "总店",
        "isMain": true,
        "students": [{ "id": "s2", "name": "小红" }]
      }
    ],
    "current": {
      "organizationId": "uuid-b",
      "campusId": "uuid-b-main"
    }
  }
}
```

#### A2. 修复 `switchAuthContext` 家长校区鉴权

在 `campusId` 分支中，对 `Profile.role === PARENT` 走学员归属校验，而不是 `CampusUser`。

#### A3. 家长读路径按租户收敛（D8，硬依赖）

- `getParentHome`：bindings / students / schedules / records 限制在 JWT `organizationId`；若请求带当前校区，再按学员 `campusId`（或 schedule.campusId）收窄。
- 快速审计其他「按 profile 拉全家孩子」的家长读接口，P0 至少保证首页与今日课表不串机构。

#### A4. 单测

- 两机构三校区可见 → list 长度 3
- 无绑定 → list 空
- 家长 switch 到有绑定的校区 → 200 + 新 token 含对应 org/campus
- 家长 switch 到未绑定校区 → 403
- 切到 B 后 `/home/parent` **仅**含 B 学员
- 员工/管理员原逻辑回归

---

### Phase B — 前端：会话 API + 应用 token（0.5d）

#### B1. `auth` service 增加

- `listParentStorefronts()`
- `switchAuthContext({ organizationId, campusId })`

#### B2. 应用登录响应

复用现有「落 token + map profile」路径（对齐 `refreshSessionForTenant`）：写入 session、更新 `useAuth` profile、再刷 campus store。

#### B3. 本地校区 key

建议：`yunce_current_campus_id` 切换成功后写入；可选增加 `yunce_current_org_id`，启动时若 org 与 JWT 不一致则丢弃旧 campusId。

---

### Phase C — UI：Sheet + 首页接线（0.5–1d）

#### C1. 扩展列表项模型

```ts
type StorefrontItem = {
  organizationId: string;
  organizationName: string;
  campusId: string;
  campusName: string;
  studentNames?: string[];
  isMain?: boolean;
};
```

#### C2. `CampusSelectSheet`（或抽 `StorefrontSelectSheet`）

- 家长：标题仍「选择上课门店」；主文案 `${organizationName} · ${campusName}`；副文案学员
- 员工：保持现有校区列表 UI（可继续只显示校区名）
- `key` 使用 `${organizationId}:${campusId}`，避免跨机构 campusId 碰撞（极端情况）

#### C3. `home/index.tsx` 确认逻辑

- 打开 Sheet：家长拉 `parent-storefronts`；员工拉现有 campuses
- 确认：跨机构走 switch；同机构只 setCampus + reload

---

### Phase D — 回归与验收（0.5d）

- 单机构单校区家长：列表 1 项，确认无报错
- A(2)+B(1) 三行展示与切换
- 切换后首页课包/课表机构正确
- 教师多校区原路径不回归

---

## 5. 示例代码

### 5.1 后端：家长门店聚合（示意）

```ts
// auth.service.ts — listParentStorefronts
export const listParentStorefronts = async (profileId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { userId: true, role: true },
  });
  if (!profile?.userId) return { list: [], current: null };
  if (profile.role !== Role.PARENT) {
    throw new ForbiddenError('仅家长可查询门店列表');
  }

  const bindings = await prisma.studentParent.findMany({
    where: {
      userId: profile.userId,
      bindStatus: 'BOUND',
      revokedAt: null,
      studentId: { not: null },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          campusId: true,
          organizationId: true,
          campus: { select: { id: true, name: true, isMain: true } },
          // organization 需 include：student.organization 或再查
        },
      },
    },
  });

  // key = orgId:campusId → merge students
  const map = new Map<string, ParentStorefrontItem>();
  for (const b of bindings) {
    const s = b.student;
    if (!s?.campusId) continue;
    const key = `${s.organizationId}:${s.campusId}`;
    const row = map.get(key) ?? {
      organizationId: s.organizationId,
      organizationName: '', // 批量补 org.name
      campusId: s.campusId,
      campusName: s.campus?.name ?? '',
      isMain: s.campus?.isMain ?? false,
      students: [] as { id: string; name: string }[],
    };
    if (!row.students.some((x) => x.id === s.id)) {
      row.students.push({ id: s.id, name: s.name });
    }
    map.set(key, row);
  }

  // ...补 organizationName、demo 策略过滤、current 从 JWT/主租户
  return {
    list: [...map.values()],
    current: {
      /*...*/
    },
  };
};
```

### 5.2 后端：家长切换鉴权（示意）

```ts
// switchAuthContext 内，替换纯 CampusUser 校验：
if (campusId) {
  const campus = await prisma.campus.findFirst({
    where: { id: campusId, organizationId: input.organizationId },
  });
  if (!campus) throw new BadRequestError('校区不存在或不属于该机构');

  const isOrgManager = orgMembership.role === 'OWNER' || orgMembership.role === 'ADMIN';

  if (profile.role === Role.PARENT) {
    const allowed = await prisma.studentParent.findFirst({
      where: {
        userId: profile.userId!,
        bindStatus: 'BOUND',
        revokedAt: null,
        student: {
          organizationId: input.organizationId,
          campusId,
        },
      },
    });
    if (!allowed) throw new ForbiddenError('无权切换到该校区');
  } else if (!isOrgManager) {
    const campusMembership = await prisma.campusUser.findUnique({
      where: { userId_campusId: { userId: profile.userId!, campusId } },
    });
    if (!campusMembership || campusMembership.status !== 'active') {
      throw new ForbiddenError('无权切换到该校区');
    }
  }
}
```

### 5.3 前端：切换确认（示意）

```ts
// pages/home/index.tsx
const handleConfirmStorefront = useCallback(
  async (item: StorefrontItem) => {
    const currentOrgId = profile?.currentContext?.organizationId;
    try {
      if (item.organizationId !== currentOrgId) {
        const login = await switchAuthContext({
          organizationId: item.organizationId,
          campusId: item.campusId,
        });
        await applyLoginSession(login); // 落 token + 重 map profile
        await fetchCampuses();
      }
      setCurrentCampusId(item.campusId);
      setShowCampusSheet(false);
      await loadData(item.campusId); // 重拉家长首页
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '切换失败',
        icon: 'none',
      });
    }
  },
  [profile, fetchCampuses, setCurrentCampusId, loadData],
);
```

### 5.4 Sheet 展示（示意）

```tsx
<Text className="text-[28rpx] font-semibold text-foreground truncate">
  {item.organizationName} · {item.campusName}
</Text>;
{
  item.studentNames?.length ? (
    <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
      学员：{item.studentNames.join('、')}
    </Text>
  ) : null;
}
```

---

## 6. 实施过程（建议顺序）

```text
Day 1
  [ ] A0 D9：第二机构绑定验证 / 必要时改 schema
  [ ] A2 switchAuthContext 家长鉴权 + D10 业务 id + 单测
  [ ] A1 GET /auth/parent-storefronts + 单测
  [ ] A3 getParentHome（及必要读路径）按 org/campus 过滤 + 单测

Day 2
  [ ] B1/B2 前端 API + applyLoginSession
  [ ] C2 Sheet 支持 StorefrontItem 展示
  [ ] C3 home 家长分支接线
  [ ] D 真机：A 两校区 + B 一校区；切 B 后首页孩子仅 B

缓冲
  [ ] 员工路径冒烟
  [ ] 单机构家长冒烟
  [ ] 演示机构策略确认不误伤
  [ ] （建议）D11 切换时吊销当前 session
```

**分支建议：** `feat/p0-parent-switch-org`  
**评审关注点：** 家长鉴权不得走 CampusUser；跨机构必须换 token；列表 key 含 orgId。

---

## 7. 验收标准

### 7.1 功能验收

| #   | 场景                                 | 期望                                                     |
| --- | ------------------------------------ | -------------------------------------------------------- |
| 1   | 家长仅 A 机构、学员属总校区          | 列表 1 行：`A · 总校区`；进入成功                        |
| 2   | 家长 A（学员属总校+城东）+ B（总店） | 列表 **3** 行，文案含机构名                              |
| 3   | 当前在 A·总校，选 B·总店             | token/`profile` 的 `organizationId` 变为 B；首页数据为 B |
| 4   | 再选回 A·城东                        | 回到 A；当前校区为城东                                   |
| 5   | 同机构 A·总校 → A·城东               | 可不换 token（或换也可）；课表/数据按城东过滤            |
| 6   | 尝试 switch 到无学员归属的校区       | 403/提示无权，列表中不出现该项                           |
| 7   | 教师多校区原「切换门店」             | 行为与改前一致（回归）                                   |

### 7.2 技术验收

| #   | 标准                                                                   |
| --- | ---------------------------------------------------------------------- |
| T1  | 家长 `POST /auth/switch-context` 带合法 `campusId` 返回 200（修复 D2） |
| T2  | `GET /auth/parent-storefronts` 不依赖 `CampusUser`                     |
| T3  | 跨机构切换后，后续 `GET /campuses`、家长首页 API 均带新 org 上下文     |
| T4  | 后端单测覆盖：list 聚合、允许/拒绝 switch                              |
| T5  | 前端对跨机构切换有 loading/失败 toast，失败不落半套 token              |

### 7.3 明确不验收（本迭代）

- 列表按机构分组折叠
- 课表行上「校区」标签改造
- 学员多所属校区模型（多对多）
- 员工「所属校区」管理后台 UI

---

## 8. 计划再审查（影响面 / 健康迭代）

> 审查日期：2026-09-03。结论：**方向正确，但原稿不完整；按本节补强后方可健康落地，否则会出现「能切换 token、首页仍串机构」的假完成。**

### 8.1 总评

| 维度                         | 判定                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| 产品目标                     | 合理，P0 范围可控                                                                       |
| 与员工链路隔离               | 可行：新建 `parent-storefronts` + switch 家长分支，**勿改** `listAuthContexts` 员工语义 |
| 直接接现有 API               | **不可行**（D2 CampusUser；D3 校区列表租户隔离）                                        |
| 仅做 auth 切换、不改首页聚合 | **不健康**（见 D8）                                                                     |
| 能否健康迭代                 | **可以**，必须把 D8/D9 纳入同迭代硬依赖                                                 |

### 8.2 新发现缺陷（原稿低估）

| ID      | 缺陷                                                                                                                | 不良影响                                                                                         | 修正（纳入 P0）                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D8**  | `GET /home/parent`（`getParentHome`）按 `profileId` 拉**全部**绑定学员，**不按** `organizationId` / `campusId` 过滤 | 切到 B 后首页仍可能看见 A 的孩子/课表 → 验收 #3/#4 失败，且像串租户                              | 家长首页（及同源家长课表聚合）必须按 JWT `organizationId` 过滤；同机构切校区时再按 `campusId`（或学员所属校区）过滤                                               |
| **D9**  | `StudentParent.profileId @unique`（全局唯一）+ `Profile.parent` 1:1                                                 | 同一家长绑第二名学员/第二机构时，写入 `profileId` 可能直接撞唯一约束；多机构前提可能根本建不起来 | P0 内验证：第二机构绑定是否成功。若失败，**同迭代**放宽为去掉全局 `@unique`，仅保留 `@@unique([studentId, profileId])` / `studentId_userId`，并用 `userId` 查绑定 |
| **D10** | `issueTokensAfterTenantJoin` 家长 `businessUserId` 固定 `profile.parent.id`                                         | 切机构后 JWT 业务 id 仍可能指向 A 的那条 `StudentParent`                                         | 切换时按目标 `organizationId` 解析一条该机构下的 `StudentParent.id` 写入 JWT；首页查询优先 `userUuid` + org，不单靠一条 parent 行                                 |
| **D11** | `switch-context` 只 mint 新 session，不显式吊销当前 session                                                         | 旧 access 在过期前仍可能可用（既有模式）                                                         | 建议切换成功后吊销**当前** session（或 bump sessionVersion）；属加固，不阻塞功能但利于健康                                                                        |

### 8.3 模块影响范围

| 模块                            | 影响                     | 是否不良                    | 做法                                           |
| ------------------------------- | ------------------------ | --------------------------- | ---------------------------------------------- |
| `POST /auth/switch-context`     | 增加 PARENT 校区鉴权分支 | 否（员工/管理员原分支保持） | **加法**修改 + 回归测 OWNER/ADMIN/`CampusUser` |
| `GET /auth/contexts`            | 本迭代**不改**           | 无                          | 家长走新接口，避免员工上下文语义被搅乱         |
| `GET /campuses`                 | 不改租户隔离             | 无                          | 家长跨机构列表不依赖它                         |
| `GET /home/parent`              | **必须改**过滤           | 不改则不良                  | 见 D8                                          |
| 家长课表/课包相关读接口         | 若同样按 profile 全集    | 可能不良                    | 审计并与 home 同步按 org（+campus）收敛        |
| 绑定学员 `bindStudentAsParent`  | 可能被 D9 挡住           | 既有债放大                  | 验证 + 必要时 schema 修正                      |
| 首页 `CampusSelectSheet`        | 家长展示字段扩展         | 低风险                      | 角色分支；员工 UI 默认保持                     |
| `stores/campus` / 本地 campusId | 跨机构残留               | 中                          | org 变化时重置/校验 campusId                   |
| 教师切换门店                    | 应零行为变化             | 回归必测                    | 不把教师列表改成 storefronts                   |
| 演示机构策略                    | 沿用 assert/filter       | 低                          | 单测覆盖禁止误进演示                           |

### 8.4 健康迭代原则（强制）

1. **垂直切片**：同一 PR/同一发布列车内包含「列表 + switch 鉴权 + 首页按 org 过滤」；禁止只上前端切换。
2. **加法优先**：员工 `CampusUser` 校验逻辑不删，只对 `Role.PARENT` 旁路。
3. **先证明多机构绑定**：D9 未解决则不做切换 UI（否则无第二机构可切）。
4. **验收以数据为准**：token 变了但 `/home/parent` 孩子集合未变 → 计失败。
5. **回滚面小**：新接口可开关/可仅家长调用；switch 家长分支用 role 守卫，出问题可快速关掉前端入口。

### 8.5 计划修订后的 Phase（替换原稿「可另开债」口径）

| Phase | 内容                                                          | 硬依赖   |
| ----- | ------------------------------------------------------------- | -------- |
| A0    | 验证/修复 D9（多学员/多机构绑定）                             | 阻塞后续 |
| A1    | `parent-storefronts`                                          |          |
| A2    | `switchAuthContext` 家长鉴权 + 目标机构 parent 业务 id（D10） |          |
| A3    | **`getParentHome`（及必要读路径）按 org/campus 过滤（D8）**   | 阻塞验收 |
| B/C   | 前端 API、Sheet、home 接线                                    | 依赖 A   |
| D     | 回归员工 + 家长三行场景验收                                   |          |

### 8.6 风险与缓解（更新）

| 风险                 | 缓解                              |
| -------------------- | --------------------------------- |
| 假完成：只换 token   | D8 同迭代；验收 #3 查首页学员 org |
| 第二机构绑不上       | A0 处理 D9                        |
| 误伤教师切换         | Sheet 角色分支 + 用例 #7          |
| 扩大改家长所有写接口 | P0 只改**读聚合**过滤；写路径另审 |
| 旧 session 残留      | D11 建议吊销当前 session          |
| 演示机构             | 复用现有 assert/filter            |

---

## 9. 交付清单

- [ ] A0：D9 验证/schema 修正（如需）
- [ ] 后端：`listParentStorefronts` + 路由
- [ ] 后端：`switchAuthContext` 家长分支 + 业务 id（D10）
- [ ] 后端：`getParentHome`（及必要家长读路径）org/campus 过滤（D8）
- [ ] 后端：单测（list / switch 允许拒绝 / home 过滤 / 员工回归）
- [ ] 前端：API + session apply（失败不落半套 token）
- [ ] 前端：Sheet 文案 `机构 · 校区`
- [ ] 前端：home 接线 + campus/org 本地一致性
- [ ] 文档：`INTEGRATION-MANUAL` 补充接口
- [ ] 验收表 #1–#7、T1–T5 通过

---

## 10. 一句话

**P0 = 家长门店列表 + 可 switch 的鉴权 + 首页按当前机构（校区）收敛数据；三者缺一不可。只接线前端或只改 token，会做成有害的假切换。**
