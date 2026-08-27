# 订阅消息 — 生产联调计划（2026-08-27）

> 模板登记：[`06-template-apply-simple.md`](./06-template-apply-simple.md)（①～⑪ 已齐）  
> 后端联调手册：[`yunce-back/yunce-backend/docs/INTEGRATION-MANUAL.md`](../../../yunce-back/yunce-backend/docs/INTEGRATION-MANUAL.md) §2.2.2

---

## 1. 分工总览

| 层 | 职责 | 状态 |
|----|------|------|
| **微信模板** | 11 个 tmplId 已申请 | ✅ |
| **后端 `.env`** | 贴 tmplId + 启 worker | 🔲 运维 |
| **后端代码** | 11 group、字段映射、cron、hooks、class-booking | ✅ |
| **后端单测** | `npm test -- subscribe-message class-booking` | ✅ 10 套件 / 56 用例 |
| **前端** | types/presets、message-auth、预约挂点、联调 | 🔲 进行中 |

---

## 2. 后端需贴 `.env`（发给后端同学）

```env
SUBSCRIBE_TMPL_CLASS_REMIND=OlSjLqwypy1Sh0JYM8iw-N5gJ3Jc6-TiChPDozIALHA
SUBSCRIBE_TMPL_SCHEDULE_CHANGE=UxTRaCVUV56uPr2mOdM0ktCUQbGLDXMrENQ5nWZmBeM
SUBSCRIBE_TMPL_LESSON_RESULT=QyhGHXojFTwxtTLkA_goRArJEDjzwzRf7MqGDmWnmAg
SUBSCRIBE_TMPL_TODO_REMIND=TBc6PVZ5gTtp4jHCgGUvk4ZWz3N5sMfEF4wFJvV2jcU
SUBSCRIBE_TMPL_PACKAGE_ALERT=kH2_5FMx52dsJThtpYN_6_NhHf1ctObukU4mjctP0bQ
SUBSCRIBE_TMPL_APPROVAL_PENDING=QSTDZ1w8CsQghIG63TWuPWi356De4VQj2lhkL7lzNZg
SUBSCRIBE_TMPL_APPROVAL_RESULT=K6m9hKMui9IrGzSXCm8DaX3gCi0Tm53SbHnT5usr3jc
SUBSCRIBE_TMPL_CALENDAR_ADD=Yy3lDFrBv0xARU0EC1qWmdc8jOpjmaqNeRrMrjk7OuY
SUBSCRIBE_TMPL_CALENDAR_CHANGE=PW9P-EnizjWEn4wycXv-tywxMr8hwKgoxuIPYlvPYog
SUBSCRIBE_TMPL_ORG_MEMBERSHIP=48kPgeFWtS7V0gp3kirFrk1yX6hLpbipaDRj93EGUgE
SUBSCRIBE_TMPL_ORG_MEMBERSHIP_RENEW=BVKN8vtinf806IKCmKHmUjJotIHqhR0oApZwNFOdSSE
SUBSCRIBE_LOW_THRESHOLD=3
```

**后端部署（P0 联调前）：**

```bash
cd yunce-back/yunce-backend
npm run db:generate
npm run db:deploy          # 20260827_subscribe_template_groups_extend + 20260827_class_booking
npm run dev
npm run worker:subscribe-message   # 另开终端，需 Redis
npm test -- subscribe-message class-booking
```

**后端已完成（2026-08-27）：**

1. Prisma enum 11 个 group + 迁移
2. `subscribe-message.config.ts` / `template-fields.ts` 语义字段 → 微信 key
3. Worker 6 个 job：`class-remind`、`booking-remind`、`custom-todo`、`unattended`、`package-alert`、`org-membership-alert`
4. 预约 create **禁止** dispatch；课前 cron 扫 venue/trial/group/private → `class_remind`
5. 机构改期/取消 → `schedule_change`（venue / trial / class-booking）
6. 请假审批 → `approval_pending` / `approval_result`
7. 机构续费 → `org_membership_renew_result`；到期预警 cron → `org_membership_alert`
8. `/class-booking` 最小 API（团课/私教预约挂点）

**仍待前端：**

- 课表页 E19/E20 挂点（调用 `POST /calendar-sync/report`）

---

## 3. 模板 send 字段（后端对照）

