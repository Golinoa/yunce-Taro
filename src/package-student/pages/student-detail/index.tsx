import { View, Text, ScrollView, Swiper, SwiperItem, Button, Textarea } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import StudentAvatar from '@/components/student/StudentAvatar';
import { studentService, packageService, lessonRecordService, leaveService } from '@/services';
import { useStudentStore } from '@/stores';
import type { CoursePackage, PackageStatus, PackageTransaction } from '@/types/course-package';
import type { LeaveRequest, LeaveStatus } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student, StudentParent } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';
import { formatDateCN } from '@/utils/format';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type TabKey = 'records' | 'packages' | 'leaves' | 'parents';

const STUDENT_DETAIL_TABS: { key: TabKey; label: string }[] = [
  { key: 'records', label: '课时记录' },
  { key: 'packages', label: '课时套餐' },
  { key: 'leaves', label: '请假记录' },
  { key: 'parents', label: '家长绑定' },
];

const STUDENT_DETAIL_TAB_INDEX_MAP: Record<TabKey, number> = {
  records: 0,
  packages: 1,
  leaves: 2,
  parents: 3,
};

const STUDENT_DETAIL_SWIPER_DURATION = 280;

/** 支付方式映射 */
const FEE_METHOD_MAP: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  transfer: '转账',
  other: '其他',
};

/** 请假状态映射 */
const LEAVE_STATUS_MAP: Record<LeaveStatus, { label: string; className: string }> = {
  pending: { label: '待审批', className: 'bg-amber-500/15 text-amber-500' },
  approved: { label: '已通过', className: 'bg-primary-15 text-primary' },
  rejected: { label: '已拒绝', className: 'bg-destructive-10 text-destructive' },
};

/** 套餐状态映射 */
const PKG_STATUS_MAP: Record<PackageStatus, { label: string; bg: string; text: string }> = {
  active: { label: '进行中', bg: '#f0faf5', text: '#5EC8A8' },
  completed: { label: '已完成', bg: '#f0f0f0', text: '#999' },
  expired: { label: '已过期', bg: '#fef2f2', text: '#D94040' },
  frozen: { label: '已冻结', bg: '#fff7ed', text: '#f59e0b' },
};

