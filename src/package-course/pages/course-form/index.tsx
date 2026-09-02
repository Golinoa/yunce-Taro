/**
 * 新增 / 编辑课程表单页
 *
 * 用于创建或编辑课程模板，支持基础信息和高级设置。
 * 所有字段采用左标签右输入/值的行内布局。
 */
import { ScrollView, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { COURSE_COLOR_OPTIONS } from '@/constants/course-template-ui';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useCourseTemplateStore } from '@/stores/course-template';
import { useStudentStore } from '@/stores/student';
import { useTeacherStore } from '@/stores/teacher';
import type { Subject } from '@/types/campus';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { CheckinRole, CourseCategory } from '@/types/course-template';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { buildCourseFormDirtyKey, type FormErrors, type PickerType } from './course-form-constants';
import { setLeaveGuard } from './course-form-leave-guard';
import CourseFormAdvancedPanel from './CourseFormAdvancedPanel';
import CourseFormBasicPanel from './CourseFormBasicPanel';
import CourseFormFooter from './CourseFormFooter';
import CourseFormSheets from './CourseFormSheets';
import { useCourseFormActions } from './use-course-form-actions';
import { useCourseFormLoaders } from './use-course-form-loaders';

const CourseFormPage: React.FC = () => {
  const { create, update, remove } = useCourseTemplateStore();
  const { categories, fetchList } = useCourseCategoryStore();
  const { profile } = useAuth();
  const { teachers, fetchTeachers } = useTeacherStore();
  const { fetchByTeacher } = useStudentStore();
  const instance = Taro.getCurrentInstance();
  const courseId = decodeURIComponent(instance?.router?.params?.id || '');
  const isEdit = !!courseId;
  // 班级模式（用户口径 2026-08-23）：课程管理页「未排课班级」与班级详情页「编辑」
  // 统一走本页编辑班级数据（type=class），编辑入口不再散落于 class-form / 弹窗
  const editType = decodeURIComponent(instance?.router?.params?.type || '');
  const routeCategoryId = decodeURIComponent(instance?.router?.params?.categoryId || '');
  const isClassEdit = isEdit && editType === 'class';

  // 基础字段
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [duration, setDuration] = useState('60');
  // 容纳人数：默认留空，表示不限制人数；用户填写后才按数值约束。
  const [capacity, setCapacity] = useState('');
  /** 结束班级：关=不限制课时；开=须填上限课时，并与排课时间限制联动 */
  const [endClassEnabled, setEndClassEnabled] = useState(false);
  const [maxLessons, setMaxLessons] = useState('');

  // 高级设置展开
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 高级字段
  const [color, setColor] = useState(COURSE_COLOR_OPTIONS[0]);
  const [subjectId, setSubjectId] = useState('');
  const [ageGroup, setAgeGroup] = useState<'child' | 'teen' | 'adult' | 'mix' | string>('mix');
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
  const [level, setLevel] = useState<'all' | 'basic' | 'advanced' | 'expert' | string>('all');
  const [customLevels, setCustomLevels] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [homeImage, setHomeImage] = useState('');

  const formStorageScope = courseId || '__new__';
  const [customAgeGroups, setCustomAgeGroups] = useState<string[]>([]);

  // 班课模式字段
  const [teacherId, setTeacherId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  /** 班课：单次默认消耗课时 */
  const [hoursPerLesson, setHoursPerLesson] = useState('1');
  /** 班课：单次授课扣费（元） */
  const [feePerLesson, setFeePerLesson] = useState('');
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // 记录是否已设置过默认分类，避免 categories 刷新后覆盖用户手动选择
  const defaultCategorySetRef = React.useRef(false);

  const selectedCategory = useMemo<CourseCategoryConfig | undefined>(
    () => categories.find((item) => item.id === categoryId),
    [categories, categoryId],
  );
  const category = useMemo<CourseCategory>(
    // 按所属分类 mode 渲染：班课 / 团课 / 私教字段不同；勿再强制班级编辑=班课，否则团课班也会露出「上课学员」
    () => selectedCategory?.mode ?? 'class',
    [selectedCategory],
  );

  const selectedStudents = useMemo<Student[]>(
    () =>
      studentIds
        .map((id) => studentList.find((s) => s.id === id))
        .filter((s): s is Student => Boolean(s)),
    [studentIds, studentList],
  );

  /** 班课模式：隐藏开课与价格/预约规则/签到规则，改为班课信息区块 */
  const isClassMode = category === 'class';
  /** 团课：开放预约制，暂无固定参团名单 */
  const isGroupMode = category === 'group';

  const { loading, setLoading } = useDelayedLoading();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [picker, setPicker] = useState<{ visible: boolean; type: PickerType }>({
    visible: false,
    type: 'category',
  });
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [roleTemp, setRoleTemp] = useState<CheckinRole[]>([]);

  // 页面滚动位置保护：BottomSheet 等 fixed 弹窗关闭后，微信会重置 ScrollView 滚动位置
  const [scrollTop, setScrollTop] = useState(0);
  const scrollTopRef = useRef(0);

  // 「未保存改动」检测
  const initialFormKeyRef = useRef<string | null>(null);
  const captureBaselineRef = useRef(false);
  const guardArmedRef = useRef(false);
  const unloadedRef = useRef(false);
  const applyLeaveGuard = useCallback((dirty: boolean) => {
    if (dirty === guardArmedRef.current) return;
    guardArmedRef.current = dirty;
    setLeaveGuard(dirty);
  }, []);

  useCourseFormLoaders({
    courseId,
    isEdit,
    isClassEdit,
    isClassMode,
    formStorageScope,
    routeCategoryId,
    profileId: profile?.id,
    profileRole: profile?.currentContext?.role,
    profileCampusId: profile?.currentContext?.campusId,
    setLoading,
    fetchList,
    fetchTeachers,
    fetchByTeacher,
    defaultCategorySetRef,
    captureBaselineRef,
    unloadedRef,
    setName,
    setCategoryId,
    setDuration,
    setCapacity,
    setEndClassEnabled,
    setMaxLessons,
    setAdvancedOpen,
    setColor,
    setSubjectId,
    setAgeGroup,
    setCustomAgeGroups,
    setExperiencePrice,
    setPrice,
    setMinOpenCount,
    setBookingDeadline,
    setCancelQueueTime,
    setNonCancelTime,
    setAutoCheckin,
    setStudentSelfCheckin,
    setAllowCheckinRoles,
    setLevel,
    setCustomLevels,
    setDescription,
    setBackgroundImage,
    setHomeImage,
    setTeacherId,
    setAssistantId,
    setStudentIds,
    setHoursPerLesson,
    setFeePerLesson,
    setStudentList,
    setSubjects,
    backgroundImage,
    homeImage,
  });

  // 弹窗关闭后恢复 ScrollView 滚动位置
  useEffect(() => {
    if (!picker.visible && !colorPickerVisible && !rolePickerVisible) {
      const timer = setTimeout(() => {
        setScrollTop(scrollTopRef.current);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [picker.visible, colorPickerVisible, rolePickerVisible]);

  useEffect(() => {
    const formKey = buildCourseFormDirtyKey({
      name,
      categoryId,
      duration,
      capacity,
      endClassEnabled,
      maxLessons,
      color,
      subjectId,
      ageGroup,
      customAgeGroups,
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
      customLevels,
      description,
      backgroundImage,
      homeImage,
      teacherId,
      assistantId,
      studentIds,
      hoursPerLesson,
      feePerLesson,
    });
    if (captureBaselineRef.current) {
      initialFormKeyRef.current = formKey;
      captureBaselineRef.current = false;
      applyLeaveGuard(false);
      return;
    }
    if (initialFormKeyRef.current == null) {
      initialFormKeyRef.current = formKey;
      return;
    }
    applyLeaveGuard(initialFormKeyRef.current !== formKey);
  }, [
    name,
    categoryId,
    duration,
    capacity,
    endClassEnabled,
    maxLessons,
    color,
    subjectId,
    ageGroup,
    customAgeGroups,
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
    customLevels,
    description,
    backgroundImage,
    homeImage,
    teacherId,
    assistantId,
    studentIds,
    hoursPerLesson,
    feePerLesson,
    applyLeaveGuard,
  ]);

  const handleScroll = useCallback((e: { detail: { scrollTop: number } }) => {
    scrollTopRef.current = e.detail.scrollTop;
  }, []);

  const {
    pickerConfig,
    openPicker,
    closePicker,
    openRolePicker,
    toggleRoleTemp,
    confirmRolePicker,
    handleCapacityInput,
    handleAddCustomOption,
    handleDeleteCustomOption,
    handleSubmit,
    handleDelete,
  } = useCourseFormActions({
    name,
    categoryId,
    category,
    duration,
    capacity,
    color,
    subjectId,
    subjects,
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
    backgroundImage,
    homeImage,
    teacherId,
    assistantId,
    studentIds,
    hoursPerLesson,
    feePerLesson,
    endClassEnabled,
    maxLessons,
    customAgeGroups,
    customLevels,
    isEdit,
    isClassMode,
    isClassEdit,
    courseId,
    formStorageScope,
    categories,
    teachers,
    picker,
    roleTemp,
    profile,
    create,
    update,
    remove,
    guardArmedRef,
    unloadedRef,
    setSaving,
    setDeleting,
    setErrors,
    setCategoryId,
    setSubjectId,
    setTeacherId,
    setAssistantId,
    setAgeGroup,
    setBookingDeadline,
    setCancelQueueTime,
    setNonCancelTime,
    setStudentSelfCheckin,
    setAutoCheckin,
    setLevel,
    setPicker,
    setRolePickerVisible,
    setRoleTemp,
    setAllowCheckinRoles,
    setCapacity,
    setCustomAgeGroups,
    setCustomLevels,
  });

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
    <PageContainer className="h-screen flex flex-col overflow-hidden">
      {/* 关键修复：scroll-view 在 flex 容器内必须同时声明 flex-1 + min-h-0 */}
      <ScrollView scrollY className="flex-1 min-h-0" scrollTop={scrollTop} onScroll={handleScroll}>
        <View className="px-[32rpx] py-[24rpx] pb-[180rpx] flex flex-col gap-[24rpx]">
          <CourseFormBasicPanel
            name={name}
            selectedCategory={selectedCategory}
            isClassMode={isClassMode}
            subjectId={subjectId}
            subjects={subjects}
            duration={duration}
            capacity={capacity}
            endClassEnabled={endClassEnabled}
            maxLessons={maxLessons}
            errors={errors}
            onNameInput={setName}
            onDurationInput={setDuration}
            onCapacityInput={handleCapacityInput}
            onMaxLessonsInput={setMaxLessons}
            onEndClassChange={(on) => {
              setEndClassEnabled(on);
              if (!on) setMaxLessons('');
            }}
            onOpenPicker={openPicker}
          />

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

          {advancedOpen && (
            <CourseFormAdvancedPanel
              isClassMode={isClassMode}
              isGroupMode={isGroupMode}
              teacherId={teacherId}
              assistantId={assistantId}
              teachers={teachers}
              hoursPerLesson={hoursPerLesson}
              feePerLesson={feePerLesson}
              color={color}
              ageGroup={ageGroup}
              level={level}
              studentIds={studentIds}
              selectedStudents={selectedStudents}
              studentList={studentList}
              subjectId={subjectId}
              subjects={subjects}
              capacity={capacity}
              experiencePrice={experiencePrice}
              price={price}
              minOpenCount={minOpenCount}
              bookingDeadline={bookingDeadline}
              cancelQueueTime={cancelQueueTime}
              nonCancelTime={nonCancelTime}
              autoCheckin={autoCheckin}
              studentSelfCheckin={studentSelfCheckin}
              allowCheckinRoles={allowCheckinRoles}
              description={description}
              backgroundImage={backgroundImage}
              homeImage={homeImage}
              errors={errors}
              scrollTopRef={scrollTopRef}
              onOpenPicker={openPicker}
              onOpenColorPicker={() => setColorPickerVisible(true)}
              onOpenRolePicker={openRolePicker}
              onHoursPerLessonInput={setHoursPerLesson}
              onFeePerLessonInput={setFeePerLesson}
              onExperiencePriceInput={setExperiencePrice}
              onPriceInput={setPrice}
              onMinOpenCountInput={setMinOpenCount}
              onDescriptionInput={setDescription}
              onHomeImageChange={setHomeImage}
              onStudentIdsChange={setStudentIds}
              onScrollRestore={(t) => setScrollTop(t)}
            />
          )}
        </View>
      </ScrollView>

      <CourseFormFooter
        isEdit={isEdit}
        saving={saving}
        deleting={deleting}
        onSubmit={() => void handleSubmit()}
        onDelete={() => void handleDelete()}
      />

      <CourseFormSheets
        pickerVisible={picker.visible}
        pickerType={picker.type}
        pickerTitle={pickerConfig.title}
        pickerOptions={pickerConfig.options}
        pickerValue={pickerConfig.value}
        customAgeGroups={customAgeGroups}
        customLevels={customLevels}
        onClosePicker={closePicker}
        onConfirmPicker={(value) => {
          pickerConfig.onConfirm(value);
          closePicker();
        }}
        onAddCustomOption={handleAddCustomOption}
        onDeleteCustomOption={handleDeleteCustomOption}
        colorPickerVisible={colorPickerVisible}
        color={color}
        onCloseColorPicker={() => setColorPickerVisible(false)}
        onSelectColor={(c) => {
          setColor(c);
          setColorPickerVisible(false);
        }}
        rolePickerVisible={rolePickerVisible}
        roleTemp={roleTemp}
        onCloseRolePicker={() => setRolePickerVisible(false)}
        onToggleRoleTemp={toggleRoleTemp}
        onConfirmRolePicker={confirmRolePicker}
      />
    </PageContainer>
  );
};

export default CourseFormPage;
