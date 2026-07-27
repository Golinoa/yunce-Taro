import { useDidShow, useDidHide } from '@tarojs/taro';
import React from 'react';
import { AuthProvider } from '@/utils/auth';
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
import './app.scss';

const App: React.FC<{ children?: React.ReactNode }> = (props) => {
  useDidShow(() => {
    // App 可见
  });

  useDidHide(() => {
    // App 隐藏
  });

  return <AuthProvider>{props.children}</AuthProvider>;
};

export default App;
