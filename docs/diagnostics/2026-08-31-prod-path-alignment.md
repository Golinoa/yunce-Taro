# Production-path alignment (联调 = 生产链路)

> Date: 2026-08-31  
> Locked: test/joint-debug uses the **same business path** as production. Infra may differ (domain, seed); auth/onboarding must not.

## Production WeChat funnel

```
WeChat login (person + session; role PRINCIPAL = DB placeholder only)
  → profile-setup (avatar/nickname)
  → identity-select ★ required
       ├─ store-entry → admin approve → real PRINCIPAL + org
       └─ parent bind (student invite) → Profile.role = PARENT
Teacher: campus invite only (no self-register)
```

## Fixes landed this session

| Area | Change |
|------|--------|
| FE `auth-onboarding` | Mark identity pending **before** profile-setup; after setup → identity-select; retire `onboarding` redirect |
| FE `auth` mapper | Stop inventing org name `松果排课` |
| BE `wechatLogin` | Real `jscode2session` when AppID/Secret are non-placeholder; mock only if `ALLOW_MOCK_AUTH` + placeholder creds |
| BE `organization/bind` | Set `Profile.role=PARENT` + invalidate auth session cache |
| BE `profile` routes | PRINCIPAL may update self profile (onboarding) |
| FE bootstrap query | Omit `undefined` query params |

## Still required for 真机 100%

1. Put **real** `WECHAT_APP_ID` / `WECHAT_APP_SECRET` in backend `.env` (current `mock_*` still forces mock openId).
2. Restart API after env change.
3. Rebuild mini program (`dev:weapp:dev`).
4. Admin on `:10086` to approve store-entry (`superadmin` / seed password).

## Deferred (not fake-success; tracked separately)

- Settings `notWired`, member-card stubs, local-only makeup/permission storage — ship APIs or hide; do not mock as success.
