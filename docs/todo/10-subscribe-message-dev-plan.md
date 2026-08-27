# 订阅消息全流程开发计划（Mock → 后端联调）

> **状态：可执行指南**（前后端按本计划排期与验收）  
> **契约依据**：  
> - 前端总览：[`09-subscribe-message-api-contract.md`](./09-subscribe-message-api-contract.md)  
> - 后端实现：[`yunce-backend/docs/subscribe-message-api-contract.md`](../../yunce-back/yunce-backend/docs/subscribe-message-api-contract.md)  
> - 待办（独立并行）：[`08-todo-module-api-contract.md`](./08-todo-module-api-contract.md)  
> **API 前缀**：`/api/app/v1`  
> **创建日期**：2026-08-26

---

## 0. 目标与范围

### 0.1 目标

在微信「一次授权 ≈ 一次可发送次数」约束下，交付：

1. 前端：全局弹框/弹窗 + Service Mock + 业务挂点 + 消息授权管理页  
2. 后端：配额账本 + auth-report + Dispatcher + pending 队列 + 业务挂钩 + 定时任务  
3. 联调：真机授权入账 → 业务事件 send → 无次数站内兜底

### 0.2 范围边界

| 在范围内 | 不在范围内 |
|----------|------------|
| 订阅消息授权 / 次数账本 / 微信 send | 公众号模板消息 |
| 站内 Notification 双通道 | 替他人设备授权 |
| 与 notify-setting 联动 | 用微信发「次数不足」 |
| 待办模块可并行（08） | 覆盖改写 08 待办契约 |

### 0.3 硬性约束（开发不得违反）

见 `09` §0.1 R1–R7；文案禁用「囤额度」，统一「补充订阅消息授权 / 补充 1 次可发送次数」。

---

## 1. 模块划分总表

### 1.1 前端 Mock / 实现模块

| 模块 ID | 名称 | 路径（建议） | 依赖 | 阶段 |
|---------|------|--------------|------|------|
| **FE-M01** | 类型与枚举 | `src/types/subscribe-message.ts` | 无 | Mock Day1 |
| **FE-M02** | Preset 文案常量 | `src/constants/subscribe-presets.ts` | FE-M01 | Mock Day1 |
| **FE-M03** | Mock 数据层 | `src/data/subscribe-message.ts` | FE-M01 | Mock Day1 |
| **FE-M04** | Taro 订阅薄封装 | `src/utils/subscribe-message.ts` | FE-M01 | Mock Day1 |
| **FE-M05** | Service 出口 | `src/services/subscribe-message.ts` | FE-M03/M04 | Mock Day1–2 |
| **FE-M06** | 弹框组件 | `src/components/subscribe/SubscribePromptDialog` | Dialog | Mock Day2 |
| **FE-M07** | 弹窗组件 | `src/components/subscribe/SubscribeRenewSheet` | BottomSheet | Mock Day2 |
| **FE-M08** | 横幅组件 | `src/components/subscribe/SubscribeQuotaBanner` | — | Mock Day2 |
| **FE-M09** | 全局 Host | `src/components/subscribe/SubscribeAuthHost` | M06/M07 | Mock Day2 |
| **FE-M10** | onShow 消费 | `src/utils/subscribe-on-show.ts` | FE-M05 | Mock Day2 |
| **FE-M11** | 业务挂点 P0 | student-form / lesson-form / … | FE-M05 | Mock Day3–5 |
| **FE-M12** | 消息授权管理页 | `package-settings/pages/message-auth` | FE-M05 | Mock Day5–6 |
| **FE-M13** | 通知设置联动 | `notifications/index.tsx` | notifyService | Mock Day6 / 联调 |
| **FE-M14** | 单元测试 | `*.test.ts` | FE-M02/M05 | 全程 |
| **FE-M15** | 手机日历封装 | `src/utils/phone-calendar.ts` | Taro API | 日历批次 |
| **FE-M16** | 日历同步 Service | `src/services/calendar-sync.ts` | FE-M15/M05 | 日历批次 |
| **FE-M17** | 课表同步挂点 + E19/E20 | schedule 相关页 | FE-M16/M05 | 日历批次 |
| **FE-M18** | 日历 preset/scene | `subscribe-presets.ts` | FE-M01 | 日历批次 |
| **FE-M19** | 团课/私教预约成功 E21/E22 | class-booking | FE-M05 | 预约批次（站内+auth①） |
| **FE-M20** | 场地预约成功 E23 | venue-booking | FE-M05 | 预约批次 |
| **FE-M21** | 班课试听预约成功 E24 | trial booking | FE-M05 | 预约批次 |
| **FE-M22** | 用户自助取消 E25 | cancel 流 | FE-M05 | 仅站内 |
| **FE-M23** | preset `booking_success_remind_auth` | subscribe-presets | FE-M01 | groups=`class_remind` |

