import Taro from '@tarojs/taro';

/** chooseAvatar 失败时给出可操作的提示（含隐私指引未配置场景） */
export function handleChooseAvatarError(event: { detail?: { errMsg?: string } }): void {
  const msg = event.detail?.errMsg || '';
  if (/privacy|scope is not declared|未声明|未授权|not declared|disagree/i.test(msg)) {
    void Taro.showModal({
      title: '无法选择头像',
      content:
        '请先在微信公众平台「设置 → 用户隐私保护指引」中勾选「昵称、头像」和「照片或视频」，审核生效后再试。若已配置，请完全关闭小程序后重新打开。',
      showCancel: false,
      confirmText: '知道了',
    });
    return;
  }
  if (/cancel|取消/i.test(msg)) {
    return;
  }
  Taro.showToast({ title: msg || '无法选择头像，请用真机重试', icon: 'none', duration: 2800 });
}
