/**
 * 老生课时批量导入
 *
 * 设计稿：`.workbuddy/artifacts/课时批量导入-最终设计稿.html`（A–H 八屏，主色 #3B6EF5）。
 * 口径文档：`.workbuddy/artifacts/2026-09-30-批量导入-实施计划与验收标准.md`。
 *
 * 三条必须守住的红线（改这个页面前先看口径文档 §二）：
 * 1. **表格一行 = 一份课时** ⇒ 系统内同名只能**选一位**（勾两位各录一份 = 凭空造课时，资损级）；
 *    两位都要录的正确做法是回表格拆成两行，弹层里明确引导。
 * 2. **数字只许来自数据** —— 界面上不替用户补任何值，缺课时必须用户自己填。
 * 3. **提醒 ≠ 阻断** —— 任何待处理的行，不处理就跳过它自己，绝不影响其他行。
 *
 * 还原要点（与设计稿的对应关系）：
 * - 尺寸换算：稿上手机宽 352px ⇒ 1px ≈ 2.13rpx（750rpx / 352px）。故 11.5px→24rpx、
 *   13px→28rpx、43px 高主按钮→88rpx（同时对齐项目按钮规范）；不做逐像素硬抄。
 * - 颜色：**一律走主题 token**（`bg-primary` / `text-success` / `bg-warning/10` / `shadow-card` …），
 *   不写死色值 —— 换主题时本页跟着走。
 * - 屏 A 手风琴入口 / B 上传识别 / C 识别结果（组级三态勾选、待处理橙色问号、`…另外 N 行`）/
 *   D 识别失败 / E 全部就绪 / F 正在导入 / G 导入完成 / H 再次上传（已入账默认跳过）。
 * - 原则 #7「一屏内完成」⇒ B/C/D/E/F/G/H 的底部操作**贴住屏底**（fixed），
 *   不让用户翻过上百行去找按钮。
 */
import { Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CircleCheckbox from '@/components/CircleCheckbox';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { campusService } from '@/services/campus';
import {
  describeImportFailure,
  LegacyImportFileError,
  legacyHoursImportService,
} from '@/services/legacy-hours-import';
import type {
  LegacyImportConfig,
  LegacyImportPreviewRow,
  LegacyImportRecord,
} from '@/services/legacy-hours-import';
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';

type Stage = 'done' | 'failed' | 'idle' | 'importing' | 'parsing' | 'result';

/** 行的归属分组（互斥，一行只进一组） */
type GroupKey = 'ambig' | 'done' | 'dup' | 'err' | 'miss' | 'neu' | 'ready';

/** A 屏三条入口 */
type EntryKey = 'copy' | 'download' | 'upload';

interface RowState {
  row: LegacyImportPreviewRow;
  group: GroupKey;
  /** 是否勾选导入 */
  checked: boolean;
  /** 系统内同名已指定的学员（单选，一行只录给一位） */
  studentId?: string;
  /** 缺课时补上的数字 */
  hours?: number;
  /** 用户主动跳过这一行 */
  skipped?: boolean;
}

/** 一次导入的结果快照（G 屏要按它复述"进来多少、没进来多少"） */
interface ImportOutcome {
  batchNo: string;
  imported: number;
  /** 用户主动跳过的行数 */
  skipped: number;
  /** 其余没进来的行数（没做决定 / 表格有问题） */
  unhandled: number;
  /** 其中：还没做决定的行 */
  undecided: number;
  /** 其中：表格本身有问题的行 */
  err: number;
  /** 已入账名单（G 屏列表） */
  rows: RowState[];
}

/**
 * 这一行还在等用户做决定吗（缺课时没填 / 系统内同名没指定）。
 * 用户已跳过的行不再算"待决定"——口径：跳过 = 已处理，不算可导入、也不再催。
 */
function needsDecision(state: RowState): boolean {
  if (state.skipped) return false;
  if (state.group === 'ambig') return !state.studentId;
  if (state.group === 'miss') return typeof state.hours !== 'number';
  return false;
}

/**
 * 这一行是否**允许勾选**。
 *
 * ⚠️ `已入账`（done）行一律不允许 —— 依据是后端两个函数的条件**完全同源**：
 *   - 预览标注：`markAlreadyImported()` → `memberCard.findMany({ source:'opening', OR:[{studentId, cardTypeId}] })`
 *   - 提交拒绝：`commit()` → `memberCard.findFirst({ where:{ studentId, cardTypeId, source:'opening' } })`
 * 条件一模一样 ⇒ **被标"已入账"的行，每一行提交时都必然 409**；而 commit 在**单个事务**里
 * ⇒ 命中即**整批回滚**，会把同一批里正常的行一起带走（违反红线 3「提醒≠阻断」）。
 *
 * 因此"合规可勾选"的已入账行**是空集**：不给勾选口子，而不是"勾了再报错"。
 * 真要重导，正确路径是先删掉该学员该科目的期初卡，再重新上传（那时它就不在"已入账"组了）。
 */
function isSelectable(state: RowState): boolean {
  return state.group !== 'done';
}

/**
 * 这一行能否进提交列表。
 * `err` 行不可提交；`已入账`行不可提交（见 `isSelectable`）；`skipped` 行绝不能提交——
 * 否则缺 studentId 的行会触发后端 409「存在同名学员且未消歧」**整批回滚**，
 * 把别的行一起带走（违反红线 3）。
 */
function isImportable(state: RowState): boolean {
  return isSelectable(state) && !state.skipped && state.checked && !needsDecision(state);
}

const GROUP_META: Record<GroupKey, { hint: string; title: string; unit: string }> = {
  dup: { hint: '同名不一定是同一个人', title: '重名提醒', unit: '行' },
  ambig: { hint: '系统里有同名，不指定就跳过', title: '需要指定学员', unit: '行' },
  miss: { hint: '不处理就跳过，不影响其他行', title: '缺课时', unit: '行' },
  done: { hint: '', title: '已入账', unit: '行' },
  neu: { hint: '按表格里的档案信息建档', title: '将新建学员', unit: '人' },
  ready: { hint: '', title: '可直接导入', unit: '行' },
  err: { hint: '改好表格再重新上传', title: '无法导入', unit: '行' },
};

/** 分组展示顺序（设计稿 C 屏：重名 → 同名 → 缺课时 → 新建 → 就绪；H 屏把"已入账"提到新增之前） */
const GROUP_ORDER: GroupKey[] = ['dup', 'ambig', 'miss', 'done', 'neu', 'ready', 'err'];

/** 带"组级三态勾选框"的分组（设计稿只给 已入账 / 将新建 / 可直接导入 三组） */
const GROUP_WITH_CHECKBOX: GroupKey[] = ['done', 'neu', 'ready'];

/** 折叠时每组先显示几行，其余收在「… 以及另外 N 行」里 */
const COLLAPSED_ROWS = 3;

/** 字节数 → 展示文案（微信没给体积时返回 —） */
function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 手机号打码（弹层里区分同名候选只用得上这 7 位） */
function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

const LegacyHoursImportPage: React.FC = () => {
  const [stage, setStage] = useState<Stage>('idle');
  const [rows, setRows] = useState<RowState[]>([]);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number; total: number } | null>(
    null,
  );
  const [errorText, setErrorText] = useState('');
  /**
   * 提交被打回的原因（后端原文）+ **那一次**尝试提交的行数。
   *
   * 为什么要单独留一份、而不是只弹 toast：`commit` 在**单个事务**里，
   * 任何一行被拒（如"该学员该科目已有期初入账"）都会让**整批回滚、一行都没写入**。
   * toast 会被截断，也不说清"整批都没进去"，用户容易以为只失败了那一行。
   * 留成结果页上的红条，才能把"哪一行 + 这一批都没写"讲明白（也符合设计原则「错误提示说人话」）。
   *
   * `attempted` 必须**固化为失败那一次的行数**——不能用当前的勾选数，
   * 否则用户失败后再改勾选，红条上的数字会说谎。
   */
  const [submitError, setSubmitError] = useState<{ attempted: number; message: string } | null>(
    null,
  );
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [config, setConfig] = useState<LegacyImportConfig | null>(null);
  const [campusNames, setCampusNames] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<LegacyImportRecord[]>([]);
  /** A 屏手风琴：一次只展开一条 */
  const [openEntry, setOpenEntry] = useState<EntryKey | null>(null);
  /** 哪些分组的「… 另外 N 行」是展开状态 */
  const [expandedGroups, setExpandedGroups] = useState<GroupKey[]>([]);
  /** 弹层：当前处理的行 + 类型 */
  const [editing, setEditing] = useState<{ rowNo: number; type: 'ambig' | 'miss' } | null>(null);
  const [draftHours, setDraftHours] = useState('');
  const [pickedStudentId, setPickedStudentId] = useState<string | null>(null);
  /** B 屏进度条：真实上传进度（0~100） */
  const [uploadPercent, setUploadPercent] = useState(0);
  /** 用户点了「取消」——用来把 abort 引发的失败识别成"主动取消"，不弹错误 */
  const cancelledRef = React.useRef(false);

  // 进页面拉一次运营配置（提示词 + 模板地址）；失败不阻塞，只是没有提示词可用
  useEffect(() => {
    void legacyHoursImportService
      .getConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  // 校区名映射：同名候选只带 campusId，弹层要展示校区名来帮用户区分
  useEffect(() => {
    campusService
      .getList()
      .then((list) => {
        const map: Record<string, string> = {};
        list.forEach((campus) => {
          map[campus.id] = campus.name;
        });
        setCampusNames(map);
      })
      .catch(() => setCampusNames({}));
  }, []);

  /** 导入记录（A 屏「最近 3 批」）；失败静默降级为不显示 */
  const loadRecords = useCallback(async () => {
    try {
      const data = await legacyHoursImportService.listRecords();
      setRecords(data?.list ?? []);
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  /** 把后端预览结果切成互斥分组，并给出默认勾选 */
  const buildRows = useCallback((raw: LegacyImportPreviewRow[]): RowState[] => {
    // 表格内同名：同一姓名出现多次 —— 只提醒，不阻断，各自独立
    const nameCount = new Map<string, number>();
    raw.forEach((row) => nameCount.set(row.name, (nameCount.get(row.name) ?? 0) + 1));

    return raw.map((row) => {
      let group: GroupKey;
      // 优先级：无法导入 > 已入账 > 系统内同名待消歧 > 缺课时 > 表格内同名提醒 > 新建 > 就绪。
      // 待处理（ambig/miss）必须优先于 dup：dup 组默认勾选且视为已处理，
      // 若被 dup 吸收，未消歧/缺课时的行会被默认提交 ⇒ 后端整批拒绝，违反"提醒≠阻断"。
      if (row.status === 'error') group = 'err';
      else if (row.alreadyImported) group = 'done';
      else if ((row.candidates?.length ?? 0) > 1) group = 'ambig';
      else if (row.needsHours) group = 'miss';
      else if ((nameCount.get(row.name) ?? 0) > 1) group = 'dup';
      else if (row.status === 'new') group = 'neu';
      else group = 'ready';

      // 默认勾选：信息齐全的行才勾；待处理（需指定/缺课时）和已入账默认不勾
      const checked = group === 'dup' || group === 'neu' || group === 'ready';
      return { checked, group, row };
    });
  }, []);

  const handleChooseFile = useCallback(async () => {
    cancelledRef.current = false;
    setUploadPercent(0);
    setSubmitError(null);
    setStage('parsing');
    try {
      const next = await legacyHoursImportService.chooseAndPreview({
        onProgress: (percent) => setUploadPercent(percent),
      });
      // 用户在识别途中点了「取消」：stage 已被置回 idle，这里直接收手
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      setRows(buildRows(next.rows));
      setFileMeta({
        name: next.fileName,
        size: next.fileSize,
        total: next.summary.totalRows,
      });
      setExpandedGroups([]);
      setOutcome(null);
      setStage('result');
    } catch (error) {
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      // 失败也把"选的是哪个文件"摆出来（D 屏的文件卡）
      setFileMeta(
        error instanceof LegacyImportFileError
          ? { name: error.fileName, size: error.fileSize, total: 0 }
          : null,
      );
      setErrorText(error instanceof Error ? error.message : '识别失败');
      setStage('failed');
    }
  }, [buildRows]);

  /** B 屏「取消」：中止上传并退回空状态 */
  const handleCancelParse = useCallback(() => {
    cancelledRef.current = true;
    legacyHoursImportService.cancelUpload();
    setUploadPercent(0);
    setStage('idle');
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      await legacyHoursImportService.downloadTemplate();
    } catch (error) {
      Taro.showToast({
        icon: 'none',
        title: error instanceof Error ? error.message : '模板下载失败',
      });
    }
  }, []);

  const handleCopyPrompt = useCallback(() => {
    if (!config?.promptText) {
      Taro.showToast({ icon: 'none', title: '提示词还没加载好，请稍后再试' });
      return;
    }
    Taro.setClipboardData({ data: config.promptText });
  }, [config]);

  const toggleRow = useCallback((rowNo: number) => {
    setRows((current) =>
      current.map((state) =>
        state.row.rowNo === rowNo ? { ...state, checked: !state.checked } : state,
      ),
    );
  }, []);

  /** 点行：待处理（含已跳过）⇒ 弹层；已入账 ⇒ 不给勾、只说明原因；其余 ⇒ 普通勾选 */
  const handleRowPress = useCallback(
    (state: RowState) => {
      if (state.group === 'err') return;
      if (!isSelectable(state)) {
        // 已入账行勾了必然整批失败，所以这里只能解释，不能放行
        Taro.showToast({ icon: 'none', title: '这行上次已入账，不能重复导入' });
        return;
      }
      if (needsDecision(state) || state.skipped) {
        setDraftHours(typeof state.hours === 'number' ? String(state.hours) : '');
        setPickedStudentId(state.studentId ?? null);
        setEditing({
          rowNo: state.row.rowNo,
          type: state.group === 'ambig' ? 'ambig' : 'miss',
        });
        return;
      }
      toggleRow(state.row.rowNo);
    },
    [toggleRow],
  );

  const editingState = editing
    ? (rows.find((state) => state.row.rowNo === editing.rowNo) ?? null)
    : null;

  /** 缺课时弹层里填的数字是否有效（正整数才算数，0 / 负数 / 小数都不行） */
  const draftHoursValid = /^\d+$/.test(draftHours.trim()) && Number(draftHours) > 0;

  /** 缺课时：确定（没填有效数字 = 跳过这行，绝不替用户补值） */
  const confirmMiss = useCallback(() => {
    if (!editing) return;
    const text = draftHours.trim();
    const value = Number(text);
    const ok = /^\d+$/.test(text) && value > 0;
    setRows((current) =>
      current.map((state) =>
        state.row.rowNo === editing.rowNo
          ? ok
            ? { ...state, checked: true, hours: value, skipped: false }
            : { ...state, checked: false, skipped: true }
          : state,
      ),
    );
    setEditing(null);
    Taro.showToast({
      icon: 'none',
      title: ok ? `已按 ${value} 课时导入这一行` : '已跳过这行',
    });
  }, [draftHours, editing]);

  /** 系统内同名：确定（没选 = 跳过这行，绝不猜） */
  const confirmAmbig = useCallback(() => {
    if (!editing || !pickedStudentId) return;
    setRows((current) =>
      current.map((state) =>
        state.row.rowNo === editing.rowNo
          ? { ...state, checked: true, skipped: false, studentId: pickedStudentId }
          : state,
      ),
    );
    setEditing(null);
    setPickedStudentId(null);
    Taro.showToast({ icon: 'none', title: '已指定学员，这行现在可以导入了' });
  }, [editing, pickedStudentId]);

  /** 弹层里的「跳过这行」 */
  const skipRow = useCallback(() => {
    if (!editing) return;
    setRows((current) =>
      current.map((state) =>
        state.row.rowNo === editing.rowNo ? { ...state, checked: false, skipped: true } : state,
      ),
    );
    setEditing(null);
    setPickedStudentId(null);
    Taro.showToast({ icon: 'none', title: '已跳过这行' });
  }, [editing]);

  const closeSheet = useCallback(() => {
    setEditing(null);
    setPickedStudentId(null);
  }, []);

  /**
   * 分组全选 / 全不选 —— **只作用于"合规可勾选"的行**（`isSelectable`）。
   * 已入账组没有合规行 ⇒ 不勾任何行，只提示原因，不制造必然失败的整批。
   */
  const handleGroupToggle = useCallback(
    (key: GroupKey) => {
      const selectable = rows.filter((state) => state.group === key && isSelectable(state));
      if (selectable.length === 0) {
        Taro.showToast({ icon: 'none', title: '已入账的行不能重复导入' });
        return;
      }
      const allOn = selectable.every((state) => state.checked);
      setRows((current) =>
        current.map((state) =>
          state.group === key && isSelectable(state) ? { ...state, checked: !allOn } : state,
        ),
      );
    },
    [rows],
  );

  /** 「… 以及另外 N 行」展开 / 收起 */
  const toggleGroupExpand = useCallback((key: GroupKey) => {
    setExpandedGroups((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }, []);

  const grouped = useMemo(() => {
    const map: Record<GroupKey, RowState[]> = {
      ambig: [],
      done: [],
      dup: [],
      err: [],
      miss: [],
      neu: [],
      ready: [],
    };
    rows.forEach((state) => map[state.group].push(state));
    return map;
  }, [rows]);

  /** 可导入 = 勾选中且不需要再做决定的行 */
  const importableCount = useMemo(() => rows.filter(isImportable).length, [rows]);
  /** 需核对 = 还没做决定的行 */
  const pendingCount = useMemo(() => rows.filter(needsDecision).length, [rows]);
  const errCount = grouped.err.length;
  /** 本次是"再次上传"：预览里出现已入账的行（设计稿 H 屏） */
  const isRework = grouped.done.length > 0;
  /** 全部就绪：没有待处理、没有错误、也不是重传（设计稿 E 屏） */
  const allReady = !isRework && pendingCount === 0 && errCount === 0 && rows.length > 0;

  /** 组标题右侧的数字口径（与设计稿交互稿一致） */
  const groupHeaderCount = useCallback(
    (key: GroupKey): number => {
      const list = grouped[key];
      if (key === 'neu' || key === 'ready') return list.filter((state) => state.checked).length;
      if (key === 'ambig' || key === 'miss') return list.filter(needsDecision).length;
      return list.length;
    },
    [grouped],
  );

  /** 组级勾选框三态（只统计合规可勾选的行；已入账组恒为 none） */
  const groupCheckState = useCallback(
    (key: GroupKey): 'all' | 'none' | 'some' => {
      const list = grouped[key].filter(isSelectable);
      if (list.length === 0) return 'none';
      const on = list.filter((state) => state.checked).length;
      if (on === 0) return 'none';
      return on === list.length ? 'all' : 'some';
    },
    [grouped],
  );

  const handleSubmit = useCallback(async () => {
    const pendingRows: RowState[] = [];
    rows.forEach((state) => {
      if (isImportable(state)) pendingRows.push(state);
    });

    const payload = pendingRows.map((state) => ({
      rowNo: state.row.rowNo,
      studentId: state.studentId ?? state.row.studentId,
      newStudent:
        state.row.status === 'new'
          ? {
              birthday: state.row.birthday,
              gender: state.row.gender,
              name: state.row.name,
              phone: state.row.phone || undefined,
            }
          : undefined,
      cardTypeId: state.row.cardTypeId as string,
      // 缺课时行用用户填的数字；其余用表格里的值
      remainingCount: typeof state.hours === 'number' ? state.hours : state.row.remainingCount,
      expiry: state.row.expiry,
      // 迁移历史账单的缴费金额（后端按「分」收）与学员备注
      purchasePrice: state.row.purchasePrice,
      remark: state.row.remark,
    }));

    if (payload.length === 0) {
      Taro.showToast({ icon: 'none', title: '没有可导入的行' });
      return;
    }

    const total = fileMeta?.total ?? rows.length;
    const userSkipped = rows.filter((state) => state.skipped).length;
    const stillUndecided = rows.filter(needsDecision).length;
    const batchNo = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setSubmitError(null);
    setStage('importing');
    try {
      const committed = await legacyHoursImportService.commit({ batchNo, rows: payload });
      setOutcome({
        batchNo: committed.batchNo ?? batchNo,
        err: errCount,
        imported: committed.successRows ?? payload.length,
        rows: pendingRows,
        skipped: userSkipped,
        undecided: stillUndecided,
        unhandled: Math.max(total - payload.length - userSkipped, 0),
      });
      setStage('done');
      /**
       * ⚠️ 必须通知学员列表/学员详情重拉：导入会**新建学员**、也会写课时。
       * 否则用户返回列表看不到刚导入的学员，会误以为导入失败。
       */
      setRefreshSignal(REFRESH_SIGNAL.students);
    } catch (error) {
      // 打回时要讲清楚：哪一行、以及"整批都没写入"（commit 是单事务）
      setSubmitError({
        attempted: payload.length,
        message: error instanceof Error ? error.message : '导入失败，请重试',
      });
      setStage('result');
      Taro.showToast({ icon: 'none', title: '这一批没导入，请看页面提示' });
      // 用户刚才是滚到底点提交的，把红条滚进视野
      void Taro.pageScrollTo({ duration: 200, scrollTop: 0 }).catch(() => undefined);
    }
  }, [errCount, fileMeta, rows]);

  /** A 屏一条手风琴入口 */
  const renderEntry = (
    key: EntryKey,
    options: {
      icon: string;
      iconClass: string;
      iconColor: string;
      title: string;
      desc: string;
      actionText: string;
      actionClass: string;
      onAction: () => void;
      prime?: boolean;
      /** 是否在顶部画分隔线（设计稿 `.e + .e{border-top}`：第 2、3 条才有） */
      divider?: boolean;
      steps: React.ReactNode[];
    },
  ) => {
    const open = openEntry === key;
    return (
      <View
        className={`${options.divider ? 'border-t border-border' : ''} ${options.prime ? 'bg-primary/10' : ''}`}
      >
        <View
          className="flex items-center gap-[28rpx] px-[30rpx] py-[32rpx] active:bg-primary/5"
          onClick={() => setOpenEntry(open ? null : key)}
        >
          <View
            className={`w-[81rpx] h-[81rpx] rounded-[23rpx] center shrink-0 ${options.iconClass}`}
          >
            <Icon name={options.icon} size={38} color={options.iconColor} />
          </View>
          <View className="flex-1 min-w-0">
            <Text
              className={`block text-[31rpx] font-semibold ${options.prime ? 'text-primary' : 'text-foreground'}`}
            >
              {options.title}
            </Text>
            <Text
              className={`block text-[24rpx] mt-[6rpx] leading-[33rpx] ${options.prime ? 'text-primary/70' : 'text-muted-foreground'}`}
            >
              {options.desc}
            </Text>
          </View>
          <View className={open ? 'rotate-180 transition-transform' : 'transition-transform'}>
            <Icon name="mdi-chevron-down" size={28} color={options.prime ? 'primary' : 'muted'} />
          </View>
        </View>

        {open && (
          <View
            className={`px-[30rpx] pb-[30rpx] border-t border-border ${
              options.prime ? 'bg-primary/8' : 'bg-muted'
            }`}
          >
            <View className="flex flex-col gap-[15rpx] pt-[26rpx] pb-[24rpx]">
              {options.steps.map((step, index) => (
                <View key={String(index)} className="flex items-start gap-[19rpx]">
                  <View className="w-[34rpx] h-[34rpx] rounded-full bg-primary/10 center shrink-0 mt-[2rpx]">
                    <Text className="text-[20rpx] font-bold text-primary leading-none">
                      {index + 1}
                    </Text>
                  </View>
                  <Text className="flex-1 text-[24rpx] text-foreground/70 leading-[33rpx]">
                    {step}
                  </Text>
                </View>
              ))}
            </View>
            <View
              className={`h-[72rpx] rounded-[21rpx] center active:opacity-90 ${options.actionClass}`}
              onClick={options.onAction}
            >
              <Text className="text-[27rpx] font-semibold text-white">{options.actionText}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  /** 标签（设计稿：浅底 + 同色文字，统一用项目 tag 语义 token） */
  const renderTag = (state: RowState) => {
    if (state.skipped) return <Text className="tag bg-muted text-muted-foreground">已跳过</Text>;
    if (state.group === 'err') {
      return <Text className="tag bg-destructive/10 text-destructive">无法导入</Text>;
    }
    if (state.group === 'ambig' && !state.studentId) {
      return (
        <Text className="tag bg-warning/10 text-warning">
          同名 {state.row.candidates?.length ?? 0} 人
        </Text>
      );
    }
    if (state.group === 'miss' && typeof state.hours !== 'number') {
      return <Text className="tag bg-destructive/10 text-destructive">缺课时</Text>;
    }
    if (state.group === 'done') {
      return <Text className="tag bg-muted text-muted-foreground">已入账</Text>;
    }
    if (state.group === 'dup') return <Text className="tag bg-warning/10 text-warning">重名</Text>;
    if (state.group === 'neu')
      return <Text className="tag bg-primary/10 text-primary">新学员</Text>;
    return <Text className="tag bg-success/10 text-success">就绪</Text>;
  };

  const renderRow = (state: RowState) => {
    const hourText =
      typeof state.hours === 'number'
        ? state.hours
        : state.group === 'miss' && needsDecision(state)
          ? '—'
          : state.row.remainingCount;

    // 无法导入：只读展示 + 原因，不给勾选框（勾了也提交不了）
    if (state.group === 'err') {
      return (
        <View
          key={state.row.rowNo}
          className="px-[28rpx] py-[19rpx] border-t border-border bg-destructive/5"
        >
          <View className="flex items-center gap-[19rpx]">
            <View className="w-[36rpx] shrink-0" />
            <Text className="flex-1 min-w-0 truncate text-[27rpx] font-medium text-muted-foreground">
              {state.row.name}
            </Text>
            <Text className="text-[23rpx] text-muted-foreground shrink-0">
              {state.row.subjectName}
            </Text>
            {renderTag(state)}
          </View>
          {state.row.reason ? (
            <Text className="block text-[21rpx] text-destructive leading-[30rpx] mt-[6rpx] pl-[55rpx]">
              {state.row.reason}
            </Text>
          ) : null}
        </View>
      );
    }

    const pending = needsDecision(state);
    const muted = !state.checked && !pending;
    /**
     * 迁移过来的附带信息（有才显示）：缴费金额按「元」展示（后端给的是分）。
     * 账单迁移场景下用户要能逐行核对金额，不能只显示课时。
     */
    const extraText = [
      state.row.purchasePrice ? `¥${(state.row.purchasePrice / 100).toFixed(2)}` : '',
      state.row.remark ? `备注：${state.row.remark}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <View
        key={state.row.rowNo}
        className={`flex items-center gap-[19rpx] px-[28rpx] py-[19rpx] border-t border-border ${
          muted ? 'bg-muted/30' : ''
        }`}
        onClick={() => handleRowPress(state)}
      >
        {/* 待处理行：橙色虚线问号（点它开弹层）；已入账：锁形（不可勾，点了只提示）；其余为圆形勾选框 */}
        {!isSelectable(state) ? (
          <View className="w-[36rpx] h-[36rpx] rounded-full border-[3rpx] border-border bg-muted center shrink-0">
            <Icon name="mdi-lock" size={20} color="muted" />
          </View>
        ) : pending || state.skipped ? (
          <View className="w-[36rpx] h-[36rpx] rounded-full border-[3rpx] border-dashed border-warning bg-warning/10 center shrink-0">
            {pending ? (
              <Text className="text-[21rpx] font-bold text-warning leading-none">?</Text>
            ) : null}
          </View>
        ) : (
          <CircleCheckbox checked={state.checked} size={36} />
        )}
        <View className="flex-1 min-w-0">
          <Text
            className={`block truncate text-[27rpx] font-medium ${
              muted ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {state.row.name}
          </Text>
          {/* 固定渲染、用 CSS 显隐（本仓既有约束：Taro reconciler 下子节点数量不能变） */}
          <Text
            className={`block truncate text-[21rpx] text-muted-foreground mt-[4rpx] ${
              extraText ? '' : 'opacity-0 h-0 overflow-hidden'
            }`}
          >
            {extraText}
          </Text>
        </View>
        <Text className="text-[23rpx] text-muted-foreground shrink-0">
          {state.row.subjectName} · {hourText}
        </Text>
        {renderTag(state)}
        {(pending || state.skipped) && <Icon name="mdi-chevron-right" size={23} color="muted" />}
      </View>
    );
  };

  const renderGroup = (key: GroupKey) => {
    const list = grouped[key];
    if (list.length === 0) return null;
    const meta = GROUP_META[key];
    const expanded = expandedGroups.includes(key);
    const visible = expanded ? list : list.slice(0, COLLAPSED_ROWS);
    const restCount = list.length - visible.length;
    const withCheckbox = GROUP_WITH_CHECKBOX.includes(key);
    const checkState = groupCheckState(key);
    /** 这组里还有没有"合规可勾选"的行（已入账组恒为 false ⇒ 勾选框显示为不可用） */
    const groupHasSelectable = list.some(isSelectable);

    return (
      <View key={key} className="bg-card rounded-card shadow-card overflow-hidden">
        <View className="flex items-center justify-between gap-[16rpx] px-[28rpx] pt-[21rpx] pb-[17rpx]">
          <Text className="text-[24rpx] font-semibold text-muted-foreground">
            {meta.title}{' '}
            <Text className="text-[22rpx] font-normal text-muted-foreground/70">
              {groupHeaderCount(key)} {meta.unit}
            </Text>
          </Text>
          {withCheckbox ? (
            <View
              className={`w-[34rpx] h-[34rpx] rounded-[10rpx] border-[3rpx] center shrink-0 ${
                !groupHasSelectable
                  ? 'border-border bg-muted opacity-40'
                  : checkState === 'none'
                    ? 'border-border bg-card'
                    : 'border-primary bg-primary'
              }`}
              onClick={() => handleGroupToggle(key)}
            >
              {checkState !== 'none' && (
                <Icon
                  name={checkState === 'all' ? 'mdi-check' : 'mdi-minus'}
                  size={20}
                  color="white"
                />
              )}
            </View>
          ) : meta.hint ? (
            <Text className="text-[21rpx] text-muted-foreground shrink-0">{meta.hint}</Text>
          ) : null}
        </View>

        {/* 再次上传：已入账组要先讲清"为什么不能勾"，再列行（设计稿 H 屏） */}
        {key === 'done' && (
          <View className="mx-[28rpx] mb-[17rpx] rounded-[21rpx] border border-warning/30 bg-warning/10 px-[23rpx] py-[19rpx]">
            <Text className="text-[22rpx] text-warning leading-[34rpx]">
              上次已经导进去的，<Text className="font-semibold">这次不能再导</Text>
              。系统在提交前就核过：这些学员的科目已有期初入账，重导会被后端整批拒绝，
              连同一批里正常的行一起失败，所以这里不给勾。真要重导，请先删掉该学员该科目的期初卡，再重新上传。
            </Text>
          </View>
        )}

        {visible.map((state) => renderRow(state))}

        {(restCount > 0 || expanded) && (
          <View
            className="py-[21rpx] border-t border-border center active:bg-primary/5"
            onClick={() => toggleGroupExpand(key)}
          >
            <Text className="text-[24rpx] font-semibold text-primary">
              {expanded ? '收起' : `… 以及另外 ${restCount} ${key === 'neu' ? '人' : '行'}`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  /** 三格统计（设计稿 .sum：白卡 + 竖分隔线） */
  const renderStats = (cells: { color: string; label: string; value: number }[]) => (
    <View className="flex bg-card rounded-card py-[21rpx] shadow-card">
      {cells.map((cell, index) => (
        <React.Fragment key={cell.label}>
          {index > 0 && <View className="w-[2rpx] bg-border my-[6rpx] shrink-0" />}
          <View className="flex-1 flex flex-col items-center">
            <Text className={`text-[34rpx] font-bold leading-[42rpx] ${cell.color}`}>
              {cell.value}
            </Text>
            <Text className="text-[21rpx] text-muted-foreground mt-[4rpx]">{cell.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );

  /** 文件卡（B/C/E/H 屏共用） */
  const renderFileCard = (bad = false) => {
    if (!fileMeta) return null;
    const meta = bad
      ? formatSize(fileMeta.size)
      : `${fileMeta.total} 行 · ${formatSize(fileMeta.size)}${isRework ? ' · 再次上传' : ''}`;
    return (
      <View className="flex items-center gap-[21rpx] bg-card rounded-card px-[28rpx] py-[26rpx] shadow-card">
        <View
          className={`w-[68rpx] h-[68rpx] rounded-[19rpx] center shrink-0 ${
            bad ? 'bg-destructive/10' : 'bg-success/10'
          }`}
        >
          <Icon
            name={bad ? 'mdi-alert-circle-outline' : 'mdi-file-document-outline'}
            size={34}
            color={bad ? 'destructive' : 'success'}
          />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="block text-[27rpx] font-semibold text-foreground truncate">
            {fileMeta.name}
          </Text>
          <Text className="block text-[22rpx] text-muted-foreground mt-[4rpx]">{meta}</Text>
        </View>
        {!bad && stage === 'result' && (
          <Text
            className="text-[23rpx] font-semibold text-primary shrink-0"
            onClick={handleChooseFile}
          >
            换文件
          </Text>
        )}
      </View>
    );
  };

  /** 骨架屏（B/F 屏：告诉用户"在动"，别以为卡了） */
  const renderSkeleton = () => (
    <View className="bg-card rounded-card px-[28rpx] pb-[26rpx] pt-[4rpx] shadow-card">
      {Array.from({ length: 12 }).map((_, index) => (
        <View
          key={index}
          className={`h-[23rpx] rounded-[11rpx] bg-muted mt-[28rpx] ${
            index % 3 === 0 ? 'w-[42%]' : index % 3 === 1 ? 'w-[74%]' : 'w-[58%]'
          }`}
        />
      ))}
    </View>
  );

  /** 进度条（B 屏用真实上传进度；F 屏无进度可拿 ⇒ 走不确定态动画，不编数字） */
  const renderProgress = (percent: number | null, label: string, right: string) => (
    <View className="bg-card rounded-card px-[30rpx] py-[30rpx] shadow-card">
      <View className="h-[11rpx] rounded-full bg-muted overflow-hidden">
        {percent === null ? (
          <View className="h-full w-1/2 rounded-full bg-primary/40 animate-pulse" />
        ) : (
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(percent, 2)}%` }}
          />
        )}
      </View>
      <View className="flex items-center justify-between mt-[21rpx]">
        <Text className="text-[24rpx] text-muted-foreground">{label}</Text>
        <Text className="text-[24rpx] text-muted-foreground">{right}</Text>
      </View>
    </View>
  );

  /** 提示条（设计稿 .banner：ok 绿 / warn 橙 / bad 红） */
  const renderBanner = (tone: 'ok' | 'warn' | 'bad', title: string, desc: string) => {
    const toneMap = {
      bad: { bg: 'bg-destructive/10', color: 'destructive' as const, text: 'text-destructive' },
      ok: { bg: 'bg-success/10', color: 'success' as const, text: 'text-success' },
      warn: { bg: 'bg-warning/10', color: 'warning' as const, text: 'text-warning' },
    }[tone];
    const iconName = tone === 'ok' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline';
    return (
      <View
        className={`flex items-start gap-[19rpx] rounded-[26rpx] px-[28rpx] py-[23rpx] ${toneMap.bg}`}
      >
        <Icon name={iconName} size={32} color={toneMap.color} className="mt-[4rpx]" />
        <View className="flex-1 min-w-0">
          <Text className={`block text-[26rpx] font-semibold ${toneMap.text}`}>{title}</Text>
          <Text
            className={`block text-[23rpx] leading-[34rpx] mt-[4rpx] ${toneMap.text} opacity-80`}
          >
            {desc}
          </Text>
        </View>
      </View>
    );
  };

  /** 贴底主按钮（设计稿原则 #7：一屏内完成） */
  const renderCta = () => {
    if (stage === 'parsing') {
      return (
        <View className="h-[88rpx] rounded-card bg-muted center">
          <Text className="text-[29rpx] font-semibold text-muted-foreground">识别中，请稍候</Text>
        </View>
      );
    }
    if (stage === 'importing') {
      return (
        <View className="h-[88rpx] rounded-card bg-primary/60 center">
          <View className="flex items-center gap-[14rpx]">
            <View
              className="w-[26rpx] h-[26rpx] rounded-full animate-spin"
              style={{
                borderColor: 'rgba(255,255,255,.4)',
                borderStyle: 'solid',
                borderTopColor: '#ffffff',
                borderWidth: '4rpx',
              }}
            />
            <Text className="text-[29rpx] font-semibold text-white">正在导入…</Text>
          </View>
        </View>
      );
    }
    if (stage === 'failed') {
      return (
        <View className="h-[88rpx] rounded-card bg-primary center" onClick={handleChooseFile}>
          <Text className="text-[29rpx] font-semibold text-white">重新选择文件</Text>
        </View>
      );
    }
    if (stage === 'done') {
      return (
        <View className="flex flex-col gap-[19rpx]">
          <View
            className="h-[88rpx] rounded-card border border-primary/40 bg-card center"
            onClick={() => {
              setRows([]);
              setFileMeta(null);
              setOutcome(null);
              setStage('idle');
              void loadRecords();
            }}
          >
            <Text className="text-[29rpx] font-semibold text-primary">查看导入记录</Text>
          </View>
          <View
            className="h-[88rpx] rounded-card bg-primary center"
            onClick={() => Taro.navigateBack()}
          >
            <Text className="text-[29rpx] font-semibold text-white">完成</Text>
          </View>
        </View>
      );
    }
    // result（C / E / H 屏）
    const disabled = importableCount <= 0;
    return (
      <View
        className={`h-[88rpx] rounded-card center ${disabled ? 'bg-muted' : 'bg-primary active:opacity-90'}`}
        onClick={disabled ? undefined : handleSubmit}
      >
        <Text
          className={`text-[29rpx] font-semibold ${disabled ? 'text-muted-foreground' : 'text-white'}`}
        >
          {disabled ? '请至少选择 1 行' : `确认导入 ${importableCount} 行`}
        </Text>
      </View>
    );
  };

  const ctaHint = {
    done: '',
    failed: '',
    idle: '',
    importing: '中途退出不会写入半截数据，可以放心等',
    parsing: '正在上传并识别，请不要退出页面',
    result: '没处理的行会自动跳过，不影响已勾选的行导入',
  }[stage];

  return (
    <PageContainer>
      {/* 内容区留出贴底操作区的高度，避免最后几行被盖住 */}
      <View
        className={`px-[26rpx] ${stage === 'idle' ? 'pb-[40rpx]' : 'pb-[250rpx]'} flex flex-col gap-[21rpx]`}
      >
        {/* ══════════════ A 空状态 ══════════════ */}
        {stage === 'idle' && (
          <>
            <Text className="block text-[24rpx] text-muted-foreground leading-[38rpx] px-[6rpx]">
              把老生的剩余课时导入进来。表格准备好了就直接选文件。
            </Text>

            <View className="bg-card rounded-card shadow-card overflow-hidden">
              {renderEntry('copy', {
                actionClass: 'bg-primary shadow-float',
                actionText: '复制提示词',
                desc: '复制规则发给任意 AI，原始数据贴给它',
                icon: 'mdi-content-copy',
                iconClass: 'bg-primary/10',
                iconColor: 'primary',
                onAction: handleCopyPrompt,
                steps: [
                  '点下面的按钮，复制整理规则',
                  '打开任意 AI，把规则贴进去',
                  <>
                    再把<Text className="font-semibold text-foreground">原始数据</Text>
                    接在后面发给它
                  </>,
                  <>
                    让它输出表格，存成 <Text className="font-semibold text-foreground">.xlsx</Text>
                  </>,
                ],
                title: '让 AI 帮你整理',
              })}
              {renderEntry('download', {
                actionClass: 'bg-success shadow-float',
                actionText: '下载模板',
                desc: '表头和一行示例都给你备好了',
                divider: true,
                icon: 'mdi-download',
                iconClass: 'bg-success/10',
                iconColor: 'success',
                onAction: handleDownload,
                steps: [
                  '点下面的按钮，下载模板',
                  <>
                    <Text className="font-semibold text-foreground">姓名、科目、课时</Text>三列必填
                  </>,
                  '一个学员一个科目占一行',
                  <>
                    存成 <Text className="font-semibold text-foreground">.xlsx</Text> 再回来导入
                  </>,
                ],
                title: '下载空白模板自己填',
              })}
              {renderEntry('upload', {
                actionClass: 'bg-primary shadow-float',
                actionText: '选择文件',
                desc: '系统先识别，把要确认的行标出来',
                divider: true,
                icon: 'mdi-file-document-outline',
                iconClass: 'bg-primary shadow-float',
                iconColor: 'white',
                onAction: handleChooseFile,
                prime: true,
                steps: [
                  <>
                    只支持 <Text className="font-semibold text-foreground">.xlsx</Text>，旧版 .xls
                    请先另存
                  </>,
                  '表头 7 列不能改，顺序固定',
                  '系统先识别，再让你核对',
                  <>
                    单次最多 <Text className="font-semibold text-foreground">500 行</Text>
                    ，超了请分批
                  </>,
                ],
                title: '选择整理好的 .xlsx',
              })}
            </View>

            {records.length > 0 && (
              <View className="bg-card rounded-card shadow-card overflow-hidden">
                <View className="flex items-center justify-between px-[28rpx] pt-[21rpx] pb-[17rpx]">
                  <Text className="text-[24rpx] font-semibold text-muted-foreground">导入记录</Text>
                  <Text className="text-[22rpx] font-normal text-muted-foreground/70">
                    最近 3 批
                  </Text>
                </View>
                {records.slice(0, 3).map((record) => (
                  <View
                    key={record.id}
                    className="flex items-center gap-[19rpx] px-[28rpx] py-[19rpx] border-t border-border"
                  >
                    <Text className="flex-1 min-w-0 truncate text-[27rpx] font-medium text-foreground">
                      {record.batchNo}
                    </Text>
                    <Text className="text-[23rpx] text-muted-foreground shrink-0">
                      {record.successRows}/{record.totalRows}
                    </Text>
                    {record.failedRows > 0 ? (
                      <Text className="tag bg-warning/10 text-warning">
                        {record.failedRows} 行跳过
                      </Text>
                    ) : (
                      <Text className="tag bg-success/10 text-success">
                        {record.status === 'reverted' ? '已撤销' : '已完成'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {renderBanner(
              'warn',
              '姓名、科目、剩余课时必须有',
              '缺任何一列，整行都进不来。手机号主要用来认老学员，填了更准。',
            )}
          </>
        )}

        {/* ══════════════ B 识别中 ══════════════ */}
        {stage === 'parsing' && (
          <>
            {renderFileCard()}
            {renderProgress(
              uploadPercent,
              '正在识别学员、科目和课时…',
              uploadPercent >= 100 ? '识别中' : `${uploadPercent}%`,
            )}
            {/*
              设计稿把「取消」画在导航栏左侧，但本页用的是**微信原生导航栏**
              （口径 Q4：保留返回箭头，不自己画），原生栏塞不进自定义按钮 ⇒
              退而求其次，把出口放在进度下方。意图不变：别让用户以为卡了、且能随时退出。
            */}
            <View
              className="h-[76rpx] rounded-card border border-border bg-card center active:opacity-80"
              onClick={handleCancelParse}
            >
              <Text className="text-[26rpx] font-medium text-muted-foreground">取消本次识别</Text>
            </View>
            {renderSkeleton()}
          </>
        )}

        {/* ══════════════ D 识别失败 ══════════════ */}
        {stage === 'failed' && (
          <>
            {renderFileCard(true)}
            {renderBanner(
              'bad',
              describeImportFailure(errorText),
              errorText || '没能读出这份表格，请确认是按模板填写的。',
            )}

            <View className="bg-card rounded-card shadow-card overflow-hidden">
              <View
                className="flex items-center gap-[28rpx] px-[30rpx] py-[32rpx] active:bg-primary/5"
                onClick={handleChooseFile}
              >
                <View className="w-[81rpx] h-[81rpx] rounded-[23rpx] bg-primary shadow-float center shrink-0">
                  <Icon name="mdi-file-document-outline" size={38} color="white" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="block text-[31rpx] font-semibold text-foreground">
                    重新选择文件
                  </Text>
                  <Text className="block text-[24rpx] text-muted-foreground mt-[6rpx]">
                    重新选一份填好的表格
                  </Text>
                </View>
                <Icon name="mdi-chevron-right" size={26} color="muted" />
              </View>
              <View
                className="flex items-center gap-[28rpx] px-[30rpx] py-[32rpx] border-t border-border active:bg-primary/5"
                onClick={handleCopyPrompt}
              >
                <View className="w-[81rpx] h-[81rpx] rounded-[23rpx] bg-primary/10 center shrink-0">
                  <Icon name="mdi-content-copy" size={38} color="primary" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="block text-[31rpx] font-semibold text-foreground">
                    让 AI 重新整理一遍
                  </Text>
                  <Text className="block text-[24rpx] text-muted-foreground mt-[6rpx]">
                    复制提示词，把原表格发给 AI
                  </Text>
                </View>
                <Icon name="mdi-chevron-right" size={26} color="muted" />
              </View>
            </View>

            <View className="bg-card rounded-card shadow-card overflow-hidden">
              <View className="px-[28rpx] pt-[21rpx] pb-[17rpx]">
                <Text className="text-[24rpx] font-semibold text-muted-foreground">
                  最常见的 3 个原因
                </Text>
              </View>
              {['表头不在第一行', '列名被改过（如「名字」写成「学员」）', '表头里有合并单元格'].map(
                (reason) => (
                  <View key={reason} className="px-[28rpx] py-[19rpx] border-t border-border">
                    <Text className="text-[24rpx] text-muted-foreground">{reason}</Text>
                  </View>
                ),
              )}
            </View>
          </>
        )}

        {/* ══════════════ C / E / H 识别结果 ══════════════ */}
        {stage === 'result' && (
          <>
            {renderFileCard()}

            {/*
              被打回：必须讲清两件事 —— ① 后端给的具体原因（含第几行）；
              ② 这一批**一行都没写入**（commit 是单事务，一行被拒整批回滚），
              否则用户会以为"只失败了那一行，别的都进去了"。
            */}
            {submitError &&
              renderBanner(
                'bad',
                '这一批没有导入',
                `${submitError.message}。提交是一个整体事务：这一批 ${submitError.attempted} 行一行都没写入，不是只失败那一行。${
                  submitError.message.includes('已有期初入账')
                    ? '要么先在学员卡包里删掉那张期初卡，要么把这一行从表格里去掉、重新上传。'
                    : '按提示处理掉那一行后可以直接再提交。'
                }`,
              )}

            {/* E 屏：一行都不用确认时先报平安 */}
            {!submitError &&
              allReady &&
              renderBanner(
                'ok',
                `${fileMeta?.total ?? rows.length} 行全部可以导入`,
                '姓名、科目、剩余课时都齐了，没有需要你确认的行。',
              )}

            {isRework
              ? renderStats([
                  { color: 'text-success', label: '将导入', value: importableCount },
                  // 已入账行一律不可勾选（见 isSelectable）⇒ 这里的"已入账"就是全组行数
                  { color: 'text-muted-foreground', label: '已入账', value: grouped.done.length },
                  {
                    color: 'text-destructive',
                    label: '跳过',
                    value: Math.max(
                      (fileMeta?.total ?? rows.length) - importableCount - grouped.done.length,
                      0,
                    ),
                  },
                ])
              : allReady
                ? renderStats([
                    { color: 'text-success', label: '可导入', value: importableCount },
                    {
                      color: 'text-primary',
                      label: '新建学员',
                      value: grouped.neu.filter((s) => s.checked).length,
                    },
                    {
                      color: 'text-muted-foreground',
                      label: '匹配老学员',
                      value: importableCount - grouped.neu.filter((s) => s.checked).length,
                    },
                  ])
                : renderStats([
                    { color: 'text-success', label: '可导入', value: importableCount },
                    { color: 'text-warning', label: '需核对', value: pendingCount },
                    { color: 'text-destructive', label: '无法导入', value: errCount },
                  ])}

            {GROUP_ORDER.map((key) => renderGroup(key))}

            {rows.length === 0 && <Empty icon="mdi-inbox" description="没有可导入的数据行" />}
          </>
        )}

        {/* ══════════════ F 正在导入 ══════════════ */}
        {stage === 'importing' && (
          <>
            {renderBanner(
              'ok',
              `已确认 ${importableCount} 行`,
              '正在写入课时账本，请不要退出页面。',
            )}
            {renderProgress(null, '正在写入课时账本…', '')}
            {renderSkeleton()}
          </>
        )}

        {/* ══════════════ G 导入完成 ══════════════ */}
        {stage === 'done' && outcome && (
          <>
            <View className="center-col pt-[42rpx]">
              <View className="w-[132rpx] h-[132rpx] rounded-full bg-success/10 center">
                <Icon name="mdi-check-circle-outline" size={64} color="success" />
              </View>
              <Text className="block text-[35rpx] font-bold text-foreground mt-[25rpx]">
                成功导入 {outcome.imported} 行
              </Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[10rpx]">
                批次号 {outcome.batchNo} · 刚刚
              </Text>
            </View>

            {renderStats([
              { color: 'text-success', label: '已导入', value: outcome.imported },
              { color: 'text-warning', label: '已跳过', value: outcome.skipped },
              { color: 'text-destructive', label: '未处理', value: outcome.unhandled },
            ])}

            {outcome.unhandled > 0 &&
              renderBanner(
                'warn',
                `还有 ${outcome.unhandled} 行没进来`,
                [
                  outcome.skipped > 0 ? `${outcome.skipped} 行你选择了跳过` : '',
                  outcome.undecided > 0 ? `${outcome.undecided} 行还没做决定` : '',
                  outcome.err > 0 ? `${outcome.err} 行表格有问题` : '',
                ]
                  .filter(Boolean)
                  .join('、') + '。补齐后可以再导一次，已导入的不会重复。',
              )}

            {outcome.rows.length > 0 && (
              <View className="bg-card rounded-card shadow-card overflow-hidden">
                <View className="flex items-center justify-between px-[28rpx] pt-[21rpx] pb-[17rpx]">
                  <Text className="text-[24rpx] font-semibold text-muted-foreground">
                    本次已入账{' '}
                    <Text className="text-[22rpx] font-normal text-muted-foreground/70">
                      {outcome.imported} 人
                    </Text>
                  </Text>
                </View>
                {outcome.rows.slice(0, COLLAPSED_ROWS).map((state) => (
                  <View
                    key={state.row.rowNo}
                    className="flex items-center gap-[19rpx] px-[28rpx] py-[19rpx] border-t border-border"
                  >
                    <Text className="flex-1 min-w-0 truncate text-[27rpx] font-medium text-foreground">
                      {state.row.name}
                    </Text>
                    <Text className="text-[23rpx] text-muted-foreground shrink-0">
                      {state.row.subjectName} · +
                      {typeof state.hours === 'number' ? state.hours : state.row.remainingCount}
                    </Text>
                    <Text className="tag bg-success/10 text-success">已入账</Text>
                  </View>
                ))}
                {outcome.rows.length > COLLAPSED_ROWS && (
                  <View className="px-[28rpx] py-[19rpx] border-t border-border center">
                    <Text className="text-[23rpx] text-muted-foreground">
                      … 以及另外 {outcome.rows.length - COLLAPSED_ROWS} 人
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* 贴底操作区 */}
      {stage !== 'idle' && (
        <View
          className="fixed bottom-0 left-0 right-0 z-10 bg-card border-t border-border px-[26rpx] pt-[20rpx]"
          style={{ paddingBottom: 'calc(20rpx + env(safe-area-inset-bottom))' }}
        >
          {renderCta()}
          {ctaHint ? (
            <Text className="block text-center text-[22rpx] text-muted-foreground mt-[16rpx] leading-[33rpx]">
              {ctaHint}
            </Text>
          ) : null}
        </View>
      )}

      {/* ══════════════ 缺课时弹层 ══════════════ */}
      <BottomSheet visible={editing?.type === 'miss'} onClose={closeSheet} keyboardAware>
        <View className="px-[30rpx] pb-[30rpx]">
          <Text className="block text-[30rpx] font-semibold text-foreground">
            {editingState?.row.name} · {editingState?.row.subjectName} · 缺课时
          </Text>
          <Text className="block text-[23rpx] text-muted-foreground mt-[8rpx] leading-[36rpx]">
            表格里这一行没填剩余课时，补一个数字就能导入。
          </Text>

          {/* 先把"系统读到的值"摆出来，再让用户改 */}
          <View className="mt-[23rpx] flex items-center justify-between bg-muted rounded-[21rpx] px-[28rpx] py-[23rpx]">
            <Text className="text-[24rpx] text-muted-foreground">系统读到的剩余课时</Text>
            <Text className="text-[28rpx] font-bold text-muted-foreground">
              {typeof editingState?.hours === 'number' ? editingState.hours : '— 未填'}
            </Text>
          </View>

          <View
            className={`mt-[21rpx] flex items-center gap-[19rpx] rounded-card bg-card px-[30rpx] h-[119rpx] border-[3rpx] ${
              draftHoursValid ? 'border-primary' : 'border-border'
            }`}
          >
            <Input
              className="flex-1 text-[45rpx] font-bold text-foreground bg-transparent"
              placeholder="例如 36"
              placeholderClass="text-[30rpx] text-muted-foreground"
              type="number"
              value={draftHours}
              onInput={(event) => setDraftHours(event.detail.value ?? '')}
            />
            <Text className="text-[24rpx] text-muted-foreground shrink-0">课时</Text>
          </View>

          <Text
            className={`block text-[22rpx] mt-[19rpx] leading-[34rpx] ${draftHoursValid ? 'text-success font-semibold' : 'text-muted-foreground'}`}
          >
            {draftHoursValid
              ? `确定后按 ${Number(draftHours)} 课时导入这一行`
              : '不填 = 这一行不导入，其他行不受影响'}
          </Text>

          <View
            className="mt-[28rpx] h-[81rpx] rounded-[23rpx] bg-primary center active:opacity-90"
            onClick={confirmMiss}
          >
            <Text className="text-[27rpx] font-semibold text-white">确定</Text>
          </View>
        </View>
      </BottomSheet>

      {/* ══════════════ 系统内同名弹层（单选） ══════════════ */}
      <BottomSheet visible={editing?.type === 'ambig'} onClose={closeSheet}>
        <BlindAmbigSheet
          candidates={editingState?.row.candidates ?? []}
          campusNames={campusNames}
          hours={
            typeof editingState?.hours === 'number'
              ? editingState.hours
              : (editingState?.row.remainingCount ?? 0)
          }
          name={editingState?.row.name ?? ''}
          onConfirm={confirmAmbig}
          onPick={setPickedStudentId}
          onSkip={skipRow}
          pickedStudentId={pickedStudentId}
          subject={editingState?.row.subjectName ?? ''}
        />
      </BottomSheet>
    </PageContainer>
  );
};

/**
 * 系统内同名弹层（设计稿 C 屏弹层）。
 *
 * ⚠️ **必须单选**：表格这一行只声明了一份课时（如 20），只够录给一个人。
 * 勾两位各录 20 = 凭空造出第二份课时，而后端只查"同一学员同一科目是否已入账"，
 * 两位不同学员**不会拦** ⇒ 错的数字会真的写进账本。所以不给"多选"这个口子。
 *
 * 候选全都没登记手机号、又在同一校区时，用户客观上分不出来 ⇒ 明说 + 给出路，
 * 绝不替他猜。
 */
const BlindAmbigSheet: React.FC<{
  candidates: {
    campusId?: string | null;
    name: string;
    phone?: string | null;
    studentId: string;
  }[];
  campusNames: Record<string, string>;
  hours: number;
  name: string;
  onConfirm: () => void;
  onPick: (studentId: string) => void;
  onSkip: () => void;
  pickedStudentId: string | null;
  subject: string;
}> = ({
  candidates,
  campusNames,
  hours,
  name,
  onConfirm,
  onPick,
  onSkip,
  pickedStudentId,
  subject,
}) => {
  // 候选全都没有手机号 ⇒ 用户客观上分不出来，得明说并给出路
  const blind = candidates.length > 0 && candidates.every((item) => !item.phone);

  return (
    <View className="px-[30rpx] pb-[30rpx]">
      <Text className="block text-[30rpx] font-semibold text-foreground">
        {name} · {subject} · {hours} 课时
      </Text>
      <Text className="block text-[23rpx] text-muted-foreground mt-[8rpx] leading-[36rpx]">
        系统里有 {candidates.length} 位同名学员。这 {hours}{' '}
        课时只能录给其中一位，请选出这一行属于谁。
      </Text>

      {blind && (
        <View className="mt-[23rpx] rounded-[21rpx] border border-warning/30 bg-warning/10 px-[23rpx] py-[19rpx]">
          <Text className="text-[22rpx] text-warning leading-[34rpx]">
            <Text className="font-semibold">这 {candidates.length} 位看不出区别</Text>
            ：都没登记手机号、也在同一校区。拿不准就先跳过这行，去学员档案补上手机号再重新导入。
          </Text>
        </View>
      )}

      {candidates.map((candidate, index) => {
        const picked = pickedStudentId === candidate.studentId;
        return (
          <View
            key={candidate.studentId}
            className={`mt-[21rpx] flex items-center gap-[19rpx] rounded-[23rpx] border px-[26rpx] py-[23rpx] ${
              picked ? 'border-primary bg-primary/5' : 'border-border bg-card'
            }`}
            onClick={() => onPick(candidate.studentId)}
          >
            <View className="w-[60rpx] h-[60rpx] rounded-full bg-primary/10 center shrink-0">
              <Text className="text-[27rpx] font-semibold text-primary leading-none">
                {candidate.name.slice(0, 1)}
              </Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="block text-[27rpx] font-semibold text-foreground">
                {candidate.name}
              </Text>
              <Text className="block text-[22rpx] mt-[4rpx] text-muted-foreground">
                {blind ? `第 ${index + 1} 位 · ` : ''}
                {candidate.phone ? maskPhone(candidate.phone) : '未登记手机号'}
                {candidate.campusId ? ` · ${campusNames[candidate.campusId] ?? ''}` : ''}
              </Text>
            </View>
            <View
              className={`w-[34rpx] h-[34rpx] rounded-full border-[3rpx] shrink-0 ${
                picked ? 'border-primary bg-primary' : 'border-border bg-card'
              }`}
            >
              {picked && <View className="w-full h-full rounded-full bg-card scale-50" />}
            </View>
          </View>
        );
      })}

      <View className="mt-[21rpx] rounded-[19rpx] bg-muted px-[23rpx] py-[19rpx]">
        <Text className="text-[22rpx] text-foreground/70 leading-[34rpx]">
          两位都要录这 {hours} 课时？请回表格里
          <Text className="font-semibold text-primary">拆成两行</Text>
          （各自填写自己的课时）再上传 —— 一行的课时数只对应一位学员，系统不会替你拆。
        </Text>
      </View>

      <Text
        className={`block text-[22rpx] mt-[19rpx] leading-[34rpx] ${pickedStudentId ? 'text-success font-semibold' : 'text-muted-foreground'}`}
      >
        {pickedStudentId
          ? `确定后这一行的 ${hours} 课时录给所选学员`
          : '不选 = 这一行不导入，其他行不受影响'}
      </Text>

      <View className="flex gap-[19rpx] mt-[28rpx]">
        <View
          className="flex-1 h-[81rpx] rounded-[23rpx] bg-muted center active:opacity-90"
          onClick={onSkip}
        >
          <Text className="text-[27rpx] font-semibold text-foreground/70">跳过这行</Text>
        </View>
        <View
          className={`flex-1 h-[81rpx] rounded-[23rpx] center ${
            pickedStudentId ? 'bg-primary active:opacity-90' : 'bg-muted'
          }`}
          onClick={pickedStudentId ? onConfirm : undefined}
        >
          <Text
            className={`text-[27rpx] font-semibold ${pickedStudentId ? 'text-white' : 'text-muted-foreground'}`}
          >
            {pickedStudentId ? '确定' : '请先选择学员'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default withRouteGuard(LegacyHoursImportPage);
