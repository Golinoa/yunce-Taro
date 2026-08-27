# 预约类订阅消息 — 开发计划（合并版）

> 关联：[`06-template-apply-simple.md`](./06-template-apply-simple.md) · [`09`](../09-subscribe-message-api-contract.md) E21–E25  
> **原则：成功站内、课前微信、能并则并。**

---

## 1. 四种预约，同一套逻辑

| 类型 | 代码 / 入口 | 预约成功 | 开始前提醒 | 用户自助取消 | 机构改期/取消 |
|------|-------------|----------|------------|--------------|----------------|
| **班课试听** | trial / lead booking | 站内弹框 | 微信 **① `class_remind`** | 站内提示 | 微信 **② `schedule_change`** |
| **团课** | `group` / class-booking | 同上 | 同上 | 同上 | 同上 |
| **私教** | `private` / class-booking | 同上 | 同上 | 同上 | 同上 |
| **场地** | venue-booking | 同上 | 同上 | 同上 | 同上 |

**不新增** `group_booking` / `private_booking` / `venue_booking` / `booking_cancel` 四个模板 group。

---

## 2. 为什么合并

| 旧方案 | 问题 | 现方案 |
|--------|------|--------|
| 成功各发一条微信 | 人还在小程序里，浪费额度 | **只弹框**，可选 `requestAuth(①)` |
| 团/私/场各一个「成功」模板 | 标题重复、申请多、授权挤 5 槽 | **全部课前 → ①**，字段写类型 |
| 单独「预约取消」模板 | 用户取消时人也在 App 里 | 自助取消站内；机构取消走 **②** |

① 已申请：`OlSjLqwypy1Sh0JYM8iw-Lzr729fWhQ6-ROT4MkYwSw`  
字段示例：`课程名称` =「团课·泳班」/「私教·张教练」/「场地·羽毛球场A」/「试听·少儿英语」。

---

## 3. 前端事件（不 send，可 auth）

| 事件 | 何时 | 做什么 |
|------|------|--------|
| **E21** 团课预约成功 | book 成功 | 站内成功弹框；可选授权 ① |
| **E22** 私教预约成功 | 同上 | 同上 |
| **E23** 场地预约成功 | 同上 | 同上 |
| **E24** 班课试听预约成功 | trial book 成功 | 同上 |
| **E25** 用户自助取消成功 | cancel 成功 | 站内 Toast/弹框；**不** requestAuth、**不** 微信 send |

统一 preset 建议：`booking_success_remind_auth`（文案：「预约成功。开启上课前提醒？」→ 只拉 ①）。

---

## 4. 后端 dispatch（只课前 / 变更）

| 场景 | templateGroup | bizKey 示例 |
|------|---------------|-------------|
| 团课开始前 | `class_remind` | `group-booking-remind:{slotId}:{date}` |
| 私教开始前 | `class_remind` | `private-booking-remind:{slotId}:{date}` |
| 场地开始前 | `class_remind` | `venue-booking-remind:{bookingId}:{date}` |
| 试听开始前 | `class_remind` | `trial-booking-remind:{bookingId}:{date}` |
| 机构改/取消预约 | `schedule_change` | `schedule-change:{id}:{version}` 或 `booking-change:{recordId}:{version}` |

**禁止：** 预约 create 成功后 `dispatch` 任何微信模板。

课前汇总：同人同天多条预约 → **合并 1 条**（与班课课前规则一致）。

---

## 5. 前端模块

| 模块 | 内容 |
|------|------|
| FE-M19 | 团课/私教 book 成功 → `runFlow(E21/E22)`（站内 + 可选 auth ①） |
| FE-M20 | 场地 book 成功 → `runFlow(E23)` |
| FE-M21 | 试听 book 成功 → `runFlow(E24)` |
| FE-M22 | 用户取消 → `runFlow(E25)` 仅站内 |
| FE-M23 | preset `booking_success_remind_auth`（groups: `['class_remind']`） |

---

## 6. 后端模块

| 模块 | 内容 |
|------|------|
| BE-M16 | class-booking / venue-booking / trial **不**在 create 时 dispatch |
| BE-M17 | cron：四种预约开始前 → `dispatch(class_remind)` |
| BE-M18 | 机构改期/取消 → `dispatch(schedule_change)` |

**不再需要** `SUBSCRIBE_TMPL_GROUP_BOOKING` 等四个 env。

---

## 7. 验收

| # | 步骤 | 预期 |
|---|------|------|
| B-01 | 团课约一节 | **无**微信；有成功弹框；可授权 ①，remain 可 +1 |
| B-02 | 私教 / 场地 / 试听约成功 | 同上 |
| B-03 | 课前到点（有额度） | 微信 ①，remain-1；标题/字段能区分类型 |
| B-04 | 用户取消预约 | 仅站内；remain 不变 |
| B-05 | 机构取消/改期 | 微信 ②（有额度时） |

---

## 8. 与模板清单关系

微信侧仍只维护 **8 个**（见 `06`）。预约线 **0 个新模板**。
