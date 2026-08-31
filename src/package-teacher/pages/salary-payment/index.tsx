/**
 * 薪资发放页面
 *
 * 功能：
 * - 顶部月份切换（上月/当月/下月）
 * - 月度统计卡片：实发合计、员工数、奖金合计、罚款合计、待核对人数
 * - 员工薪资卡片：底薪、课时费、提成、社保分项展示
 * - 卡片点击进入详情页，可核对、编辑扣款/补发、发放
 * - 列表页底部两步操作：先「一键核对」，再「发送工资单」
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import PageIntroSheet from '@/components/PageIntroSheet';
import MonthPickerSheet from '@/components/teacher/MonthPickerSheet';
import SendSalarySheet from '@/components/teacher/SendSalarySheet';
import { auditLogService } from '@/services/audit-log';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useTeacherStore, calcTotal } from '@/stores/teacher';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import {
  SALARY_STATUS_META,
  normalizeSalaryStatus,
  type SalaryStatus,
  type SendResult,
  type TeacherUIModel,
} from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const PAGE_INTRO_KEY = 'salary_payment_intro_hidden';

/** 薪资状态排序：待核对优先展示 */
const SALARY_STATUS_SORT: Record<SalaryStatus, number> = {
  pending: 0,
  confirmed: 1,
  sending: 2,
  teacher_confirmed: 3,
  archived: 4,
};

/** 根据状态返回卡片底部提示文案 */
function getStatusHintText(status: SalaryStatus): string {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return '可调整奖金 / 罚款 / 自定义项';
    case 'sending':
    case 'teacher_confirmed':
      return '已发送工资单，不可调整';
    case 'archived':
      return '已归档，查看工资单';
    default:
      return '可调整奖金 / 罚款 / 自定义项';
  }
}

/** 工资单状态说明弹窗 */
const SalaryStatusExplainSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  return (
    <BottomSheet visible={visible} title="工资单状态说明" onClose={onClose} height="auto">
      <View className="px-[32rpx] pt-[12rpx] pb-[48rpx]">
        {(Object.keys(SALARY_STATUS_META) as SalaryStatus[]).map((key) => {
          const meta = SALARY_STATUS_META[key];
          return (
            <View key={key} className="flex items-start gap-[16rpx] py-[20rpx]">
              <View
                className={cn(
                  'px-[14rpx] py-[4rpx] rounded-[10rpx] text-[22rpx] font-medium',
                  meta.bgClass,
                  meta.textClass,
                )}
              >
                {meta.label}
              </View>
              <View className="flex-1">
                <Text className="text-[26rpx] text-foreground leading-[40rpx]">
                  {meta.description}
                </Text>
              </View>
            </View>
          );
        })}
        <View
          className="w-full py-[26rpx] rounded-full bg-primary text-primary-foreground text-center text-[30rpx] font-semibold press-scale mt-[16rpx]"
          onClick={onClose}
        >
          知道了
        </View>
      </View>
    </BottomSheet>
  );
};

