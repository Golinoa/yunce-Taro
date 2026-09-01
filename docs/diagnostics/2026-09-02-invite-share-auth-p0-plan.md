# 邀请 / 拉新 / 归属链路 P0 修复计划（业务口径已对齐）

> 制定日期：2026-09-02  
> **口径对齐 v1**：2026-09-02（L2 链路、线索/会员、login_only）  
> **口径对齐 v2**：2026-09-02（**L2/L3 统一临时邀请：24h + 绑定后失效**）  
> **实施进度**：Phase F/G/B2/H + **Phase C（L4 门店互邀）** 代码已完成；VH/V4T 真机项待统一测试

---

## 0. 业务链路总览

机构是**租户主体**；员工、家长、线索、会员都在机构隔离下运作。

| # | 业务名称 | 谁分享 | 谁进来 | 分享物 | 落地页 | 当前状态 |
|---|----------|--------|--------|--------|--------|----------|
| **L1** | 试听课 / 课程卡片 | 机构员工 | 客户 | 课表参数卡片 | `invite-landing` | ✅ 可用（规则见 §1.6） |
| **L2** | **员工拉家长** | 机构教师/员工 | 新客户（家长） | **临时邀请码/链**（24h） | `invite-register` | ✅ V2T 已通过 |
| **L3** | **机构拉员工** | 机构负责人 | 新教师/前台 | **临时邀请码**（24h） | `campus-invite-landing` | ✅ V3T 已通过 |
| **L4** | 门店互邀入驻 | 机构 A | 机构 B 创建者 | 入驻分享链（O 码） | `store-referral-landing` | ✅ 代码完成，真机待测 |
| — | 学员绑定家长 | 教师 | 家长 | 学员绑定 token | `parent-bind` | ✅ 可用（48h token，另口径） |

---

## 1. 统一邀请链接口径（v2，2026-09-02 确认）

> **L2 与 L3 采用同一套「临时邀请」语义**，仅业务对象不同（家长 vs 员工）。

### 1.0 统一规则表

| 规则 | L2 员工拉家长 | L3 机构拉员工 |
|------|---------------|---------------|
| **有效期** | 自生成起 **24 小时** | 自生成起 **24 小时** |
| **何时失效（用过）** | **`shareAttached` 绑定成功后** 立即失效 | **`accept` 接受邀请成功后** 立即失效 |
| **点击是否算使用** | **否**——仅打开/预览不算；必须完成绑定/接受 | **否** |
| **过期** | 超过 24h → 链接/码 **不可用**，提示过期 | 同左 |
| **已使用后再打开** | **绑定成功的那位用户** → **绑定成功页**；其他人 → **链接已失效** | **接受成功的那位员工** → **加入成功页**；其他人 → **已失效** |
| **码类型** | **临时码**（每次「去邀请」新生成） | **临时码** `CampusInvite`（已有） |
| **永久码** | ❌ **不再**用 `Teacher.inviteCode` 作分享链 | — |

### 1.1 失效时机（重要，避免误解）

```text
生成链接 ──24h内──► 打开落地页（仍有效，可多次打开）
                    │
                    ├─ 未完成绑定/接受 → 链接保持有效（直到过期）
                    │
                    └─ 完成绑定/接受 → 立即标记 USED，链接对该次邀请失效
```

- **不是**「点一次就废」
- **是**「绑定/接受成功才废」

### 1.2 L2 员工拉家长（补充口径，v1 仍有效）

| 项 | 口径 |
|----|------|
| 落地页 | `invite-register`（≠ 试听课 `invite-landing`） |
| 注册身份 | `PARENT`；视为已选「客户」身份 |
| 跳过选身份 | 绑定成功后不进 `identity-select` |
| 机构/邀请人 | 绑定到链接所属机构 + 发码员工 |
| 注册落库 | 新用户 → **线索 LEAD**；充值/发卡时升会员 |
| 老用户 | **login_only**，不重复 attach |
| 首页 | 自行注册 **静默**；仅 child-bind 弹关系确认 |
| 复制链接 | 直链 `invite-register?code=<临时码>` |

### 1.3 L3 机构拉员工（v2 统一后）

