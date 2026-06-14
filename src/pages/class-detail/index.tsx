import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { classService, studentService } from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import type { Class, ClassColor, CheckinRecord } from '@/types/class';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

// ===== 常量 =====
const CLASS_ICONS: Record<ClassColor, string> = {
  primary: '🎹',
  accent: '💃',
  amber: '🎯',
  info: '❄️',
  purple: '📚',
};

const CLASS_GRADIENT: Record<ClassColor, string> = {
  primary: 'bg-class-primary',
  accent: 'bg-class-accent',
  amber: 'bg-class-amber',
  info: 'bg-class-info',
  purple: 'bg-class-purple',
};

// 格式化日期为中文
function formatDateCN(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// 生成模拟签到记录
function generateMockCheckinRecords(cls: Class, students: Student[]): CheckinRecord[] {
  const isEnded = cls.status === 'ended';
  const count = isEnded ? 5 : 3;
  const records: CheckinRecord[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (i + 1) * 3);
    const checkinCount = Math.min(
      students.length,
      Math.max(1, students.length - Math.floor(Math.random() * 3)),
    );
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const checkedStudents = shuffled.slice(0, checkinCount).map((s) => s.name);
    records.push({
      date: `${date.getMonth() + 1}月${date.getDate()}日`,
      count: checkinCount,
      teacher: cls.teachers?.[0] || '老师',
      students: checkedStudents,
    });
  }
  return records;
}

