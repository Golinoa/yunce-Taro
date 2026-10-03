/**
 * 发会员卡表单（可嵌入课时充值 Tab，也可独立页面使用）
 */
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import type { RechargeCommonFieldsValue } from '@/components/member-card/RechargeCommonFields';
import { DEFAULT_PAYMENT_METHOD } from '@/constants/payment-method';
import { subscribeMessageService } from '@/services';
import { auditLogService } from '@/services/audit-log';
import { cardTypeService } from '@/services/card-type';
import { lessonDebtService } from '@/services/lesson-debt';
import { memberCardService } from '@/services/member-card';
import { invalidateStudentListCache } from '@/services/student';
import type { CardType, CardTypeKind } from '@/types/card-type';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { formatDateCN } from '@/utils/format';
import { logError } from '@/utils/logger';
import { SUCCESS_TOAST_MS } from '@/utils/post-save-navigation';

const KIND_LABEL_MAP: Record<CardTypeKind, string> = {
  count: '次卡',
  time: '时间卡',
  stored: '储值卡',
};

export interface MemberCardIssueFormProps {
  student: Student;
  onSuccess?: () => void;
  /**
   * 共性收款字段（金额 / 收费方式 / 分期 / 备注）由页面层持有并常驻在 Tab 切换区之外，
   * 2026-10-03 用户要求切换操作方式时不必重复填写。
   */
  common?: RechargeCommonFieldsValue;
  onCommonChange?: (patch: Partial<RechargeCommonFieldsValue>) => void;
  /**
   * 提交信号：页面层底部固定栏自增此值，本组件监听到变化后执行提交。
   * 用于把提交按钮放到公共收款字段**之后**（2026-10-03）。
   */
  submitSignal?: number;
  /** 上报「能否提交 / 是否提交中」，供页面层决定底栏按钮状态 */
  onSubmitReadyChange?: (ready: boolean) => void;
}