| group | 微信标题 | 字段 |
|-------|----------|------|
| class_remind | 签到提醒 | 课程名称、授课教师、课程日期 |
| schedule_change | 预约变更通知 | 预约项目、变更时间、变更原因、温馨提示 |
| lesson_result | 课时扣减通知 | 学员、课程、扣减数量、剩余课时、扣减时间 |
| todo_remind | 待办事项提醒 | 待办名称、待办内容、截止日期、事项类型 |
| package_alert | 续费提醒 | 温馨提醒、剩余课时、账号余额 |
| approval_pending | 待审批通知 | 事由、备注 |
| approval_result | 审批结果通知 | 申请内容、审批结果 |
| calendar_add | 日程提醒 | 事项分类、课程名、时间、地点、备注 |
| calendar_change | 日程删除通知 | 主题内容、操作时间 |
| org_membership_alert | 提前续费通知 | 企业名称、产品名称、到期时间、续费说明 |
| org_membership_renew_result | 会员续费结果通知 | 会员名称、续费结果、会员有效期、备注 |

后端使用**语义 key**（如 `courseName`），由 `subscribe-message.template-fields.ts` 映射为微信字段名，**禁止**在业务代码写 `thing1/thing2`。

---

## 4. 前端联调开关

```env
# yunceTaro .env.production
VITE_USE_MOCK=false
TARO_API_BASE_URL=https://你的后端/api/app/v1
```

真机：bootstrap 各 group `enabled: true` 且 `tmplId` 非空 → 授权面板才弹出。

团课/私教预约若走后端真接口，需对接 `/class-booking/*`（当前前端 mock 路径可能不同，联调时对齐）。

---

## 5. 前端批次（本次）

| 批次 | 内容 | 状态 |
|------|------|------|
| A | 11 group types + presets + mock | ✅ |
| B | message-auth 页（E17） | ✅ |
| C | 预约 E21–E24 挂点 | ✅（前端）；后端 `/class-booking` 已就绪 |
| D | E25 取消仅站内 | ✅（my-course + booking-record-detail） |
| E | 日历 E19–E20 | 后端 API ✅；前端挂点待接 |
| F | 审批/机构会员 dispatch | ✅ 后端 hooks + cron |
| G | 后端 enum + env 11 组 | ✅（需跑迁移 + 贴 env） |

---

## 6. 验收清单

### 6.1 前端授权链路

| # | 步骤 | 预期 |
|---|------|------|
| A-01 | 添加学员 E01 | 弹框 → auth → remain+1 |
| A-02 | 点名 E05 | renew sheet → auth |
| A-03 | bootstrap 4 P0 tmpl 配齐 | enabled true |
| A-04 | 场地预约成功 | Toast + 可选 auth class_remind |
| A-05 | message-auth 页 | 显示 remain，点击补充 |

### 6.2 后端 dispatch / cron

| # | 步骤 | 预期 |
|---|------|------|
| B-01 | worker `class-remind` | 排课课前 → 微信 ① |
| B-02 | worker `booking-remind` | 场地/试听/团课私教课前 → 微信 ① |
| B-03 | 机构取消场地/试听/团课预约 | 微信 ②，用户自助取消无微信 |
| B-04 | 点名 `remain>0` | 微信 ③；`remain=0` 仅站内 + pending |
| B-05 | 创建请假 | 审批人微信 ⑥ |
| B-06 | 审批结果 | 申请人微信 ⑪ |
| B-07 | 机构到期 7/3/1 天（测试数据） | 校长微信 ⑨ |
| B-08 | 后台给机构延期 | 校长微信 ⑩ |

### 6.3 工程化

```bash
npm test -- subscribe-message class-booking
# 期望：10 passed, 56 tests
```

---

## 7. 预约规则（勿改）

- **成功**：站内弹框 + 可选 auth **①**，不 send
- **开始前**：后端 cron → **①**
- **用户取消**：站内 only
- **机构改期/取消**：**②**

详见 [`08-booking-subscribe-plan.md`](./08-booking-subscribe-plan.md)

---

## 8. 覆盖率说明（后端）

| 模块 | Stmts | Branch | 备注 |
|------|-------|--------|------|
| subscribe-message | ~76% | ~48% | dispatcher/hooks/jobs 已覆盖主路径 |
| class-booking | ~57% | ~25% | service 订阅规则已测；controller 联调期补 |
| wechat.ts | ~20% | 0% | 依赖真实微信 API，单测 mock 在 dispatcher 层 |

分支覆盖率未达全局 50% 门槛主要因 `jobs.ts` 多数据源分支与 `wechat.ts` 未直连测试；**功能用例全部通过**。
