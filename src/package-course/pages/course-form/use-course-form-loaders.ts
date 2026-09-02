/**
 * 课程表单数据加载 / 回填（W2 拆页）
 */
import Taro, { useDidShow, useUnload } from '@tarojs/taro';
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { COURSE_COLOR_OPTIONS } from '@/constants/course-template-ui';
import { classService, subscribeMessageService } from '@/services';
import { subjectService } from '@/services/campus';
import { courseTemplateService } from '@/services/course-template';
import { useCourseCategoryStore } from '@/stores/course-category';
import type { Subject } from '@/types/campus';
import type { Class } from '@/types/class';
import type { CheckinRole, CourseTemplate } from '@/types/course-template';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import { CLASS_COLOR_TO_FORM_HEX } from './course-form-constants';
import { setLeaveGuard } from './course-form-leave-guard';
import { parseDurationMinutes } from './course-form-time';

export interface UseCourseFormLoadersParams {
  courseId: string;
  isEdit: boolean;
  isClassEdit: boolean;
  isClassMode: boolean;
  formStorageScope: string;
  routeCategoryId: string;
  profileId?: string;
  profileRole?: string;
  profileCampusId?: string;
  setLoading: (v: boolean) => void;
  fetchList: () => Promise<unknown>;
  fetchTeachers: () => void;
  fetchByTeacher: (teacherId: string) => Promise<Student[]>;
  defaultCategorySetRef: MutableRefObject<boolean>;
  captureBaselineRef: MutableRefObject<boolean>;
  unloadedRef: MutableRefObject<boolean>;
  setName: Dispatch<SetStateAction<string>>;
  setCategoryId: Dispatch<SetStateAction<string>>;
  setDuration: Dispatch<SetStateAction<string>>;
  setCapacity: Dispatch<SetStateAction<string>>;
  setEndClassEnabled: Dispatch<SetStateAction<boolean>>;
  setMaxLessons: Dispatch<SetStateAction<string>>;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setColor: Dispatch<SetStateAction<string>>;
  setSubjectId: Dispatch<SetStateAction<string>>;
  setAgeGroup: Dispatch<SetStateAction<string>>;
  setCustomAgeGroups: Dispatch<SetStateAction<string[]>>;
  setExperiencePrice: Dispatch<SetStateAction<string>>;
  setPrice: Dispatch<SetStateAction<string>>;
  setMinOpenCount: Dispatch<SetStateAction<string>>;
  setBookingDeadline: Dispatch<SetStateAction<string>>;
  setCancelQueueTime: Dispatch<SetStateAction<string>>;
  setNonCancelTime: Dispatch<SetStateAction<string>>;
  setAutoCheckin: Dispatch<SetStateAction<'follow_category' | 'allow' | 'forbid'>>;
  setStudentSelfCheckin: Dispatch<SetStateAction<'follow_category' | 'allow' | 'forbid'>>;
  setAllowCheckinRoles: Dispatch<SetStateAction<CheckinRole[]>>;
  setLevel: Dispatch<SetStateAction<string>>;
  setCustomLevels: Dispatch<SetStateAction<string[]>>;
  setDescription: Dispatch<SetStateAction<string>>;
  setBackgroundImage: Dispatch<SetStateAction<string>>;
  setHomeImage: Dispatch<SetStateAction<string>>;
  setTeacherId: Dispatch<SetStateAction<string>>;
  setAssistantId: Dispatch<SetStateAction<string>>;
  setStudentIds: Dispatch<SetStateAction<string[]>>;
  setHoursPerLesson: Dispatch<SetStateAction<string>>;
  setFeePerLesson: Dispatch<SetStateAction<string>>;
  setStudentList: Dispatch<SetStateAction<Student[]>>;
  setSubjects: Dispatch<SetStateAction<Subject[]>>;
  backgroundImage: string;
  homeImage: string;
}

