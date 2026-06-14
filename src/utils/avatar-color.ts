/**
 * 头像渐变色分配工具
 * 按学生序号循环使用 5 组渐变
 */
import { classColors } from '@/theme';

const AVATAR_GRADIENTS = [
  classColors.primary.gradient,
  classColors.amber.gradient,
  classColors.accent.gradient,
  classColors.purple.gradient,
  classColors.info.gradient,
];

/** 根据索引获取头像渐变色 */
export function getAvatarGradient(index: number): string {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

/** 根据名字 hash 获取头像渐变色（稳定） */
export function getAvatarGradientByName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}
