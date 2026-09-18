# 松果排课 · 开发文档入口

[统一模块开发与联调指南](../../../yunce-back/yunce-backend/docs/development/README.md)

[全部模块](../../../yunce-back/yunce-backend/docs/development/modules/README.md) · [问题台账](../../../yunce-back/yunce-backend/docs/development/ISSUES.md) · [产品口径与待确认](../../../yunce-back/yunce-backend/docs/development/PRODUCT.md) · [验证命令](../../../yunce-back/yunce-backend/docs/development/COMMANDS.md)

当前处于三端全模块联调。前端 UI 已确定，后端优先兼容前端。历史计划与 HTML 原型不作为当前实现和完成度依据。

[API 对接手册](../../../yunce-back/yunce-backend/docs/INTEGRATION-MANUAL.md)（有冲突时核对路由与 validator）

[架构决策](../../../yunce-back/yunce-backend/docs/adr) · [后端运维 SOP](../../../yunce-back/yunce-backend/docs/SOP)

真机走查、设计草稿、长期愿景保留原始用途；本轮清理明细见统一入口同目录的 CLEANUP.md。

## 2026-09-18 前端问题专项（已完成并推送）

| 文档 | 内容 |
|---|---|
| [问题台账](./2026-09-18-frontend-issue-ledger.md) | 用户口述 14 条问题的**原文照录** + 核验结果 + 逐条修复结果总表 |
| [验证与修复计划](./2026-09-18-frontend-issues-verification-and-fix-plan.md) | 逐条证据（`文件:行号`）、根因族、批次划分、验证口径、回滚方案、**每批执行记录** |
| 前端批次报告 | [B2 页面状态机](./FE-B2-REPORT.md) · [B3 学员列表性能](./FE-B3-REPORT.md) · [B4 会话与校区](./FE-B4-REPORT.md) · [B4.1 续期单飞与缓存](./FE-B4.1-REPORT.md) · [B5 邀请码与文案](./FE-B5-REPORT.md) |
| 后端侧报告 | `yunce-back/yunce-backend/docs/diagnostics/` 下的 **FE-B1-REPORT.md**（FE-04 修复 + FE-09 定性）与 **FE-B1.1-REPORT.md**（员工微信绑定闭环） |

**一句话结论**：14 条中 **11 条确认为真并已修复**（6 个提交 `c0e7283`→`007d74b`，已推 `main`/`dev`）；**2 条用户前提不成立**（FE-10 日志无 429；FE-13 滑动其实会触发加载）；**1 条（FE-06）经核查为假真因**（`Room` 表无 `campusId` 列，改前端是无效修复），其候选真因回到刷新路径、已由 B2 覆盖，**待真机确认**。
