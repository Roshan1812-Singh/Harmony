import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics with hyphens', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Brûlée')).toBe('cafe-brulee');
  });

  it('trims leading/trailing hyphens and collapses runs', () => {
    expect(slugify('   --A  B--  ')).toBe('a-b');
  });

  it('caps at 80 characters', () => {
    const long = 'x'.repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it('returns empty for unicode-only input', () => {
    expect(slugify('日本語')).toBe('');
  });
});
