/**
 * 图片上传工具
 *
 * 设计要点：
 * - 选择/裁剪图片后，把微信临时文件**持久化到本地**（USER_DATA_PATH/uploads），
 *   返回稳定的本地文件路径，同时用于：
 *     1) 预览（<Image src> 直接显示本地文件，不会因临时文件回收而“闪一下消失”）；
 *     2) 保存时作为 Taro.uploadFile 的 filePath 直接上传。
 * - 关键：Taro.uploadFile 只接受真实文件路径、不接受 base64 Data URL，
 *   因此这里不再走 base64（base64 无法被 uploadFile 上传到七牛）。
 * - 安卓兼容：部分机型 wx.cropImage 返回系统绝对路径（/storage/emulated/0/...），
 *   fs 与渲染层均无法访问（微信多年未彻底修复的平台 bug）。裁剪完成后会校验产物
 *   路径可加载性，不可用时先经离屏 canvas 转存（保住裁剪效果），仍不行则回退原图，
 *   保证预览永远不为空白（详见 chooseImageTemp 内注释）。
 * - 保存时由业务层（course-form / teacher / campus 等）调用 uploadImage，
 *   内部委托 uploadService.upload 上传到七牛（后端代理）并返回可访问 URL。
 */
import Taro from '@tarojs/taro';
import { uploadService } from '@/services/upload';

export interface ChooseImageOptions {
  /** 最大文件大小（MB），默认 5 */
  maxSizeMB?: number;
  /** 图片来源 */
  sourceType?: ('album' | 'camera')[];
  /** 是否进入微信原生裁剪；传入裁剪比例如 '16:9'、'1:1'、'4:3' 等 */
  cropScale?: keyof Taro.cropImage.CropScale;
}

/** 用户主动取消选择图片时的错误标识 */
export class ImageCancelError extends Error {
  constructor() {
    super('用户取消选择');
    this.name = 'ImageCancelError';
  }
}

/** 判断错误是否为用户取消 */
export function isImageCancelError(err: unknown): err is ImageCancelError {
  return (
    err instanceof ImageCancelError || (err instanceof Error && err.name === 'ImageCancelError')
  );
}

/**
 * 判断是否为需要上传的本地文件路径（微信临时文件或本地持久化文件）。
 * 远程 URL（http/https）与 base64（data:）已经可直接使用，不算。
 */
export function isTempImagePath(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('wxfile://') || url.startsWith('http://tmp/') || url.startsWith('file://');
}

/**
 * 获取微信原生 cropImage。
 *
 * 注意：
 * - Taro 未封装 wx.cropImage，运行时不存在 Taro.cropImage，必须直接走小程序全局 wx。
 * - wx.cropImage 是回调式 API（官方文档明确「不支持 Promise 风格调用」），
 *   这里手动 Promisify，并做能力探测；不可用则返回 undefined。
 */
function getWxCropImage():
  | ((option: { src: string; cropScale: string }) => Promise<{ tempFilePath: string }>)
  | undefined {
  const wxObj = (globalThis as { wx?: Record<string, unknown> }).wx;
  if (!wxObj || typeof wxObj.cropImage !== 'function') {
    return undefined;
  }

  return (option: { src: string; cropScale: string }) =>
    new Promise<{ tempFilePath: string }>((resolve, reject) => {
      (wxObj.cropImage as (opt: Record<string, unknown>) => void)({
        ...option,
        success: (res: { tempFilePath: string }) => resolve(res),
        fail: (err: { errMsg?: string }) => reject(err),
      });
    });
}

/** 解析裁剪比例字符串 '16:9' / '1:1' 为长边/短边比值 */
function parseCropRatio(cropScale: string): number {
  const parts = cropScale.split(':').map(Number);
  const [a, b] = parts.length >= 2 ? parts : [1, 1];
  if (!a || !b || a <= 0 || b <= 0) return 1;
  return Math.max(a, b) / Math.min(a, b);
}

