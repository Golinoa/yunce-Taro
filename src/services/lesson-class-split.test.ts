import { describe, expect, it } from 'vitest';

// 轻量：确认模块可加载且导出存在（避免拉全网请求）
describe('lesson-record / class service modules (Q2-4)', () => {
  it('export lessonRecordService API surface', async () => {
    const mod = await import('./lesson-record');
    expect(typeof mod.lessonRecordService.create).toBe('function');
    expect(typeof mod.lessonRecordService.getByStudent).toBe('function');
    expect(typeof mod.lessonRecordService.revoke).toBe('function');
  });

  it('export classService API surface', async () => {
    const mod = await import('./class');
    expect(typeof mod.classService.getByTeacher).toBe('function');
    expect(typeof mod.classService.getStudents).toBe('function');
    expect(typeof mod.classService.pause).toBe('function');
  });

  it('export scheduleService API surface', async () => {
    const mod = await import('./schedule');
    expect(typeof mod.scheduleService.getByTeacher).toBe('function');
    expect(typeof mod.scheduleService.checkConflict).toBe('function');
    expect(typeof mod.scheduleService.create).toBe('function');
  });
});
