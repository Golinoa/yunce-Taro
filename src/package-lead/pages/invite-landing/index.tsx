/**
 * 家长邀约落地页 package-lead/pages/invite-landing
 *
 * 须先微信登录再查看内容（不引导绑定邮箱）。
 * 未过期：试听券 → 填表预约 → 成功页。
 * 已过期：提示联系老师另约；上报访问，半小时后站内提醒老师一次（含查看次数）。
 */
import { View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { campusService, leadService, teacherService } from '@/services';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useAgreementStore } from '@/stores/agreement';
import type { CampusUIModel } from '@/types/campus';
import { isStaffRole, useAuth } from '@/utils/auth';
import { clearIdentitySelectionPending, markOnboardingSkipped } from '@/utils/auth-onboarding';
import { getCampusOpenStatus, parseBusinessHours } from '@/utils/campus';
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
} from '@/utils/invite-landing-flow';
import {
  formatInviteLandingDateLabel,
  formatInviteLandingTimeLabel,
  genderLabelOf,
  hasInviteLandingLessonContext,
  isInviteLandingGroupBook,
  parseInviteLandingParams,
  resolveInviteLandingCourseTitle,
  type InviteLandingChildGender,
  type InviteLandingParams,
} from '@/utils/invite-landing-params';
import {
  buildInviteLessonKey,
  findInviteLandingSuccess,
  saveInviteLandingSuccess,
} from '@/utils/invite-landing-success';
import {
  resolveTrialInviteLandingScreen,
  resolveTrialInviteNeedLoginGate,
} from '@/utils/invite-landing-view-state';
import { isInviteLessonExpired } from '@/utils/invite-lesson-expired';
import { getOrCreateInviteVisitorKey } from '@/utils/invite-visitor-key';
import { logError } from '@/utils/logger';
import { ensurePrivacyBeforeAuth, promptPrivacySyncInHandler } from '@/utils/privacy-authorize';
import { useMiniProgramNavBarLayout } from '@/utils/use-nav-safe-height';
import {
  InviteLandingLoginGate,
  InviteLandingMainView,
  InviteLandingSuccessView,
} from './invite-landing-views';
import './index.scss';

