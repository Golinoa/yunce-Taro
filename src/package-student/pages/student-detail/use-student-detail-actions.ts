/**
 * 学员详情页交互动作
 *
 * 使用场景：电话/短信、邀请家长、发会员卡、跟进、请假审批、退费。
 * 功能说明：集中 navigate / toast / service 写操作，保持原 URL 与文案。
 */
import Taro from '@tarojs/taro';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { navigateToLessonDetail } from '@/components/lesson/LessonConsumptionList';
import { leaveService, studentService } from '@/services';
import type { StudentDeletePreview } from '@/services/student';
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

/** 删除学员弹层的状态（页面据此渲染 StudentDeleteSheet） */
export interface StudentDeleteSheetState {
  visible: boolean;
  preview: null | StudentDeletePreview;
  loading: boolean;
  submitting: boolean;
}

/** 学员详情页各类用户操作回调。 */
export function useStudentDetailActions(params: UseStudentDetailActionsParams) {
  const { student, activeTheme, setLeaves } = params;

  /**
   * 删除学员弹层。
   *
   * 用户定的口径：**删除前必须先检查，并给出「冻结 / 继续删除」两个出口**。
   * 删除 = 收进回收站（退班、停课表、解绑家长，课时与记录保留）；
   * 冻结 = 休学（什么都不动，只是不参与点名，可随时解冻）。
   */
  const [deleteSheet, setDeleteSheet] = useState<StudentDeleteSheetState>({
    visible: false,
    preview: null,
    loading: false,
    submitting: false,
  });

  /** 编辑学员：进入 student-form 编辑模式（路由带 id 即为编辑，仅教职工入口）。 */
  const goToEditStudent = useCallback(() => {
    if (!student) return;
    navigateToOnce(
      `/package-student/pages/student-form/index?id=${encodeURIComponent(student.id)}`,
    );
  }, [student]);

  /**
   * 点「删除学员」：**先拉一次检查**，把"他名下还有什么"摊开，
   * 再让老师在「冻结 / 继续删除」之间选（弹层由页面渲染）。
   */
  const handleDeleteStudent = useCallback(() => {
    if (!student) return;
    setDeleteSheet({ visible: true, preview: null, loading: true, submitting: false });
    studentService
      .getDeletePreview(student.id)
      .then((preview) => {
        setDeleteSheet((prev) => ({ ...prev, preview, loading: false }));
      })
      .catch(() => {
        setDeleteSheet((prev) => ({ ...prev, loading: false }));
        Taro.showToast({ title: '检查失败，请重试', icon: 'none' });
      });
  }, [student]);

  const handleCloseDeleteSheet = useCallback(() => {
    setDeleteSheet((prev) => (prev.submitting ? prev : { ...prev, visible: false }));
  }, []);

  /**
   * 冻结（休学）：不进回收站。课时 / 会员卡 / 班级 / 课表 / 家长绑定全部保留，
   * 只是不再进点名名单、不会被扣课时；解冻后原样回来。
   */
  const handleFreezeStudent = useCallback(() => {
    if (!student) return;
    setDeleteSheet((prev) => ({ ...prev, submitting: true }));
    studentService
      .freeze(student.id)
      .then(() => {
        setRefreshSignal(REFRESH_SIGNAL.students);
        setDeleteSheet((prev) => ({ ...prev, visible: false, submitting: false }));
        // 排课也会被一并停掉，明确告诉老师（否则他会奇怪"课表上怎么没这个学员了"）
        Taro.showToast({ title: '已冻结，排课已停用', icon: 'success' });
      })
      .catch(() => {
        setDeleteSheet((prev) => ({ ...prev, submitting: false }));
        Taro.showToast({ title: '冻结失败，请重试', icon: 'none' });
      });
  }, [student]);

  /** 继续删除：移入回收站（后端同时退班 / 停课表 / 解绑家长；课时与记录保留） */
  const handleConfirmDeleteStudent = useCallback(() => {
    if (!student) return;
    setDeleteSheet((prev) => ({ ...prev, submitting: true }));
    studentService
      .remove(student.id)
      .then(() => {
        setRefreshSignal(REFRESH_SIGNAL.students);
        setDeleteSheet((prev) => ({ ...prev, visible: false, submitting: false }));
        Taro.showToast({ title: '已移入回收站', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 600);
      })
      .catch(() => {
        setDeleteSheet((prev) => ({ ...prev, submitting: false }));
        Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
      });
  }, [student]);

  /**
   * 解冻：回到在册。因为冻结期间什么都没动过，课时、班级、课表、家长绑定原样还在。
   * 返回 true 表示真的解冻了（用户取消或失败返回 false），调用方据此决定要不要重新拉详情。
   */
  const handleUnfreezeStudent = useCallback(async (): Promise<boolean> => {
    if (!student) return false;
    const { confirm } = await Taro.showModal({
      title: '解冻学员',
      content: `解冻「${student.name}」后，他会重新回到点名名单，冻结时停用的排课也会一并恢复。`,
    });
    if (!confirm) return false;
    try {
      await studentService.unfreeze(student.id);
      setRefreshSignal(REFRESH_SIGNAL.students);
      Taro.showToast({ title: '已解冻', icon: 'success' });
      return true;
    } catch {
      Taro.showToast({ title: '解冻失败，请重试', icon: 'none' });
      return false;
    }
  }, [student]);

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
    deleteSheet,
    handleCloseDeleteSheet,
    handleFreezeStudent,
    handleConfirmDeleteStudent,
    handleUnfreezeStudent,
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
