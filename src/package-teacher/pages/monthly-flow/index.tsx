/**
 * 教师端「教学台账」
 * Tab：课时流水 / 工资记录 / 我的预约
 * 上下班签到考勤 → 下个版本；课消请用「上课记录」
 */
import { View, Text } from '@tarojs/components';
import Taro, { getCurrentInstance, useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import SegmentedControl from '@/components/SegmentedControl';
import { teacherService } from '@/services/teacher';
import {
  SALARY_TYPE_LABEL,
  salaryLineSigned,
  teacherMonthlyFlowService,
  type TeacherMonthlyFlowBundle,
  type TeacherMonthlyFlowTab,
} from '@/services/teacher-monthly-flow';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

const TABS: { key: TeacherMonthlyFlowTab; label: string }[] = [
  { key: 'lessons', label: '课时流水' },
  { key: 'salary', label: '工资记录' },
];

const TAB_OPTIONS = TABS.map((t) => ({ label: t.label, value: t.key }));

function readTabFromRouter(): TeacherMonthlyFlowTab | undefined {
  const raw = getCurrentInstance()?.router?.params?.tab as string | undefined;
  // 旧链 ?tab=attendance / bookings 已下线，落到课时流水
  if (raw === 'attendance' || raw === 'bookings') return 'lessons';
  const tab = raw as TeacherMonthlyFlowTab | undefined;
  return TABS.some((t) => t.key === tab) ? tab : undefined;
}

function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN')}`;
}

