/**
 * 分类详情 / 新增分类页
 *
 * 用于创建或编辑课程分类，配置分类的预约、签到、展示规则。
 * 暂不实现线上课模式。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import HintPopover from '@/components/HintPopover';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import Switch from '@/components/Switch';
import {
  CATEGORY_AUTO_CHECKIN_OPTIONS,
  CATEGORY_MODE_OPTIONS,
  CATEGORY_TIME_OPTIONS,
  formatCategoryTime,
} from '@/data/course-category';
import { courseCategoryService } from '@/services/course-category';
import { courseTemplateService } from '@/services/course-template';
import { useCourseCategoryStore } from '@/stores/course-category';
import type {
  CategoryAutoCheckinValue,
  CategoryTimeValue,
  CourseCategoryConfig,
  CourseCategoryFormData,
  CourseCategoryMode,
} from '@/types/course-category';

/**
 * 选择器类型
 */
type PickerType = 'bookingDeadline' | 'cancelQueueTime' | 'nonCancelTime' | 'autoCheckin';

/** Tooltip 提示文案 */
const TOOLTIPS: Record<string, string> = {
  name: '填写课程类别名称(如"暑期班""特训营")，非具体课程名称。',
  sortOrder:
    '数字越小，该分类在"课程管理"页面的标签栏以及首页约课界面中排序越靠前。例如填写1则排在第一位。',
  minOpenCount: '预约人数未达到此数值时，课程将自动取消。设为0表示不限制最低人数。',
  bookingDeadline:
    '开课前多少小时停止接受预约。例如填写2，则开课前2小时后无法预约该课程。如果课程已达到开课人数条件，则会员约课不受此限制。',
  cancelQueueTime:
    '开课前多少小时自动取消排队候补。例如填写1，则开课前1小时未递补成功的排队将被取消。',
  nonCancelTime:
    '开课前多少小时内不允许会员取消预约。例如填写2，则开课前2小时内无法取消。管理员、店长或教练为会员取消预约不受此限制。',
  autoCheckin:
    '课程结束后多少小时内系统自动签到。例如填写1，则课程结束后1小时系统会对本课程所有预约会员自动签到。',
  studentSelfCheckin: '开启后，学员可在公告页通过"待签到"入口自助完成课程签到，无需前台操作。',
  distanceLimit: '开启后，学员签到时需在场馆附近一定距离内才能操作，防止未到店签到。',
  checkinBeforeMinutes: '课程开始前多少分钟允许学员签到。例如填60，则开课前1小时即可签到。',
  checkinAfterMinutes: '课程结束后多少分钟内仍允许学员签到。例如填120，则课后2小时内都可签到。',
  mode: '班课为固定班级成员上课；团课为用户自主预约；私教为按老师预约。',
  independentDisplay:
    '开启后，该分类会作为约课首页顶部的一个独立标签单独展示(排在「场地」之后);关闭时其名下课程仍会并入「团课」等同模式标签中显示。多个独立标签之间按「分类排列顺序」排序。',
};

const NEW_CATEGORY_ACTIVE_KEY = 'yunce:schedule:new_category_active_id';

