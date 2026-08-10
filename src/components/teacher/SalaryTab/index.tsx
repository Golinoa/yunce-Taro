import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import SalaryItem from '@/components/teacher/SalaryItem';
import type { SalarySubTab as SalarySubTabType } from '@/package-teacher/pages/teacher-list/useTeacherList';
import type { TeacherUIModel, SalaryModel, SalarySettings } from '@/types/teacher';

export interface SalaryTabProps {
  salarySubTab: SalarySubTabType;
  setSalarySubTab: (tab: SalarySubTabType) => void;
  salaryTeachers: TeacherUIModel[];
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  pendingCount: number;
  totalHours: number;
  totalSalary: number;
  settings: SalarySettings;
  pushEnabled: boolean;
  setPushEnabled: (v: boolean) => void;
  updateSettings: (updates: Record<string, unknown>) => Promise<void>;
  salaryModels: SalaryModel[];
  teachers: TeacherUIModel[];
  onBatchAction: (action: 'confirm' | 'pay') => void;
  onSalaryAction: (teacherId: string) => void;
  onSalaryDetail: (teacherId: string) => void;
  onPaymentSettingsOpen: () => void;
  onSalaryModelOpen: (model: SalaryModel | null) => void;
  historyYear: number;
  historyMonth: number;
  historyRecords: Array<{
    teacherId: string;
    name: string;
    subject: string;
    amount: number;
    status: string;
    remark?: string;
    paidAt?: string;
  }>;
  historyTotalAmount: number;
  historyTotalHours: number;
  onMonthPickerOpen: () => void;
  onHistoryMonthChange: (year: number, month: number) => void;
}

