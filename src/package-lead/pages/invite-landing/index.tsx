/**
 * 家长邀约落地页 package-lead/pages/invite-landing
 *
 * 须先微信登录再查看内容（不引导绑定邮箱）。
 * 未过期：试听券 → 填表预约 → 成功页。
 * 已过期：提示联系老师另约；上报访问，半小时后站内提醒老师一次（含查看次数）。
 */
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { BRAND_LOGO, ORG_COVER_IMAGE } from '@/constants/brand';
import { campusService, leadService, teacherService } from '@/services';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useAgreementStore } from '@/stores/agreement';
import type { CampusUIModel } from '@/types/campus';
import { isStaffRole, useAuth } from '@/utils/auth';
import {
  clearIdentitySelectionPending,
  markOnboardingSkipped,
} from '@/utils/auth-onboarding';
import { isCampusOpen, parseBusinessHours } from '@/utils/campus';
import {
  buildInviteLessonKey,
  findInviteLandingSuccess,
  saveInviteLandingSuccess,
} from '@/utils/invite-landing-success';
import { isInviteLessonExpired } from '@/utils/invite-lesson-expired';
import { getOrCreateInviteVisitorKey } from '@/utils/invite-visitor-key';
import { logError } from '@/utils/logger';
import { useMiniProgramNavBarLayout } from '@/utils/use-nav-safe-height';
import './index.scss';

interface LandingParams {
  t: string;
  c: string;
  course?: string;
  st?: 'share_link' | 'qr';
  type?: 'class_lesson' | 'group_slot';
  classId?: string;
  className?: string;
  scheduleId?: string;
  slotId?: string;
  date?: string;
  start?: string;
  end?: string;
  guest?: boolean;
}

type ChildGender = 'male' | 'female';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function decodeParam(raw?: string): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function formatDateLabel(date?: string): string {
  if (!date) return '';
  const d = dayjs(date);
  if (!d.isValid()) return date;
  return `${d.format('M月D日')} ${WEEKDAY_LABELS[d.day()]}`;
}

