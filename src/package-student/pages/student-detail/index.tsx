import { View, Text, ScrollView, Swiper, SwiperItem, Textarea } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import StudentAvatar from '@/components/student/StudentAvatar';
import { studentService, packageService, lessonRecordService, leaveService } from '@/services';
import { followRecordService } from '@/services/follow-record';
import { memberCardService } from '@/services/member-card';
import type { CoursePackage, PackageTransaction } from '@/types/course-package';
import type { FollowRecord } from '@/types/follow-record';
import type { LeaveRequest, LeaveStatus } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail, MemberCardStatus } from '@/types/member-card';
import type { Student, StudentParent } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';
import { formatDateCN } from '@/utils/format';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type TabKey = 'profile' | 'packages' | 'records' | 'follow';

const STUDENT_DETAIL_TABS: { key: TabKey; label: string }[] = [
  { key: 'profile', label: '资料' },
  { key: 'packages', label: '卡包' },
  { key: 'records', label: '出勤' },
  { key: 'follow', label: '跟进' },
];

const STUDENT_DETAIL_TAB_INDEX_MAP: Record<TabKey, number> = {
  profile: 0,
  packages: 1,
  records: 2,
  follow: 3,
};

const STUDENT_DETAIL_SWIPER_DURATION = 280;

/** 请假状态映射 */
const LEAVE_STATUS_MAP: Record<LeaveStatus, { label: string; className: string }> = {
  pending: { label: '待审批', className: 'bg-amber-500/15 text-amber-500' },
  approved: { label: '已通过', className: 'bg-primary-15 text-primary' },
  rejected: { label: '已拒绝', className: 'bg-destructive-10 text-destructive' },
};

/** 会员卡状态映射 */
const MEMBER_CARD_STATUS_MAP: Record<MemberCardStatus, { label: string; color: string }> = {
  active: { label: '使用中', color: 'text-primary' },
  inactive: { label: '无效卡', color: 'text-muted-foreground' },
  usedUp: { label: '无效卡', color: 'text-muted-foreground' },
  notActivated: { label: '未开卡', color: 'text-warning' },
  frozen: { label: '暂停卡', color: 'text-warning' },
};

/** 会员卡高对比度背景色（用于卡包列表卡片） */
const MEMBER_CARD_BG_MAP: Record<MemberCardStatus, string> = {
  active: 'bg-gradient-primary',
  notActivated: 'bg-class-info',
  frozen: 'bg-card-gray',
  inactive: 'bg-kpi-red',
  usedUp: 'bg-finance-dark',
};

/** 会员卡状态蒙层（在背景上加一层，强化视觉区分） */
const MEMBER_CARD_OVERLAY_MAP: Record<MemberCardStatus, string> = {
  active: '',
  notActivated: '',
  frozen: 'bg-black/10',
  inactive: 'bg-black/10',
  usedUp: 'bg-black/15',
};

/** 卡包二级 Tab */
type CardSubTabKey = 'active' | 'frozen' | 'notActivated' | 'inactive';

const CARD_SUB_TABS: { key: CardSubTabKey; label: string }[] = [
  { key: 'active', label: '使用中' },
  { key: 'frozen', label: '暂停卡' },
  { key: 'notActivated', label: '未开卡' },
  { key: 'inactive', label: '无效卡' },
];

function getPackageGiftHours(pkg: CoursePackage): number {
  return Math.max(0, Math.min(pkg.gift_hours || 0, pkg.total_hours || 0));
}

function getPackagePurchasedHours(pkg: CoursePackage): number {
  return Math.max((pkg.total_hours || 0) - getPackageGiftHours(pkg), 0);
}

function roundToCurrency(amount: number): number {
  return Math.round(Math.max(amount, 0) * 100) / 100;
}

function getPackageRefundSummary(pkg: CoursePackage, refundedAmount = 0) {
  const feeAmount = Number(pkg.fee_amount || 0);
  const purchasedHours = getPackagePurchasedHours(pkg);
  const bonusRemaining = Math.max(Number(pkg.bonus_remaining || 0), 0);
  const remainingHours = Math.max(Number(pkg.remaining_hours || 0), 0);
  const refundablePurchasedHoursBeforeRefund = Math.max(remainingHours - bonusRemaining, 0);

  if (feeAmount <= 0 || purchasedHours <= 0) {
    return {
      unitPrice: 0,
      purchasedHours,
      remainingHours,
      bonusRemaining,
      refundablePurchasedHoursBeforeRefund,
      refundedPurchasedHours: 0,
      refundablePurchasedHours: 0,
      refundableAmount: 0,
    };
  }

  const unitPrice = feeAmount / purchasedHours;
  const refundedPurchasedHours = refundedAmount > 0 ? refundedAmount / unitPrice : 0;
  const refundablePurchasedHours = Math.max(
    refundablePurchasedHoursBeforeRefund - refundedPurchasedHours,
    0,
  );

  return {
    unitPrice: roundToCurrency(unitPrice),
    purchasedHours,
    remainingHours,
    bonusRemaining,
    refundablePurchasedHoursBeforeRefund,
    refundedPurchasedHours,
    refundablePurchasedHours,
    refundableAmount: roundToCurrency(refundablePurchasedHours * unitPrice),
  };
}

function getPackageRefundableAmount(pkg: CoursePackage, refundedAmount = 0): number {
  return getPackageRefundSummary(pkg, refundedAmount).refundableAmount;
}

