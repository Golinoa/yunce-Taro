/**
 * PhoneInput - 带国际区号前缀的手机号输入（auth 分包�?
 */
import { View, Text, Input, Picker } from '@tarojs/components';
import type { InputProps } from '@tarojs/components';
import cn from 'classnames';
import React, { useMemo, useState } from 'react';
import Icon from '@/components/Icon';

export interface CountryDialOption {
  label: string;
  dialCode: string;
}

export const DEFAULT_COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { label: '中国大陆', dialCode: '+86' },
  { label: '中国香港', dialCode: '+852' },
  { label: '中国澳门', dialCode: '+853' },
  { label: '中国台湾', dialCode: '+886' },
];

export interface PhoneInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onInput?: InputProps['onInput'];
  onCountryChange?: (option: CountryDialOption) => void;
  countryOptions?: CountryDialOption[];
  defaultCountryIndex?: number;
  maxlength?: number;
  hint?: string;
  error?: string;
  focus?: boolean;
  adjustPosition?: boolean;
  className?: string;
  variant?: 'default' | 'capsule';
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  label,
  placeholder = '请输入手机号',
  value = '',
  onInput,
  onCountryChange,
  countryOptions = DEFAULT_COUNTRY_DIAL_OPTIONS,
  defaultCountryIndex = 0,
  maxlength = 11,
  hint,
  error,
  focus = false,
  adjustPosition = true,
  className,
  variant = 'default',
}) => {
  const [countryIndex, setCountryIndex] = useState(defaultCountryIndex);
  const isCapsule = variant === 'capsule';
  const selectedCountry = countryOptions[countryIndex] || countryOptions[0];

  const pickerRange = useMemo(
    () => countryOptions.map((item) => `${item.dialCode} ${item.label}`),
    [countryOptions],
  );

  const handleCountryPick = (index: number) => {
    setCountryIndex(index);
    onCountryChange?.(countryOptions[index]);
  };

  const handleInput = (e: Parameters<NonNullable<InputProps['onInput']>>[0]) => {
    onInput?.(e);
    return e.detail.value;
  };

  return (
    <View className={cn(!isCapsule && 'mb-4', className)}>
      {label && !isCapsule ? (
        <View className="flex flex-row items-center gap-1 mb-[12rpx]">
          <Text className="text-sm text-muted-foreground font-medium">{label}</Text>
        </View>
      ) : null}

      <View
        className={cn(
          'relative w-full flex flex-row items-center',
          isCapsule
            ? 'py-[24rpx] px-[28rpx] rounded-full bg-white border-[2rpx] border-white/70 shadow-[0_12rpx_40rpx_rgba(59,110,245,0.10)]'
            : 'py-[22rpx] px-[28rpx] rounded-2xl bg-primary-5 border-[3rpx] border-border-light',
          error && !isCapsule && 'border-destructive',
        )}
      >
        <Picker
          mode="selector"
          range={pickerRange}
          value={countryIndex}
          onChange={(e) => handleCountryPick(Number(e.detail.value))}
        >
          <View className="flex flex-row items-center flex-shrink-0 active:opacity-80">
            <Text
              className={cn(
                'font-semibold text-foreground',
                isCapsule ? 'text-[30rpx]' : 'text-base',
              )}
            >
              {selectedCountry.dialCode}
            </Text>
            <Icon name="mdi-chevron-down" size={28} className="text-muted-foreground ml-[4rpx]" />
          </View>
        </Picker>
        <View
          className={cn(
            'w-[2rpx] bg-border-light mx-[20rpx] flex-shrink-0',
            isCapsule ? 'h-[36rpx]' : 'h-[32rpx]',
          )}
        />
        <Input
          className={cn('flex-1 text-base text-foreground', isCapsule && 'text-left')}
          placeholder={placeholder}
          placeholderClass="input-placeholder"
          value={value}
          onInput={handleInput}
          type="number"
          maxlength={maxlength}
          focus={focus}
          adjustPosition={adjustPosition}
        />
      </View>

      {error ? (
        <Text className="text-xs text-destructive mt-[8rpx]">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted-foreground mt-[8rpx]">{hint}</Text>
      ) : null}
    </View>
  );
};

export function isPhoneValidForDialCode(phone: string, dialCode: string): boolean {
  const normalized = phone.trim();
  if (dialCode === '+86') {
    return /^1[3-9]\d{9}$/.test(normalized);
  }
  return /^\d{5,15}$/.test(normalized);
}

export default PhoneInput;
