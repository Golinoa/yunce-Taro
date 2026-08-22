import Taro from '@tarojs/taro';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { classService } from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import type { Class, ClassDetail, CheckinRecord } from '@/types/class';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';

/** 生成模拟签到记录 */
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

export interface UseClassDetailReturn {
  classId: string;
  classInfo: ClassDetail | null;
  students: Student[];
  loading: boolean;
  loadError: string;
  notFound: boolean;
  isEnded: boolean;
  isUnlimited: boolean;
  checkinRecords: CheckinRecord[];
  addingStudents: boolean;
  transferring: boolean;

  // 添加学员弹窗
  showAddSheet: boolean;
  setShowAddSheet: React.Dispatch<React.SetStateAction<boolean>>;
  availableStudents: Student[];
  selectedStudentIds: Set<string>;
  addSearchQuery: string;
  setAddSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredAvailableStudents: Student[];
  toggleAddStudent: (id: string) => void;
  handleOpenAdd: () => Promise<void>;
  handleConfirmAdd: () => Promise<void>;

  // 调班弹窗
  showTransferSheet: boolean;
  setShowTransferSheet: React.Dispatch<React.SetStateAction<boolean>>;
  transferStudentId: string;
  transferStudentName: string;
  allClasses: Class[];
  handleOpenTransfer: (studentId: string, studentName: string) => Promise<void>;
  handleConfirmTransfer: (targetClassId: string) => Promise<void>;

  // 签到记录展开
  expandedCheckins: Set<number>;
  expandedMore: Set<number>;
  toggleCheckinExpand: (idx: number) => void;
  toggleMoreStudents: (idx: number) => void;

  // 操作
  loadData: () => Promise<void>;
  reload: () => Promise<void>;
  goLessonForm: () => void;
  goEdit: () => void;
  goStudentDetail: (id: string) => void;
  handleStudentLongPress: (studentId: string, studentName: string) => void;
}

