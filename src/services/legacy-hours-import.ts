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
  candidates?: LegacyImportCandidate[];
}

export interface LegacyImportPreview {
  rows: LegacyImportPreviewRow[];
  summary: {
    totalRows: number;
    okRows: number;
    pendingRows: number;
    newRows: number;
    errorRows: number;
    newStudents: number;
    reusedStudents: number;
  };
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

interface ApiEnvelope<T> {
  code: number;
  data?: T;
  message?: string;
}

export const legacyHoursImportService = {
  /** 下载模板并用系统组件打开（可转发保存） */
  downloadTemplate: async (): Promise<void> => {
    const authed = await buildAuthedUrlAndHeader(`${BASE}/template`);
    const downloaded = await Taro.downloadFile({ url: authed.url, header: authed.header });
    if (downloaded.statusCode !== 200) throw new Error('模板下载失败，请重试');
    await Taro.openDocument({
      filePath: downloaded.tempFilePath,
      fileType: 'xlsx',
      showMenu: true,
    });
  },

  /** 从聊天文件选择 Excel 并上传预览 */
  chooseAndPreview: async (): Promise<LegacyImportPreview> => {
    const chosen = (await Taro.chooseMessageFile({ count: 1, type: 'file' })) as {
      tempFiles?: { path: string; name?: string }[];
    };
    const file = chosen.tempFiles?.[0];
    if (!file) throw new Error('未选择文件');
    if (!/\.(xlsx)$/i.test(file.name || file.path)) {
      throw new Error('请选择 .xlsx 格式的 Excel 文件');
    }
    const authed = await buildAuthedUrlAndHeader(`${BASE}/preview`);
    const uploaded = await Taro.uploadFile({
      url: authed.url,
      filePath: file.path,
      name: 'file',
      header: authed.header,
    });
    if (uploaded.statusCode < 200 || uploaded.statusCode >= 300) {
      throw new Error('预览失败，请重试');
    }
    const payload = JSON.parse(uploaded.data) as ApiEnvelope<LegacyImportPreview>;
    if (payload.code !== 200 || !payload.data) {
      throw new Error(payload.message || '预览失败');
    }
    return payload.data;
  },

  /** 提交导入（只提交可导入的行；待消歧未选/错误行由页面硬门禁拦截） */
  commit: (payload: { batchNo: string; rows: LegacyImportCommitRow[] }) =>
    post<{ batchNo: string; successRows: number }>(BASE, payload),

  /** 导入记录 */
  listRecords: () => get<{ list: LegacyImportRecord[] }>(BASE),
};
