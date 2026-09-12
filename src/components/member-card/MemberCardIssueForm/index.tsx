/**
 * 发会员卡表单（可嵌入课时充值 Tab，也可独立页面使用）
 */
import { Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import Icon from '@/components/Icon';
import InstallmentPanel, {
  buildInstallmentSchedule,
  type ScheduleItem,
} from '@/components/InstallmentPanel';
import Switch from '@/components/Switch';
import { subscribeMessageService } from '@/services';
import { auditLogService } from '@/services/audit-log';
import { cardTypeService } from '@/services/card-type';
import { lessonDebtService } from '@/services/lesson-debt';
import { memberCardService } from '@/services/member-card';
import type { CardType, CardTypeKind } from '@/types/card-type';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { formatDateCN } from '@/utils/format';
import { logError } from '@/utils/logger';

const KIND_LABEL_MAP: Record<CardTypeKind, string> = {
  count: '次卡',
  time: '时间卡',
  stored: '储值卡',
};

export interface MemberCardIssueFormProps {
  student: Student;
  /** 嵌入模式：不展示底部固定栏时由外层控制；默认 true */
  showSubmitBar?: boolean;
  onSuccess?: () => void;
}

const MemberCardIssueForm: React.FC<MemberCardIssueFormProps> = ({
  student,
  showSubmitBar = true,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const operatorName = profile?.name || '';
  const operatorId = profile?.id || '';

  const [cardTypes, setCardTypes] = useState<CardType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCardTypeId, setSelectedCardTypeId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [remark, setRemark] = useState('');
  const [showCardTypeSheet, setShowCardTypeSheet] = useState(false);
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentPeriod, setInstallmentPeriod] = useState(2);
  const [installmentSchedule, setInstallmentSchedule] = useState<ScheduleItem[]>([]);

  const selectedCardType = useMemo(
    () => cardTypes.find((item) => item.id === selectedCardTypeId) || null,
    [cardTypes, selectedCardTypeId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingTypes(true);
      try {
        const types = await cardTypeService.getList();
        if (cancelled) return;
        const active = types.filter((item) => item.status === 'active');
        setCardTypes(active);
        if (active.length > 0) {
          setSelectedCardTypeId(active[0].id);
          setPurchasePrice(String(active[0].price / 100));
        }
      } catch (error) {
        logError('MemberCardIssueForm load types', error);
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCardType) return;
    setPurchasePrice(String(selectedCardType.price / 100));
  }, [selectedCardType]);

  const handleToggleInstallment = useCallback(
    (on: boolean) => {
      setInstallmentEnabled(on);
      if (on) {
        const amount = parseFloat(purchasePrice) || 0;
        setInstallmentSchedule(buildInstallmentSchedule(amount, installmentPeriod || 2));
      } else {
        setInstallmentSchedule([]);
      }
    },
    [purchasePrice, installmentPeriod],
  );

  /**
   * 开卡后处理欠课（F2-a 诚实反馈）：
   * - none：无欠课；settled：已处理（可能部分）；skipped：用户取消；failed：处理失败
   * - 划扣走 settle（后端同事务扣卡 + 销欠），不再单独调 deduct 接口
   */
  const handlePendingDebt = useCallback(
    async (
      sid: string,
    ): Promise<{ outcome: 'none' | 'settled' | 'skipped' | 'failed'; message?: string }> => {
      try {
        const debts = await lessonDebtService.getPendingByStudent(sid);
        const totalDebt = debts.reduce((sum, d) => sum + d.hours, 0);
        if (totalDebt <= 0) return { outcome: 'none' };

        const action = await new Promise<number>((resolve) => {
          Taro.showActionSheet({
            itemList: ['划扣抵扣', '平账豁免'],
            success: (res) => resolve(res.tapIndex),
            fail: () => resolve(-1),
          });
        });

        if (action === 0) {
          const cards = await memberCardService.getByStudent(sid);
          const latestCard = cards[0];
          const settled = await lessonDebtService.settleByStudent(
            sid,
            'deduct',
            undefined,
            latestCard?.id,
          );
          // 部分划扣 / 余额不足如实提示（禁止只报「已划扣 X」）
          if (
            settled.notCovered > 0 ||
            (settled.settledHours === 0 && settled.remainingDebtHours > 0)
          ) {
            return {
              outcome: 'settled',
              message: `欠课仅部分处理：已划扣 ${settled.settledHours}，未覆盖 ${settled.notCovered}`,
            };
          }
          return { outcome: 'settled', message: `已划扣 ${settled.settledHours} 课时抵欠课` };
        }

        if (action === 1) {
          const settled = await lessonDebtService.settleByStudent(sid, 'waive');
          return { outcome: 'settled', message: `已平账 ${settled.settledHours} 课时欠课` };
        }

        return { outcome: 'skipped' };
      } catch (err) {
        // 不吞错：交由调用方提示「开卡成功，欠课未处理」
        logError('MemberCardIssueForm handlePendingDebt', err);
        return {
          outcome: 'failed',
          message: err instanceof Error ? err.message.slice(0, 40) : undefined,
        };
      }
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedCardType) {
      Taro.showToast({ title: '请选择会员卡类型', icon: 'none' });
      return;
    }
    if (!purchasePrice || isNaN(Number(purchasePrice)) || Number(purchasePrice) < 0) {
      Taro.showToast({ title: '请输入有效的购买价格', icon: 'none' });
      return;
    }
    if (installmentEnabled) {
      if (!installmentSchedule.length) {
        Taro.showToast({ title: '请完善分期计划', icon: 'none' });
        return;
      }
      if (
        installmentSchedule.some(
          (item) =>
            !item.date ||
            !item.amount ||
            Number.isNaN(parseFloat(item.amount)) ||
            parseFloat(item.amount) <= 0,
        )
      ) {
        Taro.showToast({ title: '请填写完整的分期计划', icon: 'none' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await memberCardService.issue({
        cardTypeId: selectedCardType.id,
        cardTypeName: selectedCardType.name,
        studentId: student.id,
        studentName: student.name,
        studentAvatar: student.avatar_url,
        studentPhone: student.phone,
        purchasePrice: Math.round(Number(purchasePrice) * 100),
        source: '前台开卡',
        operatorId: operatorId || undefined,
        operatorName: operatorName || undefined,
        cardType: selectedCardType,
        remark:
          [
            remark.trim(),
            installmentEnabled
              ? `分期${installmentPeriod}期：${installmentSchedule
                  .map((s) => `${s.date}/¥${s.amount}`)
                  .join('；')}`
              : '',
          ]
            .filter(Boolean)
            .join(' | ') || undefined,
      });

      const debtResult = await handlePendingDebt(student.id);
      try {
        await auditLogService.record({
          action: 'card.issue',
          operatorId: operatorId || '',
          operatorName: operatorName || profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'member_card',
          targetId: created.id,
          detail: `会员开卡：学员「${student.name}」开「${selectedCardType.name}」卡号 ${created.cardNo || '-'}`,
          meta: {
            studentId: student.id,
            cardTypeId: selectedCardType.id,
            cardNo: created.cardNo,
            purchasePrice: created.purchasePrice,
            installmentEnabled,
            installmentPeriod: installmentEnabled ? installmentPeriod : undefined,
            installmentSchedule: installmentEnabled ? installmentSchedule : undefined,
          },
        });
      } catch (e) {
        logError('audit card.issue', e);
      }
      if (debtResult.outcome === 'failed' || debtResult.outcome === 'skipped') {
        // 开卡成功但欠课未处理/跳过：如实提示（DEC-011）
        Taro.showToast({ title: '开卡成功，欠课未处理', icon: 'none' });
      } else {
        Taro.showToast({ title: '开卡成功', icon: 'success' });
        if (debtResult.message) {
          setTimeout(() => {
            Taro.showToast({ title: debtResult.message as string, icon: 'none' });
          }, 900);
        }
      }
      try {
        Taro.hideToast();
        await subscribeMessageService.runFlow('E09', {
          studentId: student.id,
          studentName: student.name,
          role: profile?.currentContext?.role,
        });
      } catch (error) {
        logError('subscribe E09 after card issue', error);
      }
      if (onSuccess) onSuccess();
      else setTimeout(() => Taro.navigateBack(), 300);
    } catch (error) {
      logError('MemberCardIssueForm submit', error);
      Taro.showToast({ title: '开卡失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedCardType,
    purchasePrice,
    installmentEnabled,
    installmentSchedule,
    installmentPeriod,
    remark,
    student,
    operatorId,
    operatorName,
    profile,
    handlePendingDebt,
    onSuccess,
  ]);

  if (loadingTypes) {
    return (
      <View className="py-[80rpx] flex items-center justify-center">
        <Text className="text-[26rpx] text-muted-foreground">加载卡种中...</Text>
      </View>
    );
  }

  return (
    <View className={cn(showSubmitBar ? 'pb-[180rpx]' : 'pb-[24rpx]')}>
      <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft">
        <Text className="text-[28rpx] font-semibold text-foreground mb-[8rpx] block">
          会员卡信息
        </Text>
        <Text className="text-[22rpx] text-muted-foreground mb-[20rpx] block">
          卡号将自动生成，操作人后台可查
        </Text>
        <View
          className="flex items-center justify-between py-[22rpx] border-b border-border"
          onClick={() => setShowCardTypeSheet(true)}
        >
          <Text className="text-[26rpx] text-muted-foreground">卡种</Text>
          <View className="flex items-center gap-[8rpx] max-w-[420rpx]">
            <Text
              className={cn(
                'text-[28rpx] text-right',
                selectedCardType ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {selectedCardType
                ? `${selectedCardType.name}（${KIND_LABEL_MAP[selectedCardType.kind]}）`
                : '请选择'}
            </Text>
            <Icon name="mdi-chevron-right" size={26} color="#999999" />
          </View>
        </View>
      </View>

      {selectedCardType ? (
        <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft mt-[20rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground mb-[20rpx] block">
            价格与权益
          </Text>
          <View className="flex items-center justify-between py-[16rpx]">
            <Text className="text-[26rpx] text-muted-foreground">卡原价</Text>
            <Text className="text-[26rpx] text-foreground">
              ¥{(selectedCardType.price / 100).toFixed(2)}
            </Text>
          </View>
          <FormInput
            label="实付价格"
            placeholder="请输入实付金额"
            type="digit"
            value={purchasePrice}
            onInput={(e) => setPurchasePrice(e.detail.value || '')}
            variant="ghost"
            hint="可按实际成交价修改"
            required
          />
          {selectedCardType.kind === 'count' ? (
            <View className="flex items-center justify-between py-[16rpx]">
              <Text className="text-[26rpx] text-muted-foreground">可用次数</Text>
              <Text className="text-[28rpx] font-medium text-foreground">
                {selectedCardType.count} 次
              </Text>
            </View>
          ) : null}
          {selectedCardType.kind === 'time' ? (
            <View className="flex items-center justify-between py-[16rpx]">
              <Text className="text-[26rpx] text-muted-foreground">有效天数</Text>
              <Text className="text-[28rpx] font-medium text-foreground">
                {selectedCardType.validDays} 天
              </Text>
            </View>
          ) : null}
          {selectedCardType.validDays > 0 ? (
            <View className="flex items-center justify-between py-[16rpx]">
              <Text className="text-[26rpx] text-muted-foreground">预计到期</Text>
              <Text className="text-[26rpx] text-foreground">
                {formatDateCN(
                  new Date(Date.now() + selectedCardType.validDays * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .slice(0, 10),
                )}
              </Text>
            </View>
          ) : (
            <View className="flex items-center justify-between py-[16rpx]">
              <Text className="text-[26rpx] text-muted-foreground">有效期</Text>
              <Text className="text-[26rpx] text-foreground">永久有效</Text>
            </View>
          )}
        </View>
      ) : null}

      <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft mt-[20rpx]">
        <FormRow label="分期付款" border={installmentEnabled} helperText="选填，开启后按期还款">
          <Switch checked={installmentEnabled} onChange={handleToggleInstallment} />
        </FormRow>
        {installmentEnabled ? (
          <InstallmentPanel
            totalAmount={purchasePrice}
            enabled={installmentEnabled}
            onToggle={handleToggleInstallment}
            periodCount={installmentPeriod}
            onPeriodChange={setInstallmentPeriod}
            schedule={installmentSchedule}
            onScheduleChange={setInstallmentSchedule}
          />
        ) : null}
      </View>

      <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft mt-[20rpx]">
        <Text className="text-[26rpx] text-muted-foreground mb-[12rpx] block">备注</Text>
        <Textarea
          className="w-full text-[28rpx] text-foreground min-h-[140rpx]"
          placeholder="选填"
          placeholderClass="input-placeholder"
          value={remark}
          onInput={(e) => setRemark(e.detail.value || '')}
          maxlength={200}
          disableDefaultPadding
          autoHeight
        />
      </View>

      {showSubmitBar ? (
        <View className="fixed left-0 right-0 bottom-0 px-[32rpx] py-[24rpx] bg-white border-t border-border safe-area-bottom">
          <View
            className={cn(
              'rounded-[48rpx] py-[26rpx] center press-scale',
              selectedCardType && !submitting ? 'bg-gradient-primary' : 'bg-border',
            )}
            onClick={selectedCardType && !submitting ? () => void handleSubmit() : undefined}
          >
            <Text className="text-[30rpx] text-white font-semibold">
              {submitting ? '开卡中...' : '确认开卡'}
            </Text>
          </View>
        </View>
      ) : (
        <View className="mt-[32rpx]">
          <View
            className={cn(
              'rounded-[48rpx] py-[26rpx] center press-scale',
              selectedCardType && !submitting ? 'bg-gradient-primary' : 'bg-border',
            )}
            onClick={selectedCardType && !submitting ? () => void handleSubmit() : undefined}
          >
            <Text className="text-[30rpx] text-white font-semibold">
              {submitting ? '开卡中...' : '确认开卡'}
            </Text>
          </View>
        </View>
      )}

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
                    'rounded-[20rpx] border px-[24rpx] py-[22rpx] flex items-center justify-between',
                    selected ? 'border-primary bg-primary/5' : 'border-border bg-white',
                  )}
                  onClick={() => {
                    setSelectedCardTypeId(item.id);
                    setShowCardTypeSheet(false);
                  }}
                >
                  <View className="min-w-0 flex-1">
                    <Text className="text-[28rpx] font-semibold text-foreground block">
                      {item.name}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground mt-[6rpx] block">
                      {KIND_LABEL_MAP[item.kind]} · ¥{(item.price / 100).toFixed(2)}
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
  );
};

export default MemberCardIssueForm;