/** 课包进度条渐变 */
function getPkgProgressGradient(status: PackageStatus): string {
  switch (status) {
    case 'expired':
      return 'linear-gradient(90deg, #D94040, #e87070)';
    case 'frozen':
      return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    case 'completed':
      return '#ccc';
    default:
      return 'linear-gradient(90deg, #5EC8A8, #7dd8bc)';
  }
}

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

  const invalidateStudents = useStudentStore((state) => state.invalidate);

  const studentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [student, setStudent] = useState<Student | null>(null);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [packages, setPackages] = useState<CoursePackage[]>([]);
  const [packageTransactions, setPackageTransactions] = useState<PackageTransaction[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [parents, setParents] = useState<StudentParent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('records');
  const [studentSwiperCurrent, setStudentSwiperCurrent] = useState(
    STUDENT_DETAIL_TAB_INDEX_MAP.records,
  );

  // 退费弹窗状态
  const [showRefundSheet, setShowRefundSheet] = useState(false);
  const [selectedRefundPackageId, setSelectedRefundPackageId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // 一次性邀请token，每次点击"邀请家长"时生成，分享后失效
  const inviteTokenRef = useRef<string>('');

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
      setParents([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const [stu, recs, pkgs, lvs, pars] = await Promise.all([
        studentService.getById(studentId),
        lessonRecordService.getByStudent(studentId),
        packageService.getByStudent(studentId),
        leaveService.getByStudent(studentId),
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
        setParents([]);
        setNotFound(true);
        return;
      }

      setStudent(stu);
      setRecords(recs);
      setPackages(pkgs);
      setPackageTransactions(txns);
      setLeaves(lvs);
      setParents(pars);
    } catch (error) {
      logError('StudentDetail loadData', error);
      setStudent(null);
      setRecords([]);
      setPackages([]);
      setPackageTransactions([]);
      setLeaves([]);
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
  const totalUsedHours = useMemo(
    () => records.reduce((s, r) => s + (r.hours_used || 0), 0),
    [records],
  );
  const yearUsedHours = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    return records
      .filter((r) => r.lesson_date >= yearStart)
      .reduce((s, r) => s + (r.hours_used || 0), 0);
  }, [records]);

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

  const recentPackageTransactions = useMemo(
    () => packageTransactions.slice(0, 5),
    [packageTransactions],
  );

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

  // 复制邀请码
  const copyInviteCode = useCallback(() => {
    const code = student?.invite_code;
    if (!code) {
      Taro.showToast({ title: '暂无邀请码', icon: 'none' });
      return;
    }
    Taro.setClipboardData({
      data: code,
      success: () => Taro.showToast({ title: '邀请码已复制', icon: 'success' }),
      fail: () => Taro.showToast({ title: `邀请码：${code}`, icon: 'none' }),
    });
  }, [student]);

  // 生成一次性邀请token（时间戳+随机数，模拟服务端生成）
  const generateInviteToken = useCallback(() => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    inviteTokenRef.current = token;
    return token;
  }, []);

  // 邀请家长 - 触发小程序转发
  const handleInviteParent = useCallback(() => {
    if (!student) return;
    // 生成一次性token
    generateInviteToken();
    Taro.showToast({ title: '请选择要转发的家长', icon: 'none', duration: 1500 });
  }, [student, generateInviteToken]);

  // 注册分享回调 - 转发小程序卡片给家长
  useShareAppMessage((_res) => {
    if (!student) return { title: '邀请您绑定学生', path: '/pages/index/index' };
    const token = inviteTokenRef.current;
    // 分享后立即清空token，确保一次性使用
    inviteTokenRef.current = '';
    return {
      title: `邀请您绑定学员「${student.name}」`,
      path: `/package-student/pages/parent-bind/index?studentId=${encodeURIComponent(student.id)}&token=${encodeURIComponent(token)}`,
      imageUrl: '', // 使用默认截图
    };
  });

  // 删除学生（软删除 + 级联提示）
  const handleDelete = useCallback(async () => {
    if (!studentId) return;
    try {
      const deps = await studentService.getDependencies(studentId);
      const parts: string[] = [];
      if (deps.activePackages > 0) parts.push(`${deps.activePackages} 个进行中课包`);
      if (deps.frozenPackages > 0) parts.push(`${deps.frozenPackages} 个冻结课包`);
      if (deps.lessonRecords > 0) parts.push(`${deps.lessonRecords} 条消课记录`);
      if (deps.boundParents > 0) parts.push(`${deps.boundParents} 位绑定家长`);
      const depText = parts.length > 0 ? `该学员有 ${parts.join('、')}，` : '';
      Taro.showModal({
        title: '确认删除',
        content: `${depText}删除后课包将冻结、家长绑定将解除，消课记录保留。确认删除？`,
        confirmColor: '#ef4444',
        success: async (res) => {
          if (res.confirm) {
            await studentService.remove(studentId);
            if (profile?.id) invalidateStudents(profile.id);
            Taro.showToast({ title: '删除成功', icon: 'success' });
            setTimeout(() => Taro.navigateBack(), 1500);
          }
        },
      });
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, [studentId, profile, invalidateStudents]);

  // 解绑家长
  const handleUnbind = useCallback((bindingId: string) => {
    Taro.showModal({
      title: '解除绑定',
      content: '确认解除该家长的绑定？解除后该家长将无法查看学生课时信息。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await studentService.removeParent(bindingId);
            setParents((prev) => prev?.filter((p) => p.id !== bindingId) ?? []);
            Taro.showToast({ title: '解绑成功', icon: 'success' });
          } catch {
            Taro.showToast({ title: '解绑失败，请重试', icon: 'none' });
          }
        }
      },
    });
  }, []);

  // 跳转上课记录详情
  const goToRecordDetail = useCallback((recordId: string) => {
    Taro.navigateTo({
      url: `/package-course/pages/lesson-detail/index?id=${encodeURIComponent(recordId)}`,
    });
  }, []);

  // 跳转课时充值
  const goToRecharge = useCallback(() => {
    Taro.navigateTo({
      url: `/package-course/pages/package-form/index?studentId=${encodeURIComponent(studentId)}`,
    });
  }, [studentId]);

  const goToPackageTransactions = useCallback(() => {
    Taro.navigateTo({
      url: `/package-course/pages/recharge-records/index?studentId=${encodeURIComponent(studentId)}`,
    });
  }, [studentId]);

  const goToTransfer = useCallback(() => {
    if (!studentId) {
      Taro.showToast({ title: '未获取到学员信息', icon: 'none' });
      return;
    }

    Taro.navigateTo({
      url: `/package-student/pages/student-transfer/index?id=${encodeURIComponent(studentId)}`,
    });
  }, [studentId]);

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
  const handleOpenRefund = useCallback(() => {
    const defaultPackage = refundablePackages[0];
    setSelectedRefundPackageId(defaultPackage?.id || '');
    setRefundAmount(
      defaultPackage
        ? String(
            getPackageRefundableAmount(
              defaultPackage,
              refundedAmountByPackage[defaultPackage.id] || 0,
            ),
          )
        : '',
    );
    setRefundReason('');
    setShowRefundSheet(true);
  }, [refundablePackages, refundedAmountByPackage]);

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
    student?.id,
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
        className="bg-gradient-primary px-[40rpx] rounded-b-[48rpx] relative overflow-hidden"
        style={{ paddingTop: `${statusBarHeight + 8}px`, paddingBottom: '48rpx' }}
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
        <View className="flex items-center gap-[32rpx] mt-[24rpx] relative z-1">
          <StudentAvatar name={student.name} size="lg" className="border-[6rpx] border-white/40" />
          <View className="flex-1 min-w-0">
            <View className="flex items-center justify-between gap-[16rpx]">
              <Text className="text-[44rpx] font-bold text-white block flex-1 min-w-0">
                {student.name}
              </Text>
              {isTeacher && (
                <View
                  className="h-[56rpx] px-[20rpx] rounded-full bg-white/18 flex items-center gap-[6rpx] press-scale flex-shrink-0"
                  onClick={goToTransfer}
                >
                  <Icon name="mdi-swap-horizontal" size={20} color="white" />
                  <Text className="text-[22rpx] text-white">调班</Text>
                </View>
              )}
            </View>
            {student.nickname && (
              <Text className="text-[26rpx] text-white/80 block mt-[4rpx]">{student.nickname}</Text>
            )}
            <Text className="text-[24rpx] text-white/70 font-mono tracking-[4rpx] block mt-[4rpx]">
              {student.invite_code}
            </Text>
            {student.phone && (
              <Text className="text-[26rpx] text-white/80 block mt-[4rpx]">{student.phone}</Text>
            )}
          </View>
        </View>

        {/* 地址/备注 */}
        {(student.address || student.note) && (
          <View className="flex gap-[24rpx] mt-[24rpx] relative z-1 flex-wrap">
            {student.address && (
              <View className="flex items-center gap-[8rpx]">
                <Icon name="mdi-map-marker" size={28} color="white" />
                <Text className="text-[24rpx] text-white/70">{student.address}</Text>
              </View>
            )}
            {student.note && (
              <View className="flex items-center gap-[8rpx]">
                <Icon name="mdi-note-text" size={28} color="white" />
                <Text className="text-[24rpx] text-white/70">{student.note}</Text>
              </View>
            )}
          </View>
        )}

        {/* 统计三栏 */}
        <View className="flex gap-[20rpx] mt-[40rpx] relative z-1">
          <View className="flex-1 bg-white/20 backdrop-blur-sm rounded-[24rpx] py-[28rpx] text-center">
            <Text className="text-[48rpx] font-bold text-white block">{remainingHours}</Text>
            <Text className="text-[22rpx] text-white/70 block mt-[4rpx]">剩余课时</Text>
          </View>
          <View className="flex-1 bg-white/20 backdrop-blur-sm rounded-[24rpx] py-[28rpx] text-center">
            <Text className="text-[48rpx] font-bold text-white block">{totalUsedHours}</Text>
            <Text className="text-[22rpx] text-white/70 block mt-[4rpx]">总已消课时</Text>
          </View>
          <View className="flex-1 bg-white/20 backdrop-blur-sm rounded-[24rpx] py-[28rpx] text-center">
            <Text className="text-[48rpx] font-bold text-white block">{yearUsedHours}</Text>
            <Text className="text-[22rpx] text-white/70 block mt-[4rpx]">今年消耗</Text>
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
        <SwiperItem itemId="records">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
              <View className="flex flex-col gap-[20rpx]">
                {records.map((record) => (
                  <View
                    key={record.id}
                    className="bg-white rounded-[32rpx] p-[28rpx] shadow-soft flex gap-[24rpx] press-scale"
                    onClick={() => goToRecordDetail(record.id)}
                  >
                    {/* 时间轴 */}
                    <View className="flex flex-col items-center w-[24rpx] flex-shrink-0 pt-[8rpx]">
                      <View className="w-[16rpx] h-[16rpx] rounded-full bg-gradient-primary flex-shrink-0" />
                      <View className="w-[4rpx] flex-1 bg-border mt-[8rpx] min-h-[40rpx]" />
                    </View>
                    {/* 内容 */}
                    <View className="flex-1 min-w-0">
                      <View className="flex items-start justify-between">
                        <View className="flex-1">
                          <Text className="text-[28rpx] font-medium text-foreground block">
                            {record.course_package?.name || '课程'}
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
                        <View className="mt-[16rpx] py-[16rpx] px-[24rpx] bg-muted rounded-[16rpx]">
                          <Text className="text-[24rpx] text-muted-foreground">
                            课程内容：{record.content}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
                {records.length === 0 && <Empty description="暂无上课记录" />}
              </View>
            </View>
          </ScrollView>
        </SwiperItem>

        <SwiperItem itemId="packages">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
              <View className="mb-[24rpx] flex items-center justify-between">
                <Text className="text-[28rpx] font-semibold text-foreground">课包列表</Text>
                <View
                  className="rounded-full bg-primary/10 px-[20rpx] py-[10rpx]"
                  onClick={goToPackageTransactions}
                >
                  <Text className="text-[22rpx] font-medium text-primary">查看流水</Text>
                </View>
              </View>
              <View className="flex flex-col gap-[24rpx]">
                {packages.map((pkg) => {
                  const progress =
                    pkg.total_hours > 0
                      ? ((pkg.total_hours - pkg.remaining_hours) / pkg.total_hours) * 100
                      : 0;
                  const statusInfo = PKG_STATUS_MAP[pkg.status] || PKG_STATUS_MAP.active;
                  const isGift = pkg.package_tag === 'gift';
                  const isShared = pkg.package_role === 'sharer';
                  const giftHours = getPackageGiftHours(pkg);
                  const refundedAmount = refundedAmountByPackage[pkg.id] || 0;

                  return (
                    <View key={pkg.id} className="bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
                      <View className="flex items-start justify-between gap-[20rpx]">
                        <View className="min-w-0 flex-1">
                          <Text className="text-[30rpx] font-bold text-foreground block">
                            {pkg.name}
                          </Text>
                          <View className="mt-[8rpx] flex flex-wrap items-center gap-[10rpx]">
                            <Text className="text-[24rpx] text-muted-foreground">
                              {formatDateCN(pkg.created_at)} 充值
                            </Text>
                            {pkg.fee_amount != null && (
                              <View className="rounded-[14rpx] bg-muted px-[16rpx] py-[6rpx]">
                                <Text className="text-[22rpx] font-medium text-foreground">
                                  ¥{pkg.fee_amount}
                                </Text>
                              </View>
                            )}
                            {pkg.fee_method && (
                              <View className="rounded-[14rpx] bg-muted px-[16rpx] py-[6rpx]">
                                <Text className="text-[22rpx] text-muted-foreground">
                                  {FEE_METHOD_MAP[pkg.fee_method] || pkg.fee_method}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View
                          className="py-[8rpx] px-[20rpx] rounded-[24rpx] flex-shrink-0"
                          style={{ background: statusInfo.bg }}
                        >
                          <Text
                            className="text-[22rpx] font-semibold"
                            style={{ color: statusInfo.text }}
                          >
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>

                      {/* 进度条 */}
                      <View className="mt-[24rpx]">
                        <View className="h-[12rpx] bg-border rounded-[6rpx] overflow-hidden">
                          <View
                            className="h-full rounded-[6rpx]"
                            style={{
                              width: `${Math.min(progress, 100)}%`,
                              background: getPkgProgressGradient(pkg.status),
                            }}
                          />
                        </View>
                        <View className="flex justify-between mt-[8rpx]">
                          <Text className="text-[24rpx] text-muted-foreground">
                            剩余 {pkg.remaining_hours} 课时
                          </Text>
                          <Text className="text-[24rpx] text-muted-foreground">
                            共 {pkg.total_hours} 课时
                          </Text>
                        </View>
                      </View>

                      {/* 标签行：共享 / 特殊标记 */}
                      <View className="flex gap-[12rpx] mt-[20rpx] flex-wrap">
                        {isGift && giftHours <= 0 && (
                          <View className="py-[8rpx] px-[20rpx] rounded-[16rpx] bg-success-bg">
                            <Text className="text-[24rpx] text-success font-medium">赠送</Text>
                          </View>
                        )}
                        {isShared && (
                          <View className="py-[8rpx] px-[20rpx] rounded-[16rpx] bg-info-bg">
                            <Text className="text-[24rpx] text-info font-medium">共享</Text>
                          </View>
                        )}
                      </View>

                      {(pkg.bonus_remaining > 0 || refundedAmount > 0) && (
                        <View className="mt-[18rpx] border-t border-border/50 pt-[16rpx]">
                          <Text className="text-[22rpx] leading-[34rpx] text-[#D94040]">
                            {pkg.bonus_remaining > 0
                              ? `当前剩余课时中包含赠送 ${pkg.bonus_remaining} 课时`
                              : ''}
                            {refundedAmount > 0 ? `，已累计退费 ¥${refundedAmount.toFixed(2)}` : ''}
                          </Text>
                        </View>
                      )}

                      {/* 续费入口：余额 ≤3 且活跃课包 */}
                      {pkg.remaining_hours <= 3 && pkg.status === 'active' && (
                        <View
                          className="mt-[20rpx] flex items-center justify-end"
                          onClick={() =>
                            Taro.navigateTo({
                              url: `/package-course/pages/package-form/index?studentId=${studentId}&packageId=${pkg.id}`,
                            })
                          }
                        >
                          <View className="px-[24rpx] py-[10rpx] rounded-full bg-primary/10">
                            <Text className="text-[24rpx] text-primary font-medium">续费</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
                {packages.length === 0 && <Empty description="暂无课时套餐" />}
              </View>
              {recentPackageTransactions.length > 0 && (
                <View className="mt-[32rpx]">
                  <Text className="mb-[20rpx] block text-[28rpx] font-semibold text-foreground">
                    最近流水
                  </Text>
                  <View className="flex flex-col gap-[16rpx]">
                    {recentPackageTransactions.map((item) => (
                      <View
                        key={item.id}
                        className="rounded-[24rpx] bg-white px-[24rpx] py-[22rpx] shadow-soft"
                      >
                        <View className="flex items-center justify-between gap-[16rpx]">
                          <View className="min-w-0 flex-1">
                            <View className="flex items-center gap-[12rpx]">
                              <View
                                className={`rounded-full px-[14rpx] py-[6rpx] ${
                                  item.type === 'refund' ? 'bg-warning-bg' : 'bg-primary-bg'
                                }`}
                              >
                                <Text
                                  className={`text-[20rpx] font-semibold ${
                                    item.type === 'refund' ? 'text-warning' : 'text-primary'
                                  }`}
                                >
                                  {item.type === 'refund' ? '退费' : '充值'}
                                </Text>
                              </View>
                              <Text className="truncate text-[26rpx] font-medium text-foreground">
                                {item.package_name || '课包流水'}
                              </Text>
                            </View>
                            <Text className="mt-[8rpx] block text-[22rpx] text-muted-foreground">
                              {item.type === 'refund'
                                ? `退费 ¥${Number(item.refund_amount || item.fee_amount || 0).toFixed(2)}`
                                : `充值 ${item.purchased_hours || 0} 课时${
                                    item.gift_hours ? ` · 赠送 ${item.gift_hours} 课时` : ''
                                  }`}
                            </Text>
                            {item.reason && (
                              <Text className="mt-[6rpx] block text-[22rpx] text-muted-foreground">
                                原因：{item.reason}
                              </Text>
                            )}
                          </View>
                          <Text className="flex-shrink-0 text-[22rpx] text-muted-foreground">
                            {formatDateCN(item.created_at)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </SwiperItem>

        <SwiperItem itemId="leaves">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
              <View className="flex flex-col gap-[20rpx]">
                {leaves.map((leave) => {
                  const statusInfo = LEAVE_STATUS_MAP[leave.status];
                  return (
                    <View key={leave.id} className="bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
                      <View className="flex items-center justify-between">
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
                          className={`py-[8rpx] px-[20rpx] rounded-[24rpx] text-[24rpx] font-medium flex-shrink-0 ${statusInfo.className}`}
                        >
                          <Text>{statusInfo.label}</Text>
                        </View>
                      </View>
                      {leave.reason && (
                        <View className="mt-[16rpx] py-[16rpx] px-[24rpx] bg-muted rounded-[16rpx]">
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
                            <Text className="text-white text-[26rpx] font-medium">同意</Text>
                          </View>
                          <View
                            className="flex-1 py-[16rpx] rounded-[24rpx] border-[3rpx] border-destructive center press-scale"
                            onClick={() => handleRejectLeave(leave.id)}
                          >
                            <Text className="text-destructive text-[26rpx] font-medium">拒绝</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
                {leaves.length === 0 && <Empty description="暂无请假记录" />}
              </View>
            </View>
          </ScrollView>
        </SwiperItem>

        <SwiperItem itemId="parents">
          <ScrollView scrollY className="h-full">
            <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
              <View className="flex flex-col gap-[20rpx]">
                {/* 邀请码卡片 */}
                <View className="bg-white rounded-[32rpx] py-[48rpx] px-[48rpx] shadow-soft text-center">
                  <Text className="text-[24rpx] text-muted-foreground block mb-[16rpx]">
                    学生邀请码
                  </Text>
                  <Text className="text-[56rpx] font-bold text-primary tracking-[12rpx] block font-mono">
                    {student.invite_code}
                  </Text>
                  <View className="flex gap-[16rpx] mt-[32rpx]">
                    <View
                      className="flex-1 py-[28rpx] rounded-[40rpx] bg-gradient-primary shadow-elegant text-[28rpx] font-medium text-white text-center press-scale flex items-center justify-center gap-[8rpx]"
                      onClick={copyInviteCode}
                    >
                      <Icon name="mdi-content-copy" size="sm" color="white" />
                      <Text className="text-white">复制邀请码</Text>
                    </View>
                    <Button
                      className="flex-1 py-[28rpx] rounded-[40rpx] bg-accent shadow-elegant text-[28rpx] font-medium text-white text-center press-scale flex items-center justify-center gap-[8rpx] border-none after:border-none leading-none p-0"
                      openType="share"
                      onClick={handleInviteParent}
                    >
                      <Icon name="mdi-share-variant" size="sm" color="white" />
                      <Text className="text-white">邀请家长</Text>
                    </Button>
                  </View>
                  <Text className="text-[22rpx] text-muted-foreground block mt-[20rpx]">
                    邀请卡片仅限使用一次，转发后即失效
                  </Text>
                </View>

                {/* 已绑定家长列表 */}
                <Text className="text-[32rpx] font-medium text-foreground block mt-[16rpx]">
                  已绑定家长
                </Text>
                {(parents || []).map((binding) => (
                  <View
                    key={binding.id}
                    className="bg-white rounded-[32rpx] p-[32rpx] shadow-soft flex items-center justify-between"
                  >
                    <View className="flex items-center gap-[24rpx]">
                      <View className="w-[80rpx] h-[80rpx] rounded-full bg-gradient-accent center">
                        <Icon name="mdi-account" size="sm" color="white" />
                      </View>
                      <View>
                        <Text className="text-[32rpx] font-medium block">
                          {binding.parent?.name || '家长'}
                        </Text>
                        <Text className="text-[24rpx] text-muted-foreground block">
                          {binding.parent?.phone || '暂无电话'}
                        </Text>
                      </View>
                    </View>
                    {isTeacher && (
                      <View
                        className="py-[12rpx] px-[24rpx] rounded-[16rpx] border-[3rpx] border-destructive/30 press-scale"
                        onClick={() => handleUnbind(binding.id)}
                      >
                        <Text className="text-[24rpx] text-destructive">解绑</Text>
                      </View>
                    )}
                  </View>
                ))}
                {(!parents || parents.length === 0) && <Empty description="暂无家长绑定" />}
              </View>
            </View>
          </ScrollView>
        </SwiperItem>
      </Swiper>

      {/* ====== 底部操作栏 ====== */}
      {isTeacher ? (
        <View className="fixed bottom-0 left-0 right-0 bg-white px-[32rpx] pt-[24rpx] pb-safe-bar shadow-soft flex gap-[16rpx] z-10">
          <View
            className="flex-1 h-[96rpx] rounded-[48rpx] bg-gradient-primary center press-scale"
            onClick={goToRecharge}
          >
            <Text className="text-[28rpx] font-semibold text-white">充值</Text>
          </View>
          <View
            className="flex-1 h-[96rpx] rounded-[48rpx] bg-primary-bg center press-scale"
            onClick={goToTransfer}
          >
            <Text className="text-[28rpx] font-semibold text-primary">调班</Text>
          </View>
          <View
            className="flex-1 h-[96rpx] rounded-[48rpx] bg-destructive/10 center press-scale"
            onClick={handleOpenRefund}
          >
            <Text className="text-[28rpx] font-semibold text-destructive">退费</Text>
          </View>
          <View
            className="flex-1 h-[96rpx] rounded-[48rpx] bg-white center press-scale border-[3rpx] border-border"
            onClick={handleDelete}
          >
            <Text className="text-[28rpx] font-semibold text-muted-foreground">删除</Text>
          </View>
        </View>
      ) : (
        <View className="fixed bottom-0 left-0 right-0 bg-white px-[32rpx] pt-[24rpx] pb-safe-bar shadow-soft z-10">
          <View
            className="h-[96rpx] rounded-[48rpx] bg-primary-bg center press-scale"
            onClick={() => handleTabChange('parents')}
          >
            <Text className="text-[30rpx] font-semibold text-primary">家长绑定</Text>
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