const ClassDetail: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const studentStore = useStudentStore();
  const classStore = useClassStore();
  const classId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // 添加学员弹窗
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [addSearchQuery, setAddSearchQuery] = useState('');

  // 调班弹窗
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [transferStudentId, setTransferStudentId] = useState('');
  const [transferStudentName, setTransferStudentName] = useState('');
  const [allClasses, setAllClasses] = useState<Class[]>([]);

  // 签到记录展开状态
  const [expandedCheckins, setExpandedCheckins] = useState<Set<number>>(new Set());
  const [expandedMore, setExpandedMore] = useState<Set<number>>(new Set());

  // 模拟签到记录
  const checkinRecords = useMemo(() => {
    if (!classInfo) return [];
    return generateMockCheckinRecords(classInfo, students);
  }, [classInfo, students]);

  const isEnded = classInfo?.status === 'ended';
  const isUnlimited = classInfo?.type === 'unlimited';

  // 加载数据
  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const cls = await classService.getById(classId);
      if (!cls) return;
      setClassInfo(cls);
      const stuList = await classService.getStudents(classId);
      setStudents(stuList);
    } catch (err) {
      logError('load class detail', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===== 操作 =====

  // 跳转消课
  const goLessonForm = useCallback(() => {
    Taro.navigateTo({ url: `/pages/lesson-form/index?classId=${encodeURIComponent(classId)}` });
  }, [classId]);

  // 跳转编辑
  const goEdit = useCallback(() => {
    Taro.navigateTo({ url: `/pages/class-form/index?id=${encodeURIComponent(classId)}` });
  }, [classId]);

  // 跳转学生详情
  const goStudentDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/student-detail/index?id=${encodeURIComponent(id)}` });
  }, []);

  // 结课
  const handleEndClass = useCallback(async () => {
    if (!classInfo) return;
    const { confirm } = await Taro.showModal({
      title: '结课',
      content: `确认将「${classInfo.name}」标记为已结课？`,
      confirmColor: '#9b7ed8',
    });
    if (!confirm) return;
    try {
      await classService.end(classId);
      classStore.invalidate(currentUserId);
      Taro.showToast({ title: '已结课', icon: 'success' });
      loadData();
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, [classId, classInfo, loadData]);

  // 长按学生 - 操作菜单
  const handleStudentLongPress = useCallback(
    (studentId: string, studentName: string) => {
      Taro.showActionSheet({
        itemList: ['调班', '移除'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            // 调班
            handleOpenTransfer(studentId, studentName);
          } else if (res.tapIndex === 1) {
            // 移除
            const { confirm } = await Taro.showModal({
              title: '移出班级',
              content: `确认将「${studentName}」从班级移出？`,
              confirmColor: '#ef4444',
            });
            if (!confirm) return;
            try {
              await classService.removeStudent(classId, studentId);
              studentStore.invalidate(currentUserId);
              Taro.showToast({ title: '已移出', icon: 'success' });
              loadData();
            } catch {
              Taro.showToast({ title: '操作失败', icon: 'none' });
            }
          }
        },
      });
    },
    [classId, loadData],
  );

  // ===== 添加学员弹窗 =====
  const handleOpenAdd = useCallback(async () => {
    try {
      const allStudents = await studentStore.fetchByTeacher(currentUserId);
      const currentIds = new Set(students.map((s) => s.id));
      setAvailableStudents(allStudents.filter((s) => !currentIds.has(s.id)));
      setSelectedStudentIds(new Set());
      setAddSearchQuery('');
      setShowAddSheet(true);
    } catch (err) {
      logError('load available students', err);
    }
  }, [students, currentUserId]);

  const toggleAddStudent = useCallback((id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    if (selectedStudentIds.size === 0) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }
    try {
      await classService.addStudents(classId, [...selectedStudentIds]);
      studentStore.invalidate(currentUserId);
      Taro.showToast({ title: '添加成功', icon: 'success' });
      setShowAddSheet(false);
      loadData();
    } catch {
      Taro.showToast({ title: '添加失败', icon: 'none' });
    }
  }, [classId, selectedStudentIds, loadData]);

  const filteredAvailableStudents = useMemo(() => {
    if (!addSearchQuery.trim()) return availableStudents;
    const q = addSearchQuery.trim().toLowerCase();
    return availableStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)),
    );
  }, [availableStudents, addSearchQuery]);

  // ===== 调班弹窗 =====
  const handleOpenTransfer = useCallback(
    async (studentId: string, studentName: string) => {
      setTransferStudentId(studentId);
      setTransferStudentName(studentName);
      try {
        const classes = await classStore.fetchByTeacher(currentUserId);
        setAllClasses(classes);
        setShowTransferSheet(true);
      } catch (err) {
        logError('load classes for transfer', err);
      }
    },
    [currentUserId],
  );

  const handleConfirmTransfer = useCallback(
    async (targetClassId: string) => {
      try {
        await classService.transferStudent(classId, targetClassId, transferStudentId);
        classStore.invalidate(currentUserId);
        studentStore.invalidate(currentUserId);
        Taro.showToast({ title: '调班成功', icon: 'success' });
        setShowTransferSheet(false);
        loadData();
      } catch {
        Taro.showToast({ title: '调班失败', icon: 'none' });
      }
    },
    [classId, transferStudentId, loadData],
  );

  // ===== 签到记录展开 =====
  const toggleCheckinExpand = useCallback((idx: number) => {
    setExpandedCheckins((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleMoreStudents = useCallback((idx: number) => {
    setExpandedMore((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // ===== 加载中 =====
  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (!classInfo) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Text className="text-lg text-muted-foreground">班级不存在</Text>
        </View>
      </PageContainer>
    );
  }

  const color = isEnded ? 'purple' : classInfo.color;

  // ===== 渲染 =====
  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle">
        {/* ====== 1. 头部区域 ====== */}
        <View className={`${CLASS_GRADIENT[color]} px-6 pt-10 pb-8`}>
          <View className="flex items-center gap-4">
            {/* 渐变图标 */}
            <View className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center flex-shrink-0">
              <Text className="text-2xl">{CLASS_ICONS[color]}</Text>
            </View>
            {/* 班级名称 + 类型标签 */}
            <View className="flex-1 min-w-0">
              <Text className="text-white text-xl font-bold block truncate">{classInfo.name}</Text>
              <View className="flex items-center gap-2 mt-1">
                {isEnded ? (
                  <View className="tag-purple">已结课</View>
                ) : isUnlimited ? (
                  <View className="tag-white">∞ 循环</View>
                ) : (
                  <View className="tag-white">{classInfo.total_lessons}课时制</View>
                )}
              </View>
            </View>
          </View>

          {/* 统计卡片已移至内容区 */}
        </View>

        {/* ====== 2. 内容区域 ====== */}
        <View className="px-5 -mt-4 relative z-10 pb-32">
          {/* 统计卡片 - 3列 */}
          {isEnded ? (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <View className="grid grid-cols-3 gap-2">
                <View className="stat-card bg-purple-bg">
                  <Text className="stat-value text-purple">{classInfo.used_lessons}</Text>
                  <Text className="stat-label">已上课时</Text>
                </View>
                <View className="stat-card bg-purple-bg">
                  <Text className="stat-value text-purple">{classInfo.total_lessons}</Text>
                  <Text className="stat-label">总课时</Text>
                </View>
                <View className="stat-card bg-purple-bg">
                  <Text className="stat-value text-purple">{students.length}</Text>
                  <Text className="stat-label">学生数</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <View className="grid grid-cols-3 gap-2">
                <View className="stat-card bg-primary-bg">
                  {isUnlimited ? (
                    <Text className="stat-value text-primary">∞</Text>
                  ) : (
                    <Text className="stat-value text-primary">{classInfo.used_lessons}</Text>
                  )}
                  <Text className="stat-label">已上课时</Text>
                </View>
                <View className="stat-card bg-primary-bg">
                  {isUnlimited ? (
                    <Text className="stat-value text-primary">∞</Text>
                  ) : (
                    <Text className="stat-value text-primary">{classInfo.total_lessons}</Text>
                  )}
                  <Text className="stat-label">总课时</Text>
                </View>
                <View className="stat-card bg-primary-bg">
                  <Text className="stat-value text-primary">{students.length}</Text>
                  <Text className="stat-label">学生数</Text>
                </View>
              </View>
            </View>
          )}

          {/* 上课安排 */}
          <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
            <Text className="text-base font-semibold text-foreground block mb-2">上课安排</Text>
            {classInfo.schedule && (
              <Text className="text-sm text-muted-foreground block">{classInfo.schedule}</Text>
            )}
            {isEnded && classInfo.start_date && classInfo.end_date && (
              <Text className="text-sm text-muted-foreground block mt-1">
                {formatDateCN(classInfo.start_date)} - {formatDateCN(classInfo.end_date)}
              </Text>
            )}
            {classInfo.note && (
              <Text className="text-sm text-muted-foreground/70 block mt-2">{classInfo.note}</Text>
            )}
          </View>

          {/* 课时进度 */}
          <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
            <Text className="text-base font-semibold text-foreground block mb-3">课时进度</Text>
            {isEnded ? (
              <View>
                <View className="flex justify-between mb-2">
                  <Text className="text-sm text-muted-foreground">课时进度</Text>
                  <Text className="text-sm font-semibold text-purple">
                    {classInfo.used_lessons} / {classInfo.total_lessons} 已完成
                  </Text>
                </View>
                <View className="h-2 rounded-sm overflow-hidden bg-progress-purple-track">
                  <View className="h-full rounded-sm bg-progress-purple w-full" />
                </View>
              </View>
            ) : isUnlimited ? (
              <View>
                <View className="flex justify-between mb-2">
                  <Text className="text-sm text-muted-foreground">上课进度</Text>
                  <Text className="text-sm font-semibold text-primary">循环上课</Text>
                </View>
                <View className="h-2 rounded-sm overflow-hidden bg-progress-primary" />
              </View>
            ) : (
              <View>
                <View className="flex justify-between mb-2">
                  <Text className="text-sm text-muted-foreground">课时进度</Text>
                  <Text className="text-sm font-semibold text-primary">
                    {classInfo.used_lessons} / {classInfo.total_lessons}
                  </Text>
                </View>
                <View className="h-2 rounded-sm overflow-hidden bg-progress-primary-track">
                  <View
                    className="h-full rounded-sm bg-progress-primary"
                    style={{
                      width: `${classInfo.total_lessons ? Math.round((classInfo.used_lessons / classInfo.total_lessons) * 100) : 0}%`,
                    }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* ====== 已结课：收费与流水 ====== */}
          {isEnded && (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <Text className="text-base font-semibold text-foreground block mb-3">收费与流水</Text>
              <View className="grid grid-cols-3 gap-2">
                <View className="stat-card bg-purple-10">
                  <Text className="stat-value text-purple">¥150</Text>
                  <Text className="stat-label">每课时单价</Text>
                </View>
                <View className="stat-card bg-purple-10">
                  <Text className="stat-value text-purple">¥3,600</Text>
                  <Text className="stat-label">课包价格/人</Text>
                </View>
                <View className="stat-card bg-primary-5">
                  <Text className="stat-value text-primary">¥72,000</Text>
                  <Text className="stat-label">总流水</Text>
                </View>
              </View>
            </View>
          )}

          {/* ====== 已结课：上课记录 ====== */}
          {isEnded && checkinRecords.length > 0 && (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <Text className="text-base font-semibold text-foreground block mb-3">上课记录</Text>
              <View className="flex flex-col gap-2">
                {checkinRecords.map((record, idx) => {
                  const isExpanded = expandedCheckins.has(idx);
                  const isMoreExpanded = expandedMore.has(idx);
                  const visibleStudents = isMoreExpanded
                    ? record.students
                    : record.students.slice(0, 8);
                  const hasMore = record.students.length > 8 && !isMoreExpanded;

                  return (
                    <View
                      key={idx}
                      className="bg-background rounded-xl p-3"
                      onClick={() => toggleCheckinExpand(idx)}
                    >
                      <View className="flex items-center gap-2">
                        <View className="w-dot h-dot rounded-full bg-purple flex-shrink-0" />
                        <Text className="text-sm font-semibold text-foreground flex-1">
                          {record.date}
                        </Text>
                        <Text className="text-sm text-muted-foreground">👤 {record.count}人</Text>
                        <Text className="text-sm text-purple font-medium">👩‍🏫 {record.teacher}</Text>
                        <Text
                          className={`text-sm text-muted-foreground transition ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          ▼
                        </Text>
                      </View>
                      {isExpanded && (
                        <View className="pt-3 mt-3 border-t border-border flex flex-wrap gap-1">
                          {visibleStudents.map((name, si) => (
                            <View
                              key={si}
                              className="flex items-center gap-1 bg-white rounded-full px-2 py-1"
                            >
                              <Avatar name={name} size="sm" />
                              <Text className="text-xs text-foreground">{name}</Text>
                            </View>
                          ))}
                          {hasMore && (
                            <View
                              className="bg-purple-10 rounded-full px-3 py-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMoreStudents(idx);
                              }}
                            >
                              <Text className="text-xs text-purple font-medium">
                                +{record.students.length - 8}人
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ====== 进行中：学生列表 ====== */}
          {!isEnded && (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <View className="flex items-center justify-between mb-3">
                <Text className="text-sm font-semibold text-foreground">学生列表</Text>
                <View
                  className="flex items-center gap-1 py-1 px-3 rounded-lg border border-primary bg-primary-5"
                  onClick={handleOpenAdd}
                >
                  <Text className="text-primary text-sm font-medium">👤 添加学员</Text>
                </View>
              </View>

              {students.length === 0 ? (
                <View className="py-10 text-center">
                  <Text className="text-3xl block mb-3">📭</Text>
                  <Text className="text-sm text-muted-foreground">暂无学生，点击上方添加</Text>
                </View>
              ) : (
                <View className="flex flex-col gap-2">
                  {students.map((stu) => {
                    const remaining = (stu.course_packages || []).reduce(
                      (sum, p) => sum + (p.remaining_hours || 0),
                      0,
                    );
                    const usedHours = (stu.course_packages || []).reduce(
                      (sum, p) => sum + (p.total_hours || 0) - (p.remaining_hours || 0),
                      0,
                    );
                    return (
                      <View
                        key={stu.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-background press-bg"
                        onClick={() => goStudentDetail(stu.id)}
                        onLongPress={() => handleStudentLongPress(stu.id, stu.name)}
                      >
                        {/* 头像 */}
                        <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="sm" />
                        {/* 姓名 + 电话 */}
                        <View className="flex-1 min-w-0">
                          <Text className="text-base font-medium text-foreground truncate block">
                            {stu.name}
                          </Text>
                          {stu.phone && (
                            <Text className="text-sm text-muted-foreground block mt-0_d5">
                              {stu.phone}
                            </Text>
                          )}
                        </View>
                        {/* 已上课时 */}
                        <Text className="text-sm text-muted-foreground flex-shrink-0">
                          {isUnlimited ? `已上 ${usedHours} 课时` : `剩余 ${remaining} 课时`}
                        </Text>
                        {/* 箭头 */}
                        <Text className="text-sm text-muted-foreground/50 flex-shrink-0">›</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ====== 3. 底部操作栏 ====== */}
        <View className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-white/95 backdrop-blur-sm border-t border-input flex gap-3 z-50">
          {isEnded ? (
            <View className="btn-primary flex-1 border border-input bg-white" onClick={goEdit}>
              <Text className="text-base font-semibold text-muted-foreground">编辑</Text>
            </View>
          ) : (
            <>
              <View
                className="btn-primary flex-1 shadow-elegant bg-gradient-primary"
                onClick={goLessonForm}
              >
                <Text className="text-base font-semibold text-white">消课</Text>
              </View>
              <View className="btn-primary flex-1 border border-input bg-white" onClick={goEdit}>
                <Text className="text-base font-semibold text-muted-foreground">编辑</Text>
              </View>
              <View
                className="btn-primary flex-1 border border-purple bg-white"
                onClick={handleEndClass}
              >
                <Text className="text-base font-semibold text-purple">结课</Text>
              </View>
            </>
          )}
        </View>

        {/* ====== 添加学员弹窗 ====== */}
        {showAddSheet && (
          <View className="fixed inset-0 z-100 flex items-end">
            <View className="absolute inset-0 bg-black/40" onClick={() => setShowAddSheet(false)} />
            <View className="relative w-full bg-white rounded-t-32rpx max-h-75vh flex flex-col">
              {/* 拖拽条 */}
              <View className="flex justify-center pt-2 pb-0">
                <View className="w-9 h-1 rounded-full bg-gray-200" />
              </View>
              {/* 头部 */}
              <View
                className="flex items-center justify-between px-5 pt-3 pb-3"
                style={{ borderBottom: '2rpx solid #D5E8E0' }}
              >
                <Text className="text-base font-semibold text-foreground">选择学员</Text>
                <View
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                  onClick={() => setShowAddSheet(false)}
                >
                  <Text className="text-xs text-muted-foreground">✕</Text>
                </View>
              </View>
              {/* 搜索 */}
              <View className="px-5 pt-3">
                <View
                  className="rounded-xl px-3 py-2 flex items-center gap-2"
                  style={{ backgroundColor: '#f5faf8' }}
                >
                  <Text className="text-sm text-muted-foreground">🔍</Text>
                  <Input
                    className="flex-1 text-sm text-foreground"
                    placeholder="搜索学员姓名..."
                    placeholderClass="text-muted-foreground"
                    value={addSearchQuery}
                    onInput={(e) => setAddSearchQuery(e.detail.value)}
                  />
                </View>
              </View>
              {/* 列表 */}
              <ScrollView scrollY className="flex-1 px-5 py-3">
                {filteredAvailableStudents.length === 0 ? (
                  <View className="py-10 text-center">
                    <Text className="text-sm text-muted-foreground">所有学生都已在班级中</Text>
                  </View>
                ) : (
                  filteredAvailableStudents.map((stu) => {
                    const isSelected = selectedStudentIds.has(stu.id);
                    return (
                      <View
                        key={stu.id}
                        className={`flex items-center gap-3 py-3 ${isSelected ? 'bg-primary-5 -mx-1 px-1 rounded-lg' : ''}`}
                        style={{ borderBottom: '2rpx solid #e8e8e8' }}
                        onClick={() => toggleAddStudent(stu.id)}
                      >
                        <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="sm" />
                        <View className="flex-1 min-w-0">
                          <Text className="text-base font-medium text-foreground">{stu.name}</Text>
                          {stu.phone && (
                            <Text className="text-sm text-muted-foreground block mt-0_d5">
                              {stu.phone}
                            </Text>
                          )}
                        </View>
                        <View
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary border-primary' : ''}`}
                          style={isSelected ? undefined : { borderColor: '#D5E8E0' }}
                        >
                          {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
              {/* 底部确认 */}
              <View
                className="px-5 py-4 flex items-center gap-3"
                style={{ borderTop: '2rpx solid #D5E8E0' }}
              >
                <Text className="text-sm text-muted-foreground flex-1">
                  已选 <Text className="font-semibold text-primary">{selectedStudentIds.size}</Text>{' '}
                  人
                </Text>
                <View
                  className="btn-secondary px-6 bg-gradient-primary shadow-elegant"
                  onClick={handleConfirmAdd}
                >
                  <Text className="text-base font-semibold text-white">确认添加</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ====== 调班弹窗 ====== */}
        {showTransferSheet && (
          <View className="fixed inset-0 z-100 flex items-end">
            <View
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowTransferSheet(false)}
            />
            <View className="relative w-full bg-white rounded-t-32rpx max-h-60vh flex flex-col">
              {/* 拖拽条 */}
              <View className="flex justify-center pt-2 pb-0">
                <View className="w-9 h-1 rounded-full bg-gray-200" />
              </View>
              {/* 头部 */}
              <View className="px-5 pt-3 pb-3" style={{ borderBottom: '2rpx solid #D5E8E0' }}>
                <View className="flex items-center justify-between">
                  <Text className="text-base font-semibold text-foreground">调班</Text>
                  <View
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                    onClick={() => setShowTransferSheet(false)}
                  >
                    <Text className="text-xs text-muted-foreground">✕</Text>
                  </View>
                </View>
                <Text className="text-sm text-muted-foreground mt-1">
                  将「{transferStudentName}」调至
                </Text>
              </View>
              {/* 班级列表 */}
              <ScrollView scrollY className="flex-1 px-5 py-2">
                {allClasses.map((cls) => {
                  const isCurrent = cls.id === classId;
                  const isDisabled = cls.status === 'ended';
                  const disabled = isCurrent || isDisabled;

                  return (
                    <View
                      key={cls.id}
                      className={`flex items-center gap-3 py-3 transition ${disabled ? 'state-disabled' : 'press-bg'}`}
                      style={{ borderBottom: '2rpx solid #e8e8e8' }}
                      onClick={disabled ? undefined : () => handleConfirmTransfer(cls.id)}
                    >
                      <View
                        className={`w-9 h-9 rounded-xl ${CLASS_GRADIENT[cls.color]} flex items-center justify-center flex-shrink-0`}
                      >
                        <Text className="text-base">{CLASS_ICONS[cls.color]}</Text>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-base font-medium text-foreground">{cls.name}</Text>
                        <Text className="text-sm text-muted-foreground mt-0_d5">
                          {cls.schedule} · {cls.student_count}人
                        </Text>
                      </View>
                      {isCurrent ? (
                        <View className="tag">当前班级</View>
                      ) : isDisabled ? (
                        <View className="tag-purple">已结课</View>
                      ) : cls.type === 'unlimited' ? (
                        <View className="tag-primary">循环</View>
                      ) : (
                        <View className="tag-amber">课时制</View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ClassDetail);