| 项 | 口径 |
|----|------|
| 现状 | `CampusInvite` 已有 `expireAt` / `PENDING|USED|EXPIRED` / accept 后 USED |
| **需改** | 默认与选项 **统一为 24h**（现 FE 可选 30m～7d，BE 默认 2 天） |
| 落地页 | `campus-invite-landing`：过期/已用/成功 分态展示 |
| 接受后 | 已有 USED 逻辑 ✅；补 **成功页/已失效页** 与 L2 一致 |

### 1.4 线索 vs 会员（v1，仍有效）

| 项 | 口径 |
|----|------|
| 注册瞬间 | 一律 **LEAD**（不在注册时用课包 Q2 升会员） |
| 升会员 | 充值课包 / 发会员卡 / 发课时 时检查并升级 |
| 会员持久性 | 课时用完、课包过期 **仍是会员** |

### 1.5 L4 门店互邀 / L1 试听课

- **L4**：仍为独立 P0-C，不受 L2/L3 临时码规则约束  
- **L1**：试听落地页自有 `InviteRecord` TTL；**不**与 L2 员工拉家长混用

### 1.6 与旧文档差异（O-04 废止）

| 旧口径（2026-09-01 PM） | 新口径（v2） |
|-------------------------|--------------|
| `Teacher.inviteCode` **永久**，拉家长 | **临时码** 24h + 绑定后失效 |
| `CampusInvite` 临时，可选 30m～7d | **统一 24h** |
| 永久 vs 临时「产品分清」 | L2/L3 **均为临时**；`Teacher.inviteCode` 仅保留为内部档案字段，**不参与分享** |

---

## 2. 代码现状 vs 新口径（差距）

### 2.1 L2 — 已实现（Phase F ✅）

| 项 | 状态 | 说明 |
|----|------|------|
| `invite-register` 可达 + 直链 | ✅ | |
| POST inviteCode + PARENT + shareAttached | ✅ | 解析 **ParentShareInvite** 临时 P 码 |
| LEAD-only + login_only | ✅ | |
| **临时码 24h** | ✅ | `ParentShareInvite` |
| **绑定后 USED** | ✅ | attach 成功 mark USED |
| **成功/过期/已用 分态页** | ✅ | `invite-landing-view-state` |
| wxacode | ✅ | 临时 P 码 + `c=CODE` scene |

### 2.2 L3 — 已实现（Phase G ✅）

| 项 | 状态 | 说明 |
|----|------|------|
| expireAt + USED on accept | ✅ | |
| 默认/选项 24h | ✅ | BE 默认 1440min；FE 仅 24h |
| 已接受后再开 → 成功页 | ✅ | `campus-invite-landing` |

### 2.3 推荐技术方案（L2 临时码）

新增表 **`ParentShareInvite`**（命名可调整），字段对齐 `CampusInvite`：

```text
id, organizationId, campusId, teacherId, inviteCode (唯一临时码)
invitedByUserId, expireAt, usedAt, usedByUserId
status: PENDING | USED | EXPIRED | CANCELLED
```

链路：

```text
教师点「邀请家长」→ POST 创建 ParentShareInvite（expireAt = now + 24h）
  → 链接 invite-register?code=XXX
  → GET /share/context?inviteCode=XXX 校验 PENDING + 未过期
  → 新用户 wechat-login + attachShareContext 成功
  → 事务内标记 ParentShareInvite USED + usedByUserId
  → 再次打开：绑定者见成功页；他人见已失效
```

`Teacher.inviteCode`：**不再**写入分享 URL / wxacode scene。

---

## 3. 缺口分级（更新）

### P0-F — L2 临时邀请码（v2 新增，挡完整验收）

| ID | 问题 |
|----|------|
| P0-F1 | 无 `ParentShareInvite` 表与 create/list API |
| P0-F2 | `share/context` / attach 仍查永久 `Teacher.inviteCode` |
| P0-F3 | 绑定成功未 mark USED |
| P0-F4 | 落地页缺 **过期 / 已用 / 绑定成功** 三态 |
| P0-F5 | `getMyShareInvite` / wxacode / 复制链须改为 **生成临时码** |
| P0-F6 | 参数从 `teacherCode` 迁移为 `code`（或兼容期双读） |

