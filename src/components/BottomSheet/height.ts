/**
 * BottomSheet 高度语义解析（纯函数，便于单测）
 *
 * 三种模式（2026-09-25 修正「未指定高度 → 固定 70vh → 内容短时下方大片空白」）：
 *
 * 1. **fixed**：传了 `height`（非 `'auto'`）或 `heightRatio` → 面板高度锁死，内容区同高。
 * 2. **auto-free**：显式 `height="auto"` 且未给上限 → 面板贴合内容，不设上限，内容区不滚动。
 * 3. **auto-capped**：未指定高度（或只给了废弃字段 `maxHeight`）→ 面板贴合内容，
 *    超过上限才收住；内容区用 `max-height`（而非固定高度）以便短内容贴合、长内容仍可滚动。
 *
 * 注意：`maxHeight` 是**废弃字段**，历史实现把它当「固定高度」用；现按字段名本身的语义
 * 当作**上限**处理，故 `maxHeight="70vh"` 的调用方会自动获得「贴合内容 + 70vh 上限」。
 */

/** 内容区相对面板高度预留的量，用于给标题栏让位 */
export const SCROLL_AREA_OFFSET = '120rpx';

export interface SheetHeightInput {
  /** 显式面板高度；`'auto'` 表示贴合内容 */
  height?: string;
  /** @deprecated 按「上限」语义兼容 */
  maxHeight?: string;
  /** 面板上限高度 */
  maxHeightLimit?: string;
  /** 已由 windowHeight 换算成 px 的比例高度（heightRatio 模式） */
  ratioHeightPx?: string;
  /**
   * 是否传了 `heightRatio`。
   * 必须单独传：`ratioHeightPx` 在 `shouldRender` 为 false（如关闭动画期间）时算不出来，
   * 但此时仍应判定为「固定高度」模式，否则面板会在滑出动画中途跳到内容高度。
   */
  hasHeightRatio?: boolean;
}

export interface SheetHeightResult {
  /** 面板自身的内联样式 */
  panelStyle?: { height?: string; maxHeight?: string };
  /** 内容区（ScrollView）的内联样式；为 undefined 表示不应使用 ScrollView */
  scrollAreaStyle?: { height?: string; maxHeight?: string };
}

/** 默认上限：长度与历史固定高度一致，避免长内容盖满全屏 */
export const DEFAULT_SHEET_MAX_HEIGHT = '70vh';

export function resolveSheetHeight(input: SheetHeightInput): SheetHeightResult {
  const { height, maxHeight, maxHeightLimit, ratioHeightPx, hasHeightRatio } = input;

  const hasFixedHeight =
    Boolean(hasHeightRatio) || (typeof height === 'string' && height !== 'auto');
  const isExplicitAuto = height === 'auto';
  const unspecifiedCap = maxHeightLimit || maxHeight || DEFAULT_SHEET_MAX_HEIGHT;

  if (hasFixedHeight) {
    // 固定高度：与历史行为完全一致（ratioHeightPx 失效时回落到 height/maxHeight/70vh）
    const fixed = ratioHeightPx || height || maxHeight || DEFAULT_SHEET_MAX_HEIGHT;
    const scroll = `calc(${fixed} - ${SCROLL_AREA_OFFSET})`;
    return {
      panelStyle: { height: fixed, maxHeight: fixed },
      scrollAreaStyle: { height: scroll, maxHeight: scroll },
    };
  }

  if (isExplicitAuto) {
    // 显式 auto：贴合内容；只有显式给了 maxHeightLimit 才加上限，内容区不滚动
    return {
      panelStyle: maxHeightLimit ? { maxHeight: maxHeightLimit } : undefined,
      scrollAreaStyle: undefined,
    };
  }

  // 未指定高度：贴合内容 + 上限兜底，内容区用 max-height 保持可滚动
  return {
    panelStyle: { maxHeight: unspecifiedCap },
    scrollAreaStyle: { maxHeight: `calc(${unspecifiedCap} - ${SCROLL_AREA_OFFSET})` },
  };
}
