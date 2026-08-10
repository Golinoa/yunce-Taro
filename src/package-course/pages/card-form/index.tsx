/**
 * 新增 / 编辑卡种表单页
 *
 * 用于创建或编辑会员卡模板（卡种价目表），支持基础信息和高级设置。
 * 所有字段采用左标签右输入/值的行内布局，与课程管理表单保持一致。
 */
import { ScrollView, View, Text, InputProps } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import CategoryMultiSheet from '@/components/course/CategoryMultiSheet';
import FormInput from '@/components/FormInput';
import HintPopover from '@/components/HintPopover';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import {
  BOOKING_METHOD_OPTIONS,
  CARD_CATEGORY_OPTIONS,
  CARD_SCOPE_OPTIONS,
  CARD_TYPE_OPTIONS,
  CARD_TYPE_TOOLTIPS,
  COMMISSION_OPTIONS,
  WEEKDAY_OPTIONS,
} from '@/data/card-type';
import { cardTypeService } from '@/services/card-type';
import { useCourseCategoryStore } from '@/stores/course-category';
import type {
  CardType,
  CardTypeBookingMethod,
  CardTypeCategory,
  CardTypeFormData,
  CardTypeKind,
  CardTypeScope,
} from '@/types/card-type';
import { withRouteGuard } from '@/utils/route-guard';

/** 表单字段错误 */
interface FormErrors {
  name?: string;
  price?: string;
  count?: string;
  validDays?: string;
}

type PickerType =
  | 'kind'
  | 'bookingMethod'
  | 'cardCategory'
  | 'commissionCalc'
  | 'onlinePurchase'
  | 'studentIdentityLimit'
  | 'isGiftCard'
  | 'allowTransfer';

/** 布尔选择选项 */
const BOOLEAN_OPTIONS: PickerOption[] = [
  { label: '是', value: 'true' },
  { label: '否', value: 'false' },
];

const ALLOW_TRANSFER_OPTIONS: PickerOption[] = [
  { label: '允许', value: 'true' },
  { label: '不允许', value: 'false' },
];

/** 解析金额输入（分） */
const parsePrice = (value: string): number => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
};

/**
 * 生成不重复的副本名称
 * - 原名称：美术素描年卡
 * - 第一次复制：美术素描年卡-副本
 * - 已存在副本时：美术素描年卡-副本2、美术素描年卡-副本3 ...
 */
const generateUniqueCopyName = (baseName: string, existingNames: string[]): string => {
  const prefix = `${baseName}-副本`;
  const regex = new RegExp(`^${prefix}(\\d*)$`);
  let maxSuffix = 0;
  existingNames.forEach((name) => {
    const match = name.match(regex);
    if (match) {
      const num = match[1] ? parseInt(match[1], 10) : 1;
      maxSuffix = Math.max(maxSuffix, num);
    }
  });
  return maxSuffix === 0 ? prefix : `${prefix}${maxSuffix + 1}`;
};

