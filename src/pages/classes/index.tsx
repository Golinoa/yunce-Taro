import { View, Text, Input, Picker, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Avatar from '@/components/Avatar';
import PageContainer from '@/components/PageContainer';
import SheetInput, { SheetPickerItem, SheetSelectItem, SheetTag } from '@/components/SheetInput';
import { classService, studentService, packageTemplateService } from '@/services';
import { useStudentStore, useClassStore, usePackageTemplateStore } from '@/stores';
import type { Class, ClassColor, TeachMode, ClassType } from '@/types/class';
import type { CoursePackageTemplate } from '@/types/course-package';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

// 班级颜色到图标映射
const CLASS_ICONS: Record<ClassColor, string> = {
  primary: '🎹',
  accent: '💃',
  amber: '🎯',
  info: '❄️',
  purple: '📚',
};

// 班级颜色到渐变类名映射
const CLASS_GRADIENT: Record<ClassColor, string> = {
  primary: 'bg-class-primary',
  accent: 'bg-class-accent',
  amber: 'bg-class-amber',
  info: 'bg-class-info',
  purple: 'bg-class-purple',
};

// 筛选Tab类型
type FilterTab = 'all' | 'active' | 'ended';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'ended', label: '已结课' },
];

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const TEACHER_LIST = ['王老师', '李老师', '张老师', '赵老师'];

const TEACH_MODES: { key: TeachMode; label: string }[] = [
  { key: 'one_on_one', label: '一对一' },
  { key: 'small_class', label: '小班' },
  { key: 'large_class', label: '大班' },
];

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  hour_package: '课时包',
  term: '期课',
  monthly: '月卡',
  trial: '体验课',
};

// 样式已迁移至 UnoCSS 类名，不再使用 S 常量

const ClassesPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const classStore = useClassStore();
  const studentStore = useStudentStore();
  const packageTemplateStore = usePackageTemplateStore();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadClasses = useCallback(async () => {
    if (!profile || profile.role !== 'teacher') return;
    setLoading(true);
    try {
      const list = await classStore.fetchByTeacher(currentUserId);
      setClasses(list);
    } catch (err) {
      logError('load classes', err);
    } finally {
      setLoading(false);
    }
  }, [profile, currentUserId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // 页面显示时刷新（从详情页返回时）
  useEffect(() => {
    // Taro 页面生命周期 - 后续接入 useDidShow
  }, [loadClasses]);

  // 加载学员列表
  useEffect(() => {
    if (!profile || profile.role !== 'teacher') return;
    studentStore.fetchByTeacher(currentUserId).then((list) => setAllStudents(list));
    packageTemplateStore.fetchByTeacher(currentUserId).then((list) => setPackageTemplates(list));
  }, [profile, currentUserId]);

  // 筛选后的班级列表
  const filteredClasses = useMemo(() => {
    let result = classes;

    // Tab筛选
    if (activeTab === 'active') {
      result = result.filter((c) => c.status === 'active');
    } else if (activeTab === 'ended') {
      result = result.filter((c) => c.status === 'ended');
    }

    // 搜索筛选
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
    Taro.navigateTo({ url: `/pages/class-detail/index?id=${encodeURIComponent(id)}` });
  }, []);

  // 跳转消课页面
  const goLessonForm = useCallback((classId: string) => {
    Taro.navigateTo({ url: `/pages/lesson-form/index?classId=${encodeURIComponent(classId)}` });
  }, []);

  // 删除班级
  const handleDelete = useCallback(async (id: string, name: string) => {
    const { confirm } = await Taro.showModal({
      title: '删除班级',
      content: `确认删除班级「${name}」？`,
      confirmColor: '#ef4444',
    });
    if (!confirm) return;
    try {
      await classService.remove(id);
      classStore.invalidate(currentUserId);
      Taro.showToast({ title: '删除成功', icon: 'success' });
      setClasses((prev) => prev.filter((c) => c.id !== id));
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  }, []);

  // ===== 创建班级弹窗 =====
  const openCreateSheet = useCallback(() => {
    // 重置表单
    setName('');
    setClassType('unlimited');
    setTeachMode('small_class');
    setWeekdays([]);
    setStartTime('14:00');
    setEndTime('15:30');
    setStartDate('');
    setEndDate('');
    setTeachers([]);
    setSelectedStudentIds([]);
    setSelectedPackageId('');
    setSaving(false);
    setShowCreateSheet(true);
    setTimeout(() => setCreateVisible(true), 50);
  }, []);

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
    if (weekdays.length === 0) return '请选择上课时间（星期）';
    if (teachers.length === 0) return '请选择授课老师';
    if (classType === 'limited' && !selectedPackageId) return '请选择课程包';
    return null;
  }, [name, weekdays, teachers, classType, selectedPackageId]);

  const handleCreate = useCallback(async () => {
    const error = validate();
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
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
        color: 'primary' as const,
        used_lessons: 0,
        student_count: 0,
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
      classStore.invalidate(currentUserId);
      studentStore.invalidate(currentUserId);
      Taro.showToast({ title: '创建成功', icon: 'success' });
      closeCreateSheet();
      loadClasses();
    } catch {
      Taro.showToast({ title: '创建失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
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
    currentUserId,
    closeCreateSheet,
    loadClasses,
  ]);

  // 渲染类型标签
  const renderTypeTag = (cls: Class) => {
    if (cls.type === 'unlimited') {
      return <View className="tag-primary">循环</View>;
    }
    return <View className="tag-amber">{cls.total_lessons}课时</View>;
  };

  // 渲染状态标签
  const renderStatusTag = (cls: Class) => {
    if (cls.status === 'ended') {
      return <View className="tag-purple">已结课</View>;
    }
    return <View className="tag-primary">进行中</View>;
  };

  // 渲染进度信息（含消课箭头按钮）
  const renderProgress = (cls: Class) => {
    if (cls.status === 'ended') return null;
    if (cls.type === 'unlimited') {
      return (
        <View className="flex flex-col items-center gap-1">
          <Text className="text-primary text-lg font-bold">∞</Text>
          {cls.status === 'active' && (
            <View
              className="w-7_d5 h-7_d5 rounded-lg bg-primary flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                goLessonForm(cls.id);
              }}
            >
              <Text className="text-white text-xs">›</Text>
            </View>
          )}
        </View>
      );
    }
    return (
      <View className="flex items-center gap-2">
        <View className="flex flex-col items-end">
          <Text className="text-foreground text-base font-bold">
            {cls.used_lessons}/{cls.total_lessons}
          </Text>
          <Text className="text-muted-foreground text-xs">已消/总课时</Text>
        </View>
        {cls.status === 'active' && (
          <View
            className="w-7_d5 h-7_d5 rounded-lg bg-primary flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              goLessonForm(cls.id);
            }}
          >
            <Text className="text-white text-xs">›</Text>
          </View>
        )}
      </View>
    );
  };

  // ===== 创建班级弹窗渲染 =====
  const renderCreateSheet = () => {
    if (!showCreateSheet) return null;
    return (
      <View className="fixed inset-0 z-100">
        {/* 遮罩层 */}
        <View
          className={`absolute inset-0 transition-colors duration-300 ${createVisible ? 'bg-black/45' : 'bg-transparent'}`}
          onClick={closeCreateSheet}
        />

        {/* 弹窗主体 */}
        <View
          className={`absolute bottom-0 left-0 right-0 rounded-t-[40rpx] px-10 pt-10 pb-[68rpx] transition-transform duration-300 ease-in-out max-h-[90vh] overflow-y-auto ${createVisible ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* Handle */}
          <View
            className="w-[72rpx] h-[8rpx] rounded-full mx-auto mb-8"
            style={{ backgroundColor: '#D5E8E0' }}
          />

          {/* 标题 */}
          <View className="text-[32rpx] font-semibold text-foreground mb-8">创建班级</View>

          {/* 班级名称 */}
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">班级名称</View>
            <SheetInput
              placeholder="如：钢琴基础班"
              value={name}
              onInput={(e) => setName(e.detail.value || '')}
            />
          </View>

          {/* 授课模式 */}
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">授课模式</View>
            <View className="flex gap-3">
              {TEACH_MODES.map((m) => {
                const selected = teachMode === m.key;
                return (
                  <View key={m.key} className="">
                    <SheetTag selected={selected} onClick={() => setTeachMode(m.key)}>
                      {m.label}
                    </SheetTag>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 上课类型 */}
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">上课类型</View>
            <View className="flex gap-3">
              <View>
                <SheetTag
                  selected={classType === 'unlimited'}
                  onClick={() => setClassType('unlimited')}
                >
                  循环上课
                </SheetTag>
              </View>
              <View>
                <SheetTag
                  selected={classType === 'limited'}
                  onClick={() => setClassType('limited')}
                >
                  课时制
                </SheetTag>
              </View>
            </View>
          </View>

          {/* 关联课程包（仅课时制） */}
          {classType === 'limited' && (
            <View className="mb-7">
              <View className="text-sm text-muted-foreground mb-3 font-medium">关联课程包</View>
              <SheetSelectItem
                onClick={() => {
                  setShowPackagePicker(true);
                  setTimeout(() => setPackagePickerVisible(true), 50);
                }}
              >
                {selectedPackageId ? (
                  (() => {
                    const pkg = packageTemplates.find((p) => p.id === selectedPackageId);
                    return pkg ? (
                      <>
                        <View className="flex-1">
                          <View className="text-md font-medium text-foreground">{pkg.name}</View>
                          <View className="text-[20rpx] text-muted-foreground mt-1">
                            ¥{pkg.price} · {pkg.lesson_count}课时 · {pkg.duration}分钟
                          </View>
                        </View>
                        <Text className="text-sm text-muted-foreground">✕</Text>
                      </>
                    ) : null;
                  })()
                ) : (
                  <>
                    <Text className="text-md text-muted-foreground">选择课程包</Text>
                    <Text className="ml-auto text-sm text-muted-foreground">›</Text>
                  </>
                )}
              </SheetSelectItem>
              {/* 无课程包时快捷添加 */}
              {packageTemplates.length === 0 && (
                <View
                  className="mt-4 text-sm text-primary font-medium py-5 px-6 rounded-[24rpx] border-[2rpx] border-dashed border-primary bg-primary-bg text-center"
                  onClick={() => Taro.navigateTo({ url: '/pages/course-packages/index' })}
                >
                  + 快捷添加课程包
                </View>
              )}
            </View>
          )}

          {/* 上课时间 */}
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">上课时间</View>
            {/* 星期选择器 */}
            <View className="flex gap-3 flex-wrap">
              {WEEKDAYS.map((day) => {
                const selected = weekdays.includes(day);
                return (
                  <View
                    key={day}
                    className={`w-[76rpx] h-[76rpx] rounded-full border-[4rpx] flex items-center justify-center text-sm font-semibold ${selected ? 'border-primary bg-primary text-white' : 'text-muted-foreground'}`}
                    style={
                      selected ? undefined : { backgroundColor: '#f5faf8', borderColor: '#D5E8E0' }
                    }
                    onClick={() => toggleWeekday(day)}
                  >
                    {day}
                  </View>
                );
              })}
            </View>
            {/* 时间段选择 */}
            <View className="flex gap-4 items-center mt-5">
              <View className="flex-1 min-w-0">
                <Picker
                  mode="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.detail.value)}
                >
                  <SheetPickerItem>{startTime}</SheetPickerItem>
                </Picker>
              </View>
              <View className="text-md text-muted-foreground flex-shrink-0">—</View>
              <View className="flex-1 min-w-0">
                <Picker mode="time" value={endTime} onChange={(e) => setEndTime(e.detail.value)}>
                  <SheetPickerItem>{endTime}</SheetPickerItem>
                </Picker>
              </View>
            </View>
            {/* 排课预览 */}
            {scheduleText && (
              <View className="mt-4 text-sm text-primary font-medium py-3 px-5 bg-primary-bg rounded-lg">
                {scheduleText}
              </View>
            )}
          </View>

          {/* 上课日期范围（仅课时制） */}
          {classType === 'limited' && (
            <View className="mb-7">
              <View className="text-sm text-muted-foreground mb-3 font-medium">上课日期范围</View>
              <View className="flex gap-4">
                <View className="flex-1 min-w-0">
                  <Picker
                    mode="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.detail.value)}
                  >
                    <SheetPickerItem className={startDate ? '' : 'text-muted-foreground'}>
                      {startDate || '开始日期'}
                    </SheetPickerItem>
                  </Picker>
                </View>
                <View className="flex-1 min-w-0">
                  <Picker mode="date" value={endDate} onChange={(e) => setEndDate(e.detail.value)}>
                    <SheetPickerItem className={endDate ? '' : 'text-muted-foreground'}>
                      {endDate || '结束日期'}
                    </SheetPickerItem>
                  </Picker>
                </View>
              </View>
            </View>
          )}

          {/* 授课老师 */}
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">授课老师</View>
            <View className="flex gap-4 flex-wrap">
              {TEACHER_LIST.map((t) => {
                const selected = teachers.includes(t);
                return (
                  <View key={t}>
                    <SheetTag selected={selected} onClick={() => toggleTeacher(t)}>
                      {t}
                    </SheetTag>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 添加学员 */}
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">添加学员</View>
            <SheetSelectItem dashed onClick={openStudentPicker}>
              <Text className="text-[26rpx] text-primary">👤</Text>
              <Text className="text-[26rpx] text-muted-foreground">选择学员</Text>
              {selectedStudentIds.length > 0 && (
                <View className="ml-auto text-xs font-semibold text-primary bg-primary-bg py-1 px-4 rounded-xl">
                  {selectedStudentIds.length}人
                </View>
              )}
            </SheetSelectItem>
          </View>

          {/* 确认按钮 */}
          <View
            className={`w-full py-6 rounded-[28rpx] border-none text-white text-[30rpx] font-semibold text-center mt-4 ${saving ? 'bg-gray-300' : 'bg-gradient-primary'}`}
            onClick={saving ? undefined : handleCreate}
          >
            {saving ? '创建中...' : '确认创建'}
          </View>
        </View>

        {/* ===== 学员选择器弹窗 ===== */}
        {showStudentPicker && (
          <View
            className={`fixed inset-0 z-200 transition-colors duration-300 ${pickerVisible ? 'bg-black/45' : 'bg-transparent'}`}
          >
            <View
              className={`absolute inset-0 ${pickerVisible ? 'bottom-[75%]' : 'bottom-full'}`}
              onClick={closeStudentPicker}
            />

            <View
              className={`absolute bottom-0 left-0 right-0 rounded-t-[40rpx] max-h-[75vh] flex flex-col transition-transform duration-300 ease-in-out ${pickerVisible ? 'translate-y-0' : 'translate-y-full'}`}
              style={{ backgroundColor: '#ffffff' }}
            >
              {/* 头部 */}
              <View
                className="py-8 px-10 flex items-center justify-between"
                style={{ borderBottom: '2rpx solid #D5E8E0' }}
              >
                <Text className="text-[32rpx] font-semibold text-foreground">选择学员</Text>
                <View
                  className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center"
                  onClick={closeStudentPicker}
                >
                  <Text className="text-sm text-muted-foreground">✕</Text>
                </View>
              </View>
              {/* 搜索 */}
              <View className="px-10 pt-6">
                <SheetInput
                  placeholder="搜索学员姓名..."
                  value={pickerSearch}
                  onInput={(e) => setPickerSearch(e.detail.value || '')}
                />
              </View>
              {/* 列表 */}
              <ScrollView scrollY className="flex-1 px-10 py-4 max-h-[50vh]">
                {filteredStudents.map((stu) => {
                  const checked = pickerTempIds.includes(stu.id);
                  return (
                    <View
                      key={stu.id}
                      className="flex items-center gap-5 py-5"
                      style={{ borderBottom: '2rpx solid #e8e8e8' }}
                      onClick={() => togglePickerStudent(stu.id)}
                    >
                      {/* 头像 */}
                      <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="md" />
                      {/* 姓名+电话 */}
                      <View className="flex-1">
                        <View className="text-[26rpx] font-medium text-foreground">{stu.name}</View>
                        {stu.phone && (
                          <View className="text-[20rpx] text-muted-foreground mt-0_d5">
                            {stu.phone}
                          </View>
                        )}
                      </View>
                      {/* 勾选框 */}
                      <View
                        className={`w-[44rpx] h-[44rpx] rounded-md border-[4rpx] flex items-center justify-center flex-shrink-0 ${checked ? 'border-primary bg-primary' : 'bg-transparent'}`}
                        style={checked ? undefined : { borderColor: '#D5E8E0' }}
                      >
                        {checked && <Text className="text-[28rpx] text-white font-bold">✓</Text>}
                      </View>
                    </View>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <View className="py-20 text-center">
                    <Text className="text-[26rpx] text-muted-foreground">暂无匹配学员</Text>
                  </View>
                )}
              </ScrollView>
              {/* 底部 */}
              <View
                className="py-6 px-10 pb-[68rpx] flex items-center gap-5"
                style={{ borderTop: '2rpx solid #D5E8E0' }}
              >
                <Text className="text-[26rpx] text-muted-foreground flex-1">
                  已选 <Text className="text-primary font-semibold">{pickerTempIds.length}</Text> 人
                </Text>
                <View
                  className="py-5 px-12 rounded-[28rpx] bg-gradient-primary text-white text-md font-semibold"
                  onClick={confirmStudentPicker}
                >
                  确认添加
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ===== 课程包选择器弹窗 ===== */}
        {showPackagePicker && (
          <View
            className={`fixed inset-0 z-200 transition-colors duration-300 ${packagePickerVisible ? 'bg-black/45' : 'bg-transparent'}`}
          >
            <View
              className={`absolute inset-0 ${packagePickerVisible ? 'bottom-[70%]' : 'bottom-full'}`}
              onClick={() => {
                setPackagePickerVisible(false);
                setTimeout(() => setShowPackagePicker(false), 300);
              }}
            />
            <View
              className={`absolute bottom-0 left-0 right-0 rounded-t-[40rpx] max-h-[70vh] flex flex-col transition-transform duration-300 ease-in-out ${packagePickerVisible ? 'translate-y-0' : 'translate-y-full'}`}
              style={{ backgroundColor: '#ffffff' }}
            >
              {/* 头部 */}
              <View
                className="py-8 px-10 flex items-center justify-between"
                style={{ borderBottom: '2rpx solid #D5E8E0' }}
              >
                <Text className="text-[32rpx] font-semibold text-foreground">选择课程包</Text>
                <View
                  className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center"
                  onClick={() => {
                    setPackagePickerVisible(false);
                    setTimeout(() => setShowPackagePicker(false), 300);
                  }}
                >
                  <Text className="text-sm text-muted-foreground">✕</Text>
                </View>
              </View>
              {/* 列表 */}
              <ScrollView scrollY className="flex-1 px-10 py-6 max-h-[50vh]">
                {packageTemplates.map((pkg) => {
                  const selected = selectedPackageId === pkg.id;
                  const typeLabel = PACKAGE_TYPE_LABELS[pkg.type] || '课时包';
                  return (
                    <View
                      key={pkg.id}
                      className={`py-6 rounded-[24rpx] mb-4 border-[4rpx] ${selected ? 'border-primary bg-primary-bg' : ''}`}
                      style={
                        selected
                          ? undefined
                          : { backgroundColor: '#f5faf8', borderColor: '#D5E8E0' }
                      }
                      onClick={() => {
                        setSelectedPackageId(selected ? '' : pkg.id);
                      }}
                    >
                      <View className="flex items-center justify-between">
                        <View className="flex-1">
                          <View className="flex items-center gap-3">
                            <Text className="text-md font-semibold text-foreground">
                              {pkg.name}
                            </Text>
                            <View className="text-[20rpx] text-primary bg-primary-bg py-0_d5 px-3 rounded-lg font-medium">
                              {typeLabel}
                            </View>
                          </View>
                          <View className="text-[22rpx] text-muted-foreground mt-2">
                            ¥{pkg.price} · {pkg.lesson_count}课时 · {pkg.duration}分钟/节
                          </View>
                          {pkg.description && (
                            <View className="text-[20rpx] text-muted-foreground mt-1">
                              {pkg.description}
                            </View>
                          )}
                        </View>
                        {selected && <Text className="text-[32rpx] text-primary font-bold">✓</Text>}
                      </View>
                    </View>
                  );
                })}
                {packageTemplates.length === 0 && (
                  <View className="py-20 text-center">
                    <Text className="text-[26rpx] text-muted-foreground block mb-6">
                      暂无课程包
                    </Text>
                    <View
                      className="text-[26rpx] text-primary font-medium py-4 px-8 rounded-[28rpx] bg-primary-bg inline-block"
                      onClick={() => Taro.navigateTo({ url: '/pages/course-packages/index' })}
                    >
                      去添加课程包
                    </View>
                  </View>
                )}
              </ScrollView>
              {/* 底部 */}
              <View
                className="py-6 px-10 pb-[68rpx] flex gap-4"
                style={{ borderTop: '2rpx solid #D5E8E0' }}
              >
                <View
                  className="flex-1 py-5 rounded-[28rpx] text-muted-foreground text-md font-medium text-center"
                  style={{ backgroundColor: '#f5faf8', border: '2rpx solid #D5E8E0' }}
                  onClick={() => Taro.navigateTo({ url: '/pages/course-packages/index' })}
                >
                  + 新建课程包
                </View>
                <View
                  className="flex-1 py-5 rounded-[28rpx] bg-gradient-primary text-white text-md font-semibold text-center"
                  onClick={() => {
                    setPackagePickerVisible(false);
                    setTimeout(() => setShowPackagePicker(false), 300);
                  }}
                >
                  确认
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // 骨架屏（导航栏始终显示）
  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle">
          {/* 导航栏 */}
          <View className="bg-gradient-primary px-5 pt-10 pb-5">
            <View className="flex items-center justify-between">
              <Text className="text-2xl font-bold text-white">班级管理</Text>
            </View>
            {/* 搜索框 + 创建按钮 */}
            <View className="flex items-center gap-2 mt-3">
              <View className="flex-1 rounded-xl px-4 py-2_d5 flex items-center gap-2 bg-glass-25">
                <Text className="text-white/60 text-sm">🔍</Text>
                <Input
                  className="flex-1 text-sm text-white"
                  placeholder="搜索班级..."
                  placeholderClass="text-white/60"
                  value={searchQuery}
                  onInput={(e) => setSearchQuery(e.detail.value)}
                />
                {searchQuery && (
                  <Text className="text-white/60 text-xs" onClick={() => setSearchQuery('')}>
                    ✕
                  </Text>
                )}
              </View>
              <View
                className="w-10 h-10 rounded-xl bg-white/25 center press-scale"
                onClick={openCreateSheet}
              >
                <Text className="text-white text-lg font-bold">+</Text>
              </View>
            </View>
            {/* 统计条 */}
            <View className="mt-3 rounded-xl px-4 py-3 flex bg-glass-15">
              <View className="flex-1 center-col">
                <Text className="text-white text-lg font-bold">{stats.totalClasses}</Text>
                <Text className="text-white/70 text-sm">班级总数</Text>
              </View>
              <View className="w-px h-10 bg-white/20" />
              <View className="flex-1 center-col">
                <Text className="text-white text-lg font-bold">{stats.totalStudents}</Text>
                <Text className="text-white/70 text-sm">学生总数</Text>
              </View>
              <View className="w-px h-10 bg-white/20" />
              <View className="flex-1 center-col">
                <Text className="text-white text-lg font-bold">{stats.totalUsedLessons}</Text>
                <Text className="text-white/70 text-sm">已消课时</Text>
              </View>
            </View>
          </View>
          {/* 骨架卡片 */}
          <View className="px-5 mt-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <View key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <View className="flex items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-gray-100" />
                  <View className="flex-1">
                    <View className="h-4 w-24 bg-gray-100 rounded mb-2" />
                    <View className="h-3 w-32 bg-gray-100 rounded" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
        {renderCreateSheet()}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-gradient-subtle pb-20">
        {/* 导航栏 */}
        <View className="bg-gradient-primary px-5 pt-10 pb-5">
          <View className="flex items-center justify-between">
            <Text className="text-2xl font-bold text-white">班级管理</Text>
          </View>
          {/* 统计条 */}
          <View className="mt-3 rounded-xl px-4 py-3 flex bg-white/20">
            <View className="flex-1 center-col">
              <Text className="text-white text-xl font-bold">{stats.totalClasses}</Text>
              <Text className="text-white/90 text-xs mt-[2rpx]">班级总数</Text>
            </View>
            <View className="w-px h-10 bg-white/25" />
            <View className="flex-1 center-col">
              <Text className="text-white text-xl font-bold">{stats.totalStudents}</Text>
              <Text className="text-white/90 text-xs mt-[2rpx]">学生总数</Text>
            </View>
            <View className="w-px h-10 bg-white/25" />
            <View className="flex-1 center-col">
              <Text className="text-white text-xl font-bold">{stats.totalUsedLessons}</Text>
              <Text className="text-white/90 text-xs mt-[2rpx]">已消课时</Text>
            </View>
          </View>
          {/* 搜索框 + 创建按钮 */}
          <View className="flex items-center gap-2 mt-3">
            <View className="flex-1 rounded-xl px-4 py-2_d5 flex items-center gap-2 bg-glass-25">
              <Text className="text-white/60 text-sm">🔍</Text>
              <Input
                className="flex-1 text-sm text-white"
                placeholder="搜索班级..."
                placeholderClass="text-white/60"
                value={searchQuery}
                onInput={(e) => setSearchQuery(e.detail.value)}
              />
              {searchQuery && (
                <Text className="text-white/60 text-xs" onClick={() => setSearchQuery('')}>
                  ✕
                </Text>
              )}
            </View>
            <View
              className="w-10 h-10 rounded-xl bg-white/25 center press-scale"
              onClick={openCreateSheet}
            >
              <Text className="text-white text-lg font-bold">+</Text>
            </View>
          </View>
        </View>

        {/* Tab筛选栏 */}
        <View className="bg-white shadow-sm">
          <View className="flex">
            {TABS.map((tab) => (
              <View
                key={tab.key}
                className={`flex-1 flex items-center justify-center py-3_d5 relative ${activeTab === tab.key ? '' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Text
                  className={`text-base font-medium ${activeTab === tab.key ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {tab.label}
                </Text>
                {activeTab === tab.key && (
                  <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* 班级列表 */}
        {filteredClasses.length === 0 ? (
          <View className="flex flex-col items-center justify-center pt-40">
            <Text className="text-4xl mb-4">📭</Text>
            <Text className="text-foreground text-base font-semibold mb-2">
              {searchQuery
                ? '没有找到匹配的班级'
                : activeTab === 'active'
                  ? '暂无进行中班级'
                  : activeTab === 'ended'
                    ? '暂无已结课班级'
                    : '暂无班级'}
            </Text>
            <Text className="text-muted-foreground text-sm mb-6">
              {searchQuery ? '试试其他关键词' : '点击下方按钮创建第一个班级'}
            </Text>
            {!searchQuery && (
              <View
                className="btn-primary px-8 text-base text-primary-foreground font-medium"
                onClick={openCreateSheet}
              >
                <Text className="text-white text-base font-medium">创建班级</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="px-5 pt-4 flex flex-col gap-4">
            {groupedClasses.map((group) => (
              <View key={group.title}>
                {/* 分组标题 */}
                <View className="flex items-baseline gap-1 mb-2">
                  <Text className="text-sm font-medium text-muted-foreground">{group.title}</Text>
                  {group.subtitle && (
                    <Text className="text-xs text-muted-foreground/60">（{group.subtitle}）</Text>
                  )}
                </View>
                {/* 班级卡片 */}
                <View className="flex flex-col gap-2_d5">
                  {group.classes.map((cls) => (
                    <View
                      key={cls.id}
                      className="bg-white rounded-2xl p-4 shadow-soft press-bg"
                      onClick={() => goDetail(cls.id)}
                      onLongPress={() => handleDelete(cls.id, cls.name)}
                    >
                      <View className="flex items-center gap-3">
                        {/* 图标 */}
                        <View
                          className={`w-10 h-10 rounded-xl ${CLASS_GRADIENT[cls.color]} flex items-center justify-center flex-shrink-0`}
                        >
                          <Text className="text-lg">{CLASS_ICONS[cls.color]}</Text>
                        </View>
                        {/* 信息 */}
                        <View className="flex-1 min-w-0">
                          <View className="flex items-center gap-2">
                            <Text className="text-base font-semibold text-foreground truncate">
                              {cls.name}
                            </Text>
                            {renderStatusTag(cls)}
                            {renderTypeTag(cls)}
                          </View>
                          <View className="flex items-center gap-3 mt-1">
                            <View className="flex items-center gap-1">
                              <Text className="text-sm text-muted-foreground">👤</Text>
                              <Text className="text-sm text-muted-foreground">
                                {cls.student_count}人
                              </Text>
                            </View>
                            {cls.schedule && (
                              <View className="flex items-center gap-1">
                                <Text className="text-sm text-muted-foreground">📅</Text>
                                <Text className="text-sm text-muted-foreground truncate">
                                  {cls.schedule}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {/* 进度/操作 */}
                        <View className="flex-shrink-0">{renderProgress(cls)}</View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
      {renderCreateSheet()}
    </PageContainer>
  );
};

export default withRouteGuard(ClassesPage);
