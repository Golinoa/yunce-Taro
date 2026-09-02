/**
 * 学员详情页
 *
 * 使用场景：学员列表 / 续费提醒 / 异常考勤 / 充值记录 / 会员列表 / 统计告警等入口进入。
 * 功能说明：编排加载、派生数据与各 Tab 面板；path 仍为 `...?id=`，行为零改。
 */
import { View, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import { useThemeStore } from '@/stores/theme';
import type { CoursePackage, PackageTransaction } from '@/types/course-package';
import type { FollowRecord } from '@/types/follow-record';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student, StudentParent } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';
import AttendancePanel from './AttendancePanel';
import ConsumptionPanel from './ConsumptionPanel';
import FollowPanel from './FollowPanel';
import PackagesPanel from './PackagesPanel';
import ProfilePanel from './ProfilePanel';
import RefundSheet from './RefundSheet';
import {
  STUDENT_DETAIL_SWIPER_DURATION,
  STUDENT_DETAIL_TABS,
  STUDENT_DETAIL_TAB_INDEX_MAP,
  type CardSubTabKey,
  type TabKey,
} from './student-detail-constants';
import StudentDetailFab from './StudentDetailFab';
import StudentDetailHeader from './StudentDetailHeader';
import StudentDetailTabBar from './StudentDetailTabBar';
import { useStudentDetailActions } from './use-student-detail-actions';
import { useStudentDetailDerived } from './use-student-detail-derived';
import { useStudentDetailLoaders } from './use-student-detail-loaders';

