import Taro from '@tarojs/taro';

/**
 * 会话身份本地持久化（2026-09-25）
 *
 * 产品口径：教师端与家长端不混合使用；一人兼两身份时选择身份进入不同的端；
 * 多身份默认优先进入教师端；下次进入小程序默认进入上次缓存的身份。
 *
 * 存储范围刻意只放本地（与 `yunce_last_visited_campus_id` 同一模式）：
 * - 身份是「这台设备上一次用哪个端」的偏好，不是账号级事实；
 * - 换设备/重装小程序时回退到默认教师端，语义可接受。
 *
 * ⚠️ 由此产生的已知代价：冷启动时后端按默认规则（教师端优先）签发，若本地缓存
 * 的身份是家长端，前端需再切一次，会短暂先呈现教师端。该行为已与产品确认。
 */

const IDENTITY_STORAGE_KEY = 'yunce_session_identity';

/** 端身份：staff=教师端 / parent=家长端 */
export type SessionIdentityType = 'staff' | 'parent';

/** 读取上次使用的端；无缓存或值非法时返回 null（走默认教师端） */
export function readStoredIdentity(): SessionIdentityType | null {
  try {
    const raw = Taro.getStorageSync(IDENTITY_STORAGE_KEY);
    return raw === 'staff' || raw === 'parent' ? raw : null;
  } catch {
    return null;
  }
}

/** 记住本次选择的端 */
export function writeStoredIdentity(identity: SessionIdentityType): void {
  try {
    Taro.setStorageSync(IDENTITY_STORAGE_KEY, identity);
  } catch {
    // 持久化失败不影响本次切换，仅下次进入回退到默认教师端
  }
}
