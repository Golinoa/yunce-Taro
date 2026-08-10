/**
 * 学生管理 Mock 数据接口
 * 使用统一数据源 src/data/mock-database.ts
 */
import Taro from '@tarojs/taro';
import type { LeaveStatus } from '@/types/leave-request';
import type { UserRole } from '@/types/profile';
import type { StudentParent } from '@/types/student';
import {
  STUDENTS as DB_STUDENTS,
  COURSE_PACKAGES as DB_PACKAGES,
  CLASSES as DB_CLASSES,
  TEACHERS as DB_TEACHERS,
  IDENTITIES,
  SUBJECTS,
  LESSON_RECORDS,
  LEAVE_REQUESTS,
  CAMPUSES,
  SCHEDULES,
  NOTIFICATIONS,
  type Student,
  type CoursePackage,
  type Class,
} from './mock-database';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildStudentInviteCode(studentId: string): string {
  return `INV-${studentId.slice(-4).toUpperCase()}`;
}

interface StoredProfileIdentity {
  id: string;
  role: UserRole;
  campusIds?: string[];
}

interface StoredProfile {
  id: string;
  currentContext?: {
    identityId?: string;
    role?: UserRole;
    campusId?: string;
  };
  identities?: StoredProfileIdentity[];
}

interface PackageTransactionRecord {
  id: string;
  type: 'recharge' | 'refund';
  studentId: string;
  studentName: string;
  packageId?: string;
  packageName?: string;
  purchasedHours?: number;
  giftHours?: number;
  feeAmount?: number;
  feeMethod?: string;
  refundAmount?: number;
  reason?: string;
  note?: string;
  operatorId?: string;
  operatorName?: string;
  purchasedRemainingSnapshot?: number;
  bonusRemainingSnapshot?: number;
  createdAt: string;
}

function buildRechargeTransactionFromPackage(pkg: CoursePackage): PackageTransactionRecord {
  const student = DB_STUDENTS.find((item) => item.id === pkg.studentId);
  return {
    id: `txn-recharge-${pkg.id}`,
    type: 'recharge',
    studentId: pkg.studentId,
    studentName: student?.name || '学员',
    packageId: pkg.id,
    packageName: pkg.name,
    purchasedHours: pkg.purchasedHours,
    giftHours: pkg.bonusHours,
    feeAmount: pkg.totalAmount,
    feeMethod: pkg.paymentMethod,
    note: pkg.note,
    purchasedRemainingSnapshot: pkg.purchasedHours,
    bonusRemainingSnapshot: pkg.bonusHours,
    createdAt: pkg.purchaseDate,
  };
}

function getStoredProfile(): StoredProfile | null {
  try {
    const raw = Taro.getStorageSync('yunce-edu-user-profile');
    if (!raw) return null;
    return typeof raw === 'string' ? (JSON.parse(raw) as StoredProfile) : (raw as StoredProfile);
  } catch {
    return null;
  }
}

export function getActorScope(actorId: string) {
  const directTeacher = DB_TEACHERS.find(
    (teacher) => teacher.id === actorId || teacher.userId === actorId,
  );
  const storedProfile = getStoredProfile();

  let role: UserRole | undefined;
  let campusIds: string[] = [];

  if (storedProfile?.id === actorId) {
    const activeIdentity = storedProfile.identities?.find(
      (identity) => identity.id === storedProfile.currentContext?.identityId,
    );
    role = activeIdentity?.role || storedProfile.currentContext?.role;
    campusIds = activeIdentity?.campusIds || [];
    if (!campusIds.length && storedProfile.currentContext?.campusId) {
      campusIds = [storedProfile.currentContext.campusId];
    }
  }

  if (!role) {
    const identity = IDENTITIES.find((item) => item.userId === actorId);
    if (identity) {
      role = identity.role;
      campusIds = identity.campusIds;
    }
  }

  if (directTeacher) {
    role = role || 'teacher';
    campusIds = directTeacher.campusIds;
  }

  const managedSubjectIds = directTeacher?.managedSubjectIds || [];
  const teacherIds = Array.from(
    new Set(
      directTeacher
        ? directTeacher.accessScope === 'org'
          ? DB_TEACHERS.map((teacher) => teacher.id)
          : directTeacher.accessScope === 'subject'
            ? DB_CLASSES.filter((cls) => managedSubjectIds.includes(cls.subjectId)).map(
                (cls) => cls.teacherId,
              )
            : [directTeacher.id]
        : role === 'teacher'
          ? DB_TEACHERS.filter((teacher) => teacher.userId === actorId).map((teacher) => teacher.id)
          : role === 'principal'
            ? DB_TEACHERS.filter((teacher) =>
                teacher.campusIds.some((campusId) => campusIds.includes(campusId)),
              ).map((teacher) => teacher.id)
            : [],
    ),
  );

  const studentIds =
    role === 'parent'
      ? DB_STUDENTS.filter((student) => student.parentId === actorId).map((student) => student.id)
      : [];

  return {
    role,
    campusIds,
    accessScope: directTeacher?.accessScope,
    managedSubjectIds,
    teacherIds,
    studentIds,
  };
}

