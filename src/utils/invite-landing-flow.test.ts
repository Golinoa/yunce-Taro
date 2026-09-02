import { describe, expect, it } from 'vitest';
import {
  TRIAL_INVITE_FORM_TOAST,
  resolveTrialInviteAccess,
  resolveTrialInviteBookNext,
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

  describe('bootstrap：登录门 / 已预约 / 过期', () => {
    const base = {
      authLoading: false,
      paramsReady: true,
      staffBlocked: false,
      isStaff: false,
      guest: false,
      bootstrapped: false,
      loggedIn: true,
      hasSuccessRecord: false,
      lessonExpired: false,
    };

    it('未登录 → login_required', () => {
      expect(resolveTrialInviteBootstrap({ ...base, loggedIn: false })).toBe('login_required');
    });

    it('已预约成功记录 → restore_success（已绑定本场）', () => {
      expect(resolveTrialInviteBootstrap({ ...base, hasSuccessRecord: true })).toBe(
        'restore_success',
      );
    });

    it('场次过期 → lesson_expired', () => {
      expect(resolveTrialInviteBootstrap({ ...base, lessonExpired: true })).toBe('lesson_expired');
    });

    it('正常 → ready；已 boot / staffBlocked → wait', () => {
      expect(resolveTrialInviteBootstrap(base)).toBe('ready');
      expect(resolveTrialInviteBootstrap({ ...base, bootstrapped: true })).toBe('wait');
      expect(resolveTrialInviteBootstrap({ ...base, staffBlocked: true })).toBe('wait');
      expect(resolveTrialInviteBootstrap({ ...base, isStaff: true, guest: false })).toBe('wait');
    });
  });

  describe('登录补跑 / 预约下一步 / 登录后下一步', () => {
    it('login catchup：过期 / 揭示券 / noop', () => {
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
        lessonExpired: false,
      };
      expect(resolveTrialInviteLoginCatchup({ ...ready, lessonExpired: true })).toBe(
        'lesson_expired',
      );
      expect(resolveTrialInviteLoginCatchup(ready)).toBe('reveal_voucher');
      expect(resolveTrialInviteLoginCatchup({ ...ready, claimed: true })).toBe('noop');
      expect(resolveTrialInviteLoginCatchup({ ...ready, showVoucher: true })).toBe('noop');
    });

    it('book next：过期忽略 / 需登录 / 开表单', () => {
      expect(resolveTrialInviteBookNext({ lessonExpired: true, loggedIn: true })).toBe(
        'ignore_expired',
      );
      expect(resolveTrialInviteBookNext({ lessonExpired: false, loggedIn: false })).toBe(
        'need_login',
      );
      expect(resolveTrialInviteBookNext({ lessonExpired: false, loggedIn: true })).toBe(
        'open_form',
      );
    });

    it('post-login next：过期 / 开表单 / 领券', () => {
      expect(
        resolveTrialInvitePostLoginNext({ lessonExpired: true, openFormAfterLogin: false }),
      ).toBe('lesson_expired');
      expect(
        resolveTrialInvitePostLoginNext({ lessonExpired: false, openFormAfterLogin: true }),
      ).toBe('open_form');
      expect(
        resolveTrialInvitePostLoginNext({ lessonExpired: false, openFormAfterLogin: false }),
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

    it('dock：未领券隐藏；过期有/无电话；可预约', () => {
      expect(
        resolveTrialInviteDockAction({
          claimed: false,
          lessonExpired: false,
          hasCampusPhone: true,
        }),
      ).toBe('hidden');
      expect(
        resolveTrialInviteDockAction({
          claimed: true,
          lessonExpired: true,
          hasCampusPhone: true,
        }),
      ).toBe('call_campus');
      expect(
        resolveTrialInviteDockAction({
          claimed: true,
          lessonExpired: true,
          hasCampusPhone: false,
        }),
      ).toBe('contact_teacher');
      expect(
        resolveTrialInviteDockAction({
          claimed: true,
          lessonExpired: false,
          hasCampusPhone: false,
        }),
      ).toBe('book_now');
    });

    it('main copy：过期 / 已领券 / 待领券', () => {
      const expired = resolveTrialInviteMainCopy({
        lessonExpired: true,
        claimed: true,
        isGroupBook: false,
        teacherName: '王老师',
        campusPhone: '10086',
      });
      expect(expired.title).toBe('本场课程已结束');
      expect(expired.subtitle).toContain('王老师');
      expect(expired.subtitle).toContain('电话联系校区');

      const claimed = resolveTrialInviteMainCopy({
        lessonExpired: false,
        claimed: true,
        isGroupBook: true,
        teacherName: '',
      });
      expect(claimed.title).toBe('预约本场团课');

      const pending = resolveTrialInviteMainCopy({
        lessonExpired: false,
        claimed: false,
        isGroupBook: false,
        teacherName: '',
      });
      expect(pending.title).toBe('领取试听券后可预约');
    });
  });
});
