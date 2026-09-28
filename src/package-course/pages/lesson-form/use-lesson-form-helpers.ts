/**
 * 点名页停课 / 图片上传 / 模式派生 / 学员列表过滤（Q2-2 收口）
 */
import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { uploadService } from '@/services';
import type { ThemeKey } from '@/theme';
import type { Subject } from '@/types/campus';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Lead, LeadBooking } from '@/types/lead';
import type { Student } from '@/types/student';
import { chooseImageTemp } from '@/utils/image-upload';
import { runImageUploadFlow } from '@/utils/upload-flow';
import { isWithinLessonOperateWindow } from './lesson-operate';
import type { CheckinStatus } from './checkin-status';

export interface UseLessonFormHelpersParams {
  classIdParam: string;
  /** 编辑已有消课记录时的 recordId，用作七牛 lesson_media refId */
  recordIdParam?: string;
  mode: 'single' | 'class';
  viewOnlyParam: boolean;
  lessonDate: string;
  lessonTime: string;
  selectedClass: Class | null;
  selectedClassId: string;
  homeworkImages: string[];
  setHomeworkImages: Dispatch<SetStateAction<string[]>>;
  setUploading: Dispatch<SetStateAction<boolean>>;
  setClasses: Dispatch<SetStateAction<Class[]>>;
  themeActiveTheme: ThemeKey;
  classStudents: Student[];
  studentSearchKeyword: string;
  attendanceFilter: 'all' | CheckinStatus;
  studentCheckinStatusMap: Record<string, CheckinStatus>;
  trialBookings: LeadBooking[];
  trialLeadMap: Record<string, Lead>;
  trialCheckinMap: Record<string, CheckinStatus>;
  studentPackages: Map<string, CoursePackage>;
  studentSubjects: Map<string, Subject | null>;
  hoursUsed: number;
}

