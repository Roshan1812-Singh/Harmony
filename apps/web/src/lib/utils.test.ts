import { describe, expect, it } from 'vitest';
import { cn, formatDuration, formatPlayCount } from './utils';

describe('cn', () => {
  it('merges tailwind classes and resolves conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', false && 'hidden')).toBe('text-sm');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds as mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59_000)).toBe('0:59');
    expect(formatDuration(60_000)).toBe('1:00');
    expect(formatDuration(125_000)).toBe('2:05');
  });

  it('clamps negative values', () => {
    expect(formatDuration(-1)).toBe('0:00');
  });
});

describe('formatPlayCount', () => {
  it('formats counts with K and M suffixes', () => {
    expect(formatPlayCount(0)).toBe('0');
    expect(formatPlayCount(999)).toBe('999');
    expect(formatPlayCount(1_500)).toBe('1.5K');
    expect(formatPlayCount(2_000_000)).toBe('2M');
  });
});
