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
import TagEditSheet from './TagEditSheet';

/** 校区类型展示文本 */
const CAMPUS_TYPE_TEXT: Record<CampusType, string> = {
  self: '自营校区',
  partner: '合作机构',
};

/** 门店标签数量上限 */
const MAX_TAG_COUNT = 4;
/** 单个门店标签字数上限 */
const MAX_TAG_LENGTH = 5;

/** 教培机构营销类门店标签 */
const COMMON_CAMPUS_TAGS = ['免费试听', '暑期特惠', '报名立减', '新店开业', '十周年店庆'];

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
  tags: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  logo: undefined,
  licenseName: '',
  contactName: '',
  type: 'self',
  isMain: false,
  partnerMode: undefined,
  phone: '',
  region: '',
  address: '',
  businessHours: '',
  intro: '',
  businessCategories: [],
  venueImages: [],
  tags: [],
};

const CampusSettings: React.FC = () => {
  const { campuses, currentCampusId, fetchCampuses, loading, error } = useCampusStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [customTag, setCustomTag] = useState('');
  /** 已创建的自定义标签（即使取消选中也保留在列表中，便于重新选中 / 修改 / 删除） */
  const [customTags, setCustomTags] = useState<string[]>([]);
  /** 标签重命名弹窗状态 */
  const [showEditSheet, setShowEditSheet] = useState(false);
  /** 当前正在重命名的标签 */
  const [editingTag, setEditingTag] = useState('');
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
        tags: currentCampus.tags || [],
      });
      // 自定义标签来自已保存标签中、不属于通用标签的部分，始终保留在列表中
      setCustomTags(
        (currentCampus.tags || []).filter((t) => !!t && !COMMON_CAMPUS_TAGS.includes(t)),
      );
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

  /** 切换门店标签选中状态（仅影响选中集合，不删除标签本身） */
  const handleToggleTag = useCallback((tag: string) => {
    setForm((prev) => {
      const exists = prev.tags.includes(tag);
      if (exists) {
        return { ...prev, tags: prev.tags.filter((t) => t !== tag) };
      }
      if (prev.tags.length >= MAX_TAG_COUNT) {
        Taro.showToast({ title: `最多选择${MAX_TAG_COUNT}个标签`, icon: 'none' });
        return prev;
      }
      return { ...prev, tags: [...prev.tags, tag] };
    });
  }, []);

  /** 全部可选标签 = 通用标签 + 自定义标签（自定义去重，始终展示在列表中） */
  const allTags = useMemo(() => {
    const custom = customTags.filter((t) => !COMMON_CAMPUS_TAGS.includes(t));
    return [...COMMON_CAMPUS_TAGS, ...custom];
  }, [customTags]);

  /** 添加自定义门店标签（添加后默认选中） */
  const handleAddCustomTag = useCallback(() => {
    const trimmed = customTag.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_TAG_LENGTH) {
      Taro.showToast({ title: `标签最多${MAX_TAG_LENGTH}个字`, icon: 'none' });
      return;
    }
    if (allTags.includes(trimmed)) {
      Taro.showToast({ title: '标签已存在', icon: 'none' });
      return;
    }
    if (form.tags.length >= MAX_TAG_COUNT) {
      Taro.showToast({ title: `最多选择${MAX_TAG_COUNT}个标签`, icon: 'none' });
      return;
    }
    // 同时写入自定义标签池（持久保留）与选中集合（默认选中）
    setCustomTags((prev) => [...prev, trimmed]);
    setForm((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
    setCustomTag('');
  }, [customTag, allTags, form.tags.length]);

  /** 删除自定义标签（从标签池与选中集合中一并移除） */
  const handleDeleteCustomTag = useCallback((tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
    Taro.showToast({ title: '已删除', icon: 'none' });
  }, []);

  /** 重命名自定义标签（同步更新标签池与选中集合） */
  const handleRenameCustomTag = useCallback((oldTag: string, newTag: string) => {
    setCustomTags((prev) => prev.map((t) => (t === oldTag ? newTag : t)));
    setForm((prev) => ({ ...prev, tags: prev.tags.map((t) => (t === oldTag ? newTag : t)) }));
    setShowEditSheet(false);
    setEditingTag('');
  }, []);

  /** 长按自定义标签：提供修改 / 删除操作 */
  const handleTagLongPress = useCallback(
    (tag: string) => {
      Taro.showActionSheet({
        itemList: ['修改标签', '删除标签'],
        success: (res) => {
          if (res.tapIndex === 0) {
            setEditingTag(tag);
            setShowEditSheet(true);
          } else if (res.tapIndex === 1) {
            Taro.showModal({
              title: '删除标签',
              content: `确定删除「${tag}」吗？`,
              confirmColor: '#EB5757',
              success: (modalRes) => {
                if (modalRes.confirm) handleDeleteCustomTag(tag);
              },
            });
          }
        },
      });
    },
    [handleDeleteCustomTag],
  );

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
      tags: currentCampus.tags || [],
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
        tags: form.tags,
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

        {/* 门店标签 */}
        <View className="bg-white rounded-[32rpx] p-[32rpx] mb-[24rpx]">
          <View className="flex flex-row items-center justify-between mb-[16rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">门店标签</Text>
            <Text className="text-[24rpx] text-muted-foreground">
              {form.tags.length}/{MAX_TAG_COUNT}
            </Text>
          </View>

          {/* 自定义标签输入与添加按钮合并在同一圆角框内 */}
          <View className="flex flex-row items-center bg-primary-5 border-[3rpx] border-border-light rounded-2xl px-[28rpx] py-[12rpx] mb-[12rpx]">
            <FormInput
              variant="ghost"
              placeholder="自定义标签（最多5个字）"
              value={customTag}
              onInput={(e) => setCustomTag(e.detail.value)}
              maxlength={MAX_TAG_LENGTH}
              inputStyle={{ textAlign: 'left' }}
              className="!mb-0 flex-1"
            />
            <View
              className={cn(
                'shrink-0 ml-[16rpx] px-[28rpx] py-[12rpx] rounded-full flex items-center justify-center',
                customTag.trim() ? 'bg-primary press-scale' : 'bg-muted',
              )}
              onClick={customTag.trim() ? handleAddCustomTag : undefined}
            >
              <Text
                className={cn(
                  'text-[26rpx] font-medium leading-none',
                  customTag.trim() ? 'text-white' : 'text-muted-foreground',
                )}
              >
                添加
              </Text>
            </View>
          </View>
          <Text className="text-[22rpx] text-muted-foreground mb-[20rpx]">
            点击标签切换选中 / 取消，长按自定义标签可删除或修改
          </Text>

          {/* 标签池：通用标签 + 自定义标签统一展示，选中高亮，未选中灰色，长按自定义标签可操作 */}
          <View className="flex flex-row flex-wrap gap-[16rpx]">
            {allTags.map((tag) => {
              const active = form.tags.includes(tag);
              const isCustom = !COMMON_CAMPUS_TAGS.includes(tag);
              return (
                <View
                  key={tag}
                  className={cn(
                    'press-scale flex flex-row items-center px-[20rpx] py-[10rpx] rounded-full',
                    active ? 'chip-active' : 'chip-inactive',
                  )}
                  onClick={() => handleToggleTag(tag)}
                  onLongPress={isCustom ? () => handleTagLongPress(tag) : undefined}
                >
                  <Text
                    className={cn(
                      'text-[26rpx]',
                      active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground',
                    )}
                  >
                    {tag}
                  </Text>
                </View>
              );
            })}
          </View>
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
            Logo 建议 200×200px · 场馆图建议 750×420px · 单张不超过 5M
          </Text>
          <View className="flex flex-row flex-wrap gap-[20rpx]">
            <ImageUploader
              value={form.logo}
              placeholder="logo"
              maxSizeMB={5}
              onChange={(value) => updateField('logo', value)}
            />
            {form.venueImages.map((url, index) => (
              <ImageUploader
                key={`${url}-${index}`}
                value={url}
                placeholder="场馆图片"
                maxSizeMB={5}
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
                maxSizeMB={5}
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

      {/* 自定义标签重命名弹窗 */}
      <TagEditSheet
        visible={showEditSheet}
        value={editingTag}
        otherTags={allTags.filter((t) => t !== editingTag)}
        maxLength={MAX_TAG_LENGTH}
        onClose={() => {
          setShowEditSheet(false);
          setEditingTag('');
        }}
        onConfirm={(newName) => handleRenameCustomTag(editingTag, newName)}
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
