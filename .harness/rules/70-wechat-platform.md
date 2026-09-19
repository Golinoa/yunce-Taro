---
last_updated: 2026-09-19
status: active
source: 主包超限、真机域名校验失败、测试包误指本地地址及微信压缩审计失败；官方性能优化指南（2021-12-20）
---

# R70 微信小程序平台约束

## 体积与分包

❌ 新业务页直接放进主包

✅ FIX: 主包只放 Tab + 启动必需；新业务页进对应 `package-*`（`student` / `teacher` / `course` / `settings` / `statistics` / `lead` / `auth`）。

- `lazyCodeLoading: 'requiredComponents'` 已开启，自定义组件勿无故全局注册。
- 分包预下载 `preloadRule` 按需配置，别无脑全量预下载。
- 大图不进主包，走压缩资源脚本。

## 合法域名

❌ 本地调试靠「关闭域名校验」当上线方案

✅ FIX: 真机 / 正式环境的 request、uploadFile、downloadFile 域名必须在公众平台后台配置；正式环境不得指向未备案或非法域名。

## 测试环境 API 与构建压缩

❌ `build:weapp:dev` / `dev:weapp:dev` 默认指向 `127.0.0.1`，或误以为仅修改项目配置就能通过微信工具的压缩扫描

✅ FIX: 测试包默认使用 `https://dev.chancore.cn/api/app/v1`；该域名回源 WSL 测试服务。本地地址只能通过显式 `TARO_API_BASE_URL` 临时覆盖。微信“代码质量”中的 WXML/WXSS 压缩检查以开发者工具的“详情 → 本地设置”为准，必须人工开启：上传代码时自动压缩脚本文件、上传代码时自动压缩 wxml 文件、上传代码时自动压缩样式文件。项目配置中的同名字段只能作为默认/同步配置，不能替代本地设置。

项目配置仍保持以下默认值，避免新环境遗漏：

```json
{
  "minified": true,
  "minifyWXSS": true,
  "minifyWXML": true
}
```

构建后必须确认 `dist/common.js` 含 `dev.chancore.cn`。当前团队工作流直接打开 `dist/`，因此构建脚本必须同时生成 `dist/project.config.json` 与 `dist/project.private.config.json`，且前者的 `miniprogramRoot` 必须为 `./`。重新加载**同一份 dist 项目**后，在“详情 → 本地设置”开启三个压缩开关，先重新编译，再在“代码质量”面板执行重新扫描；只勾选开关但不重新扫描，旧的 `WXML_COMPRESS_OPEN` / `WXSS_COMPRESS_OPEN` 结果不会自动变绿。

若仍未通过，按顺序核对：

1. 微信工具当前项目目录必须是 `yunceTaro/dist`，不能是旧的 dist、`yunceTaro` 根目录或其他复制目录。
2. 关闭项目后重新打开，再检查“详情 → 本地设置”；配置写入的 `dist/project.private.config.json` 必须含 `minifyWXML: true`、`minifyWXSS: true`。
3. 执行“清除缓存/重新编译”后重新运行代码质量扫描；不要只刷新模拟器页面。
4. 若工具仍读取旧状态，完全退出微信开发者工具后再启动；不要在多个窗口同时打开同一 dist。

官方规则说明：<https://developers.weixin.qq.com/community/develop/doc/00040e5a0846706e893dcc24256009>

📖 See: `../skills/verify-build.md`、`../../scripts/build-weapp-dev.mjs`

## API 可用性

❌ 直接调用相册、定位、选点、录音等能力而不做判断

✅ FIX: 优先用 Taro 封装；先确认基础库版本与隐私接口声明，再实现降级与失败 Toast。

## 跳转

❌ Tab 页用 `navigateTo`、跨分包用错路径

✅ FIX:

```tsx
Taro.switchTab({ url: '/pages/home/index' });        // Tab 页
Taro.navigateTo({ url: '/pages/teacher-detail/index?id=123' });  // 普通页
Taro.redirectTo({ url: '/pages/login/index' });      // 不可返回
```

## 渲染性能

❌ 整页大对象塞进 Store 触发全量重渲染；长列表一次性渲染

✅ FIX: 列表分页 / 分段渲染；Zustand 选择性订阅（见 `50-state-and-types.md`）。

## 安全区

❌ 底部操作栏被 Home Indicator 遮挡

✅ FIX: `pb-safe` / `pb-safe-bar`；自定义导航 `pt-nav-safe`。

## 页面导航（推入表型入口防双击 · 2026-09-19 场地事故沉淀）

❌ 浮层按钮 / 列表项等**推入表单型**入口直接裸调 `Taro.navigateTo`
（快速双击会把两层相同页面压栈；保存后 navigateBack 只关顶层，
露出底层同款表单 —— 表现为「保存成功但页面没关、列表没刷新」）

✅ FIX: 统一走 `navigateToOnce(url)`（`utils/navigation.ts`，同 URL 单飞锁）：

```tsx
const handleAdd = useCallback(() => {
  navigateToOnce('/package-settings/pages/venue-form/index');
}, []);
```

📖 See: `docs/diagnostics/2026-09-19-campus-data-harness.md` §3 页面规则