### 1.2 后端链路模块

| 模块 ID | 名称 | 路径（建议） | 依赖 | 阶段 |
|---------|------|--------------|------|------|
| **BE-M01** | Prisma 四表 + 迁移 | `prisma/schema.prisma` | — | Backend Week1 |
| **BE-M02** | env 模板 ID | `src/config/env.ts` | — | Backend Week1 |
| **BE-M03** | quota 增减 | `subscribe-message.quota.ts` | BE-M01 | Backend Week1 |
| **BE-M04** | pending CRUD | `subscribe-message.pending.ts` | BE-M01 | Backend Week1 |
| **BE-M05** | wechat token/send | `subscribe-message.wechat.ts` | Redis | Backend Week1 |
| **BE-M06** | Dispatcher | `subscribe-message.dispatcher.ts` | M03–M05 + notification | Backend Week1 |
| **BE-M07** | HTTP 路由 7 端点 | `subscribe-message.routes.ts` 等 | M03–M06 | Backend Week1 |
| **BE-M08** | 业务 hooks | `subscribe-message.hooks.ts` | M04/M06 | Backend Week2 |
| **BE-M09** | 入班 / 点名 / 排课挂钩 | class/lesson/schedule.service | BE-M08 | Backend Week2 |
| **BE-M10** | BullMQ Worker | `workers/subscribe-message.worker.ts` | BE-M06 | Backend Week2–3 |
| **BE-M11** | UserNotifyPreference | prisma + notify-setting | BE-M01 | Backend Week2 |
| **BE-M12** | 测试 | `__tests__/*` | 全程 | 全程 |
| **BE-M13** | 日历模板 env | `SUBSCRIBE_TMPL_CALENDAR_*` | BE-M02 | 日历批次 |
| **BE-M14** | calendar-sync report API | `POST /calendar-sync/report` | BE-M06 | 日历批次 |
| **BE-M15** | 日历 dispatch + 与 schedule 去重 | hooks | BE-M08 | 日历批次 |
| **BE-M16** | 预约 create **禁止** dispatch | booking services | BE-M08 | 预约批次 |
| **BE-M17** | 四种预约课前 → `class_remind` | cron + hooks | BE-M10 | 预约批次 |
| **BE-M18** | 机构改/取消预约 → `schedule_change` | booking/schedule | BE-M08 | 预约批次 |

### 1.3 模块依赖关系（数据流）

```
业务页成功
  → FE-M05.runFlow(E0x)
  → FE-M09 展示弹框/弹窗
  → 用户点击
  → FE-M04 requestSubscribeMessage
  → FE-M05 / BE-M07 POST auth-report
  → BE-M03 remain+1

业务写库成功（后端）
  → BE-M08/M09 hooks
  → BE-M06 Dispatcher
       ├─ remain>0 → BE-M05 微信 send → remain-1
       └─ remain=0 → notification 站内 + BE-M04 pending(quota_depleted)

用户再次进小程序
  → FE-M10 consumePending
  → FE-M05 GET bootstrap / pending-prompts
  → FE-M09 弹框（E02-B / E18 等）
```

---

## 2. 各模块实现描述 + 示例代码

### 2.1 FE-M01 / FE-M02 — 类型与 Preset

**功能**：统一枚举、DTO、弹框文案；业务页只传 `presetId` + `variables`。

```typescript
// src/types/subscribe-message.ts（摘录）
export type SubscribeTemplateGroup =
  | 'class_remind'
  | 'schedule_change'
  | 'lesson_result'
  | 'todo_remind'
  | 'package_alert'
  | 'approval_result';

export type SubscribeFlowId =
  | 'E01' | 'E02A' | 'E05' | 'E06' | 'E08' | 'E12' | 'E18';

export interface SubscribeQuotaDto {
  group: SubscribeTemplateGroup;
  tmplId: string;
  remain: number;
  lowThreshold: number;
  notifyEnabled: boolean;
}
```

