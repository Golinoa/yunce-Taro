import { Picker, ScrollView, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { auditLogService } from '@/services/audit-log';
import { memberCardService } from '@/services/member-card';
import type { MemberCardDetail } from '@/types/member-card';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import { clearTodoRead, rechargeAlertTodoId } from '@/utils/todo-read';

function formatCurrencyYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '0.00';
  return (fen / 100).toFixed(2);
}

function parseCurrencyFen(yuan: string): number | undefined {
  const val = parseFloat(yuan);
  if (Number.isNaN(val)) return undefined;
  return Math.round(val * 100);
}

function formatDate(date?: string): string {
  if (!date) return '';
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : date;
}

interface FormRowProps {
  label: string;
  required?: boolean;
  editable?: boolean;
  placeholder?: string;
  value?: string;
  onInput?: (e: { detail: { value: string } }) => void;
  inputType?: 'text' | 'number' | 'digit';
  maxlength?: number;
  children?: React.ReactNode;
  onClick?: () => void;
  arrow?: boolean;
  last?: boolean;
}

const FormRow: React.FC<FormRowProps> = ({
  label,
  required = false,
  editable = false,
  placeholder,
  value,
  onInput,
  inputType,
  maxlength,
  children,
  onClick,
  arrow,
  last,
}) => (
  <View
    className={cn(
      'flex flex-row items-center py-[24rpx]',
      !last && 'border-b-[2rpx] border-border/30',
      onClick && 'press-scale',
    )}
    onClick={onClick}
  >
    <View className="flex flex-row items-center shrink-0 mr-[24rpx]">
      <Text className="text-[30rpx] text-foreground whitespace-nowrap">{label}</Text>
      {required && <Text className="text-[30rpx] text-destructive ml-[4rpx]">*</Text>}
    </View>
    <View className="flex-1 min-w-0 flex flex-row items-center justify-end">
      {editable ? (
        <FormInput
          variant="ghost"
          className="flex-1 min-w-0"
          placeholder={placeholder}
          value={value}
          onInput={onInput}
          type={inputType}
          maxlength={maxlength}
          inputClassName="text-right text-[30rpx]"
        />
      ) : (
        <>
          <View className="flex flex-row items-center gap-[8rpx]">{children}</View>
          {(onClick || arrow) && (
            <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />
          )}
        </>
      )}
    </View>
  </View>
);

/**
 * 会员卡编辑页
 *
 * 使用场景：
 * - 从会员卡详情页点击「编辑」进入，修改会员卡资料
 * - 卡号为系统派发，不可修改
 */
