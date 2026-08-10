/**
 * 工资明细页面
 *
 * 使用场景：薪资核对完成后，以工资单视图展示教师薪资明细。
 * 仅保留工资单视图，调整工资功能已迁移至 salary-adjust 页面。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState, useCallback } from 'react';
import Icon from '@/components/Icon';
import PayConfirmSheet from '@/components/teacher/PayConfirmSheet';
import { BRAND_LOGO, BRAND_NAME_ZH } from '@/constants/brand';
import { useTeacherStore, calcTotal } from '@/stores/teacher';
import {
  normalizeSalaryStatus,
  SALARY_STATUS_META,
  PAY_METHOD_TEXT,
  type PayMethod,
} from '@/types/teacher';

/** 页面背景色：按产品要求使用 #EFEFEF */
const PAGE_BACKGROUND = '#EFEFEF';

/** 生成本地模拟课时费流水 */
function genMockLessonRecords(teacher: { subject: string; rate: number }) {
  const courses = teacher.subject
    ? [`${teacher.subject}基础班`, `${teacher.subject}进阶班`, `${teacher.subject}小组课`]
    : ['行政班', '值班', '前台班'];
  return [
    {
      date: '08-01',
      course: courses[0] ?? '基础班',
      hours: 2,
      amount: Math.round(teacher.rate * 2),
    },
    {
      date: '08-05',
      course: courses[1] ?? '进阶班',
      hours: 1.5,
      amount: Math.round(teacher.rate * 1.5),
    },
    { date: '08-12', course: courses[2] ?? '小组课', hours: 1, amount: Math.round(teacher.rate) },
  ];
}

/** 生成本地模拟提成流水 */
function genMockCommissionRecords(teacher: { attend: number; perf: number }) {
  const baseAmount = Math.max(100, Math.round((teacher.attend + teacher.perf) / 3));
  return [
    { name: '新生推荐奖', amount: baseAmount },
    { name: '续费提成', amount: Math.round(baseAmount * 0.8) },
    { name: '全勤奖励', amount: Math.round(baseAmount * 0.6) },
  ];
}

/** 紧凑信息行：固定宽度标签 + 左对齐值 */
const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  border?: boolean;
}> = ({ label, value, valueClassName, border = true }) => (
  <View className={cn('flex items-start py-[16rpx]', border && 'border-b border-border/30')}>
    <Text className="w-[160rpx] text-[26rpx] text-muted-foreground shrink-0 leading-[40rpx]">
      {label}
    </Text>
    <View className="flex items-center gap-[8rpx] flex-1 min-w-0 pl-[16rpx]">
      {value ? (
        <Text
          className={cn('text-[26rpx] text-foreground leading-[40rpx] truncate', valueClassName)}
        >
          {value}
        </Text>
      ) : null}
    </View>
  </View>
);

/** 工资明细网格项：标签 + 金额 */
const SalaryGridItem: React.FC<{
  label: string;
  amount: string;
  amountClassName?: string;
  onClick?: () => void;
  expandable?: boolean;
  expanded?: boolean;
}> = ({ label, amount, amountClassName, onClick, expandable, expanded }) => (
  <View className={cn('flex flex-col gap-[8rpx]', onClick && 'press-scale')} onClick={onClick}>
    <View className="flex items-center gap-[8rpx]">
      <Text className="text-[24rpx] text-muted-foreground">{label}</Text>
      {expandable && (
        <Icon
          name={expanded ? 'mdi-chevron-down' : 'mdi-chevron-right'}
          size={18}
          className="text-muted-foreground"
        />
      )}
    </View>
    <Text
      className={cn('text-[32rpx] font-bold leading-[44rpx]', amountClassName || 'text-foreground')}
    >
      {amount}
    </Text>
  </View>
);

/** 展开的记录行 */
const RecordRow: React.FC<{ name: string; amount: string; amountClassName?: string }> = ({
  name,
  amount,
  amountClassName,
}) => (
  <View className="flex items-center justify-between py-[12rpx]">
    <Text className="text-[24rpx] text-muted-foreground truncate flex-1 mr-[16rpx]">{name}</Text>
    <Text className={cn('text-[24rpx] font-medium', amountClassName || 'text-foreground')}>
      {amount}
    </Text>
  </View>
);

