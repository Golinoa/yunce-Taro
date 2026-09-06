/**
 * 门店入驻申请页 pages/store-entry/index
 *
 * 由品牌介绍页「申请门店入驻」进入，收集场馆入驻信息。
 * 产品：未登录可预览/填表；提交时必须登录（草稿回跳）；绑邮箱为软要求（可「下次再说」）；
 * 提交后须运营审核，无免审。获批后申请人 = 管理员（OWNER）；同机构可有多校区。
 */
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BindEmailSheet from '@/components/BindEmailSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import PickerSheet from '@/components/PickerSheet';
import TimeRangePicker from '@/components/TimeRangePicker';
import { BRAND_NAME_ZH } from '@/constants/brand';
import { STORE_ENTRY_IDENTITY_COPY } from '@/constants/store-entry-copy';
import { auditLogService } from '@/services/audit-log';
import { refreshSessionForTenant } from '@/services/auth';
import {
  readStoreEntryDraft,
  saveStoreEntryDraft,
  storeEntryService,
} from '@/services/store-entry';
import { useCampusStore } from '@/stores/campus';
import type { StoreType } from '@/types/store-entry';
import { useAuth } from '@/utils/auth';
import { clearIdentitySelectionPending } from '@/utils/auth-onboarding';
import { consumePendingStoreReferralCode } from '@/utils/invite-store-referral-link';
import { ensureUserLocationAuthorized } from '@/utils/location-authorize';
import { logError } from '@/utils/logger';
import { ensurePrivacyAuthorized } from '@/utils/privacy-authorize';
import { ApiError } from '@/utils/request';
import { LOGIN_REDIRECT_KEY, withRouteGuard } from '@/utils/route-guard';
import {
  invalidateStoreEntryLatestCache,
  resolveStoreEntryFormGate,
  resolveStoreEntrySubmitError,
  STORE_ENTRY_PENDING_PATH,
  writeStoreEntryLatestCache,
} from '@/utils/store-entry-onboarding';
import { normalizeStoreEntryStatus } from '@/utils/store-entry-status';
import {
  applyStoreEntryDraftToForm,
  resolveStoreEntrySubmitGate,
} from '@/utils/store-entry-submit';

const LOGIN_PAGE = '/package-auth/pages/login/index';
const STORE_ENTRY_PATH = '/package-settings/pages/store-entry/index';

/** 门店类型选项 */
const VENUE_TYPE_OPTIONS = ['总店', '分店'];

interface FormState {
  name: string;
  type: StoreType | '';
  region: string[];
  address: string;
  locationName: string;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
  businessHours: string;
  agreed: boolean;
}

interface FormErrors {
  name?: string;
  type?: string;
  region?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  businessHours?: string;
  agreed?: string;
}

interface ParsedAddress {
  province: string;
  city: string;
  district: string;
  detail: string;
}

/**
 * 从中文完整地址中解析省、市、区、详细地址
 *
 * 支持普通省份与直辖市，无法解析时返回 null。
 */
function parseChineseAddress(address: string): ParsedAddress | null {
  if (!address) return null;

  // 直辖市：北京市/上海市/天津市/重庆市（详细地址可为空）
  const municipalityMatch = address.match(
    /^(北京市|天津市|上海市|重庆市)(.+?(?:区|县|旗))(?:\\s*)(.*)$/,
  );
  if (municipalityMatch) {
    return {
      province: municipalityMatch[1],
      city: municipalityMatch[1],
      district: municipalityMatch[2],
      detail: municipalityMatch[3] || '',
    };
  }

  // 标准：河南省洛阳市栾川县...（详细地址可为空）
  const match = address.match(
    /^(.+?(?:省|自治区))(.+?(?:市|地区|自治州|盟))(.+?(?:区|县|旗))(?:\\s*)(.*)$/,
  );
  if (match) {
    return {
      province: match[1],
      city: match[2],
      district: match[3],
      detail: match[4] || '',
    };
  }

  // 降级：兼容缺少「省」后缀的情况，如「河南洛阳栾川县...」
  const fallbackMatch = address.match(
    /^(.+?)(?:省)?(.+?(?:市|地区|自治州|盟))(.+?(?:区|县|旗))(?:\\s*)(.*)$/,
  );
  if (fallbackMatch) {
    const province = fallbackMatch[1].endsWith('省') ? fallbackMatch[1] : `${fallbackMatch[1]}省`;
    return {
      province,
      city: fallbackMatch[2],
      district: fallbackMatch[3],
      detail: fallbackMatch[4] || '',
    };
  }

  return null;
}

