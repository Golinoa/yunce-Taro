import Taro, { useDidShow, useDidHide, useLaunch } from '@tarojs/taro';
import React, { useEffect } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import PrivacyPopup from '@/components/PrivacyPopup';
import { SubscribeAuthHost } from '@/components/subscribe';
import { scheduleDeferredAppStartup } from '@/utils/app-startup';
import { AuthProvider } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { consumeSubscribeOnShow } from '@/utils/subscribe-on-show';
import { logLaunchOptions, markAppColdStart } from '@/utils/launch-scene';
import 'uno.css';

/**
 * 跨分包共享模块必须被主包引用，否则 Taro MiniSplitChunksPlugin
 * 会将它们提取到 <subpackage>/sub-common/ 目录，导致微信小程序运行时
 * module not defined 错误。详见 MiniSplitChunksPlugin.hasMainChunk 逻辑。
 */
import '@/constants/lead';
import '@/constants/brand';
import '@/components/lead/LeadCard';
import '@/components/lead/LeadStatusBadge';
import '@/components/lead/ConvertSheet';
import '@/components/lead/FollowUpSheet';
import '@/components/Card';
import '@/components/CardHeader';
import '@/components/FormRow';
import '@/components/InlineSelector';
import '@/components/InlineDropdown';
import '@/components/ChipPicker';
import '@/components/SegmentedControl';
import '@/components/InstallmentPanel';
import '@/components/QuestionHint';
import '@/components/reschedule/WorkflowHeaderCard';
import '@/components/schedule/ScheduleBookingSwitch';
import '@/components/schedule/ScheduleCardMenu';
import '@/components/lead/TrialBookingSkeleton';
import '@/components/lead/TrialBookingView';
import '@/components/lead/BookTrialByClassSheet';
import '@/components/campus/CampusSwitcher';
import '@/components/campus/CampusTrigger';
import '@/stores/campus';
import '@/stores/subscribe-auth';
import '@/components/subscribe';
import '@/services/member-card';
import '@/services/card-type';
import '@/services/student';
import '@/services/follow-record';
import '@/components/student/StudentAvatar';
import '@/components/teacher/SalaryEditSheet';
import '@/components/PageContainer';
import './app.scss';

// 模块注入最早痕迹：若桌面启动连这行都没有，说明 JS 尚未执行就退出（非业务代码闪退）
// eslint-disable-next-line no-console
console.warn('[App] module loaded');

// H-02：全局未捕获错误兜底上报（经 utils/logger 门控，生产可剥离）
if (typeof Taro !== 'undefined' && typeof Taro.onError === 'function') {
  Taro.onError((err) => {
    logError('app.onError', err);
  });
}

const App: React.FC<{ children?: React.ReactNode }> = (props) => {
  useLaunch((options) => {
    try {
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
    // B-01(工程)：全局错误边界，渲染异常降级为错误页而非白屏
    <ErrorBoundary>
      <AuthProvider>
        {props.children}
        <PrivacyPopup />
        <SubscribeAuthHost />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