const CardFormPage: React.FC = () => {
  const instance = Taro.getCurrentInstance();
  const cardId = decodeURIComponent(instance?.router?.params?.id || '');
  const copyFromId = decodeURIComponent(instance?.router?.params?.copyFromId || '');
  const isEdit = !!cardId;
  const isCopy = !isEdit && !!copyFromId;

  const { categories, fetchList: fetchCategories } = useCourseCategoryStore();

  // 加载状态
  const [loading, setLoading] = useState(isEdit || isCopy);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // 基础字段
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CardTypeKind>('count');
  const [scopes, setScopes] = useState<CardTypeScope[]>(['course']);
  const [bookingMethod, setBookingMethod] = useState<CardTypeBookingMethod>('course');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [count, setCount] = useState('');
  const [validDays, setValidDays] = useState('365');
  const [price, setPrice] = useState('');
  const [freezeCount, setFreezeCount] = useState('0');
  const [freezeDays, setFreezeDays] = useState('0');

  // 高级设置展开
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 高级字段
  const [benefits, setBenefits] = useState('');
  const [cardCategory, setCardCategory] = useState<CardTypeCategory>('formal');
  const [renewalPrice, setRenewalPrice] = useState('');
  const [dailyMaxBookings, setDailyMaxBookings] = useState('0');
  const [weeklyMaxBookings, setWeeklyMaxBookings] = useState('0');
  const [monthlyMaxBookings, setMonthlyMaxBookings] = useState('0');
  const [freeCancelCount, setFreeCancelCount] = useState('0');
  const [advanceBookingMinutes, setAdvanceBookingMinutes] = useState('0');
  const [allWeekAvailable, setAllWeekAvailable] = useState(true);
  const [availableWeekdays, setAvailableWeekdays] = useState<number[]>([]);
  const [onlinePurchase, setOnlinePurchase] = useState(true);
  const [studentIdentityLimit, setStudentIdentityLimit] = useState(false);
  const [isGiftCard, setIsGiftCard] = useState(false);
  const [allowTransfer, setAllowTransfer] = useState(false);
  const [usageLimit, setUsageLimit] = useState('0');
  const [commissionCalc, setCommissionCalc] = useState('salary');

  // 选择器弹窗
  const [picker, setPicker] = useState<{ visible: boolean; type: PickerType }>({
    visible: false,
    type: 'kind',
  });

  // 分类多选弹窗
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);

  // 回填表单数据
  const fillForm = useCallback((data: CardType) => {
    setName(data.name);
    setKind(data.kind);
    setScopes(data.scopes);
    setBookingMethod(data.bookingMethod);
    setCategoryIds(data.categoryIds ?? []);
    setCount(data.count ? String(data.count) : '');
    setValidDays(String(data.validDays));
    setPrice(data.price ? (data.price / 100).toFixed(2) : '');
    setFreezeCount(String(data.freezeCount));
    setFreezeDays(String(data.freezeDays));
    setBenefits(data.benefits || '');
    setCardCategory(data.cardCategory);
    setRenewalPrice(data.renewalPrice ? (data.renewalPrice / 100).toFixed(2) : '');
    setDailyMaxBookings(String(data.dailyMaxBookings));
    setWeeklyMaxBookings(String(data.weeklyMaxBookings));
    setMonthlyMaxBookings(String(data.monthlyMaxBookings));
    setFreeCancelCount(String(data.freeCancelCount));
    setAdvanceBookingMinutes(String(data.advanceBookingMinutes));
    setAllWeekAvailable(data.availableWeekdays.length === 0);
    setAvailableWeekdays(data.availableWeekdays);
    setOnlinePurchase(data.onlinePurchase);
    setStudentIdentityLimit(data.studentIdentityLimit);
    setIsGiftCard(data.isGiftCard);
    setAllowTransfer(data.allowTransfer);
    setUsageLimit(String(data.usageLimit));
    setCommissionCalc(data.commissionCalc);
  }, []);

  // 加载课程分类（用于「适用课程范围」多选）
  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  // 加载编辑/复制数据
  useEffect(() => {
    if (!isEdit && !isCopy) {
      setLoading(false);
      return;
    }
    Taro.setNavigationBarTitle({ title: isEdit ? '修改会员卡' : '新增会员卡' });
    setLoading(true);
    const sourceId = isEdit ? cardId : copyFromId;
    cardTypeService
      .getById(sourceId)
      .then(async (data) => {
        if (!data) return;
        fillForm(data);
        if (isCopy) {
          const list = await cardTypeService.getList();
          const existingNames = list.map((item) => item.name);
          setName(generateUniqueCopyName(data.name, existingNames));
        }
      })
      .finally(() => setLoading(false));
  }, [cardId, copyFromId, isEdit, isCopy, fillForm]);

  // 选择器配置
  const pickerConfig = useMemo(() => {
    switch (picker.type) {
      case 'kind':
        return {
          title: '会员卡类型',
          options: CARD_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
          value: kind,
          onConfirm: (value: string) => setKind(value as CardTypeKind),
        };
      case 'bookingMethod':
        return {
          title: '约课方式',
          options: BOOKING_METHOD_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
          value: bookingMethod,
          onConfirm: (value: string) => setBookingMethod(value as CardTypeBookingMethod),
        };
      case 'cardCategory':
        return {
          title: '会员卡种类',
          options: CARD_CATEGORY_OPTIONS,
          value: cardCategory,
          onConfirm: (value: string) => setCardCategory(value as CardTypeCategory),
        };
      case 'commissionCalc':
        return {
          title: '提成计算',
          options: COMMISSION_OPTIONS,
          value: commissionCalc,
          onConfirm: (value: string) => setCommissionCalc(value),
        };
      case 'onlinePurchase':
        return {
          title: '线上购买',
          options: BOOLEAN_OPTIONS,
          value: String(onlinePurchase),
          onConfirm: (value: string) => setOnlinePurchase(value === 'true'),
        };
      case 'studentIdentityLimit':
        return {
          title: '学生身份购买限制',
          options: BOOLEAN_OPTIONS,
          value: String(studentIdentityLimit),
          onConfirm: (value: string) => setStudentIdentityLimit(value === 'true'),
        };
      case 'isGiftCard':
        return {
          title: '是否赠卡',
          options: BOOLEAN_OPTIONS,
          value: String(isGiftCard),
          onConfirm: (value: string) => setIsGiftCard(value === 'true'),
        };
      case 'allowTransfer':
        return {
          title: '允许转卡',
          options: ALLOW_TRANSFER_OPTIONS,
          value: String(allowTransfer),
          onConfirm: (value: string) => setAllowTransfer(value === 'true'),
        };
      default:
        return { title: '', options: [], value: '', onConfirm: () => {} };
    }
  }, [
    picker.type,
    kind,
    bookingMethod,
    cardCategory,
    commissionCalc,
    onlinePurchase,
    studentIdentityLimit,
    isGiftCard,
    allowTransfer,
  ]);

  const openPicker = useCallback((type: PickerType) => {
    setPicker({ visible: true, type });
  }, []);

  const closePicker = useCallback(() => {
    setPicker((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggleWeekday = useCallback((value: number) => {
    setAvailableWeekdays((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort(),
    );
  }, []);

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {};
    if (!name.trim()) {
      nextErrors.name = '请输入会员卡名称';
    }
    const priceNum = parseFloat(price);
    if (!price || Number.isNaN(priceNum) || priceNum < 0) {
      nextErrors.price = '请输入正确的售价';
    }
    if (kind === 'count') {
      const countNum = Number(count);
      if (!count || Number.isNaN(countNum) || countNum <= 0) {
        nextErrors.count = '请输入正确的次数';
      }
    }
    const validDaysNum = Number(validDays);
    if (Number.isNaN(validDaysNum) || validDaysNum < 0) {
      nextErrors.validDays = '请输入正确的有效期限';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [name, kind, count, validDays, price]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }
    setSaving(true);

    const formData: CardTypeFormData = {
      name: name.trim(),
      kind,
      status: 'active',
      scopes,
      bookingMethod: scopes.includes('course') ? bookingMethod : 'none',
      categoryIds: scopes.includes('course') ? categoryIds : [],
      applicableCourseRange:
        categoryIds.length === 0
          ? '全部课程'
          : categories
              .filter((cat) => categoryIds.includes(cat.id))
              .map((cat) => cat.name)
              .join(' / '),
      count: kind === 'count' ? Number(count) || 0 : undefined,
      validDays: Number(validDays) || 0,
      price: parsePrice(price),
      freezeCount: Number(freezeCount) || 0,
      freezeDays: Number(freezeDays) || 0,
      benefits: benefits.trim() || undefined,
      cardCategory,
      renewalPrice: renewalPrice ? parsePrice(renewalPrice) : undefined,
      dailyMaxBookings: Number(dailyMaxBookings) || 0,
      weeklyMaxBookings: Number(weeklyMaxBookings) || 0,
      monthlyMaxBookings: Number(monthlyMaxBookings) || 0,
      freeCancelCount: Number(freeCancelCount) || 0,
      advanceBookingMinutes: Number(advanceBookingMinutes) || 0,
      availableWeekdays: allWeekAvailable ? [] : availableWeekdays,
      onlinePurchase,
      studentIdentityLimit,
      isGiftCard,
      allowTransfer,
      usageLimit: Number(usageLimit) || 0,
      commissionCalc,
    };

    try {
      if (isEdit) {
        await cardTypeService.update(cardId, formData);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await cardTypeService.create(formData);
        Taro.showToast({ title: isCopy ? '复制成功' : '新增成功', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({
        title: isEdit ? '保存失败' : isCopy ? '复制失败' : '新增失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    isEdit,
    isCopy,
    cardId,
    name,
    kind,
    scopes,
    bookingMethod,
    categoryIds,
    categories,
    count,
    validDays,
    price,
    freezeCount,
    freezeDays,
    benefits,
    cardCategory,
    renewalPrice,
    dailyMaxBookings,
    weeklyMaxBookings,
    monthlyMaxBookings,
    freeCancelCount,
    advanceBookingMinutes,
    allWeekAvailable,
    availableWeekdays,
    onlinePurchase,
    studentIdentityLimit,
    isGiftCard,
    allowTransfer,
    usageLimit,
    commissionCalc,
  ]);

  const handleDelete = useCallback(async () => {
    const { confirm } = await Taro.showModal({
      title: '确认删除',
      content: `删除后「${name}」将不可恢复，是否确认删除？`,
      confirmColor: '#EF4444',
    });
    if (!confirm) return;
    setDeleting(true);
    try {
      await cardTypeService.remove(cardId);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [cardId, name]);

  if (loading) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载会员卡信息中..." />
        </View>
      </PageContainer>
    );
  }

  const selectedKindLabel = CARD_TYPE_OPTIONS.find((o) => o.value === kind)?.label;
  const selectedBookingMethodLabel = BOOKING_METHOD_OPTIONS.find(
    (o) => o.value === bookingMethod,
  )?.label;
  const selectedCardCategoryLabel = CARD_CATEGORY_OPTIONS.find(
    (o) => o.value === cardCategory,
  )?.label;
  const selectedCommissionLabel = COMMISSION_OPTIONS.find((o) => o.value === commissionCalc)?.label;

  return (
    <PageContainer safeBottom>
      <ScrollView
        scrollY
        enhanced
        scrollWithAnimation
        className="h-screen"
        style={{ paddingBottom: 'calc(220rpx + env(safe-area-inset-bottom))' }}
      >
        <View className="px-[32rpx] py-[24rpx] flex flex-col gap-[24rpx]">
          {/* 基础信息卡片 */}
          <Card className="p-[32rpx]">
            <FormRow
              label="会员卡名称"
              hint={CARD_TYPE_TOOLTIPS.name}
              required
              editable
              placeholder="请输入会员卡名称"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              error={errors.name}
            />

            <FormRow
              label="会员卡类型"
              hint={CARD_TYPE_TOOLTIPS.kind}
              required
              onClick={() => openPicker('kind')}
            >
              <Text className="text-[30rpx] text-foreground">{selectedKindLabel}</Text>
            </FormRow>

            <FormRow label="可用范围" hint={CARD_TYPE_TOOLTIPS.scope}>
              <View className="flex flex-row gap-[16rpx]">
                {CARD_SCOPE_OPTIONS.map((option) => {
                  const isActive = scopes.includes(option.value);
                  return (
                    <View
                      key={option.value}
                      className={cn(
                        'py-[10rpx] px-[28rpx] rounded-[24rpx] text-[26rpx] font-medium press-scale',
                        isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                      )}
                      onClick={() =>
                        setScopes((prev) =>
                          prev.includes(option.value)
                            ? prev.filter((v) => v !== option.value)
                            : [...prev, option.value],
                        )
                      }
                    >
                      <Text className={cn(isActive ? 'text-white' : 'text-muted-foreground')}>
                        {option.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </FormRow>

            {scopes.includes('course') && (
              <>
                <FormRow
                  label="约课方式"
                  hint={CARD_TYPE_TOOLTIPS.bookingMethod}
                  onClick={() => openPicker('bookingMethod')}
                >
                  <Text className="text-[30rpx] text-foreground">{selectedBookingMethodLabel}</Text>
                </FormRow>

                <FormRow
                  label="适用课程范围"
                  hint={CARD_TYPE_TOOLTIPS.applicableCourseRange}
                  onClick={() => setCategorySheetVisible(true)}
                >
                  <Text className="text-[30rpx] text-foreground">
                    {categoryIds.length === 0
                      ? '全部课程'
                      : categories
                          .filter((cat) => categoryIds.includes(cat.id))
                          .map((cat) => cat.name)
                          .join(' / ') || '请选择分类'}
                  </Text>
                </FormRow>
              </>
            )}

            {kind === 'count' && (
              <FormRow
                label="次数（次）"
                hint={CARD_TYPE_TOOLTIPS.count}
                required
                editable
                placeholder="请输入次数"
                value={count}
                onInput={(e) => setCount(e.detail.value)}
                inputType="number"
                error={errors.count}
              />
            )}

            <FormRow
              label="会员卡期限"
              hint={CARD_TYPE_TOOLTIPS.validDays}
              required
              editable
              placeholder="0=永久有效"
              value={validDays}
              onInput={(e) => setValidDays(e.detail.value)}
              inputType="number"
              suffix="天"
              error={errors.validDays}
            />

            <FormRow
              label="售价（元）"
              hint={CARD_TYPE_TOOLTIPS.price}
              required
              editable
              placeholder="0.00"
              value={price}
              onInput={(e) => setPrice(e.detail.value)}
              inputType="digit"
              error={errors.price}
            />

            <FormRow
              label="可冻卡总次数（次）"
              hint={CARD_TYPE_TOOLTIPS.freezeCount}
              editable
              placeholder="0"
              value={freezeCount}
              onInput={(e) => setFreezeCount(e.detail.value)}
              inputType="number"
            />

            <FormRow
              label="可冻卡总天数（天）"
              hint={CARD_TYPE_TOOLTIPS.freezeDays}
              editable
              placeholder="0"
              value={freezeDays}
              onInput={(e) => setFreezeDays(e.detail.value)}
              inputType="number"
            />
          </Card>

          {/* 高级设置展开按钮 */}
          <View
            className="flex flex-row items-center justify-center gap-[8rpx] py-[16rpx] press-scale"
            onClick={() => setAdvancedOpen((prev) => !prev)}
          >
            <Text className="text-[28rpx] font-medium text-primary">
              {advancedOpen ? '点击收起高级设置' : '点击展开高级设置'}
            </Text>
            <Icon
              name={advancedOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}
              size={28}
              color="primary"
            />
          </View>

          {/* 高级设置 */}
          {advancedOpen && (
            <Card className="p-[32rpx] flex flex-col gap-0">
              <FormRow
                label="会员权益"
                hint={CARD_TYPE_TOOLTIPS.benefits}
                editable
                placeholder="选填"
                value={benefits}
                onInput={(e) => setBenefits(e.detail.value)}
              />

              <FormRow
                label="会员卡种类"
                hint={CARD_TYPE_TOOLTIPS.cardCategory}
                onClick={() => openPicker('cardCategory')}
              >
                <Text className="text-[30rpx] text-foreground">{selectedCardCategoryLabel}</Text>
              </FormRow>

              <FormRow
                label="续卡价（元）"
                hint={CARD_TYPE_TOOLTIPS.renewalPrice}
                editable
                placeholder="0.00"
                value={renewalPrice}
                onInput={(e) => setRenewalPrice(e.detail.value)}
                inputType="digit"
              />

              <FormRow
                label="每日最大约课次数（次）"
                hint={CARD_TYPE_TOOLTIPS.dailyMaxBookings}
                editable
                placeholder="0=不限"
                value={dailyMaxBookings}
                onInput={(e) => setDailyMaxBookings(e.detail.value)}
                inputType="number"
              />

              <FormRow
                label="每周最大约课次数（次）"
                hint={CARD_TYPE_TOOLTIPS.weeklyMaxBookings}
                editable
                placeholder="0=不限"
                value={weeklyMaxBookings}
                onInput={(e) => setWeeklyMaxBookings(e.detail.value)}
                inputType="number"
              />

              <FormRow
                label="每月最大约课次数（次）"
                hint={CARD_TYPE_TOOLTIPS.monthlyMaxBookings}
                editable
                placeholder="0=不限"
                value={monthlyMaxBookings}
                onInput={(e) => setMonthlyMaxBookings(e.detail.value)}
                inputType="number"
              />

              <FormRow
                label="免责取消次数（次）"
                hint={CARD_TYPE_TOOLTIPS.freeCancelCount}
                editable
                placeholder="0"
                value={freeCancelCount}
                onInput={(e) => setFreeCancelCount(e.detail.value)}
                inputType="number"
              />

              <FormRow
                label="提前约课（分钟）"
                hint={CARD_TYPE_TOOLTIPS.advanceBookingMinutes}
                editable
                placeholder="0"
                value={advanceBookingMinutes}
                onInput={(e) => setAdvanceBookingMinutes(e.detail.value)}
                inputType="number"
              />

              <FormRow label="可约课星期" hint={CARD_TYPE_TOOLTIPS.availableWeekdays}>
                <View className="flex flex-row items-center gap-[16rpx]">
                  <Text className="text-[30rpx] text-foreground">
                    {allWeekAvailable ? '全周可用' : '自定义'}
                  </Text>
                  <Switch value={allWeekAvailable} onChange={setAllWeekAvailable} />
                </View>
              </FormRow>

              {!allWeekAvailable && (
                <View className="flex flex-row flex-wrap gap-[16rpx] pl-[12rpx] pb-[16rpx]">
                  {WEEKDAY_OPTIONS.map((option) => {
                    const isActive = availableWeekdays.includes(option.value);
                    return (
                      <View
                        key={option.value}
                        className={cn(
                          'py-[10rpx] px-[24rpx] rounded-[16rpx] text-[24rpx] font-medium press-scale',
                          isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                        )}
                        onClick={() => toggleWeekday(option.value)}
                      >
                        <Text className={cn(isActive ? 'text-white' : 'text-muted-foreground')}>
                          {option.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <FormRow
                label="线上购买"
                hint={CARD_TYPE_TOOLTIPS.onlinePurchase}
                onClick={() => openPicker('onlinePurchase')}
              >
                <Text className="text-[30rpx] text-foreground">{onlinePurchase ? '是' : '否'}</Text>
              </FormRow>

              <FormRow
                label="学生身份购买限制"
                hint={CARD_TYPE_TOOLTIPS.studentIdentityLimit}
                onClick={() => openPicker('studentIdentityLimit')}
              >
                <Text className="text-[30rpx] text-foreground">
                  {studentIdentityLimit ? '是' : '否'}
                </Text>
              </FormRow>

              <FormRow
                label="是否赠卡"
                hint={CARD_TYPE_TOOLTIPS.isGiftCard}
                onClick={() => openPicker('isGiftCard')}
              >
                <Text className="text-[30rpx] text-foreground">{isGiftCard ? '是' : '否'}</Text>
              </FormRow>

              <FormRow
                label="允许转卡"
                hint={CARD_TYPE_TOOLTIPS.allowTransfer}
                onClick={() => openPicker('allowTransfer')}
              >
                <Text className="text-[30rpx] text-foreground">
                  {allowTransfer ? '允许' : '不允许'}
                </Text>
              </FormRow>

              <FormRow
                label="使用人数（人）"
                hint={CARD_TYPE_TOOLTIPS.usageLimit}
                editable
                placeholder="0=不限"
                value={usageLimit}
                onInput={(e) => setUsageLimit(e.detail.value)}
                inputType="number"
              />

              <FormRow
                label="提成计算"
                hint={CARD_TYPE_TOOLTIPS.commissionCalc}
                onClick={() => openPicker('commissionCalc')}
              >
                <Text className="text-[30rpx] text-foreground">{selectedCommissionLabel}</Text>
              </FormRow>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* 底部确认按钮 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] flex flex-col gap-[16rpx]">
        <View
          className={cn(
            'w-full py-[26rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float',
            saving && 'opacity-60 pointer-events-none',
          )}
          onClick={() => void handleSubmit()}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {saving ? '保存中...' : isEdit ? '确认修改' : '确认新增'}
          </Text>
        </View>

        {isEdit && (
          <View
            className={cn(
              'w-full py-[26rpx] rounded-full bg-card border-[2rpx] border-border flex items-center justify-center press-scale',
              deleting && 'opacity-60 pointer-events-none',
            )}
            onClick={() => void handleDelete()}
          >
            <Text className="text-[30rpx] font-semibold text-destructive">
              {deleting ? '删除中...' : '删除'}
            </Text>
          </View>
        )}
      </View>

      {/* 选择器弹窗 */}
      <PickerSheet
        visible={picker.visible}
        title={pickerConfig.title}
        options={pickerConfig.options}
        value={pickerConfig.value}
        onClose={closePicker}
        onConfirm={(value) => {
          pickerConfig.onConfirm(value);
          closePicker();
        }}
      />

      {/* 适用课程分类多选弹窗 */}
      <CategoryMultiSheet
        visible={categorySheetVisible}
        categories={categories}
        selectedIds={categoryIds}
        onClose={() => setCategorySheetVisible(false)}
        onConfirm={(ids) => setCategoryIds(ids)}
      />
    </PageContainer>
  );
};

/** 开关组件 */
const Switch: React.FC<{ value: boolean; onChange: (value: boolean) => void }> = ({
  value,
  onChange,
}) => (
  <View
    className={cn(
      'w-[96rpx] h-[56rpx] rounded-full p-[6rpx] transition-all',
      value ? 'bg-primary' : 'bg-border',
    )}
    onClick={() => onChange(!value)}
  >
    <View
      className={cn(
        'w-[44rpx] h-[44rpx] rounded-full bg-white shadow-sm transition-transform',
        value ? 'translate-x-[40rpx]' : 'translate-x-0',
      )}
    />
  </View>
);

/** 表单行组件：左侧标签 + 右侧值/输入框，行内布局 */
const FormRow: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  editable?: boolean;
  placeholder?: string;
  value?: string;
  onInput?: (e: { detail: { value: string } }) => void;
  inputType?: InputProps['type'];
  suffix?: string;
  error?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}> = ({
  label,
  hint,
  required = false,
  editable = false,
  placeholder,
  value,
  onInput,
  inputType,
  suffix,
  error,
  children,
  onClick,
}) => (
  <View className="flex flex-col border-b-[2rpx] border-border/30 py-[24rpx] last:border-b-0">
    <View className={cn('flex flex-row items-center', onClick && 'press-scale')} onClick={onClick}>
      {/* 左侧标签 */}
      <View className="flex flex-row items-center shrink-0 mr-[24rpx]">
        <Text className="text-[30rpx] text-foreground whitespace-nowrap">{label}</Text>
        {required && <Text className="text-[30rpx] text-destructive ml-[4rpx]">*</Text>}
        {hint && <HintPopover content={hint} />}
      </View>

      {/* 右侧内容 */}
      <View className="flex-1 min-w-0 flex flex-row items-center justify-end">
        {editable ? (
          <View className="flex-1 min-w-0 flex flex-row items-center justify-end">
            <FormInput
              variant="ghost"
              className="flex-1 min-w-0"
              placeholder={placeholder}
              value={value}
              onInput={onInput}
              type={inputType}
              inputClassName="text-right text-[30rpx]"
            />
            {suffix && (
              <Text className="text-[30rpx] text-muted-foreground ml-[8rpx] shrink-0">
                {suffix}
              </Text>
            )}
          </View>
        ) : (
          <>
            <View className="flex flex-row items-center gap-[8rpx]">{children}</View>
            {onClick && <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />}
          </>
        )}
      </View>
    </View>

    {/* 错误提示 */}
    {error && (
      <View className="flex flex-row items-center gap-[4rpx] mt-[8rpx]">
        <View className="w-[24rpx] h-[24rpx] rounded-full bg-destructive flex items-center justify-center shrink-0">
          <Text className="text-white text-[18rpx] font-bold leading-none">!</Text>
        </View>
        <Text className="text-[24rpx] text-destructive">{error}</Text>
      </View>
    )}
  </View>
);

// 页面配置：白色导航栏 + 黑色标题
// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '新增会员卡',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default withRouteGuard(CardFormPage);