export function filterStudentsByActor(actorId: string): Student[] {
  const scope = getActorScope(actorId);

  if (scope.role === 'parent') {
    return DB_STUDENTS.filter((student) => scope.studentIds.includes(student.id));
  }

  if (scope.role === 'principal') {
    return DB_STUDENTS.filter((student) => scope.campusIds.includes(student.campusId));
  }

  if (scope.accessScope === 'org') {
    return [...DB_STUDENTS];
  }

  if (scope.accessScope === 'subject' && scope.managedSubjectIds.length) {
    const allowedClassIds = new Set(
      DB_CLASSES.filter((cls) => scope.managedSubjectIds.includes(cls.subjectId)).map(
        (cls) => cls.id,
      ),
    );
    return DB_STUDENTS.filter((student) =>
      student.classIds.some((classId) => allowedClassIds.has(classId)),
    );
  }

  if (scope.teacherIds.length) {
    return DB_STUDENTS.filter((student) => scope.teacherIds.includes(student.teacherId));
  }

  return DB_STUDENTS.filter((student) => student.teacherId === actorId);
}

export function filterClassesByActor(actorId: string): Class[] {
  const scope = getActorScope(actorId);

  if (scope.role === 'parent') {
    const classIds = new Set(
      DB_STUDENTS.filter((student) => scope.studentIds.includes(student.id)).flatMap(
        (student) => student.classIds,
      ),
    );
    return DB_CLASSES.filter((cls) => classIds.has(cls.id));
  }

  if (scope.role === 'principal') {
    return DB_CLASSES.filter((cls) => scope.campusIds.includes(cls.campusId));
  }

  if (scope.accessScope === 'org') {
    return [...DB_CLASSES];
  }

  if (scope.accessScope === 'subject' && scope.managedSubjectIds.length) {
    return DB_CLASSES.filter((cls) => scope.managedSubjectIds.includes(cls.subjectId));
  }

  if (scope.teacherIds.length) {
    return DB_CLASSES.filter((cls) => scope.teacherIds.includes(cls.teacherId));
  }

  return DB_CLASSES.filter((cls) => cls.teacherId === actorId);
}

export function filterSchedulesByActor(actorId: string) {
  const scope = getActorScope(actorId);

  if (scope.role === 'parent') {
    const classIds = new Set(filterClassesByActor(actorId).map((cls) => cls.id));
    return SCHEDULES.filter((schedule) => classIds.has(schedule.classId || ''));
  }

  if (scope.role === 'principal') {
    return SCHEDULES.filter((schedule) => scope.campusIds.includes(schedule.campusId));
  }

  if (scope.accessScope === 'org') {
    return [...SCHEDULES];
  }

  if (scope.accessScope === 'subject' && scope.managedSubjectIds.length) {
    const allowedClassIds = new Set(
      DB_CLASSES.filter((cls) => scope.managedSubjectIds.includes(cls.subjectId)).map(
        (cls) => cls.id,
      ),
    );
    return SCHEDULES.filter((schedule) => allowedClassIds.has(schedule.classId || ''));
  }

  if (scope.teacherIds.length) {
    return SCHEDULES.filter((schedule) => scope.teacherIds.includes(schedule.teacherId));
  }

  return SCHEDULES.filter((schedule) => schedule.teacherId === actorId);
}

