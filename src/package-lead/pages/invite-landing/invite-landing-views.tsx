/**
 * 邀约落地页视图片段（无业务态机；由 index 传入已派生数据与 handlers）
 */
import { View, Text, Image, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import { BRAND_LOGO, ORG_COVER_IMAGE } from '@/constants/brand';
import type { CampusUIModel } from '@/types/campus';
import type { TrialInviteDockAction } from '@/utils/invite-landing-flow';
import type { InviteLandingChildGender } from '@/utils/invite-landing-params';

export const InviteLandingLoginGate: React.FC<{
  statusBarHeight: number;
  navBarHeight: number;
  wechatSubmitting: boolean;
  onWechatLogin: () => void;
}> = ({ statusBarHeight, navBarHeight, wechatSubmitting, onWechatLogin }) => (
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
        onClick={onWechatLogin}
      >
        <Text className="text-[30rpx] font-semibold text-white">
          {wechatSubmitting ? '登录中...' : '微信一键登录'}
        </Text>
      </View>
    </View>
  </View>
);

export const InviteLandingSuccessView: React.FC<{
  homeBtnTop: number;
  campus: CampusUIModel | null;
  campusOpen: boolean;
  businessTime: string;
  courseTitle: string;
  childName: string;
  childAge: string;
  genderLabel: string;
  dateLabel: string;
  start?: string;
  isGroupBook: boolean;
  onDone: () => void;
  onOpenLocation: () => void;
  onCallPhone: () => void;
}> = ({
  homeBtnTop,
  campus,
  campusOpen,
  businessTime,
  courseTitle,
  childName,
  childAge,
  genderLabel,
  dateLabel,
  start,
  isGroupBook,
  onDone,
  onOpenLocation,
  onCallPhone,
}) => (
  <>
    <View className="invite-home-btn" style={{ top: `${homeBtnTop}px` }} onClick={onDone}>
      <Icon name="mdi-home" size={36} color="foreground" />
    </View>

    <ScrollView scrollY className="h-screen" showScrollbar={false}>
      <View className="invite-success-banner relative h-[340rpx] overflow-hidden">
        <Image src={ORG_COVER_IMAGE} className="absolute inset-0 h-full w-full" mode="aspectFill" />
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
              onClick={onOpenLocation}
            >
              <Icon name="mdi-map-marker-outline" size="xs" color="primary" />
              <Text className="text-[24rpx] text-primary">导航到店</Text>
            </View>
            {campus?.phone ? (
              <View
                className="flex h-[40rpx] items-center gap-[6rpx] rounded-[8rpx] bg-primary-bg px-[16rpx] active:opacity-70"
                onClick={onCallPhone}
              >
                <Icon name="mdi-phone" size="xs" color="primary" />
                <Text className="text-[24rpx] text-primary">联系电话</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

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
                {dateLabel} {start}
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
        onClick={onDone}
      >
        <Text className="text-[32rpx] font-bold text-white">完成</Text>
      </View>
    </View>
  </>
);

export const InviteLandingMainView: React.FC<{
  statusBarHeight: number;
  navBarHeight: number;
  campus: CampusUIModel | null;
  teacherName: string;
  courseTitle: string;
  dateLabel: string;
  timeLabel: string;
  isGroupBook: boolean;
  isLoggedIn: boolean;
  lessonExpired: boolean;
  claimed: boolean;
  showVoucher: boolean;
  showLogin: boolean;
  showForm: boolean;
  needLoginGate: boolean;
  wechatSubmitting: boolean;
  submitting: boolean;
  mainCopy: { title: string; subtitle: string };
  dockAction: TrialInviteDockAction;
  childName: string;
  childAge: string;
  childGender: InviteLandingChildGender | '';
  parentPhone: string;
  onClaim: () => void;
  onBookClick: () => void;
  onCallPhone: () => void;
  onWechatLogin: () => void;
  onSubmit: () => void;
  onCancelForm: () => void;
  onChildName: (v: string) => void;
  onChildAge: (v: string) => void;
  onChildGender: (v: InviteLandingChildGender) => void;
  onParentPhone: (v: string) => void;
}> = ({
  statusBarHeight,
  navBarHeight,
  campus,
  teacherName,
  courseTitle,
  dateLabel,
  timeLabel,
  isGroupBook,
  isLoggedIn,
  lessonExpired,
  claimed,
  showVoucher,
  showLogin,
  showForm,
  needLoginGate,
  wechatSubmitting,
  submitting,
  mainCopy,
  dockAction,
  childName,
  childAge,
  childGender,
  parentPhone,
  onClaim,
  onBookClick,
  onCallPhone,
  onWechatLogin,
  onSubmit,
  onCancelForm,
  onChildName,
  onChildAge,
  onChildGender,
  onParentPhone,
}) => (
  <>
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
            <Text className="block text-[22rpx] text-muted-foreground">老师分享邀请</Text>
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
              <Text className="text-[22rpx] font-semibold text-success">✓ 已微信登录</Text>
            </View>
          ) : null}
          <Text className="block text-[30rpx] font-bold text-foreground">{mainCopy.title}</Text>
          <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
            {mainCopy.subtitle}
          </Text>
        </View>
      </View>
    </ScrollView>

    {dockAction !== 'hidden' ? (
      <View className="invite-dock">
        {dockAction === 'call_campus' ? (
          <View
            className="center h-[96rpx] rounded-[28rpx] bg-gradient-primary shadow-card active:opacity-90"
            onClick={onCallPhone}
          >
            <Text className="text-[32rpx] font-bold text-white">联系校区重新约课</Text>
          </View>
        ) : dockAction === 'contact_teacher' ? (
          <View className="center h-[96rpx] rounded-[28rpx] border border-border bg-card">
            <Text className="text-[28rpx] text-muted-foreground">
              请联系老师{teacherName ? `「${teacherName}」` : ''}另约时间
            </Text>
          </View>
        ) : (
          <View
            className="center h-[96rpx] rounded-[28rpx] bg-gradient-primary shadow-card active:opacity-90"
            onClick={onBookClick}
          >
            <Text className="text-[32rpx] font-bold text-white">立即预约</Text>
          </View>
        )}
      </View>
    ) : null}

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
            <Text className="mt-[8rpx] block text-[24rpx] text-white/90">领取后可预约本场班课</Text>
          </View>
          <View className="invite-voucher-mid">
            <Text className="mb-[16rpx] block text-[28rpx] font-bold text-foreground">
              {courseTitle}
            </Text>
            <View className="grid grid-cols-2 gap-[16rpx]">
              <View>
                <Text className="block text-[22rpx] text-muted-foreground">日期</Text>
                <Text className="mt-[4rpx] block text-[26rpx] font-semibold">
                  {dateLabel || '—'}
                </Text>
              </View>
              <View>
                <Text className="block text-[22rpx] text-muted-foreground">时段</Text>
                <Text className="mt-[4rpx] block text-[26rpx] font-semibold">
                  {timeLabel || '—'}
                </Text>
              </View>
            </View>
          </View>
          <View className="px-[28rpx] pb-[28rpx] pt-[8rpx]">
            <View
              className="invite-cta-pulse center h-[96rpx] rounded-[28rpx] bg-gradient-primary active:opacity-90"
              onClick={onClaim}
            >
              <Text className="text-[32rpx] font-bold text-white">立即领取</Text>
            </View>
          </View>
        </View>
      </View>
    ) : null}

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
            onClick={onWechatLogin}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {wechatSubmitting ? '登录中...' : '微信一键登录'}
            </Text>
          </View>
        </View>
      </View>
    ) : null}

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
            onInput={(e) => onChildName(e.detail.value)}
            required
          />
          <FormInput
            label="年龄"
            placeholder="例如 7"
            value={childAge}
            onInput={(e) => onChildAge(e.detail.value)}
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
                  onClick={() => onChildGender(opt.value)}
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
            onInput={(e) => onParentPhone(e.detail.value)}
            type="number"
            maxlength={11}
            required
          />

          <View
            className={cn(
              'center mt-[16rpx] h-[96rpx] rounded-[28rpx]',
              submitting ? 'bg-muted' : 'bg-gradient-primary',
            )}
            onClick={submitting ? undefined : onSubmit}
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
          <View className="center mt-[8rpx] h-[72rpx] active:opacity-70" onClick={onCancelForm}>
            <Text className="text-[26rpx] text-muted-foreground">取消</Text>
          </View>
        </View>
      </View>
    ) : null}
  </>
);
