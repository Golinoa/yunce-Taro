import type Chain from 'webpack-chain';

/**
 * Mock 数据模块已拆除；保留空钩子以免改动 config/index 调用点。
 * @deprecated Phase F 完成后无 stub 替换需求
 */
export function applyMockExcludeWebpack(_chain: Chain, _useMock: string): void {
  // no-op
}