const StudentDetail: React.FC = () => {
  const { profile } = useAuth();
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

  // 退费弹窗状态
  const [showRefundSheet, setShowRefundSheet] = useState(false);
  const [selectedRefundPackageId, setSelectedRefundPackageId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // 状态栏高度
  const [statusBarHeight, setStatusBarHeight] = useState(44);
  useEffect(() => {
    // 使用新版 getWindowInfo 替代已弃用的 getSystemInfoSync
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

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!studentId) {
      setStudent(null);
      setRecords([]);
      setPackages([]);
      setPackageTransactions([]);
      setLeaves([]);
      setMemberCards([]);
      setParents([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const [stu, recs, pkgs, lvs, cards, follows, parentList] = await Promise.all([
        studentService.getById(studentId),
        lessonRecordService.getByStudent(studentId),
        packageService.getByStudent(studentId),
        leaveService.getByStudent(studentId),
        memberCardService.getByStudent(studentId),
        followRecordService.getByStudent(studentId),
        studentService.getParents(studentId),
      ]);
      const txns = currentUserId
        ? await packageService.getTransactions(currentUserId, studentId)
        : [];

      if (!stu) {
        setStudent(null);
        setRecords([]);
        setPackages([]);
        setPackageTransactions([]);
        setLeaves([]);
        setMemberCards([]);
        setFollowRecords([]);
        setParents([]);
        setNotFound(true);
        return;
      }

      setStudent(stu);
      setRecords(recs);
      setPackages(pkgs);
      setPackageTransactions(txns);
      setLeaves(lvs);
      setMemberCards(cards);
      setFollowRecords(follows);
      setParents(parentList);
    } catch (error) {
      logError('StudentDetail loadData', error);
      setStudent(null);
      setRecords([]);
      setPackages([]);
      setPackageTransactions([]);
      setLeaves([]);
      setMemberCards([]);
      setFollowRecords([]);
      setParents([]);
      setLoadError('学员详情加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, studentId]);

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useDidShow(() => {
    loadDataRef.current();
  });

  // 统计数据
  const remainingHours = useMemo(
    () => (student?.course_packages || []).reduce((s, p) => s + (p.remaining_hours || 0), 0),
    [student],
  );

  /** 会员卡课时/金额汇总 */
  const memberCardStats = useMemo(() => {
    let totalCount = 0;
    let remainingCount = 0;
    let totalAmount = 0;
    let remainingAmount = 0;
    memberCards.forEach((card) => {
      if (card.cardTypeKind === 'count') {
        totalCount += card.cardTypeCount || 0;
        remainingCount += card.remainingCount || 0;
      }
      if (card.cardTypeKind === 'stored') {
        totalAmount += card.purchasePrice || 0;
        remainingAmount += card.remainingAmount || 0;
      }
    });
    return {
      totalCount,
      usedCount: totalCount - remainingCount,
      remainingCount,
      totalAmount,
      usedAmount: totalAmount - remainingAmount,
      remainingAmount,
    };
  }, [memberCards]);

  const refundedAmountByPackage = useMemo(() => {
    return packageTransactions.reduce<Record<string, number>>((acc, item) => {
      if (item.type !== 'refund' || !item.package_id) {
        return acc;
      }
      acc[item.package_id] =
        (acc[item.package_id] || 0) + Number(item.refund_amount || item.fee_amount || 0);
      return acc;
    }, {});
  }, [packageTransactions]);

  const refundablePackages = useMemo(
    () =>
      packages.filter((pkg) => {
        const purchasedHours = getPackagePurchasedHours(pkg);
        return (
          pkg.status === 'active' &&
          purchasedHours > 0 &&
          Number(pkg.fee_amount || 0) > 0 &&
          getPackageRefundableAmount(pkg, refundedAmountByPackage[pkg.id] || 0) > 0
        );
      }),
    [packages, refundedAmountByPackage],
  );

  const selectedRefundPackage = useMemo(
    () => refundablePackages.find((pkg) => pkg.id === selectedRefundPackageId) || null,
    [refundablePackages, selectedRefundPackageId],
  );

  const selectedRefundMaxAmount = useMemo(
    () =>
      selectedRefundPackage
        ? getPackageRefundableAmount(
            selectedRefundPackage,
            refundedAmountByPackage[selectedRefundPackage.id] || 0,
          )
        : 0,
    [refundedAmountByPackage, selectedRefundPackage],
  );

  /** 出勤时间线：合并上课记录与请假申请，并按月份分组 */
  const timelineGroups = useMemo(() => {
    const items: (
      | { type: 'record'; id: string; date: string; data: LessonRecord }
      | { type: 'leave'; id: string; date: string; data: LeaveRequest }
    )[] = [
      ...records.map((record) => ({
        type: 'record' as const,
        id: record.id,
        date: record.lesson_date,
        data: record,
      })),
      ...leaves.map((leave) => ({
        type: 'leave' as const,
        id: leave.id,
        date: leave.original_date,
        data: leave,
      })),
    ].sort((a, b) => (dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1));

    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      const monthKey = dayjs(item.date).format('YYYY年M月');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(item);
    });
    return groups;
  }, [records, leaves]);

  /** 月份展开/收起状态，默认仅展开第一个月份 */
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const expandedMonthsInitRef = useRef(false);
  useEffect(() => {
    if (expandedMonthsInitRef.current) return;
    const monthKeys = Object.keys(timelineGroups);
    if (monthKeys.length > 0) {
      expandedMonthsInitRef.current = true;
      setExpandedMonths(new Set([monthKeys[0]]));
    }
  }, [timelineGroups]);

  const handleToggleMonth = useCallback((month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  }, []);

  /** 按月份统计签到/请假次数 */
  const monthStats = useMemo(() => {
    const stats: Record<string, { checkIn: number; leave: number }> = {};
    Object.entries(timelineGroups).forEach(([month, items]) => {
      let checkIn = 0;
      let leave = 0;
      items.forEach((item) => {
        if (item.type === 'record') checkIn += 1;
        else leave += 1;
      });
      stats[month] = { checkIn, leave };
    });
    return stats;
  }, [timelineGroups]);

  // 复制手机号
  const handleCopyPhone = useCallback(() => {
    const phone = student?.phone;
    if (!phone) {
      Taro.showToast({ title: '暂无手机号', icon: 'none' });
      return;
    }
    Taro.setClipboardData({
      data: phone,
      success: () => Taro.showToast({ title: '手机号已复制', icon: 'success' }),
      fail: () => Taro.showToast({ title: `手机号：${phone}`, icon: 'none' }),
    });
  }, [student?.phone]);

  // 拨打电话
  const handleCallPhone = useCallback(() => {
    const phone = student?.phone;
    if (!phone) {
      Taro.showToast({ title: '暂无手机号', icon: 'none' });
      return;
    }
    Taro.makePhoneCall({ phoneNumber: phone });
  }, [student?.phone]);

  // 发送短信
  const handleSendMessage = useCallback(() => {
    const phone = student?.phone;
    if (!phone) {
      Taro.showToast({ title: '暂无手机号', icon: 'none' });
      return;
    }
    Taro.sendSms({
      phoneNumber: phone,
      fail: () => Taro.showToast({ title: '短信打开失败', icon: 'none' }),
    });
  }, [student?.phone]);

  // 邀请家长绑定 - 生成一次性链接并复制到剪贴板
  const handleInviteParent = useCallback(() => {
    if (!student) return;
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const path = `/package-student/pages/parent-bind/index?studentId=${encodeURIComponent(student.id)}&token=${encodeURIComponent(token)}`;
    // 实际环境可替换为短链接或 H5 中转页；开发/测试阶段复制小程序路径
    const link = `pages/index/index?redirect=${encodeURIComponent(path)}`;
    void Taro.setClipboardData({
      data: link,
      success: () => {
        Taro.showToast({
          title: '邀请链接已复制，请发送给家长',
          icon: 'none',
          duration: 2500,
        });
      },
      fail: () => {
        Taro.showToast({ title: '复制失败，请重试', icon: 'none' });
      },
    });
  }, [student]);

  // 跳转上课记录详情
  const goToRecordDetail = useCallback((recordId: string) => {
    Taro.navigateTo({
      url: `/package-course/pages/lesson-detail/index?id=${encodeURIComponent(recordId)}`,
    });
  }, []);

  // 发会员卡
  const handleIssueCard = useCallback(() => {
    if (!student) return;
    Taro.navigateTo({
      url: `/package-student/pages/member-card-issue/index?studentId=${encodeURIComponent(student.id)}`,
    });
  }, [student]);

  // 写跟进：进入独立表单页
  const handleWriteFollow = useCallback(() => {
    if (!student) return;
    Taro.navigateTo({
      url: `/package-student/pages/follow-record-form/index?studentId=${encodeURIComponent(student.id)}`,
    });
  }, [student]);

  // 查看会员卡详情
  const handleMemberCardClick = useCallback((card: MemberCardDetail) => {
    Taro.navigateTo({
      url: `/package-student/pages/member-card-detail/index?id=${encodeURIComponent(card.id)}`,
    });
  }, []);

  // 点击跟进卡片进入编辑页
  const handleFollowClick = useCallback(
    (record: FollowRecord) => {
      if (!student) return;
      Taro.navigateTo({
        url: `/package-student/pages/follow-record-form/index?studentId=${encodeURIComponent(student.id)}&recordId=${encodeURIComponent(record.id)}`,
      });
    },
    [student],
  );

  // 审批请假
  const handleApproveLeave = useCallback(async (id: string) => {
    const { confirm } = await Taro.showModal({
      title: '确认同意',
      content: '确认同意该请假申请？',
    });
    if (!confirm) return;
    try {
      await leaveService.updateStatus(id, 'approved');
      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'approved' as const } : l)),
      );
      Taro.showToast({ title: '已同意', icon: 'success' });
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, []);

  const handleRejectLeave = useCallback(async (id: string) => {
    const { confirm } = await Taro.showModal({
      title: '确认拒绝',
      content: '确认拒绝该请假申请？',
      confirmColor: '#ef4444',
    });
    if (!confirm) return;
    try {
      await leaveService.updateStatus(id, 'rejected');
      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'rejected' as const } : l)),
      );
      Taro.showToast({ title: '已拒绝', icon: 'success' });
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, []);

  // 退费操作
  const handleSelectRefundPackage = useCallback(
    (pkg: CoursePackage) => {
      setSelectedRefundPackageId(pkg.id);
      setRefundAmount(
        String(getPackageRefundableAmount(pkg, refundedAmountByPackage[pkg.id] || 0)),
      );
    },
    [refundedAmountByPackage],
  );

  useEffect(() => {
    if (!showRefundSheet) {
      return;
    }

    if (!selectedRefundPackage) {
      setRefundAmount('');
      return;
    }

    setRefundAmount(selectedRefundMaxAmount > 0 ? selectedRefundMaxAmount.toFixed(2) : '');
  }, [selectedRefundMaxAmount, selectedRefundPackage, showRefundSheet]);

  const handleConfirmRefund = useCallback(async () => {
    if (!selectedRefundPackage) {
      Taro.showToast({ title: '请选择退费课包', icon: 'none' });
      return;
    }
    if (!student) {
      Taro.showToast({ title: '未获取到学员信息', icon: 'none' });
      return;
    }

    if (selectedRefundMaxAmount <= 0) {
      Taro.showToast({ title: '该课包暂无可退金额', icon: 'none' });
      return;
    }

    const amount = Number(refundAmount);
    if (!refundAmount || isNaN(amount) || amount <= 0) {
      Taro.showToast({ title: '请输入有效的退费金额', icon: 'none' });
      return;
    }
    if (amount > selectedRefundMaxAmount) {
      Taro.showToast({ title: `最多可退 ¥${selectedRefundMaxAmount.toFixed(2)}`, icon: 'none' });
      return;
    }
    if (!refundReason.trim()) {
      Taro.showToast({ title: '请输入退费原因', icon: 'none' });
      return;
    }

    try {
      setRefundSubmitting(true);
      const created = await packageService.createRefund({
        student_id: student.id,
        package_id: selectedRefundPackage.id,
        refund_amount: amount,
        reason: refundReason.trim(),
        operator_id: profile?.id,
        operator_name: profile?.name || undefined,
      });
      setPackageTransactions((prev) => [created, ...prev]);
      Taro.showToast({ title: '退费记录已提交', icon: 'success' });
      setShowRefundSheet(false);
      setSelectedRefundPackageId('');
      setRefundAmount('');
      setRefundReason('');
    } catch {
      Taro.showToast({ title: '退费提交失败，请重试', icon: 'none' });
    } finally {
      setRefundSubmitting(false);
    }
  }, [
    profile?.id,
    profile?.name,
    refundAmount,
    refundReason,
    selectedRefundMaxAmount,
    selectedRefundPackage,
    student,
  ]);

  // 返回
  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Loading text="加载学员详情中..." />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="min-h-screen bg-background px-[32rpx] flex items-center justify-center">
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
      <View className="min-h-screen bg-background px-[32rpx] flex items-center justify-center">
        <Empty
          icon="mdi-account-search"
          description="未找到该学员信息"
          actionText="返回上一页"
          onAction={goBack}
        />
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-background">
      {/* ====== 渐变头部 ====== */}
      <View
        className="bg-gradient-primary px-[40rpx] rounded-b-[48rpx] relative overflow-hidden pb-[72rpx]"
        style={{ paddingTop: `${statusBarHeight + 8}px` }}
      >
        {/* 装饰圆 */}
        <View className="absolute -top-[60rpx] -right-[60rpx] w-[240rpx] h-[240rpx] rounded-full bg-white/8" />
        <View className="absolute bottom-[-40rpx] right-[100rpx] w-[160rpx] h-[160rpx] rounded-full bg-white/6" />

        {/* 返回 */}
        <View className="relative z-1">
          <View className="w-[64rpx] h-[64rpx] rounded-full bg-white/20 center" onClick={goBack}>
            <Icon name="mdi-arrow-left" size="sm" color="white" />
          </View>
        </View>

        {/* 头像 + 信息 */}
        <View className="flex items-center gap-[24rpx] mt-[24rpx] relative z-1">
          <StudentAvatar
            name={student.name}
            src={student.avatar_url}
            size="xl"
            className="border-[6rpx] border-white/40"
          />
          <View className="flex-1 min-w-0">
            <View className="flex items-center gap-[12rpx]">
              <Text className="text-[40rpx] font-bold text-white leading-none">{student.name}</Text>
              {student.gender && (
                <Icon
                  name={student.gender === 'male' ? 'mdi-gender-male' : 'mdi-gender-female'}
                  size={24}
                  color="white"
                />
              )}
            </View>
            <View className="flex items-center gap-[16rpx] mt-[16rpx]">
              {student.phone && (
                <Text className="text-[28rpx] text-white font-medium">{student.phone}</Text>
              )}
              {student.phone && (
                <View className="flex items-center gap-[12rpx]">
                  <View
                    className="w-[52rpx] h-[52rpx] rounded-full bg-white/20 center press-scale"
                    onClick={handleCopyPhone}
                  >
                    <Icon name="mdi-content-copy" size={20} color="white" />
                  </View>
                  <View
                    className="w-[52rpx] h-[52rpx] rounded-full bg-white/20 center press-scale"
                    onClick={handleCallPhone}
                  >
                    <Icon name="mdi-phone" size={20} color="white" />
                  </View>
                  <View
                    className="w-[52rpx] h-[52rpx] rounded-full bg-white/20 center press-scale"
                    onClick={handleSendMessage}
                  >
                    <Icon name="mdi-message-text" size={20} color="white" />
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ====== Tab 栏（胶囊圆角） ====== */}
      <View className="px-[32rpx] -mt-[40rpx] relative z-2">
        <View className="flex bg-white rounded-[32rpx] p-[8rpx] shadow-soft">
          {STUDENT_DETAIL_TABS.map((tab) => (
            <View
              key={tab.key}
              className={`flex-1 py-[20rpx] text-center rounded-[24rpx] transition-all ${
                studentSwiperCurrent === STUDENT_DETAIL_TAB_INDEX_MAP[tab.key]
                  ? 'bg-primary-bg text-primary font-semibold'
                  : 'text-muted-foreground font-medium'
              }`}
              onClick={() => handleTabChange(tab.key)}
            >
              <Text
                className={`text-[26rpx] ${
                  studentSwiperCurrent === STUDENT_DETAIL_TAB_INDEX_MAP[tab.key]
                    ? 'text-primary'
                    : ''
                }`}
              >
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ====== Tab 内容 ====== */}
      <Swiper
        className="h-calc-content"
        current={studentSwiperCurrent}
        duration={STUDENT_DETAIL_SWIPER_DURATION}
        easingFunction="easeOutCubic"
        skipHiddenItemLayout
        onChange={handleStudentSwiperChange}
        onAnimationFinish={handleStudentSwiperFinish}
      >
        {/* 资料 */}
        <SwiperItem itemId="profile">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx] flex flex-col gap-[24rpx]">
              {/* 基础信息 */}
              <View className="bg-white rounded-[28rpx] p-[32rpx] shadow-soft">
                <View className="flex items-center gap-[12rpx] mb-[28rpx]">
                  <Icon name="mdi-account-outline" size={28} color="#3B6EF5" />
                  <Text className="text-[30rpx] font-bold text-foreground">基础信息</Text>
                </View>
                <View className="flex flex-col gap-[24rpx]">
                  <View className="flex items-center justify-between">
                    <Text className="text-[26rpx] text-muted-foreground">昵称</Text>
                    <Text className="text-[28rpx] text-foreground font-medium">
                      {student.nickname || '未填写'}
                    </Text>
                  </View>
                  <View className="h-[2rpx] bg-muted" />
                  <View className="flex items-center justify-between">
                    <Text className="text-[26rpx] text-muted-foreground">性别</Text>
                    <Text className="text-[28rpx] text-foreground font-medium">
                      {student.gender === 'male'
                        ? '男'
                        : student.gender === 'female'
                          ? '女'
                          : '未填写'}
                    </Text>
                  </View>
                  <View className="h-[2rpx] bg-muted" />
                  <View className="flex items-center justify-between">
                    <Text className="text-[26rpx] text-muted-foreground">出生日期</Text>
                    <Text className="text-[28rpx] text-foreground font-medium">
                      {student.birthday ? formatDateCN(student.birthday) : '未填写'}
                    </Text>
                  </View>
                  <View className="h-[2rpx] bg-muted" />
                  <View className="flex items-center justify-between">
                    <Text className="text-[26rpx] text-muted-foreground">手机号</Text>
                    <Text className="text-[28rpx] text-foreground font-medium">
                      {student.phone || '未填写'}
                    </Text>
                  </View>
                  <View className="h-[2rpx] bg-muted" />
                  <View className="flex items-center justify-between">
                    <Text className="text-[26rpx] text-muted-foreground">家庭地址</Text>
                    <Text className="text-[28rpx] text-foreground font-medium text-right max-w-[60%]">
                      {student.address || '未填写'}
                    </Text>
                  </View>
                  <View className="h-[2rpx] bg-muted" />
                  <View className="flex items-start justify-between gap-[24rpx]">
                    <Text className="text-[26rpx] text-muted-foreground flex-shrink-0">备注</Text>
                    <Text className="text-[28rpx] text-foreground font-medium text-right flex-1">
                      {student.note || '未填写'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 家长绑定 */}
              <View className="bg-white rounded-[28rpx] p-[32rpx] shadow-soft">
                <View className="flex items-center justify-between mb-[28rpx]">
                  <View className="flex items-center gap-[12rpx]">
                    <Icon name="mdi-account-group" size={28} color="primary" />
                    <Text className="text-[30rpx] font-bold text-foreground">家长绑定</Text>
                  </View>
                  <View
                    className="flex items-center gap-[8rpx] rounded-[40rpx] bg-gradient-primary px-[28rpx] py-[12rpx] press-scale"
                    onClick={handleInviteParent}
                  >
                    <Icon name="mdi-link-plus" size={24} color="white" />
                    <Text className="text-[24rpx] text-white font-medium">邀请绑定</Text>
                  </View>
                </View>

                {parents.length > 0 ? (
                  <View className="flex flex-col gap-[20rpx]">
                    {parents.map((parent) => (
                      <View
                        key={parent.id}
                        className="flex items-center gap-[20rpx] py-[20rpx] px-[24rpx] bg-muted rounded-[20rpx]"
                      >
                        <View className="w-[72rpx] h-[72rpx] rounded-full bg-gradient-primary center flex-shrink-0">
                          <Icon name="mdi-account" size={32} color="white" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-[28rpx] font-medium text-foreground block">
                            {parent.parent?.name || '家长'}
                          </Text>
                          <Text className="text-[24rpx] text-muted-foreground mt-[4rpx] block">
                            {parent.parent?.phone || '未绑定手机号'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="py-[40rpx] center-col gap-[16rpx]">
                    <Icon name="mdi-account-plus" size={56} color="#c7ced9" />
                    <Text className="text-[26rpx] text-muted-foreground">
                      暂无家长绑定，点击「邀请绑定」分享给家长
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </SwiperItem>

        {/* 卡包 */}
        <SwiperItem itemId="packages">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
              {/* 卡包汇总 */}
              <View className="bg-white rounded-[24rpx] p-[24rpx] shadow-soft mb-[24rpx]">
                <View className="flex flex-row gap-[24rpx]">
                  <View className="flex-1 center-col">
                    <Text className="text-[32rpx] font-bold text-foreground leading-none">
                      {memberCardStats.totalCount}
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">总计课时</Text>
                  </View>
                  <View className="w-[2rpx] bg-border-light" />
                  <View className="flex-1 center-col">
                    <Text className="text-[32rpx] font-bold text-foreground leading-none">
                      {memberCardStats.usedCount}
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">消耗课时</Text>
                  </View>
                  <View className="w-[2rpx] bg-border-light" />
                  <View className="flex-1 center-col">
                    <Text className="text-[32rpx] font-bold text-foreground leading-none">
                      {memberCardStats.remainingCount}
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">剩余课时</Text>
                  </View>
                </View>
                <View className="h-[2rpx] bg-border-light my-[20rpx]" />
                <View className="flex flex-row gap-[24rpx]">
                  <View className="flex-1 center-col">
                    <Text className="text-[28rpx] font-bold text-foreground leading-none">
                      ¥{(memberCardStats.totalAmount / 100).toFixed(0)}
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">总储余额</Text>
                  </View>
                  <View className="w-[2rpx] bg-border-light" />
                  <View className="flex-1 center-col">
                    <Text className="text-[28rpx] font-bold text-foreground leading-none">
                      ¥{(memberCardStats.usedAmount / 100).toFixed(0)}
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">消耗金额</Text>
                  </View>
                  <View className="w-[2rpx] bg-border-light" />
                  <View className="flex-1 center-col">
                    <Text className="text-[28rpx] font-bold text-foreground leading-none">
                      ¥{(memberCardStats.remainingAmount / 100).toFixed(0)}
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">剩余金额</Text>
                  </View>
                </View>
              </View>

              {/* 二级 Tab */}
              <View className="flex flex-row items-center justify-between mb-[28rpx]">
                {CARD_SUB_TABS.map((tab) => {
                  const isActive = cardSubTab === tab.key;
                  return (
                    <View
                      key={tab.key}
                      className="flex-1 center py-[16rpx]"
                      onClick={() => setCardSubTab(tab.key)}
                    >
                      <Text
                        className={cn(
                          'text-[26rpx] font-medium transition-colors',
                          isActive ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {tab.label}
                      </Text>
                      {isActive && (
                        <View className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rpx] h-[6rpx] rounded-full bg-primary" />
                      )}
                    </View>
                  );
                })}
              </View>

              <View className="flex flex-col gap-[24rpx]">
                {memberCards
                  .filter((card) => {
                    switch (cardSubTab) {
                      case 'active':
                        return card.status === 'active';
                      case 'frozen':
                        return card.status === 'frozen';
                      case 'notActivated':
                        return card.status === 'notActivated';
                      case 'inactive':
                        return card.status === 'inactive' || card.status === 'usedUp';
                      default:
                        return true;
                    }
                  })
                  .map((card) => {
                    const statusInfo = MEMBER_CARD_STATUS_MAP[card.status];
                    const cardBgClass = MEMBER_CARD_BG_MAP[card.status];
                    const cardOverlayClass = MEMBER_CARD_OVERLAY_MAP[card.status];
                    const kindText =
                      card.cardTypeKind === 'count'
                        ? '次卡'
                        : card.cardTypeKind === 'time'
                          ? '时间卡'
                          : '储值卡';
                    const remainingText =
                      card.cardTypeKind === 'count'
                        ? `${card.remainingCount ?? 0}次`
                        : card.cardTypeKind === 'time'
                          ? `${card.remainingDays ?? 0}天`
                          : `¥${((card.remainingAmount ?? 0) / 100).toFixed(2)}`;
                    const totalText =
                      card.cardTypeKind === 'count'
                        ? `共 ${card.cardTypeCount ?? 0} 次`
                        : card.cardTypeKind === 'time'
                          ? `共 ${card.cardTypeValidDays} 天`
                          : `充值 ¥${(card.purchasePrice / 100).toFixed(2)}`;
                    return (
                      <View
                        key={card.id}
                        className={cn(
                          'rounded-[28rpx] p-[28rpx] relative overflow-hidden shadow-soft press-scale',
                          cardBgClass,
                        )}
                        onClick={() => handleMemberCardClick(card)}
                      >
                        {cardOverlayClass && (
                          <View
                            className={cn('absolute inset-0 pointer-events-none', cardOverlayClass)}
                          />
                        )}
                        <View className="absolute -right-[40rpx] -bottom-[40rpx] w-[180rpx] h-[180rpx] rounded-full bg-white/10" />
                        <View className="absolute top-[16rpx] right-[20rpx] text-[72rpx] font-bold text-white/15 leading-none">
                          {kindText}
                        </View>
                        <View className="relative z-1">
                          <View className="flex items-start justify-between gap-[16rpx]">
                            <View className="flex-1 min-w-0">
                              <Text className="text-[32rpx] font-bold text-white">
                                {card.cardTypeName}
                              </Text>
                              <Text className="text-[22rpx] text-white/80 mt-[8rpx]">
                                有效{card.cardTypeKind === 'time' ? '天数' : '次数'} {remainingText}
                              </Text>
                            </View>
                            <View className="py-[6rpx] px-[16rpx] rounded-full bg-white/20">
                              <Text className="text-[20rpx] text-white font-medium">
                                {statusInfo.label}
                              </Text>
                            </View>
                          </View>
                          <View className="mt-[32rpx] flex items-end justify-between">
                            <View>
                              <Text className="text-[48rpx] font-bold text-white leading-none">
                                {remainingText}
                              </Text>
                              <Text className="text-[22rpx] text-white/80 mt-[8rpx]">
                                剩余{card.cardTypeKind === 'time' ? '天数' : '次数'}
                              </Text>
                            </View>
                            <Text className="text-[22rpx] text-white/80">{totalText}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                {memberCards.filter((card) => {
                  switch (cardSubTab) {
                    case 'active':
                      return card.status === 'active';
                    case 'frozen':
                      return card.status === 'frozen';
                    case 'notActivated':
                      return card.status === 'notActivated';
                    case 'inactive':
                      return card.status === 'inactive' || card.status === 'usedUp';
                    default:
                      return true;
                  }
                }).length === 0 && <Empty description="暂无卡包" />}
              </View>
            </View>
          </ScrollView>
        </SwiperItem>

        {/* 出勤 */}
        <SwiperItem itemId="records">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
              {records.length === 0 && leaves.length === 0 ? (
                <Empty description="暂无出勤记录" />
              ) : (
                <View className="flex flex-col gap-[24rpx]">
                  {/* 顶部总结 */}
                  <View className="bg-white rounded-[24rpx] p-[20rpx] shadow-soft">
                    <View className="flex items-center gap-[8rpx] mb-[16rpx]">
                      <Icon name="mdi-chart-bar" size={24} color="primary" />
                      <Text className="text-[26rpx] font-bold text-foreground">出勤总结</Text>
                    </View>
                    <View className="flex flex-row gap-[12rpx]">
                      <View className="flex-1 center-col py-[14rpx] rounded-[16rpx] bg-primary/8">
                        <Text className="text-[36rpx] font-bold text-primary leading-none">
                          {records.length}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[6rpx]">
                          签到次数
                        </Text>
                      </View>
                      <View className="flex-1 center-col py-[14rpx] rounded-[16rpx] bg-warning/10">
                        <Text className="text-[36rpx] font-bold text-warning leading-none">
                          {leaves.length}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[6rpx]">
                          请假次数
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 按月分组（可展开/收起） */}
                  {Object.entries(timelineGroups).map(([month, items]) => {
                    const isExpanded = expandedMonths.has(month);
                    const stat = monthStats[month] || { checkIn: 0, leave: 0 };
                    return (
                      <View key={month} className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft">
                        {/* 月份标题行（点击展开/收起） */}
                        <View
                          className="flex items-center justify-between"
                          onClick={() => handleToggleMonth(month)}
                        >
                          <View className="flex items-center gap-[16rpx]">
                            <Text className="text-[28rpx] font-bold text-foreground">{month}</Text>
                            <Text className="text-[24rpx] text-muted-foreground">
                              签到 {stat.checkIn} · 请假 {stat.leave}
                            </Text>
                          </View>
                          <Icon
                            name={isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'}
                            size={32}
                            color="#999999"
                          />
                        </View>

                        {/* 展开内容 */}
                        {isExpanded && (
                          <View className="flex flex-col gap-[20rpx] mt-[24rpx]">
                            {items.map((item, index) => {
                              const isLast = index === items.length - 1;
                              if (item.type === 'record') {
                                const record = item.data;
                                return (
                                  <View
                                    key={record.id}
                                    className="bg-muted rounded-[20rpx] p-[24rpx] flex gap-[24rpx] press-scale"
                                    onClick={() => goToRecordDetail(record.id)}
                                  >
                                    {/* 时间轴 */}
                                    <View className="flex flex-col items-center w-[24rpx] flex-shrink-0 pt-[8rpx]">
                                      <View className="w-[16rpx] h-[16rpx] rounded-full bg-gradient-primary flex-shrink-0" />
                                      {!isLast && (
                                        <View className="w-[4rpx] flex-1 bg-border mt-[8rpx] min-h-[40rpx]" />
                                      )}
                                    </View>
                                    {/* 内容 */}
                                    <View className="flex-1 min-w-0">
                                      <View className="flex items-start justify-between">
                                        <View className="flex-1">
                                          <Text className="text-[28rpx] font-medium text-foreground block">
                                            {record.course_package?.name || '上课'}
                                          </Text>
                                          <Text className="text-[24rpx] text-muted-foreground block mt-[4rpx]">
                                            {formatDateCN(record.lesson_date)}
                                          </Text>
                                        </View>
                                        <Text className="text-[30rpx] font-semibold text-primary flex-shrink-0">
                                          -{record.hours_used}课时
                                        </Text>
                                      </View>
                                      {record.content && (
                                        <View className="mt-[16rpx] py-[16rpx] px-[24rpx] bg-white rounded-[16rpx]">
                                          <Text className="text-[24rpx] text-muted-foreground">
                                            课程内容：{record.content}
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                );
                              }
                              const leave = item.data;
                              const statusInfo = LEAVE_STATUS_MAP[leave.status];
                              return (
                                <View
                                  key={leave.id}
                                  className="bg-muted rounded-[20rpx] p-[24rpx] flex gap-[24rpx]"
                                >
                                  {/* 时间轴 */}
                                  <View className="flex flex-col items-center w-[24rpx] flex-shrink-0 pt-[8rpx]">
                                    <View className="w-[16rpx] h-[16rpx] rounded-full bg-warning flex-shrink-0" />
                                    {!isLast && (
                                      <View className="w-[4rpx] flex-1 bg-border mt-[8rpx] min-h-[40rpx]" />
                                    )}
                                  </View>
                                  {/* 内容 */}
                                  <View className="flex-1 min-w-0">
                                    <View className="flex items-start justify-between">
                                      <View className="flex-1">
                                        <Text className="text-[28rpx] font-medium text-foreground block">
                                          {leave.type === 'reschedule' ? '调课' : '请假'}
                                        </Text>
                                        <Text className="text-[24rpx] text-muted-foreground block mt-[4rpx]">
                                          {formatDateCN(leave.original_date)}
                                          {leave.new_date && ` → ${formatDateCN(leave.new_date)}`}
                                        </Text>
                                      </View>
                                      <View
                                        className={cn(
                                          'py-[8rpx] px-[20rpx] rounded-[24rpx] text-[24rpx] font-medium flex-shrink-0',
                                          statusInfo.className,
                                        )}
                                      >
                                        <Text>{statusInfo.label}</Text>
                                      </View>
                                    </View>
                                    {leave.reason && (
                                      <View className="mt-[16rpx] py-[16rpx] px-[24rpx] bg-white rounded-[16rpx]">
                                        <Text className="text-[24rpx] text-muted-foreground">
                                          原因：{leave.reason}
                                        </Text>
                                      </View>
                                    )}
                                    {leave.status === 'pending' && isTeacher && (
                                      <View className="flex gap-[16rpx] mt-[20rpx]">
                                        <View
                                          className="flex-1 py-[16rpx] rounded-[24rpx] bg-gradient-primary center press-scale"
                                          onClick={() => handleApproveLeave(leave.id)}
                                        >
                                          <Text className="text-white text-[26rpx] font-medium">
                                            同意
                                          </Text>
                                        </View>
                                        <View
                                          className="flex-1 py-[16rpx] rounded-[24rpx] border-[3rpx] border-destructive center press-scale"
                                          onClick={() => handleRejectLeave(leave.id)}
                                        >
                                          <Text className="text-destructive text-[26rpx] font-medium">
                                            拒绝
                                          </Text>
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </SwiperItem>

        {/* 跟进 */}
        <SwiperItem itemId="follow">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
              {followRecords.length === 0 ? (
                <Empty description="暂无跟进记录" />
              ) : (
                <View className="flex flex-col gap-[20rpx]">
                  {followRecords.map((record) => (
                    <View
                      key={record.id}
                      className="bg-white rounded-[24rpx] p-[24rpx] shadow-soft press-scale"
                      onClick={() => handleFollowClick(record)}
                    >
                      <View className="flex items-start justify-between gap-[12rpx]">
                        <View className="flex-1 min-w-0">
                          <View className="flex items-center gap-[8rpx]">
                            <Icon name="mdi-text-box-outline" size={22} color="primary" />
                            <Text className="text-[26rpx] font-semibold text-foreground">
                              跟进记录
                            </Text>
                          </View>
                          <Text className="text-[26rpx] text-foreground block mt-[10rpx]">
                            {record.content}
                          </Text>
                          <Text className="text-[22rpx] text-muted-foreground block mt-[10rpx]">
                            操作人：{record.operatorName || '-'}
                          </Text>
                        </View>
                        <Text className="text-[20rpx] text-muted-foreground flex-shrink-0">
                          {record.createdAt}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </SwiperItem>
      </Swiper>

      {/* ====== 悬浮操作按钮（按 Tab 分类） ====== */}
      {activeTab === 'packages' && isTeacher && (
        <View className="fixed right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] z-10">
          <View
            className="w-[120rpx] h-[120rpx] rounded-full bg-gradient-primary shadow-elegant center flex flex-col gap-[4rpx] press-scale"
            onClick={handleIssueCard}
          >
            <Icon name="mdi-plus" size={36} color="white" />
            <Text className="text-[20rpx] text-white font-medium">发会员卡</Text>
          </View>
        </View>
      )}

      {activeTab === 'follow' && (
        <View className="fixed right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] z-10">
          <View
            className="w-[120rpx] h-[120rpx] rounded-full bg-gradient-primary shadow-elegant center flex flex-col gap-[4rpx] press-scale"
            onClick={handleWriteFollow}
          >
            <Icon name="mdi-pencil" size={32} color="white" />
            <Text className="text-[20rpx] text-white font-medium">写跟进</Text>
          </View>
        </View>
      )}

      {/* ====== 退费弹窗 ====== */}
      <BottomSheet
        visible={showRefundSheet}
        title="申请退费"
        onClose={() => setShowRefundSheet(false)}
      >
        <View className="px-[32rpx] py-[32rpx]">
          {/* 学员信息 */}
          <View className="flex items-center gap-[20rpx] mb-[32rpx] py-[24rpx] px-[28rpx] bg-muted rounded-[20rpx]">
            <StudentAvatar name={student.name} size="sm" />
            <View>
              <Text className="text-[28rpx] font-medium text-foreground block">{student.name}</Text>
              <Text className="text-[24rpx] text-muted-foreground">剩余课时 {remainingHours}</Text>
            </View>
          </View>

          <View className="mb-[28rpx]">
            <Text className="text-[28rpx] text-foreground font-medium mb-[16rpx] block">
              选择退费课包 <Text className="text-destructive">*</Text>
            </Text>
            <View className="flex flex-col gap-[16rpx]">
              {refundablePackages.map((pkg) => {
                const isSelected = pkg.id === selectedRefundPackageId;
                const giftHours = getPackageGiftHours(pkg);
                const purchasedHours = getPackagePurchasedHours(pkg);
                const refundedAmount = refundedAmountByPackage[pkg.id] || 0;
                const maxRefundAmount = getPackageRefundableAmount(pkg, refundedAmount);

                return (
                  <View
                    key={pkg.id}
                    className={`rounded-[24rpx] border px-[24rpx] py-[22rpx] ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-white'
                    }`}
                    onClick={() => handleSelectRefundPackage(pkg)}
                  >
                    <View className="flex items-start justify-between gap-[16rpx]">
                      <View className="min-w-0 flex-1">
                        <Text className="block text-[28rpx] font-semibold text-foreground">
                          {pkg.name}
                        </Text>
                        <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                          充值 {purchasedHours} 课时
                          {giftHours > 0 ? ` · 赠送 ${giftHours} 课时` : ''}
                        </Text>
                        <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                          最多可退 ¥{maxRefundAmount.toFixed(2)}
                        </Text>
                        {refundedAmount > 0 && (
                          <Text className="mt-[6rpx] block text-[24rpx] text-warning">
                            已退 ¥{refundedAmount.toFixed(2)}
                          </Text>
                        )}
                      </View>
                      <Icon
                        name={isSelected ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'}
                        size="sm"
                        color={isSelected ? '#5EC8A8' : '#c7ced9'}
                      />
                    </View>
                  </View>
                );
              })}
              {refundablePackages.length === 0 && (
                <View className="rounded-[20rpx] bg-muted px-[24rpx] py-[24rpx]">
                  <Text className="text-[24rpx] text-muted-foreground">
                    当前没有可退费课包。退费仅按剩余充值课时计算，赠送课时不参与退费。
                  </Text>
                </View>
              )}
            </View>
          </View>

          <FormInput
            label="退费金额"
            required
            placeholder={
              selectedRefundPackage ? '系统已预填可退金额，可按需修改' : '请先选择退费课包'
            }
            type="digit"
            value={refundAmount}
            onInput={(e) => setRefundAmount(e.detail.value)}
            disabled={!selectedRefundPackage}
          />
          {selectedRefundPackage && (
            <View className="mb-[24rpx] mt-[-12rpx]">
              <Text className="text-[24rpx] text-muted-foreground">
                已预填建议金额，可自行修改；赠送课时不参与退费。
              </Text>
            </View>
          )}

          <View className="mb-[32rpx]">
            <Text className="text-[28rpx] text-foreground font-medium mb-[16rpx] block">
              退费原因 <Text className="text-destructive">*</Text>
            </Text>
            <Textarea
              className="w-full bg-muted rounded-[20rpx] px-[24rpx] py-[24rpx] text-[28rpx] text-foreground min-h-[160rpx]"
              placeholder="请输入退费原因"
              placeholderClass="input-placeholder"
              value={refundReason}
              onInput={(e) => setRefundReason(e.detail.value)}
              maxlength={200}
              cursorSpacing={160}
              autoHeight
              disableDefaultPadding
            />
          </View>

          <View
            className={`rounded-[48rpx] py-[28rpx] flex items-center justify-center press-scale ${
              refundablePackages.length > 0 && !refundSubmitting ? 'bg-destructive' : 'bg-border'
            }`}
            onClick={
              refundablePackages.length > 0 && !refundSubmitting ? handleConfirmRefund : undefined
            }
          >
            <Text className="text-[30rpx] text-white font-semibold">
              {refundSubmitting ? '提交中...' : '确认退费'}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
};

export default withRouteGuard(StudentDetail);
