/**
 * 线索详情页 package-lead/pages/lead-detail
 *
 * 参考图片统一设计：顶部橙色头部 + 头像/姓名/状态/电话，
 * 下方白色信息卡片展示线索详情，再下方为跟进记录列表。
 * 不区分渠道来源，所有线索使用同一套详情布局。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import ConvertSheet from '@/components/lead/ConvertSheet';
import FollowUpSheet from '@/components/lead/FollowUpSheet';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import { LEAD_SOURCE_META, FOLLOW_UP_ACTION_META, TRIAL_MODE_META } from '@/constants/lead';
import { leadService } from '@/services';
import { useLeadStore } from '@/stores/lead';
import type { Lead, LeadFollowUp, LeadBooking } from '@/types/lead';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const LeadDetailPage: React.FC = () => {
  const { session } = useAuth();
  const { invalidate } = useLeadStore();
  const navSafeHeight = useNavSafeHeight();

  const [lead, setLead] = useState<Lead | null>(null);
  const [bookings, setBookings] = useState<LeadBooking[]>([]);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showNoteEdit, setShowNoteEdit] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusBarHeight, setStatusBarHeight] = useState(44);

  let leadId = '';
  useLoad((options) => {
    leadId = (options as Record<string, string>)?.id || '';
  });

  useEffect(() => {
    const windowInfo = Taro.getWindowInfo();
    setStatusBarHeight(windowInfo.statusBarHeight || 44);
  }, []);

  useDidShow(() => {
    if (leadId) {
      loadData(leadId);
    }
  });

  const userId = session?.user.id;

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [leadData, bookingList, followUpList] = await Promise.all([
        leadService.getLeadById(id),
        leadService.getLeadBookings(id),
        leadService.getLeadFollowUps(id),
      ]);
      if (leadData) setLead(leadData);
      setBookings(bookingList);
      setFollowUps(followUpList);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStatusChange = useCallback(
    async (status: Lead['status']) => {
      if (!lead) return;
      try {
        await leadService.updateLeadStatus(lead.id, status);
        invalidate(userId || '');
        loadData(lead.id);
        Taro.showToast({ title: '操作成功', icon: 'success' });
      } catch {
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [lead, userId, invalidate],
  );

  const handleCloseLead = useCallback(async () => {
    if (!lead) return;
    const res = await Taro.showModal({
      title: '确认标记流失',
      content: '标记后线索将进入已流失列表，是否继续？',
    });
    if (res.confirm) {
      await leadService.updateLeadStatus(lead.id, 'closed');
      invalidate(userId || '');
      loadData(lead.id);
      Taro.showToast({ title: '已标记流失', icon: 'success' });
    }
  }, [lead, userId, invalidate]);

  const handleFollowUpSubmit = useCallback(
    async (params: {
      action: LeadFollowUp['action'];
      intentLevel?: LeadFollowUp['intent_level'];
      content: string;
      nextFollowUpAt?: string;
    }) => {
      if (!lead) return;
      try {
        await leadService.createFollowUp({ ...params, leadId: lead.id, operatorId: userId || '' });
        setShowFollowUp(false);
        invalidate(userId || '');
        loadData(lead.id);
        Taro.showToast({ title: '跟进已添加', icon: 'success' });
      } catch {
        Taro.showToast({ title: '添加失败', icon: 'none' });
      }
    },
    [lead, userId, invalidate],
  );

  const handleConvertSubmit = useCallback(
    async (params: {
      leadId: string;
      conversionType: string;
      packageId: string;
      classId?: string;
      note?: string;
    }) => {
      if (!lead) return;
      try {
        await leadService.createConversion({
          leadId: lead.id,
          conversionType: 'new_student',
          studentId: lead.trial_student_id,
          operatorId: userId || '',
          note: params.note,
        });
        await leadService.updateLeadStatus(lead.id, 'closed');
        setShowConvert(false);
        invalidate(userId || '');
        loadData(lead.id);
        Taro.showToast({ title: '开卡成功', icon: 'success' });
      } catch {
        Taro.showToast({ title: '开卡失败', icon: 'none' });
      }
    },
    [lead, userId, invalidate],
  );

  const handlePhone = useCallback(() => {
    if (lead?.parent_phone) {
      Taro.makePhoneCall({ phoneNumber: lead.parent_phone });
    }
  }, [lead]);

  const handleNoteSave = useCallback(async () => {
    if (!lead) return;
    try {
      await leadService.updateLead(lead.id, { notes: noteValue.trim() || undefined });
      setShowNoteEdit(false);
      invalidate(userId || '');
      loadData(lead.id);
      Taro.showToast({ title: '备注已保存', icon: 'success' });
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  }, [lead, noteValue, userId, invalidate]);

  const openNoteEdit = useCallback(() => {
    setNoteValue(lead?.notes || '');
    setShowNoteEdit(true);
  }, [lead]);

  // 底部操作按钮
  const bottomActions = useMemo(() => {
    if (!lead) return [];
    const status = lead.status;
    if (status === 'closed' || status === 'converted') {
      return [
        {
          label: '恢复跟进',
          variant: 'primary' as const,
          action: () => handleStatusChange('following'),
        },
      ];
    }
    return [
      {
        label: '标记流失',
        variant: 'ghost' as const,
        action: handleCloseLead,
      },
      {
        label: '跟进',
        variant: 'primary' as const,
        action: () => setShowFollowUp(true),
      },
    ];
  }, [lead, handleCloseLead, handleStatusChange]);

  if (loading || !lead) {
    return (
      <PageContainer>
        <View className="py-20 center">
          <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
        </View>
      </PageContainer>
    );
  }

  const sourceMeta = LEAD_SOURCE_META[lead.source_type];
  const visitCount = followUps.length + bookings.filter((b) => b.status !== 'cancelled').length;

  // 计算未跟进天数：取最近一次跟进记录的下次跟进提醒时间
  const latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : undefined;
  const notFollowDays = latestFollowUp?.next_follow_up_at
    ? Math.max(0, dayjs().diff(dayjs(latestFollowUp.next_follow_up_at), 'day'))
    : latestFollowUp
      ? Math.max(0, dayjs().diff(dayjs(latestFollowUp.created_at), 'day'))
      : Math.max(0, dayjs().diff(dayjs(lead.created_at), 'day'));

  // 信息行组件
  const InfoRow: React.FC<{
    label: string;
    value?: React.ReactNode;
    children?: React.ReactNode;
  }> = ({ label, value, children }) => (
    <View className="flex justify-between items-center py-[22rpx] border-b border-[#f3f2ed] last:border-b-0">
      <Text className="text-[30rpx] text-muted-foreground">{label}</Text>
      {children || <Text className="text-[30rpx] text-foreground">{value || '暂无'}</Text>}
    </View>
  );

  return (
    <PageContainer safeTop safeBottom className="bg-[#f3f2ed]">
      {/* 自定义导航栏 */}
      <View
        className="fixed top-0 left-0 right-0 z-50 bg-white"
        style={{ paddingTop: `${statusBarHeight}px` }}
      >
        <View className="flex items-center justify-center relative h-[44px]">
          <View
            className="absolute left-0 flex items-center justify-center w-[44px] h-[44px]"
            onClick={() => Taro.navigateBack()}
          >
            <Icon name="mdi-chevron-left" size={36} className="text-foreground" />
          </View>
          <Text className="text-[34rpx] font-semibold text-foreground">跟进记录</Text>
        </View>
      </View>

      <ScrollView scrollY className="h-screen" style={{ paddingTop: `${navSafeHeight}px` }}>
        {/* 主题色头部区域 */}
        <View className="bg-primary px-page-padding py-[18rpx]">
          <View className="flex items-center gap-[20rpx]">
            <StudentAvatar name={lead.child_name} size="lg" />
            <View className="flex-1 min-w-0">
              <View className="flex items-center gap-[10rpx]">
                <Text className="text-[32rpx] font-bold text-white truncate">
                  {lead.child_name}
                </Text>
                {lead.child_gender && (
                  <Icon
                    name={lead.child_gender === 'male' ? 'mdi-gender-male' : 'mdi-gender-female'}
                    size={28}
                    className="text-white/80"
                  />
                )}
                <View className="px-[12rpx] py-[6rpx] rounded-[8rpx] bg-white/20 center">
                  <Text className="text-[20rpx] font-bold text-white leading-none">
                    {lead.status === 'closed' || lead.status === 'converted'
                      ? '已流失'
                      : ['booked', 'arrived'].includes(lead.status)
                        ? '已预约'
                        : '待跟进'}
                  </Text>
                </View>
              </View>
              {lead.parent_phone && (
                <View className="flex items-center gap-[10rpx] mt-[8rpx]">
                  <Text className="text-[26rpx] text-white/90">{lead.parent_phone}</Text>
                  <View
                    className="w-[44rpx] h-[44rpx] rounded-[6rpx] border border-white/40 center"
                    onClick={handlePhone}
                  >
                    <Icon name="mdi-phone" size={20} color="white" />
                  </View>
                </View>
              )}
            </View>
            {/* 立即开卡按钮 */}
            {!['closed', 'converted'].includes(lead.status) && (
              <View
                className="px-[22rpx] py-[12rpx] rounded-full bg-white center flex-shrink-0"
                onClick={() => setShowConvert(true)}
              >
                <Text className="text-[26rpx] font-medium text-primary">立即开卡</Text>
              </View>
            )}
          </View>
        </View>

        {/* 信息列表（平铺白色背景） */}
        <View className="bg-white px-page-padding">
          <InfoRow label="状态">
            <Text className="text-[30rpx] text-[#f59e0b]">
              {lead.status === 'closed' || lead.status === 'converted'
                ? '已流失'
                : ['booked', 'arrived'].includes(lead.status)
                  ? '已预约'
                  : '待跟进'}
              {['new', 'pending', 'following', 'not_arrived'].includes(lead.status) &&
                `（${notFollowDays}天未跟进）`}
            </Text>
          </InfoRow>
          <InfoRow label="推荐人" value={lead.first_invite_teacher_id ? '老师' : '#'} />
          <InfoRow
            label="首次访问"
            value={
              lead.first_touch_at
                ? dayjs(lead.first_touch_at).format('YYYY-MM-DD HH:mm')
                : dayjs(lead.created_at).format('YYYY-MM-DD HH:mm')
            }
          />
          <InfoRow label="最近访问" value={dayjs(lead.updated_at).format('YYYY-MM-DD HH:mm')} />
          <InfoRow label="访问次数" value={`${visitCount}次`} />
          <InfoRow label="来源" value={`#${sourceMeta.label}`} />
          <InfoRow label="首次IP" value="暂无" />
          <InfoRow label="地址" value="暂无" />
          {/* 备注行：带编辑按钮 */}
          <View className="flex justify-between items-center py-[22rpx] border-b border-[#f3f2ed] last:border-b-0">
            <Text className="text-[30rpx] text-muted-foreground">备注</Text>
            <View className="flex items-center gap-2 flex-1 justify-end min-w-0">
              <Text className="text-[30rpx] text-foreground truncate">{lead.notes || '暂无'}</Text>
              <View
                className="w-[44rpx] h-[44rpx] rounded-full bg-primary/10 center flex-shrink-0"
                onClick={openNoteEdit}
              >
                <Icon name="mdi-pencil" size={20} className="text-primary" />
              </View>
            </View>
          </View>
        </View>

        {/* 预约记录 */}
        {bookings.length > 0 && (
          <Card className="mx-page-padding mt-3 rounded-[24rpx]">
            <Text className="text-[30rpx] font-bold text-foreground mb-3">试听预约</Text>
            {bookings.map((booking) => (
              <View
                key={booking.id}
                className="flex justify-between items-center py-3 border-b border-[#f3f2ed] last:border-b-0"
              >
                <View className="flex-1">
                  <View className="flex items-center gap-2">
                    <Text className="text-[28rpx] text-foreground">{booking.course_name}</Text>
                    <Text
                      className={cn(
                        'px-[12rpx] py-[4rpx] rounded-full text-[20rpx]',
                        TRIAL_MODE_META[booking.trial_mode].badgeClassName,
                      )}
                    >
                      {TRIAL_MODE_META[booking.trial_mode].label}
                    </Text>
                  </View>
                  <View className="flex items-center gap-2 mt-1">
                    <Text className="text-[24rpx] text-muted-foreground">
                      {dayjs(booking.lesson_date).format('MM/DD')} {booking.start_time}-
                      {booking.end_time}
                    </Text>
                    {booking.class_name && (
                      <Text className="text-[22rpx] text-muted-foreground">
                        · {booking.class_name}
                      </Text>
                    )}
                  </View>
                </View>
                <Text
                  className={cn(
                    'text-[22rpx]',
                    booking.status === 'confirmed'
                      ? 'text-success'
                      : booking.status === 'cancelled'
                        ? 'text-muted-foreground'
                        : 'text-warning',
                  )}
                >
                  {booking.status === 'confirmed'
                    ? '已确认'
                    : booking.status === 'cancelled'
                      ? '已取消'
                      : '已完成'}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* 跟进记录（时间线样式） */}
        <Card className="mx-page-padding mt-3 rounded-[24rpx]">
          <Text className="text-[30rpx] font-bold text-foreground mb-3">跟进记录</Text>
          {followUps.length === 0 ? (
            <View className="py-10 center flex-col gap-3">
              <Icon name="mdi-text-box-outline" size={48} className="text-muted-foreground/40" />
              <Text className="text-[26rpx] text-muted-foreground">暂无跟进记录</Text>
            </View>
          ) : (
            followUps.map((fu, idx) => (
              <View key={fu.id} className="flex gap-3 py-2">
                {/* 时间线左侧 */}
                <View className="flex flex-col items-center w-[44rpx]">
                  <View className="w-[44rpx] h-[44rpx] rounded-full bg-gradient-primary center">
                    <Icon name="mdi-clock-outline" size={20} color="white" />
                  </View>
                  {idx !== followUps.length - 1 && (
                    <View className="w-[2rpx] flex-1 bg-[#f3f2ed] my-[8rpx]" />
                  )}
                </View>
                {/* 时间线右侧 */}
                <View className="flex-1 pb-4">
                  <Text className="text-[30rpx] font-bold text-foreground">
                    {dayjs(fu.created_at).format('YYYY-MM-DD HH:mm')}
                  </Text>
                  <View className="flex items-center gap-2 mt-1">
                    <Text className="text-[28rpx] text-primary font-medium">
                      {FOLLOW_UP_ACTION_META[fu.action]?.label}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground"># 跟进</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* 底部留白 */}
        <View className="h-[180rpx]" />
      </ScrollView>

      {/* 底部操作栏 */}
      {bottomActions.length > 0 && (
        <View className="fixed bottom-0 left-0 right-0 z-100 bg-white border-t border-[#f3f2ed]">
          <View className="flex gap-3 px-page-padding pt-3 pb-safe-bar">
            {bottomActions.map((act, idx) => (
              <View
                key={idx}
                className={cn(
                  'flex-1 py-[22rpx] rounded-full center',
                  act.variant === 'primary' && 'bg-gradient-primary',
                  act.variant === 'ghost' && 'bg-[#f5f5f5]',
                )}
                onClick={act.action}
              >
                <Text
                  className={cn(
                    'text-[28rpx] font-medium',
                    act.variant === 'primary' && 'text-white',
                    act.variant === 'ghost' && 'text-foreground',
                  )}
                >
                  {act.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 跟进弹窗 */}
      <FollowUpSheet
        visible={showFollowUp}
        onSubmit={handleFollowUpSubmit}
        onClose={() => setShowFollowUp(false)}
      />

      {/* 转化弹窗 */}
      <ConvertSheet
        visible={showConvert}
        leadId={lead.id}
        childName={lead.child_name}
        coursePackages={[]}
        classes={[]}
        trialClassIds={bookings
          .filter((b) => b.trial_mode === 'group' && b.class_id && b.status !== 'cancelled')
          .map((b) => b.class_id!)}
        onSubmit={handleConvertSubmit}
        onClose={() => setShowConvert(false)}
      />

      {/* 备注编辑弹窗 */}
      <BottomSheet
        visible={showNoteEdit}
        title="编辑备注"
        onClose={() => setShowNoteEdit(false)}
        className="px-[40rpx] pb-[60rpx] pt-[12rpx]"
      >
        <FormInput
          label="备注内容"
          placeholder="请输入备注信息"
          value={noteValue}
          onInput={(e) => setNoteValue(e.detail.value)}
          multiline
          maxlength={200}
        />
        <View
          className={cn(
            'mt-6 py-[24rpx] rounded-full center',
            noteValue.trim().length > 0 ? 'bg-gradient-primary' : 'bg-muted',
          )}
          onClick={noteValue.trim().length > 0 ? handleNoteSave : undefined}
        >
          <Text
            className={cn(
              'text-[28rpx] font-medium',
              noteValue.trim().length > 0 ? 'text-white' : 'text-muted-foreground',
            )}
          >
            保存备注
          </Text>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default LeadDetailPage;
