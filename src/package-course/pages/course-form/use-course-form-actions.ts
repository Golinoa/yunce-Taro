/**
 * 课程表单保存 / 删除 / 分类切换 / 选择器动作（W2 拆页）
 */
import Taro from '@tarojs/taro';
import {
  useCallback,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { PickerOption } from '@/components/PickerSheet';
import {
  AGE_GROUP_OPTIONS,
  DEADLINE_OPTIONS,
  STUDENT_SELF_CHECKIN_OPTIONS,
} from '@/constants/course-template-ui';
import { classService, subscribeMessageService } from '@/services';
import { useCourseCategoryStore } from '@/stores/course-category';
import type { Subject } from '@/types/campus';
import { CLASS_LEVEL_LABELS, type Class } from '@/types/class';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { CheckinRole, CourseCategory } from '@/types/course-template';
import type { TeacherUIModel } from '@/types/teacher';
import { uploadImage } from '@/utils/image-upload';
import { logError } from '@/utils/logger';
import { COURSE_MODE_LABELS, type FormErrors, type PickerType } from './course-form-constants';
import { setLeaveGuard } from './course-form-leave-guard';
import {
  buildClassSavePayload,
  buildTemplateFormData,
  getCategoryModeSwitchLosingFields,
} from './course-form-submit';
import { validateCourseForm } from './course-form-validate';

export interface UseCourseFormActionsParams {
  name: string;
  categoryId: string;
  category: CourseCategory;
  duration: string;
  capacity: string;
  color: string;
  subjectId: string;
  subjects: Subject[];
  ageGroup: string;
  experiencePrice: string;
  price: string;
  minOpenCount: string;
  bookingDeadline: string;
  cancelQueueTime: string;
  nonCancelTime: string;
  autoCheckin: 'follow_category' | 'allow' | 'forbid';
  studentSelfCheckin: 'follow_category' | 'allow' | 'forbid';
  allowCheckinRoles: CheckinRole[];
  level: string;
  description: string;
  backgroundImage: string;
  homeImage: string;
  teacherId: string;
  assistantId: string;
  studentIds: string[];
  hoursPerLesson: string;
  feePerLesson: string;
  endClassEnabled: boolean;
  maxLessons: string;
  customAgeGroups: string[];
  customLevels: string[];
  isEdit: boolean;
  isClassMode: boolean;
  isClassEdit: boolean;
  courseId: string;
  formStorageScope: string;
  categories: CourseCategoryConfig[];
  teachers: TeacherUIModel[];
  picker: { visible: boolean; type: PickerType };
  roleTemp: CheckinRole[];
  profile?: {
    id?: string;
    currentContext?: { role?: string; campusId?: string } | null;
  } | null;
  create: (data: ReturnType<typeof buildTemplateFormData>) => Promise<unknown>;
  update: (id: string, data: ReturnType<typeof buildTemplateFormData>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  guardArmedRef: MutableRefObject<boolean>;
  unloadedRef: MutableRefObject<boolean>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setDeleting: Dispatch<SetStateAction<boolean>>;
  setErrors: Dispatch<SetStateAction<FormErrors>>;
  setCategoryId: Dispatch<SetStateAction<string>>;
  setSubjectId: Dispatch<SetStateAction<string>>;
  setTeacherId: Dispatch<SetStateAction<string>>;
  setAssistantId: Dispatch<SetStateAction<string>>;
  setAgeGroup: Dispatch<SetStateAction<string>>;
  setBookingDeadline: Dispatch<SetStateAction<string>>;
  setCancelQueueTime: Dispatch<SetStateAction<string>>;
  setNonCancelTime: Dispatch<SetStateAction<string>>;
  setStudentSelfCheckin: Dispatch<SetStateAction<'follow_category' | 'allow' | 'forbid'>>;
  setAutoCheckin: Dispatch<SetStateAction<'follow_category' | 'allow' | 'forbid'>>;
  setLevel: Dispatch<SetStateAction<string>>;
  setPicker: Dispatch<SetStateAction<{ visible: boolean; type: PickerType }>>;
  setRolePickerVisible: Dispatch<SetStateAction<boolean>>;
  setRoleTemp: Dispatch<SetStateAction<CheckinRole[]>>;
  setAllowCheckinRoles: Dispatch<SetStateAction<CheckinRole[]>>;
  setCapacity: Dispatch<SetStateAction<string>>;
  setCustomAgeGroups: Dispatch<SetStateAction<string[]>>;
  setCustomLevels: Dispatch<SetStateAction<string[]>>;
}

export function useCourseFormActions(params: UseCourseFormActionsParams) {
  const {
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
  } = params;

  /**
   * 切换所属分类：若导致课程模式变化、且另一模式已有已填数据，先弹窗确认。
   * 切换不清空任何字段（切回还能继续编辑，对「好奇点一下」零成本），
   * 仅在保存时按当前模式剥离非本模式字段，防止跨模式脏数据污染提交表单。
   */
  const handleCategoryConfirm = useCallback(
    async (nextId: string) => {
      if (nextId === categoryId) return;
      const nextMode =
        useCourseCategoryStore.getState().categories.find((c) => c.id === nextId)?.mode ?? 'class';
      if (nextMode === category) {
        setCategoryId(nextId);
        return;
      }
      const losing = getCategoryModeSwitchLosingFields({
        isClassMode,
        teacherId,
        assistantId,
        studentIds,
        experiencePrice,
        price,
        minOpenCount,
      });
      if (losing.length === 0) {
        setCategoryId(nextId);
        return;
      }
      const { confirm } = await Taro.showModal({
        title: '切换课程模式',
        content: `该分类为「${COURSE_MODE_LABELS[nextMode] ?? nextMode}」模式，保存时将忽略已填写的${losing.join('、')}（切回后仍可继续编辑）。确定切换吗？`,
        confirmText: '切换',
        cancelText: '再想想',
      });
      if (!confirm) return;
      setCategoryId(nextId);
    },
    [
      categoryId,
      category,
      isClassMode,
      teacherId,
      assistantId,
      studentIds,
      experiencePrice,
      price,
      minOpenCount,
      setCategoryId,
    ],
  );

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
          onConfirm: handleCategoryConfirm,
        };
      case 'subject':
        return {
          title: '所属科目',
          options: subjects.map((s) => ({ label: s.name, value: s.id })),
          value: subjectId,
          onConfirm: (value: string) => setSubjectId(value),
        };
      case 'teacher':
        return {
          title: '授课老师',
          options: teachers.map((t) => ({ label: t.name, value: t.id })),
          value: teacherId,
          onConfirm: (value: string) => setTeacherId(value),
        };
      case 'assistant':
        return {
          title: '助教',
          options: teachers.map((t) => ({ label: t.name, value: t.id })),
          value: assistantId,
          onConfirm: (value: string) => setAssistantId(value),
        };
      case 'ageGroup':
        return {
          title: '年龄组',
          options: [
            ...AGE_GROUP_OPTIONS,
            ...customAgeGroups.map((label) => ({ label, value: `custom:${label}` })),
          ],
          value: ageGroup,
          onConfirm: (value: string) => setAgeGroup(value),
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
          options: [
            ...Object.entries(CLASS_LEVEL_LABELS).map(([value, label]) => ({ label, value })),
            ...customLevels.map((label) => ({ label, value: `custom:${label}` })),
          ],
          value: level,
          onConfirm: (value: string) => setLevel(value),
        };
      default:
        return { title: '', options: [], value: '', onConfirm: () => {} };
    }
  }, [
    picker.type,
    categories,
    categoryId,
    subjectId,
    subjects,
    teachers,
    teacherId,
    assistantId,
    ageGroup,
    bookingDeadline,
    cancelQueueTime,
    nonCancelTime,
    studentSelfCheckin,
    autoCheckin,
    level,
    customAgeGroups,
    customLevels,
    handleCategoryConfirm,
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
  ]);

  const openPicker = useCallback(
    (type: PickerType) => {
      setPicker({ visible: true, type });
    },
    [setPicker],
  );

  const closePicker = useCallback(() => {
    setPicker((prev) => ({ ...prev, visible: false }));
  }, [setPicker]);

  const openRolePicker = useCallback(() => {
    setRoleTemp([...allowCheckinRoles]);
    setRolePickerVisible(true);
  }, [allowCheckinRoles, setRoleTemp, setRolePickerVisible]);

  const toggleRoleTemp = useCallback(
    (role: CheckinRole) => {
      setRoleTemp((prev) =>
        prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
      );
    },
    [setRoleTemp],
  );

  const confirmRolePicker = useCallback(() => {
    setAllowCheckinRoles(roleTemp);
    setRolePickerVisible(false);
  }, [roleTemp, setAllowCheckinRoles, setRolePickerVisible]);

  const handleCapacityInput = useCallback(
    (e: { detail: { value: string } }) => {
      setCapacity(e.detail.value);
    },
    [setCapacity],
  );

  const handleAddCustomOption = useCallback(
    (label: string) => {
      if (picker.type === 'ageGroup') {
        setCustomAgeGroups((prev) => (prev.includes(label) ? prev : [...prev, label]));
        setAgeGroup(`custom:${label}`);
      } else if (picker.type === 'level') {
        setCustomLevels((prev) => (prev.includes(label) ? prev : [...prev, label]));
        setLevel(`custom:${label}`);
      }
    },
    [picker.type, setCustomAgeGroups, setAgeGroup, setCustomLevels, setLevel],
  );

  const handleDeleteCustomOption = useCallback(
    (value: string) => {
      const label = value.startsWith('custom:') ? value.slice('custom:'.length) : value;
      if (picker.type === 'ageGroup') {
        setCustomAgeGroups((prev) => prev.filter((l) => l !== label));
        if (ageGroup === value) setAgeGroup('mix');
      } else if (picker.type === 'level') {
        setCustomLevels((prev) => prev.filter((l) => l !== label));
        if (level === value) setLevel('all');
      }
    },
    [picker.type, ageGroup, level, setCustomAgeGroups, setAgeGroup, setCustomLevels, setLevel],
  );

  /** 校验表单，返回错误对象（空对象表示通过）。setErrors 用于 UI 标红。 */
  const validate = useCallback((): FormErrors => {
    const nextErrors = validateCourseForm({
      name,
      categoryId,
      subjectId,
      duration,
      capacity,
      endClassEnabled,
      maxLessons,
      isClassMode,
      experiencePrice,
      price,
    });
    setErrors(nextErrors);
    return nextErrors;
  }, [
    name,
    categoryId,
    subjectId,
    duration,
    capacity,
    endClassEnabled,
    maxLessons,
    isClassMode,
    experiencePrice,
    price,
    setErrors,
  ]);

  const handleSubmit = useCallback(async () => {
    const errorsResult = validate();
    if (Object.keys(errorsResult).length > 0) {
      // 校验失败：弹窗列出具体缺漏项，引导用户补全（替代原先一闪而过的 toast）
      void Taro.showModal({
        title: '表单未填写完整',
        content: `请补全以下内容后再次保存：\n${Object.values(errorsResult).join('、')}`,
        showCancel: false,
        confirmText: '去修改',
      });
      return;
    }
    // 班课模式才校验学员数 vs 容纳人数；团课/私教无预选学员，不触发此约束
    const capacityNum = Number(capacity);
    if (isClassMode && capacityNum > 0 && studentIds.length > capacityNum) {
      await Taro.showModal({
        title: '人数超限',
        content: `该课程最多容纳 ${capacityNum} 人，当前已选 ${studentIds.length} 人，请调整学员或修改容纳人数。`,
        showCancel: false,
        confirmText: '去调整',
      });
      return;
    }
    setSaving(true);

    // 保存前先把本地图片（裁剪后的稳定本地路径）上传到七牛，拿到可访问 URL 再提交。
    // 远程 URL（编辑时已存在的线上地址）会被 uploadImage 原样透传，不会重复上传。
    let backgroundImageUrl: string | undefined;
    let homeImageUrl: string | undefined;
    try {
      [backgroundImageUrl, homeImageUrl] = await Promise.all([
        backgroundImage
          ? uploadImage(backgroundImage, 'course', { refId: courseId || undefined })
          : Promise.resolve(undefined),
        homeImage
          ? uploadImage(homeImage, 'course', { refId: courseId || undefined })
          : Promise.resolve(undefined),
      ]);
    } catch {
      Taro.showToast({ title: '图片上传失败，请重试', icon: 'none' });
      setSaving(false);
      return;
    }

    const formData = buildTemplateFormData({
      name,
      categoryId,
      category,
      duration,
      capacity,
      color,
      subjectId,
      subjectName: subjectId ? subjects.find((s) => s.id === subjectId)?.name : undefined,
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
      backgroundImageUrl,
      homeImageUrl,
      isClassMode,
      teacherId,
      teacherName:
        isClassMode && teacherId ? teachers.find((t) => t.id === teacherId)?.name : undefined,
      assistantId,
      assistantName:
        isClassMode && assistantId ? teachers.find((t) => t.id === assistantId)?.name : undefined,
      studentIds,
    });

    try {
      if (isClassEdit || (!isEdit && isClassMode)) {
        const classPayload = buildClassSavePayload({
          name,
          color,
          teacherId,
          assistantId,
          categoryId,
          subjectId,
          level,
          description,
          minOpenCount,
          hoursPerLesson,
          feePerLesson,
          endClassEnabled,
          maxLessons,
          capacity,
          duration,
          studentIds,
          campusId: profile?.currentContext?.campusId,
          homeImageUrl: homeImageUrl ?? null,
          backgroundImageUrl: backgroundImageUrl ?? null,
        });

        if (isClassEdit) {
          const currentStudents = await classService.getStudents(courseId);
          const currentIds = currentStudents.map((s) => s.id);
          const toAdd = studentIds.filter((id) => !currentIds.includes(id));
          const toRemove = currentIds.filter((id) => !studentIds.includes(id));
          // 编辑不写入 used_lessons，避免把已上课时清零
          await classService.update(courseId, classPayload);
          for (const sid of toAdd) await classService.addStudents(courseId, [sid]);
          for (const sid of toRemove) await classService.removeStudent(courseId, sid);
          Taro.showToast({ title: '保存成功', icon: 'success' });
          if (toAdd.length > 0) {
            try {
              Taro.hideToast();
              await subscribeMessageService.runFlow('E02A', {
                classId: courseId,
                className: name.trim(),
                role: profile?.currentContext?.role,
                navigateUrl: `/package-course/pages/course-form/index?id=${encodeURIComponent(courseId)}&type=class`,
              });
            } catch (error) {
              logError('subscribe E02A after class assign', error);
            }
          }
        } else {
          const leadTeacherId = teacherId || profile?.id || '';
          const created = await classService.create({
            ...(classPayload as Omit<Class, 'id' | 'created_at' | 'updated_at'>),
            teacher_id: leadTeacherId,
            teachers: [leadTeacherId, assistantId].filter(Boolean),
            used_lessons: 0,
            student_count: studentIds.length,
          });
          if (created?.id && studentIds.length > 0) {
            await classService.addStudents(created.id, studentIds);
          }
          Taro.showToast({ title: '新增成功', icon: 'success' });
          try {
            Taro.hideToast();
            await subscribeMessageService.runFlow('E06', {
              className: name.trim(),
              role: profile?.currentContext?.role,
            });
          } catch (error) {
            logError('subscribe E06 after class create', error);
          }
        }
      } else if (isEdit) {
        await update(courseId, formData);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await create(formData);
        Taro.showToast({ title: '新增成功', icon: 'success' });
      }
      // 保存成功后关闭离开确认，避免返回时再弹「未保存」误扰
      setLeaveGuard(false);
      guardArmedRef.current = false;
      // 清理本次会话的持久化标记，避免影响下次编辑同一课程时的状态判断
      try {
        Taro.removeStorageSync(`course-form-loaded-${formStorageScope}`);
        Taro.removeStorageSync(`course-form-img-bg-${formStorageScope}`);
        Taro.removeStorageSync(`course-form-img-home-${formStorageScope}`);
      } catch {
        /* 静默 */
      }
      // 延时返回让「保存成功」toast 可见；若期间用户已手动返回（页面已销毁）则跳过，
      // 避免在上一页再触发一次 navigateBack 造成「连退两层」。
      setTimeout(() => {
        if (!unloadedRef.current) Taro.navigateBack();
      }, 800);
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
    isEdit,
    courseId,
    create,
    update,
    backgroundImage,
    homeImage,
    teachers,
    teacherId,
    assistantId,
    studentIds,
    hoursPerLesson,
    feePerLesson,
    isClassMode,
    isClassEdit,
    endClassEnabled,
    maxLessons,
    formStorageScope,
    profile?.currentContext?.role,
    profile?.currentContext?.campusId,
    profile?.id,
    guardArmedRef,
    unloadedRef,
    setSaving,
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
      // 班级模式删除班级，模板模式删除课程模板（用户口径 2026-08-23：编辑统一走本页）
      if (isClassEdit) {
        await classService.remove(courseId);
      } else {
        await remove(courseId);
      }
      Taro.showToast({ title: '已删除', icon: 'success' });
      setLeaveGuard(false);
      guardArmedRef.current = false;
      setTimeout(() => {
        if (!unloadedRef.current) Taro.navigateBack();
      }, 800);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [courseId, name, remove, isClassEdit, guardArmedRef, unloadedRef, setDeleting]);

  return {
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
  };
}
