import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import MemberCardIssueForm from '@/components/member-card/MemberCardIssueForm';
import MemberCardRechargeForm from '@/components/member-card/MemberCardRechargeForm';
import RechargeCommonFields, {
  type RechargeCommonFieldsValue,
} from '@/components/member-card/RechargeCommonFields';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import StudentPickerSheet from '@/components/student/StudentPickerSheet';
import { DEFAULT_PAYMENT_METHOD } from '@/constants/payment-method';
import { studentService } from '@/services';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 会员卡操作：发新卡 / 给已有次卡追加次数 */
type CardOperation = 'issue' | 'recharge';

const OPERATION_TABS: { key: CardOperation; label: string }[] = [
  { key: 'issue', label: '发会员卡' },
  { key: 'recharge', label: '追加次数' },
];

/**
 * 会员卡操作页（课时充值入口）。
 *
 * 两种进入方式：
 * 1. 带 `studentId`（学员列表、学员详情的「去充值」）⇒ 直接进操作；
 * 2. 不带参数（首页「课时充值」快捷入口）⇒ 页内先选学员，选好再操作。
 * 选好学员后可切换「发会员卡 / 追加次数」两种方式。
 */
const MemberCardIssuePage: React.FC = () => {
  const initialStudentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.studentId || '');
  }, []);

  /** 页内选学员后会改写，所以是 state 而不是常量 */
  const [studentId, setStudentId] = useState(initialStudentId);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(Boolean(initialStudentId));
  const [loadError, setLoadError] = useState('');
  const [operation, setOperation] = useState<CardOperation>('issue');

  /**
   * 共性收款字段（金额 / 收费方式 / 分期 / 备注）。
   * 2026-10-03 用户要求：放在 Tab 切换区**之外**常驻，切换操作方式不用重复填写，
   * 也避免漏填收费方式。state 提到页面层，两个子表单通过 props 接收。
   */
  const [common, setCommon] = useState<RechargeCommonFieldsValue>({
    amount: '',
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    remark: '',
    installmentEnabled: false,
    installmentPeriod: 2,
    installmentSchedule: [],
  });

  const handleCommonChange = useCallback((patch: Partial<RechargeCommonFieldsValue>) => {
    setCommon((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * 底部固定提交栏：点一下自增 submitSignal，子表单监听到变化后各自执行提交。
   *
   * ⚠️ 「能否提交 / 是否提交中」一律由**子表单上报**（`onSubmitReadyChange`），
   * 不要在这里用定时器模拟 submitting：发卡含分期校验可能超过 1.5s，
   * 定时器提前复位会让按钮变亮，用户可重复点 ⇒ 重复开卡/重复充值（资损）。
   */
  const [submitSignal, setSubmitSignal] = useState(0);
  /** 子表单（发卡 / 追加次数）上报的提交就绪状态 */
  const [issueReady, setIssueReady] = useState(false);
  const [rechargeReady, setRechargeReady] = useState(false);
  const canSubmit = operation === 'issue' ? issueReady : rechargeReady;

  const handleSubmitTap = useCallback(() => {
    if (!canSubmit) return;
    setSubmitSignal((n) => n + 1);
  }, [canSubmit]);

  /** 切换 Tab 时重置就绪状态，避免沿用上一个 Tab 的判断 */
  useEffect(() => {
    if (operation === 'issue') setRechargeReady(false);
    else setIssueReady(false);
  }, [operation]);

  const loadData = useCallback(async () => {
    if (!studentId) {
      setStudent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const stu = await studentService.getById(studentId);
      if (!stu) {
        setStudent(null);
        Taro.showToast({ title: '未找到学员信息', icon: 'none' });
        return;
      }
      setStudent(stu);
    } catch (error) {
      logError('MemberCardIssuePage loadData', error);
      setLoadError('页面加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background flex items-center justify-center">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  // 没指定学员（从首页入口进来）：先选人，选好再操作
  if (!studentId) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[32rpx] pt-[32rpx]">
          <View
            className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft flex items-center gap-[20rpx] active:opacity-80"
            onClick={() => setPickerVisible(true)}
          >
            <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary-bg flex items-center justify-center">
              <Icon name="mdi-account-search" size={44} color="primary" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[30rpx] font-semibold text-foreground block">选择学员</Text>
              <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                选好学员后可发会员卡或追加次数
              </Text>
            </View>
          </View>
        </View>
        <StudentPickerSheet
          visible={pickerVisible}
          title="选择学员"
          allowClear={false}
          onClose={() => setPickerVisible(false)}
          onSelect={(picked) => {
            setPickerVisible(false);
            if (picked) {
              setLoading(true);
              setStudentId(picked.id);
            }
          }}
        />
      </PageContainer>
    );
  }

  if (loadError || !student) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[32rpx] flex items-center justify-center">
          <Empty
            description={loadError || '未找到学员信息'}
            actionText="重新加载"
            onAction={() => void loadData()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-background px-[32rpx] pt-[32rpx] pb-[180rpx]">
        <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft flex items-center gap-[20rpx] mb-[20rpx]">
          <StudentAvatar name={student.name} src={student.avatar_url} size="lg" />
          <View className="flex-1 min-w-0">
            <Text className="text-[34rpx] font-bold text-foreground block">{student.name}</Text>
            <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
              {student.phone || '暂无手机号'}
            </Text>
          </View>
        </View>

        {/* 操作方式：发会员卡 | 追加次数 */}
        <View className="mb-[20rpx] bg-white rounded-[20rpx] shadow-sm overflow-hidden">
          <View className="flex">
            {OPERATION_TABS.map((tabItem) => (
              <View
                key={tabItem.key}
                className="flex-1 flex items-center justify-center py-[28rpx] relative"
                onClick={() => setOperation(tabItem.key)}
              >
                <Text
                  className={cn(
                    'text-[28rpx] font-medium',
                    operation === tabItem.key ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {tabItem.label}
                </Text>
                {operation === tabItem.key ? (
                  <View className="absolute bottom-0 left-0 right-0 h-[4rpx] bg-primary" />
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {operation === 'issue' ? (
          <MemberCardIssueForm
            student={student}
            common={common}
            onCommonChange={handleCommonChange}
            submitSignal={submitSignal}
            onSubmitReadyChange={setIssueReady}
          />
        ) : (
          <MemberCardRechargeForm
            student={student}
            common={common}
            submitSignal={submitSignal}
            onSubmitReadyChange={setRechargeReady}
          />
        )}

        {/**
         * 共性收款字段常驻在 Tab 切换区之外：切换「发会员卡 / 追加次数」不用重复填写
         * 金额、收费方式、分期、备注（2026-10-03 用户要求）。
         */}
        <RechargeCommonFields {...common} onChange={handleCommonChange} />

        {/**
         * 底部固定提交栏：放在公共收款字段**之后**，两个 Tab 共用一套按钮。
         * （原先各表单自带按钮，会被固定栏遮住提取出来的收款字段。）
         */}
        <View className="fixed left-0 right-0 bottom-0 px-[32rpx] py-[24rpx] bg-white border-t border-border safe-area-bottom">
          <View
            className={cn(
              'rounded-[48rpx] py-[26rpx] center press-scale',
              canSubmit ? 'bg-gradient-primary' : 'bg-border',
            )}
            onClick={canSubmit ? handleSubmitTap : undefined}
          >
            <Text className="text-[30rpx] text-white font-semibold">
              {operation === 'issue' ? '确认开卡' : '确认追加次数'}
            </Text>
          </View>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(MemberCardIssuePage);
