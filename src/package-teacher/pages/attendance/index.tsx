/**
 * 旧「考勤记录」入口保留路由，避免深链 404。
 * 本版与「上课记录 / 课消」重复，统一重定向到上课记录。
 * 【下版】员工上下班签到考勤：见 .cursor/rules/next-version-backlog.mdc
 */
import Taro, { useDidShow } from '@tarojs/taro';
import React from 'react';
import PageContainer from '@/components/PageContainer';
import { withRouteGuard } from '@/utils/route-guard';

const AttendancePage: React.FC = () => {
  useDidShow(() => {
    void Taro.redirectTo({ url: '/package-course/pages/records/index' });
  });

  return <PageContainer />;
};

export default withRouteGuard(AttendancePage);
