import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useMemo, useState } from 'react';
import FormInput from '@/components/FormInput';
import { memberCardService } from '@/services/member-card';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';

export interface MemberCardRechargeFormProps {
  student: Student;
  onSuccess?: () => void;
}

/** 为已有次卡追加权益；所有写入均走 MemberCard adjustment 契约。 */
const MemberCardRechargeForm: React.FC<MemberCardRechargeFormProps> = ({ student, onSuccess }) => {
  const [cards, setCards] = useState<MemberCardDetail[]>([]);
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [giftAmount, setGiftAmount] = useState('0');
  const [price, setPrice] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reason, setReason] = useState('会员卡充值');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const submit = async () => {
    const count = Number(amount);
    const gift = Number(giftAmount || 0);
    const paid = Number(price || 0);
    if (!selectedCard) return Taro.showToast({ title: '请选择已有会员卡', icon: 'none' });
    if (!Number.isInteger(count) || count <= 0)
      return Taro.showToast({ title: '追加次数必须是正整数', icon: 'none' });
    if (!Number.isInteger(gift) || gift < 0)
      return Taro.showToast({ title: '赠送次数无效', icon: 'none' });
    if (!Number.isFinite(paid) || paid < 0)
      return Taro.showToast({ title: '实收金额无效', icon: 'none' });
    if (!reason.trim()) return Taro.showToast({ title: '请填写追加原因', icon: 'none' });
    if (saving) return;
    setSaving(true);
    try {
      await memberCardService.recharge({
        memberCardId: selectedCard.id,
        amount: count,
        giftAmount: gift,
        purchasePrice: Math.round(paid * 100),
        paymentMethod: paymentMethod.trim() || undefined,
        reason: reason.trim(),
        idempotencyKey: `recharge-${student.id}-${selectedCard.id}-${Date.now()}`,
      });
      Taro.showToast({ title: '追加次数成功', icon: 'success' });
      onSuccess?.();
    } catch (error) {
      logError('recharge member card', error);
      Taro.showToast({ title: '追加失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

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
          required
          type="number"
          value={amount}
          onInput={(e) => setAmount(e.detail.value || '')}
          placeholder="请输入次数"
        />
        <FormInput
          label="赠送次数"
          type="number"
          value={giftAmount}
          onInput={(e) => setGiftAmount(e.detail.value || '0')}
          placeholder="0"
        />
        <FormInput
          label="实收金额（元）"
          type="digit"
          value={price}
          onInput={(e) => setPrice(e.detail.value || '0')}
          placeholder="0"
        />
        <FormInput
          label="收费方式"
          value={paymentMethod}
          onInput={(e) => setPaymentMethod(e.detail.value || '')}
          placeholder="现金 / 转账 / 其他"
        />
        <FormInput
          label="追加原因"
          required
          value={reason}
          onInput={(e) => setReason(e.detail.value || '')}
          placeholder="请输入原因"
        />
      </View>
      <View
        className={`mt-[32rpx] rounded-[48rpx] py-[26rpx] text-center ${saving ? 'bg-border' : 'bg-gradient-primary'}`}
        onClick={() => void submit()}
      >
        <Text className="text-[30rpx] text-white font-semibold">
          {saving ? '提交中...' : '确认追加次数'}
        </Text>
      </View>
    </View>
  );
};

export default MemberCardRechargeForm;
