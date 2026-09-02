import { describe, expect, it } from 'vitest';
import { durationToTimeRange, parseDurationMinutes } from './course-form-time';

describe('parseDurationMinutes', () => {
  it('returns empty when start or end missing', () => {
    expect(parseDurationMinutes(undefined, '10:00')).toBe('');
    expect(parseDurationMinutes('09:00', undefined)).toBe('');
    expect(parseDurationMinutes('', '10:00')).toBe('');
  });

  it('computes positive minute delta', () => {
    expect(parseDurationMinutes('09:00', '10:00')).toBe('60');
    expect(parseDurationMinutes('09:30', '10:00')).toBe('30');
    expect(parseDurationMinutes('14:00', '15:45')).toBe('105');
  });

  it('returns empty when end is not after start', () => {
    expect(parseDurationMinutes('10:00', '09:00')).toBe('');
    expect(parseDurationMinutes('10:00', '10:00')).toBe('');
  });
});

describe('durationToTimeRange', () => {
  it('anchors at 09:00 and adds duration', () => {
    expect(durationToTimeRange(60)).toEqual({ start: '09:00', end: '10:00' });
    expect(durationToTimeRange(90)).toEqual({ start: '09:00', end: '10:30' });
  });

  it('clamps non-positive minutes to at least 1', () => {
    expect(durationToTimeRange(0)).toEqual({ start: '09:00', end: '09:01' });
    expect(durationToTimeRange(-5)).toEqual({ start: '09:00', end: '09:01' });
  });
});
