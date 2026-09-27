/**
 * 学员详情页交互动作
 *
 * 使用场景：电话/短信、邀请家长、发会员卡、跟进、请假审批、退费。
 * 功能说明：集中 navigate / toast / service 写操作，保持原 URL 与文案。
 */
import Taro from '@tarojs/taro';
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { navigateToLessonDetail } from '@/components/lesson/LessonConsumptionList';
import { leaveService, studentService } from '@/services';
import { getThemeHexColors, type ThemeKey } from '@/theme';
import type { FollowRecord } from '@/types/follow-record';
import type { LeaveRequest } from '@/types/leave-request';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import { navigateToOnce } from '@/utils/navigation';
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';

export interface UseStudentDetailActionsParams {
  student: Student | null;
  activeTheme: ThemeKey;
  setLeaves: Dispatch<SetStateAction<LeaveRequest[]>>;
}

/** 学员详情页各类用户操作回调。 */
export function useStudentDetailActions(params: UseStudentDetailActionsParams) {
  const { student, activeTheme, setLeaves } = params;

  /** 编辑学员：进入 student-form 编辑模式（路由带 id 即为编辑，仅教职工入口）。 */
  const goToEditStudent = useCallback(() => {
    if (!student) return;
    navigateToOnce(
      `/package-student/pages/student-form/index?id=${encodeURIComponent(student.id)}`,
    );
  }, [student]);

  /**
   * 删除学员（软删除）：确认后调用后端删除接口（status → INACTIVE），
   * 置列表刷新信号后返回；历史记录与课时数据保留在库中。
   */
  const handleDeleteStudent = useCallback(() => {
    if (!student) return;
    Taro.showModal({
      title: '删除学员',
      content: `确定删除学员「${student.name}」吗？删除后学员不再显示在在籍列表，历史记录将保留。`,
      confirmColor: getThemeHexColors(activeTheme).error,
      success: (res) => {
        if (!res.confirm) return;
        studentService
          .remove(student.id)
          .then(() => {
            setRefreshSignal(REFRESH_SIGNAL.students);
            Taro.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => Taro.navigateBack(), 600);
          })
          .catch(() => Taro.showToast({ title: '删除失败，请重试', icon: 'none' }));
      },
    });
  }, [student, activeTheme]);

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
    navigateToOnce(
      `/package-student/pages/member-card-issue/index?studentId=${encodeURIComponent(student.id)}`,
    );
  }, [student]);

  const handleWriteFollow = useCallback(() => {
    if (!student) return;
    navigateToOnce(
      `/package-student/pages/follow-record-form/index?studentId=${encodeURIComponent(student.id)}`,
    );
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

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  return {
    goToEditStudent,
    handleDeleteStudent,
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
    goBack,
  };
}