const StudentDetail: React.FC = () => {
  const { profile } = useAuth();
  const { activeTheme } = useThemeStore();
  const isTeacher = isStaffRole(profile?.currentContext?.role);
  const currentUserId = profile?.id || '';

  const studentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [student, setStudent] = useState<Student | null>(null);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [packages, setPackages] = useState<CoursePackage[]>([]);
  const [packageTransactions, setPackageTransactions] = useState<PackageTransaction[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [memberCards, setMemberCards] = useState<MemberCardDetail[]>([]);
  const [followRecords, setFollowRecords] = useState<FollowRecord[]>([]);
  const [parents, setParents] = useState<StudentParent[]>([]);
  const [cardSubTab, setCardSubTab] = useState<CardSubTabKey>('active');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [studentSwiperCurrent, setStudentSwiperCurrent] = useState(
    STUDENT_DETAIL_TAB_INDEX_MAP.profile,
  );

  const [showRefundSheet, setShowRefundSheet] = useState(false);
  const [selectedRefundPackageId, setSelectedRefundPackageId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const [statusBarHeight, setStatusBarHeight] = useState(44);
  useEffect(() => {
    const windowInfo = Taro.getWindowInfo();
    setStatusBarHeight(windowInfo.statusBarHeight || 44);
  }, []);

  useEffect(() => {
    setStudentSwiperCurrent(STUDENT_DETAIL_TAB_INDEX_MAP[activeTab]);
  }, [activeTab]);

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) {
        return;
      }
      setStudentSwiperCurrent(STUDENT_DETAIL_TAB_INDEX_MAP[tab]);
    },
    [activeTab],
  );

  const handleStudentSwiperChange = useCallback((event: { detail?: { current?: number } }) => {
    setStudentSwiperCurrent(event.detail?.current ?? 0);
  }, []);

  const handleStudentSwiperFinish = useCallback(
    (event: { detail?: { current?: number } }) => {
      const current = event.detail?.current ?? studentSwiperCurrent;
      const nextTab = STUDENT_DETAIL_TABS[current]?.key ?? 'records';
      if (nextTab !== activeTab) {
        setActiveTab(nextTab);
      }
    },
    [activeTab, studentSwiperCurrent],
  );

  const { loadData } = useStudentDetailLoaders({
    studentId,
    currentUserId,
    setStudent,
    setRecords,
    setPackages,
    setPackageTransactions,
    setLeaves,
    setMemberCards,
    setFollowRecords,
    setParents,
    setLoading,
    setLoadError,
    setNotFound,
  });

  const derived = useStudentDetailDerived({
    student,
    records,
    packages,
    packageTransactions,
    leaves,
    memberCards,
    selectedRefundPackageId,
  });

  const actions = useStudentDetailActions({
    student,
    activeTheme,
    profileId: profile?.id,
    profileName: profile?.name,
    refundablePackages: derived.refundablePackages,
    refundedAmountByPackage: derived.refundedAmountByPackage,
    selectedRefundPackage: derived.selectedRefundPackage,
    selectedRefundMaxAmount: derived.selectedRefundMaxAmount,
    refundAmount,
    refundReason,
    showRefundSheet,
    setLeaves,
    setPackageTransactions,
    setSelectedRefundPackageId,
    setRefundAmount,
    setRefundReason,
    setShowRefundSheet,
    setRefundSubmitting,
  });

  if (loading) {
    return (
      <View
        className={cn(
          `theme-${activeTheme}`,
          'min-h-screen bg-background flex items-center justify-center',
        )}
      >
        <Loading text="加载学员详情中..." />
      </View>
    );
  }

  if (loadError) {
    return (
      <View
        className={cn(
          `theme-${activeTheme}`,
          'min-h-screen bg-background px-[32rpx] flex items-center justify-center',
        )}
      >
        <Empty
          icon="mdi-alert-circle"
          description={loadError}
          actionText="重新加载"
          onAction={loadData}
        />
      </View>
    );
  }

  if (notFound || !student) {
    return (
      <View
        className={cn(
          `theme-${activeTheme}`,
          'min-h-screen bg-background px-[32rpx] flex items-center justify-center',
        )}
      >
        <Empty
          icon="mdi-account-search"
          description="未找到该学员信息"
          actionText="返回上一页"
          onAction={actions.goBack}
        />
      </View>
    );
  }

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      <StudentDetailHeader
        student={student}
        statusBarHeight={statusBarHeight}
        onBack={actions.goBack}
        onCopyPhone={actions.handleCopyPhone}
        onCallPhone={actions.handleCallPhone}
        onSendMessage={actions.handleSendMessage}
      />

      <StudentDetailTabBar
        studentSwiperCurrent={studentSwiperCurrent}
        onTabChange={handleTabChange}
      />

      <Swiper
        className="h-calc-content"
        current={studentSwiperCurrent}
        duration={STUDENT_DETAIL_SWIPER_DURATION}
        easingFunction="easeOutCubic"
        skipHiddenItemLayout
        onChange={handleStudentSwiperChange}
        onAnimationFinish={handleStudentSwiperFinish}
      >
        <SwiperItem itemId="profile">
          <ProfilePanel
            student={student}
            parents={parents}
            onInviteParent={actions.handleInviteParent}
          />
        </SwiperItem>

        <SwiperItem itemId="consumption">
          <ConsumptionPanel
            packages={packages}
            consumptionStats={derived.consumptionStats}
            recentConsumptions={derived.recentConsumptions}
            recentConsumptionSections={derived.recentConsumptionSections}
            canRefund={derived.refundablePackages.length > 0}
            onOpenRefund={actions.handleOpenRefund}
          />
        </SwiperItem>

        <SwiperItem itemId="packages">
          <PackagesPanel
            memberCards={memberCards}
            cardSubTab={cardSubTab}
            onCardSubTabChange={setCardSubTab}
            memberCardStats={derived.memberCardStats}
            onMemberCardClick={actions.handleMemberCardClick}
          />
        </SwiperItem>

        <SwiperItem itemId="records">
          <AttendancePanel
            records={records}
            leaves={leaves}
            timelineGroups={derived.timelineGroups}
            monthStats={derived.monthStats}
            expandedMonths={derived.expandedMonths}
            isTeacher={isTeacher}
            onToggleMonth={derived.handleToggleMonth}
            onRecordClick={actions.goToRecordDetail}
            onApproveLeave={actions.handleApproveLeave}
            onRejectLeave={actions.handleRejectLeave}
          />
        </SwiperItem>

        <SwiperItem itemId="follow">
          <FollowPanel followRecords={followRecords} onFollowClick={actions.handleFollowClick} />
        </SwiperItem>
      </Swiper>

      <StudentDetailFab
        activeTab={activeTab}
        isTeacher={isTeacher}
        onIssueCard={actions.handleIssueCard}
        onWriteFollow={actions.handleWriteFollow}
      />

      <RefundSheet
        visible={showRefundSheet}
        student={student}
        remainingHours={derived.remainingHours}
        refundablePackages={derived.refundablePackages}
        selectedRefundPackageId={selectedRefundPackageId}
        selectedRefundPackage={derived.selectedRefundPackage}
        refundedAmountByPackage={derived.refundedAmountByPackage}
        refundAmount={refundAmount}
        refundReason={refundReason}
        refundSubmitting={refundSubmitting}
        onClose={() => setShowRefundSheet(false)}
        onSelectPackage={actions.handleSelectRefundPackage}
        onRefundAmountChange={setRefundAmount}
        onRefundReasonChange={setRefundReason}
        onConfirm={actions.handleConfirmRefund}
      />
    </View>
  );
};

export default withRouteGuard(StudentDetail);
