/**
 * 品牌配置 �?单一数据�? *
 * 所有页�?组件引用品牌名称、Logo 路径时统一从此处导入，
 * 禁止在业务代码中硬编码品牌字样�? */

/** 中文品牌�?*/
export const BRAND_NAME_ZH = '松果排课';

/** 英文品牌�?*/
export const BRAND_NAME_EN = 'SONGGUO';

/**
 * 静态图片资源根路径（主�?assets，Tab �?首页封面需首屏可预览）�? * 编译产物：dist/assets/images/
 */
export const MEDIA_IMAGE_BASE = '/assets/images';

/** 机构 Logo 资源路径 */
export const BRAND_LOGO = `${MEDIA_IMAGE_BASE}/sgpk.png`;

/** 机构封面默认图（压缩 WebP，控制主包体�?�?.5MB�?*/
export const ORG_COVER_IMAGE = `${MEDIA_IMAGE_BASE}/cover-home.webp`;

/** 品牌名称本地回退值（orgName 为空时使用） */
export const BRAND_FALLBACK_ORG_NAME = BRAND_NAME_ZH;