const SalaryDetailPage: React.FC = () => {
  const { id } = useRouter().params;
  const { teachers, setPendingPayAction } = useTeacherStore();

  const teacher = useMemo(() => teachers.find((t) => t.id === id), [teachers, id]);

  const [paySheetVisible, setPaySheetVisible] = useState(false);
  const [slipExpanded, setSlipExpanded] = useState<{
    lesson: boolean;
    commission: boolean;
    bonus: boolean;
    deduct: boolean;
  }>({
    lesson: false,
    commission: false,
    bonus: false,
    deduct: false,
  });

  const total = useMemo(() => (teacher ? calcTotal(teacher) : 0), [teacher]);
  const lessonFee = useMemo(() => (teacher ? teacher.hours * teacher.rate : 0), [teacher]);
  const totalFine = useMemo(
    () => (teacher ? (teacher.lateFine || 0) + (teacher.otherFine || 0) : 0),
    [teacher],
  );
  const bonusTotal = useMemo(
    () =>
      (teacher?.bonusAmount || 0) +
      (teacher?.deductions || [])
        .filter((d) => d.type === 'bonus')
        .reduce((s, d) => s + d.amount, 0),
    [teacher],
  );
  const deductTotal = useMemo(
    () =>
      totalFine +
      (teacher?.deductions || [])
        .filter((d) => d.type === 'deduct')
        .reduce((s, d) => s + d.amount, 0),
    [teacher, totalFine],
  );

  const currentStatus = useMemo(
    () => (teacher ? normalizeSalaryStatus(teacher.salaryStatus) : 'pending'),
    [teacher],
  );
  const statusMeta = SALARY_STATUS_META[currentStatus];

  const lessonRecords = useMemo(() => (teacher ? genMockLessonRecords(teacher) : []), [teacher]);
  const commissionRecords = useMemo(
    () => (teacher ? genMockCommissionRecords(teacher) : []),
    [teacher],
  );

  const toggleSlipExpand = useCallback((key: 'lesson' | 'commission' | 'bonus' | 'deduct') => {
    setSlipExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handlePayConfirm = useCallback(
    async ({ remark, payMethod }: { remark: string; payMethod: PayMethod }) => {
      if (!teacher) return;
      try {
        await useTeacherStore.getState().executePay(remark, payMethod);
        setPaySheetVisible(false);
        Taro.showToast({ title: '发放成功', icon: 'success' });
        setTimeout(() => {
          void Taro.redirectTo({
            url: `/package-teacher/pages/salary-detail/index?id=${teacher.id}&mode=slip`,
          });
        }, 500);
      } catch {
        Taro.showToast({ title: '发放失败', icon: 'none' });
      }
    },
    [teacher],
  );

  if (!teacher) {
    return (
      <View className="min-h-screen bg-background pb-safe-bar">
        <View className="flex items-center justify-center py-[160rpx]">
          <Text className="text-[28rpx] text-muted-foreground">教师不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen pb-[140rpx]" style={{ backgroundColor: PAGE_BACKGROUND }}>
      {/* 顶部：白色背景，居中头像/名称/金额，底部带分割线 */}
      <View className="bg-white pt-[48rpx] pb-[40rpx] px-[64rpx] border-b border-border/30">
        <View className="flex flex-col items-center">
          <Image
            src={teacher.avatar || BRAND_LOGO}
            className="w-[120rpx] h-[120rpx] rounded-full mb-[24rpx]"
            mode="aspectFill"
          />
          <Text className="text-[30rpx] text-foreground mb-[8rpx]">
            {teacher.name}
            <Text className="text-muted-foreground"> · {teacher.campus || BRAND_NAME_ZH}</Text>
          </Text>
          <View className="flex items-baseline mt-[16rpx]">
            <Text className="text-[32rpx] font-bold text-foreground mr-[6rpx]">¥</Text>
            <Text className="text-[56rpx] font-extrabold text-foreground leading-tight">
              {total.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* 基本信息：当前状态 / 确认时间 / 发放方式 / 流水单号 */}
      <View className="bg-white px-[64rpx] mb-[36rpx]">
        <InfoRow label="当前状态" value={statusMeta.label} valueClassName={statusMeta.textClass} />
        <InfoRow
          label="确认时间"
          value={teacher.paidAt ? dayjs(teacher.paidAt).format('YYYY年M月D日 HH:mm:ss') : '-'}
        />
        <InfoRow
          label="发放方式"
          value={teacher.payMethod ? PAY_METHOD_TEXT[teacher.payMethod as PayMethod] : '-'}
        />
        <InfoRow label="流水单号" value={teacher.serialNo || '-'} border={false} />
      </View>

      {/* 工资明细卡片：双排紧凑布局 */}
      <View className="bg-white px-[64rpx] py-[32rpx] mb-[36rpx]">
        <Text className="text-[28rpx] text-foreground font-bold mb-[32rpx]">工资明细</Text>

        <View className="grid grid-cols-2 gap-x-[24rpx] gap-y-[32rpx]">
          {/* 底薪 */}
          <SalaryGridItem label="底薪" amount={teacher.base.toFixed(0)} />

          {/* 课时费（可展开） */}
          <SalaryGridItem
            label="课时费"
            amount={lessonFee.toFixed(0)}
            onClick={() => toggleSlipExpand('lesson')}
            expandable
            expanded={slipExpanded.lesson}
          />

          {/* 提成（可展开） */}
          <SalaryGridItem
            label="提成"
            amount={(teacher.attend + teacher.perf).toFixed(0)}
            onClick={() => toggleSlipExpand('commission')}
            expandable
            expanded={slipExpanded.commission}
          />

          {/* 奖金（可展开） */}
          <SalaryGridItem
            label="奖金"
            amount={`+${bonusTotal.toFixed(0)}`}
            amountClassName={bonusTotal > 0 ? 'text-success' : 'text-foreground'}
            onClick={() => toggleSlipExpand('bonus')}
            expandable
            expanded={slipExpanded.bonus}
          />

          {/* 扣款（可展开） */}
          <SalaryGridItem
            label="扣款"
            amount={`-${deductTotal.toFixed(0)}`}
            amountClassName={deductTotal > 0 ? 'text-destructive' : 'text-foreground'}
            onClick={() => toggleSlipExpand('deduct')}
            expandable
            expanded={slipExpanded.deduct}
          />

          {/* 个人社保 */}
          <SalaryGridItem label="个人社保" amount={(teacher.socialInsurance || 0).toFixed(0)} />

          {/* 公司社保 */}
          <SalaryGridItem
            label="公司社保"
            amount={(teacher.companySocialInsurance || 0).toFixed(0)}
          />
        </View>

        {/* 课时费流水 */}
        {slipExpanded.lesson && (
          <View className="mt-[24rpx] py-[16rpx] px-[20rpx] bg-muted rounded-[16rpx]">
            {lessonRecords.map((rec, idx) => (
              <RecordRow
                key={idx}
                name={`${rec.date} ${rec.course} ${rec.hours}课时`}
                amount={`+${rec.amount.toFixed(2)}`}
              />
            ))}
          </View>
        )}

        {/* 提成流水 */}
        {slipExpanded.commission && (
          <View className="mt-[24rpx] py-[16rpx] px-[20rpx] bg-muted rounded-[16rpx]">
            {commissionRecords.map((rec, idx) => (
              <RecordRow key={idx} name={rec.name} amount={`+${rec.amount.toFixed(2)}`} />
            ))}
          </View>
        )}

        {/* 奖金明细 */}
        {slipExpanded.bonus && (
          <View className="mt-[24rpx] py-[16rpx] px-[20rpx] bg-muted rounded-[16rpx]">
            {(teacher.bonusAmount || 0) > 0 && (
              <RecordRow name="奖金金额" amount={`+${(teacher.bonusAmount || 0).toFixed(2)}`} />
            )}
            {teacher.deductions
              .filter((d) => d.type === 'bonus')
              .map((d) => (
                <RecordRow key={d.id} name={d.reason} amount={`+${d.amount.toFixed(2)}`} />
              ))}
            {bonusTotal === 0 && (
              <Text className="text-[24rpx] text-muted-foreground py-[12rpx]">暂无奖金</Text>
            )}
          </View>
        )}

        {/* 扣款明细 */}
        {slipExpanded.deduct && (
          <View className="mt-[24rpx] py-[16rpx] px-[20rpx] bg-muted rounded-[16rpx]">
            {(teacher.lateFine || 0) > 0 && (
              <RecordRow
                name="迟到罚款"
                amount={`-${(teacher.lateFine || 0).toFixed(2)}`}
                amountClassName="text-destructive"
              />
            )}
            {(teacher.otherFine || 0) > 0 && (
              <RecordRow
                name="其他罚款"
                amount={`-${(teacher.otherFine || 0).toFixed(2)}`}
                amountClassName="text-destructive"
              />
            )}
            {teacher.deductions
              .filter((d) => d.type === 'deduct')
              .map((d) => (
                <RecordRow
                  key={d.id}
                  name={d.reason}
                  amount={`-${d.amount.toFixed(2)}`}
                  amountClassName="text-destructive"
                />
              ))}
            {deductTotal === 0 && (
              <Text className="text-[24rpx] text-muted-foreground py-[12rpx]">暂无扣款</Text>
            )}
          </View>
        )}
      </View>

      {/* 底部操作 */}
      <View className="fixed bottom-0 left-0 right-0 px-[64rpx] py-[24rpx] pb-safe-bar bg-white border-t border-border z-20">
        {(currentStatus === 'sending' || currentStatus === 'teacher_confirmed') && (
          <View
            className="w-full py-[26rpx] rounded-full bg-primary text-white text-center text-[30rpx] font-semibold press-scale"
            onClick={() => {
              setPendingPayAction({ type: 'single', ids: [teacher.id] });
              setPaySheetVisible(true);
            }}
          >
            确认发放
          </View>
        )}
        {currentStatus === 'archived' && (
          <View
            className="w-full py-[26rpx] rounded-full bg-primary text-white text-center text-[30rpx] font-semibold press-scale"
            onClick={() => void Taro.navigateBack()}
          >
            返回
          </View>
        )}
      </View>

      {/* 发放确认弹窗 */}
      <PayConfirmSheet
        visible={paySheetVisible}
        action={{ type: 'single', ids: [teacher.id] }}
        teacherName={teacher.name}
        amount={total}
        onConfirm={handlePayConfirm}
        onClose={() => {
          setPaySheetVisible(false);
          setPendingPayAction(null);
        }}
      />
    </View>
  );
};

export default SalaryDetailPage;
