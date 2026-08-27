# 微信订阅消息模板申请清单（松果排课）

> 小程序可用类目：**办公 · 预约/报名 · 记账**  
> 类型：**一次性订阅 · 公共模板库**（不要长期订阅、不要自定义）  
> tmplId **只配后端 `.env`**，前端从 `bootstrap` 读取。

---

## 总表（11 个：教务 8 + 审批 2 + 机构会员 2）

| # | 后端 group | 后端 env | 优先级 | 状态 |
|---|------------|----------|--------|------|
| 1 | `class_remind` | `SUBSCRIBE_TMPL_CLASS_REMIND` | P0 | ✅ 已申请 |
| 2 | `schedule_change` | `SUBSCRIBE_TMPL_SCHEDULE_CHANGE` | P0 | ✅ 已申请 |
| 3 | `lesson_result` | `SUBSCRIBE_TMPL_LESSON_RESULT` | P0 | ✅ 已申请 |
| 4 | `todo_remind` | `SUBSCRIBE_TMPL_TODO_REMIND` | P0 | ✅ 已申请 |
| 5 | `package_alert` | `SUBSCRIBE_TMPL_PACKAGE_ALERT` | P1 | ✅ 已申请（学员课时） |
| 6 | `approval_pending` | `SUBSCRIBE_TMPL_APPROVAL_PENDING` | P1 | ✅ 已申请（待审批→审批人） |
| 7 | `calendar_add` | `SUBSCRIBE_TMPL_CALENDAR_ADD` | P0 | ✅ 已申请 |
| 8 | `calendar_change` | `SUBSCRIBE_TMPL_CALENDAR_CHANGE` | P0 | ✅ 已申请 |
| 9 | `org_membership_alert` | `SUBSCRIBE_TMPL_ORG_MEMBERSHIP` | P1 | ✅ 已申请（机构到期前） |
| 10 | `org_membership_renew_result` | `SUBSCRIBE_TMPL_ORG_MEMBERSHIP_RENEW` | P1 | ✅ 已申请（机构续费后） |
| 11 | `approval_result` | `SUBSCRIBE_TMPL_APPROVAL_RESULT` | P1 | ✅ 已申请（结果→申请人） |

**一次授权最多 5 个 tmplId，标题不能重复。**  
- 日历 ⑦⑧ 与课表 ② 分工见 [`07-calendar-sync-plan.md`](./07-calendar-sync-plan.md)  
- **预约成功不发微信**（站内弹框）；团课/私教/场地/班课试听 **课前全部走 ①**，见 [`08-booking-subscribe-plan.md`](./08-booking-subscribe-plan.md)  
- **② = 机构/教务改安排**（含改期、机构取消）；**不是**用户约成功

---

## 1. 上课/签到提醒 → `class_remind` ✅

| 项 | 内容 |
|----|------|
| **你已选标题** | 签到提醒 |
| **模板 ID（当前）** | `OlSjLqwypy1Sh0JYM8iw-N5gJ3Jc6-TiChPDozIALHA` |
| **关键词** | 课程名称、授课教师、课程日期 |
| **曾用 ID** | `OlSjLqwypy1Sh0JYM8iw-Lzr729fWhQ6-ROT4MkYwSw`（课程名称/签到时间/课程地点/温馨提示） |
| **建议类目** | 预约/报名 |
| **谁收** | 家长、任课教师、预约人 |
| **何时推送** | ① 开始前 **1 天 20:00** ② 开始前 **30 分钟** |
| **覆盖** | 班课正式课 · **班课试听** · **团课** · **私教** · **场地**（课前合并进本模板） |
| **汇总** | 同一人同一天多节/多预约 → **合并 1 条** |
| **不推** | 预约**成功**瞬间（人在小程序里 → 站内弹框） |

### 模板预览（当前）

```
签到提醒
课程名称   {班级/课程名}
授课教师   {教师名}
课程日期   {YYYY年MM月DD日 HH:mm~HH:mm}
详情 >
```

### 字段映射（发给后端）

| 微信字段 | 填什么 | 后端 key（待核对） |
|----------|--------|-------------------|
| 课程名称 | 班级名，或「团课·xx / 私教·xx / 场地·xx / 试听·xx」 | `thing?` |
| 授课教师 | 教师名 | `thing?` / `name?` |
| 课程日期 | 上课时间 | `time?` / `date?` |

---

## 2. 课表/预约变更 → `schedule_change` ✅