/**
 * 综合判断是否需要进入裁剪：
 * - 图片分辨率过大（长边超过阈值），或
 * - 源图宽高比与目标裁剪比例差异明显。
 * 读取失败则视为不需要裁剪，避免阻断上传。
 */
async function shouldCropImage(path: string, cropScale: string): Promise<boolean> {
  try {
    const info = await Taro.getImageInfo({ src: path });
    const maxSide = Math.max(info.width, info.height);
    const sourceRatio = Math.max(info.width, info.height) / Math.min(info.width, info.height);
    const targetRatio = parseCropRatio(cropScale);
    const ratioDiff = Math.abs(sourceRatio - targetRatio);
    return maxSide > LARGE_IMAGE_MAX_SIDE || ratioDiff > CROP_RATIO_DIFF_THRESHOLD;
  } catch {
    return false;
  }
}

/** 最长边超过该值（px）视为「大图」 */
const LARGE_IMAGE_MAX_SIDE = 1600;

/** 源图与目标裁剪比例差异超过该值时，即使分辨率不大也进入裁剪 */
const CROP_RATIO_DIFF_THRESHOLD = 0.2;

/**
 * 判断路径能否被渲染层加载（getImageInfo 与 <image> 组件走同一图片加载通道）。
 *
 * 用途：校验 wx.cropImage 的产物。部分安卓机型 cropImage 返回系统绝对路径
 * （/storage/emulated/0/...），该路径 fs 与渲染层均无法访问，若不校验直接采用，
 * 预览会变空白框、保存时上传也会失败。
 */
function isLoadableImagePath(path: string): Promise<boolean> {
  return Taro.getImageInfo({ src: path })
    .then(() => true)
    .catch(() => false);
}

/** 微信沙箱内的合法路径前缀（临时文件 / USER_DATA_PATH / 开发者工具临时目录） */
const SANDBOX_PATH_PREFIXES = ['wxfile://', 'http://tmp/', 'file://'];

/** 判断是否为微信沙箱内路径（排除安卓 cropImage 返回的 /storage/... 系统绝对路径） */
function isSandboxPath(path: string): boolean {
  return SANDBOX_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** 离屏 canvas 图片对象（微信 OffscreenCanvas.createImage 产物，按需最小类型面） */
interface CanvasImageLike {
  src: string;
  width: number;
  height: number;
  onload: (() => void) | null;
  onerror: ((err: unknown) => void) | null;
}

/** 离屏 canvas 2D 上下文（按需最小类型面） */
interface Canvas2DContextLike {
  drawImage(img: CanvasImageLike, x: number, y: number, width: number, height: number): void;
}

/** 微信离屏 canvas（按需最小类型面） */
interface OffscreenCanvasLike {
  width: number;
  height: number;
  createImage(): CanvasImageLike;
  getContext(type: '2d'): Canvas2DContextLike;
  toDataURL(type?: string, quality?: number): string;
}

/**
 * 离屏 canvas 兜底转存：把「文件系统读不到但渲染层图片加载器可能读得到」的图片
 * 搬运为 USER_DATA_PATH 下的本地文件。
 *
 * 背景：安卓部分机型 wx.cropImage 返回 /storage/... 绝对路径，fs.copyFile/readFile
 * 无法访问；但 canvas.createImage 走的是渲染层加载通道（与 previewImage 同源），
 * 有机会加载成功。加载成功后整图绘到离屏 canvas，toDataURL → base64 → writeFile
 * 落盘，得到可预览、可上传的正常路径（保留裁剪效果）。
 * 任一环节失败返回 undefined，由调用方回退原图。
 */
async function repairUnreadableCropViaCanvas(path: string): Promise<string | undefined> {
  try {
    const wxObj = (globalThis as { wx?: Record<string, unknown> }).wx;
    if (!wxObj || typeof wxObj.createOffscreenCanvas !== 'function') {
      return undefined;
    }
    const canvas = (wxObj.createOffscreenCanvas as (opt: { type: '2d' }) => OffscreenCanvasLike)({
      type: '2d',
    });
    if (typeof canvas.createImage !== 'function' || typeof canvas.toDataURL !== 'function') {
      return undefined;
    }

    const img = canvas.createImage();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err: unknown) => reject(err ?? new Error('canvas image load fail'));
      img.src = path;
    });
    if (!img.width || !img.height) return undefined;

    // 按原图尺寸重设画布再绘制，避免缩放失真
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    if (!base64) return undefined;
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';

    const fs = Taro.getFileSystemManager();
    const userDataPath = (Taro.env as { USER_DATA_PATH: string }).USER_DATA_PATH;
    const dir = await ensureUploadsDir(fs, userDataPath);
    const target = `${dir}/${buildUploadFileName(ext)}`;
    await new Promise<void>((resolve, reject) => {
      fs.writeFile({
        filePath: target,
        data: base64,
        encoding: 'base64',
        success: () => resolve(),
        fail: (err) => reject(err),
      });
    });
    return target;
  } catch (err) {
    console.warn('[image-upload] canvas 兜底转存失败', err);
    return undefined;
  }
}