export function useCourseFormLoaders(params: UseCourseFormLoadersParams): void {
  const {
    courseId,
    isEdit,
    isClassEdit,
    isClassMode,
    formStorageScope,
    routeCategoryId,
    profileId,
    profileRole,
    profileCampusId,
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
  } = params;

  /**
   * 班级模式回填：与新建班课共用同一套表单，能回填的字段从班级数据加载，其余留空由用户补全。
   */
  const fillClassForm = useCallback(
    (cls: Class, students: Student[]) => {
      setName(cls.name);
      setCategoryId(cls.category_id || '');
      setColor(CLASS_COLOR_TO_FORM_HEX[cls.color] || COURSE_COLOR_OPTIONS[0]);
      setSubjectId(cls.subject_id || '');
      setTeacherId(cls.teachers?.[0] || cls.teacher_id || '');
      setAssistantId(cls.teachers?.[1] || '');
      setStudentIds(students.map((s) => s.id));
      setHoursPerLesson(String(cls.hours_per_lesson ?? 1));
      setFeePerLesson(
        cls.pricePerLesson !== undefined && cls.pricePerLesson !== null
          ? String(cls.pricePerLesson)
          : '',
      );
      const durationFromTime = parseDurationMinutes(cls.start_time, cls.end_time);
      setDuration(durationFromTime || '60');
      setCapacity(cls.capacity && cls.capacity > 0 ? String(cls.capacity) : '');
      const limited = cls.type === 'limited';
      setEndClassEnabled(limited);
      setMaxLessons(limited && cls.total_lessons ? String(cls.total_lessons) : '');
      setAgeGroup('mix');
      setCustomAgeGroups([]);
      setLevel(cls.level || 'all');
      setCustomLevels([]);
      setExperiencePrice('');
      setPrice('');
      setMinOpenCount(cls.min_open_count ? String(cls.min_open_count) : '');
      setBookingDeadline('60');
      setCancelQueueTime('60');
      setNonCancelTime('120');
      setAutoCheckin('follow_category');
      setStudentSelfCheckin('follow_category');
      setAllowCheckinRoles(['teacher', 'receptionist']);
      setDescription(cls.note || '');
      setBackgroundImage(cls.backgroundImage || '');
      setHomeImage(cls.homeImage || '');
      captureBaselineRef.current = true;
    },
    [
      captureBaselineRef,
      setName,
      setCategoryId,
      setColor,
      setSubjectId,
      setTeacherId,
      setAssistantId,
      setStudentIds,
      setHoursPerLesson,
      setFeePerLesson,
      setDuration,
      setCapacity,
      setEndClassEnabled,
      setMaxLessons,
      setAgeGroup,
      setCustomAgeGroups,
      setLevel,
      setCustomLevels,
      setExperiencePrice,
      setPrice,
      setMinOpenCount,
      setBookingDeadline,
      setCancelQueueTime,
      setNonCancelTime,
      setAutoCheckin,
      setStudentSelfCheckin,
      setAllowCheckinRoles,
      setDescription,
      setBackgroundImage,
      setHomeImage,
    ],
  );

  const fillForm = useCallback(
    (data: CourseTemplate) => {
      setName(data.name);
      setCategoryId(data.categoryId);
      setDuration(String(data.duration));
      // 后端用 0 表示「不限制人数」，编辑回填时 UI 保持留空。
      setCapacity(data.capacity > 0 ? String(data.capacity) : '');
      setColor(data.color || COURSE_COLOR_OPTIONS[0]);
      setSubjectId(data.subjectId || '');
      // 恢复自定义年龄组/课程难度（编辑时从持久化数据重建）
      if (data.customAgeGroup) {
        setCustomAgeGroups([data.customAgeGroup]);
        setAgeGroup(`custom:${data.customAgeGroup}`);
      } else {
        setCustomAgeGroups([]);
        setAgeGroup(data.ageGroup || 'mix');
      }
      if (data.customLevel) {
        setCustomLevels([data.customLevel]);
        setLevel(`custom:${data.customLevel}`);
      } else {
        setCustomLevels([]);
        setLevel(data.level || 'all');
      }
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
      setDescription(data.description || '');
      setBackgroundImage(data.backgroundImage || '');
      setHomeImage(data.homeImage || '');
      setTeacherId(data.teacherId || '');
      setAssistantId(data.assistantId || '');
      setStudentIds(data.studentIds || []);
      // 回填完成：指示后续 dirty-effect 用当前（已回填）state 重新抓基线
      captureBaselineRef.current = true;
    },
    [
      captureBaselineRef,
      setName,
      setCategoryId,
      setDuration,
      setCapacity,
      setColor,
      setSubjectId,
      setCustomAgeGroups,
      setAgeGroup,
      setCustomLevels,
      setLevel,
      setExperiencePrice,
      setPrice,
      setMinOpenCount,
      setBookingDeadline,
      setCancelQueueTime,
      setNonCancelTime,
      setAutoCheckin,
      setStudentSelfCheckin,
      setAllowCheckinRoles,
      setDescription,
      setBackgroundImage,
      setHomeImage,
      setTeacherId,
      setAssistantId,
      setStudentIds,
    ],
  );

  // 应对安卓 wx.cropImage 完成后 webview 重载导致 state 丢失：
  // 选择/裁剪结果立刻落 storage，新实例 mount 时优先从 storage 恢复图片并跳过骨架屏。
  useEffect(() => {
    try {
      Taro.setStorageSync(`course-form-img-bg-${formStorageScope}`, backgroundImage || '');
      Taro.setStorageSync(`course-form-img-home-${formStorageScope}`, homeImage || '');
    } catch {
      /* 静默 */
    }
  }, [backgroundImage, homeImage, formStorageScope]);

  // E02-D：入班后 5 分钟内进入班级页，补充上课提醒次数
  useDidShow(() => {
    if (!isClassEdit || !courseId) return;
    void subscribeMessageService.maybeRunClassViewRenew(courseId, {
      role: profileRole,
      campusId: profileCampusId,
    });
  });

  // 加载分类列表，编辑时加载课程详情
  useEffect(() => {
    // 安卓部分机型 wx.cropImage 完成后会触发 webview 重载，导致组件重新挂载、
    // loading 回到初始值、骨架屏覆盖整个页面，同时刚裁剪的图片 state 也丢失。
    // 修复：先尝试从 storage 恢复持久化的图片；若已标记「已加载完成」则不再走骨架屏/接口。
    let persistedLoaded = false;
    try {
      persistedLoaded = Taro.getStorageSync(`course-form-loaded-${formStorageScope}`) === true;
      const persistedBg = Taro.getStorageSync(`course-form-img-bg-${formStorageScope}`);
      const persistedHome = Taro.getStorageSync(`course-form-img-home-${formStorageScope}`);
      if (typeof persistedBg === 'string') setBackgroundImage(persistedBg);
      if (typeof persistedHome === 'string') setHomeImage(persistedHome);
    } catch {
      /* 静默 */
    }
    if (persistedLoaded && isEdit) {
      // 已加载过课程详情（webview 重载场景），直接跳过骨架屏与接口请求
      setLoading(false);
      return;
    }

    void fetchList().then(() => {
      if (!isEdit && !defaultCategorySetRef.current) {
        // 新增时默认选中路由/当前激活分类，没有则选第一个；
        // 直接从 store 取最新列表，避免闭包拿到旧 categories
        const state = useCourseCategoryStore.getState();
        const defaultId =
          routeCategoryId || state.activeCategoryId || state.categories[0]?.id || '';
        if (defaultId) {
          setCategoryId(defaultId);
          defaultCategorySetRef.current = true;
          // 自动选中默认分类是系统行为，不应算作用户改动；
          // 置位后让 dirty 检测 effect 用当前 state 重新抓基线，避免误触离开确认。
          captureBaselineRef.current = true;
        }
      }
    });

    if (!isEdit) {
      return;
    }
    Taro.setNavigationBarTitle({ title: isClassEdit ? '编辑班级' : '编辑课程' });
    // setLoading(true) 由 useDelayedLoading 延迟处理：请求在阈值内完成则
    // 完全不显示骨架屏，仅网络差/加载过慢时才让用户看到加载占位。
    setLoading(true);
    if (isClassEdit) {
      // 班级模式：加载班级数据填充表单（编辑入口统一）
      Promise.all([classService.getById(courseId), classService.getStudents(courseId)])
        .then(([cls, students]) => {
          if (cls) fillClassForm(cls, students);
          try {
            Taro.setStorageSync(`course-form-loaded-${formStorageScope}`, true);
          } catch {
            /* 静默 */
          }
        })
        .finally(() => setLoading(false));
      return;
    }
    courseTemplateService
      .getById(courseId)
      .then((data) => {
        if (data) {
          fillForm(data);
        }
        // 标记当前课程详情已加载，供 webview 重载场景跳过骨架屏
        try {
          Taro.setStorageSync(`course-form-loaded-${formStorageScope}`, true);
        } catch {
          /* 静默 */
        }
      })
      .finally(() => setLoading(false));
  }, [
    courseId,
    isEdit,
    isClassEdit,
    fetchList,
    formStorageScope,
    fillClassForm,
    fillForm,
    routeCategoryId,
    setLoading,
    defaultCategorySetRef,
    captureBaselineRef,
    setBackgroundImage,
    setHomeImage,
    setCategoryId,
  ]);

  // 班课模式：高级设置默认展开（新建与编辑保持一致；团课/私教保持收起）
  useEffect(() => {
    if (isClassMode) {
      setAdvancedOpen(true);
    }
  }, [isClassMode, setAdvancedOpen]);

  // 新增页导航标题随模式切换
  useEffect(() => {
    if (isEdit) {
      return;
    }
    Taro.setNavigationBarTitle({ title: isClassMode ? '新增班级' : '新增课程' });
  }, [isClassMode, isEdit]);

  // 加载科目列表和教师列表
  useEffect(() => {
    subjectService
      .getList()
      .then(setSubjects)
      .catch((err) => {
        logError('course-form load subjects', err);
        setSubjects([]); // 空态兜底，避免选择器渲染失败
        Taro.showToast({ title: '科目列表加载失败', icon: 'none' });
      });
    fetchTeachers();
  }, [fetchTeachers, setSubjects]);

  // 班课模式：加载学员列表（依赖当前教师身份）
  useEffect(() => {
    if (!isClassMode || !profileId) return;
    fetchByTeacher(profileId)
      .then(setStudentList)
      .catch((err) => {
        // 次要数据：加载失败静默置空，不打断表单填写
        logError('course-form load students', err);
        setStudentList([]);
      });
  }, [isClassMode, profileId, fetchByTeacher, setStudentList]);

  // 页面销毁（返回 / 切走销毁）时清理离开确认；临时图片清理策略见原注释。
  useUnload(() => {
    // 标记页面已销毁，让保存/删除成功后的延时 navigateBack 不再触发，
    // 避免用户在 toast 展示期间手动返回导致「连退两层」。
    unloadedRef.current = true;
    // 注意：此处不再 deleteTempImage。原因：安卓部分机型 wx.cropImage 完成后
    // 会让页面 webview 重载（卸载再挂载），此时 useUnload 会先于新实例触发，
    // 若在此删除 backgroundImage/homeImage，新实例挂载后图片文件已不存在、
    // 预览/上传都会失败。改为在「选择新图覆盖旧图」时（handleChoose 内）
    // 以及「保存成功后旧图失去引用」时清理，避免无限累积。
    setLeaveGuard(false);
  });
}