### P0-G — L3 统一 24h（v2 新增）

| ID | 问题 |
|----|------|
| P0-G1 | BE 默认 TTL 改为 24h |
| P0-G2 | FE `staff-invite` 过期选项收敛为 **24h**（或 max 24h） |
| P0-G3 | landing 已 accept 用户再开 → **加入成功页** |

### 已完成（v1 Phase A/B）

| ID | 状态 |
|----|------|
| P0-A1～A6 | ✅ 除临时码相关外 |
| P0-B1、B3、B4 | ✅ |
| P0-B2 | ✅ 充值/发卡/建课包升 MEMBER hook |

### 仍待（P1 / P2 / 真机）

- ~~P0-C L4 门店互邀~~ ✅ 代码完成  
- **真机统一验收** VH-x + V4T-x + 跨链路（见 §11）  
- P1 微信登录性能（门禁：真机验收通过后，见 §12）  
- 首页机构公告/活动弹框（见 §12）

---

## 4. 修复阶段（更新顺序）

### ~~Phase A/B~~ — L2 基础（✅ 已完成，**F 阶段会部分重构**）

### **Phase F — L2 临时邀请码（下一批 P0，v2）**

| 步骤 | 内容 |
|------|------|
| F1 | Prisma `ParentShareInvite` + migration |
| F2 | `POST /parent-share-invites` 创建（24h）；`GET` 列表 |
| F3 | `GET /share/context` 改查临时码 + 返回 `status`（pending/expired/used） |
| F4 | `attachShareContext` 成功 → mark USED |
| F5 | FE：教师端「邀请家长」走 create；复制/wxacode 用临时 `code` |
| F6 | `invite-register` 三态 UI + 绑定成功页 |
| F7 | 废弃分享链上的 `Teacher.inviteCode`；测试 + 迁移说明 |

### **Phase G — L3 统一 24h（可与 F 并行）**

| 步骤 | 内容 |
|------|------|
| G1 | BE `resolveExpireAt` 默认 **1440 分钟** |
| G2 | FE `staff-invite` 仅 24h（或隐藏其它选项） |
| G3 | `campus-invite-landing` 已接受用户 → 成功页 |

### **Phase H — 真实小程序码（✅ 2026-09-02，H5 社区/官方对齐）**

| 步骤 | 内容 |
|------|------|
| H1 | BE scene 编解码：P/E/S 用 `c=CODE`（key=value）；UUID 仍 compact ≤32 |
| H2 | `GET /teachers/me/wxacode` 返回 PNG base64；失败明确报错 |
| H3 | FE `invite-qrcode` 创建临时码 + 展示真实小程序码 |
| H4 | FE `resolveInviteCodeFromPageEntry`：`?code=` 优先；scene 多源读取 + decode |
| H5 | BE `check_path`：`release` 为 true，trial/develop 为 false；scene 生成前校验 |

**官方/社区对照（2026-09-02 查证）**

| 要点 | 官方/社区 | 本项目 |
|------|-----------|--------|
| 接口 | `getwxacodeunlimit`，参数放 `scene` 非 `page` query | ✅ |
| scene 长度/字符 | ≤32 可见字符；`!#$&'()*+,/:;=?@-._~` 等 | ✅ `assertValidWxacodeScene` |
| page | 根路径前不加 `/`；不能带 query | ✅ `package-auth/pages/invite-register/index` |
| scene 落地 | 经 `query.scene` 传入，须 `decodeURIComponent` | ✅ Taro #3851 |
| scene 格式 | 社区推荐 `key=value` 便于扩展 | ✅ `c=PXXXXXX`；兼容裸 P 码 |
| 冷启动 | 部分真机 `useLoad` 无 scene，读 `getLaunchOptionsSync().query.scene` | ✅ `readWxacodeSceneParam` |
| check_path | 正式版 true（page 须已发布）；未发布用 false + env_version | ✅ 随 `WECHAT_MINI_ENV_VERSION` |
| env_version | 扫码环境须与码一致（release/trial/develop） | ✅ 配置项已有，Staging 须对齐 |
| 分享 path | 根路径前不加 `/` | ✅ `useShareAppMessage` 去前缀 |

