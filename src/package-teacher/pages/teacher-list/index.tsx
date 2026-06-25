import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import AddTeacherSheet from '@/components/teacher/AddTeacherSheet';
import ConfirmSalarySheet from '@/components/teacher/ConfirmSalarySheet';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import MonthPicker from '@/components/teacher/MonthPicker';
import PayConfirmSheet from '@/components/teacher/PayConfirmSheet';
import PaymentSettingsSheet from '@/components/teacher/PaymentSettingsSheet';
import SalaryModelSheet from '@/components/teacher/SalaryModelSheet';
import SalaryTab from '@/components/teacher/SalaryTab';
import ScheduleTab from '@/components/teacher/ScheduleTab';
import TeacherTab from '@/components/teacher/TeacherTab';
import { AVATAR_COLORS } from '@/data/teacher';
import { teacherScheduleService } from '@/services/teacher';
import { useTeacherStore, calcTotal } from '@/stores/teacher';
import type { SalaryModel } from '@/types/teacher';
import { TAB_CONFIG, useTeacherList } from './useTeacherList';

/** 教师管理页面 - 教师列表/薪资/排课三Tab */
const TeacherListPage: React.FC = () => {
  const {
    // Store 数据
    filter,
    setFilter,
    teachers,
    loading,
    error,
    reload,
    filteredTeachers,
    salaryTeachers,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    settings,
    updateSettings,
    salaryModels,
    createSalaryModel,
    updateSalaryModel,

    // Tab 状态
    mainTab,
    setMainTab,
    salarySubTab,
    setSalarySubTab,

    // 筛选
    activeFilterId,
    setActiveFilterId,

    // 统计
    pendingCount,
    totalHours,
    totalSalary,
    activeCount,

    // 薪资操作
    paySheetVisible,
    setPaySheetVisible,
    pendingPayAction,
    setPendingPayAction,
    payTargetTeacher,
    batchPayTotal,
    confirmSalaryVisible,
    setConfirmSalaryVisible,
    confirmSalaryTarget,
    setConfirmSalaryTarget,
    handleSalaryAction,
    handleConfirmSalary,
    handleBatchAction,
    handlePayConfirm,
    handleSalaryDetail,

    // 添加教师
    addTeacherVisible,
    setAddTeacherVisible,

    // 发放设置
    paymentSettingsVisible,
    setPaymentSettingsVisible,

    // 工资模型
    salaryModelSheetVisible,
    setSalaryModelSheetVisible,
    editingModel,
    setEditingModel,

    // 月份选择
    monthPickerVisible,
    setMonthPickerVisible,
    historyYear,
    historyMonth,
    historyRecords,
    historyTotalAmount,
    historyTotalHours,
    handleMonthSelect,

    // 排课
    weekOffset,
    setWeekOffset,
    selectedDate,
    setSelectedDate,
    scheduleDataMap,
    setScheduleDataMap,
    scheduleCampusFilter,
    setScheduleCampusFilter,
    scheduleSubjectFilter,
    setScheduleSubjectFilter,
    scheduleTeacherFilter,
    setScheduleTeacherFilter,
    scheduleFilterId,
    setScheduleFilterId,
    weekDays,
    weekTitle,
    daySchedule,

    // 导航
    handleTeacherClick,

    // 设置
    pushEnabled,
    setPushEnabled,
  } = useTeacherList();

  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [savingSalaryModel, setSavingSalaryModel] = useState(false);
  const [confirmingSalary, setConfirmingSalary] = useState(false);
  const [payingSalary, setPayingSalary] = useState(false);

  // ===== 初始化数据 =====
  useDidShow(() => {
    void reload();
  });

  useEffect(() => {
    setPushEnabled(settings.pushEnabled);
  }, [settings.pushEnabled, setPushEnabled]);

  // 加载排课数据
  useEffect(() => {
    let mounted = true;

    const loadScheduleData = async () => {
      setScheduleLoading(true);
      setScheduleError('');
      try {
        const data = await teacherScheduleService.getList();
        if (!mounted) return;
        setScheduleDataMap(data);
      } catch {
        if (!mounted) return;
        setScheduleError('教师排课加载失败，请稍后重试');
      } finally {
        if (mounted) {
          setScheduleLoading(false);
        }
      }
    };

    void loadScheduleData();

    return () => {
      mounted = false;
    };
  }, [setScheduleDataMap]);

  if (loading && !teachers.length) {
    return (
      <View className="flex flex-col h-screen bg-background items-center justify-center">
        <Loading text="加载教师数据中..." />
      </View>
    );
  }

  if (error && !teachers.length) {
    return (
      <View className="flex flex-col h-screen bg-background px-[32rpx] items-center justify-center">
        <Empty
          icon="mdi-alert-circle"
          description={error}
          actionText="重新加载"
          onAction={() => void reload()}
        />
      </View>
    );
  }

  return (
    <View className="flex flex-col h-screen bg-background">
      {/* 渐变头部 */}
      <View className="bg-gradient-primary pt-[96rpx] px-[40rpx] sticky top-0 z-10">
        <View className="flex items-center justify-between">
          <Text className="text-[40rpx] font-bold text-white">教师管理</Text>
          <View className="header-glass-btn" onClick={() => setAddTeacherVisible(true)}>
            <Text className="text-[32rpx] mr-[4rpx]">+</Text>
            <Text className="text-[26rpx]">添加教师</Text>
          </View>
        </View>

        {error ? (
          <View className="mt-[16rpx] py-[16rpx] px-[20rpx] rounded-[20rpx] bg-white/15">
            <Text className="text-[22rpx] text-white/90">{error}</Text>
          </View>
        ) : null}

        {/* 统计Chips */}
        <View className="flex gap-[16rpx] py-[28rpx] pb-[24rpx]">
          <View className="stat-chip">
            <Text className="text-[32rpx] font-bold text-white block">{activeCount}</Text>
            <Text className="text-[20rpx] text-white/80 mt-[2rpx] block">在职教师</Text>
          </View>
          <View className="stat-chip">
            <Text className="text-[32rpx] font-bold text-white block">{totalHours}</Text>
            <Text className="text-[20rpx] text-white/80 mt-[2rpx] block">本月课时</Text>
          </View>
          <View className="stat-chip">
            <Text className="text-[32rpx] font-bold text-amber-200 block">{pendingCount}</Text>
            <Text className="text-[20rpx] text-white/80 mt-[2rpx] block">待处理</Text>
          </View>
        </View>

        {/* 胶囊式三Tab */}
        <View className="pb-[16rpx]">
          <View className="flex gap-[8rpx] bg-white/15 backdrop-blur rounded-[28rpx] p-[8rpx]">
            {TAB_CONFIG.map((tab) => (
              <View
                key={tab.key}
                className={cn('capsule-tab', mainTab === tab.key && 'capsule-tab-active')}
                onClick={() => setMainTab(tab.key)}
              >
                <Text className="text-[32rpx]">{tab.icon}</Text>
                <Text className="text-[26rpx]">{tab.label}</Text>
                {tab.key === 'salary' && pendingCount > 0 && (
                  <View className="min-w-[32rpx] h-[32rpx] px-[8rpx] rounded-[16rpx] bg-amber text-[18rpx] font-bold inline-flex items-center justify-center ml-[4rpx]">
                    <Text className="text-white text-[18rpx]">{pendingCount}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 教师Tab */}
      {mainTab === 'teacher' && (
        <TeacherTab
          filter={filter}
          setFilter={setFilter}
          filteredTeachers={filteredTeachers}
          activeFilterId={activeFilterId}
          setActiveFilterId={setActiveFilterId}
          onTeacherClick={handleTeacherClick}
        />
      )}

      {/* 薪资Tab */}
      {mainTab === 'salary' && (
        <SalaryTab
          salarySubTab={salarySubTab}
          setSalarySubTab={setSalarySubTab}
          salaryTeachers={salaryTeachers}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          pendingCount={pendingCount}
          totalHours={totalHours}
          totalSalary={totalSalary}
          settings={settings}
          pushEnabled={pushEnabled}
          setPushEnabled={setPushEnabled}
          updateSettings={updateSettings}
          salaryModels={salaryModels}
          teachers={teachers}
          onBatchAction={handleBatchAction}
          onSalaryAction={handleSalaryAction}
          onSalaryDetail={handleSalaryDetail}
          onPaymentSettingsOpen={() => setPaymentSettingsVisible(true)}
          onSalaryModelOpen={(model) => {
            setEditingModel(model);
            setSalaryModelSheetVisible(true);
          }}
          historyYear={historyYear}
          historyMonth={historyMonth}
          historyRecords={historyRecords}
          historyTotalAmount={historyTotalAmount}
          historyTotalHours={historyTotalHours}
          onMonthPickerOpen={() => setMonthPickerVisible(true)}
          onHistoryMonthChange={(year, month) => {
            handleMonthSelect(year, month);
          }}
        />
      )}

      {/* 排课Tab */}
      {mainTab === 'schedule' && (
        <>
          {scheduleError ? (
            <View className="mx-[32rpx] mt-[24rpx] py-[20rpx] px-[24rpx] rounded-[24rpx] bg-destructive/10">
              <Text className="text-[24rpx] text-destructive">{scheduleError}</Text>
            </View>
          ) : null}
          {scheduleLoading && !Object.keys(scheduleDataMap).length ? (
            <View className="flex-1 items-center justify-center">
              <Loading text="加载教师排课中..." />
            </View>
          ) : (
            <ScheduleTab
              weekOffset={weekOffset}
              setWeekOffset={setWeekOffset}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              weekDays={weekDays}
              weekTitle={weekTitle}
              daySchedule={daySchedule}
              scheduleCampusFilter={scheduleCampusFilter}
              setScheduleCampusFilter={setScheduleCampusFilter}
              scheduleSubjectFilter={scheduleSubjectFilter}
              setScheduleSubjectFilter={setScheduleSubjectFilter}
              scheduleTeacherFilter={scheduleTeacherFilter}
              setScheduleTeacherFilter={setScheduleTeacherFilter}
              scheduleFilterId={scheduleFilterId}
              setScheduleFilterId={setScheduleFilterId}
              scheduleDataMap={scheduleDataMap}
              teachers={teachers}
              onTeacherClick={handleTeacherClick}
            />
          )}
        </>
      )}

      {/* 年月选择器 */}
      <MonthPicker
        visible={monthPickerVisible}
        currentYear={historyYear}
        currentMonth={historyMonth}
        onSelect={handleMonthSelect}
        onClose={() => setMonthPickerVisible(false)}
      />

      {/* 发放确认弹窗 */}
      <PayConfirmSheet
        visible={paySheetVisible}
        action={pendingPayAction}
        teacherName={payTargetTeacher?.name}
        amount={payTargetTeacher ? calcTotal(payTargetTeacher) : batchPayTotal}
        submitting={payingSalary}
        onConfirm={async (remark) => {
          if (payingSalary) return;
          setPayingSalary(true);
          try {
            await handlePayConfirm(remark);
          } finally {
            setPayingSalary(false);
          }
        }}
        onClose={() => {
          if (payingSalary) return;
          setPaySheetVisible(false);
          setPendingPayAction(null);
        }}
      />

      {/* 添加教师弹窗 */}
      <AddTeacherSheet
        visible={addTeacherVisible}
        submitting={addingTeacher}
        onClose={() => setAddTeacherVisible(false)}
        onSubmit={async (data) => {
          if (addingTeacher) return;
          setAddingTeacher(true);
          const { addTeacher } = useTeacherStore.getState();
          try {
            const colorIdx = Math.floor(Math.random() * AVATAR_COLORS.length);
            const roleTextMap = { lead: '主讲', assist: '助教', parttime: '兼职' };
            const modelMap: Record<
              string,
              { base: number; rate: number; attend: number; perf: number }
            > = {
              standard: { base: 3000, rate: 100, attend: 500, perf: 700 },
              hourly: { base: 0, rate: 80, attend: 0, perf: 0 },
              custom: { base: 0, rate: 0, attend: 0, perf: 0 },
            };
            const m = modelMap[data.modelType] || modelMap.standard;
            await addTeacher({
              id: `t${Date.now()}`,
              name: data.name,
              role: data.role,
              roleText: roleTextMap[data.role],
              accessScope: 'self',
              accessScopeText: '本人',
              subject: data.subject,
              phone: data.phone || '未填写',
              hours: 0,
              students: 0,
              classes: 0,
              base: m.base,
              rate: m.rate,
              attend: m.attend,
              perf: m.perf,
              salaryStatus: 'pending',
              modelIdx: data.modelType === 'standard' ? 0 : 1,
              color: AVATAR_COLORS[colorIdx],
              initial: data.name[0],
              deductions: [],
              status: 'active',
            });
            setAddTeacherVisible(false);
            Taro.showToast({ title: '添加成功', icon: 'success' });
          } catch {
            Taro.showToast({ title: '添加教师失败', icon: 'none' });
          } finally {
            setAddingTeacher(false);
          }
        }}
      />

      {/* 发放设置弹窗 */}
      <PaymentSettingsSheet
        visible={paymentSettingsVisible}
        settings={settings}
        submitting={savingPaymentSettings}
        onClose={() => setPaymentSettingsVisible(false)}
        onSubmit={async (updates) => {
          if (savingPaymentSettings) return;
          setSavingPaymentSettings(true);
          try {
            await updateSettings(updates);
            if (updates.pushEnabled !== undefined) setPushEnabled(Boolean(updates.pushEnabled));
            setPaymentSettingsVisible(false);
            Taro.showToast({ title: '设置已保存', icon: 'success' });
          } catch {
            Taro.showToast({ title: '设置保存失败', icon: 'none' });
          } finally {
            setSavingPaymentSettings(false);
          }
        }}
      />

      {/* 工资模型弹窗 */}
      <SalaryModelSheet
        visible={salaryModelSheetVisible}
        model={editingModel}
        submitting={savingSalaryModel}
        onClose={() => {
          if (savingSalaryModel) return;
          setSalaryModelSheetVisible(false);
          setEditingModel(null);
        }}
        onSubmit={async (data) => {
          if (savingSalaryModel) return;
          setSavingSalaryModel(true);
          try {
            if (editingModel) {
              await updateSalaryModel(editingModel.id, {
                name: data.name,
                type: data.type,
                base: data.base,
                rate: data.rate,
                attend: data.attend,
                perf: data.perf,
              });
            } else {
              const newModel: SalaryModel = {
                id: `m${Date.now()}`,
                name: data.name,
                type: data.type,
                base: data.base,
                rate: data.rate,
                attend: data.attend,
                perf: data.perf,
                teacherCount: 0,
              };
              await createSalaryModel(newModel);
            }
            setSalaryModelSheetVisible(false);
            setEditingModel(null);
            Taro.showToast({ title: editingModel ? '修改成功' : '创建成功', icon: 'success' });
          } catch {
            Taro.showToast({ title: editingModel ? '修改失败' : '创建失败', icon: 'none' });
          } finally {
            setSavingSalaryModel(false);
          }
        }}
      />

      {/* 确认工资弹窗 */}
      <ConfirmSalarySheet
        visible={confirmSalaryVisible}
        teacherName={
          confirmSalaryTarget ? teachers.find((t) => t.id === confirmSalaryTarget)?.name || '' : ''
        }
        amount={
          confirmSalaryTarget ? calcTotal(teachers.find((t) => t.id === confirmSalaryTarget)!) : 0
        }
        submitting={confirmingSalary}
        onConfirm={async () => {
          if (confirmingSalary) return;
          setConfirmingSalary(true);
          try {
            await handleConfirmSalary();
          } finally {
            setConfirmingSalary(false);
          }
        }}
        onClose={() => {
          if (confirmingSalary) return;
          setConfirmSalaryVisible(false);
          setConfirmSalaryTarget(null);
        }}
      />
    </View>
  );
};

export default TeacherListPage;
