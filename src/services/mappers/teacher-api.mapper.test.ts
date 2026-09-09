import { describe, expect, it } from 'vitest';
import { mapBackendSalarySettings } from './teacher-api.mapper';

describe('mapBackendSalarySettings', () => {
  it('keeps push disabled when the backend omits the legacy field', () => {
    expect(mapBackendSalarySettings({ payDay: 15 })).toEqual({
      payDay: 15,
      pushDaysBefore: 3,
      autoConfirm: false,
      pushEnabled: false,
    });
  });
});