export function useClassDetail(): UseClassDetailReturn {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const invalidateStudents = useStudentStore((state) => state.invalidate);
  const fetchClassesByTeacher = useClassStore((state) => state.fetchByTeacher);
  const invalidateClasses = useClassStore((state) => state.invalidate);
  const classId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [classInfo, setClassInfo] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const { loading, setLoading } = useDelayedLoading();
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [addingStudents, setAddingStudents] = useState(false);
  const [transferring, setTransferring] = useState(false);

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
    if (!classId) {
      setLoadError('未获取到班级信息，请重新进入页面');
      setLoading(false);
      return;
    }
    if (!currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    setNotFound(false);
    try {
      const [cls, stuList] = await Promise.all([
        classService.getById(classId),
        classService.getStudents(classId),
      ]);

      if (!cls) {
        setClassInfo(null);
        setStudents([]);
        setNotFound(true);
        return;
      }

      // 将 Class 补全为 ClassDetail（缺少的字段给默认值，后端联调时补全）
      setClassInfo({
        ...cls,
        studentList: [],
        pricePerLesson: undefined,
        packagePrice: undefined,
        totalRevenue: undefined,
      });
      setStudents(stuList);
    } catch (err) {
      logError('load class detail', err);
      setLoadError('班级详情加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [classId, currentUserId, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===== 操作 =====

  const goLessonForm = useCallback(() => {
    Taro.navigateTo({
      url: `/package-course/pages/lesson-form/index?classId=${encodeURIComponent(classId)}`,
    });
  }, [classId]);

  const goEdit = useCallback(() => {
    // 用户口径（2026-08-23）：编辑统一走「编辑课程页面」（course-form 班级模式），不再跳 class-form 表单页
    Taro.navigateTo({
      url: `/package-course/pages/course-form/index?id=${encodeURIComponent(classId)}&type=class`,
    });
  }, [classId]);

  const goStudentDetail = useCallback((id: string) => {
    Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(id)}`,
    });
  }, []);

  // ===== 调班弹窗 =====
  const handleOpenTransfer = useCallback(
    async (studentId: string, studentName: string) => {
      setTransferStudentId(studentId);
      setTransferStudentName(studentName);
      try {
        const classes = await fetchClassesByTeacher(currentUserId);
        setAllClasses(classes);
        setShowTransferSheet(true);
      } catch (err) {
        logError('load classes for transfer', err);
        Taro.showToast({ title: '加载班级列表失败', icon: 'none' });
      }
    },
    [currentUserId, fetchClassesByTeacher],
  );

  const handleStudentLongPress = useCallback(
    (studentId: string, studentName: string) => {
      Taro.showActionSheet({
        itemList: ['调班', '移除'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            handleOpenTransfer(studentId, studentName);
          } else if (res.tapIndex === 1) {
            const { confirm } = await Taro.showModal({
              title: '移出班级',
              content: `确认将「${studentName}」从班级移出？该学员的课时记录将保留。`,
              confirmColor: '#ef4444',
            });
            if (!confirm) return;
            try {
              await classService.removeStudent(classId, studentId);
              invalidateStudents(currentUserId);
              Taro.showToast({ title: '已移出', icon: 'success' });
              await loadData();
            } catch {
              Taro.showToast({ title: '操作失败', icon: 'none' });
            }
          }
        },
        fail: () => {
          // 用户主动取消菜单时不提示错误
        },
      }).catch(() => null);
    },
    [classId, loadData, currentUserId, handleOpenTransfer, invalidateStudents],
  );

  // ===== 添加学员弹窗 =====
  const handleOpenAdd = useCallback(async () => {
    try {
      const allStudents = await fetchStudentsByTeacher(currentUserId);
      const currentIds = new Set(students.map((s) => s.id));
      const nextAvailableStudents = allStudents.filter((s) => !currentIds.has(s.id));
      setAvailableStudents(nextAvailableStudents);
      setSelectedStudentIds(new Set());
      setAddSearchQuery('');
      if (!nextAvailableStudents.length) {
        Taro.showToast({ title: '暂无可添加学员', icon: 'none' });
        return;
      }
      setShowAddSheet(true);
    } catch (err) {
      logError('load available students', err);
      Taro.showToast({ title: '加载可选学员失败', icon: 'none' });
    }
  }, [students, currentUserId, fetchStudentsByTeacher]);

  const toggleAddStudent = useCallback((id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    if (addingStudents) return;
    if (selectedStudentIds.size === 0) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }

    setAddingStudents(true);
    try {
      await classService.addStudents(classId, [...selectedStudentIds]);
      invalidateStudents(currentUserId);
      Taro.showToast({ title: '添加成功', icon: 'success' });
      setShowAddSheet(false);
      await loadData();
    } catch {
      Taro.showToast({ title: '添加失败', icon: 'none' });
    } finally {
      setAddingStudents(false);
    }
  }, [addingStudents, classId, selectedStudentIds, loadData, invalidateStudents, currentUserId]);

  const filteredAvailableStudents = useMemo(() => {
    if (!addSearchQuery.trim()) return availableStudents;
    const q = addSearchQuery.trim().toLowerCase();
    return availableStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)),
    );
  }, [availableStudents, addSearchQuery]);

  const handleConfirmTransfer = useCallback(
    async (targetClassId: string) => {
      if (transferring) return;

      setTransferring(true);
      try {
        await classService.transferStudent(classId, targetClassId, transferStudentId);
        invalidateClasses(currentUserId);
        invalidateStudents(currentUserId);
        Taro.showToast({ title: '调班成功', icon: 'success' });
        setShowTransferSheet(false);
        await loadData();
      } catch {
        Taro.showToast({ title: '调班失败', icon: 'none' });
      } finally {
        setTransferring(false);
      }
    },
    [
      classId,
      transferStudentId,
      loadData,
      invalidateClasses,
      invalidateStudents,
      currentUserId,
      transferring,
    ],
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

  return {
    classId,
    classInfo,
    students,
    loading,
    loadError,
    notFound,
    isEnded,
    isUnlimited,
    checkinRecords,
    addingStudents,
    transferring,
    showAddSheet,
    setShowAddSheet,
    availableStudents,
    selectedStudentIds,
    addSearchQuery,
    setAddSearchQuery,
    filteredAvailableStudents,
    toggleAddStudent,
    handleOpenAdd,
    handleConfirmAdd,
    showTransferSheet,
    setShowTransferSheet,
    transferStudentId,
    transferStudentName,
    allClasses,
    handleOpenTransfer,
    handleConfirmTransfer,
    expandedCheckins,
    expandedMore,
    toggleCheckinExpand,
    toggleMoreStudents,
    loadData,
    reload: loadData,
    goLessonForm,
    goEdit,
    goStudentDetail,
    handleStudentLongPress,
  };
}
