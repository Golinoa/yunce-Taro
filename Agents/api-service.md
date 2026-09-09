# Service 层与联调契约

页面/组件 → Zustand Store（如需跨页状态）→ Service → utils/request → 后端 API。

- src/data 已删除；运行时禁止恢复 Mock、硬编码业务列表或本地假成功。
- Service 使用现有 request 工具和聚合导出，负责 DTO 到现有 UI 模型的映射；先核对路由、validator 与字段单位，禁止猜接口。
- 当前 UI 固定；后端优先兼容已有前端契约。必要的 Service/类型适配须不改变 UI，并记录原因。
- 401/续期交给统一请求链路；不在每个页面另造登录逻辑。
- 写成功后按模块刷新信号/Store invalidate 更新，切机构清理域缓存。
- notWired 是未接通占位，不是业务实现。触发路径进统一 ISSUES 台账，不捕获后伪造成功。
- 测试只在测试文件中 mock 外部依赖，业务联调用真实 API；按模块验证正常、空态、错误、权限和幂等。

接口开发从统一模块指南开始；命令见 COMMANDS.md。UI 规范继续遵守 AGENTS.md。