| 项 | 内容 |
|----|------|
| **最终标题** | 预约变更通知 |
| **模板 ID** | `UxTRaCVUV56uPr2mOdM0ktCUQbGLDXMrENQ5nWZmBeM` |
| **关键词** | 预约项目、变更时间、变更原因、温馨提示 |
| **谁收** | 家长、任课教师、预约人 |
| **何时推送** | 排课/调课/改时间/机构取消 **保存成功后即时** |
| **汇总** | 同一 `scheduleId+version` 只发 1 条 |

### 已选预览

```
预约变更通知
预约项目   {班级/团课/私教/场地名}
变更时间   {YYYY-MM-DD HH:mm}
变更原因   {调课 / 停课 / 机构取消}
温馨提示   {请以最新预约信息为准}
详情 >
```

### 字段映射

| 微信字段 | 填什么 | 后端 key（待核对截图编号） |
|----------|--------|---------------------------|
| 预约项目 | 名称 | `thing?` |
| 变更时间 | 时间 | `time?` |
| 变更原因 | 说明 | `thing?` |
| 温馨提示 | 文案 | `thing?` |

---

## 3. 点名/消课结果 → `lesson_result` ✅

| 项 | 内容 |
|----|------|
| **最终标题** | 课时扣减通知 |
| **模板 ID** | `QyhGHXojFTwxtTLkA_goRArJEDjzwzRf7MqGDmWnmAg` |
| **关键词** | 学员、课程、扣减数量、剩余课时、扣减时间 |
| **谁收** | 绑定家长 |
| **何时推送** | 教师 **提交点名成功后即时** |
| **汇总** | 同一孩子同一节课 1 条 |

### 已选预览

```
课时扣减通知
学员       {学员姓名}
课程       {班级/课程名}
扣减数量   {2课时 / 0课时}
剩余课时   {8课时}
扣减时间   {YYYY-MM-DD HH:mm:ss}
详情 >
```

### 字段映射

| 微信字段 | 填什么 | 后端 key（待核对） |
|----------|--------|-------------------|
| 学员 | 学员姓名 | `thing?` / `name?` |
| 课程 | 班级/课程 | `thing?` |
| 扣减数量 | 本次消课 | `thing?` / `number?` |
| 剩余课时 | 扣后余额 | `thing?` / `number?` |
| 扣减时间 | 点名时间 | `time?` |

---

## 4. 待办/事务提醒 → `todo_remind` ✅

| 项 | 内容 |
|----|------|
| **最终标题** | 待办事项提醒 |
| **模板 ID** | `TBc6PVZ5gTtp4jHCgGUvk4ZWz3N5sMfEF4wFJvV2jcU` |
| **关键词** | 待办名称、待办内容、截止日期、事项类型 |
| **谁收** | 教师、顾问、校长 |
| **何时推送** | ① 自定义待办 **到 remindAt** ② 当天有课 **20:00 未点名汇总** |
| **汇总** | 同一分钟多条待办 → **1 条**；未点名每天每师 **1 条** |

### 已选预览

```
待办事项提醒
待办名称   {跟进家长/补点名}
待办内容   {简要说明}
截止日期   {2020年6月30日 09:00}
事项类型   {自定义待办 / 未点名 / 跟进}
详情 >
```

### 字段映射

| 微信字段 | 填什么 | 后端 key（待核对） |
|----------|--------|-------------------|
| 待办名称 | 待办标题 | `thing?` |
| 待办内容 | 说明 | `thing?` |
| 截止日期 | 到期时间 | `time?` |
| 事项类型 | 类型标签 | `thing?` |

---

## 5. 课时/账户提醒 → `package_alert` ✅（P1）

| 项 | 内容 |
|----|------|
| **最终标题** | 续费提醒 |
| **模板 ID** | `kH2_5FMx52dsJThtpYN_6_NhHf1ctObukU4mjctP0bQ` |
| **关键词** | 温馨提醒、剩余课时、账号余额 |
| **谁收** | 家长、跟进教师 |
| **何时推送** | 每天 **10:00** 扫描：剩余课时 ≤ 阈值 / 到期前 7·3·1 天 |
| **汇总** | 同一学员同一天 **1 条** |

### 已选预览

```
续费提醒
温馨提醒   {XX 剩余课时不足，请及时续费}
剩余课时   {1}
账号余额   {10元 / —}
详情 >
```

### 字段映射

| 微信字段 | 填什么 | 后端 key（待核对） |
|----------|--------|-------------------|
| 温馨提醒 | 文案（可含学员名） | `thing?` |
| 剩余课时 | 剩余数 | `number?` / `thing?` |
| 账号余额 | 金额或占位 | `amount?` / `thing?` |