const InviteLandingPage: React.FC = () => {
  const { profile, session, signInWithWechat, currentRole, loading: authLoading } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();
  const { statusBarHeight, navBarHeight } = useMiniProgramNavBarLayout();
  const homeBtnTop = statusBarHeight + Math.max((navBarHeight - 32) / 2, 4);

  const [params, setParams] = useState<LandingParams>({ t: '', c: '' });
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
  const [childGender, setChildGender] = useState<ChildGender | ''>('');
  const [parentPhone, setParentPhone] = useState('');

  const [campus, setCampus] = useState<CampusUIModel | null>(null);
  const [teacherName, setTeacherName] = useState('');

  const subscribedRef = useRef(false);
  const openFormAfterLoginRef = useRef(false);
  const visitReportedRef = useRef(false);
  const visitorKeyRef = useRef(getOrCreateInviteVisitorKey());
  const staffRedirectedRef = useRef(false);

  useLoad((options) => {
    const opt = options as Record<string, string>;
    const typeRaw = opt.type || '';
    const next: LandingParams = {
      t: decodeParam(opt.t),
      c: decodeParam(opt.c),
      course: decodeParam(opt.course || opt.classId),
      st: opt.st === 'qr' ? 'qr' : 'share_link',
      type: typeRaw === 'group_slot' ? 'group_slot' : typeRaw === 'class_lesson' ? 'class_lesson' : undefined,
      classId: decodeParam(opt.classId || opt.course),
      className: decodeParam(opt.className),
      scheduleId: decodeParam(opt.scheduleId),
      slotId: decodeParam(opt.slotId),
      date: decodeParam(opt.date),
      start: decodeParam(opt.start),
      end: decodeParam(opt.end),
      guest: opt.guest === '1' || opt.guest === 'true',
    };
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

  /** 机构端不可访问家长邀约落地（guest=1 仅用于 Mock 强制访客演示） */
  useEffect(() => {
    if (authLoading || !paramsReady) return;
    if (!isStaffRole(currentRole) || params.guest) return;
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
  }, [authLoading, currentRole, params.guest, paramsReady]);

  /** 已登录后才进入内容；已预约直接成功页；过期跳过领券 */
  useEffect(() => {
    if (authLoading || !paramsReady || staffBlocked) return;
    if (isStaffRole(currentRole) && !params.guest) return;
    if (bootstrapped) return;

    const loggedIn = Boolean(session) && !params.guest;
    if (!loggedIn && !params.guest) {
      setShowLogin(true);
      setShowVoucher(false);
      setBootstrapped(true);
      return;
    }

    const record = findInviteLandingSuccess({
      lessonKey,
      visitorKey: visitorKeyRef.current,
      parentUserId: session?.user.id,
    });
    if (record) {
      setChildName(record.childName);
      setChildAge(record.childAge);
      setChildGender(record.childGender === 'male' || record.childGender === 'female' ? record.childGender : '');
      setParentPhone(record.parentPhone);
      setClaimed(true);
      setShowVoucher(false);
      setShowLogin(false);
      setSuccess(true);
    } else if (isInviteLessonExpired(params.date, params.end)) {
      setShowVoucher(false);
      setShowLogin(false);
      setClaimed(true);
    } else {
      setShowLogin(false);
    }
    setBootstrapped(true);
  }, [
    authLoading,
    bootstrapped,
    currentRole,
    lessonKey,
    params.date,
    params.end,
    params.guest,
    paramsReady,
    session,
    staffBlocked,
  ]);

  /** 登录成功后若尚未进入主流程，补一次 bootstrap */
  useEffect(() => {
    if (authLoading || !paramsReady || staffBlocked || !bootstrapped) return;
    if (isStaffRole(currentRole) && !params.guest) return;
    if (!session || guestMode) return;
    if (success || claimed || showForm) return;
    if (isInviteLessonExpired(params.date, params.end)) {
      setShowVoucher(false);
      setClaimed(true);
      setShowLogin(false);
      return;
    }
    if (!showVoucher && !claimed) {
      setShowVoucher(true);
      setShowLogin(false);
    }
  }, [
    authLoading,
    bootstrapped,
    claimed,
    currentRole,
    guestMode,
    params.date,
    params.end,
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
    const expired = isInviteLessonExpired(params.date, params.end);
    void leadService
      .trackLandingVisit({
        teacherId: params.t,
        campusId: params.c,
        sourceType: params.st || 'share_link',
        parentUserId: session?.user.id,
        visitorKey: visitorKeyRef.current,
        lessonExpired: expired,
        lessonKey: expired ? lessonKey : undefined,
        className: params.className,
        date: params.date,
        start: params.start,
        end: params.end,
      })
      .catch((err) => logError('invite-landing.trackVisit', err));
  }, [
    bootstrapped,
    guestMode,
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
  const isGroupBook = params.type === 'group_slot';
  const hasLessonContext = Boolean(params.classId && params.date && params.start && params.end);
  const lessonExpired = useMemo(
    () => isInviteLessonExpired(params.date, params.end),
    [params.date, params.end],
  );

  const businessTime = useMemo(() => {
    const parsed = parseBusinessHours(campus?.businessHours);
    if (!parsed) return campus?.businessHours || '';
    return `${parsed.start}-${parsed.end}`;
  }, [campus?.businessHours]);

  const campusOpen = useMemo(() => isCampusOpen(campus?.businessHours), [campus?.businessHours]);

  const courseTitle = params.className || (isGroupBook ? '团课' : '班课试听');
  const dateLabel = formatDateLabel(params.date);
  const timeLabel =
    params.start && params.end ? `${params.start}–${params.end}` : '';

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
    if (lessonExpired) return;
    if (!isLoggedIn) {
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
      const { code: wxCode } = await Taro.login();
      if (!wxCode) {
        Taro.showToast({ title: '微信授权失败，请重试', icon: 'none' });
        return;
      }
      const { error } = await signInWithWechat(wxCode);
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

      if (isInviteLessonExpired(params.date, params.end)) {
        setShowVoucher(false);
        setClaimed(true);
        return;
      }

      if (openFormAfterLoginRef.current) {
        openFormAfterLoginRef.current = false;
        setShowVoucher(false);
        setClaimed(true);
        await openBookingForm();
      } else {
        setShowVoucher(true);
        await ensureSubscribe();
      }
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
          void executeWechatLogin();
        },
      });
      return;
    }
    void executeWechatLogin();
  }, [agreed, executeWechatLogin, setAgreed, wechatSubmitting]);

  const persistSuccess = useCallback(
    (payload: {
      childName: string;
      childAge: string;
      childGender: ChildGender | '';
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
    [courseTitle, lessonKey, params.c, params.date, params.end, params.start, params.t, params.type, session?.user.id],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting || lessonExpired) return;
    if (!childName.trim()) {
      Taro.showToast({ title: '请输入孩子姓名', icon: 'none' });
      return;
    }
    if (!childAge.trim()) {
      Taro.showToast({ title: '请填写年龄', icon: 'none' });
      return;
    }
    if (!childGender) {
      Taro.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(parentPhone.trim())) {
      Taro.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await leadService.submitInviteLanding({
        teacherId: params.t,
        campusId: params.c,
        sourceType: params.st || 'share_link',
        childName: childName.trim(),
        childGender,
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

  const genderLabel = childGender === 'male' ? '男' : childGender === 'female' ? '女' : '';
  const needLoginGate = bootstrapped && !guestMode && !session && !staffBlocked && !success;

  if (!bootstrapped || authLoading || staffBlocked) {
    return (
      <PageContainer className="invite-landing">
        <View className="center min-h-screen">
          <Loading text={staffBlocked ? '仅家长可访问...' : '加载中...'} />
        </View>
      </PageContainer>
    );
  }

  /* ---------- 须先微信登录 ---------- */
  if (needLoginGate) {
    return (
      <PageContainer className="invite-landing">
        <View
          className="invite-b-bg center min-h-screen px-[48rpx]"
          style={{ paddingTop: `${statusBarHeight + navBarHeight}px` }}
        >
          <View className="w-full max-w-[600rpx] rounded-[32rpx] bg-card px-[36rpx] py-[48rpx] shadow-card">
            <View className="mb-[28rpx] flex flex-col items-center">
              <Image src={BRAND_LOGO} className="mb-[20rpx] h-[88rpx] w-[88rpx]" mode="aspectFit" />
              <Text className="text-[34rpx] font-bold text-foreground">老师邀请你预约试听</Text>
              <Text className="mt-[12rpx] text-center text-[26rpx] leading-relaxed text-muted-foreground">
                请先微信登录后查看课程详情。仅需微信授权，无需绑定邮箱。
              </Text>
            </View>
            <View
              className={cn(
                'center h-[96rpx] rounded-[28rpx] bg-gradient-wechat shadow-wechat-btn active:opacity-90',
                wechatSubmitting && 'opacity-60',
              )}
              onClick={handleWechatLogin}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {wechatSubmitting ? '登录中...' : '微信一键登录'}
              </Text>
            </View>
          </View>
        </View>
      </PageContainer>
    );
  }

  /* ---------- 预约成功页 ---------- */
  if (success) {
    return (
      <PageContainer className="invite-landing">
        <View
          className="invite-home-btn"
          style={{ top: `${homeBtnTop}px` }}
          onClick={handleDone}
        >
          <Icon name="mdi-home" size={36} color="foreground" />
        </View>

        <ScrollView scrollY className="h-screen" showScrollbar={false}>
          <View className="invite-success-banner relative h-[340rpx] overflow-hidden">
            <Image
              src={ORG_COVER_IMAGE}
              className="absolute inset-0 h-full w-full"
              mode="aspectFill"
            />
            <View className="absolute inset-0 bg-black/30" />
          </View>

          <View className="relative z-[3] -mt-[80rpx] mx-[28rpx] rounded-[32rpx] bg-card p-[28rpx] shadow-campus">
            <View className="flex items-start gap-[20rpx]">
              <View
                className="h-[96rpx] w-[96rpx] shrink-0 overflow-hidden rounded-[24rpx]"
                style={{
                  background: campus?.iconGradient || 'linear-gradient(135deg, #5EC8A8, #4AB893)',
                }}
              >
                {campus?.logo ? (
                  <Image src={campus.logo} className="h-full w-full" mode="aspectFill" />
                ) : (
                  <View className="center h-full w-full">
                    <Image src={BRAND_LOGO} className="h-[72rpx] w-[72rpx]" mode="aspectFit" />
                  </View>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex flex-wrap items-center gap-[12rpx]">
                  <Text className="text-[34rpx] font-bold text-foreground">
                    {campus?.name || '校区'}
                  </Text>
                  <View
                    className={cn(
                      'flex items-center gap-[6rpx] rounded-[10rpx] px-[12rpx] py-[4rpx]',
                      campusOpen ? 'bg-success-bg' : 'bg-muted',
                    )}
                  >
                    <View
                      className={cn(
                        'h-[12rpx] w-[12rpx] rounded-full',
                        campusOpen ? 'bg-success' : 'bg-muted-foreground',
                      )}
                    />
                    <Text
                      className={cn(
                        'text-[22rpx] font-medium',
                        campusOpen ? 'text-success' : 'text-muted-foreground',
                      )}
                    >
                      {campusOpen ? '营业中' : '休息中'}
                    </Text>
                  </View>
                </View>
                {businessTime ? (
                  <Text className="mt-[8rpx] block text-[24rpx] text-muted-foreground">
                    营业时间 {businessTime}
                  </Text>
                ) : null}
              </View>
            </View>

            {campus?.address ? (
              <View className="mt-[16rpx] flex items-start gap-[8rpx]">
                <View className="mt-[2rpx] flex h-[36rpx] w-[36rpx] shrink-0 items-center justify-center rounded-[8rpx] bg-primary">
                  <Icon name="mdi-map-marker" size={20} color="white" />
                </View>
                <Text className="flex-1 text-[26rpx] leading-relaxed text-foreground">
                  {campus.address}
                </Text>
              </View>
            ) : null}

            <View className="my-[20rpx] h-[2rpx] bg-border" />

            <View className="flex flex-row items-center justify-between gap-[12rpx]">
              <View className="flex min-w-0 flex-1 flex-wrap gap-[12rpx]">
                {(campus?.tags || []).slice(0, 4).map((tag) => (
                  <View
                    key={tag}
                    className="flex h-[40rpx] items-center rounded-[8rpx] bg-primary-bg px-[12rpx]"
                  >
                    <Text className="text-[24rpx] font-medium text-primary">{tag}</Text>
                  </View>
                ))}
              </View>
              <View className="flex shrink-0 gap-[12rpx]">
                <View
                  className="flex h-[40rpx] items-center gap-[6rpx] rounded-[8rpx] bg-primary-bg px-[16rpx] active:opacity-70"
                  onClick={handleOpenLocation}
                >
                  <Icon name="mdi-map-marker-outline" size="xs" color="primary" />
                  <Text className="text-[24rpx] text-primary">导航到店</Text>
                </View>
                {campus?.phone ? (
                  <View
                    className="flex h-[40rpx] items-center gap-[6rpx] rounded-[8rpx] bg-primary-bg px-[16rpx] active:opacity-70"
                    onClick={handleCallPhone}
                  >
                    <Icon name="mdi-phone" size="xs" color="primary" />
                    <Text className="text-[24rpx] text-primary">联系电话</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* 大对号：居中放在校区卡片下方 */}
          <View className="invite-success-check">
            <View className="invite-success-check__ring">
              <View className="invite-success-check__mark">
                <Text className="text-[64rpx] font-bold leading-none text-white">✓</Text>
              </View>
            </View>
            <Text className="mt-[24rpx] text-[40rpx] font-bold text-foreground">预约成功</Text>
            <Text className="mt-[12rpx] text-center text-[24rpx] leading-relaxed text-muted-foreground">
              试听名额已锁定。可导航到店或电话联系校区。
            </Text>
          </View>

          <View className="mx-[28rpx] mt-[16rpx] pb-[160rpx]">
            <View className="rounded-[24rpx] border border-border bg-card p-[28rpx]">
              <Text className="mb-[16rpx] block text-[30rpx] font-bold text-foreground">
                {courseTitle}
              </Text>
              <View className="grid grid-cols-2 gap-[16rpx]">
                <View>
                  <Text className="block text-[22rpx] text-muted-foreground">孩子</Text>
                  <Text className="mt-[4rpx] block text-[28rpx] font-semibold text-foreground">
                    {childName}
                  </Text>
                </View>
                <View>
                  <Text className="block text-[22rpx] text-muted-foreground">年龄 / 性别</Text>
                  <Text className="mt-[4rpx] block text-[28rpx] font-semibold text-foreground">
                    {childAge} 岁 · {genderLabel}
                  </Text>
                </View>
                <View>
                  <Text className="block text-[22rpx] text-muted-foreground">上课时间</Text>
                  <Text className="mt-[4rpx] block text-[28rpx] font-semibold text-foreground">
                    {dateLabel} {params.start}
                  </Text>
                </View>
                <View>
                  <Text className="block text-[22rpx] text-muted-foreground">课型</Text>
                  <Text className="mt-[4rpx] block text-[28rpx] font-semibold text-foreground">
                    {isGroupBook ? '团课约课' : '班课试听'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View className="invite-dock">
          <View
            className="center h-[96rpx] rounded-[28rpx] bg-gradient-primary shadow-card active:opacity-90"
            onClick={handleDone}
          >
            <Text className="text-[32rpx] font-bold text-white">完成</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  /* ---------- 主流程：方案 B + 弹层 ---------- */
  return (
    <PageContainer className="invite-landing">
      <ScrollView
        scrollY
        className={cn('h-screen', showVoucher && 'invite-dim')}
        showScrollbar={false}
      >
        <View
          className="invite-b-bg min-h-screen pb-[200rpx]"
          style={{ paddingTop: `${statusBarHeight + navBarHeight}px` }}
        >
          <View className="flex items-center justify-center gap-[16rpx] px-[32rpx] pt-[24rpx]">
            <View
              className="h-[72rpx] w-[72rpx] overflow-hidden rounded-[20rpx]"
              style={{
                background: campus?.iconGradient || 'linear-gradient(135deg, #5b8af8, #3b6ef5)',
              }}
            >
              {campus?.logo ? (
                <Image src={campus.logo} className="h-full w-full" mode="aspectFill" />
              ) : (
                <View className="center h-full w-full">
                  <Image src={BRAND_LOGO} className="h-[52rpx] w-[52rpx]" mode="aspectFit" />
                </View>
              )}
            </View>
            <View className="min-w-0">
              <Text className="block text-[30rpx] font-bold text-foreground">
                {campus?.name || '校区'}
              </Text>
              <Text className="block text-[22rpx] text-muted-foreground">
                老师分享邀请
              </Text>
            </View>
          </View>

          <View className="invite-ticket mx-[28rpx] mt-[28rpx] overflow-hidden rounded-[28rpx] border border-border bg-card shadow-card">
            <View className="invite-ticket-head px-[28rpx] pb-[24rpx] pt-[28rpx]">
              <View className="mb-[16rpx] flex flex-wrap gap-[12rpx]">
                <View className="rounded-full bg-primary/10 px-[20rpx] py-[6rpx]">
                  <Text className="text-[22rpx] font-semibold text-primary">
                    {isGroupBook ? '团课预约' : '免费试听'}
                  </Text>
                </View>
                {lessonExpired ? (
                  <View className="rounded-full bg-muted px-[20rpx] py-[6rpx]">
                    <Text className="text-[22rpx] font-semibold text-muted-foreground">已结束</Text>
                  </View>
                ) : claimed ? (
                  <View className="rounded-full bg-success/10 px-[20rpx] py-[6rpx]">
                    <Text className="text-[22rpx] font-semibold text-success">已领券</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-[34rpx] font-bold text-foreground">{courseTitle}</Text>
            </View>
            <View className="invite-ticket-dash" />
            <View className="grid grid-cols-2 gap-[20rpx] px-[28rpx] py-[28rpx]">
              <View>
                <Text className="block text-[22rpx] text-muted-foreground">日期</Text>
                <Text className="mt-[6rpx] block text-[28rpx] font-semibold text-foreground">
                  {dateLabel || '—'}
                </Text>
              </View>
              <View>
                <Text className="block text-[22rpx] text-muted-foreground">时段</Text>
                <Text className="mt-[6rpx] block text-[28rpx] font-semibold text-foreground">
                  {timeLabel || '—'}
                </Text>
              </View>
              <View>
                <Text className="block text-[22rpx] text-muted-foreground">授课老师</Text>
                <Text className="mt-[6rpx] block text-[28rpx] font-semibold text-foreground">
                  {teacherName || '老师'}
                </Text>
              </View>
              <View>
                <Text className="block text-[22rpx] text-muted-foreground">校区</Text>
                <Text className="mt-[6rpx] block text-[28rpx] font-semibold text-foreground">
                  {campus?.name || '—'}
                </Text>
              </View>
            </View>
          </View>

          <View className="mx-[28rpx] mt-[24rpx] rounded-[28rpx] border border-border bg-card p-[28rpx]">
            {isLoggedIn ? (
              <View className="mb-[20rpx] flex items-center justify-center rounded-full bg-success/10 px-[24rpx] py-[12rpx]">
                <Text className="text-[22rpx] font-semibold text-success">
                  ✓ 已微信登录
                </Text>
              </View>
            ) : null}
            <Text className="block text-[30rpx] font-bold text-foreground">
              {lessonExpired
                ? '本场课程已结束'
                : claimed
                  ? isGroupBook
                    ? '预约本场团课'
                    : '预约本场免费试听'
                  : '领取试听券后可预约'}
            </Text>
            <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
              {lessonExpired
                ? `这场课已经上过了，无法再预约该时段。请联系${teacherName ? `老师「${teacherName}」` : '老师'}重新安排试听时间${campus?.phone ? '，也可直接电话联系校区' : ''}。`
                : claimed
                  ? '点击下方立即预约，并开通上课提醒。'
                  : '老师分享了本场课程。请先领取免费试听券，再完成预约。'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {claimed ? (
        <View className="invite-dock">
          {lessonExpired ? (
            campus?.phone ? (
              <View
                className="center h-[96rpx] rounded-[28rpx] bg-gradient-primary shadow-card active:opacity-90"
                onClick={handleCallPhone}
              >
                <Text className="text-[32rpx] font-bold text-white">联系校区重新约课</Text>
              </View>
            ) : (
              <View className="center h-[96rpx] rounded-[28rpx] border border-border bg-card">
                <Text className="text-[28rpx] text-muted-foreground">
                  请联系老师{teacherName ? `「${teacherName}」` : ''}另约时间
                </Text>
              </View>
            )
          ) : (
            <View
              className="center h-[96rpx] rounded-[28rpx] bg-gradient-primary shadow-card active:opacity-90"
              onClick={handleBookClick}
            >
              <Text className="text-[32rpx] font-bold text-white">立即预约</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* 试听券弹框（场次未过期才展示） */}
      {showVoucher && !lessonExpired ? (
        <View className="invite-mask center">
          <View className="invite-voucher-pop">
            <View className="invite-voucher-shine" />
            <View className="invite-voucher-top">
              <View className="mb-[20rpx] inline-flex rounded-full bg-white/20 px-[20rpx] py-[8rpx]">
                <Text className="text-[22rpx] font-bold tracking-wide text-white">
                  FREE TRIAL · 免费试听券
                </Text>
              </View>
              <Text className="block text-[44rpx] font-bold text-white">1 次免费试听</Text>
              <Text className="mt-[8rpx] block text-[24rpx] text-white/90">
                领取后可预约本场班课
              </Text>
            </View>
            <View className="invite-voucher-mid">
              <Text className="mb-[16rpx] block text-[28rpx] font-bold text-foreground">
                {courseTitle}
              </Text>
              <View className="grid grid-cols-2 gap-[16rpx]">
                <View>
                  <Text className="block text-[22rpx] text-muted-foreground">日期</Text>
                  <Text className="mt-[4rpx] block text-[26rpx] font-semibold">{dateLabel || '—'}</Text>
                </View>
                <View>
                  <Text className="block text-[22rpx] text-muted-foreground">时段</Text>
                  <Text className="mt-[4rpx] block text-[26rpx] font-semibold">{timeLabel || '—'}</Text>
                </View>
              </View>
            </View>
            <View className="px-[28rpx] pb-[28rpx] pt-[8rpx]">
              <View
                className="invite-cta-pulse center h-[96rpx] rounded-[28rpx] bg-gradient-primary active:opacity-90"
                onClick={handleClaim}
              >
                <Text className="text-[32rpx] font-bold text-white">立即领取</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* 微信登录弹框（预约流程中途补登） */}
      {showLogin && isLoggedIn === false && !needLoginGate ? (
        <View className="invite-mask center">
          <View className="w-[600rpx] rounded-[32rpx] bg-card px-[36rpx] py-[40rpx]">
            <Text className="mb-[12rpx] block text-center text-[34rpx] font-bold text-foreground">
              微信一键登录
            </Text>
            <Text className="mb-[32rpx] block text-center text-[26rpx] leading-relaxed text-muted-foreground">
              预约前请先登录。仅需微信授权，无需绑定邮箱。
            </Text>
            <View
              className={cn(
                'center h-[96rpx] rounded-[28rpx] bg-gradient-wechat shadow-wechat-btn active:opacity-90',
                wechatSubmitting && 'opacity-60',
              )}
              onClick={handleWechatLogin}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {wechatSubmitting ? '登录中...' : '微信一键登录'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* 填表弹层（过期场次不展示） */}
      {showForm && !lessonExpired ? (
        <View className="invite-mask bottom">
          <View className="invite-sheet w-full rounded-t-[32rpx] bg-card px-[32rpx] pb-[48rpx] pt-[16rpx]">
            <View className="mx-auto mb-[24rpx] h-[8rpx] w-[72rpx] rounded-full bg-border" />
            <Text className="mb-[8rpx] block text-center text-[34rpx] font-bold text-foreground">
              填写预约信息
            </Text>
            <Text className="mb-[28rpx] block text-center text-[24rpx] text-muted-foreground">
              提交后锁定本场{isGroupBook ? '约课' : '试听'}名额
            </Text>

            <FormInput
              label="孩子姓名"
              placeholder="请输入孩子姓名"
              value={childName}
              onInput={(e) => setChildName(e.detail.value)}
              required
            />
            <FormInput
              label="年龄"
              placeholder="例如 7"
              value={childAge}
              onInput={(e) => setChildAge(e.detail.value)}
              type="number"
              required
            />

            <View className="mb-[24rpx]">
              <Text className="mb-[12rpx] block text-[28rpx] font-medium text-muted-foreground">
                性别 <Text className="text-destructive">*</Text>
              </Text>
              <View className="flex gap-[16rpx]">
                {(
                  [
                    { value: 'male' as const, label: '男' },
                    { value: 'female' as const, label: '女' },
                  ] as const
                ).map((opt) => (
                  <View
                    key={opt.value}
                    className={cn(
                      'center h-[88rpx] flex-1 rounded-[20rpx] border',
                      childGender === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/40',
                    )}
                    onClick={() => setChildGender(opt.value)}
                  >
                    <Text
                      className={cn(
                        'text-[28rpx] font-semibold',
                        childGender === opt.value ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {opt.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <FormInput
              label="家长手机号"
              placeholder="用于接收预约与到课提醒"
              value={parentPhone}
              onInput={(e) => setParentPhone(e.detail.value)}
              type="number"
              maxlength={11}
              required
            />

            <View
              className={cn(
                'center mt-[16rpx] h-[96rpx] rounded-[28rpx]',
                submitting ? 'bg-muted' : 'bg-gradient-primary',
              )}
              onClick={submitting ? undefined : () => void handleSubmit()}
            >
              <Text
                className={cn(
                  'text-[32rpx] font-bold',
                  submitting ? 'text-muted-foreground' : 'text-white',
                )}
              >
                {submitting ? '提交中...' : '提交预约'}
              </Text>
            </View>
            <View
              className="center mt-[8rpx] h-[72rpx] active:opacity-70"
              onClick={() => setShowForm(false)}
            >
              <Text className="text-[26rpx] text-muted-foreground">取消</Text>
            </View>
          </View>
        </View>
      ) : null}
    </PageContainer>
  );
};

export default InviteLandingPage;
