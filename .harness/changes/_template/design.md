---
last_updated: 2026-09-12
status: active
---

# 功能设计文档模板

> 复制本文件到 `changes/<module>-feature/design.md` 后填写。
> 状态流转：`Draft → Approved → In Progress → Implemented`。未 Approved 不得开始编码。

**Status: Draft**

## 目标

- 要解决什么问题？用户 / 业务价值是什么？（2-3 句）

## 非目标（明确不做）

- [ ] 本次不做的事（防止范围蔓延）

## 涉及模块

| 端 | 文件 / 目录 | 改动类型（新增 / 修改） |
| --- | --- | --- |
| 前端 | `src/pages/...`、`src/services/...` | |
| 后端 | `yunce-back/...`（如涉及） | |

## 数据契约

- 涉及哪些 API：路由、字段、validator、单位（以真实后端契约为准，不猜）
- 字段类型定义放哪：`src/types/...`

## 交互与 UI

- 新增页面 / 弹窗 / 组件（先查 `wiki/component-catalog.md` 是否可复用）
- 关键交互路径与状态机

## 验收标准（可测）

- [ ] 功能路径：xxx 操作 → xxx 结果
- [ ] 边界：空数据 / 异常 / 权限不足
- [ ] 单测覆盖：xxx
- [ ] 编译：`npm run check` 通过；如需重编译向用户申请

## 风险与决策记录

- 预留：见 `decisions.md`
