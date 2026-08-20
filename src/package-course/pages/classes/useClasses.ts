import Taro from '@tarojs/taro';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { classService } from '@/services';
import { teacherService } from '@/services/teacher';
import { useStudentStore, useClassStore, usePackageTemplateStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import type { Class, ClassColor, ClassIcon, ClassType, TeachMode } from '@/types/class';
import type { CoursePackageTemplate } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';

// 班级图标映射（10 个教培相关 MDI 图标）
export const CLASS_ICONS: Record<ClassIcon, string> = {
  piano: 'mdi-piano',
  dance: 'mdi-dance',
  art: 'mdi-palette',
  calligraphy: 'mdi-fountain-pen-tip',
  basketball: 'mdi-basketball',
  speech: 'mdi-microphone',
  rubik: 'mdi-puzzle',
  go: 'mdi-chess-pawn',
  book: 'mdi-book-open-page-variant',
  music: 'mdi-music-note',
};

// 班级颜色到渐变类名映射
export const CLASS_GRADIENT: Record<ClassColor, string> = {
  primary: 'bg-class-primary',
  red: 'bg-class-red',
  amber: 'bg-class-amber',
  purple: 'bg-class-purple',
  info: 'bg-class-info',
  teal: 'bg-class-teal',
};

// 筛选Tab类型
export type FilterTab = 'all' | 'active' | 'ended';

export const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'ended', label: '已结课' },
];

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const TEACH_MODES: { key: TeachMode; label: string }[] = [
  { key: 'one_on_one', label: '一对一' },
  { key: 'small_class', label: '小班' },
  { key: 'large_class', label: '大班' },
];

export const PACKAGE_TYPE_LABELS: Record<string, string> = {
  hour_package: '课时包',
  term: '期课',
  monthly: '月卡',
  trial: '体验课',
};

