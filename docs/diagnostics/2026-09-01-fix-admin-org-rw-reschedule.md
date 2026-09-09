> **历史资料（2026-09-08 收口）**：保留问题背景与证据；其中完成度、待办、命令和旧方案未经当前版本复验，不作为开发指令。当前工作从 [模块联调入口](../../../yunce-back/yunce-backend/docs/development/README.md) 开始。

# 修复记录 · 管理员全机构读写 + 临时调课真联动（2026-09-01）

> **状态**：已落地  
> **产品真源**：[`2026-09-01-store-entry-product-glossary.md`](./2026-09-01-store-entry-product-glossary.md)  
> **坑点册**：[`recurring-pitfall-registry.md`](./recurring-pitfall-registry.md)（PITFALL-001 / 002）

## 产品拍板

- UI **不动**；只改逻辑适配。
- 管理员对本机构课表域 **读写全权限**。
- 临时调课对接 `/attendance/reschedules*`，保存即生效；禁止本地假成功。

## 验收（2026-09-01 测环境）

| 项                                              | 结果                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| principal1 排课列表                             | 200，机构 5 条                                                          |
| principal1 `POST /attendance/reschedules/batch` | 201，`status=approved`，`items=1`                                       |
| principal1 / teacher1 调课列表                  | 200，可见 approved 记录                                                 |
| FE                                              | `temporary-reschedule.ts` 改打 `/attendance/reschedules*`，无本地假成功 |
| tsc                                             | 通过                                                                    |

## 代码锚点

- `utils/permission.ts`：`assertStaffCanMutateClass` / `assertStaffCanMutateSchedule`
- `utils/staff-identity.ts`：`resolveStaffWriteContext`
- `schedule` / `class` / `lesson-record` 写路径接机构可写
- `attendance.service` 调课列表机构隔离 + batch 即生效
- `yunceTaro/src/services/temporary-reschedule.ts` 真路径适配
