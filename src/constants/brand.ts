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

/**
 * 首页顶部三张大瓷片的 3D 图基址。**当前指向主包本地** `src/assets/images`。
 *
 * 为什么最终放回本地：
 * - 原 `icon-*.webp`（带 alpha 的 VP8X）**小程序真机不渲染**（开发者工具能显示、真机空白）→ 必须换 PNG；
 * - 全量 PNG（10 张 219KB）装不下主包，但**只保留大瓷片用到的 3 张、量化压缩到 144px 128 色后仅 11.8KB**
 *   → 主包余量足够（清掉 10 张 webp 后余量约 83KB），且**零网络请求、真机必显示**。
 *
 * 若日后想改走 CDN：把这里改成 `'https://res.chancore.cn/platform/static/home-icons'`
 * 即可（key 与文件名同名），无需改业务代码；留空则自动回退 mdi 渐变图标。
 */
export const HOME_TILE_IMAGE_BASE = MEDIA_IMAGE_BASE;

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
