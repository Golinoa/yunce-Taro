/**
 * 新增 / 编辑课程表单页
 *
 * 用于创建或编辑课程模板，支持基础信息和高级设置。
 * 所有字段采用左标签右输入/值的行内布局。
 */
import { ScrollView, View, Text } from '@tarojs/components';
import Taro, { useUnload, useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import ClassStudentsCard from '@/components/course/ClassStudentsCard';
import CourseImageUploader from '@/components/CourseImageUploader';
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
} from '@/data/course-template';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { classService, subscribeMessageService } from '@/services';
import { subjectService } from '@/services/campus';
import { courseTemplateService } from '@/services/course-template';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useCourseTemplateStore } from '@/stores/course-template';
import { useStudentStore } from '@/stores/student';
import { useTeacherStore } from '@/stores/teacher';
import type { Subject } from '@/types/campus';
import { CLASS_LEVEL_LABELS } from '@/types/class';
import type { Class, ClassLevel } from '@/types/class';
import type { CourseCategoryConfig } from '@/types/course-category';
import type {
  CheckinRole,
  CourseCategory,
  CourseTemplate,
  CourseTemplateFormData,
} from '@/types/course-template';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { uploadImage } from '@/utils/image-upload';
import { logError } from '@/utils/logger';

/** 班级色 key → 课程模板色值（统一色板 classColorHex，班级模式回填用） */
const CLASS_COLOR_TO_FORM_HEX: Record<string, string> = {
  primary: '#5EC8A8',
  red: '#E57373',
  amber: '#D4A24E',
  purple: '#9B7ED8',
  info: '#6BA3D6',
  teal: '#4FC3B7',
};

/** 课程模板色值 → 班级色 key（班级模式保存回班级用） */
const FORM_HEX_TO_CLASS_COLOR: Record<string, string> = {
  '#5EC8A8': 'primary',
  '#E57373': 'red',
  '#D4A24E': 'amber',
  '#9B7ED8': 'purple',
  '#6BA3D6': 'info',
  '#4FC3B7': 'teal',
};

/** 表单字段错误 */
interface FormErrors {
  name?: string;
  categoryId?: string;
  subjectId?: string;
  duration?: string;
  capacity?: string;
  experiencePrice?: string;
  price?: string;
}

/** 从 HH:mm 起止时间推算课程时长（分钟） */
function parseDurationMinutes(start?: string, end?: string): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map((v) => Number(v) || 0);
  const [eh, em] = end.split(':').map((v) => Number(v) || 0);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? String(minutes) : '';
}

type PickerType =
  | 'category'
  | 'subject'
  | 'teacher'
  | 'assistant'
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

/** 课程模式展示名（class=班课 / group=团课 / private=私教） */
const COURSE_MODE_LABELS: Record<string, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
};

/**
 * 表单「未保存离开确认」开关：基于微信 wx.enableAlertBeforeUnload（基础库 2.12.0+）。
 * 开启后，用户点左上角返回或触发 navigateBack 时，系统会弹「是否离开」确认框；
 * 关闭则直接退出。能力不可用（如开发者工具模拟器）时静默降级，不影响退出。
 */
function setLeaveGuard(enabled: boolean): void {
  const wxObj = (globalThis as { wx?: Record<string, unknown> }).wx;
  if (!wxObj) return;
  try {
    if (enabled && typeof wxObj.enableAlertBeforeUnload === 'function') {
      (wxObj.enableAlertBeforeUnload as (opt: { message: string }) => void)({
        message: '有未保存的修改，退出将丢失',
      });
    } else if (!enabled && typeof wxObj.disableAlertBeforeUnload === 'function') {
      (wxObj.disableAlertBeforeUnload as () => void)();
    }
  } catch {
    /* 静默 */
  }
}