const MonthlyFlowPage: React.FC = () => {
  useCardNavigationBar();

  const [month, setMonth] = useState(() => dayjs().format('YYYY-MM'));
  const [activeTab, setActiveTab] = useState<TeacherMonthlyFlowTab>(
    () => readTabFromRouter() ?? 'lessons',
  );
  const [bundle, setBundle] = useState<TeacherMonthlyFlowBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    const tab = readTabFromRouter();
    if (tab) setActiveTab(tab);
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 不传 profile.id：校长 JWT 的 profile.id ≠ Teacher.id，由服务走 /teachers/me
      const data = await teacherMonthlyFlowService.getMonthlyFlow(month);
      setBundle(data);
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' });
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handlePrevMonth = useCallback(() => {
    setMonth((prev) => dayjs(`${prev}-01`).subtract(1, 'month').format('YYYY-MM'));
  }, []);

  const handleNextMonth = useCallback(() => {
    const next = dayjs(`${month}-01`).add(1, 'month');
    if (next.isAfter(dayjs(), 'month')) {
      Taro.showToast({ title: '已是最新月份', icon: 'none' });
      return;
    }
    setMonth(next.format('YYYY-MM'));
  }, [month]);

  const handleOpenSalarySlip = useCallback(() => {
    void (async () => {
      try {
        const me = await teacherService.getMe();
        const teacherId = me?.id;
        if (!teacherId) {
          Taro.showToast({ title: '无法识别教师身份', icon: 'none' });
          return;
        }
        await Taro.navigateTo({
          url: `/package-teacher/pages/salary-detail/index?id=${encodeURIComponent(teacherId)}&mode=slip&month=${encodeURIComponent(month)}`,
        });
      } catch {
        Taro.showToast({ title: '无法识别教师身份', icon: 'none' });
      }
    })();
  }, [month]);

  const monthLabel = useMemo(() => dayjs(`${month}-01`).format('YYYY年M月'), [month]);

  const summaryCards = useMemo(() => {
    if (!bundle) return [];
    const { summary } = bundle;
    return [
      { label: '应发', value: `${summary.payableAmount}`, unit: '元' },
      { label: '实发', value: `${summary.paidAmount}`, unit: '元' },
      { label: '课时', value: `${summary.lessonHours}`, unit: '节' },
      { label: '预约', value: `${summary.bookingCount}`, unit: '条' },
    ];
  }, [bundle]);

  const salaryLineTotal = useMemo(() => {
    if (!bundle) return 0;
    return bundle.salary.reduce((sum, item) => sum + salaryLineSigned(item), 0);
  }, [bundle]);

  return (
    <PageContainer>
      <View className="min-h-screen bg-background pb-[calc(32rpx+env(safe-area-inset-bottom))]">
        <View className="mx-[32rpx] mt-[24rpx] px-[24rpx] py-[20rpx] rounded-[24rpx] bg-card shadow-soft flex flex-row items-center justify-between">
          <View
            className="w-[64rpx] h-[64rpx] rounded-full bg-muted flex items-center justify-center active:opacity-70"
            onClick={handlePrevMonth}
          >
            <Icon name="mdi-chevron-right" size={32} className="text-foreground rotate-180" />
          </View>
          <Text className="text-[30rpx] font-semibold text-foreground">{monthLabel}</Text>
          <View
            className="w-[64rpx] h-[64rpx] rounded-full bg-muted flex items-center justify-center active:opacity-70"
            onClick={handleNextMonth}
          >
            <Icon name="mdi-chevron-right" size={32} className="text-foreground" />
          </View>
        </View>

        <View className="mx-[32rpx] mt-[20rpx] rounded-[24rpx] bg-card shadow-soft px-[12rpx] py-[24rpx] flex flex-row">
          {summaryCards.map((item) => (
            <View key={item.label} className="flex-1 flex flex-col items-center">
              <View className="flex flex-row items-baseline">
                <Text className="text-[34rpx] font-bold text-foreground">{item.value}</Text>
                <Text className="text-[20rpx] text-muted-foreground ml-[4rpx]">{item.unit}</Text>
              </View>
              <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">{item.label}</Text>
            </View>
          ))}
        </View>

        <View className="mx-[32rpx] mt-[24rpx]">
          <SegmentedControl
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(v) => setActiveTab(v as TeacherMonthlyFlowTab)}
          />
        </View>

        <View className="mx-[32rpx] mt-[24rpx]">
          {loading ? (
            <View className="py-[120rpx] flex items-center justify-center">
              <Loading text="加载中..." />
            </View>
          ) : !bundle ? (
            <Empty description="暂无数据" />
          ) : activeTab === 'lessons' ? (
            bundle.lessons.length === 0 ? (
              <Empty description="本月暂无课时记录" />
            ) : (
              <View className="rounded-[24rpx] bg-card shadow-soft overflow-hidden">
                {bundle.lessons.map((item, index) => (
                  <View
                    key={item.id}
                    className={cn(
                      'px-[28rpx] py-[24rpx] flex flex-row items-center justify-between',
                      index < bundle.lessons.length - 1 && 'border-b border-border/40',
                    )}
                  >
                    <View className="flex-1 min-w-0">
                      <Text className="text-[28rpx] font-semibold text-foreground block">
                        {item.courseName}
                      </Text>
                      <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] block">
                        {item.date} · {item.studentCount} 人到课
                      </Text>
                    </View>
                    <View className="ml-[16rpx] flex flex-col items-end">
                      <Text className="text-[28rpx] font-bold text-primary">{item.hours} 课时</Text>
                      {item.consumeAmount != null ? (
                        <Text className="text-[22rpx] text-muted-foreground mt-[4rpx]">
                          耗课 {formatMoney(item.consumeAmount)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : activeTab === 'salary' ? (
            bundle.salary.length === 0 ? (
              <View className="flex flex-col gap-[20rpx]">
                <Empty description="本月暂无工资明细" />
                <View
                  className="mx-[8rpx] rounded-[24rpx] bg-card shadow-soft px-[28rpx] py-[28rpx] flex flex-row items-center justify-between press-scale"
                  onClick={handleOpenSalarySlip}
                >
                  <Text className="text-[28rpx] text-foreground">查看正式工资单</Text>
                  <Icon name="mdi-chevron-right" size={28} className="text-muted-foreground" />
                </View>
              </View>
            ) : (
              <View className="flex flex-col gap-[20rpx]">
                <View
                  className="rounded-[24rpx] bg-card shadow-soft px-[28rpx] py-[24rpx] press-scale"
                  onClick={handleOpenSalarySlip}
                >
                  <View className="flex flex-row items-center justify-between mb-[16rpx]">
                    <Text className="text-[28rpx] font-semibold text-foreground">本月薪资</Text>
                    <View className="flex flex-row items-center gap-[12rpx]">
                      <View
                        className={cn(
                          'px-[14rpx] py-[4rpx] rounded-full',
                          bundle.summary.salaryStatus === 'paid' ? 'bg-success-15' : 'bg-muted',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-[22rpx] font-medium',
                            bundle.summary.salaryStatus === 'paid'
                              ? 'text-success'
                              : 'text-muted-foreground',
                          )}
                        >
                          {bundle.summary.salaryStatus === 'paid' ? '已发放' : '未发放'}
                        </Text>
                      </View>
                      <Text className="text-[22rpx] text-primary">查看工资单</Text>
                    </View>
                  </View>
                  <View className="flex flex-row gap-[32rpx]">
                    <View className="flex-1">
                      <Text className="text-[22rpx] text-muted-foreground block">应发</Text>
                      <Text className="text-[32rpx] font-bold text-foreground mt-[4rpx] block">
                        {formatMoney(bundle.summary.payableAmount)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[22rpx] text-muted-foreground block">实发</Text>
                      <Text
                        className={cn(
                          'text-[32rpx] font-bold mt-[4rpx] block',
                          bundle.summary.salaryStatus === 'paid'
                            ? 'text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatMoney(bundle.summary.paidAmount)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="rounded-[24rpx] bg-card shadow-soft overflow-hidden">
                  {bundle.salary.map((item, index) => {
                    const signed = salaryLineSigned(item);
                    const isDeduct = signed < 0;
                    return (
                      <View
                        key={item.id}
                        className={cn(
                          'px-[28rpx] py-[24rpx] flex flex-row items-center justify-between',
                          index < bundle.salary.length - 1 && 'border-b border-border/40',
                        )}
                      >
                        <View className="flex-1 min-w-0">
                          <View className="flex flex-row items-center gap-[12rpx]">
                            <Text className="text-[28rpx] font-semibold text-foreground">
                              {item.title}
                            </Text>
                            <View className="px-[10rpx] py-[2rpx] rounded-full bg-primary/10">
                              <Text className="text-[20rpx] text-primary">
                                {SALARY_TYPE_LABEL[item.type]}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] block">
                            {item.date}
                            {item.remark ? ` · ${item.remark}` : ''}
                          </Text>
                        </View>
                        <Text
                          className={cn(
                            'text-[30rpx] font-bold ml-[16rpx]',
                            isDeduct ? 'text-destructive' : 'text-foreground',
                          )}
                        >
                          {isDeduct ? '-' : '+'}
                          {formatMoney(Math.abs(signed))}
                        </Text>
                      </View>
                    );
                  })}
                  <View className="px-[28rpx] py-[20rpx] bg-muted/40 flex flex-row items-center justify-between">
                    <Text className="text-[24rpx] text-muted-foreground">明细合计（= 应发）</Text>
                    <Text className="text-[28rpx] font-bold text-foreground">
                      {formatMoney(salaryLineTotal)}
                    </Text>
                  </View>
                </View>
              </View>
            )
          ) : (
            <Empty description="暂无数据" />
          )}
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(MonthlyFlowPage);
