import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import FormInput from '@/components/FormInput';
import type { RechargeCommonFieldsValue } from '@/components/member-card/RechargeCommonFields';
import { DEFAULT_PAYMENT_METHOD } from '@/constants/payment-method';
import { memberCardService } from '@/services/member-card';
import { invalidateStudentListCache } from '@/services/student';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import { SUCCESS_TOAST_MS } from '@/utils/post-save-navigation';

export interface MemberCardRechargeFormProps {
  student: Student;
  onSuccess?: () => void;
  /**
   * 共性收款字段（金额 / 收费方式 / 分期 / 备注）由页面层持有并常驻在 Tab 切换区之外，
   * 2026-10-03 用户要求切换操作方式时不必重复填写。
   */
  common?: RechargeCommonFieldsValue;
  onCommonChange?: (patch: Partial<RechargeCommonFieldsValue>) => void;
  /** 提交信号：页面层底部固定栏自增此值，本组件监听到变化后执行提交。 */
  submitSignal?: number;
  /** 上报「能否提交」，供页面层决定底栏按钮是否可点 */
  onSubmitReadyChange?: (ready: boolean) => void;
}

export type RechargeCountsResult =
  | { ok: true; amount: number; gift: number }
  | { ok: false; message: string };

/**
 * 解析并校验「追加次数 / 赠送次数」——**至少填一项，可同时填写**。
 * 都留空或都为 0 ⇒ 报错；填了的必须是非负整数（只送不买、只买不送、两者都填均合法）。
 */
export const resolveRechargeCounts = (
  amountText: string,
  giftText: string,
): RechargeCountsResult => {
  const hasAmount = amountText.trim() !== '';
  const hasGift = giftText.trim() !== '';
  if (!hasAmount && !hasGift) {
    return { ok: false, message: '追加次数与赠送次数至少填一项' };
  }
  const amount = hasAmount ? Number(amountText) : 0;
  const gift = hasGift ? Number(giftText) : 0;
  if (!Number.isInteger(amount) || amount < 0) {
    return { ok: false, message: '追加次数必须是非负整数' };
  }
  if (!Number.isInteger(gift) || gift < 0) {
    return { ok: false, message: '赠送次数必须是非负整数' };
  }
  if (amount + gift < 1) {
    return { ok: false, message: '追加次数与赠送次数至少填一项' };
  }
  return { ok: true, amount, gift };
};

