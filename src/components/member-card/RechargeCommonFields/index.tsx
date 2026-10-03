/**
 * 发会员卡 / 追加次数 **共性字段区**（金额、收费方式、分期、备注）。
 *
 * 2026-10-03 用户要求：这四项两种操作都要填，且**必须放在 Tab 切换区之外**——
 * 原来切到「追加次数」就得重新填一遍金额/收费方式/备注，容易漏填。
 * 现在由父页面（member-card-issue）持有 state 并常驻渲染，切换 Tab 不丢值。
 *
 * 账务口径（用户明确）：**购买与赠送分开记账**，消耗时先耗购买、后耗赠送（同批次先进先出），
 * 退费只计算购买部分。因此「金额」只对应**购买**那部分，赠送次数不折算金额。
 */
import { Textarea, Text, View } from '@tarojs/components';
import React, { useCallback } from 'react';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import InstallmentPanel, {
  buildInstallmentSchedule,
  type ScheduleItem,
} from '@/components/InstallmentPanel';
import PaymentMethodField from '@/components/member-card/PaymentMethodField';
import Switch from '@/components/Switch';
import type { PaymentMethodValue } from '@/constants/payment-method';

export interface RechargeCommonFieldsValue {
  /** 实收 / 售价（元）。字符串态便于输入框受控；提交时由调用方转数字。 */
  amount: string;
  paymentMethod: PaymentMethodValue;
  remark: string;
  installmentEnabled: boolean;
  installmentPeriod: number;
  installmentSchedule: ScheduleItem[];
}

export interface RechargeCommonFieldsProps extends RechargeCommonFieldsValue {
  onChange: (patch: Partial<RechargeCommonFieldsValue>) => void;
  /** 「售价」用于发卡页，「实收金额」用于追加次数页 */
  amountLabel?: string;
  amountHint?: string;
  /** 赠送次数为纯赠送（无购买）时置灰金额，避免「填了不生效」的困惑 */
  amountDisabled?: boolean;
}

const RechargeCommonFields: React.FC<RechargeCommonFieldsProps> = ({
  amount,
  paymentMethod,
  remark,
  installmentEnabled,
  installmentPeriod,
  installmentSchedule,
  onChange,
  amountLabel = '金额（元）',
  amountHint,
  amountDisabled = false,
}) => {
  const handleToggleInstallment = useCallback(
    (on: boolean) => {
      if (!on) {
        onChange({ installmentEnabled: false, installmentSchedule: [] });
        return;
      }
      const total = parseFloat(amount) || 0;
      onChange({
        installmentEnabled: true,
        installmentSchedule: buildInstallmentSchedule(total, installmentPeriod || 2),
      });
    },
    [amount, installmentPeriod, onChange],
  );

  return (
    <>
      <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft mt-[20rpx]">
        <Text className="text-[28rpx] font-semibold text-foreground mb-[20rpx] block">
          收款信息
        </Text>
        <FormInput
          label={amountLabel}
          type="digit"
          value={amount}
          onInput={(e) => onChange({ amount: e.detail.value || '' })}
          placeholder="0"
          hint={amountHint}
          disabled={amountDisabled}
        />
        <PaymentMethodField
          value={paymentMethod}
          onChange={(next) => onChange({ paymentMethod: next })}
        />
      </View>

      <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft mt-[20rpx]">
        <FormRow label="分期付款" border={installmentEnabled} helperText="选填，开启后按期还款">
          <Switch checked={installmentEnabled} onChange={handleToggleInstallment} />
        </FormRow>
        {installmentEnabled ? (
          <InstallmentPanel
            totalAmount={amount}
            enabled={installmentEnabled}
            onToggle={handleToggleInstallment}
            periodCount={installmentPeriod}
            onPeriodChange={(next) => onChange({ installmentPeriod: next })}
            schedule={installmentSchedule}
            onScheduleChange={(next) => onChange({ installmentSchedule: next })}
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
          onInput={(e) => onChange({ remark: e.detail.value || '' })}
          maxlength={200}
          disableDefaultPadding
          autoHeight
        />
      </View>
    </>
  );
};

export default RechargeCommonFields;
