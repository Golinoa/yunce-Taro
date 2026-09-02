/**
 * 学员详情数据加载
 *
 * 使用场景：进页 / useDidShow 刷新学员详情聚合数据。
 * 功能说明：并行拉取学员、消课、课包、请假、会员卡、跟进、家长；不写 JSX。
 */
import { useDidShow } from '@tarojs/taro';
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { studentService, packageService, lessonRecordService, leaveService } from '@/services';
import { followRecordService } from '@/services/follow-record';
import { memberCardService } from '@/services/member-card';
import type { CoursePackage, PackageTransaction } from '@/types/course-package';
import type { FollowRecord } from '@/types/follow-record';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student, StudentParent } from '@/types/student';
import { logError } from '@/utils/logger';

export interface UseStudentDetailLoadersParams {
  studentId: string;
  currentUserId: string;
  setStudent: Dispatch<SetStateAction<Student | null>>;
  setRecords: Dispatch<SetStateAction<LessonRecord[]>>;
  setPackages: Dispatch<SetStateAction<CoursePackage[]>>;
  setPackageTransactions: Dispatch<SetStateAction<PackageTransaction[]>>;
  setLeaves: Dispatch<SetStateAction<LeaveRequest[]>>;
  setMemberCards: Dispatch<SetStateAction<MemberCardDetail[]>>;
  setFollowRecords: Dispatch<SetStateAction<FollowRecord[]>>;
  setParents: Dispatch<SetStateAction<StudentParent[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string>>;
  setNotFound: Dispatch<SetStateAction<boolean>>;
}

/** 加载学员详情页所需全部数据，并在页面再次显示时刷新。 */
export function useStudentDetailLoaders(params: UseStudentDetailLoadersParams) {
  const {
    studentId,
    currentUserId,
    setStudent,
    setRecords,
    setPackages,
    setPackageTransactions,
    setLeaves,
    setMemberCards,
    setFollowRecords,
    setParents,
    setLoading,
    setLoadError,
    setNotFound,
  } = params;

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!studentId) {
      setStudent(null);
      setRecords([]);
      setPackages([]);
      setPackageTransactions([]);
      setLeaves([]);
      setMemberCards([]);
      setFollowRecords([]);
      setParents([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const [stu, recs, pkgs, lvs, cards, follows, parentList] = await Promise.all([
        studentService.getById(studentId),
        lessonRecordService.getByStudent(studentId),
        packageService.getByStudent(studentId),
        leaveService.getByStudent(studentId),
        memberCardService.getByStudent(studentId),
        followRecordService.getByStudent(studentId),
        studentService.getParents(studentId),
      ]);
      const txns = currentUserId
        ? (
            await packageService.getTransactions(currentUserId, {
              studentId,
              page: 1,
              pageSize: 50,
            })
          ).list
        : [];

      if (!stu) {
        setStudent(null);
        setRecords([]);
        setPackages([]);
        setPackageTransactions([]);
        setLeaves([]);
        setMemberCards([]);
        setFollowRecords([]);
        setParents([]);
        setNotFound(true);
        return;
      }

      setStudent(stu);
      setRecords(recs);
      setPackages(pkgs);
      setPackageTransactions(txns);
      setLeaves(lvs);
      setMemberCards(cards);
      setFollowRecords(follows);
      setParents(parentList);
    } catch (error) {
      logError('StudentDetail loadData', error);
      setStudent(null);
      setRecords([]);
      setPackages([]);
      setPackageTransactions([]);
      setLeaves([]);
      setMemberCards([]);
      setFollowRecords([]);
      setParents([]);
      setLoadError('学员详情加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [
    currentUserId,
    setFollowRecords,
    setLeaves,
    setLoadError,
    setLoading,
    setMemberCards,
    setNotFound,
    setPackageTransactions,
    setPackages,
    setParents,
    setRecords,
    setStudent,
    studentId,
  ]);

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useDidShow(() => {
    loadDataRef.current();
  });

  return { loadData };
}
