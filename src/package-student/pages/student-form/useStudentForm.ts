import Taro from '@tarojs/taro';
import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ContactItem } from '@/components/ContactList';
import type { ScheduleItem } from '@/components/InstallmentPanel';
import { studentService, subscribeMessageService } from '@/services';
import { useCampusStore, useStudentStore } from '@/stores';
import type { CampusUIModel, Subject } from '@/types/campus';
import type { FeeMethod } from '@/types/course-package';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import {
  chooseImageTemp,
  isImageCancelError,
  isLocalWechatFilePath,
  uploadImage,
} from '@/utils/image-upload';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';
import { askContinueCreate, backToListPage, SUCCESS_TOAST_MS } from '@/utils/post-save-navigation';
import { setRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';

/** 学员列表页（不带前导斜杠），新增成功后统一回退到这里 */
const STUDENT_LIST_PATH = 'package-student/pages/students/index';

/** 支付方式选项 */
export const FEE_METHOD_OPTIONS = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '银行转账', value: 'transfer' },
  { label: '其他', value: 'other' },
];

/** 学生类型 */
export type StudentType = 'new' | 'old';

/** 老生迁移课包草稿：科目 + 剩余课时 + 可选有效期 */
export interface LegacyPackageDraft {
  id: string;
  subjectId: string;
  subjectName: string;
  remainingHours: string;
  expireEnabled: boolean;
  expireDate: string;
}

/** 表单错误 */
export interface FormErrors {
  name?: string;
  phone?: string;
  birthday?: string;
  legacyPackages?: string;
  feeAmount?: string;
}

function createEmptyLegacyPackage(): LegacyPackageDraft {
  return {
    id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subjectId: '',
    subjectName: '',
    remainingHours: '',
    expireEnabled: false,
    expireDate: '',
  };
}

/** useStudentForm 返回值类型 */
export interface UseStudentFormReturn {
  isEdit: boolean;
  studentId: string;

  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  nickname: string;
  setNickname: React.Dispatch<React.SetStateAction<string>>;
  gender: string;
  setGender: React.Dispatch<React.SetStateAction<string>>;
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  birthday: string;
  setBirthday: React.Dispatch<React.SetStateAction<string>>;
  address: string;
  setAddress: React.Dispatch<React.SetStateAction<string>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  avatarUrl: string;
  setAvatarUrl: React.Dispatch<React.SetStateAction<string>>;
  feeAmount: string;
  setFeeAmount: React.Dispatch<React.SetStateAction<string>>;
  feeMethod: string;
  setFeeMethod: React.Dispatch<React.SetStateAction<string>>;

  studentType: StudentType;
  setStudentType: React.Dispatch<React.SetStateAction<StudentType>>;
  /** 老生：多课包迁移 */
  legacyPackages: LegacyPackageDraft[];
  addLegacyPackage: () => void;
  removeLegacyPackage: (id: string) => void;
  updateLegacyPackage: (id: string, patch: Partial<LegacyPackageDraft>) => void;
  subjects: Subject[];

  /** 可选：缴费信息 */
  paymentEnabled: boolean;
  setPaymentEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  contacts: ContactItem[];
  setContacts: React.Dispatch<React.SetStateAction<ContactItem[]>>;

