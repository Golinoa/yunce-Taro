/**
 * 新增 / 编辑课程表单页
 *
 * 用于创建或编辑课程模板，支持基础信息和高级设置。
 * 所有字段采用左标签右输入/值的行内布局。
 */
import { ScrollView, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import {
  AGE_GROUP_OPTIONS,
  CHECKIN_ROLE_OPTIONS,
  COURSE_COLOR_OPTIONS,
  DEADLINE_OPTIONS,
  STUDENT_SELF_CHECKIN_OPTIONS,
  SUBJECT_OPTIONS,
} from '@/data/course-template';
import { courseTemplateService } from '@/services/course-template';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useCourseTemplateStore } from '@/stores/course-template';
import { CLASS_LEVEL_LABELS } from '@/types/class';
import type { CourseCategoryConfig } from '@/types/course-category';
import type {
  CheckinRole,
  CourseCategory,
  CourseTemplate,
  CourseTemplateFormData,
} from '@/types/course-template';

/** 表单字段错误 */
interface FormErrors {
  name?: string;
  duration?: string;
  capacity?: string;
}

type PickerType =
  | 'category'
  | 'subject'
  | 'ageGroup'
  | 'deadline'
  | 'cancelQueue'
  | 'nonCancel'
  | 'selfCheckin'
  | 'level'
  | 'autoCheckin';

/** Tooltip 提示文案 */
const TOOLTIPS: Record<string, string> = {
  price:
    '该课程的单次约课收费价格，用于非会员通过小程序按次付费场景，该价格也是次卡、储值卡计算单节耗卡价格的依据。',
  color: '用于在课表中区分不同课程，建议不同课程使用不同颜色。',
  selfCheckin: '开启后，学员签到时需在场馆附近一定距离内才能操作，防止未到店签到。',
  autoCheckin: '开启后，系统会在课程结束后自动为已预约学员完成签到。',
  allowCheckinRoles:
    '未勾选的角色在该课程的签到台仅可查看，不能签到/取消签到；被关闭签到的角色代约时不会自动签到。',
};

