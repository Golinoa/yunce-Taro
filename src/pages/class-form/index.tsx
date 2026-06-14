import { View, Text, Input, Picker, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import CardHeader from '@/components/CardHeader';
import ChipPicker from '@/components/ChipPicker';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import SegmentedControl from '@/components/SegmentedControl';
import { classService, studentService } from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import type { ClassType } from '@/types/class';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const TEACHER_LIST = ['王老师', '李老师', '张老师', '赵老师'];

/** 表单错误 */
interface FormErrors {
  name?: string;
  totalLessons?: string;
  weekdays?: string;
  teachers?: string;
}

const ClassForm: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const studentStore = useStudentStore();
  const classStore = useClassStore();

  const classId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);
  const isEdit = !!classId;

  // ===== 表单字段 =====
  const [name, setName] = useState('');
  const [classType, setClassType] = useState<ClassType>('unlimited');
  const [totalLessons, setTotalLessons] = useState('');
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teachers, setTeachers] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // ===== 弹窗状态 =====
  const [sheetVisible, setSheetVisible] = useState(false);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTempIds, setPickerTempIds] = useState<string[]>([]);

  // ===== 初始化 =====
  useEffect(() => {
    const init = async () => {
      const stuList = await studentStore.fetchByTeacher(currentUserId);
      setAllStudents(stuList);
      if (isEdit && classId) {
        const cls = await classService.getById(classId);
        if (cls) {
          setName(cls.name);
          setClassType(cls.type === 'ended' ? 'unlimited' : cls.type);
          setTotalLessons(cls.total_lessons ? String(cls.total_lessons) : '');
          setWeekdays(cls.weekdays || []);
          setStartTime(cls.start_time || '14:00');
          setEndTime(cls.end_time || '15:30');
          setStartDate(cls.start_date || '');
          setEndDate(cls.end_date || '');
          setTeachers(cls.teachers || []);
        }
        const classStudents = await classService.getStudents(classId);
        setSelectedStudentIds(classStudents.map((s) => s.id));
      }
    };
    init();
  }, [classId, isEdit, currentUserId]);

  // 进入动画
  useEffect(() => {
    setTimeout(() => setSheetVisible(true), 50);
  }, []);

  // ===== 计算属性 =====
  const scheduleText = useMemo(() => {
    if (weekdays.length === 0 || !startTime || !endTime) return '';
    const dayOrder = ['一', '二', '三', '四', '五', '六', '日'];
    const sorted = [...weekdays].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    return `每周${sorted.join('、')} ${startTime}-${endTime}`;
  }, [weekdays, startTime, endTime]);

  const filteredStudents = useMemo(() => {
    if (!pickerSearch) return allStudents;
    const kw = pickerSearch.toLowerCase();
    return allStudents.filter(
      (s) => s.name.toLowerCase().includes(kw) || (s.phone || '').includes(kw),
    );
  }, [allStudents, pickerSearch]);

  // ===== 表单校验 =====
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};

    if (!name.trim()) {
      errs.name = '请输入班级名称';
    } else if (name.trim().length > 20) {
      errs.name = '班级名称最多20个字';
    }

    if (weekdays.length === 0) {
      errs.weekdays = '请选择上课时间';
    }

    if (teachers.length === 0) {
      errs.teachers = '请选择授课老师';
    }

    if (classType === 'limited') {
      const n = parseInt(totalLessons);
      if (!totalLessons || isNaN(n) || n <= 0) {
        errs.totalLessons = '请输入有效的课时数';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, weekdays, teachers, classType, totalLessons]);

  // 清除某个字段的错误
  const clearError = useCallback((field: keyof FormErrors) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ===== 事件处理 =====
  const toggleWeekday = useCallback(
    (day: string) => {
      setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
      clearError('weekdays');
    },
    [clearError],
  );

  const toggleTeacher = useCallback(
    (t: string) => {
      setTeachers((prev) => (prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]));
      clearError('teachers');
    },
    [clearError],
  );

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

  const handleClose = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => Taro.navigateBack(), 300);
  }, []);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单中的错误', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const schedule = scheduleText;
      const baseData = {
        teacher_id: currentUserId,
        name: name.trim(),
        type: classType,
        status: 'active' as const,
        schedule,
        weekdays,
        start_time: startTime,
        end_time: endTime,
        teachers,
        color: 'primary' as const,
        used_lessons: 0,
        student_count: 0,
        ...(classType === 'limited'
          ? { total_lessons: parseInt(totalLessons), start_date: startDate, end_date: endDate }
          : {}),
      };

      if (isEdit && classId) {
        await classService.update(classId, baseData);
        const currentStudents = await classService.getStudents(classId);
        const currentIds = currentStudents.map((s) => s.id);
        const toAdd = selectedStudentIds.filter((id) => !currentIds.includes(id));
        const toRemove = currentIds.filter((id) => !selectedStudentIds.includes(id));
        for (const sid of toAdd) await classService.addStudents(classId, [sid]);
        for (const sid of toRemove) await classService.removeStudent(classId, sid);
        classStore.invalidate(currentUserId);
        studentStore.invalidate(currentUserId);
      } else {
        const cls = await classService.create(baseData);
        if (cls && selectedStudentIds.length > 0)
          await classService.addStudents(cls.id, selectedStudentIds);
        classStore.invalidate(currentUserId);
        studentStore.invalidate(currentUserId);
      }

      Taro.showToast({ title: isEdit ? '保存成功' : '创建成功', icon: 'success' });
      setSheetVisible(false);
      setTimeout(() => Taro.navigateBack(), 300);
    } catch (err) {
      logError('save class', err);
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    isEdit,
    classId,
    name,
    classType,
    weekdays,
    startTime,
    endTime,
    teachers,
    totalLessons,
    startDate,
    endDate,
    selectedStudentIds,
    scheduleText,
    currentUserId,
  ]);

  // ===== 渲染 =====
  return (
    <View
      className={`fixed inset-0 z-100 transition-colors duration-300 ${sheetVisible ? 'bg-black/45' : 'bg-transparent'}`}
    >
      {/* 点击遮罩关闭 */}
      <View
        className={`absolute inset-0 ${sheetVisible ? 'bottom-[70%]' : 'bottom-full'}`}
        onClick={handleClose}
      />

      {/* 创建班级底部弹窗 */}
      <View
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[40rpx] px-8 pt-8 pb-safe-bar transition-transform duration-300 ease-in-out max-h-[90vh] overflow-y-auto ${sheetVisible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle */}
        <View className="w-[72rpx] h-[8rpx] rounded-full bg-border mx-auto mb-6" />

        {/* 标题 */}
        <View className="flex items-center justify-between mb-6">
          <Text className="text-lg font-bold text-foreground">
            {isEdit ? '编辑班级' : '创建班级'}
          </Text>
          <View
            className="w-[48rpx] h-[48rpx] rounded-full bg-muted flex items-center justify-center press-scale"
            onClick={handleClose}
          >
            <Icon name="mdi-close" size="sm" color="muted" />
          </View>
        </View>

        {/* ===== 1. 基础信息卡片 ===== */}
        <Card shadow="soft" padding="lg" className="mb-6">
          <CardHeader title="基础信息" />
          <View className="flex flex-col gap-[24rpx]">
            {/* 班级名称 */}
            <FormInput
              label="班级名称"
              required
              placeholder="如：钢琴基础班"
              value={name}
              onInput={(e) => {
                setName(e.detail.value || '');
                clearError('name');
              }}
              error={errors.name}
            />

            {/* 上课类型 */}
            <View className="flex flex-col">
              <View className="flex items-center gap-1 mb-[12rpx]">
                <Text className="text-sm text-muted-foreground font-medium">上课类型</Text>
              </View>
              <SegmentedControl
                options={[
                  { label: '循环上课', value: 'unlimited' },
                  { label: '课时制', value: 'limited' },
                ]}
                value={classType}
                onChange={(val) => setClassType(val as ClassType)}
              />
              <View className="flex gap-[12rpx] mt-3">
                <View className="flex-1 py-2 px-3 rounded-xl bg-primary-5">
                  <Text className="text-xs text-primary font-medium">
                    {classType === 'unlimited' ? '长期班，不限课时' : '特训班，有限课时'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 总课时数（仅课时制） */}
            {classType === 'limited' && (
              <FormInput
                label="总课时数"
                required
                type="number"
                placeholder="如：16"
                value={totalLessons}
                onInput={(e) => {
                  setTotalLessons(e.detail.value || '');
                  clearError('totalLessons');
                }}
                error={errors.totalLessons}
              />
            )}
          </View>
        </Card>

        {/* ===== 2. 上课时间卡片 ===== */}
        <Card shadow="soft" padding="lg" className="mb-6">
          <CardHeader title="上课时间" dotColor="warning" />
          <View className="flex flex-col gap-[24rpx]">
            {/* 星期选择器 */}
            <View className="flex flex-col">
              <View className="flex items-center gap-1 mb-[12rpx]">
                <Text className="text-sm text-muted-foreground font-medium">上课星期</Text>
                <Text className="text-xs text-destructive">*</Text>
              </View>
              <View className="flex gap-[12rpx] flex-wrap">
                {WEEKDAYS.map((day) => {
                  const selected = weekdays.includes(day);
                  return (
                    <View
                      key={day}
                      className={`w-[64rpx] h-[64rpx] rounded-full flex items-center justify-center text-sm font-semibold press-scale ${selected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
                      onClick={() => toggleWeekday(day)}
                    >
                      {day}
                    </View>
                  );
                })}
              </View>
              {errors.weekdays && (
                <View className="flex items-center gap-1 mt-2">
                  <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                    <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
                  </View>
                  <Text className="text-xs text-destructive">{errors.weekdays}</Text>
                </View>
              )}
            </View>

            {/* 时间段选择 */}
            <View className="flex flex-col">
              <View className="flex items-center gap-1 mb-[12rpx]">
                <Text className="text-sm text-muted-foreground font-medium">上课时段</Text>
              </View>
              <View className="flex gap-4 items-center">
                <Picker
                  mode="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.detail.value)}
                >
                  <View
                    className="flex-1 py-[22rpx] px-[28rpx] rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
                  >
                    <Text className="text-base text-foreground">{startTime}</Text>
                  </View>
                </Picker>
                <Text className="text-base text-muted-foreground flex-shrink-0">—</Text>
                <Picker mode="time" value={endTime} onChange={(e) => setEndTime(e.detail.value)}>
                  <View
                    className="flex-1 py-[22rpx] px-[28rpx] rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
                  >
                    <Text className="text-base text-foreground">{endTime}</Text>
                  </View>
                </Picker>
              </View>
            </View>

            {/* 排课预览 */}
            {scheduleText && (
              <View className="py-3 px-4 rounded-xl bg-primary-5">
                <Text className="text-sm text-primary font-medium">{scheduleText}</Text>
              </View>
            )}

            {/* 上课日期范围（仅课时制） */}
            {classType === 'limited' && (
              <View className="flex flex-col">
                <View className="flex items-center gap-1 mb-[12rpx]">
                  <Text className="text-sm text-muted-foreground font-medium">上课日期范围</Text>
                </View>
                <View className="flex gap-4">
                  <Picker
                    mode="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.detail.value)}
                  >
                    <View
                      className={`flex-1 py-[22rpx] px-[28rpx] rounded-2xl flex items-center justify-center ${startDate ? 'text-foreground' : 'text-muted-foreground'}`}
                      style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
                    >
                      <Text className="text-base">{startDate || '开始日期'}</Text>
                    </View>
                  </Picker>
                  <Picker mode="date" value={endDate} onChange={(e) => setEndDate(e.detail.value)}>
                    <View
                      className={`flex-1 py-[22rpx] px-[28rpx] rounded-2xl flex items-center justify-center ${endDate ? 'text-foreground' : 'text-muted-foreground'}`}
                      style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
                    >
                      <Text className="text-base">{endDate || '结束日期'}</Text>
                    </View>
                  </Picker>
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* ===== 3. 授课老师卡片 ===== */}
        <Card shadow="soft" padding="lg" className="mb-6">
          <CardHeader title="授课老师" dotColor="info" />
          <View className="flex flex-col gap-[16rpx]">
            <View className="flex items-center gap-1 mb-[12rpx]">
              <Text className="text-sm text-muted-foreground font-medium">选择老师</Text>
              <Text className="text-xs text-destructive">*</Text>
            </View>
            <ChipPicker
              options={TEACHER_LIST.map((t) => ({ label: t, value: t }))}
              value={teachers.join(',')}
              onChange={(val) => {
                const selected = val.split(',').filter(Boolean);
                setTeachers(selected);
                clearError('teachers');
              }}
              multiSelect
            />
            {errors.teachers && (
              <View className="flex items-center gap-1 mt-2">
                <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                  <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
                </View>
                <Text className="text-xs text-destructive">{errors.teachers}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* ===== 4. 添加学员 ===== */}
        <Card shadow="soft" padding="lg" className="mb-6">
          <CardHeader title="学员管理" subtitle="选填" />
          <View
            className="flex items-center gap-4 py-[22rpx] px-[28rpx] rounded-2xl press-scale"
            onClick={openStudentPicker}
            style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
          >
            <Icon name="mdi-account-plus" size="md" color="primary" />
            <Text className="text-base text-muted-foreground">选择学员</Text>
            {selectedStudentIds.length > 0 && (
              <View className="ml-auto py-1 px-3 rounded-xl bg-primary-5">
                <Text className="text-xs font-semibold text-primary">
                  {selectedStudentIds.length}人
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* ===== 确认按钮 ===== */}
        <View
          className={`w-full py-[30rpx] rounded-[48rpx] flex items-center justify-center gap-2 transition press-scale ${saving ? 'bg-border state-loading' : 'bg-gradient-primary'}`}
          style={!saving ? { background: 'linear-gradient(135deg, #5EC8A8, #4AB893)' } : {}}
          onClick={saving ? undefined : handleSave}
        >
          <Text className="text-lg font-bold text-white">
            {saving ? '保存中...' : isEdit ? '保存修改' : '确认创建'}
          </Text>
        </View>
      </View>

      {/* ===== 学员选择器弹窗 ===== */}
      {showStudentPicker && (
        <BottomSheet
          show={showStudentPicker}
          visible={pickerVisible}
          title="选择学员"
          onClose={closeStudentPicker}
          maxHeight="70vh"
        >
          {/* 搜索 */}
          <View className="px-8 pt-4 pb-2">
            <View
              className="py-[18rpx] px-[24rpx] rounded-xl"
              style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
            >
              <Input
                className="w-full text-sm text-foreground"
                placeholder="搜索学员姓名或手机号"
                value={pickerSearch}
                onInput={(e) => setPickerSearch(e.detail.value || '')}
              />
            </View>
          </View>

          {/* 列表 */}
          <ScrollView scrollY className="flex-1 px-8 py-4 max-h-[50vh]">
            {filteredStudents.map((stu) => {
              const checked = pickerTempIds.includes(stu.id);
              return (
                <View
                  key={stu.id}
                  className={`flex items-center gap-5 py-5 border-b border-border press-scale ${checked ? 'bg-primary-5 -mx-4 px-4 rounded-2xl' : ''}`}
                  onClick={() => togglePickerStudent(stu.id)}
                >
                  <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="md" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-medium text-foreground block">{stu.name}</Text>
                    {stu.phone && (
                      <Text className="text-xs text-muted-foreground block mt-1">{stu.phone}</Text>
                    )}
                  </View>
                  <View
                    className={`w-[44rpx] h-[44rpx] rounded-md border-[4rpx] flex items-center justify-center flex-shrink-0 ${checked ? 'border-primary bg-primary' : 'border-border bg-transparent'}`}
                  >
                    {checked && <Text className="text-[28rpx] text-white font-bold">✓</Text>}
                  </View>
                </View>
              );
            })}
            {filteredStudents.length === 0 && (
              <View className="py-10 text-center">
                <Text className="text-base text-muted-foreground">暂无匹配学员</Text>
              </View>
            )}
          </ScrollView>

          {/* 底部确认 */}
          <View className="py-6 px-8 pb-safe-bar border-t border-border flex items-center gap-5">
            <Text className="text-sm text-muted-foreground flex-1">
              已选 <Text className="text-primary font-semibold">{pickerTempIds.length}</Text> 人
            </Text>
            <View
              className="py-5 px-12 rounded-[28rpx] bg-gradient-primary press-scale"
              style={{ background: 'linear-gradient(135deg, #5EC8A8, #4AB893)' }}
              onClick={confirmStudentPicker}
            >
              <Text className="text-base font-semibold text-white">确认添加</Text>
            </View>
          </View>
        </BottomSheet>
      )}
    </View>
  );
};

export default withRouteGuard(ClassForm);