/** 薪资 Tab 组件 - 包含本月/历史/设置三个子Tab */
const SalaryTab: React.FC<SalaryTabProps> = ({
  salarySubTab,
  setSalarySubTab,
  salaryTeachers,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  pendingCount,
  totalHours,
  totalSalary,
  settings,
  pushEnabled,
  setPushEnabled,
  updateSettings,
  salaryModels,
  teachers,
  onBatchAction,
  onSalaryAction,
  onSalaryDetail,
  onPaymentSettingsOpen,
  onSalaryModelOpen,
  historyYear,
  historyMonth,
  historyRecords,
  historyTotalAmount,
  historyTotalHours,
  onMonthPickerOpen,
  onHistoryMonthChange,
}) => {
  const unpaidTeachers = salaryTeachers.filter((t) => t.salaryStatus !== 'archived');

  return (
    <View className="flex-1 flex flex-col overflow-hidden h-0">
      {/* 薪资子Tab */}
      <View className="flex bg-card border-b border-border px-[32rpx]">
        {(['current', 'history', 'settings'] as SalarySubTabType[]).map((tab) => (
          <View
            key={tab}
            className={cn(
              'flex-1 text-center py-[22rpx] text-[26rpx] font-medium text-muted-foreground relative',
              salarySubTab === tab && 'text-primary font-semibold',
            )}
            onClick={() => setSalarySubTab(tab)}
          >
            {tab === 'current' ? '本月' : tab === 'history' ? '历史' : '设置'}
            {salarySubTab === tab && <View className="sub-tab-indicator" />}
          </View>
        ))}
      </View>

      {/* 本月 */}
      {salarySubTab === 'current' && (
        <ScrollView className="flex-1 h-0" scrollY>
          <View className="px-[32rpx] py-[24rpx] pb-[48rpx]">
            {/* 发薪提醒 */}
            <View className="reminder-card">
              <Text className="text-[40rpx] flex-shrink-0">⚠️</Text>
              <Text className="text-[24rpx] text-amber flex-1 leading-[1.5]">
                每月 <Text className="font-bold">{settings.payDay}号</Text> 发放工资，提前
                {settings.pushDaysBefore}天推送薪资报表
              </Text>
              <View
                className="py-[12rpx] px-[24rpx] rounded-[16rpx] bg-amber flex-shrink-0"
                onClick={onPaymentSettingsOpen}
              >
                <Text className="text-[22rpx] font-semibold text-white">设置</Text>
              </View>
            </View>

            {/* 快捷发薪入口 */}
            <View className="quick-pay-card">
              <View className="absolute top-[-40rpx] right-[-40rpx] w-[160rpx] h-[160rpx] rounded-full bg-white/10" />
              <View className="absolute bottom-[-30rpx] left-[60rpx] w-[100rpx] h-[100rpx] rounded-full bg-white/6" />

              <View className="flex items-center justify-between relative z-1">
                <View className="flex items-center gap-[24rpx] flex-1 min-w-0">
                  <View className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Text className="text-[40rpx]">💰</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[30rpx] font-bold text-white block">
                      {dayjs().month() + 1}月工资待处理
                    </Text>
                    <Text className="text-[24rpx] text-white/85 mt-[4rpx] block">
                      <Text className="font-extrabold">{pendingCount}</Text> 位教师待确认/发放
                    </Text>
                  </View>
                </View>
              </View>
              <View className="mt-[20rpx] relative z-1">
                <Text className="text-[24rpx] text-white/90">
                  距发薪日还有{' '}
                  <Text className="font-bold">{Math.max(0, settings.payDay - dayjs().date())}</Text>{' '}
                  天
                </Text>
              </View>
              {unpaidTeachers.length > 0 && (
                <View className="flex gap-[8rpx] mt-[16rpx] flex-wrap relative z-1">
                  {unpaidTeachers.slice(0, 4).map((t) => (
                    <View key={t.id} className="py-[4rpx] px-[16rpx] rounded-[12rpx] bg-white/20">
                      <Text className="text-[22rpx] text-white">{t.name}</Text>
                    </View>
                  ))}
                  {unpaidTeachers.length > 4 && (
                    <View className="py-[4rpx] px-[16rpx] rounded-[12rpx] bg-white/20">
                      <Text className="text-[22rpx] text-white">+{unpaidTeachers.length - 4}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* 汇总 */}
            <View className="salary-summary">
              <View className="flex-1 text-center py-[20rpx] bg-background rounded-[20rpx] mx-[8rpx] first:ml-0 last:mr-0">
                <Text className="text-[36rpx] font-extrabold text-primary block">
                  {totalSalary.toLocaleString()}
                </Text>
                <Text className="text-[20rpx] text-muted-foreground block mt-[4rpx]">应发总额</Text>
              </View>
              <View className="flex-1 text-center py-[20rpx] bg-background rounded-[20rpx] mx-[8rpx]">
                <Text className="text-[36rpx] font-extrabold text-foreground block">
                  {totalHours}
                </Text>
                <Text className="text-[20rpx] text-muted-foreground block mt-[4rpx]">总课时</Text>
              </View>
              <View className="flex-1 text-center py-[20rpx] bg-background rounded-[20rpx] mx-[8rpx]">
                <Text className="text-[36rpx] font-extrabold text-amber block">{pendingCount}</Text>
                <Text className="text-[20rpx] text-muted-foreground block mt-[4rpx]">待确认</Text>
              </View>
            </View>

            {/* 批量操作栏 */}
            {unpaidTeachers.length > 0 && (
              <View className="batch-bar">
                <View className="flex items-center gap-[16rpx]" onClick={toggleSelectAll}>
                  <View
                    className={cn(
                      'w-[44rpx] h-[44rpx] rounded-xl border-[4rpx] border-solid border-border flex items-center justify-center',
                      selectedIds.length === unpaidTeachers.length && 'bg-amber border-amber',
                    )}
                  >
                    {selectedIds.length === unpaidTeachers.length && (
                      <Text className="text-white text-[24rpx] font-bold">✓</Text>
                    )}
                  </View>
                  <Text className="text-[24rpx] text-muted-foreground">
                    全选 · 已选 {selectedIds.length} 人
                  </Text>
                </View>
                <View className="flex gap-[16rpx]">
                  <View
                    className="py-[12rpx] px-[28rpx] rounded-xl text-[24rpx] font-semibold bg-amber-10 text-amber press-scale"
                    onClick={() => onBatchAction('confirm')}
                  >
                    批量确认
                  </View>
                  <View
                    className="py-[12rpx] px-[28rpx] rounded-xl text-[24rpx] font-semibold bg-class-amber text-white press-scale"
                    onClick={() => onBatchAction('pay')}
                  >
                    批量发放
                  </View>
                </View>
              </View>
            )}

            {/* 薪资明细 */}
            <Text className="text-[28rpx] font-bold text-foreground mb-[20rpx] block">
              {dayjs().month() + 1}月薪资明细
            </Text>
            {salaryTeachers.map((t) => (
              <SalaryItem
                key={t.id}
                teacher={t}
                selected={selectedIds.includes(t.id)}
                selectable
                onToggleSelect={() => toggleSelect(t.id)}
                onAction={() => onSalaryAction(t.id)}
                onViewDetail={() => onSalaryDetail(t.id)}
                onClick={() => onSalaryDetail(t.id)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* 历史 */}
      {salarySubTab === 'history' && (
        <ScrollView className="flex-1 h-0" scrollY>
          <View className="px-[32rpx] py-[24rpx] pb-[48rpx]">
            {historyRecords.length === 0 ? (
              <View className="flex flex-col items-center justify-center py-[160rpx] px-[80rpx]">
                <View className="w-[160rpx] h-[160rpx] rounded-full bg-muted flex items-center justify-center mb-[32rpx]">
                  <Text className="text-[72rpx]">📋</Text>
                </View>
                <Text className="text-[32rpx] font-semibold text-foreground mb-[12rpx]">
                  暂无历史记录
                </Text>
                <Text className="text-[26rpx] text-muted-foreground text-center leading-[1.5]">
                  确认发放薪资后，记录将在此展示
                </Text>
              </View>
            ) : (
              <>
                {/* 月份导航 */}
                <View className="flex items-center justify-center gap-[24rpx] py-[28rpx]">
                  <View
                    className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
                    onClick={() => {
                      const d = dayjs(`${historyYear}-${historyMonth}-01`).subtract(1, 'month');
                      onHistoryMonthChange(d.year(), d.month() + 1);
                    }}
                  >
                    <Text className="text-[36rpx] text-muted-foreground">‹</Text>
                  </View>
                  <View
                    className="flex items-center gap-[8rpx] py-[8rpx] px-[20rpx] rounded-[16rpx]"
                    onClick={onMonthPickerOpen}
                  >
                    <Text className="text-[30rpx] font-semibold text-foreground">
                      {historyYear}年{historyMonth}月
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground">▼</Text>
                  </View>
                  <View
                    className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
                    onClick={() => {
                      const d = dayjs(`${historyYear}-${historyMonth}-01`).add(1, 'month');
                      onHistoryMonthChange(d.year(), d.month() + 1);
                    }}
                  >
                    <Text className="text-[36rpx] text-muted-foreground">›</Text>
                  </View>
                </View>

                {/* 历史汇总 */}
                <View className="mb-[28rpx]">
                  <View className="flex bg-card rounded-xl py-[28rpx]">
                    <View className="flex-1 text-center border-r border-border/50">
                      <Text className="text-[32rpx] font-bold text-foreground block mb-[4rpx]">
                        ¥{historyTotalAmount.toLocaleString()}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground block">实发总额</Text>
                    </View>
                    <View className="flex-1 text-center border-r border-border/50">
                      <Text className="text-[32rpx] font-bold text-foreground block mb-[4rpx]">
                        {historyRecords.length}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground block">发薪人数</Text>
                    </View>
                    <View className="flex-1 text-center">
                      <Text className="text-[32rpx] font-bold text-foreground block mb-[4rpx]">
                        {historyTotalHours}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground block">总课时</Text>
                    </View>
                  </View>
                  <View className="flex items-center justify-between py-[20rpx] px-[28rpx] bg-success-10 rounded-[20rpx] mt-[16rpx]">
                    <View className="flex items-center gap-[8rpx]">
                      <Text className="text-[28rpx] text-success">✓</Text>
                      <Text className="text-[24rpx] font-semibold text-success">已发放</Text>
                    </View>
                    <Text className="text-[24rpx] text-muted-foreground">
                      发放日期：{historyYear}-{String(historyMonth).padStart(2, '0')}-
                      {settings.payDay}
                    </Text>
                  </View>
                </View>

                {/* 历史列表 */}
                {historyRecords.map((rec) => (
                  <View
                    key={`${rec.teacherId}-${rec.amount}`}
                    className="bg-card rounded-xl py-[24rpx] px-[28rpx] mb-[16rpx]"
                    onClick={() => onSalaryDetail(rec.teacherId)}
                  >
                    <View className="flex items-center justify-between">
                      <View className="flex-1">
                        <View className="flex items-center gap-[8rpx]">
                          <Text className="text-[26rpx] font-semibold text-foreground">
                            {rec.name}
                          </Text>
                          {rec.remark && (
                            <Text className="text-[22rpx] text-amber font-medium">
                              {rec.remark}
                            </Text>
                          )}
                        </View>
                        <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block">
                          {rec.subject}
                        </Text>
                      </View>
                      <View className="flex items-center gap-[8rpx] flex-shrink-0">
                        <Text className="text-[30rpx] font-bold text-success">
                          ¥{rec.amount.toLocaleString()}
                        </Text>
                        <Text className="text-[32rpx] text-muted-foreground opacity-50">›</Text>
                      </View>
                    </View>
                    {rec.paidAt && (
                      <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                        发放日期：{rec.paidAt}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* 设置 */}
      {salarySubTab === 'settings' && (
        <ScrollView className="flex-1 h-0" scrollY>
          <View className="px-[32rpx] py-[24rpx] pb-[48rpx]">
            {/* 发薪设置 */}
            <View className="mb-[32rpx]">
              <Text className="text-[28rpx] font-semibold text-foreground mb-[28rpx] block">
                发薪设置
              </Text>
              <View className="bg-card rounded-xl overflow-hidden">
                <View className="flex items-center py-[28rpx] px-[28rpx] gap-[16rpx] border-b border-border/50">
                  <Text className="text-[26rpx] text-foreground font-medium min-w-[160rpx]">
                    发薪日
                  </Text>
                  <Text className="flex-1 text-[26rpx] text-muted-foreground">
                    每月 <Text className="text-foreground font-semibold">{settings.payDay}号</Text>
                  </Text>
                  <Text
                    className="text-[24rpx] text-primary font-medium py-[8rpx] px-[16rpx] rounded-[12rpx]"
                    onClick={onPaymentSettingsOpen}
                  >
                    修改
                  </Text>
                </View>
                <View className="flex items-center py-[28rpx] px-[28rpx] gap-[16rpx] border-b border-border/50">
                  <Text className="text-[26rpx] text-foreground font-medium min-w-[160rpx]">
                    薪资报表推送
                  </Text>
                  <Text className="flex-1 text-[26rpx] text-muted-foreground">
                    发薪前{' '}
                    <Text className="text-foreground font-semibold">
                      {settings.pushDaysBefore}天
                    </Text>
                  </Text>
                  <Text
                    className="text-[24rpx] text-primary font-medium py-[8rpx] px-[16rpx] rounded-[12rpx]"
                    onClick={onPaymentSettingsOpen}
                  >
                    修改
                  </Text>
                </View>
                <View className="flex items-center py-[28rpx] px-[28rpx] gap-[16rpx]">
                  <Text className="text-[26rpx] text-foreground font-medium min-w-[160rpx]">
                    推送提醒
                  </Text>
                  <Text className="flex-1 text-[26rpx] text-muted-foreground">
                    发薪前推送薪资报表
                  </Text>
                  <View
                    className={cn(
                      'w-[88rpx] h-[52rpx] rounded-[26rpx] relative flex-shrink-0 transition-colors',
                      pushEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
                    )}
                    onClick={() => {
                      setPushEnabled(!pushEnabled);
                      updateSettings({ pushEnabled: !pushEnabled });
                    }}
                  >
                    <View
                      className={cn(
                        'absolute top-[6rpx] w-[40rpx] h-[40rpx] rounded-full bg-white shadow-sm transition-transform',
                        pushEnabled ? 'left-[42rpx]' : 'left-[6rpx]',
                      )}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* 工资模型 */}
            <View className="mb-[32rpx]">
              <View className="flex items-center justify-between mb-[20rpx]">
                <Text className="text-[28rpx] font-semibold text-foreground">工资模型</Text>
                <Text
                  className="text-[24rpx] text-primary font-medium"
                  onClick={() => onSalaryModelOpen(null)}
                >
                  + 新建薪资模板
                </Text>
              </View>
              {salaryModels.map((model, idx) => (
                <View
                  key={model.id}
                  className={cn('salary-model-card', idx !== 0 && 'border-l-info')}
                  onClick={() => onSalaryModelOpen(model)}
                >
                  <View className="flex items-center gap-[12rpx]">
                    <Text className="text-[28rpx] font-bold text-foreground">{model.name}</Text>
                    {model.isDefault && (
                      <View className="py-[4rpx] px-[12rpx] rounded-[8rpx] bg-secondary text-primary text-[20rpx] font-medium">
                        默认
                      </View>
                    )}
                    {!model.isDefault && idx === 1 && (
                      <View className="py-[4rpx] px-[12rpx] rounded-[8rpx] bg-info-10 text-info text-[20rpx] font-medium">
                        助教
                      </View>
                    )}
                  </View>
                  <Text className="text-[24rpx] text-muted-foreground mt-[12rpx] leading-[1.6] block">
                    {model.type === 'standard'
                      ? '底薪 + 课时费(统一/按班级) + 全勤奖 + 绩效奖金'
                      : model.type === 'hourly'
                        ? '课时费(统一/按班级)，无底薪无奖金'
                        : '自定义参数'}
                  </Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                    {teachers.filter((t) => t.modelIdx === idx).length}位教师使用
                  </Text>
                </View>
              ))}
              <View
                className="flex items-center justify-center gap-[12rpx] py-[20rpx] rounded-xl border-[3rpx] border-dashed border-border text-muted-foreground text-[26rpx] font-medium mb-[16rpx] press-scale"
                onClick={() => onSalaryModelOpen(null)}
              >
                <Text className="text-[32rpx] text-primary">+</Text>
                <Text className="text-[26rpx]">新建薪资模板</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default SalaryTab;