/** 为已有次卡追加权益；所有写入均走 MemberCard adjustment 契约。 */
const MemberCardRechargeForm: React.FC<MemberCardRechargeFormProps> = ({
  student,
  onSuccess,
  common,
  submitSignal,
  onSubmitReadyChange,
}) => {
  /** 追加次数会改「该学员该科目的剩余」⇒ 必须让学员列表缓存失效 */
  const [cards, setCards] = useState<MemberCardDetail[]>([]);
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [giftAmount, setGiftAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * 收款字段改为**受控于页面层**（父组件传 common）。
   * 公共的金额/收费方式/分期/备注由 `RechargeCommonFields` 在 Tab 切换区之外渲染，
   * 本组件只读取值用于提交；独立使用（无 common）时退回本地默认值。
   */
  const [localCommon] = useState<RechargeCommonFieldsValue>({
    amount: '0',
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    remark: '',
    installmentEnabled: false,
    installmentPeriod: 2,
    installmentSchedule: [],
  });
  const isControlled = common !== undefined;
  const form = isControlled ? (common as RechargeCommonFieldsValue) : localCommon;
  const price = form.amount;
  const paymentMethod = form.paymentMethod;
  const remark = form.remark;
  /** 分期信息随备注一并留痕到账本（与发卡口径一致） */
  const installmentNote =
    form.installmentEnabled && form.installmentSchedule.length
      ? `分期${form.installmentPeriod}期：${form.installmentSchedule
          .map((s) => `${s.date}/¥${s.amount}`)
          .join('；')}`
      : '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void memberCardService
      .getByStudent(student.id)
      .then((items) => {
        if (cancelled) return;
        const active = items.filter(
          (item) => item.status === 'active' && item.cardTypeKind === 'count',
        );
        setCards(active);
        setCardId((current) => current || active[0]?.id || '');
      })
      .catch((error) => logError('load member cards for recharge', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student.id]);

  const selectedCard = useMemo(() => cards.find((item) => item.id === cardId), [cards, cardId]);

  /** 能否提交：已加载完 + 选好卡 + 填了次数 + 未在提交 */
  const canSubmit = useMemo(
    () =>
      !loading && Boolean(selectedCard) && resolveRechargeCounts(amount, giftAmount).ok && !saving,
    [loading, selectedCard, amount, giftAmount, saving],
  );

  useEffect(() => {
    onSubmitReadyChange?.(canSubmit);
  }, [canSubmit, onSubmitReadyChange]);

  const submit = async () => {
    if (!selectedCard) return Taro.showToast({ title: '请选择已有会员卡', icon: 'none' });
    const counts = resolveRechargeCounts(amount, giftAmount);
    if (!counts.ok) return Taro.showToast({ title: counts.message, icon: 'none' });
    const paid = Number(price || 0);
    if (!Number.isFinite(paid) || paid < 0)
      return Taro.showToast({ title: '实收金额无效', icon: 'none' });
    if (saving) return;
    setSaving(true);
    try {
      const mergedReason = [remark.trim(), installmentNote].filter(Boolean).join(' | ');
      await memberCardService.recharge({
        memberCardId: selectedCard.id,
        amount: counts.amount,
        giftAmount: counts.gift,
        purchasePrice: Math.round(paid * 100),
        paymentMethod,
        reason: mergedReason || '会员卡充值',
        idempotencyKey: `recharge-${student.id}-${selectedCard.id}-${Date.now()}`,
      });
      Taro.showToast({ title: '追加次数成功', icon: 'success', duration: SUCCESS_TOAST_MS });
      invalidateStudentListCache();
      /**
       * 成功后退上一级（与发会员卡一致）。
       * 2026-10-03 用户要求：原来只 onSuccess?.()，父页面没传回调时既不刷新也不退页，
       * 用户以为没生效。提示播完再退，避免 toast 被 navigateBack 吃掉。
       */
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else Taro.navigateBack();
      }, SUCCESS_TOAST_MS);
    } catch (error) {
      logError('recharge member card', error);
      Taro.showToast({ title: '追加失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  /** 页面层底部固定栏点「确认追加」⇒ submitSignal 自增 ⇒ 这里执行提交 */
  const firstSignalRef = useRef(true);
  useEffect(() => {
    if (firstSignalRef.current) {
      firstSignalRef.current = false;
      return;
    }
    if (!submitSignal) return;
    if (!canSubmit) return;
    void submit();
    // submit 每次渲染重建，这里只在 signal 变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitSignal, canSubmit]);

  if (loading)
    return (
      <View className="py-[80rpx] text-center">
        <Text className="text-muted-foreground">加载会员卡中...</Text>
      </View>
    );
  if (!cards.length) {
    return (
      <View className="bg-white rounded-[24rpx] p-[48rpx] text-center">
        <Text className="text-muted-foreground">该学员暂无可追加次数的次卡，请先发会员卡</Text>
      </View>
    );
  }

  return (
    <View className="pb-[40rpx]">
      <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft">
        <Text className="text-[28rpx] font-semibold block mb-[16rpx]">选择已有会员卡</Text>
        {cards.map((card) => (
          <View
            key={card.id}
            className={`rounded-[20rpx] border p-[24rpx] mb-[16rpx] ${card.id === cardId ? 'border-primary bg-primary/5' : 'border-border'}`}
            onClick={() => setCardId(card.id)}
          >
            <View className="flex justify-between">
              <Text className="font-medium">{card.cardTypeName}</Text>
              <Text>{card.remainingCount ?? 0} 次</Text>
            </View>
            <Text className="text-[22rpx] text-muted-foreground block mt-[8rpx]">
              卡号 {card.cardNo || card.id}
            </Text>
          </View>
        ))}
      </View>
      <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft mt-[20rpx]">
        <FormInput
          label="追加次数"
          type="number"
          value={amount}
          onInput={(e) => setAmount(e.detail.value || '')}
          placeholder="选填"
          hint="追加次数与赠送次数至少填一项，两者可同时填写"
        />
        <FormInput
          label="赠送次数"
          type="number"
          value={giftAmount}
          onInput={(e) => setGiftAmount(e.detail.value || '')}
          placeholder="选填"
        />
      </View>
      {/**
       * 提交按钮由页面层底部固定栏统一渲染（位置在公共收款字段之后）。
       * 本组件通过 submitSignal 接收提交指令。
       */}
    </View>
  );
};

export default MemberCardRechargeForm;
