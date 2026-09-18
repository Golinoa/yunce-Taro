/**
 * L1 试听邀约落地页（invite-landing）访问判定 / bootstrap / 下一步动作（纯态机）
 * 不含 React、Taro、隐私授权与登录副作用。
 */

export type TrialInviteAccessDecision = 'wait' | 'staff_blocked' | 'allow';

/** 试听预约「无法预约」原因（与后端 bookingDeadline / 已开课拦截对齐） */
export type TrialInviteBookingClosedReason =
  | 'lesson_expired'
  | 'lesson_started'
  | 'booking_deadline';

/**
 * 统一计算「无法预约」状态：达禁止时间 / 已下课 / 开课中。
 * 纯函数，无 Taro / React 副作用。now 默认取调用时刻。
 */
export function resolveTrialInviteBookingClosed(params: {
  date?: string;
  start?: string;
  end?: string;
  bookingDeadlineEnabled: boolean;
  bookingDeadlineMinutes: number;
  now?: Date;
}): { closed: boolean; reason: TrialInviteBookingClosedReason | null } {
  const now = params.now ?? new Date();

  // 已下课：now 晚于结束时刻
  if (params.date && params.end) {
    const endAt = new Date(
      `${params.date} ${params.end.length === 5 ? `${params.end}:00` : params.end}`,
    );
    if (!Number.isNaN(endAt.getTime()) && now > endAt) {
      return { closed: true, reason: 'lesson_expired' };
    }
  }

  if (!params.date || !params.start) return { closed: false, reason: null };
  const startAt = new Date(
    `${params.date} ${params.start.length === 5 ? `${params.start}:00` : params.start}`,
  );
  if (Number.isNaN(startAt.getTime())) return { closed: false, reason: null };

  // 已开课 / 开课中：now 晚于或等于开课时刻
  if (now >= startAt) {
    return { closed: true, reason: 'lesson_started' };
  }

  // 达预约截止时间：now 晚于（开课时刻 - 截止分钟数）
  if (
    params.bookingDeadlineEnabled &&
    now.getTime() > startAt.getTime() - params.bookingDeadlineMinutes * 60_000
  ) {
    return { closed: true, reason: 'booking_deadline' };
  }

  return { closed: false, reason: null };
}

/** 机构端不可访问家长邀约落地（guest=1 仅 Mock 强制访客演示） */
export function resolveTrialInviteAccess(input: {
  authLoading: boolean;
  paramsReady: boolean;
  isStaff: boolean;
  guest: boolean;
}): TrialInviteAccessDecision {
  if (input.authLoading || !input.paramsReady) return 'wait';
  if (input.isStaff && !input.guest) return 'staff_blocked';
  return 'allow';
}

export type TrialInviteBootstrapKind =
  | 'wait'
  | 'login_required'
  | 'restore_success'
  | 'booking_closed'
  | 'ready';

export interface TrialInviteBootstrapInput {
  authLoading: boolean;
  paramsReady: boolean;
  staffBlocked: boolean;
  isStaff: boolean;
  guest: boolean;
  bootstrapped: boolean;
  /** 已登录且非 guest */
  loggedIn: boolean;
  hasSuccessRecord: boolean;
  /** 达禁止时间 / 已下课 / 开课中 → 无法预约 */
  bookingClosed: boolean;
}

/** 首屏 bootstrap：登录门 / 已预约成功 / 无法预约跳过领券 / 待领券 */
export function resolveTrialInviteBootstrap(
  input: TrialInviteBootstrapInput,
): TrialInviteBootstrapKind {
  if (input.authLoading || !input.paramsReady || input.staffBlocked) return 'wait';
  if (input.isStaff && !input.guest) return 'wait';
  if (input.bootstrapped) return 'wait';
  if (!input.loggedIn && !input.guest) return 'login_required';
  if (input.hasSuccessRecord) return 'restore_success';
  if (input.bookingClosed) return 'booking_closed';
  return 'ready';
}

export type TrialInviteLoginCatchupKind = 'noop' | 'booking_closed' | 'reveal_voucher';

