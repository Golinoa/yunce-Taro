/**
 * 收费方式。
 *
 * 与后端 `LessonRecord.feeMethod` / `MemberCard.paymentMethod` 同义。
 * 2026-10-02：原来自 `types/course-package` 导出，课包整套移除后独立成文件。
 */
export type FeeMethod = 'cash' | 'transfer' | 'wechat' | 'alipay' | 'other';
