/**
 * 约课独立页面 package-lead/pages/trial-booking
 *
 * 现在只是一个包装壳：
 * - 解析 URL 参数
 * - 提供自定义导航栏（返回 + 排课/约课 Tab 切换）
 * - 内嵌 TrialBookingView 组件完成具体约课逻辑
 *
 * 课表页也通过 TrialBookingView 内联展示约课视图，实现毫秒级 Tab 切换。
 */
import { View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import React, { useState } from 'react';
import Icon from '@/components/Icon';
import TrialBookingView, { type TrialMode } from '@/components/lead/TrialBookingView';
import PageContainer from '@/components/PageContainer';
import ScheduleBookingSwitch from '@/components/schedule/ScheduleBookingSwitch';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

interface PageParams {
  leadId?: string;
  mode?: TrialMode;
  date?: string;
  teacherId?: string;
}

const TrialBookingPage: React.FC = () => {
  const navSafeHeight = useNavSafeHeight();
  const [params, setParams] = useState<PageParams>({});

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({
      leadId: opt.leadId,
      mode: 'private',
      date: opt.date,
      teacherId: opt.teacherId,
    });
  });

  return (
    <PageContainer className="flex flex-col h-screen">
      {/* 自定义导航栏：返回 + 排课/约课切换 */}
      <View className="bg-schedule-header flex-shrink-0">
        <View
          className="flex items-end px-[18rpx] pb-[18rpx]"
          style={{ height: `${navSafeHeight}px` }}
        >
          <View className="flex items-center gap-[14rpx]">
            <View
              className="flex h-[72rpx] w-[72rpx] items-center justify-center active:opacity-80"
              onClick={() => Taro.navigateBack()}
            >
              <Icon name="mdi-chevron-left" size="md" color="white" />
            </View>
            <ScheduleBookingSwitch active="booking" variant="dark" />
          </View>
        </View>
      </View>

      <TrialBookingView
        className="flex-1"
        initialLeadId={params.leadId}
        initialMode={params.mode}
        initialDate={params.date}
        initialTeacherId={params.teacherId}
        onSuccess={() => Taro.navigateBack()}
      />
    </PageContainer>
  );
};

export default TrialBookingPage;
