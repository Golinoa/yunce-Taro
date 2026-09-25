import { describe, expect, it } from 'vitest';
import { DEFAULT_SHEET_MAX_HEIGHT, resolveSheetHeight } from './height';

/**
 * 回归护栏：历史上「未指定高度」落到固定 70vh，内容短的弹框（如学员操作弹框）
 * 下方会留一大片空白。这里锁定三种高度模式的语义，避免再次退化。
 */
describe('resolveSheetHeight（BottomSheet 高度语义）', () => {
  describe('未指定高度 → 贴合内容 + 70vh 上限（本次修复点）', () => {
    it('面板只设 maxHeight，不再固定高度', () => {
      const r = resolveSheetHeight({});
      expect(r.panelStyle).toEqual({ maxHeight: DEFAULT_SHEET_MAX_HEIGHT });
      expect(r.panelStyle).not.toHaveProperty('height');
    });

    it('内容区用 max-height 而非固定 height，长内容仍可滚动', () => {
      const r = resolveSheetHeight({});
      expect(r.scrollAreaStyle).toEqual({
        maxHeight: `calc(${DEFAULT_SHEET_MAX_HEIGHT} - 120rpx)`,
      });
      expect(r.scrollAreaStyle).not.toHaveProperty('height');
    });
  });

  describe('显式固定高度 → 与历史行为一致', () => {
    it("height='70vh' 时面板与内容区都是固定高度", () => {
      const r = resolveSheetHeight({ height: '70vh' });
      expect(r.panelStyle).toEqual({ height: '70vh', maxHeight: '70vh' });
      expect(r.scrollAreaStyle).toEqual({
        height: 'calc(70vh - 120rpx)',
        maxHeight: 'calc(70vh - 120rpx)',
      });
    });

    it('heightRatio 模式优先使用换算后的 px，并始终按固定高度处理', () => {
      const r = resolveSheetHeight({ hasHeightRatio: true, ratioHeightPx: '600px' });
      expect(r.panelStyle).toEqual({ height: '600px', maxHeight: '600px' });
    });

    it('heightRatio 已传但 px 尚未算出（关闭动画期间）时回落默认高度，避免面板高度跳变', () => {
      const r = resolveSheetHeight({ hasHeightRatio: true });
      expect(r.panelStyle).toEqual({
        height: DEFAULT_SHEET_MAX_HEIGHT,
        maxHeight: DEFAULT_SHEET_MAX_HEIGHT,
      });
    });
  });

  describe("显式 height='auto' → 保持原有语义", () => {
    it('无上限时不设任何内联高度，且不使用 ScrollView', () => {
      const r = resolveSheetHeight({ height: 'auto' });
      expect(r.panelStyle).toBeUndefined();
      expect(r.scrollAreaStyle).toBeUndefined();
    });

    it('配合 maxHeightLimit 时只加上限', () => {
      const r = resolveSheetHeight({ height: 'auto', maxHeightLimit: '80vh' });
      expect(r.panelStyle).toEqual({ maxHeight: '80vh' });
      expect(r.scrollAreaStyle).toBeUndefined();
    });
  });

  describe('废弃字段 maxHeight → 按「上限」而非「固定高度」理解', () => {
    it('maxHeight 只作为上限，面板贴合内容', () => {
      const r = resolveSheetHeight({ maxHeight: '72vh' });
      expect(r.panelStyle).toEqual({ maxHeight: '72vh' });
      expect(r.panelStyle).not.toHaveProperty('height');
    });

    it('maxHeightLimit 优先于废弃的 maxHeight', () => {
      const r = resolveSheetHeight({ maxHeight: '72vh', maxHeightLimit: '80vh' });
      expect(r.panelStyle).toEqual({ maxHeight: '80vh' });
    });
  });

  it('固定高度优先于 maxHeightLimit（显式 height 不被上限改写）', () => {
    const r = resolveSheetHeight({ height: '46vh', maxHeightLimit: '80vh' });
    expect(r.panelStyle).toEqual({ height: '46vh', maxHeight: '46vh' });
  });
});
