import { describe, expect, it } from 'vitest';
import { courseTemplateService } from '@/services/course-template';

describe('courseTemplateService', () => {
  it('fails explicitly while no backend contract exists', async () => {
    await expect(courseTemplateService.getList()).rejects.toThrow(
      'course-template 后端尚未提供课程模板列表接口',
    );
    await expect(courseTemplateService.getById('template-1')).rejects.toThrow(
      'course-template 后端尚未提供课程模板详情接口',
    );
  });
});