const InviteLandingPage: React.FC = () => {
  const { profile, session, signInWithWechat, currentRole, loading: authLoading } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();
  const { statusBarHeight, navBarHeight } = useMiniProgramNavBarLayout();
  const homeBtnTop = statusBarHeight + Math.max((navBarHeight - 32) / 2, 4);

  const [params, setParams] = useState<InviteLandingParams>({ t: '', c: '' });
  const [paramsReady, setParamsReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [staffBlocked, setStaffBlocked] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showVoucher, setShowVoucher] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wechatSubmitting, setWechatSubmitting] = useState(false);

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childGender, setChildGender] = useState<InviteLandingChildGender | ''>('');
  const [parentPhone, setParentPhone] = useState('');

  const [campus, setCampus] = useState<CampusUIModel | null>(null);
  const [teacherName, setTeacherName] = useState('');

  const subscribedRef = useRef(false);
  const openFormAfterLoginRef = useRef(false);
  const visitReportedRef = useRef(false);
  const visitorKeyRef = useRef(getOrCreateInviteVisitorKey());
  const staffRedirectedRef = useRef(false);

  useLoad((options) => {
    const next = parseInviteLandingParams(options as Record<string, string | undefined>);
    setParams(next);
    setGuestMode(Boolean(next.guest));
    setParamsReady(true);
  });

  const lessonKey = useMemo(
    () =>
      buildInviteLessonKey({
        type: params.type,
        teacherId: params.t,
        campusId: params.c,
        classId: params.classId,
        scheduleId: params.scheduleId,
        slotId: params.slotId,
        date: params.date,
        start: params.start,
        end: params.end,
      }),
    [params],
  );

  const isStaff = isStaffRole(currentRole);
  const lessonExpired = useMemo(
    () => isInviteLessonExpired(params.date, params.end),
    [params.date, params.end],
  );

  /** 机构端不可访问家长邀约落地（guest=1 仅用于 Mock 强制访客演示） */
  useEffect(() => {
    const access = resolveTrialInviteAccess({
      authLoading,
      paramsReady,
      isStaff,
      guest: Boolean(params.guest),
    });
    if (access === 'wait') return;
    if (access !== 'staff_blocked') return;
    setStaffBlocked(true);
    setBootstrapped(true);
    if (staffRedirectedRef.current) return;
    staffRedirectedRef.current = true;
    void Taro.showToast({ title: '该页面仅家长可访问', icon: 'none' });
    setTimeout(() => {
      void Taro.switchTab({ url: '/pages/home/index' }).catch(() => {
        void Taro.reLaunch({ url: '/pages/home/index' });
      });
    }, 400);
  }, [authLoading, isStaff, params.guest, paramsReady]);

  /** 已登录后才进入内容；已预约直接成功页；过期跳过领券 */
  useEffect(() => {
    const phase = resolveTrialInviteBootstrap({
      authLoading,
      paramsReady,
      staffBlocked,
      isStaff,
      guest: Boolean(params.guest),
      bootstrapped,
      loggedIn: Boolean(session) && !params.guest,
      hasSuccessRecord: Boolean(
        findInviteLandingSuccess({
          lessonKey,
          visitorKey: visitorKeyRef.current,
          parentUserId: session?.user.id,
        }),
      ),
      lessonExpired,
    });

    if (phase === 'wait') return;

    if (phase === 'login_required') {
      setShowLogin(true);
      setShowVoucher(false);
      setBootstrapped(true);
      return;
    }

    if (phase === 'restore_success') {
      const record = findInviteLandingSuccess({
        lessonKey,
        visitorKey: visitorKeyRef.current,
        parentUserId: session?.user.id,
      });
      if (record) {
        setChildName(record.childName);
        setChildAge(record.childAge);
        setChildGender(
          record.childGender === 'male' || record.childGender === 'female'
            ? record.childGender
            : '',
        );
        setParentPhone(record.parentPhone);
      }
      setClaimed(true);
      setShowVoucher(false);
      setShowLogin(false);
      setSuccess(true);
      setBootstrapped(true);
      return;
    }

    if (phase === 'lesson_expired') {
      setShowVoucher(false);
      setShowLogin(false);
      setClaimed(true);
      setBootstrapped(true);
      return;
    }

    setShowLogin(false);
    setBootstrapped(true);
  }, [
    authLoading,
    bootstrapped,
    isStaff,
    lessonExpired,
    lessonKey,
    params.guest,
    paramsReady,
    session,
    staffBlocked,
  ]);

  /** 登录成功后若尚未进入主流程，补一次 bootstrap */
  useEffect(() => {
    const catchup = resolveTrialInviteLoginCatchup({
      authLoading,
      paramsReady,
      staffBlocked,
      isStaff,
      guest: Boolean(params.guest),
      bootstrapped,
      loggedIn: Boolean(session) && !guestMode,
      success,
      claimed,
      showForm,
      showVoucher,
      lessonExpired,
    });
    if (catchup === 'lesson_expired') {
      setShowVoucher(false);
      setClaimed(true);
      setShowLogin(false);
      return;
    }
    if (catchup === 'reveal_voucher') {
      setShowVoucher(true);
      setShowLogin(false);
    }
  }, [
    authLoading,
    bootstrapped,
    claimed,
    guestMode,
    isStaff,
    lessonExpired,
    params.guest,
    paramsReady,
    session,
    showForm,
    showVoucher,
    staffBlocked,
    success,
  ]);

  useEffect(() => {
    if (!params.c) return;
    void campusService.getById(params.c).then((item) => {
      if (item) setCampus(item);
    });
  }, [params.c]);

  useEffect(() => {
    if (!params.t) return;
    void teacherService.getById(params.t).then((teacher) => {
      if (teacher?.name) setTeacherName(teacher.name);
    });
  }, [params.t]);

  /** 已登录后上报访问；过期场次附带半小时站内提醒登记 */
  useEffect(() => {
    if (!bootstrapped || staffBlocked || success) return;
    if (!params.t || !params.c) return;
    const loggedIn = Boolean(session?.user.id) && !guestMode;
    if (!loggedIn) return;
    if (visitReportedRef.current) return;
    visitReportedRef.current = true;
    void leadService
      .trackLandingVisit({
        teacherId: params.t,
        campusId: params.c,
        sourceType: params.st || 'share_link',
        parentUserId: session?.user.id,
        visitorKey: visitorKeyRef.current,
        lessonExpired,
        lessonKey: lessonExpired ? lessonKey : undefined,
        className: params.className,
        date: params.date,
        start: params.start,
        end: params.end,
      })
      .catch((err) => logError('invite-landing.trackVisit', err));
  }, [
    bootstrapped,
    guestMode,
    lessonExpired,
    lessonKey,
    params.c,
    params.className,
    params.date,
    params.end,
    params.st,
    params.start,
    params.t,
    session?.user.id,
    staffBlocked,
    success,
  ]);

  const isLoggedIn = Boolean(session) && !guestMode;
  const isGroupBook = isInviteLandingGroupBook(params.type);
  const hasLessonContext = hasInviteLandingLessonContext(params);

  const businessTime = useMemo(() => {
    const parsed = parseBusinessHours(campus?.businessHours);
    if (!parsed) return campus?.businessHours || '';
    return `${parsed.start}-${parsed.end}`;
  }, [campus?.businessHours]);

  const campusOpenStatus = useMemo(
    () => getCampusOpenStatus(campus?.businessHours),
    [campus?.businessHours],
  );

  const courseTitle = resolveInviteLandingCourseTitle(params);
  const dateLabel = formatInviteLandingDateLabel(params.date);
  const timeLabel = formatInviteLandingTimeLabel(params.start, params.end);
  const genderLabel = genderLabelOf(childGender);
  const needLoginGate = resolveTrialInviteNeedLoginGate({
    bootstrapped,
    guestMode,
    hasSession: Boolean(session),
    staffBlocked,
    success,
  });
  const screen = resolveTrialInviteLandingScreen({
    bootstrapped,
    authLoading,
    staffBlocked,
    needLoginGate,
    success,
  });
  const mainCopy = resolveTrialInviteMainCopy({
    lessonExpired,
    claimed,
    isGroupBook,
    teacherName,
    campusPhone: campus?.phone,
  });
  const dockAction = resolveTrialInviteDockAction({
    claimed,
    lessonExpired,
    hasCampusPhone: Boolean(campus?.phone),
  });

  const ensureSubscribe = useCallback(async () => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;
    try {
      await subscribeMessageService.requestAuthAndReport(
        ['schedule_change', 'class_remind', 'lesson_result'],
        isGroupBook ? 'group_booking_invite' : 'trial_booking_invite',
        { campusId: params.c },
      );
    } catch (err) {
      logError('invite-landing.subscribe', err);
    }
  }, [isGroupBook, params.c]);

  const handleClaim = useCallback(() => {
    setShowVoucher(false);
    setClaimed(true);
  }, []);

  const openBookingForm = useCallback(async () => {
    await ensureSubscribe();
    if (profile?.phone) setParentPhone(profile.phone);
    setShowForm(true);
  }, [ensureSubscribe, profile?.phone]);

  const handleBookClick = useCallback(() => {
    const next = resolveTrialInviteBookNext({ lessonExpired, loggedIn: isLoggedIn });
    if (next === 'ignore_expired') return;
    if (next === 'need_login') {
      openFormAfterLoginRef.current = true;
      setShowLogin(true);
      return;
    }
    void openBookingForm();
  }, [isLoggedIn, lessonExpired, openBookingForm]);

  const executeWechatLogin = useCallback(async () => {
    if (wechatSubmitting) return;
    setWechatSubmitting(true);
    try {
      const privacyOk = await ensurePrivacyBeforeAuth();
      if (!privacyOk) return;

      const { error } = await signInWithWechat();
      if (error) {
        Taro.showToast({ title: error.message || '微信登录失败', icon: 'none' });
        return;
      }
      // 邀约落地：只做微信登录，不引导绑定邮箱 / 身份选择，避免流失
      markOnboardingSkipped();
      clearIdentitySelectionPending();
      setGuestMode(false);
      setShowLogin(false);
      Taro.showToast({ title: '登录成功', icon: 'success' });
      visitReportedRef.current = false;

      const postLogin = resolveTrialInvitePostLoginNext({
        lessonExpired: isInviteLessonExpired(params.date, params.end),
        openFormAfterLogin: openFormAfterLoginRef.current,
      });
      if (postLogin === 'lesson_expired') {
        setShowVoucher(false);
        setClaimed(true);
        return;
      }
      if (postLogin === 'open_form') {
        openFormAfterLoginRef.current = false;
        setShowVoucher(false);
        setClaimed(true);
        await openBookingForm();
        return;
      }
      setShowVoucher(true);
      await ensureSubscribe();
    } catch (err) {
      logError('invite-landing.wechatLogin', err);
      Taro.showToast({ title: '微信登录失败', icon: 'none' });
    } finally {
      setWechatSubmitting(false);
    }
  }, [
    ensureSubscribe,
    openBookingForm,
    params.date,
    params.end,
    signInWithWechat,
    wechatSubmitting,
  ]);

  const handleWechatLogin = useCallback(() => {
    if (wechatSubmitting) return;
    if (!agreed) {
      void Taro.showModal({
        title: '用户协议',
        content: '请阅读并同意《用户协议》',
        confirmText: '同意并登录',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) return;
          setAgreed(true);
          // ★ showModal「同意」回调仍在用户手势内，同步栈触发微信原生隐私授权
          promptPrivacySyncInHandler(() => {
            void executeWechatLogin();
          });
        },
      });
      return;
    }
    // ★ 登录按钮同步栈内触发微信原生隐私授权
    promptPrivacySyncInHandler(() => {
      void executeWechatLogin();
    });
  }, [agreed, executeWechatLogin, setAgreed, wechatSubmitting]);

  const persistSuccess = useCallback(
    (payload: {
      childName: string;
      childAge: string;
      childGender: InviteLandingChildGender | '';
      parentPhone: string;
    }) => {
      saveInviteLandingSuccess({
        lessonKey,
        visitorKey: visitorKeyRef.current,
        parentUserId: session?.user.id,
        childName: payload.childName,
        childAge: payload.childAge,
        childGender: payload.childGender,
        parentPhone: payload.parentPhone,
        courseTitle,
        date: params.date,
        start: params.start,
        end: params.end,
        type: params.type,
        campusId: params.c,
        teacherId: params.t,
        bookedAt: dayjs().toISOString(),
      });
    },
    [
      courseTitle,
      lessonKey,
      params.c,
      params.date,
      params.end,
      params.start,
      params.t,
      params.type,
      session?.user.id,
    ],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting || lessonExpired) return;
    const field = validateTrialInviteForm({
      childName,
      childAge,
      childGender,
      parentPhone,
    });
    if (field) {
      Taro.showToast({ title: TRIAL_INVITE_FORM_TOAST[field], icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await leadService.submitInviteLanding({
        teacherId: params.t,
        campusId: params.c,
        sourceType: params.st || 'share_link',
        childName: childName.trim(),
        childGender: childGender as InviteLandingChildGender,
        childAge: `${childAge.trim()}岁`,
        parentName: profile?.name || undefined,
        parentPhone: parentPhone.trim(),
        parentUserId: session?.user.id,
        visitorKey: visitorKeyRef.current,
        sourceCourseId: params.course || params.classId,
        type: params.type,
        classId: params.classId,
        className: params.className,
        scheduleId: params.scheduleId,
        slotId: params.slotId,
        date: params.date,
        start: params.start,
        end: params.end,
        bookLesson: hasLessonContext,
      });

      if (!hasLessonContext && result.lead_id && !result.booked) {
        Taro.navigateTo({
          url: `/package-lead/pages/trial-booking/index?teacherId=${encodeURIComponent(params.t)}&campusId=${encodeURIComponent(params.c)}&leadId=${encodeURIComponent(result.lead_id)}&mode=${isGroupBook ? 'group' : 'private'}`,
        });
        return;
      }

      persistSuccess({
        childName: childName.trim(),
        childAge: childAge.trim(),
        childGender,
        parentPhone: parentPhone.trim(),
      });
      setShowForm(false);
      setSuccess(true);
    } catch (err) {
      logError('invite-landing.submit', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    childAge,
    childGender,
    childName,
    hasLessonContext,
    isGroupBook,
    lessonExpired,
    params,
    parentPhone,
    persistSuccess,
    profile?.name,
    session?.user.id,
    submitting,
  ]);

  const handleOpenLocation = useCallback(() => {
    if (!campus?.latitude || !campus?.longitude) {
      Taro.showToast({ title: '暂无定位信息', icon: 'none' });
      return;
    }
    void Taro.openLocation({
      latitude: campus.latitude,
      longitude: campus.longitude,
      name: campus.locationName || campus.name,
      address: campus.address,
      fail: () => Taro.showToast({ title: '无法打开地图', icon: 'none' }),
    });
  }, [campus]);

  const handleCallPhone = useCallback(() => {
    if (!campus?.phone) {
      Taro.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }
    void Taro.makePhoneCall({
      phoneNumber: campus.phone,
      fail: () => Taro.showToast({ title: '拨打电话失败', icon: 'none' }),
    });
  }, [campus?.phone]);

  const handleDone = useCallback(() => {
    void Taro.switchTab({ url: '/pages/home/index' }).catch(() => {
      void Taro.reLaunch({ url: '/pages/home/index' });
    });
  }, []);

  if (screen === 'boot' || screen === 'staff_blocked') {
    return (
      <PageContainer className="invite-landing">
        <View className="center min-h-screen">
          <Loading text={screen === 'staff_blocked' ? '仅家长可访问...' : '加载中...'} />
        </View>
      </PageContainer>
    );
  }

  if (screen === 'login_gate') {
    return (
      <PageContainer className="invite-landing">
        <InviteLandingLoginGate
          statusBarHeight={statusBarHeight}
          navBarHeight={navBarHeight}
          wechatSubmitting={wechatSubmitting}
          onWechatLogin={handleWechatLogin}
        />
      </PageContainer>
    );
  }

  if (screen === 'success') {
    return (
      <PageContainer className="invite-landing">
        <InviteLandingSuccessView
          homeBtnTop={homeBtnTop}
          campus={campus}
          campusOpenStatus={campusOpenStatus}
          businessTime={businessTime}
          courseTitle={courseTitle}
          childName={childName}
          childAge={childAge}
          genderLabel={genderLabel}
          dateLabel={dateLabel}
          start={params.start}
          isGroupBook={isGroupBook}
          onDone={handleDone}
          onOpenLocation={handleOpenLocation}
          onCallPhone={handleCallPhone}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="invite-landing">
      <InviteLandingMainView
        statusBarHeight={statusBarHeight}
        navBarHeight={navBarHeight}
        campus={campus}
        teacherName={teacherName}
        courseTitle={courseTitle}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        isGroupBook={isGroupBook}
        isLoggedIn={isLoggedIn}
        lessonExpired={lessonExpired}
        claimed={claimed}
        showVoucher={showVoucher}
        showLogin={showLogin}
        showForm={showForm}
        needLoginGate={needLoginGate}
        wechatSubmitting={wechatSubmitting}
        submitting={submitting}
        mainCopy={mainCopy}
        dockAction={dockAction}
        childName={childName}
        childAge={childAge}
        childGender={childGender}
        parentPhone={parentPhone}
        onClaim={handleClaim}
        onBookClick={handleBookClick}
        onCallPhone={handleCallPhone}
        onWechatLogin={handleWechatLogin}
        onSubmit={() => void handleSubmit()}
        onCancelForm={() => setShowForm(false)}
        onChildName={setChildName}
        onChildAge={setChildAge}
        onChildGender={setChildGender}
        onParentPhone={setParentPhone}
      />
    </PageContainer>
  );
};

export default InviteLandingPage;
