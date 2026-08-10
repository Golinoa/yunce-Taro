import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import path from 'node:path';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import devConfig from './dev';
import prodConfig from './prod';
import UnoCSS from '@unocss/webpack';

const packageJson = require('../package.json') as { version: string };

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  // 当前项目处于前端高频联调阶段，默认启用 mock。
  // 正式联调或发版时，显式传入 VITE_USE_MOCK=false 即可切到真实接口。
  const useMock = process.env.VITE_USE_MOCK ?? 'true';
  const apiBaseUrl = process.env.TARO_API_BASE_URL ?? '/api/app/v1';
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'yunce-edu',
    date: '2025-12-10',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: process.env.TARO_OUTPUT_DIR || 'dist',
    plugins: ['@tarojs/plugin-html'],
    defineConstants: {
      'process.env.TARO_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'process.env.VITE_USE_MOCK': JSON.stringify(useMock),
      'process.env.TARO_ENABLE_LOCAL_DEBUG': JSON.stringify(
        process.env.TARO_ENABLE_LOCAL_DEBUG ?? 'false',
      ),
      'process.env.TARO_APP_VERSION': JSON.stringify(packageJson.version),
    },
    copy: {
      patterns: [
        {
          from: 'src/assets/images',
          to: 'dist/assets/images',
        },
      ],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false,
      },
    },
    cache: {
      enable: true,
    },
    mini: {
      miniCssExtractPluginOption: {
        ignoreOrder: true,
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['nut-'],
          },
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      webpackChain(chain) {
        // 启用文件系统持久化缓存，减少重复编译耗时。
        chain.merge({
          cache: {
            type: 'filesystem',
            name: 'yunce-weapp-cache',
            cacheDirectory: path.resolve(__dirname, '../node_modules/.cache/webpack/weapp'),
            buildDependencies: {
              config: [__filename, path.resolve(__dirname, './dev.ts'), path.resolve(__dirname, './prod.ts')],
            },
          },
        });
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin);
        chain.plugin('unocss').use(UnoCSS());
        // 关闭 source map，减少包体积（微信主包2MB限制）
        chain.devtool(false);
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js',
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['body'],
            baseFontSize: 37.5,
            unitPrecision: 5,
          },
        },
      },
      webpackChain(chain) {
        chain.merge({
          cache: {
            type: 'filesystem',
            name: 'yunce-h5-cache',
            cacheDirectory: path.resolve(__dirname, '../node_modules/.cache/webpack/h5'),
            buildDependencies: {
              config: [__filename, path.resolve(__dirname, './dev.ts'), path.resolve(__dirname, './prod.ts')],
            },
          },
        });
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin);
        chain.plugin('unocss').use(UnoCSS());
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: true,
        },
      },
    },
  };
  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
