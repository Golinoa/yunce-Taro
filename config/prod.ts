import type { UserConfigExport } from '@tarojs/cli';
export default {
  mini: {
    // 生产环境关闭 source map，减少包体积
    miniCssExtractPluginOption: {
      ignoreOrder: true,
    },
    webpackChain(chain) {
      // 禁用生产环境的 source map
      chain.devtool(false);
    },
  },
  h5: {},
} satisfies UserConfigExport<'webpack5'>;
