---
last_updated: 2026-09-12
status: active
source: .cursor/rules/membership-native-nav.mdc 迁移
---

# R06 会员页导航栏约定（业务专项）

> 会员权益 / 订单相关页的导航栏落地规则。设计稿里画了假顶栏方便评审，**实现以本规则为准**。

## 原生导航栏（落地必遵）

- 会员权益、订单列表 / 详情等页使用**微信小程序原生导航栏**。
- `navigationStyle` 保持默认（或显式 `'default'`），用 `index.config.ts` 的 `navigationBarTitleText` 设标题（如「会员权益」「订单详情」）。
- **禁止**按 HTML 设计稿去做自定义顶栏（`navigationStyle: 'custom'`）来画「会员权益 + 订单详情」。

## 「订单详情」入口位置

- 设计稿里顶栏右侧的「订单详情」仅作示意；原生栏右侧是胶囊按钮，**不能**塞自定义文案。
- 落地时：入口放在**原生导航栏下方、会员卡（hero）外面的内容区右上角**（卡外，非整卡内右上角）。

## 设计稿 vs 实现

- `docs/UI-design/membership-*.html` 可用假顶栏方便评审；实现以本规则为准，不以稿中假导航为结构。
