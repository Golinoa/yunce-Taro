import { describe, expect, it } from 'vitest';
import { describeImportFailure } from '@/services/legacy-hours-import';

/**
 * 回归：D 屏横幅标题原来**写死**「这个格式导入不了」，
 * 结果「表格里没填一行数据」也被说成格式问题 ⇒ 用户去反复调格式、白折腾。
 */
describe('describeImportFailure（D 屏横幅标题）', () => {
  it('表格没填数据 ⇒ 说"还没有学员数据"，不说格式', () => {
    expect(
      describeImportFailure(
        '表格里还没有填写学员数据。请在「学员姓名」表头下面逐行填写后再上传（模板自带的「示例：…」那行不算数据）',
      ),
    ).toBe('表格里还没有学员数据');
  });

  it('老文案「表格中没有可导入的数据行」同样归类', () => {
    expect(describeImportFailure('表格中没有可导入的数据行')).toBe('表格里还没有学员数据');
  });

  it('没认出表头行 ⇒ 单独一句', () => {
    expect(
      describeImportFailure('未找到表头行（第一列应为「学员姓名」），请使用下载的模板填写'),
    ).toBe('没找到表头那一行');
  });

  it('超行数上限 ⇒ 单独一句', () => {
    expect(describeImportFailure('单批最多 500 行，请分批导入')).toBe('一次最多导入 500 行');
  });

  it('真·格式问题才归到"这个格式导入不了"', () => {
    expect(describeImportFailure('请选择 .xlsx 格式的 Excel 文件')).toBe('这个格式导入不了');
    expect(
      describeImportFailure('这个文件读不出来，请确认是 .xlsx 格式（旧版 .xls 需先另存为 .xlsx）'),
    ).toBe('这个格式导入不了');
    expect(describeImportFailure('模板列结构不对，已拒绝上传：第 8 列应该是「缴费金额」')).toBe(
      '这个格式导入不了',
    );
  });

  it('说不出原因时也不硬扯格式', () => {
    expect(describeImportFailure('')).toBe('这份表没读成功');
    expect(describeImportFailure(null)).toBe('这份表没读成功');
    expect(describeImportFailure('预览失败，请重试')).toBe('这份表没读成功');
  });
});