const SalaryPaymentPage: React.FC = () => {
  useCardNavigationBar();
  const { profile } = useAuth();
  const { teachers, fetchAll, setSalaryMonth, batchConfirm, setPendingSendAction, executeSend } =
    useTeacherStore();
  const { activeTheme } = useThemeStore();

  /** 当前展示的月份 YYYY-MM */
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  /** 月份选择弹窗 */
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  /** 发送工资单结果弹窗 */
  const [sendSheetVisible, setSendSheetVisible] = useState(false);
  /** 工资单状态说明弹窗 */
  const [statusExplainVisible, setStatusExplainVisible] = useState(false);
  /** 发送结果 */
  const [sendResult, setSendResult] = useState<SendResult | undefined>();
  /** 发送中 */
  const [sending, setSending] = useState(false);
  /** 新手引导 */
  const [introVisible, setIntroVisible] = useState(false);
  /** 课时费/提成展开状态 */
  const [expandedMap, setExpandedMap] = useState<
    Record<string, { lesson: boolean; commission: boolean }>
  >({});

  useDidShow(() => {
    setSalaryMonth(currentMonth);
    void fetchAll(currentMonth);
    try {
      const hidden = Taro.getStorageSync(PAGE_INTRO_KEY);
      if (hidden !== true) setIntroVisible(true);
    } catch {
      setIntroVisible(true);
    }
  });

  const labelMonth = useMemo(() => {
    const y = currentMonth.slice(0, 4);
    const m = currentMonth.slice(5, 7);
    return `${y}年${m}月`;
  }, [currentMonth]);

  /** 仅展示在职或未归档的教师 */
  const visibleTeachers = useMemo(() => {
    return teachers.filter(
      (t) => t.status === 'active' || normalizeSalaryStatus(t.salaryStatus) !== 'archived',
    );
  }, [teachers]);

  const sortedVisibleTeachers = useMemo(() => {
    return [...visibleTeachers].sort((left, right) => {
      const leftOrder = SALARY_STATUS_SORT[normalizeSalaryStatus(left.salaryStatus)];
      const rightOrder = SALARY_STATUS_SORT[normalizeSalaryStatus(right.salaryStatus)];
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.name.localeCompare(right.name, 'zh-CN');
    });
  }, [visibleTeachers]);

  /** 汇总统计 */
  const stats = useMemo(() => {
    let total = 0;
    let bonus = 0;
    let deduct = 0;
    const statusCounts: Record<SalaryStatus, number> = {
      pending: 0,
      confirmed: 0,
      sending: 0,
      teacher_confirmed: 0,
      archived: 0,
    };
    visibleTeachers.forEach((t) => {
      total += calcTotal(t);
      (t.deductions || []).forEach((d) => {
        if (d.type === 'bonus') bonus += d.amount;
        else deduct += d.amount;
      });
      const status = normalizeSalaryStatus(t.salaryStatus);
      statusCounts[status] += 1;
    });
    return {
      total,
      staffCount: visibleTeachers.length,
      bonus,
      deduct,
      pending: statusCounts.pending,
      confirmed: statusCounts.confirmed,
      statusCounts,
    };
  }, [visibleTeachers]);

  /** 月份切换 */
  const handlePrevMonth = useCallback(() => {
    const prev = dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM');
    setCurrentMonth(prev);
    setSalaryMonth(prev);
    void fetchAll(prev);
  }, [currentMonth, setSalaryMonth, fetchAll]);
  const handleNextMonth = useCallback(() => {
    const next = dayjs(currentMonth).add(1, 'month').format('YYYY-MM');
    // 不能选择未来月份
    if (next > dayjs().format('YYYY-MM')) {
      Taro.showToast({ title: '不能选择未来月份', icon: 'none' });
      return;
    }
    setCurrentMonth(next);
    setSalaryMonth(next);
    void fetchAll(next);
  }, [currentMonth, setSalaryMonth, fetchAll]);

  /** 打开调整明细（核对前进入调整页，核对后进入工资单页） */
  const handleOpenDetail = useCallback((teacher: TeacherUIModel) => {
    const status = normalizeSalaryStatus(teacher.salaryStatus);
    const isAdjustable = status === 'pending' || status === 'confirmed';
    const url = isAdjustable
      ? `/package-teacher/pages/salary-adjust/index?id=${teacher.id}`
      : `/package-teacher/pages/salary-detail/index?id=${teacher.id}`;
    void Taro.navigateTo({ url });
  }, []);

  /** 一键核对：仅确认，不发送 */
  const handleBatchConfirm = useCallback(async () => {
    const pendingIds = visibleTeachers
      .filter((t) => normalizeSalaryStatus(t.salaryStatus) === 'pending')
      .map((t) => t.id);
    if (pendingIds.length === 0) return;

    const { confirm } = await Taro.showModal({
      title: '一键核对',
      content: `确认核对 ${pendingIds.length} 位员工的薪资？核对后可在列表页发送工资单。`,
      confirmText: '确认核对',
      cancelText: '再检查',
      confirmColor: getThemeHexColors(activeTheme).primary,
    });
    if (!confirm) return;

    setSending(true);
    try {
      await batchConfirm(pendingIds);
      // 审计日志（用户口径 2026-08-22）：薪资核对属关键财务操作
      try {
        await auditLogService.record({
          action: 'salary.confirm',
          operatorId: profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'salary_batch',
          detail: `薪资核对：一键核对 ${pendingIds.length} 位员工薪资`,
          meta: { count: pendingIds.length },
        });
      } catch (e) {
        logError('audit salary.confirm', e);
      }
      Taro.showToast({ title: '已核对', icon: 'success' });
      try {
        Taro.hideToast();
        await subscribeMessageService.runRenewFlow('salary_confirm_renew', 'salary_confirm', {
          role: profile?.currentContext?.role,
          campusId: profile?.currentContext?.campusId,
        });
      } catch (error) {
        logError('subscribe E11 salary confirm renew', error);
      }
    } catch {
      Taro.showToast({ title: '核对失败，请重试', icon: 'none' });
    } finally {
      setSending(false);
    }
  }, [activeTheme, visibleTeachers, batchConfirm, profile]);

  /** 发送工资单：直接发放并弹窗展示结果 */
  const handleOpenSendSheet = useCallback(async () => {
    const confirmedIds = visibleTeachers
      .filter((t) => normalizeSalaryStatus(t.salaryStatus) === 'confirmed')
      .map((t) => t.id);
    if (confirmedIds.length === 0) {
      Taro.showToast({ title: '暂无可发送的工资单', icon: 'none' });
      return;
    }
    setPendingSendAction({ type: 'batch', ids: confirmedIds });
    setSendResult(undefined);
    setSendSheetVisible(true);
    setSending(true);
    try {
      const result = await executeSend();
      setSendResult(result);
      const okCount = result?.success?.length ?? 0;
      const failCount = result?.failed?.length ?? 0;
      try {
        await auditLogService.record({
          action: 'salary.send_slip',
          operatorId: profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'salary_batch',
          detail: `发送工资单：成功 ${okCount} 份${failCount > 0 ? `，失败 ${failCount} 份` : ''}`,
          meta: { successCount: okCount, failedCount: failCount },
        });
      } catch (e) {
        logError('audit salary.send_slip', e);
      }
      if (okCount > 0) {
        try {
          await subscribeMessageService.runSalarySlipSendPrompt(okCount, {
            role: profile?.currentContext?.role,
            campusId: profile?.currentContext?.campusId,
          });
        } catch (error) {
          logError('subscribe E11 salary slip send', error);
        }
      }
    } catch {
      Taro.showToast({ title: '发送失败，请重试', icon: 'none' });
      setSendResult({ success: [], failed: [] });
    } finally {
      setSending(false);
    }
  }, [visibleTeachers, setPendingSendAction, executeSend, profile]);

  /** 切换课时费/提成展开状态 */
  const toggleExpand = useCallback((teacherId: string, key: 'lesson' | 'commission') => {
    setExpandedMap((prev) => ({
      ...prev,
      [teacherId]: {
        lesson: key === 'lesson' ? !prev[teacherId]?.lesson : (prev[teacherId]?.lesson ?? false),
        commission:
          key === 'commission'
            ? !prev[teacherId]?.commission
            : (prev[teacherId]?.commission ?? false),
      },
    }));
  }, []);

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background pb-[160rpx]')}>
      {/* 月份切换 */}
      <View className="flex items-center justify-between px-[40rpx] py-[24rpx] bg-card">
        <Text className="text-[28rpx] font-medium text-primary" onClick={handlePrevMonth}>
          上月
        </Text>
        <View
          className="flex items-center gap-[8rpx] press-bg px-[20rpx] py-[8rpx] rounded-[16rpx]"
          onClick={() => setMonthPickerVisible(true)}
        >
          <Text className="text-[36rpx] font-bold text-foreground">{labelMonth}</Text>
          <Icon name="mdi-chevron-down" size={20} className="text-muted-foreground" />
        </View>
        <Text
          className={cn(
            'text-[28rpx] font-medium',
            currentMonth >= dayjs().format('YYYY-MM') ? 'text-muted-foreground/40' : 'text-primary',
          )}
          onClick={handleNextMonth}
        >
          下月
        </Text>
      </View>

      {/* 统计卡片 */}
      {visibleTeachers.length > 0 && (
        <View className="mx-[32rpx] mt-[16rpx] bg-card rounded-[28rpx] p-[32rpx] shadow-card">
          {/* 第一行 */}
          <View className="flex items-start justify-between mb-[24rpx]">
            <View>
              <Text className="text-[24rpx] text-muted-foreground block">实发合计</Text>
              <Text className="text-[48rpx] font-extrabold text-foreground mt-[4rpx] block">
                {stats.total.toFixed(2)}
              </Text>
            </View>
            <View className="text-right">
              <Text className="text-[24rpx] text-muted-foreground block">员工数</Text>
              <Text className="text-[40rpx] font-extrabold text-foreground mt-[4rpx] block">
                {stats.staffCount}
              </Text>
            </View>
          </View>
          {/* 第二行 */}
          <View className="flex items-start justify-between mb-[24rpx]">
            <View>
              <Text className="text-[24rpx] text-muted-foreground block">奖金合计</Text>
              <Text className="text-[32rpx] font-bold text-success mt-[4rpx] block">
                +{stats.bonus.toFixed(2)}
              </Text>
            </View>
            <View className="text-right">
              <Text className="text-[24rpx] text-muted-foreground block">罚款合计</Text>
              <Text className="text-[32rpx] font-bold text-destructive mt-[4rpx] block">
                -{stats.deduct.toFixed(2)}
              </Text>
            </View>
          </View>
          {/* 当前状态汇总 */}
          <View>
            <View className="flex items-center gap-[8rpx] mb-[16rpx]">
              <Text className="text-[24rpx] text-muted-foreground">当前状态</Text>
              <View
                className="w-[30rpx] h-[30rpx] rounded-full border-[2rpx] border-solid border-muted-foreground bg-transparent flex items-center justify-center press-scale"
                onClick={() => setStatusExplainVisible(true)}
              >
                <Text className="text-[20rpx] leading-none text-muted-foreground font-semibold">
                  ?
                </Text>
              </View>
            </View>
            <View className="flex flex-wrap gap-[12rpx]">
              {(Object.keys(SALARY_STATUS_META) as SalaryStatus[]).map((status) => {
                const count = stats.statusCounts[status];
                if (count === 0) return null;
                const meta = SALARY_STATUS_META[status];
                return (
                  <View
                    key={status}
                    className={cn(
                      'px-[16rpx] py-[6rpx] rounded-[12rpx] text-[22rpx] font-medium',
                      meta.bgClass,
                      meta.textClass,
                    )}
                  >
                    {meta.label} {count}人
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* 员工薪资列表 */}
      {visibleTeachers.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-[160rpx]">
          <Icon name="mdi-file-document-outline" size={80} className="text-muted-foreground/30" />
          <Text className="text-[28rpx] text-muted-foreground mt-[24rpx]">
            {currentMonth > dayjs().format('YYYY-MM')
              ? '未来月份暂无数据'
              : `${labelMonth}暂无薪资数据`}
          </Text>
        </View>
      ) : (
        <View className="mt-[32rpx] px-[32rpx] flex flex-col gap-[20rpx]">
          {sortedVisibleTeachers.map((t) => {
            const lessonFee = t.hours * t.rate;
            const social = 0;
            const status = normalizeSalaryStatus(t.salaryStatus);
            const statusMeta = SALARY_STATUS_META[status];
            const expanded = expandedMap[t.id] || { lesson: false, commission: false };
            return (
              <View
                key={t.id}
                className="bg-card rounded-[28rpx] p-[28rpx] shadow-card press-bg"
                onClick={() => handleOpenDetail(t)}
              >
                {/* 姓名行 */}
                <View className="flex items-center justify-between mb-[24rpx]">
                  <View className="flex items-center gap-[12rpx]">
                    <Text className="text-[32rpx] font-bold text-foreground">{t.name}</Text>
                    <View
                      className={cn(
                        'px-[14rpx] py-[4rpx] rounded-[10rpx] text-[20rpx] font-medium',
                        statusMeta.bgClass,
                        statusMeta.textClass,
                      )}
                    >
                      {statusMeta.label}
                    </View>
                  </View>
                  <Text className="text-[40rpx] font-extrabold text-foreground">
                    {calcTotal(t).toFixed(2)}
                  </Text>
                </View>

                {/* 薪资构成 2x2 */}
                <View className="grid grid-cols-2 gap-y-[16rpx] gap-x-[24rpx] mb-[24rpx]">
                  <View className="flex items-center justify-between">
                    <Text className="text-[24rpx] text-muted-foreground">底薪</Text>
                    <Text className="text-[24rpx] text-foreground">{t.base.toFixed(2)}</Text>
                  </View>
                  <View
                    className="flex items-center justify-between press-scale"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(t.id, 'lesson');
                    }}
                  >
                    <View className="flex items-center gap-[8rpx]">
                      <Text className="text-[24rpx] text-muted-foreground">课时费</Text>
                      <Icon
                        name={expanded.lesson ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                        size={16}
                        className="text-muted-foreground"
                      />
                    </View>
                    <Text className="text-[24rpx] text-foreground">{lessonFee.toFixed(2)}</Text>
                  </View>
                  <View
                    className="flex items-center justify-between press-scale"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(t.id, 'commission');
                    }}
                  >
                    <View className="flex items-center gap-[8rpx]">
                      <Text className="text-[24rpx] text-muted-foreground">提成</Text>
                      <Icon
                        name={expanded.commission ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                        size={16}
                        className="text-muted-foreground"
                      />
                    </View>
                    <Text className="text-[24rpx] text-foreground">
                      {(t.attend + t.perf).toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex items-center justify-between">
                    <Text className="text-[24rpx] text-muted-foreground">社保</Text>
                    <Text className="text-[24rpx] text-foreground">-{social.toFixed(2)}</Text>
                  </View>
                </View>

                {/* 课时费流水 */}
                {expanded.lesson && (
                  <View
                    className="mb-[20rpx] py-[16rpx] px-[20rpx] bg-muted rounded-[16rpx]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(t.categoryLessonFees || []).length === 0 ? (
                      <Text className="text-[24rpx] text-muted-foreground py-[10rpx]">
                        暂无课时费明细
                      </Text>
                    ) : (
                      (t.categoryLessonFees || []).map((item, idx) => (
                        <View key={idx} className="flex items-center justify-between py-[10rpx]">
                          <Text className="text-[24rpx] text-muted-foreground">
                            {item.categoryName || '课时费'}
                          </Text>
                          <Text className="text-[24rpx] text-foreground">
                            +{Number(item.amount ?? 0).toFixed(2)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* 提成流水 */}
                {expanded.commission && (
                  <View
                    className="mb-[20rpx] py-[16rpx] px-[20rpx] bg-muted rounded-[16rpx]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[
                      ...(t.attend > 0 ? [{ name: '全勤奖', amount: t.attend }] : []),
                      ...(t.perf > 0 ? [{ name: '绩效提成', amount: t.perf }] : []),
                    ].length === 0 ? (
                      <Text className="text-[24rpx] text-muted-foreground py-[10rpx]">
                        暂无提成明细
                      </Text>
                    ) : (
                      [
                        ...(t.attend > 0 ? [{ name: '全勤奖', amount: t.attend }] : []),
                        ...(t.perf > 0 ? [{ name: '绩效提成', amount: t.perf }] : []),
                      ].map((rec, idx) => (
                        <View key={idx} className="flex items-center justify-between py-[10rpx]">
                          <Text className="text-[24rpx] text-muted-foreground">{rec.name}</Text>
                          <Text className="text-[24rpx] text-foreground">
                            +{rec.amount.toFixed(2)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* 操作行 */}
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-[24rpx]">
                    <Text className="text-[26rpx] font-medium text-primary">
                      {getStatusHintText(status)}
                    </Text>
                  </View>
                  <View className="flex items-center gap-[4rpx] px-[12rpx] py-[6rpx] rounded-[12rpx]">
                    <Text className="text-[24rpx] text-muted-foreground">查看 · 调整明细</Text>
                    <Icon name="mdi-chevron-right" size={18} className="text-muted-foreground" />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 底部按钮区 — 仅有数据时显示 */}
      {visibleTeachers.length > 0 && (stats.pending > 0 || stats.confirmed > 0) && (
        <View className="fixed bottom-0 left-0 right-0 px-[32rpx] py-[24rpx] pb-safe-bar bg-card/95 backdrop-blur border-t border-border z-20">
          {stats.pending > 0 ? (
            <View
              className={cn(
                'w-full py-[28rpx] rounded-full text-[32rpx] font-bold text-center shadow-card press-scale',
                'bg-primary text-primary-foreground',
              )}
              onClick={handleBatchConfirm}
            >
              一键核对（{stats.pending}人）
            </View>
          ) : (
            <View
              className="w-full py-[28rpx] rounded-full bg-primary text-primary-foreground text-[32rpx] font-bold text-center shadow-primary press-scale"
              onClick={handleOpenSendSheet}
            >
              发送工资单（{stats.confirmed}人）
            </View>
          )}
        </View>
      )}

      {/* 月份选择弹窗 */}
      <MonthPickerSheet
        visible={monthPickerVisible}
        value={currentMonth}
        onConfirm={(value) => {
          setCurrentMonth(value);
          setSalaryMonth(value);
          setMonthPickerVisible(false);
          void fetchAll(value);
        }}
        onClose={() => setMonthPickerVisible(false)}
      />

      {/* 发送工资单结果弹窗 */}
      <SendSalarySheet
        visible={sendSheetVisible}
        count={stats.confirmed}
        submitting={sending}
        result={sendResult}
        onClose={() => {
          setSendSheetVisible(false);
          setPendingSendAction(null);
          setSendResult(undefined);
        }}
      />

      {/* 工资单状态说明弹窗 */}
      <SalaryStatusExplainSheet
        visible={statusExplainVisible}
        onClose={() => setStatusExplainVisible(false)}
      />

      {/* 新手引导弹窗 */}
      <PageIntroSheet
        visible={introVisible}
        currentStep={6}
        totalSteps={6}
        title="第 6 步：薪资规则"
        description="在列表页先一键核对，再发送工资单，核对后进入详情页即可查看工资单。"
        bulletPoints={[
          '点击卡片进入详情页调整奖金、罚款等自定义项',
          '调整完成后返回列表页，点击底部「一键核对」',
          '核对完成后再点击「发送工资单」，详情页自动变为工资单视图',
        ]}
        storageKey={PAGE_INTRO_KEY}
        onClose={() => setIntroVisible(false)}
      />
    </View>
  );
};

export default SalaryPaymentPage;