const MemberCardEditPage: React.FC = () => {
  const { profile } = useAuth();
  const cardId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [card, setCard] = useState<MemberCardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [cardTypeName, setCardTypeName] = useState('');
  const [purchaseAt, setPurchaseAt] = useState('');
  const [activatedAt, setActivatedAt] = useState('');
  const [expiredAt, setExpiredAt] = useState('');
  const [remainingCount, setRemainingCount] = useState('');
  const [remainingDays, setRemainingDays] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [remark, setRemark] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const detail = await memberCardService.getById(cardId);
      if (!detail) {
        Taro.showToast({ title: '会员卡不存在', icon: 'none' });
        return;
      }
      setCard(detail);
      setCardTypeName(detail.cardTypeName || '');
      setPurchaseAt(formatDate(detail.purchaseAt));
      setActivatedAt(formatDate(detail.activatedAt));
      setExpiredAt(formatDate(detail.expiredAt));
      setRemainingCount(String(detail.remainingCount || 0));
      setRemainingDays(String(detail.remainingDays || 0));
      setRemainingAmount(formatCurrencyYuan(detail.remainingAmount));
      setOwnerName(detail.ownerName || '');
      setRemark(detail.remark || '');
    } catch (error) {
      logError('MemberCardEditPage loadData', error);
      setLoadError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = useCallback(async () => {
    if (!card) return;
    setSubmitting(true);
    try {
      const updateData: Partial<MemberCardDetail> = {
        cardTypeName: cardTypeName.trim() || undefined,
        purchaseAt: purchaseAt ? dayjs(purchaseAt).toISOString() : undefined,
        activatedAt: activatedAt ? dayjs(activatedAt).toISOString() : undefined,
        expiredAt: expiredAt || undefined,
        ownerName: ownerName.trim() || undefined,
        remark: remark.trim() || undefined,
      };

      if (card.cardTypeKind === 'count') {
        updateData.remainingCount = parseInt(remainingCount, 10) || 0;
      }
      if (card.cardTypeKind === 'time') {
        updateData.remainingDays = parseInt(remainingDays, 10) || 0;
      }
      if (card.cardTypeKind === 'stored') {
        updateData.remainingAmount = parseCurrencyFen(remainingAmount) ?? card.remainingAmount;
      }

      const updated = await memberCardService.update(card.id, updateData);
      if (updated) {
        // 审计日志（用户口径 2026-08-22）：会员卡充值/调整剩余属关键财务操作
        try {
          const kindLabel =
            card.cardTypeKind === 'count'
              ? `剩余次数调整为 ${remainingCount} 次`
              : card.cardTypeKind === 'time'
                ? `剩余天数调整为 ${remainingDays} 天`
                : `余额调整为 ¥${remainingAmount}`;
          await auditLogService.record({
            action: 'card.recharge',
            operatorId: profile?.id || '',
            operatorName: profile?.name || '未知',
            operatorRole: profile?.currentContext?.role || 'unknown',
            targetType: 'member_card',
            targetId: card.id,
            detail: `充值/调整会员卡：「${cardTypeName || '会员卡'}」（${kindLabel}）`,
            meta: {
              cardId: card.id,
              cardTypeKind: card.cardTypeKind,
              remainingCount,
              remainingDays,
              remainingAmount,
            },
          });
        } catch (e) {
          logError('audit card.recharge', e);
        }
        // 预警联动：充值/加课时后剩余回升 → 清除该学员「课时续费提醒」待办已读记录，之后再次下降可重新在首页待办提醒
        if (card.studentId) {
          try {
            clearTodoRead(rechargeAlertTodoId(card.studentId));
          } catch (e) {
            logError('operation alert clear', e);
          }
        }
        Taro.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => {
          Taro.navigateBack();
        }, 500);
      }
    } catch (error) {
      logError('MemberCardEditPage handleSubmit', error);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    card,
    cardTypeName,
    purchaseAt,
    activatedAt,
    expiredAt,
    ownerName,
    remark,
    remainingCount,
    remainingDays,
    remainingAmount,
    profile,
  ]);

  if (loading) {
    return (
      <PageContainer>
        <View className="h-screen bg-background flex items-center justify-center">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError || !card) {
    return (
      <PageContainer>
        <View className="h-screen bg-background px-[32rpx] flex items-center justify-center">
          <View className="center-col gap-[24rpx]">
            <Icon name="mdi-alert-circle" size={80} color="muted-foreground" />
            <Text className="text-[28rpx] text-muted-foreground">
              {loadError || '会员卡不存在'}
            </Text>
            <View
              className="px-[40rpx] py-[16rpx] rounded-[40rpx] bg-primary center press-scale"
              onClick={loadData}
            >
              <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
            </View>
          </View>
        </View>
      </PageContainer>
    );
  }

  const isCount = card.cardTypeKind === 'count';
  const isTime = card.cardTypeKind === 'time';
  const isStored = card.cardTypeKind === 'stored';

  const totalCount = card.cardTypeCount || 0;
  const usedCount = Math.max(totalCount - (card.remainingCount || 0), 0);
  const totalDays = card.cardTypeValidDays || 0;
  const usedDays = Math.max(totalDays - (card.remainingDays || 0), 0);
  const totalAmount = card.purchasePrice || 0;
  const usedAmount = card.consumedValue || 0;

  return (
    <PageContainer>
      <View className="h-screen bg-background flex flex-col">
        <ScrollView scrollY className="flex-1 min-h-0">
          <View className="px-[32rpx] pt-[24rpx] pb-[200rpx]">
            {/* 基础信息 */}
            <View className="bg-white rounded-[24rpx] overflow-hidden mb-[24rpx] shadow-soft px-[28rpx]">
              <FormRow
                label="会员卡名称"
                required
                editable
                placeholder="请输入"
                value={cardTypeName}
                onInput={(e) => setCardTypeName(e.detail.value)}
                maxlength={50}
              />
              <FormRow label="卡号">
                <Text className="text-[30rpx] text-muted-foreground">{card.cardNo}</Text>
              </FormRow>
              <Picker
                mode="date"
                value={purchaseAt}
                onChange={(e) => setPurchaseAt(e.detail.value)}
              >
                <FormRow label="发卡日期" arrow>
                  <Text className="text-[30rpx] text-foreground">{purchaseAt || '请选择'}</Text>
                </FormRow>
              </Picker>
              <Picker
                mode="date"
                value={activatedAt}
                onChange={(e) => setActivatedAt(e.detail.value)}
              >
                <FormRow label="开卡日期" arrow>
                  <Text className="text-[30rpx] text-foreground">{activatedAt || '请选择'}</Text>
                </FormRow>
              </Picker>
              <Picker mode="date" value={expiredAt} onChange={(e) => setExpiredAt(e.detail.value)}>
                <FormRow label="有效期至" required arrow>
                  <Text className="text-[30rpx] text-foreground">{expiredAt || '请选择'}</Text>
                </FormRow>
              </Picker>
              {isCount && (
                <FormRow
                  label="剩余卡次"
                  editable
                  placeholder="请输入"
                  value={remainingCount}
                  onInput={(e) => setRemainingCount(e.detail.value)}
                  inputType="number"
                  maxlength={6}
                  last
                />
              )}
              {isTime && (
                <FormRow
                  label="剩余天数"
                  editable
                  placeholder="请输入"
                  value={remainingDays}
                  onInput={(e) => setRemainingDays(e.detail.value)}
                  inputType="number"
                  maxlength={5}
                  last
                />
              )}
              {isStored && (
                <FormRow
                  label="剩余金额"
                  editable
                  placeholder="请输入"
                  value={remainingAmount}
                  onInput={(e) => setRemainingAmount(e.detail.value)}
                  inputType="digit"
                  maxlength={12}
                  last
                />
              )}
            </View>

            {/* 价值与归属 */}
            <View className="bg-white rounded-[24rpx] overflow-hidden mb-[24rpx] shadow-soft px-[28rpx]">
              <FormRow label="总价值">
                <Text className="text-[30rpx] text-foreground">
                  {formatCurrencyYuan(card.purchasePrice)}
                </Text>
              </FormRow>
              {isCount && (
                <>
                  <FormRow label="总卡次">
                    <Text className="text-[30rpx] text-foreground">{totalCount}</Text>
                  </FormRow>
                  <FormRow label="已用卡次">
                    <Text className="text-[30rpx] text-foreground">{usedCount}</Text>
                  </FormRow>
                </>
              )}
              {isTime && (
                <>
                  <FormRow label="总天数">
                    <Text className="text-[30rpx] text-foreground">{totalDays}</Text>
                  </FormRow>
                  <FormRow label="已用天数">
                    <Text className="text-[30rpx] text-foreground">{usedDays}</Text>
                  </FormRow>
                </>
              )}
              {isStored && (
                <>
                  <FormRow label="总储值">
                    <Text className="text-[30rpx] text-foreground">
                      {formatCurrencyYuan(totalAmount)}
                    </Text>
                  </FormRow>
                  <FormRow label="已用金额">
                    <Text className="text-[30rpx] text-foreground">
                      {formatCurrencyYuan(usedAmount)}
                    </Text>
                  </FormRow>
                </>
              )}
              <FormRow label="剩余价值">
                <Text className="text-[30rpx] text-foreground">
                  {formatCurrencyYuan(card.remainingValue)}
                </Text>
              </FormRow>
              <FormRow
                label="归属员工"
                editable
                placeholder="请选择"
                value={ownerName}
                onInput={(e) => setOwnerName(e.detail.value)}
                maxlength={30}
                last
              />
            </View>

            {/* 备注 */}
            <View className="bg-white rounded-[24rpx] overflow-hidden shadow-soft px-[28rpx] py-[24rpx]">
              <Text className="text-[30rpx] text-foreground font-medium mb-[12rpx] block">
                备注
              </Text>
              <Textarea
                className="w-full text-[28rpx] text-foreground bg-transparent leading-relaxed"
                placeholder="请输入内容"
                placeholderClass="text-muted-foreground"
                value={remark}
                onInput={(e) => setRemark(e.detail.value)}
                maxlength={200}
                style={{ minHeight: '140rpx', height: '140rpx' }}
              />
            </View>
          </View>
        </ScrollView>

        {/* 底部保存按钮 */}
        <View className="shrink-0 px-[32rpx] py-[20rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))] bg-background">
          <View
            className={cn(
              'w-full py-[24rpx] rounded-[40rpx] center press-scale',
              !submitting ? 'bg-profile-orange-solid' : 'bg-border',
            )}
            onClick={!submitting ? handleSubmit : undefined}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {submitting ? '保存中...' : '保存'}
            </Text>
          </View>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(MemberCardEditPage);