/** 选择框占位/显示文本 */
function SelectValue({ value, placeholder }: { value?: string; placeholder: string }) {
  return (
    <Text
      className={cn('text-[32rpx] truncate', value ? 'text-foreground' : 'text-muted-foreground')}
    >
      {value || placeholder}
    </Text>
  );
}

/** 表单选择行：标签在上，下方为点击区域（带边框背景） */
function FormSelect({
  label,
  required,
  placeholder,
  value,
  error,
  children,
  onClick,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  value?: string;
  error?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <View className="mb-[28rpx]">
      <View className="flex flex-row items-center gap-1 mb-[12rpx]">
        <Text className="text-sm text-muted-foreground font-medium">{label}</Text>
        {required && <Text className="text-base text-destructive">*</Text>}
      </View>
      <View
        className={cn(
          'w-full flex flex-row items-center justify-between py-[22rpx] px-[28rpx] rounded-2xl bg-primary-5 border-[3rpx] border-border-light',
          error && 'border-destructive',
          onClick && 'press-scale',
        )}
        onClick={onClick}
      >
        {children || <SelectValue value={value} placeholder={placeholder} />}
        <Icon name="mdi-chevron-down" size={24} color="mutedForeground" />
      </View>
      {error && (
        <View className="flex flex-row items-center gap-1 mt-[8rpx]">
          <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
            <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
          </View>
          <Text className="text-xs text-destructive">{error}</Text>
        </View>
      )}
    </View>
  );
}