**参考**： [获取小程序码](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/qr-code.html)、[getwxacodeunlimit](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/getUnlimitedQRCode.html)、Taro [#3851](https://github.com/NervJS/taro/issues/3851)、[#733](https://github.com/NervJS/taro/issues/733)

### Phase C — L4 门店互邀（✅ 2026-09-02 代码完成）

**业务口径（v1，2026-09-02 拍板）**

| 项 | 口径 |
|----|------|
| 分享者 | 机构 A 管理员（OWNER/ADMIN），机构须 **ACTIVE** |
| 被邀请者 | 机构 B 创建者（新门店入驻申请人） |
| 码类型 | **永久机构码** `O` 前缀（一机构一码，可复用） |
| 有效期 | **无 24h 限制**（与 L2/L3 临时码独立，见 §1.5） |
| 落地页 | `store-referral-landing?code=OXXXX` → 展示推荐机构 → 跳转 `store-entry` |
| 归因 | 提交入驻时写入 `StoreEntryApplication.referrerOrganizationId` |
| 分享入口 | 关于页「邀请朋友入驻」（登录管理员自动带 O 码） |

| 步骤 | 内容 | 状态 |
|------|------|------|
| C1 | Schema + migration | ✅ |
| C2 | BE `/org-referrals/me` + `/org-referrals/code/:code` | ✅ |
| C3 | store-entry 提交 `referralCode` 归因 | ✅ |
| C4 | FE 落地页 + pending 存储 + about 分享 | ✅ |
| C5 | 测试 V4T-1～3 | ✅ 自动化 |

---

## 5. 验收标准（更新）

### L2 临时邀请（V2T-x，**完整 P0 门禁**）

| # | 场景 | 预期 |
|---|------|------|
| V2T-1 | 生成邀请 | `expireAt` ≈ now+24h；链接含 **临时** code |
| V2T-2 | 24h 内多次打开未绑定 | 均可进入注册页 |
| V2T-3 | 新用户绑定成功 | LEAD + InviteRelation；邀请单 **USED** |
| V2T-4 | 绑定者再次打开 | **绑定成功页**（非再次注册） |
| V2T-5 | 他人打开已 USED 链接 | **链接已失效** |
| V2T-6 | 超过 24h | **已过期** |
| V2T-7 | 老用户 | login_only，不消耗邀请码 |

### L3 统一 24h（V3T-x）

| # | 场景 | 预期 |
|---|------|------|
| V3T-1 | 新建员工邀请 | TTL = 24h |
| V3T-2 | accept 成功 | USED；他人不可再用 |
| V3T-3 | 接受者再开链接 | 加入成功页 |
| V3T-4 | 过期 | 不可 accept |

### 原 V2-1～V2-6

在 **V2T-1～V2T-7** 通过后视为 L2 完整验收。

---

## 6. 前置检查逻辑（L2，仍有效）

打开招生页时先查账号状态；**另加**查邀请码 `status`：

```text
1. GET share/context → pending / expired / used / success_for_you
2. expired → 过期页
3. used + 非绑定者 → 失效页
4. used + 绑定者 → 成功页
5. pending + 已注册老用户 → login_only
6. pending + 新用户 → 注册绑定
```

---

## 7. 跨模块影响（v2 增量）

| 模块 | 变更 |
|------|------|
| `Teacher.inviteCode` | 退出分享链路；保留 DB 字段或后续 deprecate |
| `teacher.service` getMyShareInvite | 改为 create/list **ParentShareInvite** |
| `wxacode.service` | scene 改为临时码 |
| `share.service` | 校验 TTL + status |
| `campus-invite` | 默认 24h + landing 成功态 |
| PM O-04 文档 | **过时**，以本文 §1.0 为准 |

---

## 8. 待办 TODO

- [x] Phase F：L2 临时码全链路  
- [x] Phase G：L3 统一 24h  
- [x] Phase B2：充值升会员 hook  
- [x] Phase H：真实小程序码（invite-qrcode + wxacode scene）  
- [x] **Phase C：L4 门店互邀**  
- [ ] **真机统一验收**（VH-x + V4T-x + 跨链路，见 §11）  
- [ ] 首页机构公告/活动弹框（见 §12）  
- [ ] P1 微信登录性能（真机验收后，见 §12）

---

## 9. 参考索引（2026-09-02 更新）

| 文件 | 作用 |
|------|------|
| `parent-share-invite.service.ts` | L2 临时码 create/context/mark USED |
| `campus-invite.service.ts` | L3 临时码参考实现 |
| `org-referral.service.ts` | L4 永久 O 码 + 预览 |
| `share.service.ts` | L2 公开 context |
| `wxacode.service.ts` | 小程序码 scene 编解码 + 生成 |
| `wxacode-scene.ts` | FE scene 多源读取 + `c=CODE` 解析 |
| `invite-register/index.tsx` | L2 落地三态 |
| `campus-invite-landing/index.tsx` | L3 落地 |
| `store-referral-landing/index.tsx` | L4 落地 |
| `invite-qrcode/index.tsx` | L2 真码展示 |
| `about/index.tsx` | L4 分享入口（管理员带 O 码） |
| `store-entry.service.ts` | 入驻提交 + referral 归因 |
| `invite-relation.service.ts` | B2 升 MEMBER hook |
| `auth.service.ts` attachShareContext | L2 绑定 mark USED |

---

## 10. 验收记录（2026-09-02）

自动化验收套件：

| 套件 | 路径 |
|------|------|
| L2 V2T-1～6 | `yunce-backend/src/__tests__/invite-share-auth.acceptance.test.ts` |
| L2 V2T-3、7 | `yunce-backend/src/auth/__tests__/auth.share.test.ts` |
| L3 V3T-1～4 | `yunce-backend/src/__tests__/invite-share-auth.acceptance.l3.test.ts` |
| FE 分态 V2T-4/5/6、V3T-3/4 | `yunceTaro/src/utils/invite-landing-view-state.test.ts` |
| B2 升会员 | `yunce-backend/src/invite-relation/__tests__/invite-relation.service.test.ts` |

| # | 结果 | 证据 |
|---|------|------|
| V2T-1 | ✅ | `createParentShareInvite` expireAt≈24h + `code=` 直链 |
| V2T-2 | ✅ | 多次 `getParentShareInviteContext` 仍为 pending，不 mark USED |
| V2T-3 | ✅ | `wechatLogin` → LEAD + `parentShareInvite` USED |
| V2T-4 | ✅ | BE 返回 `usedByUserId`；FE `success_for_viewer` |
| V2T-5 | ✅ | BE attach 拒绝 USED；FE `used_invalid` |
| V2T-6 | ✅ | BE/FE `expired` 分态 |
| V2T-7 | ✅ | 老用户 login_only，不查 invite |
| V3T-1 | ✅ | `createCampusInvite` 默认 expireAt≈24h |
| V3T-2 | ✅ | accept → USED；他人 accept 被拒 |
| V3T-3 | ✅ | preview `usedByUserId`；FE 成功页 |
| V3T-4 | ✅ | 过期 accept 抛错；FE expired |

**CI**：BE `test:ci` 全绿；FE `npm test` 242 passed。

**未覆盖（建议 Staging 真机补验）**：真机扫 wxacode 打开 invite-register、跨设备转发、remote-e2e 全流程。

### Phase H 验收（VH-x）— **⏳ 待统一真机测试**

| # | 场景 | 预期 | 状态 |
|---|------|------|------|
| VH-1 | 教师打开 invite-qrcode | 创建临时码 + 展示 PNG 小程序码 | ⏳ 待测 |
| VH-2 | 扫码落地 | `c=P码` / legacy 裸码 → invite-register 正常加载 context | ⏳ 待测 |
| VH-3 | 微信未配置 | BE 503 + FE 错误提示与重试 | ⏳ 待测 |

### Phase C 验收（V4T-x）— **⏳ 待统一真机测试**

| # | 场景 | 预期 | 自动化 |
|---|------|------|--------|
| V4T-1 | 管理员 GET `/org-referrals/me` | 返回/懒生成 O 码 + landingPath | ✅ |
| V4T-2 | 打开 landing → 提交入驻 | `referrerOrganizationId` 写入申请 | ✅ |
| V4T-3 | 无效/非 ACTIVE 机构码 | 预览 404；绑定入口拒绝 O 码 | ✅ |

> 与 VH-x 一并安排 Staging 真机：about 分享 → 好友打开 landing → 走完 store-entry 提交。

---

## 11. 2026-09-02 实施总结

> 本文档当日完成：**Phase F/G/B2/H/C 全链路代码** + **Phase H 社区/官方对齐优化**。自动化 CI 已通过；**真机项统一待测**（§11.3）。

### 11.1 Phase F — L2 员工拉家长（临时码 24h）

| 变更 | 文件/模块 |
|------|-----------|
| 新增 `ParentShareInvite` 表 + migration | `prisma/schema.prisma`、`20260902_parent_share_invite` |
| 创建/预览/mark USED | `parent-share-invite.service.ts` |
| `share/context` 改查临时码 + status | `share.service.ts` |
| attach 成功 → USED | `auth.service.ts` |
| 教师端 create + 复制链 + wxacode | `teacher.service.ts`、`invite-parent-link.ts` |
| 落地三态 UI | `invite-register/index.tsx`、`invite-landing-view-state.ts` |
| 废弃分享链 `Teacher.inviteCode` | 全链路改 P 码 |

**业务语义**：24h TTL；**绑定成功才 USED**（打开不算）；老用户 login_only。

### 11.2 Phase G — L3 机构拉员工（统一 24h）

| 变更 | 说明 |
|------|------|
| BE 默认 TTL | `resolveExpireAt` → 1440 分钟 |
| FE `staff-invite` | 仅 24h 选项 |
| landing 成功态 | `campus-invite-landing` 已接受用户 → 加入成功页 |

### 11.3 Phase B2 — LEAD → MEMBER 升级

| Hook 点 | 文件 |
|---------|------|
| 建课包 / 充值 / 发卡 | `invite-relation.service.ts` |

注册仍为 LEAD；充值/发卡/建课包时升 MEMBER。

### 11.4 Phase H — 真实小程序码 + 社区/官方对齐

**问题**：初版 wxacode 未对照微信官方文档与 Taro 社区实践。

**查证来源**：[获取小程序码](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/qr-code.html)、[getwxacodeunlimit](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/getUnlimitedQRCode.html)、Taro [#3851](https://github.com/NervJS/taro/issues/3851)、[#733](https://github.com/NervJS/taro/issues/733)

| 优化项 | 改前 | 改后 |
|--------|------|------|
| scene 格式 | 裸 P 码 | 社区推荐 `c=PXXXXXX`；**兼容** legacy 裸码 |
| scene 读取 | 仅 `useLoad(options.scene)` | `readWxacodeSceneParam`：`useLoad` → `getLaunchOptionsSync().query.scene` → `router.params.scene` |
| scene 解析入口 | 页面内联 | `resolveInviteCodeFromPageEntry`（`?code=` 优先） |
| scene 校验 | 无 | BE `assertValidWxacodeScene`（≤32 字符 + 合法字符集） |
| check_path | 固定 `false` | `release` → true；`trial/develop` → false |
| 分享 path | 带 `/` 前缀 | `useShareAppMessage` 去 leading slash |
| wxacode 支持 O 码 | — | L4 预留 scene 编解码 |

**关键文件**：`wxacode.service.ts`、`wxacode-scene.ts`、`invite-register/index.tsx`、`invite-qrcode/index.tsx`

### 11.5 Phase C — L4 门店互邀

| 变更 | 说明 |
|------|------|
| Schema | `Organization.orgReferralCode`（O 前缀永久码）；`StoreEntryApplication.referrerOrganizationId` |
| Migration | `20260902_org_referral_l4` |
| BE API | `GET /org-referrals/me`（懒生成）；`GET /org-referrals/code/:code`（公开预览） |
| 入驻归因 | `store-entry` 提交/重提可选 `referralCode` |
| FE 落地 | `store-referral-landing` → pending O 码 → `store-entry` 提交 |
| 分享入口 | `about` 页登录管理员分享自动带 O 码 |
| 防误用 | O 码不可走「绑定机构」统一入口 |

**L4 与 L2/L3 差异**：永久可复用码；**无 24h**；**无单次 USED**；归因在入驻提交时写入。

### 11.6 自动化测试覆盖

| 套件 | 路径 | 结果 |
|------|------|------|
| L2 V2T-1～6 | `invite-share-auth.acceptance.test.ts` | ✅ |
| L2 V2T-3、7 | `auth.share.test.ts` | ✅ |
| L3 V3T-1～4 | `invite-share-auth.acceptance.l3.test.ts` | ✅ |
| L4 V4T-1～3 | `invite-share-auth.acceptance.l4.test.ts` | ✅ |
| B2 升会员 | `invite-relation.service.test.ts` | ✅ |
| wxacode roundtrip | `wxacode.service.test.ts`、`wxacode-scene.test.ts` | ✅ |
| FE 分态 | `invite-landing-view-state.test.ts` | ✅ |
| L4 FE 链接 | `invite-store-referral-link.test.ts` | ✅ |
| org-referral | `org-referral.service.test.ts` | ✅ |

---

### 11.7 真机验收清单（⏳ 统一待测）

> **前置**：Staging 部署 migration（`20260902_parent_share_invite`、`20260902_org_referral_l4`）；配置 `WECHAT_APP_ID/SECRET`；`WECHAT_MINI_ENV_VERSION` 与扫码环境一致。

### A. Phase H — 小程序码（VH-x）

| # | 场景 | 操作步骤 | 预期 | 状态 |
|---|------|----------|------|------|
| VH-1 | 教师生成码 | 登录教师 → `invite-qrcode` | 创建临时 P 码 + 展示 PNG | ⏳ |
| VH-2a | 扫码落地（新格式） | 另一台手机扫码 | 进入 `invite-register`；context 正常；scene=`c=P码` | ⏳ |
| VH-2b | 冷启动 scene | 杀进程后扫码 / 从最近使用进入 | scene 仍能解析（fallback 生效） | ⏳ |
| VH-2c | legacy 裸码 | 开发者工具编译 scene=`PABC12345` | 仍可解析 | ⏳ |
| VH-3 | 微信未配置 | BE 无 WECHAT 凭证时打开 invite-qrcode | BE 503 + FE 错误提示 + 可重试 | ⏳ |
| VH-4 | env_version 对齐 | 体验版扫 trial 码 / 正式版扫 release 码 | 能打开目标页；错环境应失败或跳错版本 | ⏳ |
| VH-5 | 分享转发 | 教师转发 invite-qrcode 分享卡片 | path 无 leading `/`；好友可打开 | ⏳ |

### B. Phase C — 门店互邀（V4T 真机）

| # | 场景 | 操作步骤 | 预期 | 状态 |
|---|------|----------|------|------|
| V4T-R1 | 管理员获 O 码 | 机构 A 管理员登录 → 关于页 | 分享 path 含 `store-referral-landing?code=O...` | ⏳ |
| V4T-R2 | 好友打开 landing | B 用户点分享卡片 | 展示机构 A 名称；CTA 可点 | ⏳ |
| V4T-R3 | 跳转入驻 | 点「申请门店入驻」 | 进入 store-entry；pending O 码已存 | ⏳ |
| V4T-R4 | 提交归因 | B 登录后提交入驻 | Admin/DB 可见 `referrerOrganizationId=机构A` | ⏳ |
| V4T-R5 | 无效码 | 打开 `?code=OINVALID1` | 失效提示页 | ⏳ |
| V4T-R6 | 非管理员分享 | 教师/家长打开 about 分享 | 仍走 generic about（无 O 码）或行为符合产品 | ⏳ |

### C. 跨链路回归（建议同一 Staging 会话）

| # | 场景 | 预期 | 状态 |
|---|------|------|------|
| X-1 | L2 完整：生成链 → 新家长注册绑定 | LEAD + USED + 绑定者再开成功页 | ⏳ |
| X-2 | L2：他人开已 USED 链 | 失效页 | ⏳ |
| X-3 | L3 完整：24h 员工邀请 accept | USED + 成功页 | ⏳ |
| X-4 | L2 跨设备转发 `invite-register?code=` | 链接可打开 + context 正常 | ⏳ |
| X-5 | B2 升会员 | 充值/发卡后 LEAD→MEMBER（抽一条走查） | ⏳ |

### D. 部署检查项

| # | 项 | 状态 |
|---|-----|------|
| D-1 | 跑 migration `20260902_parent_share_invite` | ⏳ Staging |
| D-2 | 跑 migration `20260902_org_referral_l4` | ⏳ Staging |
| D-3 | `invite-register` 页面已发布（release wxacode 需 check_path=true） | ⏳ |
| D-4 | `WECHAT_MINI_ENV_VERSION` 与测试包一致 | ⏳ |

**验收记录表**（真机测完填）：

| 日期 | 测试人 | 环境 | 通过项 | 失败项 | 备注 |
|------|--------|------|--------|--------|------|
| | | Staging | | | |

### 11.8 跨模块 Review 修复（2026-09-02）

> 全量 review 后补齐的维护缺口（非新功能，属 L4/bind-code/API 一致性）。

| ID | 严重度 | 问题 | 修复 |
|----|--------|------|------|
| R-1 | P1 | 无效 pending O 码阻断整单入驻 | BE `resolveReferrerOrganizationId` 无效码 soft-fail → `null` |
| R-2 | P1 | bind-code 未拒绝 P 前缀招生码 | BE `bindOrgByInviteCodeAsync` 增加 `parent` 分支 + 单测 |
| R-3 | P2 | Admin 看不到推荐归因 | BE `admin.store-entry` list/detail include `referrerOrganization` |
| R-4 | P2 | store-entry API 返回体不一致 | BE create/resubmit/getLatest 统一透出 `referrerOrganizationId` |
| R-5 | P2 | store-referral-landing 未入身份漏斗白名单 | FE `identity-path-allowlist` + `route-guard` PUBLIC_PAGES |
| R-6 | P2 | 重提未清理 pending O 码 | FE `store-entry/pending` resubmit 后 `consumePendingStoreReferralCode` |
| R-7 | P3 | org-referral 公开预览无限流 | BE `strictRateLimit` + Swagger |
| R-8 | P3 | BindOrgSheet 注释未说明 O/P | FE 注释更新 |

**自动化**：`organization.bind-code.test` O/P · `org-referral.service.test` soft-fail · `store-entry.service.test` 归因字段

---

## 12. 下一任务（P0 计划内未完成项）

> Phase F/G/B2/H/C **代码已全部交付**。按计划 §8，下一批工作如下。

### 12.1 立即优先 — 真机统一验收（§11.7）

**性质**：非新功能，是 P0 邀请链路的**上线门禁**。  
**建议顺序**：D 部署检查 → VH-x → V4T-R → X 跨链路回归。  
**产出**：§11.7 验收记录表填完；失败项开 bug 或回修。

### 12.2 下一功能任务 — 首页机构公告/活动弹框

| 项 | 说明 |
|----|------|
| 来源 | 计划 §8 TODO |
| 状态 | 🔴 未开始 |
| 范围（待产品确认） | 机构管理员配置公告/活动；首页弹框展示；频次/关闭策略 |
| 依赖 | 无硬依赖邀请链路；可与真机验收并行调研 |
| 建议第一步 | 产品确认：弹框触发条件、数据源（BE 表 or 运营配置）、角色可见范围 |

### 12.3 后续 — P1 微信登录性能优化

| 项 | 说明 |
|----|------|
| 文档 | `2026-09-02-wechat-login-optimization-plan.md` |
| 门禁 | **须先完成 §11.7 真机验收**（原文：P0 V1–V7 / 现扩展为 VH+V4T+X） |
| 内容概要 | 微信登录链路瘦身、缓存、减少冗余 API |
| 状态 | 🔴 未开始（被门禁阻塞） |

### 12.4 技术债（非本计划 P0，记录备查）

| ID | 项 | 文档 |
|----|-----|------|
| 租户隔离 P0 | 校长统计/教师列表跨 org 泄漏 | `2026-09-01-org-invite-activation-isolation-audit.md` |
| O-03 | alreadyJoined accept 不刷新 JWT | 同上 |
| FE typecheck | 3 个预存错误（与邀请无关） | — |
