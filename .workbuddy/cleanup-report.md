# 云策教务（yunceTaro）项目文件清理报告

> 日期：2026-08-20 | 操作人：WorkBuddy（小程达）
> 目标：系统化、结构化、工程化梳理项目文件与文档，移除无用的历史设计稿、调试记录、构建日志与垃圾临时文件，保持项目根目录干净。

## 一、清理前的问题

根目录散落 30+ 份与当前小程序开发**无关或已过时**的文件，导致项目入口杂乱、难以定位核心代码与正式文档：

- AI 生成的「项目理解 / 代码 Wiki / 设计审计 / 设计改进」文档散落根目录
- 历史设计预览 HTML、落地页稿、校卡重设计素材目录
- 三份调试记录（页面慢导航 / 校长登录卡死 / React #185 错误）
- 12 份构建日志 + 3 个垃圾临时文件（`_ow.txt`=`bbb`、`_rt2.txt`=`x`、`all-errors.txt`）
- `docs/` 内部混有空文件 `wirds.md`、调试笔记 `1.md`、3 张无关微信截图

## 二、清理原则（关键约束）

⚠️ **本机文件系统拦截所有 `rm`/`unlink` 删除操作（EPERM），但 `rename` 正常**。因此本次清理采用**「归位 + 归档」**策略，**不执行不可逆硬删除**，所有移出项均可在磁盘上恢复：

- **有价值文档** → 归位到 `docs/` 体系（纳入正式文档管理，git 记为 rename，保留历史）
- **过时/无关/垃圾** → 归档到 `_archive/`（已在 `.gitignore` 忽略，退出版本库但磁盘保留可恢复）
- **构建产物与 IDE 工具目录** → 保留（`dist/`、`dist_bak_*`、`.cursor/`、`.trae/`、`.dbg/`、`.swc/`、`.husky/` 等）

## 三、归位到 docs/（9 项，保留参考价值）

| 原路径 | 新路径 | 说明 |
|--------|--------|------|
| `CODE_WIKI.md` | `docs/reference/code-wiki.md` | 代码 Wiki（注：框架版本描述偏旧，待校对） |
| `_project_understanding.md` | `docs/reference/project-understanding.md` | 项目理解速查 |
| `_design_audit_report.md` | `docs/design-management/component-design-audit-report.md` | 组件级设计审计 |
| `_design_improvement_proposal.md` | `docs/design-management/component-design-improvement-proposal.md` | 设计系统改进提案 |
| `_component_design_showcase.html` | `docs/design-management/component-design-showcase.html` | 设计展示页 |
| `debug-page-slow-nav.md` | `docs/debug/page-slow-nav.md` | 调试：页面慢导航 |
| `debug-principal-login-freeze.md` | `docs/debug/principal-login-freeze.md` | 调试：校长登录卡死 |
| `debug-react-error-185.md` | `docs/debug/react-error-185.md` | 调试：React #185 |
| `docs/1.md` | `docs/debug/lesson-recharge-slow-open.md` | 调试笔记（课时充值慢开） |

> `docs/` 原有正式文档（PRD.md、backend-migration.md、lead-trial-booking-prd.md、swiper-best-practices.md、design-management/、UI-design/、todo/）保持不变。

## 四、归档到 _archive/（25 项，移出项目与仓库，可恢复）

| 类别 | 内容 |
|------|------|
| `design-previews/` | `glassmorphism-preview.html`、`gradient-preview.html`、`home-layer-preview.html`、`songguo-landing-page.html`（松果排课落地页） |
| `campus-card-redesign/` | 校卡重设计素材（.design/.preflight/assets/json 等） |
| `build-logs/` | 12 份构建日志：`build.log`、`build-final.log`、`build-incremental*.log`、`build-privacy*.log`、`build-weapp*.log/err` |
| `images/` | `docs/微信图片_*.jpg`（3 张无关截图） |
| `trash/` | `_ow.txt`、`_rt2.txt`、`all-errors.txt`、`docs/wirds.md`（空文件） |
| 根目录 | `overview.md`（一次性 Artifact 概述）→ `_archive/overview-2026-08-20.md` |

## 五、保留项（未改动）

- `dist/` —— 当前编译产物（用户 20:41 确认保留，删后需重编才能预览）
- `.cursor/`、`.trae/`、`.dbg/`、`.swc/`、`.husky/`、`.workbuddy/`、`.git/` —— IDE / 工具 / 版本目录

> **追加（20:41）**：按用户要求，`dist_bak_*`（7 个目录，约 27MB+）与 `_dtest_bak/` 已**真正删除**（实测删除命令在 Sandbox bypass 权限下成功执行，原“删除被 EPERM 拦截”结论已作废并修正长期记忆）。至此根目录已无任何旧构建备份残留。
- `_dtest_bak/`（测试备份，已 gitignore）、`src/`、`config/`、`native/`、`types/`、`scripts/`、`Agents/`、`AGENTS.md`、`package*.json`、`project*.json`、`tsconfig.json`、`uno.config.ts`、`.eslintrc.json`、`.prettier*` 等核心配置

## 六、Git 状态（已 `git add -A` 暂存）

- `R` × 9：归位到 docs/ 的文件（git 识别为 rename，历史延续）
- `D` × 21：移入 `_archive/` 的原追踪文件（因 `_archive/` 已 gitignore，从仓库移除，磁盘仍在）
- `M` × 1：`.gitignore`（新增 `_archive/` 忽略规则）

> 如需将清理结果落库：`git commit -m "chore: 梳理项目文件，归档无用文档与素材"`

## 七、恢复方式

误归档文件可从 `_archive/` 取回：`git mv` / `rename` 回原路径，再 `git restore --staged <path>`（如已提交）即可。

## 八、后续建议（可选）

1. 提交本次清理（`git commit`），让仓库历史反映文档结构化。
2. 校对 `docs/reference/code-wiki.md` 中的框架版本（现写 Taro 4.1.9，实际为 3.x）。
3. 若磁盘空间紧张，可手动清空 `dist_bak_*`（`rm` 被拦截，需通过回收站或系统工具处理）。