const StoreEntry: React.FC = () => {
  const { profile, bindAccountEmail, sendBindEmailCode, refreshProfile } = useAuth();
  const [form, setForm] = useState<FormState>({
    name: '',
    type: '总店',
    region: [],
    address: '',
    locationName: '',
    latitude: 0,
    longitude: 0,
    contactName: '',
    contactPhone: '',
    businessHours: '09:00:00至21:00:00',
    agreed: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [hoursPickerVisible, setHoursPickerVisible] = useState(false);
  /** 本会话已点「下次再说」：不再反复软挡邮箱 */
  const [emailPromptSkipped, setEmailPromptSkipped] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [showBindEmail, setShowBindEmail] = useState(false);
  const [bindingEmail, setBindingEmail] = useState(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    const draft = applyStoreEntryDraftToForm(readStoreEntryDraft());
    if (!draft) return;
    setForm((prev) => ({
      ...prev,
      name: draft.name || prev.name,
      type: (draft.type as StoreType) || prev.type,
      region: draft.region || prev.region,
      address: draft.address || prev.address,
      locationName: draft.locationName || prev.locationName,
      latitude: draft.latitude ?? prev.latitude,
      longitude: draft.longitude ?? prev.longitude,
      contactName: draft.contactName || prev.contactName,
      contactPhone: draft.contactPhone || prev.contactPhone,
      businessHours: draft.businessHours || prev.businessHours,
    }));
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void (async () => {
      setGateLoading(true);
      try {
        const latest = await storeEntryService.queryLatestSafe();
        if (cancelled) return;
        writeStoreEntryLatestCache(latest, profile.id);
        const gate = resolveStoreEntryFormGate({
          isLoggedIn: true,
          latest,
          loading: false,
        });
        if (gate.kind === 'redirect_pending') {
          void Taro.redirectTo({ url: STORE_ENTRY_PENDING_PATH });
        }
      } catch {
        /* 进页拦截失败不阻断填表 */
      } finally {
        if (!cancelled) setGateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const regionText = useMemo(() => form.region.filter(Boolean).join(' '), [form.region]);

  const updateForm = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    if (!form.contactName.trim()) {
      next.contactName = '请输入负责人称呼';
    }
    if (!form.contactPhone.trim()) {
      next.contactPhone = '请输入负责人手机号';
    } else if (!/^1[3-9]\d{9}$/.test(form.contactPhone.trim())) {
      next.contactPhone = '手机号格式不正确';
    }
    if (!form.businessHours.trim()) {
      next.businessHours = '请选择营业时间';
    } else if (!/^\d{2}:\d{2}:\d{2}至\d{2}:\d{2}:\d{2}$/.test(form.businessHours.trim())) {
      next.businessHours = '营业时间格式不正确';
    }
    if (!form.agreed) {
      next.agreed = '请阅读并同意入驻协议';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const handleChooseLocation = useCallback(async () => {
    try {
      // 1) 隐私指引（未同意时会弹 PrivacyPopup；此前直接 chooseLocation 会静默失败）
      await ensurePrivacyAuthorized();
      // 2) 位置权限（系统授权弹窗 / 引导去设置）
      const locationOk = await ensureUserLocationAuthorized();
      if (!locationOk) {
        Taro.showToast({ title: '需要位置权限才能选地址', icon: 'none' });
        return;
      }

      const res = await Taro.chooseLocation({});
      if (!res) return;
      const locationName = res.name || res.address || '';
      updateForm('locationName', locationName);
      updateForm('address', locationName);
      updateForm('latitude', res.latitude ?? 0);
      updateForm('longitude', res.longitude ?? 0);

      const parsed = parseChineseAddress(res.name) || parseChineseAddress(res.address);
      if (parsed) {
        updateForm('region', [parsed.province, parsed.city, parsed.district]);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String((err as { errMsg?: string })?.errMsg || '');
      if (/cancel|取消/i.test(msg)) return;
      if (/隐私|privacy|disagree|不同意/i.test(msg)) {
        Taro.showToast({ title: '请先同意隐私保护指引', icon: 'none' });
        return;
      }
      if (/auth|authorize|permission|权限|deny/i.test(msg)) {
        Taro.showToast({ title: '需要位置权限才能选地址', icon: 'none' });
        return;
      }
      Taro.showToast({ title: '定位失败，请重试', icon: 'none' });
    }
  }, [updateForm]);

  const handleBindEmail = useCallback(
    async (payload: { email: string; code: string; password: string }) => {
      if (bindingEmail) return;
      setBindingEmail(true);
      try {
        const { error } = await bindAccountEmail(payload.email, payload.code, payload.password);
        if (error) {
          Taro.showToast({ title: error.message || '绑定失败', icon: 'none' });
          return;
        }
        setShowBindEmail(false);
        await refreshProfile();
        Taro.showToast({ title: '邮箱已绑定', icon: 'success' });
      } finally {
        setBindingEmail(false);
      }
    },
    [bindAccountEmail, bindingEmail, refreshProfile],
  );

  const redirectToPendingAfterSubmit = useCallback((storeName: string, status: string) => {
    clearIdentitySelectionPending();
    invalidateStoreEntryLatestCache();
    const encoded = encodeURIComponent(storeName);
    void Taro.redirectTo({
      url: `${STORE_ENTRY_PENDING_PATH}?status=${status}&storeName=${encoded}`,
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitInFlightRef.current || submitting) return;
    if (!validate()) {
      Taro.showToast({ title: '请完善入驻信息', icon: 'none' });
      return;
    }

    if (!form.type) {
      setErrors((prev) => ({ ...prev, type: '请选择门店类型' }));
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      region: form.region.filter(Boolean),
      address: form.address.trim(),
      locationName: form.locationName,
      latitude: form.latitude || undefined,
      longitude: form.longitude || undefined,
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      businessHours: form.businessHours.trim(),
    };

    const gate = resolveStoreEntrySubmitGate({
      isLoggedIn: Boolean(profile?.id),
      profile,
      emailPromptSkipped,
    });

    if (gate.kind === 'login_required') {
      saveStoreEntryDraft(payload);
      try {
        Taro.setStorageSync(LOGIN_REDIRECT_KEY, STORE_ENTRY_PATH);
      } catch {
        /* ignore */
      }
      Taro.showToast({ title: '提交申请需先登录', icon: 'none' });
      void Taro.navigateTo({ url: LOGIN_PAGE });
      return;
    }

    if (gate.kind === 'email_soft_prompt') {
      const modal = await Taro.showModal({
        title: '建议绑定邮箱',
        content: '绑定邮箱便于接收审核结果通知。可「下次再说」直接提交，或先去绑定。',
        confirmText: '下次再说',
        cancelText: '去绑定',
      });
      if (modal.confirm) {
        setEmailPromptSkipped(true);
      } else {
        saveStoreEntryDraft(payload);
        setShowBindEmail(true);
        return;
      }
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      const result = await storeEntryService.submit(payload);

      consumePendingStoreReferralCode();
      saveStoreEntryDraft(payload);
      await refreshSessionForTenant();

      if (result.campusId) {
        await useCampusStore.getState().fetchCampuses();
        const { allowedCampusIds } = useCampusStore.getState();
        if (!allowedCampusIds.includes(result.campusId)) {
          useCampusStore.getState().setAllowedCampusIds([...allowedCampusIds, result.campusId]);
        }
      }

      try {
        await auditLogService.record({
          action: 'store.apply',
          operatorId: profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'store',
          targetId: result.campusId || result.organizationId || '',
          detail: `门店入驻申请：「${form.name.trim()}」（${form.type}）`,
          meta: {
            storeName: form.name.trim(),
            type: form.type,
            status: result.status,
            campusId: result.campusId || undefined,
          },
        });
      } catch (e) {
        logError('audit store.apply', e);
      }
      const statusQuery = normalizeStoreEntryStatus(result.status);
      redirectToPendingAfterSubmit(form.name.trim(), statusQuery);
    } catch (err) {
      const action = resolveStoreEntrySubmitError(err);
      if (action.kind === 'redirect_pending') {
        redirectToPendingAfterSubmit(form.name.trim(), 'pending');
        return;
      }
      Taro.showToast({ title: action.message, icon: 'none' });
      if (err instanceof ApiError) {
        logError('store-entry submit', err);
      }
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }, [validate, form, profile, emailPromptSkipped, submitting, redirectToPendingAfterSubmit]);

  if (gateLoading) {
    return (
      <PageContainer safeBottom className="px-[32rpx] py-[32rpx]">
        <View className="flex items-center justify-center py-[120rpx]">
          <Text className="text-[28rpx] text-muted-foreground">加载中...</Text>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom className="flex flex-col bg-background">
      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        <View className="px-[32rpx] pt-[32rpx] pb-[200rpx] flex flex-col gap-[24rpx]">
          {/* 顶部标题区 */}
          <View className="mb-[8rpx]">
            <Text className="text-[44rpx] font-bold text-foreground leading-tight">
              {STORE_ENTRY_IDENTITY_COPY.formTitle}
            </Text>
            <Text className="text-[28rpx] text-muted-foreground mt-[12rpx] leading-relaxed block">
              {STORE_ENTRY_IDENTITY_COPY.formSubtitle}
            </Text>
          </View>

          {/* 统一表单卡片 */}
          <View className="bg-card rounded-[28rpx] shadow-card p-[32rpx]">
            {/* 门店名称 */}
            <FormInput
              className="mb-0"
              label="门店名称"
              required
              placeholder="请输入门店名称"
              value={form.name}
              onInput={(e) => updateForm('name', e.detail.value || '')}
              error={errors.name}
            />

            {/* 地图定位：默认唯一可见的地址入口 */}
            <View className="mb-[28rpx]">
              <View className="flex flex-row items-center gap-1 mb-[12rpx]">
                <Text className="text-sm text-muted-foreground font-medium">地图定位</Text>
                <Text className="text-base text-destructive">*</Text>
              </View>
              <View
                className={cn(
                  'w-full flex flex-row items-center justify-between py-[22rpx] px-[28rpx] rounded-2xl bg-primary-5 border-[3rpx] border-border-light press-scale',
                  errors.region && 'border-destructive',
                )}
                onClick={handleChooseLocation}
              >
                <View className="flex flex-row items-center gap-[12rpx] overflow-hidden">
                  <Icon name="mdi-map-marker-outline" size={28} color="primary" />
                  <Text
                    className={cn(
                      'text-[32rpx] truncate',
                      form.locationName ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {form.locationName || '选择门店地址'}
                  </Text>
                </View>
                <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
              </View>
              {!form.locationName && (
                <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] ml-[8rpx]">
                  选择定位后将自动填写地址信息
                </Text>
              )}
              {errors.region && !form.locationName && (
                <View className="flex flex-row items-center gap-1 mt-[8rpx]">
                  <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                    <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
                  </View>
                  <Text className="text-xs text-destructive">{errors.region}</Text>
                </View>
              )}
            </View>

            {/* 选择定位后自动展开：省市区 + 详细地址 */}
            {form.locationName && (
              <>
                {/* 地址：省市区 */}
                <View className="mb-[28rpx]">
                  <View className="flex flex-row items-center gap-1 mb-[12rpx]">
                    <Text className="text-sm text-muted-foreground font-medium">地址</Text>
                    <Text className="text-base text-destructive">*</Text>
                  </View>
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
                    <View
                      className={cn(
                        'w-full flex flex-row items-center justify-between py-[22rpx] px-[28rpx] rounded-2xl bg-primary-5 border-[3rpx] border-border-light press-scale',
                        errors.region && 'border-destructive',
                      )}
                    >
                      <SelectValue value={regionText} placeholder="省、市、区" />
                      <Icon name="mdi-chevron-down" size={24} color="mutedForeground" />
                    </View>
                  </Picker>
                  {errors.region && (
                    <View className="flex flex-row items-center gap-1 mt-[8rpx]">
                      <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                        <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
                      </View>
                      <Text className="text-xs text-destructive">{errors.region}</Text>
                    </View>
                  )}
                </View>

                {/* 详细地址 */}
                <FormInput
                  className="mb-0"
                  label="详细地址"
                  required
                  placeholder="填写具体地址即可，省市区无需重复填写"
                  value={form.address}
                  onInput={(e) => updateForm('address', e.detail.value || '')}
                  error={errors.address}
                  multiline
                  minHeight="120rpx"
                />
              </>
            )}

            {/* 门店类型 */}
            <FormSelect
              label="门店类型"
              required
              placeholder="请选择门店类型"
              value={form.type}
              error={errors.type}
              onClick={() => setTypePickerVisible(true)}
            />

            {/* 负责人称呼 */}
            <FormInput
              className="mb-0"
              label="负责人称呼"
              required
              placeholder="请输入负责人称呼"
              value={form.contactName}
              onInput={(e) => updateForm('contactName', e.detail.value || '')}
              error={errors.contactName}
            />

            {/* 负责人手机号 */}
            <FormInput
              className="mb-0"
              label="负责人联系方式"
              required
              placeholder="请输入负责人手机号"
              value={form.contactPhone}
              onInput={(e) => updateForm('contactPhone', e.detail.value || '')}
              error={errors.contactPhone}
              type="number"
              maxlength={11}
            />

            {/* 营业时间 */}
            <FormSelect
              label="营业时间"
              required
              placeholder="请选择营业时间"
              value={
                form.businessHours.replace(/(\d{2}:\d{2}):\d{2}至(\d{2}:\d{2}):\d{2}/, '$1-$2') ||
                ''
              }
              error={errors.businessHours}
              onClick={() => setHoursPickerVisible(true)}
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
              <Text className="text-primary font-medium">
                《{BRAND_NAME_ZH}门店小程序使用协议》
              </Text>
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
            'h-[92rpx] rounded-[24rpx] center shadow-lg press-scale',
            submitting ? 'bg-muted' : 'bg-gradient-primary',
          )}
          onClick={submitting ? undefined : handleSubmit}
        >
          <Text className="text-[32rpx] font-bold text-white">
            {submitting ? '提交中...' : '申请入驻'}
          </Text>
        </View>
      </View>

      {/* 门店类型（PickerSheet 标准组件） */}
      <PickerSheet
        visible={typePickerVisible}
        title="门店类型"
        options={VENUE_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        value={form.type || ''}
        onClose={() => setTypePickerVisible(false)}
        onConfirm={(v) => updateForm('type', v as StoreType | '')}
      />

      <TimeRangePicker
        visible={hoursPickerVisible}
        title="营业时间"
        value={form.businessHours}
        onCancel={() => setHoursPickerVisible(false)}
        onConfirm={(value) => {
          updateForm('businessHours', value);
          setHoursPickerVisible(false);
        }}
      />

      <BindEmailSheet
        visible={showBindEmail}
        submitting={bindingEmail}
        onClose={() => setShowBindEmail(false)}
        onSendCode={sendBindEmailCode}
        onSubmit={handleBindEmail}
      />
    </PageContainer>
  );
};

export default withRouteGuard(StoreEntry);