const CategoryFormPage: React.FC = () => {
  const { create, update, remove, categories, fetchList } = useCourseCategoryStore();
  const instance = Taro.getCurrentInstance();
  const categoryId = decodeURIComponent(instance?.router?.params?.id || '');
  const isEdit = !!categoryId;

  // 基础字段
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [minOpenCount, setMinOpenCount] = useState('0');

  // 预约/签到字段（单位：小时）
  const [bookingDeadline, setBookingDeadline] = useState<CategoryTimeValue>('at_start');
  const [cancelQueueTime, setCancelQueueTime] = useState<CategoryTimeValue>('at_start');
  const [nonCancelTime, setNonCancelTime] = useState<CategoryTimeValue>('at_start');
  const [autoCheckin, setAutoCheckin] = useState<CategoryAutoCheckinValue>('at_end');
  const [studentSelfCheckin, setStudentSelfCheckin] = useState(true);
  const [distanceLimit, setDistanceLimit] = useState(false);
  const [checkinBeforeMinutes, setCheckinBeforeMinutes] = useState('60');
  const [checkinAfterMinutes, setCheckinAfterMinutes] = useState('120');

  // 模式与展示
  const [mode, setMode] = useState<CourseCategoryMode>('class');
  const [independentDisplay, setIndependentDisplay] = useState(true);

  // 加载与提交状态
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categoryData, setCategoryData] = useState<CourseCategoryConfig | null>(null);

  // 选择器弹窗
  const [picker, setPicker] = useState<{ visible: boolean; type: PickerType }>({
    visible: false,
    type: 'bookingDeadline',
  });

  // 自定义时间输入弹窗
  const [customInput, setCustomInput] = useState<{
    visible: boolean;
    field: 'bookingDeadline' | 'cancelQueueTime' | 'nonCancelTime' | 'autoCheckin' | null;
    title: string;
    unit: string;
    prefix: string;
    value: string;
  }>({
    visible: false,
    field: null,
    title: '',
    unit: '',
    prefix: '',
    value: '',
  });

  // 加载分类列表（不依赖 categories，避免 fetchList → 更新 categories → 再次 fetchList 的死循环）
  useEffect(() => {
    void fetchList();

    if (!isEdit) return;
    setLoading(true);
    courseCategoryService
      .getById(categoryId)
      .then((data) => {
        if (data) {
          setCategoryData(data);
          fillForm(data);
        }
      })
      .finally(() => setLoading(false));
  }, [categoryId, isEdit, fetchList]);

  // 新增时：分类列表加载完成后，自动计算默认排序（顺位推荐）
  useEffect(() => {
    if (isEdit || sortOrder !== '1' || categories.length === 0) return;
    const maxOrder = Math.max(...categories.map((c) => c.sortOrder));
    setSortOrder(String(maxOrder + 1));
  }, [isEdit, categories, sortOrder]);

  const fillForm = (data: CourseCategoryConfig) => {
    setName(data.name);
    setSortOrder(String(data.sortOrder));
    setMinOpenCount(String(data.minOpenCount));
    setBookingDeadline(data.bookingDeadline);
    setCancelQueueTime(data.cancelQueueTime);
    setNonCancelTime(data.nonCancelTime);
    setAutoCheckin(data.autoCheckin);
    setStudentSelfCheckin(data.studentSelfCheckin);
    setDistanceLimit(data.distanceLimit);
    setCheckinBeforeMinutes(String(data.checkinBeforeMinutes));
    setCheckinAfterMinutes(String(data.checkinAfterMinutes));
    setMode(data.mode);
    setIndependentDisplay(data.independentDisplay);
  };

  const openPicker = useCallback((type: PickerType) => {
    setPicker({ visible: true, type });
  }, []);

  const closePicker = useCallback(() => {
    setPicker((prev) => ({ ...prev, visible: false }));
  }, []);

  // 处理时间选择器确认
  const handleTimeConfirm = useCallback(
    (
      field: 'bookingDeadline' | 'cancelQueueTime' | 'nonCancelTime' | 'autoCheckin',
      value: string,
    ) => {
      if (value === 'custom') {
        const config: Record<typeof field, { title: string; unit: string; prefix: string }> = {
          bookingDeadline: { title: '自定义截止预约时间', unit: '小时', prefix: '开课前' },
          cancelQueueTime: { title: '自定义取消排队时间', unit: '小时', prefix: '开课前' },
          nonCancelTime: { title: '自定义不可取消时间', unit: '小时', prefix: '开课前' },
          autoCheckin: { title: '自定义自动签到时间', unit: '小时', prefix: '结束后' },
        };
        setCustomInput({
          visible: true,
          field,
          ...config[field],
          value: '',
        });
        return;
      }

      if (field === 'bookingDeadline') setBookingDeadline(value as CategoryTimeValue);
      if (field === 'cancelQueueTime') setCancelQueueTime(value as CategoryTimeValue);
      if (field === 'nonCancelTime') setNonCancelTime(value as CategoryTimeValue);
      if (field === 'autoCheckin') setAutoCheckin(value as CategoryAutoCheckinValue);
    },
    [],
  );

  // 确认自定义时间
  const confirmCustomInput = useCallback(() => {
    const hours = Number(customInput.value);
    if (!customInput.value || Number.isNaN(hours) || hours <= 0) {
      Taro.showToast({ title: '请输入正确的小时数', icon: 'none' });
      return;
    }
    const { field } = customInput;
    if (field === 'bookingDeadline') setBookingDeadline(hours);
    if (field === 'cancelQueueTime') setCancelQueueTime(hours);
    if (field === 'nonCancelTime') setNonCancelTime(hours);
    if (field === 'autoCheckin') setAutoCheckin(hours);
    setCustomInput((prev) => ({ ...prev, visible: false }));
  }, [customInput]);

  const validate = useCallback((): boolean => {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入分类名称', icon: 'none' });
      return false;
    }
    if (sortOrder === '' || Number.isNaN(Number(sortOrder))) {
      Taro.showToast({ title: '请输入分类排列顺序', icon: 'none' });
      return false;
    }
    const beforeMinutes = Number(checkinBeforeMinutes);
    if (checkinBeforeMinutes === '' || Number.isNaN(beforeMinutes) || beforeMinutes <= 0) {
      Taro.showToast({ title: '请输入正确的课前可签到分钟数', icon: 'none' });
      return false;
    }
    const afterMinutes = Number(checkinAfterMinutes);
    if (checkinAfterMinutes === '' || Number.isNaN(afterMinutes) || afterMinutes <= 0) {
      Taro.showToast({ title: '请输入正确的课后可签到分钟数', icon: 'none' });
      return false;
    }
    return true;
  }, [name, sortOrder, checkinBeforeMinutes, checkinAfterMinutes]);

  // 选择器配置
  const pickerConfig: {
    title: string;
    options: PickerOption[];
    value: string;
    onConfirm: (value: string) => void;
  } = useMemo(() => {
    switch (picker.type) {
      case 'bookingDeadline':
        return {
          title: '截止预约时间',
          options: CATEGORY_TIME_OPTIONS.map((item) => ({
            label: item.label,
            value: typeof item.value === 'number' ? String(item.value) : item.value,
          })),
          value: typeof bookingDeadline === 'number' ? String(bookingDeadline) : bookingDeadline,
          onConfirm: (value: string) => handleTimeConfirm('bookingDeadline', value),
        };
      case 'cancelQueueTime':
        return {
          title: '取消排队时间',
          options: CATEGORY_TIME_OPTIONS.map((item) => ({
            label: item.label,
            value: typeof item.value === 'number' ? String(item.value) : item.value,
          })),
          value: typeof cancelQueueTime === 'number' ? String(cancelQueueTime) : cancelQueueTime,
          onConfirm: (value: string) => handleTimeConfirm('cancelQueueTime', value),
        };
      case 'nonCancelTime':
        return {
          title: '不可取消时间',
          options: CATEGORY_TIME_OPTIONS.map((item) => ({
            label: item.label,
            value: typeof item.value === 'number' ? String(item.value) : item.value,
          })),
          value: typeof nonCancelTime === 'number' ? String(nonCancelTime) : nonCancelTime,
          onConfirm: (value: string) => handleTimeConfirm('nonCancelTime', value),
        };
      case 'autoCheckin':
        return {
          title: '自动签到',
          options: CATEGORY_AUTO_CHECKIN_OPTIONS.map((item) => ({
            label: item.label,
            value: typeof item.value === 'number' ? String(item.value) : item.value,
          })),
          value: typeof autoCheckin === 'number' ? String(autoCheckin) : autoCheckin,
          onConfirm: (value: string) => handleTimeConfirm('autoCheckin', value),
        };
      default:
        return { title: '', options: [], value: '', onConfirm: () => {} };
    }
  }, [
    picker.type,
    bookingDeadline,
    cancelQueueTime,
    nonCancelTime,
    autoCheckin,
    handleTimeConfirm,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);

    const formData: CourseCategoryFormData = {
      name: name.trim(),
      sortOrder: Number(sortOrder),
      minOpenCount: Number(minOpenCount || '0'),
      bookingDeadline,
      cancelQueueTime,
      nonCancelTime,
      autoCheckin,
      studentSelfCheckin,
      distanceLimit,
      checkinBeforeMinutes: Number(checkinBeforeMinutes || '0'),
      checkinAfterMinutes: Number(checkinAfterMinutes || '0'),
      mode,
      independentDisplay,
    };

    try {
      if (isEdit) {
        await update(categoryId, formData);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        const created = await create(formData);
        Taro.setStorageSync(NEW_CATEGORY_ACTIVE_KEY, created.id);
        Taro.showToast({ title: '新增成功', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : isEdit ? '保存失败' : '新增失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    name,
    sortOrder,
    minOpenCount,
    bookingDeadline,
    cancelQueueTime,
    nonCancelTime,
    autoCheckin,
    studentSelfCheckin,
    distanceLimit,
    checkinBeforeMinutes,
    checkinAfterMinutes,
    mode,
    independentDisplay,
    isEdit,
    categoryId,
    create,
    update,
  ]);

  const handleDelete = useCallback(async () => {
    if (!categoryData || categoryData.isSystem) {
      Taro.showToast({ title: '系统内置分类不可删除', icon: 'none' });
      return;
    }

    // 检测分类下是否还有课程
    const templates = await courseTemplateService.getList(categoryData.id);
    const hasCourses = templates.length > 0;

    const { confirm } = await Taro.showModal({
      title: '确认删除',
      confirmColor: '#EF4444',
      content: hasCourses
        ? `该分类下还有 ${templates.length} 个课程，删除分类将同步删除这些课程及其关联数据，操作不可恢复。是否确认删除？`
        : `删除后「${categoryData.name}」将不可恢复，是否确认删除？`,
    });
    if (!confirm) return;

    setDeleting(true);
    try {
      await remove(categoryData.id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [categoryData, remove]);

  if (loading) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载分类信息中..." />
        </View>
      </PageContainer>
    );
  }

  const isSystemCategory = categoryData?.isSystem ?? false;

  return (
    <PageContainer safeBottom>
      <ScrollView
        scrollY
        enhanced
        scrollWithAnimation
        className="h-screen"
        style={{ paddingBottom: '280rpx' }}
      >
        <View className="px-[32rpx] py-[24rpx]">
          <Card className="px-[32rpx]">
            {/* 分类名称 */}
            <FormCell label="分类名称" hint={TOOLTIPS.name} required>
              <FormInput
                variant="ghost"
                placeholder="请输入分类名称"
                value={name}
                onInput={(e) => setName(e.detail.value)}
                inputClassName="text-right"
              />
            </FormCell>

            {/* 分类排列顺序 */}
            <FormCell label="分类排列顺序" hint={TOOLTIPS.sortOrder} required>
              <FormInput
                variant="ghost"
                placeholder="请输入"
                value={sortOrder}
                onInput={(e) => setSortOrder(e.detail.value)}
                type="number"
                inputClassName="text-right"
              />
            </FormCell>

            {/* 最低开课人数 */}
            <FormCell label="最低开课人数" hint={TOOLTIPS.minOpenCount}>
              <FormInput
                variant="ghost"
                placeholder="请输入"
                value={minOpenCount}
                onInput={(e) => setMinOpenCount(e.detail.value)}
                type="number"
                inputClassName="text-right"
              />
            </FormCell>

            {/* 截止预约时间 */}
            <FormCell
              label="截止预约时间"
              hint={TOOLTIPS.bookingDeadline}
              onClick={() => openPicker('bookingDeadline')}
            >
              <Text className="text-[30rpx] text-primary">
                {formatCategoryTime(bookingDeadline, 'before')}
              </Text>
            </FormCell>

            {/* 取消排队时间 */}
            <FormCell
              label="取消排队时间"
              hint={TOOLTIPS.cancelQueueTime}
              onClick={() => openPicker('cancelQueueTime')}
            >
              <Text className="text-[30rpx] text-primary">
                {formatCategoryTime(cancelQueueTime, 'before')}
              </Text>
            </FormCell>

            {/* 不可取消时间 */}
            <FormCell
              label="不可取消时间"
              hint={TOOLTIPS.nonCancelTime}
              onClick={() => openPicker('nonCancelTime')}
            >
              <Text className="text-[30rpx] text-primary">
                {formatCategoryTime(nonCancelTime, 'before')}
              </Text>
            </FormCell>

            {/* 自动签到 */}
            <FormCell
              label="自动签到"
              hint={TOOLTIPS.autoCheckin}
              onClick={() => openPicker('autoCheckin')}
            >
              <Text className="text-[30rpx] text-primary">
                {formatCategoryTime(autoCheckin, 'after')}
              </Text>
            </FormCell>

            {/* 学员自助签到 */}
            <FormCell label="学员自助签到" hint={TOOLTIPS.studentSelfCheckin}>
              <Switch checked={studentSelfCheckin} onChange={setStudentSelfCheckin} />
            </FormCell>

            {/* 签到距离限制 */}
            <FormCell label="签到距离限制" hint={TOOLTIPS.distanceLimit}>
              <Switch checked={distanceLimit} onChange={setDistanceLimit} />
            </FormCell>

            {/* 课前可签到 */}
            <FormCell label="课前可签到(分钟)" hint={TOOLTIPS.checkinBeforeMinutes}>
              <FormInput
                variant="ghost"
                placeholder="请输入"
                value={checkinBeforeMinutes}
                onInput={(e) => setCheckinBeforeMinutes(e.detail.value)}
                type="number"
                inputClassName="text-right"
              />
            </FormCell>

            {/* 课后可签到 */}
            <FormCell label="课后可签到(分钟)" hint={TOOLTIPS.checkinAfterMinutes}>
              <FormInput
                variant="ghost"
                placeholder="请输入"
                value={checkinAfterMinutes}
                onInput={(e) => setCheckinAfterMinutes(e.detail.value)}
                type="number"
                inputClassName="text-right"
              />
            </FormCell>

            {/* 课程模式 */}
            <FormCell label="课程模式" hint={TOOLTIPS.mode}>
              <Text className="text-[30rpx] text-primary">
                {CATEGORY_MODE_OPTIONS.find((m) => m.value === mode)?.label}
              </Text>
            </FormCell>

            {/* 课程模式选项卡 */}
            <View className="pb-[28rpx] pt-[8rpx]">
              <View className="flex flex-row gap-[16rpx]">
                {CATEGORY_MODE_OPTIONS.map((item) => {
                  const isActive = mode === item.value;
                  return (
                    <View
                      key={item.value}
                      className={cn(
                        'flex-1 py-[20rpx] px-[12rpx] rounded-[16rpx] border-[2rpx] flex flex-col items-center gap-[6rpx] press-scale',
                        isActive ? 'bg-primary/10 border-primary' : 'bg-card border-border',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMode(item.value);
                      }}
                    >
                      <Text
                        className={cn(
                          'text-[30rpx] font-medium',
                          isActive ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {item.label}
                      </Text>
                      <Text
                        className={cn(
                          'text-[22rpx]',
                          isActive ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {item.description}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 独立展示 */}
            <FormCell label="独立展示" hint={TOOLTIPS.independentDisplay}>
              <Switch checked={independentDisplay} onChange={setIndependentDisplay} />
            </FormCell>
          </Card>
        </View>
      </ScrollView>

      {/* 底部按钮 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] flex flex-col gap-[16rpx]">
        <View
          className={cn(
            'w-full py-[26rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float z-50',
            saving && 'opacity-60 pointer-events-none',
          )}
          hoverClass="opacity-80"
          onClick={() => void handleSubmit()}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>

        {isEdit && !isSystemCategory && (
          <View
            className={cn(
              'w-full py-[26rpx] rounded-full bg-card border-[2rpx] border-border flex items-center justify-center press-scale z-50',
              deleting && 'opacity-60 pointer-events-none',
            )}
            hoverClass="opacity-80"
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

      {/* 自定义时间输入弹窗 */}
      <BottomSheet
        visible={customInput.visible}
        title={customInput.title}
        onClose={() => setCustomInput((prev) => ({ ...prev, visible: false }))}
        height="auto"
        scrollable={false}
      >
        <View className="px-[32rpx] pb-[48rpx] pt-[16rpx]">
          <View className="flex flex-row items-center justify-center gap-[16rpx] py-[32rpx]">
            <Text className="text-[30rpx] text-foreground">{customInput.prefix}</Text>
            <FormInput
              className="w-[160rpx]"
              placeholder="请输入"
              value={customInput.value}
              onInput={(e) =>
                setCustomInput((prev) => ({ ...prev, value: e.detail.value.replace(/\D/g, '') }))
              }
              type="number"
              inputClassName="text-center"
            />
            <Text className="text-[30rpx] text-foreground">{customInput.unit}</Text>
          </View>
          <View className="flex flex-row gap-[24rpx]">
            <View
              className="flex-1 py-[24rpx] rounded-full bg-muted flex items-center justify-center press-scale z-50"
              hoverClass="opacity-80"
              onClick={() => setCustomInput((prev) => ({ ...prev, visible: false }))}
            >
              <Text className="text-[30rpx] font-medium text-foreground">取消</Text>
            </View>
            <View
              className="flex-1 py-[24rpx] rounded-full bg-primary flex items-center justify-center press-scale z-50"
              hoverClass="opacity-80"
              onClick={() => void confirmCustomInput()}
            >
              <Text className="text-[30rpx] font-semibold text-white">确定</Text>
            </View>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

/** 表单单元格：左侧标签 + 右侧值/操作，底部带分隔线 */
const FormCell: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ label, hint, required = false, children, onClick }) => (
  <View
    className={cn(
      'flex flex-row items-center justify-between py-[28rpx] border-b border-border last:border-b-0',
      onClick && 'press-scale',
    )}
    onClick={onClick}
  >
    <View className="flex flex-row items-center shrink-0 mr-[24rpx]">
      <Text className="text-[30rpx] text-foreground font-medium">{label}</Text>
      {required && <Text className="text-base text-destructive">*</Text>}
      {hint && <HintPopover content={hint} />}
    </View>
    <View className="flex-1 min-w-0 flex flex-row items-center justify-end gap-[8rpx]">
      {children}
      {onClick && <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />}
    </View>
  </View>
);

// 页面配置：白色导航栏 + 黑色标题
// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '分类详情',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default CategoryFormPage;