```typescript
// src/constants/subscribe-presets.ts（摘录）
export const PROMPT_PRESETS = {
  student_created: {
    title: '跟进提醒',
    body: '已为 **{studentName}** 建档。是否开启跟进提醒？课时不足或到期时将通过微信服务通知您。',
    primaryText: '开启提醒',
    secondaryText: '暂不需要',
    groups: ['todo_remind', 'package_alert'] as const,
    scene: 'student_create_success',
  },
  // …其余 preset 见 09 §3.3
} as const;
```

**验收点**：全仓 grep 无「囤额度」；未知 `presetId` 抛错。

---

### 2.2 FE-M03 / FE-M05 — Mock 数据与 Service

**功能**：Mock 下内存维护 `quotas` / `pendingPrompts`；`USE_MOCK=false` 切真实 HTTP。

```typescript
// src/data/subscribe-message.ts（核心）
const quotas = new Map<string, number>(); // key: `${userId}:${group}`

export async function mockAuthReport(input: {
  userId: string;
  items: Array<{ group: string; status: string }>;
  clientRequestId: string;
}) {
  // 幂等：同一 clientRequestId 不重复加
  for (const item of input.items) {
    if (item.status !== 'accept') continue;
    const key = `${input.userId}:${item.group}`;
    quotas.set(key, (quotas.get(key) ?? 0) + 1);
  }
  return { quotas: snapshotQuotas(input.userId) };
}
```

```typescript
// src/services/subscribe-message.ts（核心）
import { USE_MOCK } from '@/utils/request';
import * as mock from '@/data/subscribe-message';
import { get, post } from '@/utils/request';

export const subscribeMessageService = {
  bootstrap: async (role: string, campusId?: string) => {
    if (USE_MOCK) return mock.mockBootstrap(role, campusId);
    return get('/subscribe-message/bootstrap', { role, campusId });
  },

  authReport: async (body: AuthReportBody) => {
    if (USE_MOCK) return mock.mockAuthReport(body);
    return post('/subscribe-message/auth-report', body);
  },

  /** 业务页唯一入口 */
  runFlow: async (flowId: SubscribeFlowId, ctx: SubscribeFlowContext) => {
    // 打开 Host 弹框 → 用户点主按钮 → requestAuth → authReport
  },
};
```

**数据流**：业务成功 → `runFlow` → Host → 点击 → 微信面板 → `auth-report` → quotas 更新。

---

### 2.3 FE-M04 — 微信 API 封装

```typescript
// src/utils/subscribe-message.ts
import Taro from '@tarojs/taro';

export async function requestSubscribeMessageAuth(
  tmplIds: string[],
): Promise<Record<string, 'accept' | 'reject' | 'ban' | 'filter'>> {
  if (!tmplIds.length) return {};
  // Mock / 无模板 ID：开发态可返回全部 accept，真机必须真实调用
  const res = await Taro.requestSubscribeMessage({ tmplIds });
  const out: Record<string, 'accept' | 'reject' | 'ban' | 'filter'> = {};
  for (const id of tmplIds) {
    const v = res[id];
    if (v === 'accept' || v === 'reject' || v === 'ban' || v === 'filter') {
      out[id] = v;
    }
  }
  return out;
}
```

**禁止**：在 `onLoad`/`useDidShow` 无用户点击时调用本函数。

---

### 2.4 FE-M06 / FE-M07 / FE-M09 — 全局 UI

```tsx
/**
 * SubscribePromptDialog - 订阅消息授权引导弹框（屏幕正中）
 * 禁止业务页散落 Dialog；统一由 SubscribeAuthHost 驱动。
 */
export interface SubscribePromptDialogProps {
  visible: boolean;
  title: string;
  body: string;
  primaryText: string;
  secondaryText: string;
  tertiaryText?: string;
  loading?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onTertiary?: () => void;
}
```

```tsx
// SubscribeAuthHost：挂 app.tsx，监听 service 队列
export const SubscribeAuthHost: React.FC = () => {
  const state = useSubscribeAuthStore(); // 或 service 订阅
  return (
    <>
      <SubscribePromptDialog {...state.prompt} />
      <SubscribeRenewSheet {...state.sheet} />
      <SubscribeQuotaBanner {...state.banner} />
    </>
  );
};
```

**实现描述**：Host 单例保证同屏仅一个弹框；preset 解析在 service，组件只收字符串。

---

### 2.5 FE-M10 — onShow 队列

