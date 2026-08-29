/**
 * 家长邀约落地页 package-lead/pages/invite-landing
 *
 * 流程：试听券弹框领取 → 方案 B 票券页 → 微信登录+订阅 → 填表预约 → 成功页（头图+校区卡片）
 */
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { BRAND_LOGO, ORG_COVER_IMAGE } from '@/constants/brand';
import { classBookingService, campusService, leadService, teacherService } from '@/services';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useAgreementStore } from '@/stores/agreement';
import type { CampusUIModel } from '@/types/campus';
import { useAuth } from '@/utils/auth';
import { isCampusOpen, parseBusinessHours } from '@/utils/campus';
import { logError } from '@/utils/logger';
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
  const { profile, session, signInWithWechat } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();

  const [params, setParams] = useState<LandingParams>({ t: '', c: '' });
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
  });

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

  const isLoggedIn = Boolean(session) && !guestMode;
  const isGroupBook = params.type === 'group_slot';
  const hasLessonContext = Boolean(params.classId && params.date && params.start && params.end);

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
    if (!isLoggedIn) {
      openFormAfterLoginRef.current = true;
      setShowLogin(true);
      return;
    }
    void openBookingForm();
  }, [isLoggedIn, openBookingForm]);

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
      setGuestMode(false);
      setShowLogin(false);
      Taro.showToast({ title: '登录成功', icon: 'success' });
      if (openFormAfterLoginRef.current) {
        openFormAfterLoginRef.current = false;
        await openBookingForm();
      } else {
        await ensureSubscribe();
      }
    } catch (err) {
      logError('invite-landing.wechatLogin', err);
      Taro.showToast({ title: '微信登录失败', icon: 'none' });
    } finally {
      setWechatSubmitting(false);
    }
  }, [ensureSubscribe, openBookingForm, signInWithWechat, wechatSubmitting]);

  const handleWechatLogin = useCallback(() => {
    if (wechatSubmitting) return;
    if (!agreed) {
      void Taro.showModal({
        title: '服务协议及隐私保护',
        content: '登录前请阅读并同意《用户协议》和《隐私政策》。',
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

  const bookLesson = useCallback(
    async (leadId: string) => {
      if (!hasLessonContext || !params.classId || !params.date || !params.start || !params.end) {
        Taro.navigateTo({
          url: `/package-lead/pages/trial-booking/index?teacherId=${encodeURIComponent(params.t)}&campusId=${encodeURIComponent(params.c)}&leadId=${encodeURIComponent(leadId)}&mode=${isGroupBook ? 'group' : 'private'}`,
        });
        return false;
      }

      if (isGroupBook) {
        const slotId = params.slotId;
        if (!slotId) {
          Taro.showToast({ title: '时段信息缺失', icon: 'none' });
          return false;
        }
        const studentId = session?.user.id || leadId;
        await classBookingService.addBookingRecord(slotId, studentId);
        return true;
      }

      await leadService.bookTrialByClass({
        leadId,
        classId: params.classId,
        className: params.className,
        campusId: params.c,
        lessonDate: params.date,
        startTime: params.start,
        endTime: params.end,
        teacherId: params.t,
        teacherName: teacherName || undefined,
        operatorId: session?.user.id,
        note: '家长分享入口自助约试听',
      });
      return true;
    },
    [hasLessonContext, isGroupBook, params, session?.user.id, teacherName],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
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
      const lead = await leadService.createLeadFromInvite({
        parentUserId: session?.user.id || '',
        parentName: profile?.name || undefined,
        parentPhone: parentPhone.trim(),
        childName: childName.trim(),
        childGender,
        childAge: `${childAge.trim()}岁`,
        teacherId: params.t,
        campusId: params.c,
        sourceType: params.st || 'share_link',
        sourceCourseId: params.course || params.classId,
      });
      const ok = await bookLesson(lead.id);
      if (ok) {
        setShowForm(false);
        setSuccess(true);
      }
    } catch (err) {
      logError('invite-landing.submit', err);
      Taro.showToast({ title: '预约失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    bookLesson,
    childAge,
    childGender,
    childName,
    params,
    parentPhone,
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

  /* ---------- 预约成功页 ---------- */
  if (success) {
    return (
      <PageContainer className="invite-landing">
        <ScrollView scrollY className="h-screen" showScrollbar={false}>
          <View className="invite-success-banner relative h-[340rpx] overflow-hidden">
            <Image
              src={ORG_COVER_IMAGE}
              className="absolute inset-0 h-full w-full"
              mode="aspectFill"
            />
            <View className="absolute inset-0 bg-black/35" />
            <View className="absolute bottom-[72rpx] left-0 right-0 z-[2] flex items-center justify-center gap-[16rpx]">
              <View className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full bg-success text-white shadow-card">
                <Text className="text-[28rpx] font-bold">✓</Text>
              </View>
              <Text className="text-[36rpx] font-bold text-white">预约成功</Text>
            </View>
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

          <View className="mx-[28rpx] mt-[24rpx] pb-[160rpx]">
            <Text className="mb-[16rpx] block text-center text-[24rpx] text-muted-foreground">
              试听名额已锁定。可导航到店或电话联系校区。
            </Text>
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
        <View className="invite-b-bg min-h-screen pb-[200rpx]">
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
                {claimed ? (
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
              {claimed ? (isGroupBook ? '预约本场团课' : '预约本场免费试听') : '领取试听券后可预约'}
            </Text>
            <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
              {claimed
                ? '点击下方立即预约；未登录将先完成微信一键登录，并开通上课提醒。'
                : '老师分享了本场课程。请先领取免费试听券，再完成登录与预约。'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {claimed ? (
        <View className="invite-dock">
          <View
            className="center h-[96rpx] rounded-[28rpx] bg-gradient-primary shadow-card active:opacity-90"
            onClick={handleBookClick}
          >
            <Text className="text-[32rpx] font-bold text-white">立即预约</Text>
          </View>
        </View>
      ) : null}

      {/* 试听券弹框 */}
      {showVoucher ? (
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

      {/* 微信登录弹框 */}
      {showLogin ? (
        <View className="invite-mask center">
          <View className="w-[600rpx] rounded-[32rpx] bg-card px-[36rpx] py-[40rpx]">
            <Text className="mb-[12rpx] block text-center text-[34rpx] font-bold text-foreground">
              微信一键登录
            </Text>
            <Text className="mb-[32rpx] block text-center text-[26rpx] leading-relaxed text-muted-foreground">
              预约前请先登录。登录后将开启微信提醒，方便校区通知你预约确认、开课提醒和课后反馈。
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
            <View
              className="center mt-[16rpx] h-[72rpx] active:opacity-70"
              onClick={() => {
                openFormAfterLoginRef.current = false;
                setShowLogin(false);
              }}
            >
              <Text className="text-[26rpx] text-muted-foreground">取消</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* 填表弹层 */}
      {showForm ? (
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
