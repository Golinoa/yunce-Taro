# NO-GO Elimination Plan (Locked Decisions · 2026-08-31)

## Product decisions (locked)

| ID | Decision |
|----|----------|
| Q1 | **Implement** all settings `notWired` write paths this iteration; must pass CI gates |
| Q2 | **Member card** is a primary template — ship production-quality E2E (not stubs) |
| Q3 | **Subscribe messages** enabled this release; real-device acceptance required; fix quota page bugs (refactor OK) |
| Q4 | Privacy guide is live → `__usePrivacyCheck__: true` (done in `app.config.ts`) |
| Q5 | Keep placeholder **copy + buttons** (do not hide); no fake success |

## Deferred (idle work later)

- Convert existing **code comments** and **docs** to English after main paths are green.
- New comments/docs from now on: **English**. UI strings stay **Chinese**.

## Workstreams (order)

### P0 — Release blockers / user-facing correctness

1. **Privacy** — enabled (`__usePrivacyCheck__: true`). Verify on real device: privacy popup → chooseMedia/chooseLocation works after agree.
2. **Subscribe quota page** (`message-auth`) — fix false “已补充”, stale refresh, mock auto-accept, server remain races.
3. **Parent students empty (W3-03)** — seed/list filter so parent sees bound children.
4. **Member card** — wire FE to BE `/card-types/member-cards*`, org-scope, issue/freeze/edit/activate/deduct; hide only refund/transfer until modeled **or** implement if in “very well” scope.
5. **Settings notWired (Q1)** — BE APIs + FE services for campuses write, salary models, pay-day, holidays, business-hours, subjects/venues/rooms, package templates, teacher salary rules / deduction CRUD.

### P1 — Hardening

- Seed data for member cards + subscribe templates (non-mock tmpl ids).
- E2E regression expansion for member-card + subscribe auth-report.
- Production checklist: domains, no `ALLOW_MOCK_AUTH` / dev switcher, migrate deploy, `build:weapp:prod`.

## Success criteria for “NO-GO cleared”

- [ ] Real-device privacy flow OK with check enabled
- [ ] Subscribe: quota page remain matches server; no false success toast; real-device subscribe accept increments remain
- [ ] Parent walkthrough C2: children visible
- [ ] Member card: list / issue / detail / freeze / edit work on test env with persistence
- [ ] Settings writes that were `notWired` either work or fail with honest errors only after API exists (Q1 = must work)
- [ ] `verify:sop` + FE `check` + E2E still green
- [ ] Manual walkthrough A/B/C signed off by PM

## Owner split

| Who | Tasks |
|-----|--------|
| **User** | Manual walkthrough feedback template; real-device subscribe acceptance; confirm privacy popup on phone; MP admin tmpl ids live |
| **Agent** | Code/API for streams 2–5; CI; keep English plan/docs updated |

## Immediate next commits (this session+)

1. Subscribe `message-auth` + service error semantics + BE atomic remain
2. Parent students list fix
3. Member-card FE wire + BE org-scope (read + issue + freeze first)
4. Settings API backlog ticketed by domain and shipped in CI-sized PRs