```typescript
// src/utils/subscribe-on-show.ts
export async function consumeSubscribeOnShow() {
  const { pendingPrompts, lowQuotaGroups, quotas } =
    await subscribeMessageService.bootstrap(role, campusId);
  // 优先级：见 09 §6，只展示 1 条弹框
  const top = pendingPrompts.sort((a, b) => a.priority - b.priority)[0];
  if (top) {
    await subscribeMessageService.openPromptFromPending(top);
    return;
  }
  // E18 remain===0 → quota_depleted 弹框（7 天频控）
  // E16 remain∈[1,3] → 横幅（24h 频控）
}
```

**后端链路**：`GET /bootstrap` 或 `GET /pending-prompts`。

---

### 2.6 FE-M11 — 业务挂点示例（E01）

```typescript
// useStudentForm.ts 创建成功后
await studentService.create(...); // 必须先成功
Taro.showToast({ title: '学员已添加', icon: 'success' });
await subscribeMessageService.runFlow('E01', {
  studentId: student.id,
  studentName: student.name,
  campusId,
  role: currentRole,
});
```

**对应后端**：E01 无 send；仅前端授权。入班由 **BE-M09** 写 pending。

| Flow | 前端挂点 | 后端链路 |
|------|----------|----------|
| E01 | student-form 成功 | 无 send |
| E02A | 入班成功弹框 | hooks 给 HT/AT/PA pending |
| E05 | lesson-form 成功弹窗 | dispatch lesson_result → 家长 |
| E06 | 创建班级成功弹框 | 可选 |
| E08/E09 | 充值/发卡成功弹框 | 无 send |
| E12 | AddCustomTodo 保存前授权 | cron 到期 dispatch todo_remind |
| E18 | onShow / 开开关 | pending quota_depleted |

---

### 2.7 FE-M12 — 消息授权管理页

**功能**：用户主动点击铃铛/松果 → 每次 `requestSubscribeMessage` 单模板 → `auth-report` scene=`message_auth_tap`。

**约束**：会话最多 20 次；间隔 ≥800ms；文案「补充 1 次可发送次数」。

---

### 2.8 BE-M03 / BE-M06 — 配额与 Dispatcher

```typescript
// subscribe-message.dispatcher.ts（核心）
export async function dispatch(input: DispatchInput): Promise<DispatchResult> {
  if (!(await isNotifyEnabled(input.receiverUserId, input.notifySettingItemId))) {
    return writeLog(input, 'skipped_disabled');
  }
  if (await isDeduped(input.receiverUserId, input.bizKey)) {
    return { status: 'deduped' };
  }
  const quota = await getQuota(input.receiverUserId, input.templateGroup);
  if (quota.remain <= 0) {
    const inAppId = await createInAppNotification(input.inAppFallback);
    await enqueuePendingPrompt(/* quota_depleted */);
    return writeLog(input, 'skipped_no_quota', { inAppId });
  }
  const res = await wechatSubscribeSend(...);
  if (res.ok) {
    await decrementRemain(...);
    return writeLog(input, 'sent', { msgId: res.msgid });
  }
  await createInAppNotification(input.inAppFallback);
  return writeLog(input, 'failed', { err: res.errcode });
}
```

**数据流**：业务 Service → hooks → Dispatcher → 微信 / 站内。

---

### 2.9 BE-M08 / BE-M09 — 业务挂钩

```typescript
// class.service addStudents 事务提交后
await subscribeMessageHooks.onStudentsAddedToClass({
  organizationId,
  classId,
  className,
  studentIds,
  operatorUserId,
  teachingTeacherId,
  assistantTeacherIds,
});
// 内部：为 HT/AT/PA 写 SubscribePendingPrompt（dedupe 24h）
```

```typescript
// lesson-record 点名成功后
for (const parentId of parentUserIds) {
  await dispatch({
    receiverUserId: parentId,
    templateGroup: 'lesson_result',
    bizKey: `lesson-result:${recordId}`,
    templateData: { /* thing1... */ },
    inAppFallback: { title: '...', content: '...' },
  });
  await enqueuePendingPrompt({ eventCode: 'post_class_parent', userId: parentId, ... });
}
```

---

### 2.10 BE-M07 — HTTP 端点清单

