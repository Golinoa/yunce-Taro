import { describe, expect, it } from 'vitest';
import {
  TRIAL_INVITE_FORM_TOAST,
  resolveTrialInviteAccess,
  resolveTrialInviteBookNext,
  resolveTrialInviteBookingClosed,
  resolveTrialInviteBootstrap,
  resolveTrialInviteDockAction,
  resolveTrialInviteLoginCatchup,
  resolveTrialInviteMainCopy,
  resolveTrialInvitePostLoginNext,
  validateTrialInviteForm,
} from './invite-landing-flow';

describe('invite-landing-flow (L1 态机)', () => {
  describe('角色与访问', () => {
    it('auth 未就绪 → wait；员工非 guest → staff_blocked；家长/guest → allow', () => {
      expect(
        resolveTrialInviteAccess({
          authLoading: true,
          paramsReady: true,
          isStaff: true,
          guest: false,
        }),
      ).toBe('wait');
      expect(
        resolveTrialInviteAccess({
          authLoading: false,
          paramsReady: false,
          isStaff: false,
          guest: false,
        }),
      ).toBe('wait');
      expect(
        resolveTrialInviteAccess({
          authLoading: false,
          paramsReady: true,
          isStaff: true,
          guest: false,
        }),
      ).toBe('staff_blocked');
      expect(
        resolveTrialInviteAccess({
          authLoading: false,
          paramsReady: true,
          isStaff: true,
          guest: true,
        }),
      ).toBe('allow');
      expect(
        resolveTrialInviteAccess({
          authLoading: false,
          paramsReady: true,
          isStaff: false,
          guest: false,
        }),
      ).toBe('allow');
    });
  });

  describe('bootstrap：登录门 / 已预约 / 无法预约', () => {
    const base = {
      authLoading: false,
      paramsReady: true,
      staffBlocked: false,
      isStaff: false,
      guest: false,
      bootstrapped: false,
      loggedIn: true,
      hasSuccessRecord: false,
      bookingClosed: false,
    };

    it('未登录 → login_required', () => {
      expect(resolveTrialInviteBootstrap({ ...base, loggedIn: false })).toBe('login_required');
    });

    it('已预约成功记录 → restore_success（已绑定本场）', () => {
      expect(resolveTrialInviteBootstrap({ ...base, hasSuccessRecord: true })).toBe(
        'restore_success',
      );
    });

    it('无法预约（达禁止时间 / 已下课 / 开课中）→ booking_closed', () => {
      expect(resolveTrialInviteBootstrap({ ...base, bookingClosed: true })).toBe('booking_closed');
    });

    it('正常 → ready；已 boot / staffBlocked → wait', () => {
      expect(resolveTrialInviteBootstrap(base)).toBe('ready');
      expect(resolveTrialInviteBootstrap({ ...base, bootstrapped: true })).toBe('wait');
      expect(resolveTrialInviteBootstrap({ ...base, staffBlocked: true })).toBe('wait');
      expect(resolveTrialInviteBootstrap({ ...base, isStaff: true, guest: false })).toBe('wait');
    });
  });

  describe('resolveTrialInviteBookingClosed：统一「无法预约」判定', () => {
    const rules = { bookingDeadlineEnabled: true, bookingDeadlineMinutes: 120 };

    it('已下课（now 晚于结束时刻）→ lesson_expired', () => {
      // 用「2 天前」而非「1 小时前」：1 小时前可能仍是今天，而 10:00–11:00 相对当前
      // 时刻未必已过（CI 跑在 UTC 时尤其明显）——原写法是与运行时刻相关的 flaky 用例。
      const past = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      expect(
        resolveTrialInviteBookingClosed({
          date: past.slice(0, 10),
          start: '10:00',
          end: '11:00',
          ...rules,
          now: new Date(),
        }),
      ).toEqual({ closed: true, reason: 'lesson_expired' });
    });

    it('开课中（now 在开课后、结束前）→ lesson_started', () => {
      const inAnHour = new Date(Date.now() + 30 * 60 * 1000);
      const d = inAnHour.toISOString().slice(0, 10);
      const start = `${String(inAnHour.getHours()).padStart(2, '0')}:${String(inAnHour.getMinutes()).padStart(2, '0')}`;
      // now 视为开课时刻 + 5 分钟（开课中）
      const now = new Date(inAnHour.getTime() + 5 * 60 * 1000);
      expect(
        resolveTrialInviteBookingClosed({
          date: d,
          start,
          end: '23:59',
          ...rules,
          now,
        }),
      ).toEqual({ closed: true, reason: 'lesson_started' });
    });

    it('达预约截止时间（开课前 <120min）→ booking_deadline', () => {
      const in30 = new Date(Date.now() + 30 * 60 * 1000);
      const d = in30.toISOString().slice(0, 10);
      const start = `${String(in30.getHours()).padStart(2, '0')}:${String(in30.getMinutes()).padStart(2, '0')}`;
      expect(
        resolveTrialInviteBookingClosed({
          date: d,
          start,
          end: '23:59',
          ...rules,
          now: new Date(),
        }),
      ).toEqual({ closed: true, reason: 'booking_deadline' });
    });

    it('未到截止时间（开课前 >120min）→ 不关闭', () => {
      const in300 = new Date(Date.now() + 300 * 60 * 1000);
      const d = in300.toISOString().slice(0, 10);
      const start = `${String(in300.getHours()).padStart(2, '0')}:${String(in300.getMinutes()).padStart(2, '0')}`;
      expect(
        resolveTrialInviteBookingClosed({
          date: d,
          start,
          end: '23:59',
          ...rules,
          now: new Date(),
        }),
      ).toEqual({ closed: false, reason: null });
    });

    it('截止时间关闭时仍可预约（bookingDeadlineEnabled=false）', () => {
      const in30 = new Date(Date.now() + 30 * 60 * 1000);
      const d = in30.toISOString().slice(0, 10);
      const start = `${String(in30.getHours()).padStart(2, '0')}:${String(in30.getMinutes()).padStart(2, '0')}`;
      expect(
        resolveTrialInviteBookingClosed({
          date: d,
          start,
          end: '23:59',
          bookingDeadlineEnabled: false,
          bookingDeadlineMinutes: 120,
          now: new Date(),
        }),
      ).toEqual({ closed: false, reason: null });
    });
  });

  describe('登录补跑 / 预约下一步 / 登录后下一步', () => {
    it('login catchup：无法预约 / 揭示券 / noop', () => {
      const ready = {
        authLoading: false,
        paramsReady: true,
        staffBlocked: false,
        isStaff: false,
        guest: false,
        bootstrapped: true,
        loggedIn: true,
        success: false,
        claimed: false,
        showForm: false,
        showVoucher: false,
        bookingClosed: false,
      };
      expect(resolveTrialInviteLoginCatchup({ ...ready, bookingClosed: true })).toBe(
        'booking_closed',
      );
      expect(resolveTrialInviteLoginCatchup(ready)).toBe('reveal_voucher');
      expect(resolveTrialInviteLoginCatchup({ ...ready, claimed: true })).toBe('noop');
      expect(resolveTrialInviteLoginCatchup({ ...ready, showVoucher: true })).toBe('noop');
    });

    it('book next：无法预约忽略 / 需登录 / 开表单', () => {
      expect(resolveTrialInviteBookNext({ bookingClosed: true, loggedIn: true })).toBe(
        'ignore_closed',
      );
      expect(resolveTrialInviteBookNext({ bookingClosed: false, loggedIn: false })).toBe(
        'need_login',
      );
      expect(resolveTrialInviteBookNext({ bookingClosed: false, loggedIn: true })).toBe(
        'open_form',
      );
    });

    it('post-login next：无法预约 / 开表单 / 领券', () => {
      expect(
        resolveTrialInvitePostLoginNext({ bookingClosed: true, openFormAfterLogin: false }),
      ).toBe('booking_closed');
      expect(
        resolveTrialInvitePostLoginNext({ bookingClosed: false, openFormAfterLogin: true }),
      ).toBe('open_form');
      expect(
        resolveTrialInvitePostLoginNext({ bookingClosed: false, openFormAfterLogin: false }),
      ).toBe('show_voucher');
    });
  });

  describe('表单校验 / dock / 主文案', () => {
    it('validate：缺字段与非法手机号', () => {
      expect(
        validateTrialInviteForm({
          childName: '',
          childAge: '7',
          childGender: 'male',
          parentPhone: '13800138000',
        }),
      ).toBe('child_name');
      expect(
        validateTrialInviteForm({
          childName: '小明',
          childAge: '',
          childGender: 'male',
          parentPhone: '13800138000',
        }),
      ).toBe('child_age');
      expect(
        validateTrialInviteForm({
          childName: '小明',
          childAge: '7',
          childGender: '',
          parentPhone: '13800138000',
        }),
      ).toBe('child_gender');
      expect(
        validateTrialInviteForm({
          childName: '小明',
          childAge: '7',
          childGender: 'male',
          parentPhone: '123',
        }),
      ).toBe('parent_phone');
      expect(
        validateTrialInviteForm({
          childName: '小明',
          childAge: '7',
          childGender: 'female',
          parentPhone: '13800138000',
        }),
      ).toBeNull();
      expect(TRIAL_INVITE_FORM_TOAST.parent_phone).toBe('请输入正确手机号');
    });

    it('dock：未领券隐藏；无法预约有/无电话；可预约', () => {
      expect(
        resolveTrialInviteDockAction({
          claimed: false,
          bookingClosed: false,
          hasCampusPhone: true,
        }),
      ).toBe('hidden');
      expect(
        resolveTrialInviteDockAction({
          claimed: true,
          bookingClosed: true,
          hasCampusPhone: true,
        }),
      ).toBe('call_campus');
      expect(
        resolveTrialInviteDockAction({
          claimed: true,
          bookingClosed: true,
          hasCampusPhone: false,
        }),
      ).toBe('contact_teacher');
      expect(
        resolveTrialInviteDockAction({
          claimed: true,
          bookingClosed: false,
          hasCampusPhone: false,
        }),
      ).toBe('book_now');
    });

    it('main copy：无法预约(三种原因) / 已领券 / 待领券', () => {
      const expired = resolveTrialInviteMainCopy({
        bookingClosedReason: 'lesson_expired',
        claimed: true,
        isGroupBook: false,
        teacherName: '王老师',
        campusPhone: '10086',
      });
      expect(expired.title).toBe('本场课程已结束');
      expect(expired.subtitle).toContain('王老师');
      expect(expired.subtitle).toContain('电话联系校区');

      const started = resolveTrialInviteMainCopy({
        bookingClosedReason: 'lesson_started',
        claimed: true,
        isGroupBook: false,
        teacherName: '王老师',
      });
      expect(started.title).toBe('本场试听已开始');

      const deadline = resolveTrialInviteMainCopy({
        bookingClosedReason: 'booking_deadline',
        claimed: true,
        isGroupBook: false,
        teacherName: '',
      });
      expect(deadline.title).toBe('已超过预约截止时间');

      const claimed = resolveTrialInviteMainCopy({
        bookingClosedReason: null,
        claimed: true,
        isGroupBook: true,
        teacherName: '',
      });
      expect(claimed.title).toBe('预约本场团课');

      const pending = resolveTrialInviteMainCopy({
        bookingClosedReason: null,
        claimed: false,
        isGroupBook: false,
        teacherName: '',
      });
      expect(pending.title).toBe('领取试听券后可预约');
    });
  });
});