const CourseFormPage: React.FC = () => {
  const { create, update, remove } = useCourseTemplateStore();
  const { categories, fetchList } = useCourseCategoryStore();
  const instance = Taro.getCurrentInstance();
  const courseId = decodeURIComponent(instance?.router?.params?.id || '');
  const isEdit = !!courseId;

  // 基础字段
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [duration, setDuration] = useState('60');
  const [capacity, setCapacity] = useState('12');

  // 高级设置展开
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 高级字段
  const [color, setColor] = useState(COURSE_COLOR_OPTIONS[0]);
  const [subjectId, setSubjectId] = useState('');
  const [ageGroup, setAgeGroup] = useState<'child' | 'teen' | 'adult' | 'mix'>('mix');
  const [experiencePrice, setExperiencePrice] = useState('');
  const [price, setPrice] = useState('');
  const [minOpenCount, setMinOpenCount] = useState('');
  const [bookingDeadline, setBookingDeadline] = useState('60');
  const [cancelQueueTime, setCancelQueueTime] = useState('60');
  const [nonCancelTime, setNonCancelTime] = useState('120');
  const [autoCheckin, setAutoCheckin] = useState<'follow_category' | 'allow' | 'forbid'>(
    'follow_category',
  );
  const [studentSelfCheckin, setStudentSelfCheckin] = useState<
    'follow_category' | 'allow' | 'forbid'
  >('follow_category');
  const [allowCheckinRoles, setAllowCheckinRoles] = useState<CheckinRole[]>([
    'teacher',
    'receptionist',
  ]);
  const [level, setLevel] = useState<'all' | 'basic' | 'advanced' | 'expert'>('all');
  const [description, setDescription] = useState('');

  // 根据选择的 categoryId 推导分类对象和课程模式
  const selectedCategory = useMemo<CourseCategoryConfig | undefined>(
    () => categories.find((item) => item.id === categoryId),
    [categories, categoryId],
  );
  const category = useMemo<CourseCategory>(
    () => selectedCategory?.mode ?? 'class',
    [selectedCategory],
  );

  // 加载状态
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // 选择器弹窗
  const [picker, setPicker] = useState<{ visible: boolean; type: PickerType }>({
    visible: false,
    type: 'category',
  });

  // 颜色选择弹窗
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  // 角色多选弹窗
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [roleTemp, setRoleTemp] = useState<CheckinRole[]>([]);

  // 加载分类列表，编辑时加载课程详情
  useEffect(() => {
    void fetchList().then(() => {
      if (!isEdit) {
        // 新增时默认选中当前激活分类，没有则选第一个
        const defaultId =
          useCourseCategoryStore.getState().activeCategoryId || categories[0]?.id || '';
        if (defaultId) {
          setCategoryId(defaultId);
        }
      }
    });

    if (!isEdit) return;
    setLoading(true);
    Taro.setNavigationBarTitle({ title: '编辑课程' });
    courseTemplateService
      .getById(courseId)
      .then((data) => {
        if (data) {
          fillForm(data);
        }
      })
      .finally(() => setLoading(false));
  }, [courseId, isEdit, categories, fetchList]);

  const fillForm = (data: CourseTemplate) => {
    setName(data.name);
    setCategoryId(data.categoryId);
    setDuration(String(data.duration));
    setCapacity(String(data.capacity));
    setColor(data.color || COURSE_COLOR_OPTIONS[0]);
    setSubjectId(data.subjectId || '');
    setAgeGroup(data.ageGroup || 'mix');
    setExperiencePrice(data.experiencePrice ? String(data.experiencePrice / 100) : '');
    setPrice(data.price ? String(data.price / 100) : '');
    setMinOpenCount(data.minOpenCount ? String(data.minOpenCount) : '');
    setBookingDeadline(String(data.bookingDeadline ?? 60));
    setCancelQueueTime(String(data.cancelQueueTime ?? 60));
    setNonCancelTime(String(data.nonCancelTime ?? 120));
    setAutoCheckin(data.autoCheckin || 'follow_category');
    setStudentSelfCheckin(data.studentSelfCheckin || 'follow_category');
    setAllowCheckinRoles(
      (data.allowCheckinRoles?.length
        ? data.allowCheckinRoles
        : ['teacher', 'receptionist']) as CheckinRole[],
    );
    setLevel(data.level || 'all');
    setDescription(data.description || '');
  };

  // 选择器选项
  const pickerConfig: {
    title: string;
    options: PickerOption[];
    value: string;
    onConfirm: (value: string) => void;
  } = useMemo(() => {
    switch (picker.type) {
      case 'category':
        return {
          title: '所属分类',
          options: categories.map((item) => ({
            label: item.name,
            value: item.id,
          })),
          value: categoryId,
          onConfirm: (value: string) => setCategoryId(value),
        };
      case 'subject':
        return {
          title: '所属技能',
          options: SUBJECT_OPTIONS,
          value: subjectId,
          onConfirm: (value: string) => setSubjectId(value),
        };
      case 'ageGroup':
        return {
          title: '年龄组',
          options: AGE_GROUP_OPTIONS,
          value: ageGroup,
          onConfirm: (value: string) => setAgeGroup(value as typeof ageGroup),
        };
      case 'deadline':
        return {
          title: '截止预约时间',
          options: DEADLINE_OPTIONS.map((item) => ({
            label: item.label,
            value: String(item.value),
          })),
          value: bookingDeadline,
          onConfirm: (value: string) => setBookingDeadline(value),
        };
      case 'cancelQueue':
        return {
          title: '取消排队时间',
          options: DEADLINE_OPTIONS.map((item) => ({
            label: item.label,
            value: String(item.value),
          })),
          value: cancelQueueTime,
          onConfirm: (value: string) => setCancelQueueTime(value),
        };
      case 'nonCancel':
        return {
          title: '不可取消时间',
          options: DEADLINE_OPTIONS.map((item) => ({
            label: item.label,
            value: String(item.value),
          })),
          value: nonCancelTime,
          onConfirm: (value: string) => setNonCancelTime(value),
        };
      case 'selfCheckin':
        return {
          title: '学员自助签到',
          options: STUDENT_SELF_CHECKIN_OPTIONS,
          value: studentSelfCheckin,
          onConfirm: (value: string) => setStudentSelfCheckin(value as typeof studentSelfCheckin),
        };
      case 'autoCheckin':
        return {
          title: '自动签到',
          options: STUDENT_SELF_CHECKIN_OPTIONS,
          value: autoCheckin,
          onConfirm: (value: string) => setAutoCheckin(value as typeof autoCheckin),
        };
      case 'level':
        return {
          title: '课程难度',
          options: Object.entries(CLASS_LEVEL_LABELS).map(([value, label]) => ({ label, value })),
          value: level,
          onConfirm: (value: string) => setLevel(value as typeof level),
        };
      default:
        return { title: '', options: [], value: '', onConfirm: () => {} };
    }
  }, [
    picker.type,
    categories,
    categoryId,
    subjectId,
    ageGroup,
    bookingDeadline,
    cancelQueueTime,
    nonCancelTime,
    studentSelfCheckin,
    autoCheckin,
    level,
  ]);

  const openPicker = useCallback((type: PickerType) => {
    setPicker({ visible: true, type });
  }, []);

  const closePicker = useCallback(() => {
    setPicker((prev) => ({ ...prev, visible: false }));
  }, []);

  // 角色多选弹窗
  const openRolePicker = useCallback(() => {
    setRoleTemp([...allowCheckinRoles]);
    setRolePickerVisible(true);
  }, [allowCheckinRoles]);

  const toggleRoleTemp = useCallback((role: CheckinRole) => {
    setRoleTemp((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }, []);

  const confirmRolePicker = useCallback(() => {
    setAllowCheckinRoles(roleTemp);
    setRolePickerVisible(false);
  }, [roleTemp]);

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {};
    if (!name.trim()) {
      nextErrors.name = '请输入课程名称';
    }
    const durationNum = Number(duration);
    if (!duration || Number.isNaN(durationNum) || durationNum <= 0) {
      nextErrors.duration = '请输入正确的课程时长';
    }
    const capacityNum = Number(capacity);
    if (!capacity || Number.isNaN(capacityNum) || capacityNum <= 0) {
      nextErrors.capacity = '请输入正确的容纳人数';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [name, duration, capacity]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }
    setSaving(true);

    const formData: CourseTemplateFormData = {
      name: name.trim(),
      categoryId,
      category,
      duration: Number(duration),
      capacity: Number(capacity),
      color,
      subjectId: subjectId || undefined,
      ageGroup,
      experiencePrice: experiencePrice ? Math.round(Number(experiencePrice) * 100) : undefined,
      price: price ? Math.round(Number(price) * 100) : undefined,
      minOpenCount: minOpenCount ? Number(minOpenCount) : undefined,
      bookingDeadline: Number(bookingDeadline),
      cancelQueueTime: Number(cancelQueueTime),
      nonCancelTime: Number(nonCancelTime),
      autoCheckin,
      studentSelfCheckin,
      allowCheckinRoles,
      level,
      description: description.trim() || undefined,
    };

    try {
      if (isEdit) {
        await update(courseId, formData);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await create(formData);
        Taro.showToast({ title: '新增成功', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: isEdit ? '保存失败' : '新增失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    name,
    categoryId,
    category,
    duration,
    capacity,
    color,
    subjectId,
    ageGroup,
    experiencePrice,
    price,
    minOpenCount,
    bookingDeadline,
    cancelQueueTime,
    nonCancelTime,
    autoCheckin,
    studentSelfCheckin,
    allowCheckinRoles,
    level,
    description,
    isEdit,
    courseId,
    create,
    update,
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
      await remove(courseId);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [courseId, name, remove]);

  if (loading) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载课程信息中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <ScrollView
        scrollY
        enhanced
        scrollWithAnimation
        className="h-screen"
        style={{ paddingBottom: '180rpx' }}
      >
        <View className="px-[32rpx] py-[24rpx] flex flex-col gap-[24rpx]">
          {/* 基础信息卡片 */}
          <Card className="p-[32rpx]">
            {/* 课程名称 */}
            <FormRow
              label="课程名称"
              required
              editable
              placeholder="请输入课程名称"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              error={errors.name}
            />

            {/* 所属分类 */}
            <FormRow label="所属分类" required onClick={() => openPicker('category')}>
              <Text
                className={cn(
                  'text-[30rpx]',
                  selectedCategory ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {selectedCategory?.name ?? '请选择'}
              </Text>
            </FormRow>

            {/* 课程时长 */}
            <FormRow
              label="课程时长（分）"
              required
              editable
              placeholder="请输入课程时长"
              value={duration}
              onInput={(e) => setDuration(e.detail.value)}
              inputType="number"
              error={errors.duration}
            />

            {/* 容纳人数 */}
            <FormRow
              label="容纳人数（人）"
              required
              editable
              placeholder="请输入容纳人数"
              value={capacity}
              onInput={(e) => setCapacity(e.detail.value)}
              inputType="number"
              error={errors.capacity}
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
              {/* 课程颜色 */}
              <FormRow
                label="课程颜色"
                hint={TOOLTIPS.color}
                onClick={() => setColorPickerVisible(true)}
              >
                {color ? (
                  <View className="flex flex-row items-center gap-[12rpx]">
                    <View
                      className="w-[32rpx] h-[32rpx] rounded-[8rpx]"
                      style={{ backgroundColor: color }}
                    />
                    <Text className="text-[30rpx] text-foreground">已选择</Text>
                  </View>
                ) : (
                  <Text className="text-[30rpx] text-muted-foreground">请选择</Text>
                )}
              </FormRow>

              {/* 所属技能 */}
              <FormRow label="所属技能" onClick={() => openPicker('subject')}>
                <Text
                  className={cn(
                    'text-[30rpx]',
                    subjectId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {subjectId ? SUBJECT_OPTIONS.find((s) => s.value === subjectId)?.label : '请选择'}
                </Text>
              </FormRow>

              {/* 年龄组 */}
              <FormRow label="年龄组" onClick={() => openPicker('ageGroup')}>
                <Text className="text-[30rpx] text-foreground">
                  {AGE_GROUP_OPTIONS.find((a) => a.value === ageGroup)?.label}
                </Text>
              </FormRow>

              {/* 新客体验价 */}
              <FormRow
                label="新客体验价"
                editable
                placeholder="请输入体验价"
                value={experiencePrice}
                onInput={(e) => setExperiencePrice(e.detail.value)}
                inputType="digit"
                suffix="元"
              />

              {/* 单价 */}
              <FormRow
                label="单价"
                hint={TOOLTIPS.price}
                editable
                placeholder="请输入单价"
                value={price}
                onInput={(e) => setPrice(e.detail.value)}
                inputType="digit"
                suffix="元"
              />

              {/* 最低开课人数 */}
              <FormRow
                label="最低开课人数"
                editable
                placeholder="请输入最低开课人数"
                value={minOpenCount}
                onInput={(e) => setMinOpenCount(e.detail.value)}
                inputType="number"
              />

              {/* 截止预约时间 */}
              <FormRow label="截止预约时间" onClick={() => openPicker('deadline')}>
                <Text className="text-[30rpx] text-foreground">
                  {DEADLINE_OPTIONS.find((d) => String(d.value) === bookingDeadline)?.label}
                </Text>
              </FormRow>

              {/* 取消排队时间 */}
              <FormRow label="取消排队时间" onClick={() => openPicker('cancelQueue')}>
                <Text className="text-[30rpx] text-foreground">
                  {DEADLINE_OPTIONS.find((d) => String(d.value) === cancelQueueTime)?.label}
                </Text>
              </FormRow>

              {/* 不可取消时间 */}
              <FormRow label="不可取消时间" onClick={() => openPicker('nonCancel')}>
                <Text className="text-[30rpx] text-foreground">
                  {DEADLINE_OPTIONS.find((d) => String(d.value) === nonCancelTime)?.label}
                </Text>
              </FormRow>

              {/* 自动签到 */}
              <FormRow
                label="自动签到"
                hint={TOOLTIPS.autoCheckin}
                onClick={() => openPicker('autoCheckin')}
              >
                <Text className="text-[30rpx] text-foreground">
                  {STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === autoCheckin)?.label}
                </Text>
              </FormRow>

              {/* 学员自助签到 */}
              <FormRow
                label="学员自助签到"
                hint={TOOLTIPS.selfCheckin}
                onClick={() => openPicker('selfCheckin')}
              >
                <Text className="text-[30rpx] text-foreground">
                  {STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === studentSelfCheckin)?.label}
                </Text>
              </FormRow>

              {/* 允许签到角色 */}
              <FormRow
                label="允许签到角色"
                hint={TOOLTIPS.allowCheckinRoles}
                onClick={openRolePicker}
              >
                <Text className="text-[30rpx] text-foreground">
                  {allowCheckinRoles.length > 0
                    ? allowCheckinRoles
                        .map((r) => CHECKIN_ROLE_OPTIONS.find((o) => o.value === r)?.label)
                        .filter(Boolean)
                        .join('、')
                    : '请选择'}
                </Text>
              </FormRow>

              {/* 课程难度 */}
              <FormRow label="课程难度" onClick={() => openPicker('level')}>
                <View className="px-[20rpx] py-[6rpx] rounded-[8rpx] bg-primary-10">
                  <Text className="text-[24rpx] font-medium text-primary">
                    {CLASS_LEVEL_LABELS[level]}
                  </Text>
                </View>
              </FormRow>

              {/* 课程简介 - 上下布局，标签在上，多行输入框在下 */}
              <View className="pt-[24rpx] pb-[8rpx]">
                <FormInput
                  label="课程简介"
                  placeholder="请输入课程简介"
                  value={description}
                  onInput={(e) => setDescription(e.detail.value)}
                  multiline
                  minHeight="200rpx"
                />
              </View>
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
            {saving ? '保存中...' : isEdit ? '保存' : '确认新增'}
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

      {/* 颜色选择弹窗 */}
      <BottomSheet
        visible={colorPickerVisible}
        title="课程颜色"
        onClose={() => setColorPickerVisible(false)}
        height="auto"
        scrollable={false}
      >
        <View className="px-[32rpx] pb-[48rpx] pt-[16rpx]">
          <Text className="text-[26rpx] text-muted-foreground mb-[24rpx]">
            用于在课表中区分不同课程，建议不同课程使用不同颜色。
          </Text>
          <View className="flex flex-row flex-wrap gap-[24rpx]">
            {COURSE_COLOR_OPTIONS.map((c) => (
              <View
                key={c}
                className={cn(
                  'w-[80rpx] h-[80rpx] rounded-[20rpx] press-scale',
                  color === c && 'ring-[4rpx] ring-offset-[4rpx] ring-primary',
                )}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setColor(c);
                  setColorPickerVisible(false);
                }}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* 角色多选弹窗 */}
      <BottomSheet
        visible={rolePickerVisible}
        title="允许签到角色"
        onClose={() => setRolePickerVisible(false)}
        height="auto"
        scrollable={false}
      >
        <View className="px-[32rpx] pb-[48rpx]">
          <View className="flex flex-col gap-[12rpx]">
            <View className="flex flex-row items-center justify-between py-[24rpx] border-b border-border">
              <Text className="text-[30rpx] text-foreground">门店管理员</Text>
              <Text className="text-[24rpx] text-muted-foreground">始终可签</Text>
            </View>
            {CHECKIN_ROLE_OPTIONS.map((role) => {
              const checked = roleTemp.includes(role.value);
              return (
                <View
                  key={role.value}
                  className="flex flex-row items-center justify-between py-[24rpx] border-b border-border press-bg"
                  onClick={() => toggleRoleTemp(role.value)}
                >
                  <Text className="text-[30rpx] text-foreground">{role.label}</Text>
                  <View
                    className={cn(
                      'w-[40rpx] h-[40rpx] rounded-full flex items-center justify-center',
                      checked ? 'bg-warning' : 'border-[2rpx] border-muted-foreground',
                    )}
                  >
                    {checked && <Icon name="mdi-check" size={24} color="white" />}
                  </View>
                </View>
              );
            })}
          </View>
          <Text className="mt-[24rpx] text-[24rpx] text-muted-foreground leading-relaxed">
            未勾选的角色在该课程的签到台仅可查看，不能签到/取消签到；被关闭签到的角色代约时不会自动签到。
          </Text>
          <View
            className="mt-[32rpx] w-full py-[24rpx] rounded-full bg-primary flex items-center justify-center press-scale"
            onClick={confirmRolePicker}
          >
            <Text className="text-[30rpx] font-semibold text-white">确定</Text>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '新增课程',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default CourseFormPage;
