import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState, useCallback } from 'react';
import Avatar from '@/components/Avatar';
import EditTeacherSheet from '@/components/teacher/EditTeacherSheet';
import PayConfirmSheet from '@/components/teacher/PayConfirmSheet';
import ResignSheet from '@/components/teacher/ResignSheet';
import { SalaryStatusTag } from '@/components/teacher/TeacherCard';
import { useTeacherStore, calcTotal } from '@/stores/teacher';
import type { ResignType, TeacherUIModel, SalaryModelType, TeacherRole } from '@/types/teacher';

/** 详情子Tab类型 */
type DetailTab = 'schedule' | 'hours' | 'salary' | 'feedback';

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'schedule', label: '排课' },
  { key: 'hours', label: '课时' },
  { key: 'salary', label: '薪资' },
  { key: 'feedback', label: '反馈' },
];

/** 角色标签颜色映射 */
const ROLE_TAG_MAP: Record<string, string> = {
  lead: 'bg-primary-bg text-primary',
  assist: 'bg-info-bg text-info',
  parttime: 'bg-amber-10 text-amber',
};

const TeacherDetailPage: React.FC = () => {
  const { id } = useRouter().params;
  const { teachers, resignTeacher, confirmSalary, setPendingPayAction } = useTeacherStore();

  const teacher = useMemo(() => teachers.find((t) => t.id === id), [teachers, id]);

  const [activeTab, setActiveTab] = useState<DetailTab>('schedule');
  const [showResignSheet, setShowResignSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showPaySheet, setShowPaySheet] = useState(false);

  const total = useMemo(() => (teacher ? calcTotal(teacher) : 0), [teacher]);
  const lessonFee = useMemo(() => (teacher ? teacher.hours * teacher.rate : 0), [teacher]);

  const handleResign = useCallback(
    (type: ResignType, reason?: string) => {
      if (!teacher) return;
      resignTeacher(teacher.id, type, reason);
      setShowResignSheet(false);
      Taro.showToast({ title: '已标记离职', icon: 'success' });
    },
    [teacher, resignTeacher],
  );

  const handleSalaryAction = useCallback(() => {
    if (!teacher) return;
    if (teacher.salaryStatus === 'pending') {
      confirmSalary(teacher.id);
      Taro.showToast({ title: '工资已确认', icon: 'success' });
    } else if (teacher.salaryStatus === 'confirmed') {
      setShowPaySheet(true);
    }
  }, [teacher, confirmSalary]);

  const handlePayConfirm = useCallback(
    (remark: string) => {
      if (!teacher) return;
      setPendingPayAction({ type: 'single', ids: [teacher.id] });
      useTeacherStore.getState().executePay(remark);
      setShowPaySheet(false);
      Taro.showToast({ title: '发放成功', icon: 'success' });
    },
    [teacher, setPendingPayAction],
  );

  const handleEditSubmit = useCallback(
    (
      _id: string,
      data: {
        name: string;
        phone: string;
        subject: string;
        role: TeacherRole;
        modelType: SalaryModelType;
      },
    ) => {
      if (!teacher) return;
      const roleTextMap: Record<TeacherRole, string> = {
        lead: '主讲',
        assist: '助教',
        parttime: '兼职',
      };
      const modelIdxMap: Record<SalaryModelType, number> = { standard: 0, hourly: 1, custom: 2 };
      const modelConfigMap: Record<
        SalaryModelType,
        { base: number; rate: number; attend: number; perf: number }
      > = {
        standard: { base: 3000, rate: 100, attend: 500, perf: 700 },
        hourly: { base: 0, rate: 80, attend: 0, perf: 0 },
        custom: { base: 0, rate: 0, attend: 0, perf: 0 },
      };
      const m = modelConfigMap[data.modelType];
      useTeacherStore.getState().updateTeacher(teacher.id, {
        name: data.name,
        phone: data.phone,
        subject: data.subject,
        role: data.role,
        roleText: roleTextMap[data.role],
        modelIdx: modelIdxMap[data.modelType],
        base: m.base,
        rate: m.rate,
        attend: m.attend,
        perf: m.perf,
      });
      setShowEditSheet(false);
      Taro.showToast({ title: '修改成功', icon: 'success' });
    },
    [teacher],
  );

  if (!teacher) {
    return (
      <View className="min-h-screen bg-background flex flex-col">
        <View className="flex flex-col items-center justify-center py-[120rpx]">
          <Text className="text-[28rpx] text-muted-foreground">教师不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-background flex flex-col">
      {/* 渐变头部 */}
      <View className="bg-gradient-primary pt-[96rpx] px-[40rpx] pb-[40rpx] flex flex-col items-center relative rounded-b-[48rpx]">
        <View
          className="absolute top-[96rpx] left-[32rpx] w-[72rpx] h-[72rpx] rounded-full bg-white/20 flex items-center justify-center"
          onClick={() => Taro.navigateBack()}
        >
          <Text className="text-white text-[44rpx] font-light">‹</Text>
        </View>
        <View
          className="absolute top-[96rpx] right-[32rpx] w-[72rpx] h-[72rpx] rounded-full bg-white/20 flex items-center justify-center"
          onClick={() => setShowEditSheet(true)}
        >
          <Text className="text-white text-[36rpx]">✎</Text>
        </View>

        <Avatar
          name={teacher.name}
          size="xl"
          className={teacher.status === 'resigned' ? 'grayscale-60' : ''}
        />
        <Text className="text-[40rpx] font-bold text-white mt-[24rpx]">{teacher.name}</Text>
        <View className="flex items-center gap-[16rpx] mt-[16rpx]">
          <View
            className={cn(
              'px-2 py-[2rpx] rounded-tag text-xs font-medium',
              ROLE_TAG_MAP[teacher.role],
            )}
          >
            {teacher.roleText}
          </View>
          <SalaryStatusTag status={teacher.salaryStatus} />
          {teacher.status === 'resigned' && (
            <View className="py-[4rpx] px-[16rpx] rounded-[8rpx] text-[22rpx] font-semibold bg-white/25 text-white">
              已离职
            </View>
          )}
        </View>

        {/* 快速统计 */}
        <View className="flex items-center justify-center mt-[32rpx] w-full bg-white/15 rounded-[28rpx] py-[24rpx]">
          <View className="flex-1 flex flex-col items-center gap-[4rpx]">
            <Text className="text-[36rpx] font-extrabold text-white">{teacher.hours}</Text>
            <Text className="text-[22rpx] text-white/80">本月课时</Text>
          </View>
          <View className="w-[2rpx] h-[56rpx] bg-white/20" />
          <View className="flex-1 flex flex-col items-center gap-[4rpx]">
            <Text className="text-[36rpx] font-extrabold text-white">{teacher.students}</Text>
            <Text className="text-[22rpx] text-white/80">学生数</Text>
          </View>
          <View className="w-[2rpx] h-[56rpx] bg-white/20" />
          <View className="flex-1 flex flex-col items-center gap-[4rpx]">
            <Text className="text-[36rpx] font-extrabold text-white">{teacher.classes}</Text>
            <Text className="text-[22rpx] text-white/80">班级数</Text>
          </View>
          <View className="w-[2rpx] h-[56rpx] bg-white/20" />
          <View className="flex-1 flex flex-col items-center gap-[4rpx]">
            <Text className="text-[36rpx] font-extrabold text-amber-200">
              ¥{total.toLocaleString()}
            </Text>
            <Text className="text-[22rpx] text-white/80">{dayjs().month() + 1}月薪资</Text>
          </View>
        </View>
      </View>

      {/* 四Tab */}
      <View className="flex bg-card border-b border-border shrink-0">
        {DETAIL_TABS.map((tab) => (
          <View
            key={tab.key}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-[24rpx] relative press-scale',
              activeTab === tab.key ? 'text-primary' : 'text-muted-foreground',
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text
              className={cn(
                'text-[28rpx]',
                activeTab === tab.key
                  ? 'font-bold text-primary'
                  : 'font-medium text-muted-foreground',
              )}
            >
              {tab.label}
            </Text>
            <View
              className={cn(
                'mt-[8rpx] w-[40rpx] h-[6rpx] rounded-[3rpx] transition-all',
                activeTab === tab.key ? 'bg-primary' : 'bg-transparent',
              )}
            />
          </View>
        ))}
      </View>

      {/* Tab内容 */}
      <ScrollView className="flex-1 h-0" scrollY>
        {activeTab === 'salary' && (
          <SalaryTab
            teacher={teacher}
            total={total}
            lessonFee={lessonFee}
            onAction={handleSalaryAction}
          />
        )}
        {activeTab === 'hours' && <HoursTab teacher={teacher} />}
        {activeTab === 'feedback' && <FeedbackTab teacher={teacher} />}
        {activeTab === 'schedule' && <ScheduleTab teacher={teacher} />}
      </ScrollView>

      {/* 底部操作栏 */}
      {teacher.status === 'active' && teacher.salaryStatus !== 'paid' && (
        <View className="flex gap-[24rpx] px-[32rpx] py-[24rpx] pb-safe-bar bg-card border-t border-border shrink-0">
          <View
            className={cn(
              teacher.salaryStatus === 'confirmed' ? 'action-btn-primary' : 'action-btn-secondary',
            )}
            onClick={handleSalaryAction}
          >
            {teacher.salaryStatus === 'pending' ? '确认工资' : '确认发放'}
          </View>
          <View className="action-btn-danger" onClick={() => setShowResignSheet(true)}>
            标记离职
          </View>
        </View>
      )}

      {/* 仅在职且已发薪状态显示离职按钮 */}
      {teacher.status === 'active' && teacher.salaryStatus === 'paid' && (
        <View className="flex gap-[24rpx] px-[32rpx] py-[24rpx] pb-safe-bar bg-card border-t border-border shrink-0">
          <View className="action-btn-danger" onClick={() => setShowResignSheet(true)}>
            标记离职
          </View>
        </View>
      )}

      {/* 离职确认弹窗 */}
      <ResignSheet
        visible={showResignSheet}
        teacherName={teacher.name}
        onConfirm={handleResign}
        onClose={() => setShowResignSheet(false)}
      />

      {/* 发放确认弹窗 - 复用 PayConfirmSheet */}
      <PayConfirmSheet
        visible={showPaySheet}
        teacherName={teacher.name}
        amount={total}
        onConfirm={handlePayConfirm}
        onClose={() => setShowPaySheet(false)}
      />

      {/* 编辑教师弹窗 */}
      <EditTeacherSheet
        visible={showEditSheet}
        teacher={teacher}
        onClose={() => setShowEditSheet(false)}
        onSubmit={handleEditSubmit}
      />
    </View>
  );
};

// ===== 薪资Tab =====
const SalaryTab: React.FC<{
  teacher: TeacherUIModel;
  total: number;
  lessonFee: number;
  onAction: () => void;
}> = ({ teacher, total, lessonFee }) => (
  <View className="px-[32rpx] py-[32rpx]">
    {/* 当月工资 */}
    <View className="bg-card rounded-[28rpx] p-[32rpx] mb-[24rpx] shadow-card">
      <View className="flex justify-between items-center mb-[24rpx] pb-[24rpx] border-b border-border">
        <Text className="text-[32rpx] font-semibold text-foreground">
          {dayjs().month() + 1}月薪资
        </Text>
        <Text className="text-[44rpx] font-extrabold text-amber">¥{total.toLocaleString()}</Text>
      </View>
      <View className="flex flex-col gap-[16rpx]">
        {teacher.base > 0 && (
          <View className="flex justify-between items-center">
            <Text className="text-[26rpx] text-muted-foreground">底薪</Text>
            <Text className="text-[26rpx] font-semibold text-foreground">¥{teacher.base}</Text>
          </View>
        )}
        <View className="flex justify-between items-center">
          <Text className="text-[26rpx] text-muted-foreground">
            课时费 ({teacher.hours}课时 × ¥{teacher.rate})
          </Text>
          <Text className="text-[26rpx] font-semibold text-foreground">¥{lessonFee}</Text>
        </View>
        {teacher.attend > 0 && (
          <View className="flex justify-between items-center">
            <Text className="text-[26rpx] text-muted-foreground">全勤奖</Text>
            <Text className="text-[26rpx] font-semibold text-foreground">¥{teacher.attend}</Text>
          </View>
        )}
        {teacher.perf > 0 && (
          <View className="flex justify-between items-center">
            <Text className="text-[26rpx] text-muted-foreground">绩效奖金</Text>
            <Text className="text-[26rpx] font-semibold text-foreground">¥{teacher.perf}</Text>
          </View>
        )}
        {teacher.deductions.map((d) => (
          <View className="flex justify-between items-center" key={d.id}>
            <Text className="text-[26rpx] text-muted-foreground">{d.reason}</Text>
            <Text
              className={cn(
                'text-[26rpx] font-semibold',
                d.type === 'deduct' ? 'text-destructive' : 'text-success',
              )}
            >
              {d.type === 'deduct' ? '-' : '+'}¥{d.amount}
            </Text>
          </View>
        ))}
      </View>
      {teacher.payRemark && (
        <View className="mt-[24rpx] py-[16rpx] px-[24rpx] bg-muted rounded-xl">
          <Text className="text-[24rpx] text-muted-foreground">备注：{teacher.payRemark}</Text>
        </View>
      )}
    </View>

    {/* 工资模型 */}
    <View className="bg-card rounded-[28rpx] p-[32rpx] mb-[24rpx] shadow-card">
      <Text className="text-[32rpx] font-semibold text-foreground mb-[24rpx] block">工资模型</Text>
      <View className="flex justify-between items-center py-[16rpx]">
        <Text className="text-[26rpx] text-muted-foreground">模型类型</Text>
        <Text className="text-[26rpx] font-semibold text-foreground">
          {teacher.modelIdx === 0 ? '标准主讲' : '纯课时'}
        </Text>
      </View>
      <View className="flex justify-between items-center py-[16rpx]">
        <Text className="text-[26rpx] text-muted-foreground">课时费单价</Text>
        <Text className="text-[26rpx] font-semibold text-foreground">¥{teacher.rate}/课时</Text>
      </View>
      {teacher.classRateOverrides && teacher.classRateOverrides.length > 0 && (
        <View className="mt-[16rpx] pt-[16rpx] border-t border-dashed border-border">
          <Text className="text-[24rpx] text-muted-foreground mb-[8rpx] block">按班级计费</Text>
          {teacher.classRateOverrides.map((ov) => (
            <View className="flex justify-between items-center py-[16rpx]" key={ov.className}>
              <Text className="text-[26rpx] text-muted-foreground">{ov.className}</Text>
              <Text className="text-[26rpx] font-semibold text-foreground">¥{ov.rate}/课时</Text>
            </View>
          ))}
        </View>
      )}
    </View>

    {/* 薪资历史 */}
    {teacher.payHistory && teacher.payHistory.length > 0 && (
      <View className="bg-card rounded-[28rpx] p-[32rpx] mb-[24rpx] shadow-card">
        <Text className="text-[32rpx] font-semibold text-foreground mb-[24rpx] block">
          薪资历史
        </Text>
        {teacher.payHistory.map((rec) => (
          <View
            className="flex justify-between items-center py-[20rpx] border-b border-border last:border-b-0"
            key={rec.month}
          >
            <View className="flex flex-col gap-[4rpx]">
              <Text className="text-[28rpx] font-medium text-foreground">{rec.month}</Text>
              {rec.remark && (
                <Text className="text-[22rpx] text-muted-foreground">{rec.remark}</Text>
              )}
            </View>
            <View className="flex flex-col items-end gap-[4rpx]">
              <Text className="text-[28rpx] font-bold text-amber">
                ¥{rec.amount.toLocaleString()}
              </Text>
              <Text className="text-[22rpx] text-muted-foreground">
                {rec.status === 'paid' ? '已发放' : '待确认'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    )}
  </View>
);

// ===== 课时Tab =====
const HoursTab: React.FC<{ teacher: TeacherUIModel }> = ({ teacher }) => {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // 模拟课时数据
  const hoursData = [
    {
      month: `${dayjs().month() + 1}月`,
      monthKey: dayjs().format('YYYY-MM'),
      hours: teacher.hours,
      classes: teacher.classes,
    },
    {
      month: '5月',
      monthKey: dayjs().subtract(1, 'month').format('YYYY-MM'),
      hours: Math.round(teacher.hours * 0.95),
      classes: teacher.classes,
    },
    {
      month: '4月',
      monthKey: dayjs().subtract(2, 'month').format('YYYY-MM'),
      hours: Math.round(teacher.hours * 1.1),
      classes: teacher.classes + 1,
    },
  ];

  // 模拟签到记录
  const mockCheckInRecords: Record<
    string,
    { date: string; className: string; time: string; status: 'checked' | 'absent' | 'late' }[]
  > = {
    [dayjs().format('YYYY-MM')]: [
      {
        date: dayjs().format('M/D'),
        className: `${teacher.subject}基础班`,
        time: '09:00-10:30',
        status: 'checked',
      },
      {
        date: dayjs().subtract(1, 'day').format('M/D'),
        className: `${teacher.subject}进阶班`,
        time: '14:00-15:30',
        status: 'checked',
      },
      {
        date: dayjs().subtract(2, 'day').format('M/D'),
        className: '一对一辅导',
        time: '16:00-17:00',
        status: 'late',
      },
      {
        date: dayjs().subtract(3, 'day').format('M/D'),
        className: `${teacher.subject}基础班`,
        time: '09:00-10:30',
        status: 'checked',
      },
      {
        date: dayjs().subtract(5, 'day').format('M/D'),
        className: `${teacher.subject}进阶班`,
        time: '14:00-15:30',
        status: 'absent',
      },
    ],
  };

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    checked: { label: '已签到', cls: 'text-success' },
    absent: { label: '缺勤', cls: 'text-destructive' },
    late: { label: '迟到', cls: 'text-amber' },
  };

  return (
    <View className="px-[32rpx] py-[32rpx]">
      <View className="flex gap-[24rpx] mb-[32rpx]">
        <View className="flex-1 bg-gradient-primary rounded-[28rpx] py-[32rpx] px-[24rpx] flex flex-col items-center gap-[8rpx] shadow-card">
          <Text className="text-[48rpx] font-extrabold text-white">{teacher.hours}</Text>
          <Text className="text-[22rpx] text-white/85">本月课时</Text>
        </View>
        <View className="flex-1 bg-card rounded-[28rpx] py-[32rpx] px-[24rpx] flex flex-col items-center gap-[8rpx] shadow-card">
          <Text className="text-[48rpx] font-extrabold text-foreground">{teacher.students}</Text>
          <Text className="text-[22rpx] text-muted-foreground">学生数</Text>
        </View>
        <View className="flex-1 bg-card rounded-[28rpx] py-[32rpx] px-[24rpx] flex flex-col items-center gap-[8rpx] shadow-card">
          <Text className="text-[48rpx] font-extrabold text-foreground">{teacher.classes}</Text>
          <Text className="text-[22rpx] text-muted-foreground">班级数</Text>
        </View>
      </View>

      <View className="bg-card rounded-[28rpx] p-[32rpx] shadow-card">
        <Text className="text-[28rpx] font-semibold text-foreground mb-[24rpx] block">
          课时趋势
        </Text>
        {hoursData.map((item) => (
          <View key={item.month}>
            <View
              className="flex items-center gap-[24rpx] py-[16rpx] press-scale"
              onClick={() =>
                setExpandedMonth(expandedMonth === item.monthKey ? null : item.monthKey)
              }
            >
              <Text className="text-[26rpx] font-medium text-foreground w-[64rpx] flex-shrink-0">
                {item.month}
              </Text>
              <View className="flex-1 h-[16rpx] bg-muted rounded-[8rpx] overflow-hidden">
                <View
                  className="h-full bg-gradient-primary rounded-[8rpx] transition-all"
                  style={{ width: `${Math.min(100, (item.hours / 50) * 100)}%` }}
                />
              </View>
              <Text className="text-[24rpx] font-semibold text-muted-foreground w-[112rpx] text-right flex-shrink-0">
                {item.hours}课时
              </Text>
              <Text
                className={cn(
                  'text-[20rpx] transition-transform',
                  expandedMonth === item.monthKey ? 'rotate-90' : '',
                  'text-muted-foreground',
                )}
              >
                ›
              </Text>
            </View>

            {/* 展开的签到记录 */}
            {expandedMonth === item.monthKey && (
              <View className="ml-[88rpx] mb-[16rpx] border-l-[4rpx] border-primary/30 pl-[24rpx]">
                {(mockCheckInRecords[item.monthKey] || []).length > 0 ? (
                  mockCheckInRecords[item.monthKey].map((rec, idx) => (
                    <View key={idx} className="flex items-center gap-[16rpx] py-[12rpx]">
                      <Text className="text-[24rpx] text-muted-foreground w-[64rpx] flex-shrink-0">
                        {rec.date}
                      </Text>
                      <View className="flex-1 min-w-0">
                        <Text className="text-[26rpx] text-foreground block">{rec.className}</Text>
                        <Text className="text-[22rpx] text-muted-foreground">{rec.time}</Text>
                      </View>
                      <Text className={cn('text-[22rpx] font-medium', STATUS_MAP[rec.status]?.cls)}>
                        {STATUS_MAP[rec.status]?.label}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className="text-[24rpx] text-muted-foreground py-[16rpx] block">
                    暂无签到记录
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

// ===== 反馈Tab =====
const FeedbackTab: React.FC<{ teacher: TeacherUIModel }> = (_props) => (
  <View className="px-[32rpx] py-[32rpx]">
    <View className="flex flex-col items-center justify-center py-[120rpx]">
      <Text className="text-[80rpx] mb-[24rpx]">📋</Text>
      <Text className="text-[28rpx] text-muted-foreground">暂无反馈记录</Text>
      <Text className="text-[24rpx] text-muted-foreground opacity-70 mt-[8rpx]">
        教师反馈功能开发中
      </Text>
    </View>
  </View>
);

// ===== 排课Tab =====
const ScheduleTab: React.FC<{ teacher: TeacherUIModel }> = ({ teacher }) => {
  const now = dayjs();
  const [selectedDate, setSelectedDate] = useState(now.format('YYYY-MM-DD'));
  const [weekOffset, setWeekOffset] = useState(0);

  // 当前周的起始日
  const weekStart = now.startOf('week').add(1, 'day').add(weekOffset, 'week'); // 周一

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = weekStart.add(i, 'day');
    return {
      date: d.format('YYYY-MM-DD'),
      day: d.format('D'),
      weekday: ['一', '二', '三', '四', '五', '六', '日'][i],
      isToday: d.isSame(now, 'day'),
      isSelected: d.format('YYYY-MM-DD') === selectedDate,
    };
  });

  // 模拟排课数据
  const scheduleMap: Record<
    string,
    { time: string; title: string; students: number; room: string; id: string }[]
  > = {
    [now.format('YYYY-MM-DD')]: [
      {
        id: 's1',
        time: '09:00-10:30',
        title: `${teacher.subject}基础班`,
        students: 6,
        room: 'A201',
      },
      {
        id: 's2',
        time: '14:00-15:30',
        title: `${teacher.subject}进阶班`,
        students: 4,
        room: 'B102',
      },
      { id: 's3', time: '16:00-17:00', title: '一对一辅导', students: 1, room: 'C301' },
    ],
    [now.add(1, 'day').format('YYYY-MM-DD')]: [
      {
        id: 's4',
        time: '10:00-11:30',
        title: `${teacher.subject}基础班`,
        students: 6,
        room: 'A201',
      },
    ],
  };

  const scheduleItems = scheduleMap[selectedDate] || [];

  const handleCancelCourse = (_courseId: string) => {
    Taro.showModal({
      title: '取消课程',
      content: '确认取消该节课程？',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '已取消', icon: 'success' });
        }
      },
    });
  };

  const handleAddCourse = () => {
    Taro.showToast({ title: '排课功能开发中', icon: 'none' });
  };

  return (
    <View className="px-[32rpx] py-[32rpx]">
      {/* 周导航 */}
      <View className="flex items-center justify-between mb-[16rpx]">
        <View
          className="w-[56rpx] h-[56rpx] rounded-full bg-card flex items-center justify-center press-scale"
          onClick={() => setWeekOffset((prev) => prev - 1)}
        >
          <Text className="text-[28rpx] text-foreground">‹</Text>
        </View>
        <Text className="text-[28rpx] font-semibold text-foreground">
          {weekStart.format('M月D日')} - {weekStart.add(6, 'day').format('M月D日')}
        </Text>
        <View
          className="w-[56rpx] h-[56rpx] rounded-full bg-card flex items-center justify-center press-scale"
          onClick={() => setWeekOffset((prev) => prev + 1)}
        >
          <Text className="text-[28rpx] text-foreground">›</Text>
        </View>
      </View>

      {/* 周视图 */}
      <View className="flex gap-[8rpx] mb-[32rpx] bg-card rounded-[28rpx] py-[24rpx] px-[16rpx] shadow-card">
        {weekDays.map((d) => (
          <View
            key={d.date}
            className={cn(
              'flex-1 flex flex-col items-center gap-[8rpx] py-[12rpx] rounded-[20rpx] press-scale',
              d.isSelected ? 'bg-gradient-primary' : d.isToday ? 'bg-primary/10' : '',
            )}
            onClick={() => setSelectedDate(d.date)}
          >
            <Text
              className={cn('text-[22rpx]', d.isSelected ? 'text-white' : 'text-muted-foreground')}
            >
              {d.weekday}
            </Text>
            <Text
              className={cn(
                'text-[28rpx] font-semibold',
                d.isSelected ? 'text-white' : d.isToday ? 'text-primary' : 'text-foreground',
              )}
            >
              {d.day}
            </Text>
          </View>
        ))}
      </View>

      {/* 今日课表 */}
      <View className="bg-card rounded-[28rpx] p-[32rpx] shadow-card mb-[24rpx]">
        <View className="flex items-center justify-between mb-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground">
            {selectedDate === now.format('YYYY-MM-DD')
              ? '今日课表'
              : dayjs(selectedDate).format('M月D日') + ' 课表'}
          </Text>
          {scheduleItems.length > 0 && (
            <Text className="text-[24rpx] text-muted-foreground">{scheduleItems.length}节课</Text>
          )}
        </View>
        {scheduleItems.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-[60rpx]">
            <Text className="text-[28rpx] text-muted-foreground mb-[24rpx]">当日无排课</Text>
          </View>
        ) : (
          scheduleItems.map((item, idx) => (
            <View className="flex gap-[24rpx] py-[16rpx]" key={item.id}>
              <Text className="text-[24rpx] text-muted-foreground w-[180rpx] flex-shrink-0 pt-[4rpx]">
                {item.time}
              </Text>
              <View className="w-[32rpx] flex flex-col items-center flex-shrink-0 pt-[8rpx]">
                <View className="w-[16rpx] h-[16rpx] rounded-full bg-primary flex-shrink-0" />
                {idx < scheduleItems.length - 1 && (
                  <View className="w-[4rpx] flex-1 min-h-[40rpx] bg-border mt-[8rpx]" />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[28rpx] font-medium text-foreground block">{item.title}</Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[4rpx] block">
                  {item.students}人 · {item.room}
                </Text>
              </View>
              <View
                className="flex-shrink-0 px-[16rpx] py-[8rpx] rounded-[12rpx] bg-destructive/10 text-[22rpx] text-destructive font-medium self-center press-scale"
                onClick={() => handleCancelCourse(item.id)}
              >
                取消
              </View>
            </View>
          ))
        )}
      </View>

      {/* 快捷排课按钮 */}
      <View
        className="flex items-center justify-center gap-[12rpx] py-[28rpx] rounded-[28rpx] bg-primary/10 border-[2rpx] border-dashed border-primary/30 press-scale"
        onClick={handleAddCourse}
      >
        <Text className="text-[32rpx] text-primary font-bold">+</Text>
        <Text className="text-[28rpx] text-primary font-medium">排新课</Text>
      </View>
    </View>
  );
};

export default TeacherDetailPage;
