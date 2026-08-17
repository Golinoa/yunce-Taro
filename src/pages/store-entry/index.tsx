/**
 * 门店入驻申请页 pages/store-entry/index
 *
 * 由品牌介绍页底部「门店入驻」按钮进入，用于收集场馆入驻信息：
 * - 门店名称、门店类型
 * - 省市区（系统 Picker）+ 详细地址
 * - 地图定位（chooseLocation）
 * - 入驻协议同意 + 提交
 *
 * 全部使用 UnoCSS Token，随主题色联动。
 */
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { BRAND_NAME_ZH } from '@/constants/brand';
import { withRouteGuard } from '@/utils/route-guard';

/** 门店类型选项 */
const VENUE_TYPE_OPTIONS = [
  '格斗馆',
  '瑜伽馆',
  '舞蹈教室',
  '少儿体适能',
  '私教工作室',
  '康复拉伸',
  '其他',
];

interface FormState {
  name: string;
  type: string;
  region: string[];
  address: string;
  locationName: string;
  latitude: number;
  longitude: number;
  agreed: boolean;
}

interface FormErrors {
  name?: string;
  type?: string;
  region?: string;
  address?: string;
  agreed?: string;
}

/**
 * 表单行容器：左标签 + 右侧内容，行间细分割线
 */
function FieldRow({
  label,
  required,
  right,
  onClick,
}: {
  label: string;
  required?: boolean;
  right: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <View
      className={cn(
        'flex items-center min-h-[104rpx] px-[32rpx] border-b border-border/60 last:border-b-0',
        onClick && 'press-scale',
      )}
      onClick={onClick}
    >
      <View className="w-[180rpx] flex-shrink-0 flex items-center gap-[4rpx]">
        <Text className="text-[28rpx] text-muted-foreground">{label}</Text>
        {required && <Text className="text-[28rpx] text-destructive">*</Text>}
      </View>
      <View className="flex-1 flex items-center justify-end overflow-hidden">{right}</View>
    </View>
  );
}

/** 右侧箭头 */
function RowArrow() {
  return <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />;
}

/** 选择框占位/显示文本 */
function SelectValue({ value, placeholder }: { value?: string; placeholder: string }) {
  return (
    <Text
      className={cn('text-[30rpx] truncate', value ? 'text-foreground' : 'text-muted-foreground')}
    >
      {value || placeholder}
    </Text>
  );
}

