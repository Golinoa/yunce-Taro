/**
 * 微信 ScrollView 滚动定位 props（安全传参）
 *
 * ## 铁律（反复踩坑）
 * 微信 `scroll-into-view` **只要还绑在节点上**（包括空字符串 `""`），
 * 页面任意 `setData` / React setState 都可能把列表打回顶部。
 * 因此：仅在真正需要滚到锚点时才传入；idle 时必须完全解绑（返回空对象）。
 *
 * 固定蒙层弹窗（详情/添加待办）禁止改 `scrollTop` / `scrollY` 来“保位置”，
 * 否则关层时的写回/解绑本身就会驱动滚动条。
 */
export function scrollIntoViewProps(targetId: string): {
  scrollIntoView?: string;
  scrollWithAnimation?: boolean;
} {
  const id = targetId.trim();
  if (!id) return {};
  return {
    scrollIntoView: id,
    scrollWithAnimation: true,
  };
}
