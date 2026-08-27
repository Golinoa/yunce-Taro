# 订阅消息模块文档索引

> **前端定稿**：[`../09-subscribe-message-api-contract.md`](../09-subscribe-message-api-contract.md)  
> **后端定稿**：[`yunce-backend/docs/subscribe-message-api-contract.md`](../../../yunce-back/yunce-backend/docs/subscribe-message-api-contract.md)  
> 待办模块（独立）：[`../08-todo-module-api-contract.md`](../08-todo-module-api-contract.md)

| 文档 | 状态 | 说明 |
|------|------|------|
| [**09-subscribe-message-api-contract.md**](../09-subscribe-message-api-contract.md) | **定稿** | 前端：链路 + 组件 + 验收 |
| [**10-subscribe-message-dev-plan.md**](../10-subscribe-message-dev-plan.md) | **可执行** | **全流程开发计划**（模块划分 / 示例代码 / 验收指标 / Mock→联调） |
| [**后端 subscribe-message-api-contract.md**](../../../yunce-back/yunce-backend/docs/subscribe-message-api-contract.md) | **定稿** | 后端：Prisma + API + Dispatcher + Worker + 测试 |
| [00-research-and-plan.md](./00-research-and-plan.md) | 归档 | 早期调研 |
| [01-api-contract.md](./01-api-contract.md) | 归档 | 已合并入 09 |
| [02-auth-touchpoints-quota-loop.md](./02-auth-touchpoints-quota-loop.md) | 归档 | 已合并入 09 |
| [03-quota-pool-gamification.md](./03-quota-pool-gamification.md) | 归档 | 已合并入 09 §E17 |
| [**05-wechat-template-apply-list.md**](./05-wechat-template-apply-list.md) | 运维详版 | 字段映射 / 推送规则 / env |
| [**06-template-apply-simple.md**](./06-template-apply-simple.md) | **运维简版** | **8 个模板标题+格式** |
| [**07-calendar-sync-plan.md**](./07-calendar-sync-plan.md) | **日历批次** | **手机日历同步 + ⑦⑧ 模板** |

**前端硬性要求**

- 弹框：全局 `SubscribePromptDialog`，禁止业务页散落
- 弹窗：全局 `SubscribeRenewSheet`
- 出口：`subscribeMessageService`
- 文案：禁止「囤额度」；用「补充订阅消息授权」

**相关代码（待实现）**

- `src/components/subscribe/*`
- `src/services/subscribe-message.ts`
- `package-settings/pages/message-auth`
