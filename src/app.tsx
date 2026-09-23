import Taro, { useDidShow, useDidHide, useLaunch } from '@tarojs/taro';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SubscribeAuthHost } from '@/components/subscribe';
import { APP_VERSION } from '@/constants/version';
// 微信小程序运行时没有 AbortController，而 @tanstack/query-core 的 Query.fetch() 第一行就是
// `new AbortController()`（全库唯一引用）。缺失会直接抛 ReferenceError，导致所有 query 的
// queryFn 永不执行、fetchStatus 永久停在 idle。详见 docs/diagnostics/FE-15-修复笔记.md。
import { ABORT_CONTROLLER_POLYFILL_INSTALLED } from '@/utils/abort-controller-polyfill';
import { scheduleDeferredAppStartup } from '@/utils/app-startup';
import { AuthProvider } from '@/utils/auth';
import { clearIfVersionMismatch } from '@/utils/cache-store';
import { logLaunchOptions, markAppColdStart } from '@/utils/launch-scene';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';
import { consumeSubscribeOnShow } from '@/utils/subscribe-on-show';
import 'uno.css';
/**
 * 跨分包共享模块必须被主包引用，否则 Taro MiniSplitChunksPlugin
 * 会将它们提取到 <subpackage>/sub-common/ 目录，导致微信小程序运行时
 * module not defined 错误。详见 MiniSplitChunksPlugin.hasMainChunk 逻辑。
 */
import '@/constants/lead';
import '@/constants/brand';
import '@/components/lead/LeadCard';
import '@/components/Card';
import '@/components/FormRow';
import '@/components/ChipPicker';
import '@/components/SegmentedControl';
import '@/components/InstallmentPanel';
import '@/components/QuestionHint';
import '@/components/reschedule/WorkflowHeaderCard';
import '@/components/lead/TrialBookingSkeleton';
import '@/components/lead/TrialBookingView';
import '@/components/lead/BookTrialByClassSheet';
import '@/stores/campus';
import '@/stores/subscribe-auth';
import '@/services/member-card';
import '@/services/card-type';
import '@/services/student';
import '@/components/student/StudentAvatar';
import '@/components/student/StudentListCard';
import '@/components/PageContainer';
import './app.scss';

// 不注册 onNeedPrivacyAuthorization，保留微信系统原生隐私弹窗（图二）

/**
 * 查询缓存保鲜期（Batch 8 POC 口径）：30s 内切回同一页面不再重复请求。
 * 小程序无「窗口焦点 / 网络重连」语义，两个 refetch 开关全局关闭，避免无效请求。
 * retry 关闭：与改造前手写取数一致（原实现失败只记日志不重试），
 * 否则默认 3 次重试会把失败场景的请求数放大 4 倍。
 */
const QUERY_STALE_TIME_MS = 30_000;

/**
 * FE-15 启动自检（一次性）：确认 AbortController 可用。
 * 小程序原生没有它，而 @tanstack/query-core 的 Query.fetch() 第一行就 `new AbortController()`，
 * 缺失会让所有 query 静默失效（queryFn 永不执行）。这条日志用于一眼确认 polyfill 是否生效。
 */
reportLocalDebug({
  hypothesisId: 'abort-controller-env',
  location: 'src/app.tsx:env-check',
  msg: 'AbortController 环境自检',
  data: {
    installed: ABORT_CONTROLLER_POLYFILL_INSTALLED,
    hasAbortController: typeof AbortController !== 'undefined',
    hasAbortSignal: typeof AbortSignal !== 'undefined',
    hasGlobalThis: typeof globalThis !== 'undefined',
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  },
});

// H-02：全局未捕获错误兜底上报（经 utils/logger 门控，生产可剥离）
if (typeof Taro !== 'undefined' && typeof Taro.onError === 'function') {
  Taro.onError((err) => {
    logError('app.onError', err);
  });
}

const App: React.FC<{ children?: React.ReactNode }> = (props) => {
  useLaunch((options) => {
    try {
      // G2 版本护栏：APP_VERSION 不符即整体清空持久缓存（cache-store 默认休眠，无行为影响）
      clearIfVersionMismatch(APP_VERSION);
      markAppColdStart(options);
      logLaunchOptions(options);
    } catch (err) {
      logError('app.useLaunch', err);
      markAppColdStart();
    }
  });

  useEffect(() => {
    scheduleDeferredAppStartup();
  }, []);

  useDidShow((options) => {
    try {
      // eslint-disable-next-line no-console
      console.warn('[App Show]', options?.scene, options?.path);
      void consumeSubscribeOnShow();
    } catch {
      // 忽略
    }
  });

  useDidHide(() => {
    // App 隐藏
  });

  return (
    // 页面取数的统一查询缓存（POC：先在首页试点）
    <QueryClientProvider client={queryClient}>
      {/* B-01(工程)：全局错误边界，渲染异常降级为错误页而非白屏 */}
      <ErrorBoundary>
        <AuthProvider>
          {props.children}
          <SubscribeAuthHost />
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