const StoreEntry: React.FC = () => {
  const [form, setForm] = useState<FormState>({
    name: '',
    type: '',
    region: [],
    address: '',
    locationName: '',
    latitude: 0,
    longitude: 0,
    agreed: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const regionText = useMemo(() => form.region.filter(Boolean).join(' '), [form.region]);

  const updateForm = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 清除对应字段错误
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) {
      next.name = '请输入门店名称';
    }
    if (!form.type) {
      next.type = '请选择门店类型';
    }
    if (form.region.length === 0 || !form.region.some(Boolean)) {
      next.region = '请选择所在地区';
    }
    if (!form.address.trim()) {
      next.address = '请输入详细地址';
    }
    if (!form.agreed) {
      next.agreed = '请阅读并同意入驻协议';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const handleChooseLocation = useCallback(() => {
    Taro.chooseLocation({
      success: (res) => {
        if (!res) return;
        updateForm('locationName', res.name || res.address || '');
        updateForm('latitude', res.latitude ?? 0);
        updateForm('longitude', res.longitude ?? 0);
        // 如果详细地址为空，自动填充地址作为参考
        if (!form.address.trim() && res.address) {
          updateForm('address', res.address);
        }
      },
      fail: (err) => {
        // 用户取消或授权拒绝时不提示错误
        if (err?.errMsg?.includes('cancel') || err?.errMsg?.includes('auth')) return;
        Taro.showToast({ title: '定位失败，请重试', icon: 'none' });
      },
    }).catch(() => {
      // 吞掉 Promise rejection
    });
  }, [form.address, updateForm]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请完善入驻信息', icon: 'none' });
      return;
    }

    setSubmitting(true);
    // 模拟提交，实际联调时替换为 Service 调用
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSubmitting(false);

    Taro.showModal({
      title: '提交成功',
      content: `感谢您对${BRAND_NAME_ZH}的信任，工作人员将在 1-3 个工作日内与您联系。`,
      showCancel: false,
      success: () => {
        Taro.navigateBack();
      },
    });
  }, [validate]);

  return (
    <PageContainer safeBottom className="flex flex-col">
      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        <View className="px-[32rpx] py-[32rpx] flex flex-col gap-[24rpx] pb-[200rpx]">
          {/* 顶部说明 */}
          <View className="bg-gradient-primary rounded-[28rpx] p-[32rpx] shadow-elegant">
            <Text className="text-[36rpx] font-bold text-white">开启智慧场馆经营</Text>
            <Text className="text-[26rpx] text-white/90 mt-[12rpx] leading-relaxed block">
              填写下方信息申请入驻，审核通过后即可使用{BRAND_NAME_ZH}全部管理功能。
            </Text>
          </View>

          {/* 基础信息卡片 */}
          <View className="bg-card rounded-[28rpx] shadow-card overflow-hidden">
            <View className="px-[32rpx] py-[24rpx] border-b border-border/60">
              <Text className="text-[30rpx] font-bold text-foreground">门店信息</Text>
            </View>

            <FormInput
              className="px-[32rpx] py-[24rpx]"
              label="门店名称"
              required
              placeholder="请输入门店名称"
              value={form.name}
              onInput={(e) => updateForm('name', e.detail.value || '')}
              error={errors.name}
            />

            {/* 门店类型 */}
            <View className="px-[32rpx] py-[24rpx]">
              <View className="flex items-center gap-[4rpx] mb-[16rpx]">
                <Text className="text-sm text-muted-foreground font-medium">门店类型</Text>
                <Text className="text-base text-destructive">*</Text>
              </View>
              <View className="flex flex-wrap gap-[16rpx]">
                {VENUE_TYPE_OPTIONS.map((item) => {
                  const active = form.type === item;
                  return (
                    <View
                      key={item}
                      className={cn('chip', active ? 'chip-active' : 'chip-inactive')}
                      onClick={() => updateForm('type', item)}
                    >
                      <Text>{item}</Text>
                    </View>
                  );
                })}
              </View>
              {errors.type && (
                <View className="flex flex-row items-center gap-1 mt-[12rpx]">
                  <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                    <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
                  </View>
                  <Text className="text-xs text-destructive">{errors.type}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 地址信息卡片 */}
          <View className="bg-card rounded-[28rpx] shadow-card overflow-hidden">
            <View className="px-[32rpx] py-[24rpx] border-b border-border/60">
              <Text className="text-[30rpx] font-bold text-foreground">地址信息</Text>
            </View>

            <FieldRow
              label="所在地区"
              required
              right={
                <Picker
                  mode="region"
                  value={
                    form.region.length >= 3
                      ? [form.region[0], form.region[1], form.region[2]]
                      : undefined
                  }
                  onChange={(e) => {
                    const value = (e.detail.value || []) as string[];
                    updateForm('region', value.filter(Boolean));
                  }}
                >
                  <View className="flex items-center justify-end gap-[8rpx]">
                    <SelectValue value={regionText} placeholder="请选择省市区" />
                    <RowArrow />
                  </View>
                </Picker>
              }
            />
            {errors.region && (
              <View className="px-[32rpx] pb-[16rpx]">
                <View className="flex flex-row items-center gap-1">
                  <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                    <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
                  </View>
                  <Text className="text-xs text-destructive">{errors.region}</Text>
                </View>
              </View>
            )}

            <FormInput
              className="px-[32rpx] py-[24rpx]"
              label="详细地址"
              required
              placeholder="请输入街道、门牌号等"
              value={form.address}
              onInput={(e) => updateForm('address', e.detail.value || '')}
              error={errors.address}
              multiline
              minHeight="100rpx"
            />

            <FieldRow
              label="地图定位"
              right={
                <View className="flex items-center justify-end gap-[8rpx] overflow-hidden">
                  <Icon name="mdi-map-marker-outline" size={28} color="primary" />
                  <Text
                    className={cn(
                      'text-[30rpx] truncate',
                      form.locationName ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {form.locationName || '点击定位'}
                  </Text>
                  <RowArrow />
                </View>
              }
              onClick={handleChooseLocation}
            />
          </View>

          {/* 协议同意 */}
          <View
            className="flex items-start gap-[12rpx] px-[8rpx]"
            onClick={() => updateForm('agreed', !form.agreed)}
          >
            <View
              className={cn(
                'w-[40rpx] h-[40rpx] rounded-[8rpx] border-[2rpx] center flex-shrink-0 mt-[2rpx]',
                form.agreed ? 'bg-primary border-primary' : 'bg-background border-border',
              )}
            >
              {form.agreed && <Icon name="mdi-check" size={24} color="white" />}
            </View>
            <Text className="text-[26rpx] text-muted-foreground leading-relaxed flex-1">
              我已阅读并同意
              <Text className="text-primary font-medium">《门店入驻协议》</Text>
              ，确认提交的信息真实有效。
            </Text>
          </View>
          {errors.agreed && (
            <View className="px-[8rpx] -mt-[16rpx]">
              <Text className="text-xs text-destructive">{errors.agreed}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 底部悬浮提交按钮 */}
      <View className="fixed left-0 right-0 bottom-0 px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] pt-[16rpx] bg-gradient-to-t from-background via-background to-transparent z-50">
        <View
          className={cn(
            'h-[92rpx] rounded-[28rpx] center shadow-lg press-scale',
            submitting ? 'bg-muted' : 'bg-gradient-primary',
          )}
          onClick={submitting ? undefined : handleSubmit}
        >
          <Text className="text-[32rpx] font-bold text-white">
            {submitting ? '提交中...' : '申请入驻'}
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(StoreEntry);
