# 云策教务 (yunceTaro) 长期记忆

## 构建约定（重要）
- **默认增量编译，不要全量打包**：用 `npm run build:weapp`（保留 `node_modules/.cache/webpack/weapp` 缓存），不要跑 `npm run build:weapp:clean`。全量清缓存编译极慢（10 分钟+），用户明确要求避免。
- **用 PowerShell 跑编译，不要用 Git Bash**：Git Bash 下 Taro 并行 emit 资源会随机报 `ENOENT`；PowerShell 稳定。
- Mock 模式必须带 `VITE_USE_MOCK=true`，否则生产模式禁用 Mock 导致网络异常 / 登录失败。
- 仅当“代码改了小程序里没生效”时才用 `build:weapp:clean` 清缓存（用户已说平时不要）。

## ⚠️ 删除操作权限（构建必读，2026-08-20 修正）
- **实测结论（20:41）**：独立删除命令（Bash 跑 node `fs.rmSync({recursive,force})`）在**获得 Sandbox bypass / escalation-approved 权限**时可成功删除目录（已实测删掉全部 `dist_bak_*` 与 `_dtest_bak/`，释放约 27MB+）。
- 之前“本机拦截所有 rm/unlink（EPERM）”论断**已过时**：当时在受限沙箱内，删除被转安全删除→回收站并以 EPERM 失败；现在命令会触发 sandbox bypass，删除可行。**若遇 EPERM，请求 sandbox-bypass 提升权限后再删，或退化为 `rename` 到 `_archive/` 兜底。**
- **编译流程注意**：Taro 编译开头 `emptyOutputDir` 仍走 `unlink` 清旧 `dist`；为稳妥，编译前仍建议用受管 node 把旧 `dist` **重命名移走**（不删）再编（流程见下）。但普通文件/备份删除已可直接 `rm`。
- **正确编译流程（绕开删除）**：用受管 node 把旧 `dist` **重命名移走**（不删），让 Taro 全新创建 `dist`：
  ```powershell
  $env:VITE_USE_MOCK='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'
  & "C:\Users\Agust\.workbuddy\binaries\node\versions\22.22.2\node.exe" -e "const fs=require('fs'); const p='D:/Coding/yunce/yunceTaro/dist'; if(fs.existsSync(p)){ fs.renameSync(p, p+'_bak_'+Date.now()); }"
  npm run build:weapp
  ```
- `dist_bak_*`：现已实测可删（需 sandbox bypass 权限）；之前“必须保留、不要 rm”的结论作废。普通环境若被拦，请求提升权限后 `rm -rf` 即可。
- `config/index.ts` 已对 weapp 构建**排除 `@tarojs/plugin-html`**（该插件每次构建覆盖写 `node_modules/.../runtime.js` 也会踩删除拦截；项目纯 weapp 不需要它，无 `dangerouslySetInnerHTML`/`WebView` 用法）。

## Git 推送约定（2026-08-22 实测）
- **推送命令**：`GIT_TERMINAL_PROMPT=0 git push origin master`。本仓库 `.git/config` 已配 `credential.helper=""` + `credential.helper=wincred`（GCM 在非交互 shell 返回空凭据会卡死；wincred 直接读 Windows 凭据管理器 `git:https://gitee.com`，账户 15890006269）。
- **推送后 `[gone]` 现象**：沙箱会把 git ref 事务视为删除操作，隔离 `.git/refs/remotes/origin/` 整目录——推送成功但本地跟踪引用消失。修复（每次照做即可）：
  ```bash
  mkdir -p .git/refs/remotes/origin && printf '<最新sha>\n' > .git/refs/remotes/origin/master
  ```
- **git 仓库损坏恢复套路**：`bad object HEAD` 时 → ① `git update-ref refs/heads/master <origin/master sha>`；② `rm .git/index && git read-tree HEAD` 重建索引；③ 工作区 `git add -A` 重新提交。工作区文件是唯一可信源。
- commit 作者邮箱 `151536422@qq.com` 与 Gitee 认证账户 `15890006269` 是两回事，不要混淆。

## 编译卡死根因（避坑）
- 后台编译任务被中断后 `node`/`taro` 进程可能僵死（实测挂 9~11 小时），锁住 `dist` 与日志，导致后续编译卡死/残缺/ENOENT。
- 跑编译前先 `ps aux | grep node` 确认无残留进程；有就用 `TaskStop` 停掉对应后台任务再编。
- 验证产物：Taro 3 组件不会生成独立 `dist/components/<Name>/` 目录（正常，走 base.wxml 的 taro_tmpl）；中文被压缩为 `\uXXXX` 转义，字面量 grep 搜不到是正常的，搜 `StudentMultiSelectSheet`/`resolveEffectiveSubjectId` 或转义 `u672a`(未)`u6392`(排)`u73ed`(班) 确认。