/** 确保 USER_DATA_PATH/uploads 目录存在（已存在时 mkdir 失败，忽略即可），返回目录路径 */
async function ensureUploadsDir(fs: Taro.FileSystemManager, userDataPath: string): Promise<string> {
  const dir = `${userDataPath}/uploads`;
  await new Promise<void>((resolve) => {
    fs.mkdir({ dirPath: dir, success: () => resolve(), fail: () => resolve() });
  });
  return dir;
}

/** 生成 uploads 目录下的唯一文件名 */
function buildUploadFileName(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/**
 * 将微信临时文件持久化到本地 USER_DATA_PATH/uploads，返回稳定路径。
 *
 * 微信 chooseMedia / cropImage 返回的临时文件（http://tmp/、wxfile://tmp/）
 * 生命周期不可靠，页面切换或系统回收后可能失效，导致预览“闪一下消失”、
 * 保存时上传失败。这里复制到本地持久目录（wxfile://usr/uploads/...），
 * 预览稳定且可直接作为 Taro.uploadFile 的 filePath 上传。
 * 持久化失败时回退原始临时路径（会话内仍可预览/上传），不阻断选图。
 */
async function persistTempFile(tempFilePath: string): Promise<string> {
  try {
    const fs = Taro.getFileSystemManager();
    const userDataPath = (Taro.env as { USER_DATA_PATH: string }).USER_DATA_PATH;
    const dir = await ensureUploadsDir(fs, userDataPath);
    const ext = (tempFilePath.split('.').pop() || 'jpg').split('?')[0] || 'jpg';
    const target = `${dir}/${buildUploadFileName(ext)}`;
    await new Promise<void>((resolve, reject) => {
      fs.copyFile({
        srcPath: tempFilePath,
        destPath: target,
        success: () => resolve(),
        fail: (err) => reject(err),
      });
    });
    return target;
  } catch (err) {
    console.warn('[image-upload] 持久化临时文件失败，回退原始路径', err);
    return tempFilePath;
  }
}

export async function chooseImageTemp(options: ChooseImageOptions = {}): Promise<string> {
  const { maxSizeMB = 5, sourceType = ['album', 'camera'], cropScale } = options;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  let res;
  try {
    res = await Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType,
    });
  } catch (err) {
    const errMsg = (err as { errMsg?: string })?.errMsg || '';
    if (errMsg.toLowerCase().includes('cancel')) {
      throw new ImageCancelError();
    }
    throw err;
  }

  const tempFile = res.tempFiles[0];
  if (!tempFile?.tempFilePath) {
    throw new ImageCancelError();
  }

  const size = tempFile.size ?? 0;
  if (size > maxSizeBytes) {
    throw new Error(`图片大小超过 ${maxSizeMB}M 限制`);
  }

  let finalPath = tempFile.tempFilePath;
  // canvas 兜底转存的产物已直接落在 USER_DATA_PATH，无需再持久化
  let finalPathPersisted = false;
  // TEMP-DIAG: 裁剪链路诊断信息（定位「裁剪后无预览」问题，问题解决后整段移除）
  const diag: string[] = [];

  // 仅在需要裁剪时才调用 wx.cropImage；API 不可用或异常时静默回退原图
  if (cropScale) {
    const needCrop = await shouldCropImage(finalPath, cropScale);
    if (needCrop) {
      const cropFn = getWxCropImage();
      if (cropFn) {
        try {
          const cropRes = await cropFn({ src: finalPath, cropScale });
          const croppedPath = cropRes.tempFilePath;
          const sandboxOk = isSandboxPath(croppedPath);
          // 竞态防御：cropImage 的 success 回调可能先于产物文件落盘完成触发，
          // 首次校验失败时等待后重试一次，避免误判为坏路径。
          let loadable = await isLoadableImagePath(croppedPath);
          if (!loadable && sandboxOk) {
            await delay(FILE_FLUSH_RETRY_DELAY_MS);
            loadable = await isLoadableImagePath(croppedPath);
            if (loadable) {
              diag.push('首次校验失败,重试后可加载(落盘延迟)');
            }
          }
          if (sandboxOk && loadable) {
            // 正常情况（iOS / 绝大多数设备）：裁剪结果是沙箱内可加载的临时路径，直接采用
            finalPath = croppedPath;
          } else {
            // 安卓部分机型 bug：cropImage 返回系统绝对路径（/storage/emulated/0/...），
            // fs 与 <image> 渲染层都无法访问（getImageInfo 可读也不代表 <image> 能渲染，
            // 故必须同时满足沙箱前缀）。先尝试离屏 canvas 转存保住裁剪效果；
            // 不行则回退未裁剪原图，保证预览不为空白、后续上传可用。
            console.warn(
              '[image-upload] 裁剪结果路径不可用（疑似安卓 cropImage 绝对路径 bug），尝试 canvas 转存',
              croppedPath,
            );
            diag.push(`产物非沙箱/不可加载: ${croppedPath}`);
            const repaired = await repairUnreadableCropViaCanvas(croppedPath);
            diag.push(`canvas转存: ${repaired ? `成功 ${repaired}` : '失败'}`);
            if (repaired) {
              finalPath = repaired;
              finalPathPersisted = true;
            } else {
              console.warn('[image-upload] canvas 转存失败，回退未裁剪原图');
            }
          }
        } catch (err) {
          const errMsg = (err as { errMsg?: string })?.errMsg || '';
          diag.push(`crop异常: ${errMsg || String(err)}`);
          if (errMsg.toLowerCase().includes('cancel')) {
            // 用户在裁剪界面取消，与选图取消同等处理
            throw new ImageCancelError();
          }
          // 开发者工具不支持 cropImage 调试（真机正常裁剪），属预期情况，静默回退原图
          if (!errMsg.includes('开发者工具暂时不支持')) {
            // 其他裁剪异常不阻断上传，回退原图
            console.warn('[image-upload] cropImage 失败，使用原图', err);
          }
        }
      }
    }
  }

  // 关键：把临时文件持久化为稳定本地路径，既保证预览不闪，又能保存时上传七牛。
  const persisted = finalPathPersisted ? finalPath : await persistTempFile(finalPath);

  // 端到端兜底 + 竞态重试：持久化产物若无法加载（如 copyFile 在源文件尚未落盘完成时
  // 拷到 0 字节/半截文件），等待落盘后重试校验、必要时重新拷贝，绝不让预览变空白。
  if (await isLoadableImagePath(persisted)) {
    showCropDiagIfNeeded(diag);
    return persisted;
  }
  console.warn('[image-upload] 持久化产物不可加载，等待落盘后重试', persisted);
  diag.push(`持久化首次校验失败: ${persisted}`);
  await delay(FILE_FLUSH_RETRY_DELAY_MS);
  if (await isLoadableImagePath(persisted)) {
    diag.push('等待后重试可加载(落盘延迟)');
    showCropDiagIfNeeded(diag);
    return persisted;
  }
  // 持久化产物确实损坏：源文件若可加载，重新拷贝一次
  if (!finalPathPersisted && (await isLoadableImagePath(finalPath))) {
    const retryPersisted = await persistTempFile(finalPath);
    if (await isLoadableImagePath(retryPersisted)) {
      diag.push(`重新拷贝成功: ${retryPersisted}`);
      showCropDiagIfNeeded(diag);
      return retryPersisted;
    }
    diag.push(`重新拷贝仍不可加载: ${retryPersisted}`);
    showCropDiagIfNeeded(diag);
    return finalPath;
  }
  // 最后兜底：源文件可加载就用源文件，否则只能返回持久化产物
  if (await isLoadableImagePath(finalPath)) {
    showCropDiagIfNeeded(diag);
    return finalPath;
  }
  diag.push(`源路径也不可加载: ${finalPath}`);
  showCropDiagIfNeeded(diag);
  return persisted;
}

