import { describe, expect, it } from 'vitest';
import { safeLocalFileName } from '@/services/legacy-hours-import';

describe('safeLocalFileName（下载模板时用户看到的那个名字）', () => {
  it('正常中文文件名原样保留', () => {
    expect(safeLocalFileName('老生课时导入模板.xlsx')).toBe('老生课时导入模板.xlsx');
  });

  it('路径分隔符被剔除（否则 saveFile 会写到别的目录）', () => {
    expect(safeLocalFileName('../../etc/模板.xlsx')).toBe('etc模板.xlsx');
    expect(safeLocalFileName('a/b\\c.xlsx')).toBe('abc.xlsx');
  });

  it('控制字符被剔除（否则 saveFile 直接失败）', () => {
    expect(safeLocalFileName('模板\u0000\u001f.xlsx')).toBe('模板.xlsx');
  });

  it('没有文件名时用内置默认名', () => {
    expect(safeLocalFileName(null)).toBe('老生课时导入模板.xlsx');
    expect(safeLocalFileName('   ')).toBe('老生课时导入模板.xlsx');
  });

  it('没有扩展名时补 .xlsx', () => {
    expect(safeLocalFileName('钢琴模板')).toBe('钢琴模板.xlsx');
  });
});