---

## 6. 待审批 → `approval_pending` ✅（P1）

| 项 | 内容 |
|----|------|
| **最终标题** | 待审批通知 |
| **模板 ID** | `QSTDZ1w8CsQghIG63TWuPWi356De4VQj2lhkL7lzNZg` |
| **关键词** | 事由、备注 |
| **谁收** | 审批人 |
| **何时推送** | 有新的待审批事项 |

### 已选预览

```
待审批通知
事由       {审批事项摘要}
备注       {补充说明}
详情 >
```

---

## 11. 审批结果 → `approval_result` ✅（P1）

| 项 | 内容 |
|----|------|
| **最终标题** | 审批结果通知 |
| **模板 ID** | `K6m9hKMui9IrGzSXCm8DaX3gCi0Tm53SbHnT5usr3jc` |
| **关键词** | 申请内容、审批结果 |
| **谁收** | 申请人 |
| **何时推送** | 审批通过/驳回后即时 |

### 已选预览

```
审批结果通知
申请内容   {事项摘要}
审批结果   {通过 / 驳回}
详情 >
```

### 字段映射

| 微信字段 | 填什么 | 后端 key（待核对） |
|----------|--------|-------------------|
| 申请内容 | 事项摘要 | `thing?` |
| 审批结果 | 通过/驳回 | `thing?` |

---

## 9. 机构会员到期 → `org_membership_alert` ✅（P1）

| 项 | 内容 |
|----|------|
| **最终标题** | 提前续费通知 |
| **模板 ID** | `48kPgeFWtS7V0gp3kirFrk1yX6hLpbipaDRj93EGUgE` |
| **关键词** | 企业名称、产品名称、到期时间、续费说明 |
| **谁收** | **机构创建人**（非学员家长） |
| **何时推送** | 机构会员卡到期前 N 天 / 到期日 |
| **说明** | 过期后无法继续享受会员服务；**勿与 ⑤ 学员课时续费提醒混用** |

### 已选预览

```
提前续费通知
企业名称   {机构名}
产品名称   {会员套餐/版本}
到期时间   {到期日}
续费说明   {到期后将无法继续使用会员功能，请及时续费}
```

### 字段映射

| 微信字段 | 填什么 | 后端 key（待核对） |
|----------|--------|-------------------|
| 企业名称 | 机构名 | `thing?` |
| 产品名称 | 会员产品名 | `thing?` |
| 到期时间 | 到期日 | `time?` |
| 续费说明 | 文案 | `thing?` |

---

## 10. 机构续费结果 → `org_membership_renew_result` ✅（P1）

| 项 | 内容 |
|----|------|
| **最终标题** | 会员续费结果通知 |
| **模板 ID** | `BVKN8vtinf806IKCmKHmUjJotIHqhR0oApZwNFOdSSE` |
| **关键词** | 会员名称、续费结果、会员有效期、备注 |
| **谁收** | **机构创建人** |
| **何时推送** | 机构会员 **续费支付成功** 后即时 |
| **授权** | 续费成功页可顺带 requestAuth（⑨+⑩），为后续到期提醒 **补充可发送次数** |

### 已选预览

```
会员续费结果通知
会员名称   {机构名}
续费结果   {续费成功}
会员有效期 {2027-12-31}
备注       {点击查看详情}
```

### 字段映射

| 微信字段 | 填什么 | 后端 key（待核对） |
|----------|--------|-------------------|
| 会员名称 | 机构名 | `thing?` / `name?` |
| 续费结果 | 成功/失败 | `thing?` |
| 会员有效期 | 新到期日 | `time?` / `date?` |
| 备注 | 文案 | `thing?` |

> **与 ⑨ 分工：** ⑨=到期前提醒 · ⑩=续费结果通知。

---

## 7–8. 手机日历 → `calendar_add` / `calendar_change` ✅

| group | 标题 | tmplId | 字段 |
|-------|------|--------|------|
| `calendar_add` | 日程提醒 | `Yy3lDFrBv0xARU0EC1qWmdc8jOpjmaqNeRrMrjk7OuY` | 事项分类、课程名、时间、地点、备注 |
| `calendar_change` | 日程删除通知 | `PW9P-EnizjWEn4wycXv-tywxMr8hwKgoxuIPYlvPYog` | 主题内容、操作时间 |

详见 [`07-calendar-sync-plan.md`](./07-calendar-sync-plan.md)。
---

## 预约类（不另申请模板）

团课 / 私教 / 场地 / 班课试听：