/** 登录成功后若尚未进入主流程，补一次 bootstrap */
export function resolveTrialInviteLoginCatchup(input: {
  authLoading: boolean;
  paramsReady: boolean;
  staffBlocked: boolean;
  isStaff: boolean;
  guest: boolean;
  bootstrapped: boolean;
  loggedIn: boolean;
  success: boolean;
  claimed: boolean;
  showForm: boolean;
  showVoucher: boolean;
  bookingClosed: boolean;
}): TrialInviteLoginCatchupKind {
  if (input.authLoading || !input.paramsReady || input.staffBlocked || !input.bootstrapped) {
    return 'noop';
  }
  if (input.isStaff && !input.guest) return 'noop';
  if (!input.loggedIn) return 'noop';
  if (input.success || input.claimed || input.showForm) return 'noop';
  if (input.bookingClosed) return 'booking_closed';
  if (!input.showVoucher && !input.claimed) return 'reveal_voucher';
  return 'noop';
}

export type TrialInviteBookNext = 'ignore_closed' | 'need_login' | 'open_form';

export function resolveTrialInviteBookNext(input: {
  bookingClosed: boolean;
  loggedIn: boolean;
}): TrialInviteBookNext {
  if (input.bookingClosed) return 'ignore_closed';
  if (!input.loggedIn) return 'need_login';
  return 'open_form';
}

export type TrialInvitePostLoginNext = 'booking_closed' | 'open_form' | 'show_voucher';

export function resolveTrialInvitePostLoginNext(input: {
  bookingClosed: boolean;
  openFormAfterLogin: boolean;
}): TrialInvitePostLoginNext {
  if (input.bookingClosed) return 'booking_closed';
  if (input.openFormAfterLogin) return 'open_form';
  return 'show_voucher';
}

export type TrialInviteFormField = 'child_name' | 'child_age' | 'child_gender' | 'parent_phone';

export function validateTrialInviteForm(input: {
  childName: string;
  childAge: string;
  childGender: string;
  parentPhone: string;
}): TrialInviteFormField | null {
  if (!input.childName.trim()) return 'child_name';
  if (!input.childAge.trim()) return 'child_age';
  if (!input.childGender) return 'child_gender';
  if (!/^1\d{10}$/.test(input.parentPhone.trim())) return 'parent_phone';
  return null;
}

export const TRIAL_INVITE_FORM_TOAST: Record<TrialInviteFormField, string> = {
  child_name: '请输入孩子姓名',
  child_age: '请填写年龄',
  child_gender: '请选择性别',
  parent_phone: '请输入正确手机号',
};

export type TrialInviteDockAction = 'hidden' | 'call_campus' | 'contact_teacher' | 'book_now';

export function resolveTrialInviteDockAction(input: {
  claimed: boolean;
  bookingClosed: boolean;
  hasCampusPhone: boolean;
}): TrialInviteDockAction {
  if (!input.claimed) return 'hidden';
  if (input.bookingClosed) {
    return input.hasCampusPhone ? 'call_campus' : 'contact_teacher';
  }
  return 'book_now';
}

export function resolveTrialInviteMainCopy(input: {
  bookingClosedReason?: TrialInviteBookingClosedReason | null;
  claimed: boolean;
  isGroupBook: boolean;
  teacherName: string;
  campusPhone?: string;
}): { title: string; subtitle: string } {
  if (input.bookingClosedReason) {
    const teacherPart = input.teacherName ? `老师「${input.teacherName}」` : '老师';
    const phonePart = input.campusPhone ? '，也可直接电话联系校区' : '';
    const title =
      input.bookingClosedReason === 'lesson_expired'
        ? '本场课程已结束'
        : input.bookingClosedReason === 'lesson_started'
          ? '本场试听已开始'
          : '已超过预约截止时间';
    return {
      title,
      subtitle: `这场课无法再预约。请联系${teacherPart}重新安排试听时间${phonePart}。`,
    };
  }
  if (input.claimed) {
    return {
      title: input.isGroupBook ? '预约本场团课' : '预约本场免费试听',
      subtitle: '点击下方立即预约，并开通上课提醒。',
    };
  }
  return {
    title: '领取试听券后可预约',
    subtitle: '老师分享了本场课程。请先领取免费试听券，再完成预约。',
  };
}
