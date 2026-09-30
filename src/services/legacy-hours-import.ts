/**
 * 老生课时批量导入（R2 / B7）
 *
 * 三个通道：
 * - 模板下载 / 文件上传预览走 `Taro.downloadFile` / `Taro.uploadFile`
 *   （二进制通道，鉴权头用 buildAuthedUrlAndHeader 注入，与 request 主通道同源）；
 * - 提交与导入记录走常规 request（post / get）。
 */
import Taro from '@tarojs/taro';
import { buildAuthedUrlAndHeader, get, post } from '@/utils/request';

export interface LegacyImportCandidate {
  studentId: string;
  name: string;
  phone?: string | null;
  campusId?: string | null;
}

export interface LegacyImportPreviewRow {
  rowNo: number;
  status: 'ok' | 'pending' | 'new' | 'error';
  reason?: string;
  name: string;
  phone?: string;
  /** new 行专用：Excel 里带的建档信息（提交时随 newStudent 落库） */
  gender?: 'MALE' | 'FEMALE';
  birthday?: string;
  subjectName: string;
  remainingCount: number;
  expiry?: string;
  studentId?: string;
  studentName?: string;
  cardTypeId?: string;
  cardTypeName?: string;
  /** true = 没填剩余课时，需要用户在界面上补一个数字 */
  needsHours?: boolean;
  /** true = 该学员该科目已有期初入账（再次上传时默认不勾） */
  alreadyImported?: boolean;
  candidates?: LegacyImportCandidate[];
}

/** 运营在后台维护的配置：提示词 + Excel 模板地址 */
export interface LegacyImportConfig {
  /** 拉取成功时一定非空（后端配置为空会返回内置默认） */
  promptText: string;
  templateUrl: string | null;
  templateFileName: string | null;
  templateVersion: string | null;
  templateUploadedAt: string | null;
  updatedAt: string | null;
}

export interface LegacyImportPreview {
  rows: LegacyImportPreviewRow[];
  summary: {
    totalRows: number;
    okRows: number;
    pendingRows: number;
    newRows: number;
    errorRows: number;
    /** 没填剩余课时、需要补数字的行数 */
    missingHoursRows?: number;
    newStudents: number;
    reusedStudents: number;
  };
  /**
   * 所选文件名与字节数 —— 设计稿 B/C 屏的文件卡要展示"是不是我选的那个文件、多大"。
   * 后端不返回这两项，只能在上传前从 `chooseMessageFile` 拿到并带回来。
   */
  fileName: string;
  /** 0 = 微信没给体积，界面显示"—" */
  fileSize: number;
}

export interface LegacyImportCommitRow {
  rowNo: number;
  studentId?: string;
  newStudent?: {
    name: string;
    gender?: 'MALE' | 'FEMALE';
    birthday?: string;
    phone?: string;
  };
  cardTypeId: string;
  remainingCount: number;
  expiry?: string;
}

export interface LegacyImportRecord {
  id: string;
  batchNo: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  status: string;
  createdAt: string;
}

const BASE = '/legacy-hours-imports';

/** 运营配置的本地缓存键：接口拉不到时用它兜底（避免阻塞导入功能本身） */
const CONFIG_CACHE_KEY = 'legacy-import-config-cache';

interface ApiEnvelope<T> {
  code: number;
  data?: T;
  message?: string;
}

/**
 * 当前进行中的上传任务。设计稿 B 屏在导航栏左侧有「取消」，
 * 中止的就是这个上传任务（`Taro.uploadFile` 的返回值本身就是
 * `Promise<SuccessCallbackResult> & UploadTask`，既能 await 也能 abort）。
 */
let currentUploadTask: ReturnType<typeof Taro.uploadFile> | null = null;

/**
 * 选择/上传文件阶段的失败 —— 顺带把**这次选的是哪个文件**带出来。
 *
 * 设计稿 D 屏要展示「老生课时-旧版.xls」这张文件卡（红色文件图标 + 文件名 + 体积），
 * 而"格式不对"这类失败发生在拿到预览结果**之前**，靠 `LegacyImportPreview.fileName`
 * 是拿不到的（那条路只在成功时才有）。所以让它挂在错误上一起抛出去。
 */
export class LegacyImportFileError extends Error {
  readonly fileName: string;
  readonly fileSize: number;

  constructor(message: string, fileName: string, fileSize: number) {
    super(message);
    this.name = 'LegacyImportFileError';
    this.fileName = fileName;
    this.fileSize = fileSize;
  }
}

