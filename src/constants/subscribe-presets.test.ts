import { describe, expect, it } from 'vitest';
import {
  formatPresetText,
  getFlowPresetId,
  getPromptPreset,
  getRenewPreset,
  PROMPT_PRESETS,
  RENEW_PRESETS,
  SUBSCRIBE_TEMPLATE_GROUPS,
} from './subscribe-presets';

describe('subscribe-presets', () => {
  it('T-F-03: 未知 presetId 抛出明确错误', () => {
    expect(() => getPromptPreset('unknown' as never)).toThrow(/未知订阅弹框 preset/);
    expect(() => getRenewPreset('unknown' as never)).toThrow(/未知订阅弹窗 preset/);
  });

  it('T-F-06: 文案快照不含「囤额度」', () => {
    const banned = ['囤额度', '去囤额度'];
    const allText = [
      ...Object.values(PROMPT_PRESETS).flatMap((p) => [
        p.title,
        p.body,
        p.primaryText,
        p.secondaryText,
        p.tertiaryText ?? '',
      ]),
      ...Object.values(RENEW_PRESETS).flatMap((p) => [
        p.title,
        p.body,
        p.primaryText,
        p.secondaryText,
      ]),
    ].join('\n');

    for (const word of banned) {
      expect(allText).not.toContain(word);
    }
  });

  it('formatPresetText 替换变量', () => {
    const preset = getPromptPreset('student_created');
    const body = formatPresetText(preset.body, { studentName: '小明' });
    expect(body).toContain('小明');
    expect(body).not.toContain('{studentName}');
  });

  it('E01 preset 包含 todo_remind 与 package_alert', () => {
    const preset = getPromptPreset('student_created');
    expect(preset.groups).toContain('todo_remind');
    expect(preset.groups).toContain('package_alert');
  });

  it('booking_success_remind_auth 仅 auth class_remind', () => {
    const preset = getPromptPreset('booking_success_remind_auth');
    expect(preset.groups).toEqual(['class_remind']);
    expect(preset.body).toContain('{bookingLabel}');
  });

  it('SUBSCRIBE_TEMPLATE_GROUPS 共 11 项', () => {
    expect(SUBSCRIBE_TEMPLATE_GROUPS).toHaveLength(11);
  });

  it('E03/E10/E11 flow preset 映射正确', () => {
    expect(getFlowPresetId('E03')).toBe('bind_child');
    expect(getFlowPresetId('E10')).toBe('lead_created');
    expect(getFlowPresetId('E11')).toBe('teacher_created');
    expect(getFlowPresetId('E19')).toBe('calendar_sync_enable');
    expect(getPromptPreset('bind_child').groups).toContain('class_remind');
    expect(getPromptPreset('lead_created').groups).toEqual(['todo_remind']);
  });

  it('schedule_renew 包含 schedule_change 与 class_remind', () => {
    const preset = getRenewPreset('schedule_renew');
    expect(preset.groups).toContain('schedule_change');
    expect(preset.groups).toContain('class_remind');
  });
});
