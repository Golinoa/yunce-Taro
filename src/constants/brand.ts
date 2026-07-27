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

/** 品牌 Logo 资源路径 */
export const BRAND_LOGO = '/assets/images/sgpk.png';

/** 品牌名称本地回退值（orgName 为空时使用） */
export const BRAND_FALLBACK_ORG_NAME = BRAND_NAME_ZH;
