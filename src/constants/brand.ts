/**
 * 品牌配置 — 单一数据源
 *
 * 所有页面/组件引用品牌名称、Logo 路径时统一从此处导入，
 * 禁止在业务代码中硬编码品牌字样。
 */

/** 中文品牌名 */
export const BRAND_NAME_ZH = '松果排课';

/** 英文品牌名 */
export const BRAND_NAME_EN = 'SONGGUO';

/** 英文品牌名第二行（排版用水印） */
export const BRAND_NAME_EN_SECONDARY = 'PAIKE';

/** 英文副标（首页头部等） */
export const BRAND_NAME_EN_SUB = 'Pinecone Scheduling';

/**
 * 静态图片资源根路径（主包 assets，Tab 页/首页封面需首屏可预览）。
 * 编译产物：dist/assets/images/
 */
export const MEDIA_IMAGE_BASE = '/assets/images';

/** 机构 Logo 资源路径（主包 assets，多处首屏复用） */
export const BRAND_LOGO = `${MEDIA_IMAGE_BASE}/sgpk.png`;

/**
 * B12 主包瘦身：`cover-home.webp` 不再进主包。
 *
 * 该图仅被 package-auth / package-lead 两个分包页面使用，已下沉到各自分包
 * assets 目录（`/package-auth/assets/cover-home.webp`、`/package-lead/assets/cover-home.webp`），
 * 由使用方在页面内声明常量，不再从主包 `MEDIA_IMAGE_BASE` 导出。
 */

/** 品牌名称本地回退值（orgName 为空时使用） */
export const BRAND_FALLBACK_ORG_NAME = BRAND_NAME_ZH;

/** 首页头部等品牌宣传短口号 */
export const BRAND_SLOGAN = '轻松排课 · 安心运营';
