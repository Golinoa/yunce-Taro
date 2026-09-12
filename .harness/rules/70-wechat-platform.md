---
last_updated: 2026-09-12
status: active
source: 主包超限、真机域名校验失败
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
