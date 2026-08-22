import { ScrollView, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import { auditLogService } from '@/services/audit-log';
import { cardTypeService } from '@/services/card-type';
import { lessonDebtService } from '@/services/lesson-debt';
import { memberCardService } from '@/services/member-card';
import { studentService } from '@/services/student';
import type { CardType, CardTypeKind } from '@/types/card-type';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { formatDateCN } from '@/utils/format';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 开卡对象 */
type CardTarget = 'self' | 'child';

const TARGET_OPTIONS: { value: CardTarget; label: string }[] = [
  { value: 'self', label: '本人' },
  { value: 'child', label: '子女' },
];

const KIND_LABEL_MAP: Record<CardTypeKind, string> = {
  count: '次卡',
  time: '时间卡',
  stored: '储值卡',
};

const MemberCardIssuePage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserName = profile?.name || '';

  const studentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.studentId || '');
  }, []);

  const [student, setStudent] = useState<Student | null>(null);
  const [cardTypes, setCardTypes] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 表单状态
  const [target, setTarget] = useState<CardTarget>('self');
  const [selectedCardTypeId, setSelectedCardTypeId] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [freezeCount, setFreezeCount] = useState('');
  const [freezeDays, setFreezeDays] = useState('');
  const [remark, setRemark] = useState('');
  const [showCardTypeSheet, setShowCardTypeSheet] = useState(false);

  const selectedCardType = useMemo(
    () => cardTypes.find((item) => item.id === selectedCardTypeId) || null,
    [cardTypes, selectedCardTypeId],
  );

  // 加载学员与卡种列表
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [stu, types] = await Promise.all([
        studentService.getById(studentId),
        cardTypeService.getList(),
      ]);
      if (!stu) {
        setStudent(null);
        setCardTypes([]);
        Taro.showToast({ title: '未找到学员信息', icon: 'none' });
        return;
      }
      setStudent(stu);
      setCardTypes(types.filter((item) => item.status === 'active'));
      // 默认选中第一个有效卡种
      if (types.length > 0) {
        const first = types.find((item) => item.status === 'active');
        if (first) {
          setSelectedCardTypeId(first.id);
          setFreezeCount(String(first.freezeCount));
          setFreezeDays(String(first.freezeDays));
          setPurchasePrice(String(first.price / 100));
        }
      }
    } catch (error) {
      logError('MemberCardIssuePage loadData', error);
      setLoadError('页面加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 选中卡种变化时，自动回填卡种默认配置
  useEffect(() => {
    if (!selectedCardType) return;
    setFreezeCount(String(selectedCardType.freezeCount));
    setFreezeDays(String(selectedCardType.freezeDays));
    setPurchasePrice(String(selectedCardType.price / 100));
  }, [selectedCardType]);

  const handleSelectCardType = useCallback((item: CardType) => {
    setSelectedCardTypeId(item.id);
    setShowCardTypeSheet(false);
  }, []);

  const validate = useCallback((): boolean => {
    if (!selectedCardType) {
      Taro.showToast({ title: '请选择会员卡类型', icon: 'none' });
      return false;
    }
    if (!purchasePrice || isNaN(Number(purchasePrice)) || Number(purchasePrice) < 0) {
      Taro.showToast({ title: '请输入有效的购买价格', icon: 'none' });
      return false;
    }
    if (freezeCount === '' || isNaN(Number(freezeCount))) {
      Taro.showToast({ title: '请输入可冻卡次数', icon: 'none' });
      return false;
    }
    if (freezeDays === '' || isNaN(Number(freezeDays))) {
      Taro.showToast({ title: '请输入可冻卡天数', icon: 'none' });
      return false;
    }
    return true;
  }, [selectedCardType, purchasePrice, freezeCount, freezeDays]);

  /** P1：处理学员未结欠课（划扣抵扣 / 平账豁免），UI 提醒老师选择 */
  const handlePendingDebt = useCallback(async (sid: string) => {
    try {
      const debts = lessonDebtService.getPendingByStudent(sid);
      const totalDebt = debts.reduce((sum, d) => sum + d.hours, 0);
      if (totalDebt <= 0) return;

      const action = await new Promise<number>((resolve) => {
        Taro.showActionSheet({
          itemList: ['划扣抵扣', '平账豁免'],
          success: (res) => resolve(res.tapIndex),
          fail: () => resolve(-1),
        });
      });

      if (action === 0) {
        // 划扣：取刚发的最新一张卡，从关联课包剩余抵扣欠课，未抵完部分保留
        const cards = await memberCardService.getByStudent(sid);
        const latestCard = cards[0];
        if (latestCard) {
          const notCovered = await memberCardService.deductDebt(latestCard.id, totalDebt);
          const settled = await lessonDebtService.settleByStudent(
            sid,
            'deduct',
            totalDebt - notCovered,
          );
          Taro.showToast({
            title: `已划扣 ${settled.settledHours} 课时抵欠课`,
            icon: 'none',
          });
        }
      } else if (action === 1) {
        const settled = await lessonDebtService.settleByStudent(sid, 'waive');
        Taro.showToast({ title: `已平账 ${settled.settledHours} 课时欠课`, icon: 'none' });
      }
    } catch (err) {
      logError('MemberCardIssuePage handlePendingDebt', err);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!student || !selectedCardType) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      await memberCardService.issue({
        cardTypeId: selectedCardType.id,
        cardTypeName: selectedCardType.name,
        studentId: student.id,
        studentName: student.name,
        studentAvatar: student.avatar_url,
        studentPhone: student.phone,
        purchasePrice: Math.round(Number(purchasePrice) * 100),
        source: '前台开卡',
        operatorName: currentUserName || undefined,
        cardType: selectedCardType,
        cardNo: cardNo.trim() || undefined,
        remark: remark.trim() || undefined,
      });

      // P1（2026-08-22）：发卡后若该学员有未结欠课，提醒老师选择「划扣抵扣 / 平账豁免」
      await handlePendingDebt(student.id);
      // 审计日志（用户口径 2026-08-22）：开卡属关键财务操作
      try {
        await auditLogService.record({
          action: 'card.issue',
          operatorId: profile?.id || '',
          operatorName: currentUserName || profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'member_card',
          targetId: selectedCardType.id,
          detail: `会员开卡：学员「${student.name}」开「${selectedCardType.name}」`,
          meta: { studentId: student.id, cardTypeName: selectedCardType.name },
        });
      } catch (e) {
        logError('audit card.issue', e);
      }
      Taro.showToast({ title: '开卡成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (error) {
      logError('MemberCardIssuePage submit', error);
      Taro.showToast({ title: '开卡失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    currentUserName,
    purchasePrice,
    cardNo,
    remark,
    selectedCardType,
    student,
    validate,
    handlePendingDebt,
    profile,
  ]);

  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background flex items-center justify-center">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[32rpx] flex items-center justify-center">
          <Empty description={loadError} actionText="重新加载" onAction={loadData} />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-background flex flex-col">
        <ScrollView scrollY className="flex-1">
          <View className="px-[32rpx] pt-[32rpx] pb-[180rpx]">
            {/* 学员信息卡 */}
            <View className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft flex items-center gap-[24rpx]">
              <StudentAvatar name={student?.name || ''} src={student?.avatar_url} size="lg" />
              <View className="flex-1 min-w-0">
                <Text className="text-[32rpx] font-bold text-foreground block">
                  {student?.name}
                </Text>
                <Text className="text-[26rpx] text-muted-foreground mt-[8rpx] block">
                  {student?.phone || '暂无手机号'}
                </Text>
              </View>
            </View>

            {/* 开卡对象 */}
            <View className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft mt-[24rpx]">
              <View className="flex items-center justify-between">
                <Text className="text-[28rpx] text-foreground font-medium">开卡对象</Text>
                <View className="flex flex-row gap-[16rpx]">
                  {TARGET_OPTIONS.map((opt) => (
                    <View
                      key={opt.value}
                      className={cn(
                        'px-[32rpx] py-[12rpx] rounded-[40rpx] text-[26rpx] font-medium transition-all',
                        target === opt.value
                          ? 'bg-gradient-primary text-white'
                          : 'bg-muted text-muted-foreground',
                      )}
                      onClick={() => setTarget(opt.value)}
                    >
                      <Text>{opt.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* 会员卡信息 */}
            <View className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft mt-[24rpx]">
              <View className="flex items-center gap-[12rpx] mb-[28rpx]">
                <Icon name="mdi-card-account-details" size={28} color="#3B6EF5" />
                <Text className="text-[30rpx] font-bold text-foreground">会员卡信息</Text>
              </View>

              <View className="flex flex-col gap-[24rpx]">
                {/* 会员卡类型选择 */}
                <View
                  className="flex items-center justify-between py-[20rpx] border-b-[2rpx] border-border"
                  onClick={() => setShowCardTypeSheet(true)}
                >
                  <Text className="text-[28rpx] text-foreground font-medium">会员卡类型</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text
                      className={cn(
                        'text-[28rpx]',
                        selectedCardType ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {selectedCardType
                        ? `${selectedCardType.name}（${KIND_LABEL_MAP[selectedCardType.kind]}）`
                        : '请选择'}
                    </Text>
                    <Icon name="mdi-chevron-right" size={28} color="#999999" />
                  </View>
                </View>

                <FormInput
                  label="卡号"
                  placeholder="请输入卡号（选填）"
                  value={cardNo}
                  onInput={(e) => setCardNo(e.detail.value || '')}
                  variant="ghost"
                />

                <FormInput
                  label="归属员工"
                  placeholder="请输入归属员工（选填）"
                  value={currentUserName}
                  disabled
                  variant="ghost"
                />
              </View>
            </View>

            {/* 价格与设置 */}
            {selectedCardType && (
              <View className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft mt-[24rpx]">
                <View className="flex items-center gap-[12rpx] mb-[28rpx]">
                  <Icon name="mdi-currency-cny" size={28} color="#3B6EF5" />
                  <Text className="text-[30rpx] font-bold text-foreground">价格与设置</Text>
                </View>

                <View className="flex flex-col gap-[24rpx]">
                  <View className="flex items-center justify-between py-[12rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">卡原价</Text>
                    <Text className="text-[28rpx] text-foreground font-medium">
                      ¥{(selectedCardType.price / 100).toFixed(2)}
                    </Text>
                  </View>

                  <FormInput
                    label="购买价格"
                    placeholder="请输入购买价格"
                    type="digit"
                    value={purchasePrice}
                    onInput={(e) => setPurchasePrice(e.detail.value || '')}
                    variant="ghost"
                    hint="可根据实际购卡价格修改"
                    required
                  />

                  <FormInput
                    label="可冻卡总次数"
                    placeholder="请输入可冻卡次数"
                    type="number"
                    value={freezeCount}
                    onInput={(e) => setFreezeCount(e.detail.value || '')}
                    variant="ghost"
                    required
                  />

                  <FormInput
                    label="可冻卡总天数"
                    placeholder="请输入可冻卡天数"
                    type="number"
                    value={freezeDays}
                    onInput={(e) => setFreezeDays(e.detail.value || '')}
                    variant="ghost"
                    required
                  />

                  {selectedCardType.kind === 'count' && (
                    <View className="flex items-center justify-between py-[12rpx]">
                      <Text className="text-[28rpx] text-muted-foreground">可用次数</Text>
                      <Text className="text-[28rpx] text-foreground font-medium">
                        {selectedCardType.count} 次
                      </Text>
                    </View>
                  )}

                  {selectedCardType.kind === 'time' && (
                    <View className="flex items-center justify-between py-[12rpx]">
                      <Text className="text-[28rpx] text-muted-foreground">有效天数</Text>
                      <Text className="text-[28rpx] text-foreground font-medium">
                        {selectedCardType.validDays} 天
                      </Text>
                    </View>
                  )}

                  {selectedCardType.validDays > 0 && (
                    <View className="flex items-center justify-between py-[12rpx]">
                      <Text className="text-[28rpx] text-muted-foreground">到期日期</Text>
                      <Text className="text-[28rpx] text-foreground font-medium">
                        {formatDateCN(
                          new Date(Date.now() + selectedCardType.validDays * 24 * 60 * 60 * 1000)
                            .toISOString()
                            .slice(0, 10),
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* 备注 */}
            <View className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft mt-[24rpx]">
              <Textarea
                className="w-full text-[28rpx] text-foreground min-h-[160rpx]"
                placeholder="请输入备注（非必填项）"
                placeholderClass="input-placeholder"
                value={remark}
                onInput={(e) => setRemark(e.detail.value || '')}
                maxlength={200}
                disableDefaultPadding
                autoHeight
              />
            </View>
          </View>
        </ScrollView>

        {/* 底部确认按钮 */}
        <View className="fixed left-0 right-0 bottom-0 px-[32rpx] py-[24rpx] bg-white border-t-[2rpx] border-border safe-area-bottom">
          <View
            className={cn(
              'rounded-[48rpx] py-[28rpx] center press-scale',
              selectedCardType && !submitting ? 'bg-gradient-primary' : 'bg-border',
            )}
            onClick={selectedCardType && !submitting ? handleSubmit : undefined}
          >
            <Text className="text-[30rpx] text-white font-semibold">
              {submitting ? '开卡中...' : '确认开卡'}
            </Text>
          </View>
        </View>

        {/* 卡种选择弹窗 */}
        <BottomSheet
          visible={showCardTypeSheet}
          title="选择会员卡类型"
          onClose={() => setShowCardTypeSheet(false)}
          height="70vh"
        >
          <View className="px-[32rpx] py-[24rpx] flex flex-col gap-[16rpx]">
            {cardTypes.length === 0 ? (
              <Empty description="暂无可用卡种" />
            ) : (
              cardTypes.map((item) => {
                const selected = item.id === selectedCardTypeId;
                return (
                  <View
                    key={item.id}
                    className={cn(
                      'rounded-[24rpx] border px-[24rpx] py-[24rpx] flex items-center justify-between',
                      selected ? 'border-primary bg-primary/5' : 'border-border bg-white',
                    )}
                    onClick={() => handleSelectCardType(item)}
                  >
                    <View>
                      <Text className="text-[28rpx] font-semibold text-foreground block">
                        {item.name}
                      </Text>
                      <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                        {KIND_LABEL_MAP[item.kind]} · 售价 ¥{(item.price / 100).toFixed(2)}
                      </Text>
                    </View>
                    <Icon
                      name={selected ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'}
                      size="sm"
                      color={selected ? '#5EC8A8' : '#c7ced9'}
                    />
                  </View>
                );
              })
            )}
          </View>
        </BottomSheet>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(MemberCardIssuePage);
