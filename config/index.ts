import crypto from 'node:crypto';
import path from 'node:path';
import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import UnoCSS from '@unocss/webpack';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import devConfig from './dev';
import prodConfig from './prod';
import { applyMockExcludeWebpack } from './mock-exclude';

const packageJson = require('../package.json') as { version: string };
const PROD_API_BASE_URL = 'https://api.chancore.cn/api/app/v1';

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  // 默认生产模式：Mock 关、API 指向线上。显式 VITE_USE_MOCK=true 才启用 mock（dev:weapp:mock / build:weapp:mock）。
  // 生产构建若误带 VITE_USE_MOCK=true 会被强制关闭并告警（G-01 守卫）。
  let useMock = process.env.VITE_USE_MOCK ?? 'false';
  // G-01 守卫：生产环境默认禁止携带 mock（线上安全）。
  // 本地演示/联调确需在产物中保留 mock 时，显式设置 TARO_ALLOW_MOCK_PROD=1 可豁免（受控通道，默认不生效）。
  const allowMockInProd = process.env.TARO_ALLOW_MOCK_PROD === '1';
  if (process.env.NODE_ENV === 'production' && useMock === 'true' && !allowMockInProd) {
    console.warn('[G-01] 生产构建检测到 VITE_USE_MOCK=true，已强制关闭 mock 以保证线上数据真实。');
    useMock = 'false';
  }
  const apiBaseUrl = process.env.TARO_API_BASE_URL ?? PROD_API_BASE_URL;
  /** mock / API / Node 版本切换时必须隔离 webpack 缓存，否则会复用错误 chunk（如缺失的 sub-common） */
  const weappCacheKey = crypto
    .createHash('md5')
    .update(`${useMock}|${apiBaseUrl}|${process.version}`)
    .digest('hex')
    .slice(0, 10);
  // 构建目标平台（taro build --type xxx）。weapp 为纯小程序，组件编译为原生组件，
  // 不需要 @tarojs/plugin-html（该插件仅用于 H5/HTML 渲染）。
  // 排除它可避免其在初始化阶段覆盖写 node_modules 内 runtime.js —— 该写操作在当前
  // 执行环境下被拦截（无法覆盖/删除已有文件），会导致构建必挂。H5 构建仍保留。
  const typeIdx = process.argv.indexOf('--type');
  const isWeappBuild = typeIdx >= 0 && process.argv[typeIdx + 1] === 'weapp';
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
    plugins: isWeappBuild ? [] : ['@tarojs/plugin-html'],
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
          from: 'src/assets/icons',
          to: 'dist/assets/icons',
        },
        // 主包图片白名单：禁止整目录拷贝大图，硬顶微信 1.5MB 主包上限
        {
          from: 'src/assets/images/sgpk.png',
          to: 'dist/assets/images/sgpk.png',
        },
        {
          from: 'src/assets/images/cover-home.webp',
          to: 'dist/assets/images/cover-home.webp',
        },
        {
          from: 'src/package-settings/assets/wx.webp',
          to: 'dist/package-settings/assets/wx.webp',
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
      optimizeMainPackage: {
        enable: true,
      },
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
            name: `yunce-weapp-${weappCacheKey}`,
            cacheDirectory: path.resolve(__dirname, '../node_modules/.cache/webpack/weapp'),
            buildDependencies: {
              config: [
                __filename,
                path.resolve(__dirname, './dev.ts'),
                path.resolve(__dirname, './prod.ts'),
              ],
            },
          },
        });
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin);
        chain.plugin('unocss').use(UnoCSS());
        applyMockExcludeWebpack(chain, useMock);
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
              config: [
                __filename,
                path.resolve(__dirname, './dev.ts'),
                path.resolve(__dirname, './prod.ts'),
              ],
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