export function filterLessonRecordsByActor(actorId: string) {
  const scope = getActorScope(actorId);

  if (scope.role === 'parent') {
    return LESSON_RECORDS.filter((record) => scope.studentIds.includes(record.studentId));
  }

  if (scope.role === 'principal') {
    return LESSON_RECORDS.filter((record) => scope.campusIds.includes(record.campusId));
  }

  if (scope.accessScope === 'org') {
    return [...LESSON_RECORDS];
  }

  if (scope.accessScope === 'subject' && scope.managedSubjectIds.length) {
    const allowedClassIds = new Set(
      DB_CLASSES.filter((cls) => scope.managedSubjectIds.includes(cls.subjectId)).map(
        (cls) => cls.id,
      ),
    );
    return LESSON_RECORDS.filter((record) => allowedClassIds.has(record.classId));
  }

  if (scope.teacherIds.length) {
    return LESSON_RECORDS.filter((record) => {
      // 老师在课表页回看记录时，既要能看到自己主讲的消课，
      // 也要能看到自己作为操作人或助教提交的记录，否则点名后返回课表不会立即变成已点名态。
      const relatedTeacherIds = [
        record.teacherId,
        'operatorTeacherId' in record ? record.operatorTeacherId : undefined,
        'assistantTeacherId' in record ? record.assistantTeacherId : undefined,
      ].filter((id): id is string => Boolean(id));
      return relatedTeacherIds.some((id) => scope.teacherIds.includes(id));
    });
  }

  return LESSON_RECORDS.filter((record) => {
    const relatedTeacherIds = [
      record.teacherId,
      'operatorTeacherId' in record ? record.operatorTeacherId : undefined,
      'assistantTeacherId' in record ? record.assistantTeacherId : undefined,
    ].filter((id): id is string => Boolean(id));
    return relatedTeacherIds.includes(actorId);
  });
}

export function filterPackagesByActor(actorId: string): CoursePackage[] {
  const visibleStudentIds = new Set(filterStudentsByActor(actorId).map((student) => student.id));
  return DB_PACKAGES.filter((pkg) => visibleStudentIds.has(pkg.studentId));
}

const PACKAGE_TRANSACTIONS: PackageTransactionRecord[] = DB_PACKAGES.map(
  buildRechargeTransactionFromPackage,
);

function filterPackageTransactionsByActor(actorId: string): PackageTransactionRecord[] {
  const visibleStudentIds = new Set(filterStudentsByActor(actorId).map((student) => student.id));
  return PACKAGE_TRANSACTIONS.filter((item) => visibleStudentIds.has(item.studentId));
}

// 兼容旧接口的类型别名
export type { Student, CoursePackage, Class } from './mock-database';

