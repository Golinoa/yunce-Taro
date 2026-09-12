---
last_updated: 2026-09-12
status: active
---

# Skill: 验证与交付

> **编译由用户亲自执行**。需要在 AI 侧跑构建时，先向用户申请并说明命令与用途，不要自行启动全量构建。

## 分层验证（由快到慢）

| 层级 | 命令 | 何时跑 |
| --- | --- | --- |
| 类型 | `npm run typecheck` | 每次改 `src/**/*.ts(x)` |
| 规范 | `npm run lint` | 每次改代码（注意下方既存 CRLF 报错） |
| 格式 | `npm run format:check` | 提交前 |
| 全量静态 | `npm run check` | 交付前（= typecheck + lint + format:check） |
| 单测 | **分批跑**（见下节） | 改了逻辑 / 工具函数 / Service |
| 覆盖率 | `npm run coverage` | 需要量化时 |
| 编译 | `npm run build:weapp:dev` | 影响运行时代码时 |

## 单测必须分批跑（2026-09-12 实测）

`npm test` 跑全量（115 文件）时**测试会全绿，但进程跑完不退出**（有未清理的 open handle），
表现为命令长时间挂住——容易误判成"测试卡死"。用分批跑规避：

```bash
npx vitest run src/services                    # 29 文件 / 105 tests
npx vitest run src/utils                       # 51 文件 / 270 tests
npx vitest run src/constants src/pages src/package-course src/package-student src/stores src/components
```

> 需要看中途进展时把输出重定向到文件（`> _t.log 2>&1`）再 `tail`，不要依赖进程退出判断完成。
> 看进展的命令：`grep -c "✓" _t.log`。用完删除临时日志。

三道合计应覆盖全部 115 文件；若数量对不上说明漏了目录，别直接标"全过"。

## 已知门禁现状：lint 有既存 CRLF 报错（非改动引入）

`npm run lint` 当前报约 **2038 处 / 52 文件**错误，几乎全是 `Delete ␍`（CRLF 换行）。实测结论：

- **仓库 blob 里存的就是 CRLF**（`git cat-file -p HEAD:src/theme.ts` 可见），最早可追到 8 月的提交。
- 成因：`core.autocrlf=true` + `.prettierrc` 的 `endOfLine: "lf"` + **缺 `.gitattributes`** 三者冲突。
- **不是本次改动引入**：涉及文件（`src/theme.ts`、`src/custom-tab-bar/index.tsx` 等）多为历史文件。
- CI 跑 `npm run check`（含 lint），所以该问题会让 CI 变红。

交付时如实说明"lint 的 CRLF 为既存问题、非本次引入"即可；统一修复（补 `.gitattributes` + `format`）
是独立课题，会动 52 个文件的换行产生大 diff，**不要夹在业务改动里顺手做**。

## 编译命令（用户执行）

| 命令 | 用途 |
| --- | --- |
| `npm run dev:weapp` | 开发 + 热更 |
| `npm run dev:weapp:dev` | 开发，连测试环境、关 Mock |
| `npm run build:weapp:dev` | 测试环境构建 |
| `npm run build:weapp:prod` | 生产构建 |
| `npm run build:weapp:clean` | 清缓存全量（仅 dist 损坏时用） |

> 增量优先，全量慢。只有 dist 损坏（如 `dist/app.js` 缺失）才清缓存全量重建。
> 仅修改文档无需业务编译。

## 交付时必须说明

- [ ] 是否已重编译，dist 是否是最新
- [ ] 跑了哪些检查、结果如何
- [ ] 未接通 / 待确认项是否登记进 ISSUES 台账
- [ ] 有无需要用户决策的冲突（前端 UI 已固定，后端优先兼容前端）

## 验收要点

```bash
ls -la dist/app.js                      # 存在
grep -r "api.chancore.cn" dist/ | head -1   # 生产域名存在
```

## 验证分支（业务改动）

按模块验证**五种分支**：正常 / 空态 / 错误 / 无权限 / 幂等。

## 标签与推送

| 标签 | 触发 | 用途 |
| --- | --- | --- |
| `dev-*` / `ci-*` | `ci.yml` 质量门禁 | **默认**：推代码、跑 CI |
| `v*` | `release.yml` prod 构建 + `upload:weapp` | **仅当用户明确要求**发体验版 |

**默认 `dev-*`，禁止擅自打 `v*` 或执行 `upload:weapp`。** 详见 `.cursor/rules/taro-tag-default-dev.mdc`。
