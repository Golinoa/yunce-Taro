/**
 * 校区设置页 package-settings/pages/campus-settings/index
 *
 * 以干净表单管理当前校区信息。
 * 支持编辑：门店名称、营业执照名称、联系人、联系方式、所在地区、
 * 详细地址、营业时间、主营业态、门店介绍、场馆图片。
 */
import { View, Text, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BusinessCategoryPicker from '@/components/business/BusinessCategoryPicker';
import Empty from '@/components/Empty';
import FormCell from '@/components/FormCell';
import FormInput from '@/components/FormInput';
import ImageUploader from '@/components/ImageUploader';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PageIntroSheet from '@/components/PageIntroSheet';
import TimeRangePicker from '@/components/TimeRangePicker';
import {
  formatBusinessCategories,
  type SelectedBusinessCategory,
} from '@/constants/business-categories';
import { PAGE_INTRO_STORAGE_KEYS } from '@/services/onboarding';
import { useCampusStore } from '@/stores/campus';
import type { CampusType, PartnerMode } from '@/types/campus';
import { logError } from '@/utils/logger';

/** 校区类型展示文本 */
const CAMPUS_TYPE_TEXT: Record<CampusType, string> = {
  self: '自营校区',
  partner: '合作机构',
};

interface FormState {
  name: string;
  logo?: string;
  licenseName: string;
  contactName: string;
  type: CampusType;
  isMain: boolean;
  partnerMode?: PartnerMode;
  phone: string;
  region: string;
  address: string;
  businessHours: string;
  intro: string;
  businessCategories: SelectedBusinessCategory[];
  venueImages: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  logo: undefined,
  licenseName: '',
  contactName: '',
  type: 'self',
  isMain: false,
  phone: '',
  region: '',
  address: '',
  businessHours: '',
  intro: '',
  businessCategories: [],
  venueImages: [],
};

const CampusSettings: React.FC = () => {
  const { campuses, currentCampusId, fetchCampuses, loading, error } = useCampusStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  /** 标记表单是否已初始化，避免 useEffect 反复覆盖用户输入 */
  const formInitializedRef = React.useRef(false);

  const INTRO_STORAGE_KEY = PAGE_INTRO_STORAGE_KEYS.campus;

  const currentCampus = useMemo(
    () =>
      campuses.find((c) => c.id === currentCampusId) ||
      campuses.find((c) => c.isMain) ||
      campuses[0] ||
      null,
    [campuses, currentCampusId],
  );

  // 首次加载校区数据后回填表单（仅初始化一次，避免覆盖用户编辑）
  useEffect(() => {
    if (currentCampus && !formInitializedRef.current) {
      formInitializedRef.current = true;
      setForm({
        name: currentCampus.name,
        logo: currentCampus.logo,
        licenseName: currentCampus.licenseName || '',
        contactName: currentCampus.contactName || '',
        type: currentCampus.type,
        isMain: currentCampus.isMain,
        partnerMode: currentCampus.partnerMode,
        phone: currentCampus.phone,
        region: currentCampus.region || '',
        address: currentCampus.address,
        businessHours: currentCampus.businessHours || '',
        intro: currentCampus.intro || '',
        businessCategories: currentCampus.businessCategories || [],
        venueImages: currentCampus.venueImages || [],
      });
    }
  }, [currentCampus]);

  const reload = useCallback(async () => {
    await fetchCampuses();
  }, [fetchCampuses]);

  Taro.useDidShow(() => {
    void reload();
    try {
      const hidden = Taro.getStorageSync(INTRO_STORAGE_KEY);
      setShowIntro(hidden !== true);
    } catch {
      setShowIntro(true);
    }
  });

  /** 更新单个字段 */
  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** 表单是否有变更 */
  const hasChanged = useMemo(() => {
    if (!currentCampus) return false;
    const origin: FormState = {
      name: currentCampus.name,
      logo: currentCampus.logo,
      licenseName: currentCampus.licenseName || '',
      contactName: currentCampus.contactName || '',
      type: currentCampus.type,
      isMain: currentCampus.isMain,
      partnerMode: currentCampus.partnerMode,
      phone: currentCampus.phone,
      region: currentCampus.region || '',
      address: currentCampus.address,
      businessHours: currentCampus.businessHours || '',
      intro: currentCampus.intro || '',
      businessCategories: currentCampus.businessCategories || [],
      venueImages: currentCampus.venueImages || [],
    };
    return JSON.stringify(form) !== JSON.stringify(origin);
  }, [form, currentCampus]);

  const handleSave = useCallback(async () => {
    if (!currentCampus || !hasChanged) return;
    if (!form.name.trim()) {
      Taro.showToast({ title: '请输入门店名称', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      await useCampusStore.getState().updateCampus(currentCampus.id, {
        name: form.name.trim(),
        logo: form.logo,
        licenseName: form.licenseName.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        phone: form.phone.trim(),
        region: form.region.trim() || undefined,
        address: form.address.trim(),
        businessHours: form.businessHours.trim() || undefined,
        intro: form.intro.trim() || undefined,
        businessCategories: form.businessCategories,
        venueImages: form.venueImages,
      });
      await reload();
      // 保存成功后重新初始化表单（用最新数据回填）
      formInitializedRef.current = false;
      Taro.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      logError('CampusSettings save', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [currentCampus, form, hasChanged, reload]);

  if (loading && !campuses.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载校区设置中..." />
        </View>
      </PageContainer>
    );
  }

  if (error && !campuses.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={error}
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  if (!currentCampus) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-office-building-outline"
            description="暂无校区信息"
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[24rpx] pb-[180rpx]">
        {/* 基础信息表单 */}
        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[8rpx] mb-[24rpx]">
          <FormCell
            label="门店名称"
            placeholder="请输入"
            value={form.name}
            onChange={(value) => updateField('name', value)}
          />
          <FormCell
            label="营业执照名称"
            placeholder="请输入"
            value={form.licenseName}
            onChange={(value) => updateField('licenseName', value)}
          />
          <FormCell
            label="类型"
            value={form.isMain ? '总店' : CAMPUS_TYPE_TEXT[form.type]}
            editable={false}
          />
          <FormCell
            label="联系人"
            placeholder="请输入"
            value={form.contactName}
            onChange={(value) => updateField('contactName', value)}
          />
          <FormCell
            label="联系方式"
            placeholder="请输入"
            value={form.phone}
            onChange={(value) => updateField('phone', value)}
            type="number"
            divider={false}
          />
        </View>

        {/* 地址信息 */}
        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[8rpx] mb-[24rpx]">
          <Picker
            mode="region"
            value={form.region ? form.region.split('-') : []}
            onChange={(e) => {
              const [province, city, district] = e.detail.value as string[];
              updateField('region', `${province}-${city}-${district}`);
            }}
          >
            <FormCell
              label="所在地区"
              placeholder="请选择"
              value={form.region}
              editable={false}
              showArrow
            />
          </Picker>
          <FormCell
            label="详细地址"
            placeholder="请输入"
            value={form.address}
            onChange={(value) => updateField('address', value)}
          />
          <FormCell
            label="营业时间"
            placeholder="请选择"
            value={form.businessHours}
            editable={false}
            showArrow
            onClick={() => setShowTimePicker(true)}
            divider={false}
          />
        </View>

        {/* 主营业态 */}
        <View className="bg-white rounded-[32rpx] p-[32rpx] mb-[24rpx]">
          <View className="flex flex-row items-center justify-between mb-[16rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">主营业态</Text>
            <Text
              className="text-[28rpx] text-primary font-medium press-bg"
              onClick={() => setIsEditingCategory((prev) => !prev)}
            >
              {isEditingCategory ? '完成' : '修改'}
            </Text>
          </View>
          {!isEditingCategory ? (
            <Text className="text-[28rpx] text-foreground leading-relaxed">
              {formatBusinessCategories(form.businessCategories) || '未设置'}
            </Text>
          ) : (
            <BusinessCategoryPicker
              value={form.businessCategories}
              onChange={(value) => updateField('businessCategories', value)}
            />
          )}
        </View>

        {/* 门店介绍 */}
        <View className="bg-white rounded-[32rpx] p-[32rpx] mb-[24rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground mb-[16rpx]">
            {form.name || currentCampus.name}的介绍
          </Text>
          <FormInput
            label=""
            placeholder="请输入门店介绍"
            value={form.intro}
            onInput={(e) => updateField('intro', e.detail.value)}
            multiline
            minHeight="200rpx"
          />
        </View>

        {/* 门店图片：Logo + 场馆图片 */}
        <View className="bg-white rounded-[32rpx] p-[32rpx]">
          <View className="flex flex-row items-center justify-between mb-[8rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">门店图片</Text>
            <Text className="text-[24rpx] text-muted-foreground">场馆图最多 5 张</Text>
          </View>
          <Text className="text-[22rpx] text-muted-foreground mb-[20rpx]">
            Logo 建议 200×200px · 场馆图建议 750×420px · 单张不超过 2M
          </Text>
          <View className="flex flex-row flex-wrap gap-[20rpx]">
            <ImageUploader
              value={form.logo}
              placeholder="logo"
              maxSizeMB={2}
              onChange={(value) => updateField('logo', value)}
            />
            {form.venueImages.map((url, index) => (
              <ImageUploader
                key={`${url}-${index}`}
                value={url}
                placeholder="场馆图片"
                maxSizeMB={2}
                onChange={(value) => {
                  const next = [...form.venueImages];
                  if (value) {
                    next[index] = value;
                  } else {
                    next.splice(index, 1);
                  }
                  updateField('venueImages', next);
                }}
              />
            ))}
            {form.venueImages.length < 5 && (
              <ImageUploader
                placeholder="场馆图片"
                maxSizeMB={2}
                onChange={(value) => {
                  if (value) {
                    updateField('venueImages', [...form.venueImages, value]);
                  }
                }}
              />
            )}
          </View>
        </View>
      </View>

      {/* 营业时间选择器 */}
      <TimeRangePicker
        visible={showTimePicker}
        value={form.businessHours}
        onConfirm={(value) => {
          updateField('businessHours', value);
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />

      {/* 页面介绍弹窗 */}
      <PageIntroSheet
        visible={showIntro}
        onClose={() => setShowIntro(false)}
        storageKey={INTRO_STORAGE_KEY}
        currentStep={1}
        totalSteps={6}
        title="完善门店信息"
        description="会员在小程序看到的门店首页即此处配置，包含标识、场馆图、联系方式与门店二维码。"
        bulletPoints={[
          'Logo + 至少 1 张场馆图，首页展示更完整',
          '下载门店二维码用于前台/海报/朋友圈',
          '电话与地址用于会员导航咨询',
        ]}
      />

      {/* 底部保存按钮 */}
      <View className="fixed left-0 right-0 bottom-0 bg-white px-[32rpx] pt-[16rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] border-t-[2rpx] border-border">
        <View
          className={cn(
            'rounded-[48rpx] py-[28rpx] flex items-center justify-center',
            hasChanged && !saving ? 'bg-primary press-scale' : 'bg-muted',
          )}
          onClick={hasChanged && !saving ? handleSave : undefined}
        >
          <Text
            className={cn(
              'text-[30rpx] font-semibold',
              hasChanged && !saving ? 'text-white' : 'text-muted-foreground',
            )}
          >
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default CampusSettings;