| 方法 | 路径 | Mock 对应 | 说明 |
|------|------|-----------|------|
| GET | `/subscribe-message/bootstrap` | `mockBootstrap` | 模板+配额+pending |
| GET | `/subscribe-message/quotas` | `mockGetQuotas` | 轻量配额 |
| POST | `/subscribe-message/auth-report` | `mockAuthReport` | 授权入账 |
| GET | `/subscribe-message/pending-prompts` | mock pending | 队列 |
| POST | `/subscribe-message/prompts/:id/consume` | mock | 已展示 |
| POST | `/subscribe-message/prompts/:id/dismiss` | mock | 稍后 |
| POST | `/subscribe-message/send` | 内部 Mock | 联调/补发 |

---

## 3. 验收标准（可量化）

### 3.1 工程门禁

| 指标 | 通过条件 |
|------|----------|
| Typecheck | `npm run typecheck` 退出码 0（前后端各自） |
| Lint / Format | 前端 `npm run check` 通过 |
| 构建 | 前端 `npm run build:weapp:mock` 成功 |
| 文案合规 | 全仓无「囤额度\|去囤额度\|屯额度\|攒额度」匹配 |
| 散落 UI | 业务页无手写订阅 Dialog 文案（仅 Host + presets） |

### 3.2 前端测试

| 指标 | 通过条件 |
|------|----------|
| 单测通过率 | FE-M14 计划用例 **≥ 90%** 通过 |
| Preset 覆盖 | P0 preset ≥ 10 个有快照/断言 |
| 频控 | E18 同组 7 天重复弹 → 不展示；E16 24h 重复 → 不展示 |
| 拒绝路径 | 任意 `runFlow` 点「稍后」→ 不调微信 API；业务状态已成功 |
| Mock 入账 | accept 后 `remain` 精确 +1；`clientRequestId` 重复不加 |

### 3.3 后端测试

| 指标 | 通过条件 |
|------|----------|
| Dispatcher 单测 | remain=0 / >0 / dedupe / disabled / 无 openId **5 类全绿** |
| auth-report 幂等 | 同 `clientRequestId` 两次 remain 不变 |
| 路由 Supertest | 未登录 401；非法 body 400；合法 200 |
| 错误处理覆盖 | `skipped_no_quota` / `failed` / `deduped` 均写 SendLog |
| 租户隔离 | 跨 organization 读写配额失败（403/空） |

### 3.4 性能与接口（联调环境）

| 指标 | 通过条件 |
|------|----------|
| `GET bootstrap` P95 | ≤ **300ms**（不含微信网络） |
| `POST auth-report` P95 | ≤ **200ms** |
| `dispatch` 同步路径 | ≤ **500ms**（含微信 mock）；真微信单独计量 |
| 防刷 | 同用户 1 分钟 >30 次 auth-report → **429** |

### 3.5 真机 / E2E 验收（联调后）

| ID | 场景 | 通过条件 |
|----|------|----------|
| A-01 | E01 添加学员 | 弹框 → 授权 → remain+1 |
| A-02 | E02-B 任课教师 | 另设备 onShow 见 pending 弹框 |
| A-03 | E05 点名 | 仅弹窗；家长站内或微信收到 |
| A-04 | E18 remain=0 | 站内弹框；**无**微信「次数不足」消息 |
| A-05 | E13 协作待办 | 弹框仅「查看」；详情再授权 |
| A-06 | 拒绝授权 | 业务已完成；24h 不重复 |
| A-07 | message-auth 点 3 次 | remain+3（always accept 时） |

**E2E 通过率目标**：上表 7 项 **≥ 6/7（约 86%）** 为联调可发布；**7/7** 为提审前要求。

---

## 4. 开发与测试步骤安排

### 4.1 总时间线（建议 3 周并行）

```
Week 1（并行）
  前端：FE-M01～M10 底座 + Host + Mock Service
  后端：BE-M01～M07 表 + quota + pending + HTTP + Dispatcher（微信可 mock）

Week 2（并行）
  前端：FE-M11 P0 挂点（E01/E05/E02A/E06/E08/E12）+ 单测
  后端：BE-M08～M09 入班/点名/排课挂钩 + UserNotifyPreference

Week 3
  前端：FE-M12/M13 + 切真实 API + FE-M15～M18 日历 + FE-M19～M23 预约（站内成功 + auth①）
  后端：BE-M10 Worker P0 + BE-M13～M15 日历 + BE-M16～M18（课前 class_remind / 变更 schedule_change）
  双方：真机联调 A-01～A-07 + C-01～C-04（日历）+ B-01～B-05（预约）
```

详见预约计划：[`subscribe-message/08-booking-subscribe-plan.md`](./subscribe-message/08-booking-subscribe-plan.md)