export function useLessonFormHelpers(params: UseLessonFormHelpersParams) {
  const {
    classIdParam,
    recordIdParam = '',
    mode,
    viewOnlyParam,
    lessonDate,
    lessonTime,
    selectedClass,
    selectedClassId,
    homeworkImages,
    setHomeworkImages,
    setUploading,
    classStudents,
    studentSearchKeyword,
    attendanceFilter,
    studentCheckinStatusMap,
    trialBookings,
    trialLeadMap,
    trialCheckinMap,
    studentPackages,
    studentSubjects,
    hoursUsed,
  } = params;

  /** 作业图上传 ref：优先消课记录，否则班级，避免无机构实体时缺 refId */
  const lessonMediaRefId = recordIdParam || selectedClassId || classIdParam || 'draft';

  const isClassPaused = selectedClass?.status === 'paused';

  const isClassDirectEntry = Boolean(classIdParam);
  const shouldShowModeTabs = !isClassDirectEntry;

  /** 头部大字号展示的"本节课时间"：优先用班级固定上课时间（最权威，来自排课规则），
   *  没有班级（课时/手动消课）时才回落到进入页携带的时间参数 lessonTime。
   *  注意：绝不再回落到实时时钟（formatTime(new Date())）——详情页打开的可能是
   *  历史课或未来课，显示"现在几点"会让老师误以为在显示当前正在上的课，是错的。 */
  const classScheduledTime =
    selectedClass?.start_time && selectedClass?.end_time
      ? `${selectedClass.start_time}-${selectedClass.end_time}`
      : null;
  const displayLessonTime = classScheduledTime || lessonTime || '';

  /** 30 天操作窗口：可补录 / 修改；超时或 viewOnly 仅查看 */
  const canModifyLesson = useMemo(() => {
    if (viewOnlyParam) {
      return false;
    }
    return isWithinLessonOperateWindow(lessonDate);
  }, [lessonDate, viewOnlyParam]);

  const pageTitle = useMemo(() => {
    return mode === 'class' ? '班级消课' : '课时消课';
  }, [mode]);

  const handleUploadImage = useCallback(async () => {
    await runImageUploadFlow({
      currentCount: homeworkImages.length,
      maxCount: 3,
      choose: () => chooseImageTemp({ maxSizeMB: 5, cropScale: '16:9' }),
      upload: async (path) => {
        const result = await uploadService.upload(path, {
          type: 'lesson_media',
          refId: lessonMediaRefId,
        });
        return result.url;
      },
      onSuccess: (url) => setHomeworkImages((prev) => [...prev, url]),
      onUploadingChange: setUploading,
      successToastTitle: '上传成功',
    });
  }, [homeworkImages, lessonMediaRefId, setHomeworkImages, setUploading]);

  const handleRemoveImage = useCallback(
    (index: number) => {
      setHomeworkImages((prev) => prev.filter((_, i) => i !== index));
    },
    [setHomeworkImages],
  );

  /** 过滤后的正式学员列表（搜索+考勤筛选） */
  const filteredClassStudents = useMemo(() => {
    let result = classStudents;
    const keyword = studentSearchKeyword.trim().toLowerCase();
    if (keyword) {
      result = result.filter((stu) => stu.name.toLowerCase().includes(keyword));
    }
    if (attendanceFilter !== 'all') {
      result = result.filter((stu) => {
        const status = studentCheckinStatusMap[stu.id] || 'absent';
        return attendanceFilter === 'absent'
          ? status === 'absent' || status === 'leave'
          : status === attendanceFilter;
      });
    }
    return result;
  }, [attendanceFilter, classStudents, studentCheckinStatusMap, studentSearchKeyword]);

  /** 过滤后的试听学员列表（搜索+考勤筛选） */
  const filteredTrialBookings = useMemo(() => {
    let result = trialBookings;
    const keyword = studentSearchKeyword.trim().toLowerCase();
    if (keyword) {
      result = result.filter((booking) => {
        const lead = trialLeadMap[booking.lead_id];
        return (lead?.child_name || '').toLowerCase().includes(keyword);
      });
    }
    if (attendanceFilter !== 'all') {
      result = result.filter((booking) => {
        const status = trialCheckinMap[booking.id] || 'absent';
        return attendanceFilter === 'absent'
          ? status === 'absent' || status === 'leave'
          : status === attendanceFilter;
      });
    }
    return result;
  }, [attendanceFilter, trialBookings, trialLeadMap, studentSearchKeyword, trialCheckinMap]);

  /** 合并学员列表：试听优先 */
  const mergedStudentList = useMemo(() => {
    const trials = filteredTrialBookings.map((booking) => ({
      type: 'trial' as const,
      id: booking.id,
      booking,
      name: trialLeadMap[booking.lead_id]?.child_name || '未知学员',
    }));
    const formals = filteredClassStudents.map((student) => ({
      type: 'formal' as const,
      id: student.id,
      student,
    }));
    return [...trials, ...formals];
  }, [filteredClassStudents, filteredTrialBookings, trialLeadMap]);

  /** 试听课剩余/扣课显示 */
  const getTrialCardInfo = useCallback(() => {
    return { remaining: '试听', deduct: '0课时' };
  }, []);

  /** 学员扣课/剩余/课程显示 */
  const getStudentCardInfo = useCallback(
    (student: Student) => {
      const pkg = studentPackages.get(student.id);
      if (!pkg) {
        return { courseName: '无课包', remaining: '无课包', deduct: '0课时' };
      }
      const remainingText =
        pkg.expiry_date && !pkg.remaining_hours
          ? `${Math.max(0, Math.ceil((new Date(pkg.expiry_date).getTime() - Date.now()) / 86400000))}天`
          : `${pkg.remaining_hours}课时`;
      const subject = studentSubjects.get(student.id);
      return {
        courseName: subject?.name || pkg.name || '未命名课程',
        remaining: remainingText,
        deduct: `${hoursUsed}课时`,
      };
    },
    [hoursUsed, studentPackages, studentSubjects],
  );

  return {
    isClassPaused,
    isClassDirectEntry,
    shouldShowModeTabs,
    displayLessonTime,
    canModifyLesson,
    pageTitle,
    handleUploadImage,
    handleRemoveImage,
    mergedStudentList,
    getTrialCardInfo,
    getStudentCardInfo,
  };
}