// 日期格式化工具
export function formatDateCN(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

// 获取学员列表
export async function mockGetStudents(options?: {
  campusId?: string;
  teacherId?: string;
}): Promise<Student[]> {
  await delay();
  let students = options?.teacherId ? filterStudentsByActor(options.teacherId) : [...DB_STUDENTS];
  if (options?.campusId) {
    students = students.filter((s) => s.campusId === options.campusId);
  }
  return students;
}

// 获取学员详情
export async function mockGetStudentById(id: string): Promise<Student | undefined> {
  await delay();
  return DB_STUDENTS.find((s) => s.id === id);
}

// 获取学员课包
export async function mockGetStudentPackages(studentId: string): Promise<CoursePackage[]> {
  await delay();
  return DB_PACKAGES.filter((p) => p.studentId === studentId);
}

// 获取班级列表
export async function mockGetClasses(options?: {
  campusId?: string;
  teacherId?: string;
}): Promise<Class[]> {
  await delay();
  let classes = options?.teacherId ? filterClassesByActor(options.teacherId) : [...DB_CLASSES];
  if (options?.campusId) {
    classes = classes.filter((c) => c.campusId === options.campusId);
  }
  return classes;
}

// 获取班级详情
export async function mockGetClassById(id: string): Promise<Class | undefined> {
  await delay();
  return DB_CLASSES.find((c) => c.id === id);
}

// 获取班级学员
export async function mockGetClassStudents(classId: string): Promise<Student[]> {
  await delay();
  return DB_STUDENTS.filter((s) => s.classIds.includes(classId));
}

// 获取消课记录
export async function mockGetLessonRecords(options?: {
  studentId?: string;
  classId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<typeof LESSON_RECORDS> {
  await delay();
  let records = [...LESSON_RECORDS];
  if (options?.studentId) {
    records = records.filter((r) => r.studentId === options.studentId);
  }
  if (options?.classId) {
    records = records.filter((r) => r.classId === options.classId);
  }
  if (options?.startDate) {
    records = records.filter((r) => r.date >= options.startDate!);
  }
  if (options?.endDate) {
    records = records.filter((r) => r.date <= options.endDate!);
  }
  return records;
}

// 获取请假记录
export async function mockGetLeaveRequests(options?: {
  studentId?: string;
  classId?: string;
  status?: string;
}): Promise<typeof LEAVE_REQUESTS> {
  await delay();
  let requests = [...LEAVE_REQUESTS];
  if (options?.studentId) {
    requests = requests.filter((r) => r.studentId === options.studentId);
  }
  if (options?.classId) {
    requests = requests.filter((r) => r.classId === options.classId);
  }
  if (options?.status) {
    requests = requests.filter((r) => r.status === options.status);
  }
  return requests;
}

// 获取教师列表
export async function mockGetTeachers(): Promise<typeof DB_TEACHERS> {
  await delay();
  return DB_TEACHERS;
}

// 获取教师详情
export async function mockGetTeacherById(id: string): Promise<(typeof DB_TEACHERS)[0] | undefined> {
  await delay();
  return DB_TEACHERS.find((t) => t.id === id);
}

// 获取科目列表
export async function mockGetSubjects(): Promise<typeof SUBJECTS> {
  await delay();
  return SUBJECTS;
}

// 获取校区列表
export async function mockGetCampusList(): Promise<typeof CAMPUSES> {
  await delay();
  return CAMPUSES;
}

// 兼容旧接口的导出
export const MOCK_STUDENTS = DB_STUDENTS;
export const MOCK_PACKAGES = DB_PACKAGES;
export const MOCK_CLASSES = DB_CLASSES;

// ============================================
// 课表相关
// ============================================
export async function mockGetScheduleByClassId(classId: string): Promise<typeof SCHEDULES> {
  await delay();
  return SCHEDULES.filter((s) => s.classId === classId);
}

export async function mockGetScheduleByTeacherId(teacherId: string): Promise<typeof SCHEDULES> {
  await delay();
  return SCHEDULES.filter((s) => s.teacherId === teacherId);
}

export async function mockCreateSchedule(
  data: Partial<(typeof SCHEDULES)[0]>,
): Promise<(typeof SCHEDULES)[0]> {
  await delay();
  return {
    id: `schedule-${Date.now()}`,
    classId: data.classId || '',
    teacherId: data.teacherId || '',
    campusId: data.campusId || '',
    dayOfWeek: data.dayOfWeek || 1,
    startTime: data.startTime || '09:00',
    endTime: data.endTime || '10:00',
    room: data.room || '',
    status: 'scheduled' as const,
    semesterId: 'sem-2025',
    semesterName: '2025学年',
    createdAt: new Date().toISOString(),
  };
}

export async function mockUpdateSchedule(
  id: string,
  data: Partial<(typeof SCHEDULES)[0]>,
): Promise<(typeof SCHEDULES)[0] | undefined> {
  await delay();
  const schedule = SCHEDULES.find((s) => s.id === id);
  if (!schedule) return undefined;
  return { ...schedule, ...data };
}

export async function mockDeleteSchedule(_id: string): Promise<boolean> {
  await delay();
  return true;
}

export async function mockCheckScheduleConflict(
  teacherId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<boolean> {
  await delay();
  return SCHEDULES.some(
    (s) =>
      s.teacherId === teacherId &&
      s.dayOfWeek === dayOfWeek &&
      s.id !== excludeId &&
      s.status === 'scheduled' &&
      !(endTime <= s.startTime || startTime >= s.endTime),
  );
}

// ============================================
// 通知相关
// ============================================
export async function mockGetNotificationsByReceiver(
  receiverId: string,
): Promise<typeof NOTIFICATIONS> {
  await delay();
  return NOTIFICATIONS.filter((n) => n.receiverId === receiverId);
}

export async function mockMarkNotificationAsRead(_id: string): Promise<boolean> {
  await delay();
  return true;
}

export async function mockMarkAllNotificationsAsRead(_receiverId: string): Promise<boolean> {
  await delay();
  return true;
}

export async function mockSendNotification(
  data: Partial<(typeof NOTIFICATIONS)[0]>,
): Promise<(typeof NOTIFICATIONS)[0]> {
  await delay();
  return {
    id: `notif-${Date.now()}`,
    type: 'system' as const,
    title: data.title || '系统通知',
    content: data.content || '',
    receiverId: data.receiverId || '',
    isRead: false,
    createdAt: new Date().toISOString(),
  };
}

// ============================================
// Service 层需要的兼容接口
// ============================================
export async function mockGetStudentsByTeacher(teacherId: string, campusId?: string) {
  await delay();
  let students = filterStudentsByActor(teacherId);
  if (campusId) {
    students = students.filter((student) => student.campusId === campusId);
  }
  return students;
}

export async function mockSearchStudents(teacherId: string, query: string, campusId?: string) {
  await delay();
  let students = filterStudentsByActor(teacherId);
  if (campusId) {
    students = students.filter((student) => student.campusId === campusId);
  }
  return students.filter(
    (student) => student.name.includes(query) || student.phone.includes(query),
  );
}

export async function mockGetStudentsByParent(parentId: string) {
  await delay();
  return DB_STUDENTS.filter((s) => s.parentId === parentId);
}

export async function mockCreateStudent(data: any) {
  await delay();
  return { id: `stu-${Date.now()}`, ...data };
}

export async function mockUpdateStudent(studentId: string, data: any) {
  await delay();
  const student = DB_STUDENTS.find((s) => s.id === studentId);
  return student ? { ...student, ...data } : undefined;
}

export async function mockDeleteStudent(_studentId: string) {
  await delay();
  return true;
}

export async function mockGetStudentDependencies(_studentId: string) {
  await delay();
  return {
    packages: 2,
    records: 10,
    activePackages: 2,
    frozenPackages: 0,
    lessonRecords: 10,
    boundParents: 1,
  };
}

export async function mockCheckDuplicateName(teacherId: string, name: string, excludeId?: string) {
  await delay();
  return filterStudentsByActor(teacherId).some(
    (student) => student.name === name && student.id !== excludeId,
  );
}

export async function mockGetParentsByStudent(_studentId: string): Promise<StudentParent[]> {
  await delay();
  return [];
}

export async function mockRemoveParentFromStudent(_bindingId: string) {
  await delay();
  return true;
}

export async function mockFindStudentByInviteCode(code: string) {
  await delay();
  return DB_STUDENTS.find((student) => buildStudentInviteCode(student.id) === code);
}

export async function mockBindParentToStudent(_studentId: string, _parentId: string) {
  await delay();
  return true;
}

export async function mockGetPackagesByStudent(studentId: string) {
  await delay();
  const packages = DB_PACKAGES.filter((p) => p.studentId === studentId);
  if (packages.length > 0) {
    return packages;
  }

  const student = DB_STUDENTS.find((item) => item.id === studentId);
  if (!student || student.remainingHours <= 0) {
    return [];
  }

  const firstClass = DB_CLASSES.find((cls) => student.classIds.includes(cls.id));
  const subject = firstClass
    ? SUBJECTS.find((item) => item.id === firstClass.subjectId)
    : undefined;
  const syntheticPackage: CoursePackage = {
    id: `pkg-virtual-${student.id}`,
    studentId: student.id,
    classId: firstClass?.id || '',
    name: `${subject?.name || '通用'}课包`,
    subjectId: firstClass?.subjectId || '',
    totalHours: Math.max(student.totalHours, student.remainingHours),
    purchasedHours: Math.max(student.totalHours, student.remainingHours),
    bonusHours: 0,
    usedHours: Math.max(student.totalHours - student.remainingHours, 0),
    remainingHours: student.remainingHours,
    pricePerHour: firstClass?.pricePerLesson || 0,
    totalAmount:
      Math.max(student.totalHours, student.remainingHours) * (firstClass?.pricePerLesson || 0),
    paymentMethod: 'transfer',
    status: 'active',
    purchaseDate: student.createdAt,
    expireDate: undefined,
    note: 'mock 自动生成的汇总课包',
  };

  DB_PACKAGES.push(syntheticPackage);
  return [syntheticPackage];
}

export async function mockGetPackageById(packageId: string) {
  await delay();
  return DB_PACKAGES.find((p) => p.id === packageId);
}

export async function mockCreatePackage(data: any) {
  await delay();
  return { id: `pkg-${Date.now()}`, ...data };
}

export async function mockUpdatePackage(packageId: string, data: any) {
  await delay();
  const pkg = DB_PACKAGES.find((p) => p.id === packageId);
  return pkg ? { ...pkg, ...data } : undefined;
}

export async function mockDeductPackageHours(packageId: string, hours: number) {
  await delay();
  const pkg = DB_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error('Package not found');
  return {
    pkg,
    deduct: { purchasedHours: hours, bonusHours: 0 },
  };
}

export async function mockGetActivePackagesByStudent(studentId: string) {
  await delay();
  const packages = await mockGetPackagesByStudent(studentId);
  return packages.filter((p) => p.status === 'active');
}

export async function mockGetPackageTemplates(teacherId: string) {
  await delay();
  const visibleClasses = filterClassesByActor(teacherId);
  const subjects = Array.from(
    new Map(
      visibleClasses
        .map((cls) => SUBJECTS.find((subject) => subject.id === cls.subjectId))
        .filter(Boolean)
        .map((subject) => [subject!.id, subject!]),
    ).values(),
  );

  return subjects.map((subject, index) => {
    const subjectClasses = visibleClasses.filter((cls) => cls.subjectId === subject.id);
    const avgPrice =
      subjectClasses.reduce((sum, cls) => sum + cls.pricePerLesson, 0) /
      Math.max(subjectClasses.length, 1);
    return {
      id: `template-${subject.id}`,
      teacher_id: teacherId,
      name: `${subject.name}标准课包`,
      type: 'hour_package' as const,
      price: Math.round(avgPrice * 20),
      lesson_count: 20,
      duration: 90,
      valid_days: 180,
      subject_id: subject.id,
      description: `${subject.name}默认模板`,
      created_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
      updated_at: '2026-06-01T00:00:00Z',
    };
  });
}

export async function mockCreatePackageTemplate(data: any) {
  await delay();
  return { id: `template-${Date.now()}`, ...data };
}

export async function mockUpdatePackageTemplate(templateId: string, data: any) {
  await delay();
  return { id: templateId, ...data };
}

export async function mockDeletePackageTemplate(_templateId: string) {
  await delay();
  return true;
}

export async function mockGetRecordsByStudent(studentId: string, limit?: number) {
  await delay();
  let records = LESSON_RECORDS.filter((r) => r.studentId === studentId);
  if (limit) records = records.slice(0, limit);
  return records;
}

export async function mockGetLessonRecordsByTeacher(teacherId: string, campusId?: string) {
  await delay();
  let records = filterLessonRecordsByActor(teacherId);
  if (campusId) {
    records = records.filter((record) => record.campusId === campusId);
  }
  return records;
}

export async function mockGetLessonRecordsByTeacherAndMonth(
  teacherId: string,
  year: number,
  month: number,
  campusId?: string,
) {
  await delay();
  let records = filterLessonRecordsByActor(teacherId).filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() === month - 1;
  });
  if (campusId) {
    records = records.filter((record) => record.campusId === campusId);
  }
  return records;
}

export async function mockGetLessonRecordsByTeacherAndRange(
  teacherId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
) {
  await delay();
  let records = filterLessonRecordsByActor(teacherId).filter(
    (record) => record.date >= startDate && record.date <= endDate,
  );
  if (campusId) {
    records = records.filter((record) => record.campusId === campusId);
  }
  return records;
}

export async function mockGetLessonRecordsByStudent(studentId: string) {
  await delay();
  return LESSON_RECORDS.filter((r) => r.studentId === studentId);
}

export async function mockGetAllLessonRecords() {
  await delay();
  return LESSON_RECORDS;
}

export async function mockCreateLessonRecord(data: any) {
  await delay();
  const record = {
    id: `record-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...data,
  };
  LESSON_RECORDS.unshift(record);
  return record;
}

export async function mockRevokeLessonRecord(
  _recordId: string,
  _operatorId: string,
  _reason: string,
) {
  await delay();
  return true;
}

export async function mockGetLessonRecordById(recordId: string) {
  await delay();
  return LESSON_RECORDS.find((r) => r.id === recordId);
}

export async function mockDeleteLessonRecord(_recordId: string) {
  await delay();
  const index = LESSON_RECORDS.findIndex((record) => record.id === _recordId);
  if (index >= 0) {
    LESSON_RECORDS.splice(index, 1);
    return true;
  }
  return false;
}

export async function mockGetLeavesByStudent(studentId: string) {
  await delay();
  return LEAVE_REQUESTS.filter((r) => r.studentId === studentId);
}

export async function mockGetLeavesByTeacher(teacherId: string) {
  await delay();
  const visibleStudentIds = new Set(filterStudentsByActor(teacherId).map((student) => student.id));
  return LEAVE_REQUESTS.filter(
    (leave) =>
      visibleStudentIds.has(leave.studentId) ||
      getActorScope(teacherId).teacherIds.includes(leave.teacherId),
  );
}

export async function mockCreateLeaveRequest(data: any) {
  await delay();
  const record = {
    id: `leave-${Date.now()}`,
    ...data,
  };
  LEAVE_REQUESTS.unshift(record);
  return record;
}

export async function mockUpdateLeaveRequestStatus(_leaveId: string, _status: LeaveStatus) {
  await delay();
  const target = LEAVE_REQUESTS.find((leave) => leave.id === _leaveId);
  if (!target) {
    return false;
  }
  target.status = _status;
  target.processedAt = new Date().toISOString();
  return true;
}

export async function mockGetClassesByTeacher(teacherId: string, campusId?: string) {
  await delay();
  let classes = filterClassesByActor(teacherId);
  if (campusId) {
    classes = classes.filter((cls) => cls.campusId === campusId);
  }
  return classes;
}

export async function mockGetStudentsByClass(classId: string) {
  await delay();
  return DB_STUDENTS.filter((s) => s.classIds.includes(classId));
}

export async function mockGetClassStudentCount(classId: string) {
  await delay();
  return DB_STUDENTS.filter((s) => s.classIds.includes(classId)).length;
}

export async function mockCreateClass(data: any) {
  await delay();
  return { id: `class-${Date.now()}`, ...data };
}

export async function mockUpdateClass(classId: string, data: any) {
  await delay();
  const cls = DB_CLASSES.find((c) => c.id === classId);
  return cls ? { ...cls, ...data } : undefined;
}

export async function mockDeleteClass(_classId: string) {
  await delay();
  return true;
}

export async function mockRemoveStudentFromClass(_classId: string, _studentId: string) {
  await delay();
  return true;
}

export async function mockAddStudentsToClass(_classId: string, _studentIds: string[]) {
  await delay();
  return true;
}

export async function mockTransferStudent(
  _classId: string,
  _targetClassId: string,
  _studentId: string,
) {
  await delay();
  return true;
}

export async function mockEndClass(_classId: string) {
  await delay();
  return true;
}

export async function mockGetSchedulesByTeacher(teacherId: string, campusId?: string) {
  await delay();
  let schedules = filterSchedulesByActor(teacherId);
  if (campusId) {
    schedules = schedules.filter((schedule) => schedule.campusId === campusId);
  }
  return schedules;
}

export async function mockGetScheduleById(scheduleId: string) {
  await delay();
  return SCHEDULES.find((s) => s.id === scheduleId);
}

export async function mockCreateScheduleFull(data: any) {
  await delay();
  return { id: `schedule-${Date.now()}`, ...data };
}

export async function mockUpdateScheduleFull(scheduleId: string, data: any) {
  await delay();
  const schedule = SCHEDULES.find((s) => s.id === scheduleId);
  return schedule ? { ...schedule, ...data } : undefined;
}

export async function mockDeleteScheduleFull(_scheduleId: string) {
  await delay();
  return true;
}

export async function mockCreateRecharge(data: any) {
  await delay();
  const student = DB_STUDENTS.find((item) => item.id === data.student_id);
  if (!student) {
    throw new Error('Student not found');
  }

  const relatedClass =
    DB_CLASSES.find(
      (cls) =>
        student.classIds.includes(cls.id) &&
        (!data.subject_id || cls.subjectId === data.subject_id),
    ) || DB_CLASSES.find((cls) => student.classIds.includes(cls.id));
  const now = new Date().toISOString();
  const purchasedHours = Math.max(Number(data.total_hours || 0), 0);
  const giftHours = Math.max(Number(data.gift_hours || 0), 0);
  const totalHours = purchasedHours + giftHours;
  const feeAmount = Number(data.fee_amount || 0);

  const createdPackage: CoursePackage = {
    id: `pkg-${Date.now()}`,
    studentId: data.student_id,
    classId: relatedClass?.id || student.classIds[0] || '',
    name: data.name,
    subjectId: data.subject_id || relatedClass?.subjectId || '',
    totalHours,
    purchasedHours,
    bonusHours: giftHours,
    usedHours: 0,
    remainingHours: totalHours,
    pricePerHour: purchasedHours > 0 ? Math.round((feeAmount / purchasedHours) * 100) / 100 : 0,
    totalAmount: feeAmount,
    paymentMethod: (data.fee_method || 'cash') as CoursePackage['paymentMethod'],
    status: 'active',
    purchaseDate: now,
    expireDate: data.valid_days
      ? new Date(Date.now() + Number(data.valid_days) * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    note: data.note,
  };

  DB_PACKAGES.unshift(createdPackage);
  PACKAGE_TRANSACTIONS.unshift(buildRechargeTransactionFromPackage(createdPackage));

  return createdPackage;
}

export async function mockGetRechargeRecords(teacherId: string, studentId?: string) {
  await delay();
  let packages = filterPackagesByActor(teacherId);
  if (studentId) {
    packages = packages.filter((pkg) => pkg.studentId === studentId);
  }
  return packages.sort(
    (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
  );
}

export async function mockCreateRefund(data: {
  studentId: string;
  packageId: string;
  refundAmount: number;
  reason: string;
  operatorId?: string;
  operatorName?: string;
}) {
  await delay();
  const pkg = DB_PACKAGES.find((item) => item.id === data.packageId);
  const student = DB_STUDENTS.find((item) => item.id === data.studentId);

  if (!pkg || !student) {
    throw new Error('Refund target not found');
  }

  const refundRecord: PackageTransactionRecord = {
    id: `txn-refund-${Date.now()}`,
    type: 'refund',
    studentId: data.studentId,
    studentName: student.name,
    packageId: pkg.id,
    packageName: pkg.name,
    refundAmount: Number(data.refundAmount || 0),
    reason: data.reason,
    feeAmount: Number(data.refundAmount || 0),
    feeMethod: pkg.paymentMethod,
    operatorId: data.operatorId,
    operatorName: data.operatorName,
    purchasedRemainingSnapshot:
      pkg.purchasedHours - pkg.bonusHours > 0
        ? Math.max(pkg.remainingHours - Math.min(pkg.remainingHours, pkg.bonusHours), 0)
        : 0,
    bonusRemainingSnapshot: Math.min(pkg.remainingHours, pkg.bonusHours),
    createdAt: new Date().toISOString(),
  };

  PACKAGE_TRANSACTIONS.unshift(refundRecord);
  return refundRecord;
}

export async function mockGetPackageTransactions(teacherId: string, studentId?: string) {
  await delay();
  let records = filterPackageTransactionsByActor(teacherId);
  if (studentId) {
    records = records.filter((item) => item.studentId === studentId);
  }
  return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function pickBestPackage(packages: any[], _hoursNeeded: number, _subjectId?: string) {
  return packages[0] || null;
}

export async function mockGetSchedulesByStudent(studentId: string) {
  await delay();
  const student = DB_STUDENTS.find((s) => s.id === studentId);
  if (!student) return [];
  return SCHEDULES.filter((s) => student.classIds.includes(s.classId || ''));
}
