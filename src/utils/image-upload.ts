/**
 * 图片上传工具
 *
 * 小程序端选择图片后返回临时路径，点击保存时再由业务层调用 uploadImage
 * 将临时文件读取为 base64 Data URL（mock 模式）或上传至真实服务器。
 */
import Taro from '@tarojs/taro';

export interface ChooseImageOptions {
  /** 最大文件大小（MB），默认 2 */
  maxSizeMB?: number;
  /** 图片来源 */
  sourceType?: ('album' | 'camera')[];
}

/**
 * 判断是否为需要上传的临时文件路径
 */
export function isTempImagePath(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('wxfile://') || url.startsWith('http://tmp/') || url.startsWith('file://');
}

/**
 * 选择单张图片，返回微信临时文件路径
 */
export async function chooseImageTemp(options: ChooseImageOptions = {}): Promise<string> {
  const { maxSizeMB = 2, sourceType = ['album', 'camera'] } = options;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const res = await Taro.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sizeType: ['compressed'],
    sourceType,
  });

  const tempFile = res.tempFiles[0];
  if (!tempFile?.tempFilePath) {
    throw new Error('未选择图片');
  }

  const size = tempFile.size ?? 0;
  if (size > maxSizeBytes) {
    throw new Error(`图片大小超过 ${maxSizeMB}M 限制`);
  }

  return tempFile.tempFilePath;
}

/**
 * 将临时图片文件上传/持久化
 *
 * mock 模式下读取为 base64 Data URL；真实环境替换为 request 上传接口。
 */
export async function uploadImage(tempFilePath: string): Promise<string> {
  const fs = Taro.getFileSystemManager();
  const data = await new Promise<string>((resolve, reject) => {
    fs.readFile({
      filePath: tempFilePath,
      encoding: 'base64',
      success: (readRes) => resolve(readRes.data as string),
      fail: (err) => reject(err),
    });
  });

  return `data:image/jpeg;base64,${data}`;
}
