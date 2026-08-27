# 手机日历同步 × 订阅消息 — 开发计划

> **状态：前端 ✅（2026-08-27）· 后端 API ✅ · 联调 🔲**  
> 关联：[`06-template-apply-simple.md`](./06-template-apply-simple.md) ⑦⑧ · [`09-subscribe-message-api-contract.md`](../09-subscribe-message-api-contract.md) §3.1 / E19–E20 · [`11-production-integration-plan.md`](./11-production-integration-plan.md)

---

## 1. 要做什么

用户把课表 **同步到手机系统日历**（`Taro.addPhoneCalendar`）后：

| 动作 | 微信推送模板 | 说明 |
|------|--------------|------|
| 新写入日历 | **⑦ 日历日程添加提醒** `calendar_add` | 告诉用户「已进日历」 |
| 更新了日历里已有条目 | **⑧ 日历日程变更提醒** `calendar_change` | 告诉用户「日历已改」 |

与 **② 预约变更通知**（`schedule_change`）分工：

| 模板 | 含义 |
|------|------|
| `schedule_change` | 教务课表业务变了（不管有没有同步日历） |
| `calendar_add` | **已成功写进手机日历** |
| `calendar_change` | **手机日历里那条被更新** |

**同一次改课：** 若用户开了日历同步，优先发 `calendar_change`；`schedule_change` 与 `calendar_change` **同 bizKey 去重，只发 1 条微信**（省额度）。

---

## 2. 微信模板

### ⑦ 日历日程添加提醒 ✅

```
日历日程添加提醒
日程名称   xxx
日程时间   xxx
日程地点   xxx
温馨提示   xxx
```

### ⑧ 日历日程变更提醒 ✅

```
日历日程变更提醒
日程名称   xxx
变更内容   xxx
日程时间   xxx
温馨提示   xxx
```

---

## 3. 推送时机 & 频控

| 场景 | 模板 | 何时推 | 汇总 |
|------|------|--------|------|
| 首次开启同步 | — | 弹授权（E19），不立刻推 | — |
| 批量同步 N 节课成功 | `calendar_add` | 同步完成立刻 | **1 条**「已同步 N 节课到日历」 |
| 单节新课写入日历 | `calendar_add` | 写入成功 | 同用户同天可合并进批量 |
| 改时间/地点后更新日历 | `calendar_change` | 更新成功 | 同 schedule **1 条** |
| 取消课并从日历删除 | `calendar_change` | 可选推「已取消」或仅站内 | 1 条/次操作 |

**不打扰：**

- 用户未开启「同步手机日历」→ 不发 ⑦⑧  
- 同步失败 → 不发微信，仅 Toast  
- 同一 occurrence fingerprint 已同步 → 跳过重复 `addPhoneCalendar`  
- 与 `schedule_change` 同版本只发一条（见上）

---

## 4. 前端模块（已实现）

| 模块 | 路径 | 状态 | 内容 |
|------|------|------|------|
| **FE-M15** | `src/utils/phone-calendar.ts` | ✅ | `addPhoneCalendar` 封装、失败降级 |
| **FE-M16** | `src/services/calendar-sync.ts` | ✅ | 课表 → occurrence、批量同步（**最多 7 天**）、本地 fingerprint 映射 |
| **FE-M17** | 挂点 | ✅ | 见下表 |
| **FE-M18** | `subscribe-presets` | ✅ | preset `calendar_sync_enable`、E19 flow |

**用户入口（用户口径 2026-08-27）：**

- **系统设置** → 「同步手机日历」Switch（老师 / 助教 / 校长）
- **课表 Tab** → 首次有排课时弹窗引导；点「暂不」提示可去系统设置开启

**同步触发挂点：**

| 页面 / 事件 | 调用 |
|-------------|------|
| 系统设置开开关 | `enableAndSync` |
| 课表页 onShow + 有排课 | `maybePromptOnSchedulePage` / 静默补同步 |
| 排课保存 / 调课 | `schedule-form` → `syncAfterScheduleChange` |
| **删除排课规则** | `schedule/index` → `syncAfterScheduleChange` |
| **批量调课成功** | `batch-reschedule-confirm` → `syncAfterScheduleChange` |

**授权（首次同步前）：**

```typescript
// 课表弹窗 / 设置开关：directAuth 调起微信面板
await subscribeMessageService.requestAuthAndReport(
  ['calendar_add', 'calendar_change'],
  'calendar_sync_enable',
  { role, campusId },
);
await calendarSyncService.syncWeekAhead({ userId, teacherId, campusId });
// Mock 下跳过；联调时 POST /calendar-sync/report → 后端 dispatch calendar_add
```

**已知限制：** 微信无可靠「更新/删除日历条目」API；改课会 **新增** 条目，旧条目可能仍留在系统日历。

---

## 5. 后端模块

| 模块 | 状态 | 内容 |
|------|------|------|
| **BE-M13** | ✅ | env：`SUBSCRIBE_TMPL_CALENDAR_ADD` / `SUBSCRIBE_TMPL_CALENDAR_CHANGE` |
| **BE-M14** | ✅ | `POST /calendar-sync/report` |
| **BE-M15** | ✅ | hooks + bizKey 去重 |

**bizKey：**

| 场景 | bizKey |
|------|--------|
| 批量添加 | `calendar-add:{userId}:{YYYY-MM-DD}:batch` |
| 单条添加 | `calendar-add:{scheduleId}:{occurrenceDate}` |
| 单条变更 | `calendar-change:{scheduleId}:{version}` |

**与 schedule_change 去重：** `calendar-change:{scheduleId}:{version}` 与 `schedule-change:{scheduleId}:{version}` 共用 dedupe 窗口，Dispatcher 二选一（有日历同步偏好 → `calendar_change`）。

---

## 6. 验收

| # | 步骤 | 预期 | 前端 |
|---|------|------|------|
| C-01 | 首次同步 → 授权 → 批量 5 节课 | 微信 1 条「已同步 5 节」 | ✅ 写日历；联调 🔲 |
| C-02 | 改一节课时间并更新日历 | 微信 1 条变更 | ✅ 挂点齐；联调 🔲 |
| C-03 | 未开日历同步 | 不发 ⑦⑧ | ✅ |
| C-04 | remain=0 | 站内通知，不发微信 | 后端 |

---

## 7. 登记 tmplId

| 序号 | 标题 | 模板 ID |
|------|------|---------|
| 7 | 日历日程添加提醒 | `Yy3lDFrBv0xARU0EC1qWmdc8jOpjmaqNeRrMrjk7OuY` |
| 8 | 日历日程变更提醒 | `PW9P-EnizjWEn4wycXv-tywxMr8hwKgoxuIPYlvPYog` |

---

## 8. 联调清单

```env
# yunceTaro
VITE_USE_MOCK=false
TARO_API_BASE_URL=https://你的后端/api/app/v1
```

真机验证 `Taro.addPhoneCalendar`；bootstrap 中 `calendar_add` / `calendar_change` 需 `enabled: true` 且 tmplId 非空。