const MemberCardIssueForm: React.FC<MemberCardIssueFormProps> = ({
  student,
  onSuccess,
  common,
  onCommonChange,
  submitSignal,
  onSubmitReadyChange,
}) => {
  const { profile } = useAuth();
  const operatorName = profile?.name || '';
  const operatorId = profile?.id || '';
  /**
   * 发卡会改变学员「每个科目的可用课时」（弹窗过滤/显示/校验都依赖它）
   * ⇒ 必须让学员列表缓存失效，否则回到班级页看到的还是发卡前的旧数据。
   */

  const [cardTypes, setCardTypes] = useState<CardType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCardTypeId, setSelectedCardTypeId] = useState('');
  const [showCardTypeSheet, setShowCardTypeSheet] = useState(false);

  /**
   * 收款字段改为**受控于页面层**（父组件传 common / onCommonChange）。
   * 组件独立使用（无 common）时退回本地 state，两种用法都能跑。
   */
  const [localCommon, setLocalCommon] = useState<RechargeCommonFieldsValue>({
    amount: '',
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    remark: '',
    installmentEnabled: false,
    installmentPeriod: 2,
    installmentSchedule: [],
  });
  const isControlled = common !== undefined;
  const form = isControlled ? (common as RechargeCommonFieldsValue) : localCommon;
  const setForm = useCallback(
    (patch: Partial<RechargeCommonFieldsValue>) => {
      if (onCommonChange) onCommonChange(patch);
      else setLocalCommon((prev) => ({ ...prev, ...patch }));
    },
    [onCommonChange],
  );
  const purchasePrice = form.amount;

  /**
   * 实付价格的「卡种联动」控制：卡种带出建议价，但用户手动改过之后就不再覆盖。
   *
   * ⚠️ 不能用 state 标记 —— 卡种自动带价与用户输入都走同一个 onChange，
   * 用 state 会在自动带价时就把自己标成「已改过」，导致切卡种后价格再也不变。
   * 改用 ref 记录「最近一次自动带出的值」，与当前值不一致即视为用户改过。
   */
  const autoFilledPriceRef = useRef<string | null>(null);
  const userEditedPriceRef = useRef(false);

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
          const suggested = String(active[0].price / 100);
          autoFilledPriceRef.current = suggested;
          setForm({ amount: suggested });
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
    // priceTouched 仅用于「首次带出建议价」判断，不应触发重新拉取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCardType) return;
    // 用户手动改过金额 ⇒ 不再跟随卡种联动
    if (userEditedPriceRef.current) return;
    const suggested = String(selectedCardType.price / 100);
    autoFilledPriceRef.current = suggested;
    setForm({ amount: suggested });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardType]);

  /**
   * 金额输入框在父页面的公共收款区，本组件拿不到 onChange；
   * 这里监听值变化：与「最近一次自动带出的值」不同 ⇒ 判定为用户手动填写，
   * 此后切换卡种不再覆盖成交价。
   */
  useEffect(() => {
    if (autoFilledPriceRef.current === null) return;
    if (purchasePrice !== autoFilledPriceRef.current) userEditedPriceRef.current = true;
  }, [purchasePrice]);

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
          // 划扣：settle 内部同事务扣卡 + 销欠。
          // 不传 memberCardId → 后端按 purchaseAt desc 自选最新卡，避免前端顺序不确定选错卡。
          const settled = await lessonDebtService.settleByStudent(sid, 'deduct');
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
    const { remark, paymentMethod, installmentEnabled, installmentSchedule, installmentPeriod } =
      form;
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
        // 收费方式：后端开卡接口已支持，会同时落 MemberCard.paymentMethod 与账本 feeMethod
        paymentMethod,
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
        Taro.showToast({ title: '开卡成功，欠课未处理', icon: 'none', duration: SUCCESS_TOAST_MS });
      } else {
        Taro.showToast({ title: '开卡成功', icon: 'success', duration: SUCCESS_TOAST_MS });
      }

      /**
       * 开卡成功统一收尾：提示按序播完再退页；订阅授权 fire-and-forget。
       *
       * ⚠️ 两个坑（2026-09-25 FE-23 同类修复）：
       * 1. 不要紧跟 `showToast` 调 `Taro.hideToast()`，那会把「开卡成功」提示立刻抹掉；
       * 2. `runFlow('E09')` 的 Promise 只在用户点击订阅弹框时 resolve，`await` 在退页之前
       *    会导致 `onSuccess`/`navigateBack` 永不执行。
       */
      const finish = () => {
        // 先失效学员缓存（含按科目课时），再回调 —— 保证回到列表页时拿到发卡后的数据
        invalidateStudentListCache();
        if (onSuccess) onSuccess();
        else Taro.navigateBack();
        void (async () => {
          try {
            await subscribeMessageService.runFlow('E09', {
              studentId: student.id,
              studentName: student.name,
              role: profile?.currentContext?.role,
            });
          } catch (error) {
            logError('subscribe E09 after card issue', error);
          }
        })();
      };

      if (
        debtResult.outcome !== 'failed' &&
        debtResult.outcome !== 'skipped' &&
        debtResult.message
      ) {
        // 先让「开卡成功」播完，再播欠课说明，说明也播完才退页
        setTimeout(() => {
          Taro.hideToast();
          Taro.showToast({
            title: debtResult.message as string,
            icon: 'none',
            duration: SUCCESS_TOAST_MS,
          });
          setTimeout(finish, SUCCESS_TOAST_MS);
        }, SUCCESS_TOAST_MS);
      } else {
        setTimeout(finish, SUCCESS_TOAST_MS);
      }
    } catch (error) {
      logError('MemberCardIssueForm submit', error);
      Taro.showToast({ title: '开卡失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedCardType,
    purchasePrice,
    form,
    student,
    operatorId,
    operatorName,
    profile,
    handlePendingDebt,
    onSuccess,
  ]);

  /**
   * 能否提交：已选卡种 + 金额有效 + 未在提交中。上报页面层控制底栏按钮。
   */
  const issueReady =
    Boolean(selectedCardType) &&
    purchasePrice !== '' &&
    !Number.isNaN(Number(purchasePrice)) &&
    !submitting;
  useEffect(() => {
    onSubmitReadyChange?.(issueReady);
  }, [issueReady, onSubmitReadyChange]);

  /**
   * 页面层底部固定栏点「确认开卡」⇒ submitSignal 自增 ⇒ 这里执行提交。
   * 跳过首次渲染（signal 初始 0）。
   */
  const firstSignalRef = useRef(true);
  useEffect(() => {
    if (firstSignalRef.current) {
      firstSignalRef.current = false;
      return;
    }
    if (!submitSignal) return;
    if (!issueReady) return;
    void handleSubmit();
  }, [submitSignal, issueReady, handleSubmit]);

  if (loadingTypes) {
    return (
      <View className="py-[80rpx] flex items-center justify-center">
        <Text className="text-[26rpx] text-muted-foreground">加载卡种中...</Text>
      </View>
    );
  }

  return (
    /**
     * ⚠️ 底部**不要**在这里加 `pb-[180rpx]` 之类的提交栏留白：
     * 收款字段（金额/收费方式/分期/备注）已提取到页面层的 `RechargeCommonFields`，
     * 渲染在本组件**外面**，留白加在这里盖不住它们，会被固定底栏遮住。
     * 留白与提交栏统一由页面层负责。
     */
    <View>
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

      {/**
       * 提交按钮由页面层底部固定栏统一渲染（位置在公共收款字段之后），
       * 本组件通过 submitSignal 接收提交指令。
       */}

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
