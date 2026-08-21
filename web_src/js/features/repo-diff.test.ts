import {buildCompareResultURL} from './repo-diff.ts';

test('buildCompareResultURL preserves display options and replaces fragment modes', () => {
  const result = buildCompareResultURL('http://localhost/user/repo/compare/main...feature?style=split&whitespace=ignore-all&file-only=true&compare-full=true');
  const url = new URL(result);

  expect(url.pathname).toBe('/user/repo/compare/main...feature');
  expect(url.searchParams.get('style')).toBe('split');
  expect(url.searchParams.get('whitespace')).toBe('ignore-all');
  expect(url.searchParams.get('file-only')).toBeNull();
  expect(url.searchParams.get('compare-full')).toBeNull();
  expect(url.searchParams.get('compare-result')).toBe('true');
});