| 时机 | 渠道 |
|------|------|
| 预约成功 | **仅小程序弹框**；可顺带授权 ①（不 send） |
| 开始前提醒 | 微信 **① `class_remind`**（四种合并） |
| 用户自助取消 | **仅站内** |
| 机构改期/取消 | 微信 **② `schedule_change`** |

详见 [`08-booking-subscribe-plan.md`](./08-booking-subscribe-plan.md)。**不要**再申请「预约成功 / 预约取消」专用模板。

---

## 后端 `.env` 汇总（填完贴给后端）

```env
SUBSCRIBE_TMPL_CLASS_REMIND=OlSjLqwypy1Sh0JYM8iw-N5gJ3Jc6-TiChPDozIALHA
# 曾用: OlSjLqwypy1Sh0JYM8iw-Lzr729fWhQ6-ROT4MkYwSw
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

填好后 **重启后端** → `bootstrap` 里对应 `enabled: true` 且 `tmplId` 非空。

---

## 申请顺序建议

1. ✅ 签到提醒（`class_remind`）— 已完成（**含**预约课前）  
2. **签到结果通知**（`lesson_result`）  
3. **预约变更通知**（`schedule_change`）— 教务/机构改安排  
4. **待办事项提醒**（`todo_remind`）  
5. **日历日程添加/变更提醒**（`calendar_add` / `calendar_change`）  
6. **账户余额提醒**（`package_alert`）— P1  
7. **审批结果通知**（`approval_result`）— P1  

---

## 类目怎么选

| 模板 | 优先类目 |
|------|----------|
| class_remind | 预约/报名 ✅ |
| schedule_change | 预约/报名 |
| lesson_result | 预约/报名 |
| todo_remind | 办公 |
| package_alert | 记账 |
| approval_pending | 办公 |
| approval_result | 办公 |
| calendar_add | 办公 |
| calendar_change | 办公 |
| org_membership_alert | 办公 / 记账 |
| org_membership_renew_result | 办公 / 记账 |

某个类目下搜不到，换另外两个类目用**同标题**再搜一次。

---

## 你每申请完一个，补这一行

| group | 微信标题 | tmplId | 字段截图 |
|-------|----------|--------|----------|
| class_remind | 签到提醒 | OlSjLqwypy1Sh0JYM8iw-N5gJ3Jc6-TiChPDozIALHA | 课程名称/授课教师/课程日期 |
| schedule_change | 预约变更通知 | UxTRaCVUV56uPr2mOdM0ktCUQbGLDXMrENQ5nWZmBeM | 预约项目/变更时间/变更原因/温馨提示 |
| lesson_result | 课时扣减通知 | QyhGHXojFTwxtTLkA_goRArJEDjzwzRf7MqGDmWnmAg | 学员/课程/扣减数量/剩余课时/扣减时间 |
| todo_remind | 待办事项提醒 | TBc6PVZ5gTtp4jHCgGUvk4ZWz3N5sMfEF4wFJvV2jcU | 待办名称/待办内容/截止日期/事项类型 |
| package_alert | 续费提醒 | kH2_5FMx52dsJThtpYN_6_NhHf1ctObukU4mjctP0bQ | 温馨提醒/剩余课时/账号余额（学员） |
| approval_pending | 待审批通知 | QSTDZ1w8CsQghIG63TWuPWi356De4VQj2lhkL7lzNZg | 事由/备注（推审批人） |
| approval_result | 审批结果通知 | K6m9hKMui9IrGzSXCm8DaX3gCi0Tm53SbHnT5usr3jc | 申请内容/审批结果（推申请人） |
| calendar_add | 日程提醒 | Yy3lDFrBv0xARU0EC1qWmdc8jOpjmaqNeRrMrjk7OuY | 事项分类/课程名/时间/地点/备注 |
| calendar_change | 日程删除通知 | PW9P-EnizjWEn4wycXv-tywxMr8hwKgoxuIPYlvPYog | 主题内容/操作时间 |
| org_membership_alert | 提前续费通知 | 48kPgeFWtS7V0gp3kirFrk1yX6hLpbipaDRj93EGUgE | 企业名称/产品名称/到期时间/续费说明（机构到期前） |
| org_membership_renew_result | 会员续费结果通知 | BVKN8vtinf806IKCmKHmUjJotIHqhR0oApZwNFOdSSE | 会员名称/续费结果/会员有效期/备注（机构续费后） |

把 **tmplId + 字段截图** 发给后端，便于核对 `thing/time` 编号是否和 send 参数一致。