/** 裁剪产物文件落盘延迟的重试等待（ms） */
const FILE_FLUSH_RETRY_DELAY_MS = 400;

/** 简易延时 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * TEMP-DIAG: 裁剪链路诊断弹窗（仅异常路径会记录诊断信息并弹出，
 * 正常路径静默。问题定位后连同 diag 收集逻辑一并移除）。
 */
function showCropDiagIfNeeded(diag: string[]): void {
  if (diag.length === 0) return;
  console.log('[image-upload] 裁剪诊断:', diag.join(' | '));
  void Taro.showModal({
    title: '裁剪诊断(临时)',
    content: diag.join('\n'),
    showCancel: false,
    confirmText: '知道了',
  });
}

/**
 * 删除已持久化到 USER_DATA_PATH 的临时图片文件。
 *
 * 使用场景：用户删除/替换图片、或未保存退出页面时调用，避免本地存储持续累积
 * （每次 chooseImageTemp 都会在 USER_DATA_PATH/uploads 新建一个文件，UI 删除只清状态
 * 不清文件，反复上传删除会越积越多）。远程 URL / base64 不动；删除失败静默忽略
 * （不影响业务，最坏只是留下一个临时文件）。
 */
export function deleteTempImage(path?: string): void {
  if (!path || !isTempImagePath(path)) return;
  // 远程 URL / data URL 不属于本地临时文件，跳过
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return;
  }
  try {
    const fs = Taro.getFileSystemManager();
    fs.unlink({
      filePath: path,
      success: () => {},
      fail: () => {},
    });
  } catch {
    /* 静默 */
  }
}

/**
 * 上传本地图片文件，返回可访问 URL。
 *
 * - 传入远程 URL（http/https）或 base64（data:）时直接原样返回（已是线上地址，无需上传）。
 * - 传入本地文件路径（wxfile:// / http://tmp/）时委托 uploadService.upload 上传七牛，返回 URL。
 *
 * 保存图片的业务层（course-form / teacher / campus 等）统一在此处完成“本地路径 → 线上 URL”的转换。
 */
export async function uploadImage(filePath: string): Promise<string> {
  if (!filePath) return filePath;
  if (
    filePath.startsWith('http://') ||
    filePath.startsWith('https://') ||
    filePath.startsWith('data:')
  ) {
    return filePath;
  }
  const res = await uploadService.upload(filePath);
  return res.url;
}
