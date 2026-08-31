# Subscribe message — real-device acceptance checklist

> Date: 2026-08-31  
> Env: `dev:weapp:dev` → `https://dev.chancore.cn` + real Mini Program AppID/Secret

## 0. Preconditions

- [ ] Backend `.env` has **real** `WECHAT_APP_ID` / `WECHAT_APP_SECRET` (not `mock_*`)
- [ ] API restarted after env change
- [ ] Mini Program request合法域名 includes `dev.chancore.cn`
- [ ] Privacy guide agreed on device (`__usePrivacyCheck__: true`)
- [ ] MP admin has live **订阅消息** templates (not `mock-tmpl-*`)

## 1. Template ID verification

| Group | Expected | Live tmplId (fill) | Notes |
|-------|----------|--------------------|-------|
| class_remind | 上课提醒 | | Must not start with `mock-tmpl-` |
| schedule_change | 调课/停课 | | |
| lesson_result | 消课结果 | | |
| todo_remind | 待办提醒 | | |
| package_alert | 课包不足 | | |
| approval_pending | 审批待办 | | |
| approval_result | 审批结果 | | |
| calendar_add | 日历新增 | | |
| calendar_change | 日历变更 | | |
| org_membership_alert | 会员到期 | | |
| org_membership_renew_result | 续费结果 | | |

Source of truth: MP admin → 订阅消息 → copy tmplId into seed / ops config / DB templates used by `GET /subscribe-message/bootstrap`.

## 2. Device acceptance flows

1. **Login opt-in** — new WeChat user after profile-setup: native subscribe panel (no custom fake toast).
2. **Quota page** (`package-settings/pages/message-auth`) — remain matches server after accept; no false「已补充」.
3. **Force refresh** — leave page and re-enter; quotas not stale.
4. **Low quota / depleted** — onShow banner/prompt only when remain≤threshold; primary CTA opens message-auth.
5. **Auth-report** — Network `POST /subscribe-message/auth-report` 200; remain increments only for accepted items.

## 3. Negative checks

- [ ] No request with `role=undefined` / `campusId=undefined`
- [ ] Prod API never returns `mock-tmpl-*`
- [ ] Auto-accept only when `isDevApiEnv()` **and** tmplId starts with `mock-tmpl-` (local only)

## 4. Sign-off

| Role | Result | Tester | Date |
|------|--------|--------|------|
| Principal | | | |
| Teacher | | | |
| Parent | | | |