/**
 * 分组小标题：主题色竖线 + 文字（语义：分组类型，颜色随主题切换而变化）
 * 同一文件内复用 6 次，避免重复 JSX
 */

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <View className="flex flex-row items-center gap-[12rpx] pb-[24rpx]">
    <View className="w-[6rpx] h-[28rpx] rounded-[4rpx] bg-warning" />
    <Text className="text-[28rpx] font-semibold text-foreground">{title}</Text>
  </View>
);

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

  // 应对安卓 wx.cropImage 完成后 webview 重载导致 state 丢失：
  // 选择/裁剪结果立刻落 storage，新实例 mount 时优先从 storage 恢复图片并跳过骨架屏。
  const formStorageScope = courseId || '__new__';
  useEffect(() => {
    try {
      Taro.setStorageSync(`course-form-img-bg-${formStorageScope}`, backgroundImage || '');
      Taro.setStorageSync(`course-form-img-home-${formStorageScope}`, homeImage || '');
    } catch {
      /* 静默 */
    }
  }, [backgroundImage, homeImage, formStorageScope]);

  // 自定义年龄组 / 自定义课程难度（picker 内新增）
  const [customAgeGroups, setCustomAgeGroups] = useState<string[]>([]);

  // 班课模式字段
  const [teacherId, setTeacherId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  /** 班课：单次默认消耗课时 */
  const [hoursPerLesson, setHoursPerLesson] = useState('1');
  /** 班课：单次授课扣费（元） */
  const [feePerLesson, setFeePerLesson] = useState('');
  // 班课学员列表
  const [studentList, setStudentList] = useState<Student[]>([]);

  // 科目列表（从科目管理数据源获取）
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // 记录是否已设置过默认分类，避免 categories 刷新后覆盖用户手动选择
  const defaultCategorySetRef = React.useRef(false);

  // 根据选择的 categoryId 推导分类对象和课程模式
  const selectedCategory = useMemo<CourseCategoryConfig | undefined>(
    () => categories.find((item) => item.id === categoryId),
    [categories, categoryId],
  );
  const category = useMemo<CourseCategory>(
    // 班级模式：统一按班课模式渲染（名称/分类/颜色/老师/学员），不展示模板专属字段
    () => (isClassEdit ? 'class' : (selectedCategory?.mode ?? 'class')),
    [selectedCategory, isClassEdit],
  );

  /** 已选上课学员（从学员列表中按 id 匹配，用于独立卡片展示） */
  const selectedStudents = useMemo<Student[]>(
    () =>
      studentIds
        .map((id) => studentList.find((s) => s.id === id))
        .filter((s): s is Student => Boolean(s)),
    [studentIds, studentList],
  );

  /** 班课模式：隐藏开课与价格/预约规则/签到规则，改为班课信息区块 */
  const isClassMode = category === 'class';

  // E02-D：入班后 5 分钟内进入班级页，补充上课提醒次数
  useDidShow(() => {
    if (!isClassEdit || !courseId) return;
    void subscribeMessageService.maybeRunClassViewRenew(courseId, {
      role: profile?.currentContext?.role,
      campusId: profile?.currentContext?.campusId,
    });
  });

  // 加载状态：使用延迟显示 Hook，仅当请求超过阈值未完成时才显示骨架屏，
  // 避免每次进页面都闪一下加载占位（mock/缓存数据通常很快返回）。
  const { loading, setLoading } = useDelayedLoading();
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

  // 页面滚动位置保护：BottomSheet 等 fixed 弹窗关闭后，微信会重置 ScrollView 滚动位置，
  // 记录当前 scrollTop 并在弹窗关闭后恢复，避免用户被强制拉回顶部。
  const [scrollTop, setScrollTop] = useState(0);
  const scrollTopRef = useRef(0);

  /**
   * 班级模式回填：与新建班课共用同一套表单，能回填的字段从班级数据加载，其余留空由用户补全。
   */
  const fillClassForm = useCallback((cls: Class, students: Student[]) => {
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
    setDuration(parseDurationMinutes(cls.start_time, cls.end_time));
    setCapacity('');
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
    setBackgroundImage('');
    setHomeImage('');
    captureBaselineRef.current = true;
  }, []);

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
  }, [courseId, isEdit, isClassEdit, fetchList, formStorageScope, fillClassForm, routeCategoryId, setLoading]);

  // 班课模式：高级设置默认展开（新建与编辑保持一致；团课/私教保持收起）
  useEffect(() => {
    if (isClassMode) {
      setAdvancedOpen(true);
    }
  }, [isClassMode]);

  // 新增页导航标题随模式切换
  useEffect(() => {
    if (isEdit) {
      return;
    }
    Taro.setNavigationBarTitle({ title: isClassMode ? '新增班级' : '新增课程' });
  }, [isClassMode, isEdit]);

  // 加载科目列表和教师列表
  useEffect(() => {
    subjectService.getList().then(setSubjects);
    fetchTeachers();
  }, [fetchTeachers]);

  // 班课模式：加载学员列表（依赖当前教师身份）
  useEffect(() => {
    if (!isClassMode || !profile?.id) return;
    fetchByTeacher(profile.id).then(setStudentList);
  }, [isClassMode, profile?.id, fetchByTeacher]);

  // 容纳人数不再按分类自动填充默认值，保持留空即「不限制人数」。
  // 相关注释保留，避免后续维护者误恢复自动填充逻辑。

  // 弹窗关闭后恢复 ScrollView 滚动位置
  useEffect(() => {
    if (!picker.visible && !colorPickerVisible && !rolePickerVisible) {
      // 使用 setTimeout 让 DOM 完成重绘后再恢复，避免闪动
      const timer = setTimeout(() => {
        setScrollTop(scrollTopRef.current);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [picker.visible, colorPickerVisible, rolePickerVisible]);

  // 页面销毁（返回 / 切走销毁）时清理本会话持久化到 USER_DATA_PATH/uploads 的临时图片，
  // 避免反复上传-删除、或未保存退出导致本地文件无限累积。已保存的课程图片此时
  // 已上传到七牛、URL 存进后端，本地临时文件不再需要；未保存退出同理应清掉。
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

  // 「未保存改动」检测：把当前表单全部字段序列化成一个 key，与「基线快照」比较。
  // 新增页基线 = 初始默认值；编辑页基线 = fillForm 回填后的值（首次 effect 捕获）。
  // 有任何差异 → 开启离开确认；无差异 → 关闭，直接退出。
  const initialFormKeyRef = useRef<string | null>(null);
  // fillForm 写完所有 setter 后置位，指示下一个 effect 用当前 state 重新抓基线
  const captureBaselineRef = useRef(false);
  // 避免对 setLeaveGuard 重复调用（enable/disable 重复调虽无害，但减少日志噪音）
  const guardArmedRef = useRef(false);
  // 页面已开始销毁（用户手动返回 / 系统回收）标记，防止保存成功的延时 navigateBack
  // 在页面已经退场后再触发一次，导致「连退两层」。
  const unloadedRef = useRef(false);
  const applyLeaveGuard = useCallback((dirty: boolean) => {
    if (dirty === guardArmedRef.current) return;
    guardArmedRef.current = dirty;
    setLeaveGuard(dirty);
  }, []);

  useEffect(() => {
    const formKey = JSON.stringify({
      name,
      categoryId,
      duration,
      capacity,
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
      // fillForm 刚把回填值刷入 state，用当前值重抓基线，避免把「回填」误判为改动
      initialFormKeyRef.current = formKey;
      captureBaselineRef.current = false;
      applyLeaveGuard(false);
      return;
    }
    if (initialFormKeyRef.current == null) {
      // 首次（新增页 mount，或编辑页 fillForm 尚未完成的中间态）：抓基线
      initialFormKeyRef.current = formKey;
      return;
    }
    applyLeaveGuard(initialFormKeyRef.current !== formKey);
  }, [
    name,
    categoryId,
    duration,
    capacity,
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

  const fillForm = (data: CourseTemplate) => {
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
    // 回填完成：指示后续 dirty-effect 用当前（已回填）state 重新抓基线，
    // 否则编辑态会把「回填」误判为「用户改动」而开启离开确认。
    captureBaselineRef.current = true;
  };

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
      const losing: string[] = [];
      if (isClassMode && (teacherId || assistantId || studentIds.length > 0)) {
        losing.push('授课老师/助教/上课学员');
      }
      if (!isClassMode && (experiencePrice || price || minOpenCount)) {
        losing.push('价格/开课人数设置');
      }
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
    ],
  );

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

  const handleCapacityInput = useCallback(
    (e: { detail: { value: string } }) => {
      setCapacity(e.detail.value);
    },
    [setCapacity],
  );

  /** 校验表单，返回错误对象（空对象表示通过）。setErrors 用于 UI 标红。 */
  const validate = useCallback((): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!name.trim()) {
      nextErrors.name = '请输入课程名称';
    }
    if (!categoryId) {
      nextErrors.categoryId = '请选择所属分类';
    }
    if (isClassMode && !subjectId) {
      nextErrors.subjectId = '请选择所属科目';
    }
    const durationNum = Number(duration);
    if (!duration || Number.isNaN(durationNum) || durationNum <= 0) {
      nextErrors.duration = '请输入正确的课程时长';
    }
    // 容纳人数非必填，填写时必须是正整数
    const capacityNum = Number(capacity);
    if (capacity && (Number.isNaN(capacityNum) || capacityNum <= 0)) {
      nextErrors.capacity = '请输入正确的容纳人数';
    }
    // 非班课模式的价格字段校验（必填且需为有效数字）
    if (!isClassMode) {
      if (!experiencePrice) {
        nextErrors.experiencePrice = '请输入新客体验价';
      } else if (Number.isNaN(Number(experiencePrice)) || Number(experiencePrice) < 0) {
        nextErrors.experiencePrice = '请输入正确的价格';
      }
      if (!price) {
        nextErrors.price = '请输入单价';
      } else if (Number.isNaN(Number(price)) || Number(price) < 0) {
        nextErrors.price = '请输入正确的价格';
      }
    }
    setErrors(nextErrors);
    return nextErrors;
  }, [name, categoryId, subjectId, duration, capacity, isClassMode, experiencePrice, price]);

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
        backgroundImage ? uploadImage(backgroundImage, 'course') : Promise.resolve(undefined),
        homeImage ? uploadImage(homeImage, 'course') : Promise.resolve(undefined),
      ]);
    } catch {
      Taro.showToast({ title: '图片上传失败，请重试', icon: 'none' });
      setSaving(false);
      return;
    }

    const formData: CourseTemplateFormData = {
      name: name.trim(),
      categoryId,
      category,
      duration: Number(duration),
      // 留空（前端空字符串）对应 0，表示「不限制人数」；填写时按正整数处理。
      capacity: capacity ? Number(capacity) : 0,
      color,
      subjectId: subjectId || undefined,
      subjectName: subjectId ? subjects.find((s) => s.id === subjectId)?.name : undefined,
      ageGroup: ageGroup.startsWith('custom:')
        ? ('mix' as 'child' | 'teen' | 'adult' | 'mix')
        : (ageGroup as 'child' | 'teen' | 'adult' | 'mix'),
      customAgeGroup: ageGroup.startsWith('custom:') ? ageGroup.slice('custom:'.length) : undefined,
      // 按当前模式剥离：班课不提交价格类字段（用户在 UI 看不到也无法改），
      // 防止切换模式后另一模式的残留价格脏数据进后端。
      experiencePrice:
        !isClassMode && experiencePrice ? Math.round(Number(experiencePrice) * 100) : undefined,
      price: !isClassMode && price ? Math.round(Number(price) * 100) : undefined,
      minOpenCount: !isClassMode && minOpenCount ? Number(minOpenCount) : undefined,
      bookingDeadline: Number(bookingDeadline),
      cancelQueueTime: Number(cancelQueueTime),
      nonCancelTime: Number(nonCancelTime),
      autoCheckin,
      studentSelfCheckin,
      allowCheckinRoles,
      level: level.startsWith('custom:')
        ? ('all' as 'all' | 'basic' | 'advanced' | 'expert')
        : (level as 'all' | 'basic' | 'advanced' | 'expert'),
      customLevel: level.startsWith('custom:') ? level.slice('custom:'.length) : undefined,
      description: description.trim() || undefined,
      backgroundImage: backgroundImageUrl,
      homeImage: homeImageUrl,
      // 按当前模式剥离：非班课不提交师生字段，防止残留的师生数据污染团课/私教提交。
      teacherId: isClassMode ? teacherId || undefined : undefined,
      teacherName:
        isClassMode && teacherId ? teachers.find((t) => t.id === teacherId)?.name : undefined,
      assistantId: isClassMode ? assistantId || undefined : undefined,
      assistantName:
        isClassMode && assistantId ? teachers.find((t) => t.id === assistantId)?.name : undefined,
      studentIds: isClassMode && studentIds.length > 0 ? studentIds : undefined,
    };

    try {
      if (isClassEdit) {
        // 班级模式（用户口径 2026-08-23）：更新班级基础信息 + 学员增删同步
        const currentStudents = await classService.getStudents(courseId);
        const currentIds = currentStudents.map((s) => s.id);
        const toAdd = studentIds.filter((id) => !currentIds.includes(id));
        const toRemove = currentIds.filter((id) => !studentIds.includes(id));
        const classColor = (FORM_HEX_TO_CLASS_COLOR[color] || 'primary') as Class['color'];
        await classService.update(courseId, {
          name: name.trim(),
          color: classColor,
          teacher_id: teacherId,
          teachers: [teacherId, assistantId].filter(Boolean),
          category_id: categoryId || undefined,
          subject_id: subjectId || undefined,
          level: level.startsWith('custom:') ? 'all' : (level as ClassLevel),
          note: description.trim() || undefined,
          min_open_count: minOpenCount ? Number(minOpenCount) : undefined,
          hours_per_lesson: hoursPerLesson ? Number(hoursPerLesson) : 1,
          pricePerLesson: feePerLesson ? Number(feePerLesson) : 0,
        });
        for (const sid of toAdd) await classService.addStudents(courseId, [sid]);
        for (const sid of toRemove) await classService.removeStudent(courseId, sid);
        Taro.showToast({ title: '保存成功', icon: 'success' });
        // E02A：操作人入班成功后弹框订阅班级变动
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
      } else if (isEdit) {
        await update(courseId, formData);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await create(formData);
        Taro.showToast({ title: '新增成功', icon: 'success' });
        // E06：新建班级成功后弹框
        if (isClassMode) {
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
    formStorageScope,
    profile?.currentContext?.role,
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
  }, [courseId, name, remove, isClassEdit]);

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
      {/* 关键修复：scroll-view 在 flex 容器内必须同时声明 flex-1 + min-h-0，
          否则 flex item 的 min-height:auto 会让它按内容撑开，
          导致没有溢出、滚动条/鼠标滚轮失效。 */}
      <ScrollView scrollY className="flex-1 min-h-0" scrollTop={scrollTop} onScroll={handleScroll}>
        <View className="px-[32rpx] py-[24rpx] pb-[180rpx] flex flex-col gap-[24rpx]">
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
            <FormRow
              label="所属分类"
              required
              onClick={() => openPicker('category')}
              error={errors.categoryId}
            >
              <Text
                className={cn(
                  'text-[30rpx]',
                  selectedCategory ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {selectedCategory?.name ?? '请选择'}
              </Text>
            </FormRow>

            {/* 班课模式：所属科目 */}
            {isClassMode && (
              <FormRow
                label="所属科目"
                required
                onClick={() => openPicker('subject')}
                error={errors.subjectId}
              >
                <Text
                  className={cn(
                    'text-[30rpx]',
                    subjectId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {subjectId ? subjects.find((s) => s.id === subjectId)?.name : '请选择'}
                </Text>
              </FormRow>
            )}

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

            {/* 容纳人数：非必填，留空表示不限制人数（placeholder 已提示，不再重复 helperText） */}
            <FormRow
              label="容纳人数（人）"
              editable
              placeholder="留空不限制人数"
              value={capacity}
              onInput={handleCapacityInput}
              inputType="number"
              error={errors.capacity}
            />
          </Card>

          {/* 高级设置展开按钮 - 保留现状 */}
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

          {/* 高级设置 - 按"配置类型"分为 6 个子卡片 */}
          {advancedOpen && (
            <View className="flex flex-col gap-[24rpx]">
              {/* 1. 课程展示 */}
              <Card className="p-[32rpx]">
                <SectionTitle title="课程展示" />
                <View className="flex flex-col">
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
                  <FormRow label="年龄组" onClick={() => openPicker('ageGroup')} border>
                    <Text className="text-[30rpx] text-foreground">
                      {ageGroup.startsWith('custom:')
                        ? ageGroup.slice('custom:'.length)
                        : AGE_GROUP_OPTIONS.find((a) => a.value === ageGroup)?.label}
                    </Text>
                  </FormRow>
                  <FormRow label="课程难度" onClick={() => openPicker('level')} border={false}>
                    <View className="px-[20rpx] py-[6rpx] rounded-[8rpx] bg-primary/10">
                      <Text className="text-[24rpx] font-medium text-primary">
                        {level.startsWith('custom:')
                          ? level.slice('custom:'.length)
                          : CLASS_LEVEL_LABELS[level as keyof typeof CLASS_LEVEL_LABELS]}
                      </Text>
                    </View>
                  </FormRow>
                </View>
              </Card>

              {/* 班课信息（仅班课模式） */}
              {isClassMode && (
                <Card className="p-[32rpx]">
                  <SectionTitle title="班课信息" />
                  <View className="flex flex-col">
                    {/* 授课老师 */}
                    <FormRow label="授课老师" onClick={() => openPicker('teacher')} border>
                      <Text
                        className={cn(
                          'text-[30rpx]',
                          teacherId ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {teacherId ? teachers.find((t) => t.id === teacherId)?.name : '请选择'}
                      </Text>
                    </FormRow>
                    {/* 助教 */}
                    <FormRow label="助教" onClick={() => openPicker('assistant')} border>
                      <Text
                        className={cn(
                          'text-[30rpx]',
                          assistantId ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {assistantId ? teachers.find((t) => t.id === assistantId)?.name : '请选择'}
                      </Text>
                    </FormRow>
                    <FormRow
                      label="消耗课时"
                      editable
                      placeholder="请输入"
                      value={hoursPerLesson}
                      onInput={(e) => setHoursPerLesson(e.detail.value)}
                      inputType="digit"
                      suffix="课时"
                      border
                    />
                    <FormRow
                      label="授课扣费"
                      editable
                      placeholder="请输入"
                      value={feePerLesson}
                      onInput={(e) => setFeePerLesson(e.detail.value)}
                      inputType="digit"
                      suffix="元"
                      border={false}
                    />
                  </View>
                </Card>
              )}

              {/* 上课学员（仅班课模式，统一使用 ClassStudentsCard 共享组件） */}
              {isClassMode && (
                <ClassStudentsCard
                  studentIds={studentIds}
                  students={selectedStudents}
                  allStudents={studentList}
                  subjectId={subjectId}
                  subjects={subjects}
                  maxSelectable={Number(capacity) > 0 ? Number(capacity) : undefined}
                  onChange={setStudentIds}
                />
              )}

              {/* 非班课模式：开课与价格 / 预约规则 / 签到规则 */}
              {!isClassMode && (
                <>
                  {/* 2. 开课与价格 */}
                  <Card className="p-[32rpx]">
                    <SectionTitle title="开课与价格" />
                    <View className="flex flex-col">
                      <FormRow
                        label="新客体验价"
                        editable
                        placeholder="必填项"
                        value={experiencePrice}
                        onInput={(e) => setExperiencePrice(e.detail.value)}
                        inputType="digit"
                        suffix="元"
                        error={errors.experiencePrice}
                        border
                      />
                      <FormRow
                        label="单价"
                        hint={TOOLTIPS.price}
                        editable
                        placeholder="必填项"
                        value={price}
                        onInput={(e) => setPrice(e.detail.value)}
                        inputType="digit"
                        suffix="元"
                        error={errors.price}
                        border
                      />
                      <FormRow
                        label="最低开课人数"
                        editable
                        placeholder="请选择"
                        value={minOpenCount}
                        onInput={(e) => setMinOpenCount(e.detail.value)}
                        inputType="number"
                        border={false}
                      />
                    </View>
                  </Card>

                  {/* 3. 预约规则 */}
                  <Card className="p-[32rpx]">
                    <SectionTitle title="预约规则" />
                    <View className="flex flex-col">
                      <FormRow label="截止预约时间" onClick={() => openPicker('deadline')} border>
                        <Text className="text-[30rpx] text-foreground">
                          {DEADLINE_OPTIONS.find((d) => String(d.value) === bookingDeadline)?.label}
                        </Text>
                      </FormRow>
                      <FormRow
                        label="取消排队时间"
                        onClick={() => openPicker('cancelQueue')}
                        border
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {DEADLINE_OPTIONS.find((d) => String(d.value) === cancelQueueTime)?.label}
                        </Text>
                      </FormRow>
                      <FormRow
                        label="不可取消时间"
                        onClick={() => openPicker('nonCancel')}
                        border={false}
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {DEADLINE_OPTIONS.find((d) => String(d.value) === nonCancelTime)?.label}
                        </Text>
                      </FormRow>
                    </View>
                  </Card>

                  {/* 4. 签到规则 */}
                  <Card className="p-[32rpx]">
                    <SectionTitle title="签到规则" />
                    <View className="flex flex-col">
                      <FormRow
                        label="自动签到"
                        hint={TOOLTIPS.autoCheckin}
                        onClick={() => openPicker('autoCheckin')}
                        border
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === autoCheckin)?.label}
                        </Text>
                      </FormRow>
                      <FormRow
                        label="学员自助签到"
                        hint={TOOLTIPS.selfCheckin}
                        onClick={() => openPicker('selfCheckin')}
                        border
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {
                            STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === studentSelfCheckin)
                              ?.label
                          }
                        </Text>
                      </FormRow>
                      <FormRow
                        label="允许签到角色"
                        hint={TOOLTIPS.allowCheckinRoles}
                        onClick={openRolePicker}
                        border={false}
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
                    </View>
                  </Card>
                </>
              )}

              {/* 5. 课程介绍 */}
              <Card className="p-[32rpx]">
                <SectionTitle title="课程介绍" />
                <FormInput
                  label="课程简介"
                  placeholder="暂无"
                  value={description}
                  onInput={(e) => setDescription(e.detail.value)}
                  multiline
                  minHeight="200rpx"
                />
              </Card>

              {/* 6. 课程图片：背景图整宽上传框 + 封面左文字右方框 */}
              <Card className="p-[32rpx]">
                  <SectionTitle title="课程图片" />
                  <View className="flex flex-col gap-[40rpx]">
                    {/* 课程背景图：整宽上传框 */}
                    <View className="flex flex-col gap-[16rpx]">
                      <View className="flex flex-row items-center gap-[12rpx]">
                        <Text className="text-[30rpx] font-medium text-foreground">课程背景图</Text>
                        <View className="px-[16rpx] py-[6rpx] rounded-full bg-primary/10">
                          <Text className="text-[22rpx] text-primary font-medium">约课首页</Text>
                        </View>
                      </View>
                      <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                        显示在首页课程卡底尾。建议使用 405×190 横图，未上传将使用默认背景。
                      </Text>
                      <CourseImageUploader
                        value={backgroundImage}
                        onChange={(v) => setBackgroundImage(v ?? '')}
                        title="上传背景图"
                        subtitle="上传后可预览和更换"
                        layout="fullWidth"
                        scrollTopRef={scrollTopRef}
                        onScrollRestore={(t) => setScrollTop(t)}
                      />
                    </View>

                    <View className="h-[1rpx] bg-border/30" />

                    {/* 课程封面：左文字说明 + 右方形上传框（卡片内嵌两栏） */}
                    <View className="flex flex-col gap-[16rpx]">
                      <View className="flex flex-row items-center gap-[12rpx]">
                        <Text className="text-[30rpx] font-medium text-foreground">课程封面</Text>
                        <View className="px-[16rpx] py-[6rpx] rounded-full bg-primary/10">
                          <Text className="text-[22rpx] text-primary font-medium">分享使用</Text>
                        </View>
                      </View>
                      <View className="flex flex-row items-start gap-[24rpx]">
                        <View className="flex-1 min-w-0">
                          <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                            用于分享课程、生成课表推荐等场景，推荐清晰方图。未上传不影响首页背景图。
                          </Text>
                        </View>
                        <CourseImageUploader
                          value={homeImage}
                          onChange={(v) => setHomeImage(v ?? '')}
                          title="上传封面"
                          layout="square"
                          squareSizeRpx={200}
                          scrollTopRef={scrollTopRef}
                          onScrollRestore={(t) => setScrollTop(t)}
                        />
                      </View>
                    </View>
                  </View>
                </Card>
            </View>
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
        addable={picker.type === 'ageGroup' || picker.type === 'level'}
        addPrompt={
          picker.type === 'ageGroup' ? '年龄组' : picker.type === 'level' ? '难度' : '选项'
        }
        addPlaceholder={
          picker.type === 'ageGroup'
            ? '如：中老年、幼儿'
            : picker.type === 'level'
              ? '如：入门级'
              : '请输入名称'
        }
        customOptions={
          picker.type === 'ageGroup'
            ? customAgeGroups.map((label) => ({ label, value: `custom:${label}` }))
            : picker.type === 'level'
              ? customLevels.map((label) => ({ label, value: `custom:${label}` }))
              : undefined
        }
        onAdd={(label) => {
          if (picker.type === 'ageGroup') {
            setCustomAgeGroups((prev) => (prev.includes(label) ? prev : [...prev, label]));
            setAgeGroup(`custom:${label}`);
          } else if (picker.type === 'level') {
            setCustomLevels((prev) => (prev.includes(label) ? prev : [...prev, label]));
            setLevel(`custom:${label}`);
          }
        }}
        onDeleteCustom={(value) => {
          const label = value.startsWith('custom:') ? value.slice('custom:'.length) : value;
          if (picker.type === 'ageGroup') {
            setCustomAgeGroups((prev) => prev.filter((l) => l !== label));
            if (ageGroup === value) setAgeGroup('mix');
          } else if (picker.type === 'level') {
            setCustomLevels((prev) => prev.filter((l) => l !== label));
            if (level === value) setLevel('all');
          }
        }}
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

      {/* 学员多选弹窗由上方 ClassStudentsCard 内部管理，无需在此单独渲染 */}
    </PageContainer>
  );
};

// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '新增课程',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
  // 禁用页面原生滚动，防止 PageContainer 的 min-h-screen + 安全区/底部留白
  // 产生竖向原生滚动；弹窗(BottomSheet 用 position:fixed)开合时会触发微信
  // 「fixed 元素切换导致原生页面滚动位置重置到顶部」的 BUG。
  // 本页内容滚动由内部 ScrollView(flex-1，在 h-screen flex-col overflow-hidden 容器内) 承载，不受此开关影响。
  // 注意：PageContainer 不再传 safeBottom，避免 pb-safe-bottom 给外层容器增加
  // 额外高度导致 navigateTo 页面出现原生滚动条/ScrollView 鼠标滚轮失效。
  disableScroll: true,
});

export default CourseFormPage;
