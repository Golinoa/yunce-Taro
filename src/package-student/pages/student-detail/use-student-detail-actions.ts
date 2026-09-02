/**
 * 学员详情页交互动作
 *
 * 使用场景：电话/短信、邀请家长、发会员卡、跟进、请假审批、退费。
 * 功能说明：集中 navigate / toast / service 写操作，保持原 URL 与文案。
 */
import Taro from '@tarojs/taro';
import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { navigateToLessonDetail } from '@/components/lesson/LessonConsumptionList';
import { leaveService, packageService } from '@/services';
import { getThemeHexColors, type ThemeKey } from '@/theme';
import type { CoursePackage, PackageTransaction } from '@/types/course-package';
import type { FollowRecord } from '@/types/follow-record';
import type { LeaveRequest } from '@/types/leave-request';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import { getPackageRefundableAmount } from './student-detail-package';

export interface UseStudentDetailActionsParams {
  student: Student | null;
  activeTheme: ThemeKey;
  profileId?: string;
  profileName?: string;
  refundablePackages: CoursePackage[];
  refundedAmountByPackage: Record<string, number>;
  selectedRefundPackage: CoursePackage | null;
  selectedRefundMaxAmount: number;
  refundAmount: string;
  refundReason: string;
  showRefundSheet: boolean;
  setLeaves: Dispatch<SetStateAction<LeaveRequest[]>>;
  setPackageTransactions: Dispatch<SetStateAction<PackageTransaction[]>>;
  setSelectedRefundPackageId: Dispatch<SetStateAction<string>>;
  setRefundAmount: Dispatch<SetStateAction<string>>;
  setRefundReason: Dispatch<SetStateAction<string>>;
  setShowRefundSheet: Dispatch<SetStateAction<boolean>>;
  setRefundSubmitting: Dispatch<SetStateAction<boolean>>;
}

/** 学员详情页各类用户操作回调。 */
export function useStudentDetailActions(params: UseStudentDetailActionsParams) {
  const {
    student,
    activeTheme,
    profileId,
    profileName,
    refundablePackages,
    refundedAmountByPackage,
    selectedRefundPackage,
    selectedRefundMaxAmount,
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
  } = params;

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

  const handleCallPhone = useCallback(() => {
    const phone = student?.phone;
    if (!phone) {
      Taro.showToast({ title: '暂无手机号', icon: 'none' });
      return;
    }
    Taro.makePhoneCall({ phoneNumber: phone });
  }, [student?.phone]);

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

  const handleInviteParent = useCallback(() => {
    if (!student) return;
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const path = `/package-student/pages/parent-bind/index?studentId=${encodeURIComponent(student.id)}&token=${encodeURIComponent(token)}`;
    const link = `package-auth/pages/index/index?redirect=${encodeURIComponent(path)}`;
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

  const goToRecordDetail = useCallback((recordId: string) => {
    navigateToLessonDetail(recordId);
  }, []);

  const handleIssueCard = useCallback(() => {
    if (!student) return;
    Taro.navigateTo({
      url: `/package-student/pages/member-card-issue/index?studentId=${encodeURIComponent(student.id)}`,
    });
  }, [student]);

  const handleWriteFollow = useCallback(() => {
    if (!student) return;
    Taro.navigateTo({
      url: `/package-student/pages/follow-record-form/index?studentId=${encodeURIComponent(student.id)}`,
    });
  }, [student]);

  const handleMemberCardClick = useCallback((card: MemberCardDetail) => {
    Taro.navigateTo({
      url: `/package-student/pages/member-card-detail/index?id=${encodeURIComponent(card.id)}`,
    });
  }, []);

  const handleFollowClick = useCallback(
    (record: FollowRecord) => {
      if (!student) return;
      Taro.navigateTo({
        url: `/package-student/pages/follow-record-form/index?studentId=${encodeURIComponent(student.id)}&recordId=${encodeURIComponent(record.id)}`,
      });
    },
    [student],
  );

  const handleApproveLeave = useCallback(
    async (id: string) => {
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
    },
    [setLeaves],
  );

  const handleRejectLeave = useCallback(
    async (id: string) => {
      const { confirm } = await Taro.showModal({
        title: '确认拒绝',
        content: '确认拒绝该请假申请？',
        confirmColor: getThemeHexColors(activeTheme).destructive,
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
    },
    [activeTheme, setLeaves],
  );

  const handleSelectRefundPackage = useCallback(
    (pkg: CoursePackage) => {
      setSelectedRefundPackageId(pkg.id);
      setRefundAmount(
        String(getPackageRefundableAmount(pkg, refundedAmountByPackage[pkg.id] || 0)),
      );
    },
    [refundedAmountByPackage, setRefundAmount, setSelectedRefundPackageId],
  );

  /** 打开退费 Sheet；无可退课包时 toast，有则可预选第一项。 */
  const handleOpenRefund = useCallback(() => {
    if (refundablePackages.length === 0) {
      Taro.showToast({ title: '暂无可退课包', icon: 'none' });
      return;
    }
    const first = refundablePackages[0];
    setSelectedRefundPackageId(first.id);
    setRefundAmount(
      String(getPackageRefundableAmount(first, refundedAmountByPackage[first.id] || 0)),
    );
    setShowRefundSheet(true);
  }, [
    refundablePackages,
    refundedAmountByPackage,
    setRefundAmount,
    setSelectedRefundPackageId,
    setShowRefundSheet,
  ]);

  useEffect(() => {
    if (!showRefundSheet) {
      return;
    }

    if (!selectedRefundPackage) {
      setRefundAmount('');
      return;
    }

    setRefundAmount(selectedRefundMaxAmount > 0 ? selectedRefundMaxAmount.toFixed(2) : '');
  }, [selectedRefundMaxAmount, selectedRefundPackage, setRefundAmount, showRefundSheet]);

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
        operator_id: profileId,
        operator_name: profileName || undefined,
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
    profileId,
    profileName,
    refundAmount,
    refundReason,
    selectedRefundMaxAmount,
    selectedRefundPackage,
    setPackageTransactions,
    setRefundAmount,
    setRefundReason,
    setRefundSubmitting,
    setSelectedRefundPackageId,
    setShowRefundSheet,
    student,
  ]);

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  return {
    handleCopyPhone,
    handleCallPhone,
    handleSendMessage,
    handleInviteParent,
    goToRecordDetail,
    handleIssueCard,
    handleWriteFollow,
    handleMemberCardClick,
    handleFollowClick,
    handleApproveLeave,
    handleRejectLeave,
    handleOpenRefund,
    handleSelectRefundPackage,
    handleConfirmRefund,
    goBack,
  };
}