export const legacyHoursImportService = {
  /**
   * 下载模板并用系统组件打开（可转发保存）。
   *
   * ⚠️ 这里特意把「下载」和「打开」**分开报错**，并把微信的原始 errMsg 透出来：
   * 原实现两者写在同一个 try 里、失败只回一句"请重试"，真机上遇到
   * 域名不在 downloadFile 白名单、或 openDocument 打不开，都只会看到"下载失败"，无从排查。
   *
   * 模板地址优先用运营上传的那份（七牛直链），没有则回退到后端代码生成。
   */
  downloadTemplate: async (): Promise<void> => {
    const config = await legacyHoursImportService.getConfig();
    const authed = config?.templateUrl
      ? { header: {}, url: config.templateUrl }
      : await buildAuthedUrlAndHeader(`${BASE}/template`);

    let downloaded: { statusCode: number; tempFilePath: string };
    try {
      downloaded = await Taro.downloadFile({ url: authed.url, header: authed.header });
    } catch (error) {
      // 微信原始错误（域名白名单 / 网络 / 证书等）—— 必须让用户和排查者看到
      throw new Error(`模板下载失败：${error instanceof Error ? error.message : String(error)}`);
    }
    if (downloaded.statusCode !== 200) {
      throw new Error(`模板下载失败（HTTP ${downloaded.statusCode}）`);
    }
    try {
      await Taro.openDocument({
        filePath: downloaded.tempFilePath,
        fileType: 'xlsx',
        showMenu: true,
      });
    } catch (error) {
      throw new Error(
        `模板已下载但打不开：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  /**
   * 运营在后台维护的配置（提示词 + 模板地址）。
   * 进页面时静默拉一次，成功后缓存；失败则用缓存兜底（不阻塞导入功能本身）。
   */
  getConfig: async (): Promise<LegacyImportConfig | null> => {
    try {
      const data = await get<LegacyImportConfig>(`${BASE}/config`);
      if (data) {
        void Taro.setStorage({ data, key: CONFIG_CACHE_KEY }).catch(() => undefined);
        return data;
      }
    } catch {
      /* 拉不到就用缓存 */
    }
    try {
      const cached = await Taro.getStorage<LegacyImportConfig>({ key: CONFIG_CACHE_KEY });
      return cached?.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * 从聊天文件选择 Excel 并上传预览。
   *
   * @param onProgress 上传进度回调（0~100），驱动 B 屏那根进度条。
   *   注意这是**上传**进度，不是服务端解析进度；上传满 100% 后仍要等后端解析返回。
   */
  chooseAndPreview: async (options?: {
    onProgress?: (percent: number) => void;
  }): Promise<LegacyImportPreview> => {
    const chosen = (await Taro.chooseMessageFile({ count: 1, type: 'file' })) as {
      tempFiles?: { path: string; name?: string; size?: number }[];
    };
    const file = chosen.tempFiles?.[0];
    if (!file) throw new Error('未选择文件');
    const fileName = file.name || '未命名.xlsx';
    const fileSize = typeof file.size === 'number' ? file.size : 0;
    try {
      return await (async () => {
        if (!/\.(xlsx)$/i.test(file.name || file.path)) {
          throw new Error('请选择 .xlsx 格式的 Excel 文件');
        }
        const authed = await buildAuthedUrlAndHeader(`${BASE}/preview`);
        // 返回值同时是 Promise 与 UploadTask：既能 await 拿结果，也能 onProgressUpdate/abort
        const task = Taro.uploadFile({
          url: authed.url,
          filePath: file.path,
          name: 'file',
          header: authed.header,
        });
        currentUploadTask = task;
        if (options?.onProgress) {
          task.onProgressUpdate((res) => options.onProgress?.(res.progress));
        }
        let uploaded: { statusCode: number; data: string };
        try {
          uploaded = await task;
        } finally {
          currentUploadTask = null;
        }
        if (uploaded.statusCode < 200 || uploaded.statusCode >= 300) {
          throw new Error('预览失败，请重试');
        }
        const payload = JSON.parse(uploaded.data) as ApiEnvelope<LegacyImportPreview>;
        if (payload.code !== 200 || !payload.data) {
          throw new Error(payload.message || '预览失败');
        }
        return {
          ...payload.data,
          // 这两个字段后端不返回，由选择文件时拿到（界面文件卡要展示）
          fileName,
          fileSize,
        };
      })();
    } catch (error) {
      // 把"选的是哪个文件"挂到错误上：D 屏（识别失败）要用它渲染文件卡
      if (error instanceof LegacyImportFileError) throw error;
      throw new LegacyImportFileError(
        error instanceof Error ? error.message : String(error),
        fileName,
        fileSize,
      );
    }
  },

  /**
   * 中止进行中的上传（设计稿 B 屏左侧「取消」）。
   * 没有进行中的任务时静默返回。
   */
  cancelUpload: (): void => {
    try {
      currentUploadTask?.abort();
    } catch {
      /* 任务已结束等情况，忽略 */
    }
    currentUploadTask = null;
  },

  /** 提交导入（只提交可导入的行；待消歧未选/错误行由页面硬门禁拦截） */
  commit: (payload: { batchNo: string; rows: LegacyImportCommitRow[] }) =>
    post<{ batchNo: string; successRows: number }>(BASE, payload),

  /** 导入记录 */
  listRecords: () => get<{ list: LegacyImportRecord[] }>(BASE),
};