  installmentEnabled: boolean;
  setInstallmentEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  installmentPeriod: number;
  setInstallmentPeriod: React.Dispatch<React.SetStateAction<number>>;
  schedule: ScheduleItem[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;

  feeMethodOther: string;
  setFeeMethodOther: React.Dispatch<React.SetStateAction<string>>;

  campusId: string;
  setCampusId: React.Dispatch<React.SetStateAction<string>>;
  campusOptions: CampusUIModel[];

  /** 推荐人学员 ID（B9 / R8，只记关系）；空串 = 没有 / 清除 */
  referrerStudentId: string;
  setReferrerStudentId: React.Dispatch<React.SetStateAction<string>>;
  /** 推荐人姓名（仅展示用） */
  referrerName: string;
  setReferrerName: React.Dispatch<React.SetStateAction<string>>;

  loading: boolean;
  loadError: string;
  notFound: boolean;
  errors: FormErrors;
  saving: boolean;
  canSubmit: boolean;
  submitBlockedReason: string;

  clearError: (field: keyof FormErrors) => void;
  validate: () => boolean;
  handleChooseAvatar: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleReset: () => void;
  reload: () => Promise<void>;
}

export function useStudentForm(): UseStudentFormReturn {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';

  const { isEdit, studentId } = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance?.router?.params || {};
    const id = decodeURIComponent(params.id || '');
    return { isEdit: Boolean(id), studentId: id };
  }, []);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeMethod, setFeeMethod] = useState<string>('');

  const [studentType, setStudentType] = useState<StudentType>('new');
  const [legacyPackages, setLegacyPackages] = useState<LegacyPackageDraft[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [paymentEnabled, setPaymentEnabled] = useState(false);

  const [contacts, setContacts] = useState<ContactItem[]>([
    { id: '1', relation: '妈妈', phone: '' },
  ]);

  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentPeriod, setInstallmentPeriod] = useState(3);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [feeMethodOther, setFeeMethodOther] = useState('');

  const [campusOptions, setCampusOptions] = useState<CampusUIModel[]>([]);
  const [campusId, setCampusId] = useState('');

  /**
   * 推荐人（B9 / R8，**只记关系、无奖励**）。
   *
   * ⚠️ 提交语义与文本字段不同：`''` 不是「不填」而是「**明确没有 / 清除**」。
   * 因此编辑态**必须先回填**当前值（见 `loadFormData`），否则保存会把已有推荐人清掉。
   */
  const [referrerStudentId, setReferrerStudentId] = useState('');
  /** 推荐人姓名（仅用于表单展示，提交只发 id） */
  const [referrerName, setReferrerName] = useState('');

  /** 主校区 id：首次进页与「继续新增」重置后都用它作为默认选中项 */
  const defaultCampusId = useMemo(
    () => campusOptions.find((campus) => campus.isMain)?.id || '',
    [campusOptions],
  );

  const updateStudentInCache = useStudentStore((state) => state.updateInCache);
  // 校区/科目为低频参照数据：经 campus store 的 TTL 读取，避免每次进页重复请求
  const fetchCampuses = useCampusStore((state) => state.fetchCampuses);
  const fetchSubjects = useCampusStore((state) => state.fetchSubjects);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const initStartAtRef = useState({ current: 0 })[0];

  const addLegacyPackage = useCallback(() => {
    setLegacyPackages((prev) => [...prev, createEmptyLegacyPackage()]);
  }, []);

  const removeLegacyPackage = useCallback((id: string) => {
    setLegacyPackages((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateLegacyPackage = useCallback((id: string, patch: Partial<LegacyPackageDraft>) => {
    setLegacyPackages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const loadFormData = useCallback(async () => {
    initStartAtRef.current = Date.now();
    reportLocalDebug({
      hypothesisId: 'H2',
      location: 'src/package-student/pages/student-form/useStudentForm.ts:loadFormData',
      msg: '[DEBUG] student form init start',
      data: { currentUserId, isEdit, studentId },
    });
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    try {
      // 校区/科目为低频参照数据：走 campus store 的 TTL（15min / 5min），
      // TTL 内进页不再重复请求；切校区/切机构由 resetDomainCaches 复位。
      await Promise.all([fetchCampuses(), fetchSubjects()]);
      const campusStore = useCampusStore.getState();
      // 从未成功拉取过（首次失败）→ 保留原「初始化失败」错误态
      if (!campusStore.lastCampusesFetchAt || !campusStore.lastSubjectsFetchAt) {
        throw new Error('校区/科目参照数据加载失败');
      }
      const campusList = campusStore.campuses;
      const subjectList = campusStore.subjects;
      setCampusOptions(campusList);
      setSubjects(subjectList);
      const mainCampusId = campusList.find((campus) => campus.isMain)?.id || '';

      if (isEdit) {
        const stu = await studentService.getById(studentId);
        if (!stu) {
          setNotFound(true);
          return;
        }

        setName(stu.name || '');
        setNickname(stu.nickname || '');
        setGender(stu.gender === 'male' ? '男' : stu.gender === 'female' ? '女' : '');
        setPhone(stu.phone || '');
        setBirthday(stu.birthday || '');
        setAddress(stu.address || '');
        setNote(stu.note || '');
        setAvatarUrl(stu.avatar_url || '');
        setFeeAmount(stu.fee_amount ? String(stu.fee_amount) : '');
        setFeeMethod(stu.fee_method || '');
        setPaymentEnabled(Boolean(stu.fee_amount || stu.fee_method));
        setCampusId(stu.campus_id || mainCampusId);
        // 联系方式：有则回填已有值，无则保留一行空白默认项
        setContacts(
          stu.contacts?.length ? stu.contacts : [{ id: '1', relation: '妈妈', phone: '' }],
        );
        // B9 / R8：推荐人必须回填，否则保存会把已有推荐人清掉（空串 = 明确清除）
        setReferrerStudentId(stu.referrer_student_id || '');
        setReferrerName(stu.referrer_student?.name || '');
        return;
      }

      setCampusId(mainCampusId);
    } catch (error) {
      logError('init student form', error);
      setLoadError('学员表单初始化失败，请稍后重试');
    } finally {
      reportLocalDebug({
        hypothesisId: 'H2',
        location: 'src/package-student/pages/student-form/useStudentForm.ts:loadFormData',
        msg: '[DEBUG] student form init end',
        data: {
          currentUserId,
          isEdit,
          studentId,
          durationMs: Date.now() - initStartAtRef.current,
        },
      });
      setLoading(false);
    }
  }, [currentUserId, isEdit, studentId, fetchCampuses, fetchSubjects, initStartAtRef]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errs.name = '请输入学生姓名';
    } else if (trimmedName.length > 20) {
      errs.name = '姓名最多20个字';
    }

    if (phone.trim() && !/^1[3-9]\d{9}$/.test(phone.trim())) {
      errs.phone = '请输入正确的11位手机号';
    }

    if (birthday) {
      const d = new Date(birthday);
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      if (d > now) errs.birthday = '出生日期不能晚于今天';
    }

    if (!isEdit) {
      if (studentType === 'old') {
        if (legacyPackages.length === 0) {
          errs.legacyPackages = '请至少添加一个课包';
        } else {
          const invalid = legacyPackages.some((pkg) => {
            const hours = parseInt(pkg.remainingHours, 10);
            if (!pkg.subjectId) return true;
            if (!pkg.remainingHours.trim() || Number.isNaN(hours) || hours <= 0) return true;
            if (pkg.expireEnabled && !pkg.expireDate) return true;
            return false;
          });
          if (invalid) {
            errs.legacyPackages = '请完善每个课包的科目、剩余课时与有效期';
          }
        }
      }
    }

    if (paymentEnabled && feeAmount.trim()) {
      const amount = parseFloat(feeAmount);
      if (isNaN(amount) || amount < 0) errs.feeAmount = '金额不能为负数';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, phone, birthday, isEdit, studentType, legacyPackages, feeAmount, paymentEnabled]);

  const submitBlockedReason = useMemo(() => {
    if (!name.trim()) return '请输入学员姓名';
    if (name.trim().length > 20) return '学员姓名最多 20 个字';

    if (phone.trim() && !/^1[3-9]\d{9}$/.test(phone.trim())) {
      return '请输入正确的 11 位手机号';
    }

    if (birthday) {
      const date = new Date(birthday);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) return '出生日期不能晚于今天';
    }

    if (!isEdit) {
      if (studentType === 'old') {
        if (legacyPackages.length === 0) return '请至少添加一个历史课包';
        for (let i = 0; i < legacyPackages.length; i += 1) {
          const pkg = legacyPackages[i];
          const label = legacyPackages.length > 1 ? `课包${i + 1}` : '课包';
          if (!pkg.subjectId) return `请选择${label}的科目`;
          const hours = parseInt(pkg.remainingHours, 10);
          if (!pkg.remainingHours.trim() || Number.isNaN(hours) || hours <= 0) {
            return `请填写${label}的剩余课时`;
          }
          if (pkg.expireEnabled && !pkg.expireDate) {
            return `请选择${label}的到期日期`;
          }
        }
      }
    }

    if (paymentEnabled) {
      if (feeAmount.trim()) {
        const amount = parseFloat(feeAmount);
        if (Number.isNaN(amount) || amount < 0) return '缴费金额不能为负数';
      }
      if (feeMethod === 'other' && !feeMethodOther.trim()) {
        return '请填写具体支付方式';
      }
      if (installmentEnabled) {
        const amount = parseFloat(feeAmount || '0');
        if (!feeAmount || Number.isNaN(amount) || amount <= 0) return '分期付款前请先填写缴费金额';
        if (!schedule.length) return '请完善分期付款计划';
        if (
          schedule.some(
            (item) =>
              !item.date ||
              !item.amount ||
              Number.isNaN(parseFloat(String(item.amount))) ||
              parseFloat(String(item.amount)) <= 0,
          )
        ) {
          return '请填写完整的分期付款计划';
        }
      }
    }

    return '';
  }, [
    name,
    phone,
    birthday,
    isEdit,
    studentType,
    legacyPackages,
    paymentEnabled,
    feeAmount,
    feeMethod,
    feeMethodOther,
    installmentEnabled,
    schedule,
  ]);

  const canSubmit = useMemo(() => !submitBlockedReason, [submitBlockedReason]);

  const clearError = useCallback((field: keyof FormErrors) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleChooseAvatar = useCallback(async () => {
    try {
      // 统一封装：chooseMedia + 隐私预检 + 1:1 裁剪 + 持久化（临时文件不回收，预览稳定）
      const path = await chooseImageTemp({ maxSizeMB: 5, cropScale: '1:1' });
      setAvatarUrl(path);
      Taro.showToast({ title: '头像已选择', icon: 'success' });
    } catch (err) {
      // 用户取消：静默
      if (isImageCancelError(err)) return;
      Taro.showToast({ title: '头像选择失败，请重试', icon: 'none' });
    }
  }, []);

  /** 清空表单（新增成功后「继续新增」以及页面「重置」按钮共用） */
  const handleReset = useCallback(() => {
    setName('');
    setNickname('');
    setGender('');
    setPhone('');
    setBirthday('');
    setAddress('');
    setNote('');
    setAvatarUrl('');
    setFeeAmount('');
    setFeeMethod('');
    setLegacyPackages([]);
    setStudentType('new');
    setPaymentEnabled(false);
    setInstallmentEnabled(false);
    setSchedule([]);
    setContacts([{ id: '1', relation: '妈妈', phone: '' }]);
    setCampusId('');
    // B9 / R8：继续新增时必须一并清空推荐人，否则会串到下一个学员
    setReferrerStudentId('');
    setReferrerName('');
    setErrors({});
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;

    if (!validate()) {
      Taro.showToast({ title: '请检查表单中的错误', icon: 'none' });
      return;
    }

    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const hasDuplicate = await studentService.checkDuplicateName(
        currentUserId,
        name.trim(),
        isEdit ? studentId : undefined,
      );
      if (hasDuplicate) {
        const { confirm } = await Taro.showModal({
          title: '重复姓名提醒',
          content: `您已存在名为「${name.trim()}」的学生，是否继续保存？`,
          confirmText: '保存',
          cancelText: '取消',
        });
        if (!confirm) {
          setSaving(false);
          return;
        }
      }

      const teacherId = currentUserId;
      const feePayload = paymentEnabled
        ? {
            fee_amount: feeAmount ? parseFloat(feeAmount) : undefined,
            fee_method: (feeMethod || undefined) as FeeMethod | undefined,
          }
        : { fee_amount: undefined, fee_method: undefined };

      let newStudent: Student | undefined;

      const resolveAvatarForStudent = async (
        targetStudentId: string,
      ): Promise<string | undefined> => {
        const raw = avatarUrl.trim();
        if (!raw) return undefined;
        if (!isLocalWechatFilePath(raw)) return raw;
        return uploadImage(raw, 'student_avatar', { refId: targetStudentId });
      };

      if (isEdit) {
        const remoteAvatar = await resolveAvatarForStudent(studentId);
        const updated = await studentService.update(studentId, {
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          phone: phone.trim() || undefined,
          gender: gender === '男' ? 'male' : gender === '女' ? 'female' : undefined,
          birthday: birthday || undefined,
          address: address.trim() || undefined,
          note: note.trim() || undefined,
          contacts,
          avatar_url: remoteAvatar,
          ...feePayload,
          campus_id: campusId || undefined,
          campus_name: campusOptions.find((c) => c.id === campusId)?.name || undefined,
          teacher_id: teacherId,
          // B9 / R8：空串 = 明确清除推荐人（后端 `null` = disconnect）
          referrer_student_id: referrerStudentId || null,
        });
        if (updated) {
          updateStudentInCache(currentUserId, updated);
          setRefreshSignal(REFRESH_SIGNAL.students);
        }
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const localAvatarPending = isLocalWechatFilePath(avatarUrl) ? avatarUrl.trim() : '';
        const existingRemoteAvatar =
          avatarUrl.trim() && !localAvatarPending ? avatarUrl.trim() : undefined;
        const initialPackages = legacyPackages.map((pkg) => {
          const hours = parseInt(pkg.remainingHours, 10);
          return {
            name: `${pkg.subjectName || '科目'}（历史导入）`,
            totalHours: hours,
            subjectId: pkg.subjectId,
            validEnd: pkg.expireEnabled ? pkg.expireDate || undefined : undefined,
            note: `老生迁移：剩余 ${hours} 课时`,
          };
        });

        newStudent = await studentService.create(
          {
            teacher_id: teacherId,
            name: name.trim(),
            nickname: nickname.trim() || undefined,
            invite_code: inviteCode,
            phone: phone.trim() || undefined,
            gender: gender === '男' ? 'male' : gender === '女' ? 'female' : undefined,
            birthday: birthday || undefined,
            address: address.trim() || undefined,
            note: note.trim() || undefined,
            contacts,
            avatar_url: existingRemoteAvatar,
            ...feePayload,
            campus_id: campusId || undefined,
            campus_name: campusOptions.find((c) => c.id === campusId)?.name || undefined,
            // B9 / R8：空串 = 明确没有推荐人（后端写入 null）
            referrer_student_id: referrerStudentId || null,
          },
          studentType === 'old' ? initialPackages : undefined,
        );

        if (newStudent && localAvatarPending) {
          try {
            const remoteAvatar = await uploadImage(localAvatarPending, 'student_avatar', {
              refId: newStudent.id,
            });
            const withAvatar = await studentService.update(newStudent.id, {
              avatar_url: remoteAvatar,
            });
            if (withAvatar) {
              newStudent = withAvatar;
            } else {
              newStudent = { ...newStudent, avatar_url: remoteAvatar };
            }
          } catch (error) {
            logError('upload student avatar after create', error);
            Taro.showToast({ title: '学员已创建，头像上传失败可稍后编辑补传', icon: 'none' });
          }
        }

        if (newStudent) {
          updateStudentInCache(currentUserId, newStudent);
          setRefreshSignal(REFRESH_SIGNAL.students);
        }
        Taro.showToast({ title: '学员已创建', icon: 'success' });
      }

      // 后端写入及必要的头像补传已经完成；订阅授权属于后续副作用，
      // 不应继续占用保存按钮的 loading 状态。
      setSaving(false);

      if (!isEdit && newStudent) {
        // 保存成功的边界到此为止。统一收尾：成功提示播完 → 询问是否继续新增 → 继续（留在本页）/ 返回列表。
        //
        // ⚠️ 订阅授权必须 fire-and-forget：runFlow → openPrompt 的 Promise
        // 只在用户点击订阅弹框时才 resolve，若 await 在跳转之前，一旦弹框未被点击
        // 跳转就永远不执行（这正是「新增成功却既不跳转也无提示」的成因）。
        const created = newStudent;
        void (async () => {
          if (await askContinueCreate('学员')) {
            handleReset();
            // 与首次进页一致：默认选中主校区
            setCampusId(defaultCampusId);
          } else {
            backToListPage(STUDENT_LIST_PATH);
          }
          try {
            await subscribeMessageService.runFlow('E01', {
              studentId: created.id,
              studentName: created.name,
              campusId: campusId || undefined,
              role: profile?.currentContext?.role,
            });
          } catch (error) {
            logError('subscribe E01 after student create', error);
          }
        })();
      } else {
        // 编辑态：让「更新成功」播完再返回
        setTimeout(() => Taro.navigateBack(), SUCCESS_TOAST_MS);
      }
    } catch (err) {
      logError('save student', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    name,
    nickname,
    gender,
    phone,
    birthday,
    address,
    note,
    avatarUrl,
    feeAmount,
    feeMethod,
    contacts,
    studentId,
    isEdit,
    validate,
    submitBlockedReason,
    studentType,
    legacyPackages,
    currentUserId,
    updateStudentInCache,
    campusId,
    campusOptions,
    referrerStudentId,
    profile?.currentContext?.role,
    paymentEnabled,
    handleReset,
    defaultCampusId,
  ]);

  return {
    isEdit,
    studentId,
    loading,
    loadError,
    notFound,
    name,
    setName,
    nickname,
    setNickname,
    gender,
    setGender,
    phone,
    setPhone,
    birthday,
    setBirthday,
    address,
    setAddress,
    note,
    setNote,
    avatarUrl,
    setAvatarUrl,
    feeAmount,
    setFeeAmount,
    feeMethod,
    setFeeMethod,
    studentType,
    setStudentType,
    legacyPackages,
    addLegacyPackage,
    removeLegacyPackage,
    updateLegacyPackage,
    subjects,
    paymentEnabled,
    setPaymentEnabled,
    contacts,
    setContacts,
    installmentEnabled,
    setInstallmentEnabled,
    installmentPeriod,
    setInstallmentPeriod,
    schedule,
    setSchedule,
    feeMethodOther,
    setFeeMethodOther,
    campusId,
    setCampusId,
    campusOptions,
    referrerStudentId,
    setReferrerStudentId,
    referrerName,
    setReferrerName,
    errors,
    saving,
    canSubmit,
    submitBlockedReason,
    clearError,
    validate,
    handleChooseAvatar,
    handleSave,
    handleReset,
    reload: loadFormData,
  };
}