export function useClasses() {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentCampusId = useCampusStore((state) => state.currentCampusId);
  const fetchClassesByTeacher = useClassStore((state) => state.fetchByTeacher);
  const invalidateClasses = useClassStore((state) => state.invalidate);
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const invalidateStudents = useStudentStore((state) => state.invalidate);
  const fetchPackageTemplatesByTeacher = usePackageTemplateStore((state) => state.fetchByTeacher);

  const [classes, setClasses] = useState<Class[]>([]);
  const { loading, setLoading } = useDelayedLoading();
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 创建班级弹窗状态
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  // 创建班级表单
  const [name, setName] = useState('');
  const [classType, setClassType] = useState<ClassType>('unlimited');
  const [teachMode, setTeachMode] = useState<TeachMode>('small_class');
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teachers, setTeachers] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState('');
  const [color, setColor] = useState<ClassColor>('primary');
  const [icon, setIcon] = useState<ClassIcon>('piano');

  // 在职教师列表
  const [teacherOptions, setTeacherOptions] = useState<TeacherUIModel[]>([]);

  // 课程包
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [packageTemplates, setPackageTemplates] = useState<CoursePackageTemplate[]>([]);
  const [showPackagePicker, setShowPackagePicker] = useState(false);
  const [packagePickerVisible, setPackagePickerVisible] = useState(false);

  // 学员选择器
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTempIds, setPickerTempIds] = useState<string[]>([]);
  const loadClassesStartAtRef = useRef(0);
  const preloadStartAtRef = useRef(0);

  const loadClasses = useCallback(async () => {
    loadClassesStartAtRef.current = Date.now();
    // #region debug-point H2:classes-list-start
    reportLocalDebug({
      hypothesisId: 'H2',
      location: 'src/package-course/pages/classes/useClasses.ts:loadClasses',
      msg: '[DEBUG] classes list start',
      data: {
        currentUserId,
      },
    });
    // #endregion
    if (!profile || !currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const list = await fetchClassesByTeacher(currentUserId, currentCampusId);
      setClasses(list);
    } catch (err) {
      logError('load classes', err);
      setLoadError('班级列表加载失败，请稍后重试');
    } finally {
      // #region debug-point H2:classes-list-end
      reportLocalDebug({
        hypothesisId: 'H2',
        location: 'src/package-course/pages/classes/useClasses.ts:loadClasses',
        msg: '[DEBUG] classes list end',
        data: {
          currentUserId,
          currentCampusId,
          durationMs: Date.now() - loadClassesStartAtRef.current,
        },
      });
      // #endregion
      setLoading(false);
    }
  }, [profile, currentUserId, currentCampusId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 当前校区变化时重新加载班级列表
  useEffect(() => {
    if (!currentCampusId) return;
    loadClasses();
  }, [currentCampusId, loadClasses]);

  // 页面显示时刷新（非首次加载）
  const hasLoaded = useRef(false);
  Taro.useDidShow(() => {
    if (hasLoaded.current) {
      loadClasses();
    }
    hasLoaded.current = true;
  });

  // 加载学员列表
  useEffect(() => {
    if (!profile || !currentUserId) return;
    preloadStartAtRef.current = Date.now();
    // #region debug-point H2:classes-preload-start
    reportLocalDebug({
      hypothesisId: 'H2',
      location: 'src/package-course/pages/classes/useClasses.ts:preload',
      msg: '[DEBUG] classes preload start',
      data: { currentUserId },
    });
    // #endregion
    const studentsPromise = fetchStudentsByTeacher(currentUserId, currentCampusId)
      .then((list) => setAllStudents(list))
      .catch((err) => {
        logError('load class students', err);
      });
    const packagesPromise = fetchPackageTemplatesByTeacher(currentUserId)
      .then((list) => setPackageTemplates(list))
      .catch((err) => {
        logError('load class package templates', err);
      });
    const teachersPromise = teacherService
      .getActiveList(currentCampusId)
      .then(setTeacherOptions)
      .catch((err) => {
        logError('load class teachers', err);
      });
    // #region debug-point H2:classes-preload-end
    Promise.allSettled([studentsPromise, packagesPromise, teachersPromise]).then(() => {
      reportLocalDebug({
        hypothesisId: 'H2',
        location: 'src/package-course/pages/classes/useClasses.ts:preload',
        msg: '[DEBUG] classes preload end',
        data: {
          currentUserId,
          durationMs: Date.now() - preloadStartAtRef.current,
        },
      });
    });
    // #endregion
  }, [
    profile,
    currentUserId,
    currentCampusId,
    fetchPackageTemplatesByTeacher,
    fetchStudentsByTeacher,
  ]);

  // 筛选后的班级列表
  const filteredClasses = useMemo(() => {
    let result = classes;
    if (activeTab === 'active') {
      result = result.filter((c) => c.status === 'active');
    } else if (activeTab === 'ended') {
      result = result.filter((c) => c.status === 'ended');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || (c.schedule && c.schedule.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [classes, activeTab, searchQuery]);

  // 统计数据
  const stats = useMemo(() => {
    const totalClasses = classes.length;
    const totalStudents = classes.reduce((sum, c) => sum + c.student_count, 0);
    const totalUsedLessons = classes.reduce((sum, c) => sum + c.used_lessons, 0);
    return { totalClasses, totalStudents, totalUsedLessons };
  }, [classes]);

  // 分组
  const groupedClasses = useMemo(() => {
    const groups: { title: string; subtitle: string; classes: Class[] }[] = [];
    const activeUnlimited = filteredClasses.filter(
      (c) => c.status === 'active' && c.type === 'unlimited',
    );
    const activeLimited = filteredClasses.filter(
      (c) => c.status === 'active' && c.type === 'limited',
    );
    const ended = filteredClasses.filter((c) => c.status === 'ended');

    if (activeUnlimited.length > 0)
      groups.push({ title: '长期班', subtitle: '循环上课', classes: activeUnlimited });
    if (activeLimited.length > 0)
      groups.push({ title: '特训班', subtitle: '有限课时', classes: activeLimited });
    if (ended.length > 0) groups.push({ title: '已结课', subtitle: '', classes: ended });

    return groups;
  }, [filteredClasses]);

  // 跳转班级详情
  const goDetail = useCallback((id: string) => {
    Taro.navigateTo({
      url: `/package-course/pages/class-detail/index?id=${encodeURIComponent(id)}`,
    });
  }, []);

  // 跳转消课页面
  const goLessonForm = useCallback((classId: string) => {
    Taro.navigateTo({
      url: `/package-course/pages/lesson-form/index?classId=${encodeURIComponent(classId)}`,
    });
  }, []);

  // 删除班级
  const handleDelete = useCallback(
    async (id: string, className: string) => {
      if (deletingClassId) return;

      const { confirm } = await Taro.showModal({
        title: '删除班级',
        content: `确认删除班级「${className}」？`,
        confirmColor: '#ef4444',
      });
      if (!confirm) return;

      setDeletingClassId(id);
      try {
        await classService.remove(id);
        invalidateClasses(currentUserId);
        Taro.showToast({ title: '删除成功', icon: 'success' });
        setClasses((prev) => prev.filter((c) => c.id !== id));
      } catch {
        Taro.showToast({ title: '删除失败', icon: 'none' });
      } finally {
        setDeletingClassId('');
      }
    },
    [currentUserId, deletingClassId, invalidateClasses],
  );

  // ===== 创建班级弹窗 =====
  const openCreateSheet = useCallback(() => {
    setName('');
    setClassType('unlimited');
    setTeachMode('small_class');
    setWeekdays([]);
    setStartTime('14:00');
    setEndTime('15:30');
    setStartDate('');
    setEndDate('');
    setTeachers(currentUserId ? [currentUserId] : []);
    setSelectedStudentIds([]);
    setSelectedPackageId('');
    setColor('primary');
    setIcon('piano');
    setSaving(false);
    setShowCreateSheet(true);
    setTimeout(() => setCreateVisible(true), 50);
  }, [currentUserId]);

  const closeCreateSheet = useCallback(() => {
    setCreateVisible(false);
    setTimeout(() => setShowCreateSheet(false), 300);
  }, []);

  const scheduleText = useMemo(() => {
    if (weekdays.length === 0 || !startTime || !endTime) return '';
    const dayOrder = ['一', '二', '三', '四', '五', '六', '日'];
    const sorted = [...weekdays].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    return `每周${sorted.join('、')} ${startTime}-${endTime}`;
  }, [weekdays, startTime, endTime]);

  const toggleWeekday = useCallback((day: string) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }, []);

  const toggleTeacher = useCallback((t: string) => {
    setTeachers((prev) => (prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]));
  }, []);

  // ===== 学员选择器 =====
  const openStudentPicker = useCallback(() => {
    setPickerTempIds([...selectedStudentIds]);
    setPickerSearch('');
    setShowStudentPicker(true);
    setTimeout(() => setPickerVisible(true), 50);
  }, [selectedStudentIds]);

  const closeStudentPicker = useCallback(() => {
    setPickerVisible(false);
    setTimeout(() => setShowStudentPicker(false), 300);
  }, []);

  const togglePickerStudent = useCallback((id: string) => {
    setPickerTempIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const confirmStudentPicker = useCallback(() => {
    setSelectedStudentIds([...pickerTempIds]);
    closeStudentPicker();
  }, [pickerTempIds, closeStudentPicker]);

  const filteredStudents = useMemo(() => {
    if (!pickerSearch) return allStudents;
    const kw = pickerSearch.toLowerCase();
    return allStudents.filter(
      (s) => s.name.toLowerCase().includes(kw) || (s.phone || '').includes(kw),
    );
  }, [allStudents, pickerSearch]);

  const validate = useCallback((): string | null => {
    if (!name.trim()) return '请输入班级名称';
    if (name.trim().length > 20) return '班级名称最多 20 个字';
    if (weekdays.length === 0) return '请选择上课时间（星期）';
    if (!startTime || !endTime) return '请选择完整的上课时段';
    if (startTime >= endTime) return '结束时间需晚于开始时间';
    if (USE_MOCK && teachers.length === 0) return '请选择授课老师';
    if (classType === 'limited' && !selectedPackageId) return '请选择课程包';
    if (classType === 'limited' && startDate && endDate && startDate > endDate) {
      return '结束日期不能早于开始日期';
    }
    return null;
  }, [
    classType,
    endDate,
    endTime,
    name,
    selectedPackageId,
    startDate,
    startTime,
    teachers,
    weekdays,
  ]);

  const submitBlockedReason = useMemo(() => validate() || '', [validate]);
  const canCreate = useMemo(() => !submitBlockedReason && !saving, [saving, submitBlockedReason]);

  const handleCreate = useCallback(async () => {
    if (saving) return;

    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const schedule = scheduleText;
      const selectedPkg =
        classType === 'limited' ? packageTemplates.find((p) => p.id === selectedPackageId) : null;
      const baseData = {
        teacher_id: currentUserId,
        name: name.trim(),
        type: classType,
        teach_mode: teachMode,
        status: 'active' as const,
        schedule,
        weekdays,
        start_time: startTime,
        end_time: endTime,
        teachers,
        color,
        icon,
        used_lessons: 0,
        student_count: selectedStudentIds.length,
        campus_id: currentCampusId,
        ...(classType === 'limited' && selectedPkg
          ? {
              total_lessons: selectedPkg.lesson_count,
              start_date: startDate,
              end_date: endDate,
            }
          : { total_lessons: undefined }),
      };
      const cls = await classService.create(baseData);
      if (cls && selectedStudentIds.length > 0)
        await classService.addStudents(cls.id, selectedStudentIds);
      invalidateClasses(currentUserId);
      invalidateStudents(currentUserId);
      Taro.showToast({ title: '创建成功', icon: 'success' });
      closeCreateSheet();
      loadClasses();
    } catch {
      Taro.showToast({ title: '创建失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    name,
    classType,
    teachMode,
    weekdays,
    startTime,
    endTime,
    teachers,
    startDate,
    endDate,
    selectedStudentIds,
    selectedPackageId,
    scheduleText,
    color,
    icon,
    currentUserId,
    currentCampusId,
    submitBlockedReason,
    saving,
    closeCreateSheet,
    loadClasses,
    packageTemplates,
    invalidateClasses,
    invalidateStudents,
  ]);

  return {
    // 数据
    classes,
    loading,
    loadError,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredClasses,
    stats,
    groupedClasses,
    // 导航
    goDetail,
    goLessonForm,
    handleDelete,
    // 创建弹窗
    showCreateSheet,
    createVisible,
    openCreateSheet,
    closeCreateSheet,
    name,
    setName,
    classType,
    setClassType,
    teachMode,
    setTeachMode,
    weekdays,
    toggleWeekday,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    teachers,
    toggleTeacher,
    teacherOptions,
    selectedStudentIds,
    saving,
    deletingClassId,
    scheduleText,
    submitBlockedReason,
    canCreate,
    handleCreate,
    color,
    setColor,
    icon,
    setIcon,
    // 课程包
    selectedPackageId,
    setSelectedPackageId,
    packageTemplates,
    showPackagePicker,
    setShowPackagePicker,
    packagePickerVisible,
    setPackagePickerVisible,
    // 学员选择器
    showStudentPicker,
    pickerVisible,
    openStudentPicker,
    closeStudentPicker,
    pickerSearch,
    setPickerSearch,
    pickerTempIds,
    togglePickerStudent,
    confirmStudentPicker,
    filteredStudents,
    reload: loadClasses,
  };
}