### 4.2 Mock 阶段（前端主导，后端可并行）

| Day | 前端任务 | 测试步骤 | 完成定义 |
|-----|----------|----------|----------|
| D1 | FE-M01～M05 骨架 | 单测 mockAuthReport 幂等 | Service 可调用 |
| D2 | FE-M06～M10 Host | 手测弹框/弹窗；onShow 假 pending | Host 挂 app |
| D3 | E01 + E12 挂点 | 添加学员 / 创建待办演示 | 拒绝不阻断 |
| D4 | E05 + E02A + E06 | 点名弹窗、入班弹框、建班 | 无每学员弹框 |
| D5 | E08/E09 + E16/E18 | 充值弹框；次数 0 弹框 | 文案合规 |
| D6 | FE-M12 初版 + `check` + `build:weapp:mock` | 点击补充次数 | Mock 演示包可交 |

**Mock 阶段禁止**：依赖真实微信 send；依赖后端 cron。

### 4.3 后端并行阶段（与 Mock 重叠）

| Day | 后端任务 | 测试步骤 | 完成定义 |
|-----|----------|----------|----------|
| D1–2 | BE-M01～M04 | migrate + quota 单测 | 表可用 |
| D3–4 | BE-M05～M07 | Supertest 全端点；Dispatcher 5 类 | HTTP 可联调 |
| D5–7 | BE-M08～M09 | 入班写 pending；点名 dispatch（微信 mock） | hooks 打日志可查 |
| D8+ | BE-M10～M11 | Worker dry-run；偏好表 | P0 cron 可开关 |

### 4.4 联调阶段（双方会合）

| Step | 动作 | 责任方 | 通过标准 |
|------|------|--------|----------|
| I1 | 对齐 tmplId / bootstrap 字段抽样 | 双方 | JSON 字段 100% 对齐抽样清单 |
| I2 | 前端 `USE_MOCK=false` 指向联调环境 | 前端 | bootstrap 200 |
| I3 | 真机 auth-report | 双方 | DB remain +1 |
| I4 | 入班 → 任课教师 pending | 双方 | A-02 |
| I5 | 点名 → 家长站内/微信 | 双方 | A-03 |
| I6 | remain=0 → 站内 + E18 | 双方 | A-04；SendLog=skipped_no_quota |
| I7 | 性能抽样 bootstrap/auth-report | 后端 | 满足 §3.4 |
| I8 | 回归前端 `check` + 真机构建 | 前端 | 门禁绿 |

### 4.5 每日站会对齐清单（可选）

1. 今日完成的模块 ID（FE-Mx / BE-Mx）  
2. 契约是否变更（有则先改 09 + 后端 doc）  
3. 阻塞项（模板 ID / openId / 真机）  

---

## 5. 联调字段抽样清单（I1 用）

| 字段路径 | 类型 | 来源 |
|----------|------|------|
| `data.templates[].group` | enum | bootstrap |
| `data.templates[].tmplId` | string | env |
| `data.quotas[].remain` | number | SubscribeQuota |
| `data.pendingPrompts[].presetId` | string | pending |
| `data.pendingPrompts[].priority` | number | pending |
| auth-report `items[].status` | accept/reject/ban/filter | 前端微信回传 |
| auth-report `clientRequestId` | uuid | 前端 |
| SendLog `status` | enum | dispatcher |
| SendLog `bizKey` | string | 见后端 doc §6 |

---

## 6. 风险与缓冲

| 风险 | 缓解 |
|------|------|
| 微信模板未申请 | Mock 用占位 tmplId；真机前必须填 env |
| 长期订阅拿不到 | 仅一次性订阅 + 主动补充授权页 |
| 业务挂点遗漏 | 以 09 §7 / 本计划 §2.6 表为 checklist |
| 文档分叉 | 契约变更同时改 09 + 后端 doc，本计划只跟版本 |

---

## 7. 交付物清单

| 交付物 | Owner |
|--------|-------|
| 前端组件 + Service + Mock + 挂点 | 前端 |
| 后端四表 + API + Dispatcher + hooks | 后端 |
| 本计划进度勾选（可复制到看板） | 双方 |
| 真机验收记录 A-01～A-07 | 双方 |
| `build:weapp:mock` 演示包 | 前端 |

---

## 8. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-26 | 首版：模块划分、示例代码、验收指标、Mock→联调步骤 |
