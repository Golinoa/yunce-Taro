/**
 * 课表分类名解析（真链路：无本地 mock 班级表时返回 undefined，由调用方按 mode 回退）
 */
export function resolveCategoryLabelByClassIdImpl(_classId: string): string | undefined {
  return undefined;
}

export function resolveCategoryLabelByCategoryIdImpl(_categoryId: string): string | undefined {
  return undefined;
}
