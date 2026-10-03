/**
 * 收费方式单选（发会员卡 / 追加次数 共用）。
 *
 * 2026-10-03 用户要求：不要输入框自由填写，改为**预制单选**，
 * 五项（微信 / 支付宝 / 银行卡 / 现金 / 其他）平铺一行，默认「其他」。
 */
import { Text, View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethodValue,
} from '@/constants/payment-method';

export interface PaymentMethodFieldProps {
  value: PaymentMethodValue;
  onChange: (value: PaymentMethodValue) => void;
  label?: string;
}

const PaymentMethodField: React.FC<PaymentMethodFieldProps> = ({
  value,
  onChange,
  label = '收费方式',
}) => (
  <View className="mb-[8rpx]">
    <View className="flex items-center justify-between mb-[16rpx]">
      <Text className="text-[26rpx] text-muted-foreground">{label}</Text>
    </View>
    <View className="flex flex-wrap gap-[16rpx]">
      {PAYMENT_METHOD_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <View
            key={option.value}
            className={cn(
              'px-[32rpx] py-[16rpx] rounded-[16rpx] border transition-colors',
              selected ? 'border-primary bg-primary-bg' : 'border-border bg-white',
            )}
            onClick={() => onChange(option.value)}
          >
            <Text
              className={cn(
                'text-[26rpx]',
                selected ? 'text-primary font-semibold' : 'text-foreground',
              )}
            >
              {option.label}
            </Text>
          </View>
        );
      })}
    </View>
  </View>
);

export { DEFAULT_PAYMENT_METHOD };
export default PaymentMethodField;
