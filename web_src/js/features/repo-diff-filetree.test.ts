import {loadDiffFileTreePageData} from './repo-diff-filetree.ts';

test('loadDiffFileTreePageData injects the async fragment tree data into pageData', () => {
  window.config.pageData = {};
  const el = document.createElement('div');
  el.setAttribute('data-tree', '{"TreeRoot":{"FullName":"","Children":[{"FullName":"a.txt","DiffStatus":"added"}]}}');
  el.setAttribute('data-folder-icon', '{"folder":true}');
  el.setAttribute('data-folder-open-icon', '{"folder":false}');

  loadDiffFileTreePageData(el);

  expect(window.config.pageData.DiffFileTree!.TreeRoot.Children![0].FullName).toBe('a.txt');
  expect(window.config.pageData.FolderIcon).toEqual({folder: true});
  expect(window.config.pageData.FolderOpenIcon).toEqual({folder: false});
});

test('loadDiffFileTreePageData leaves pageData untouched without data-tree', () => {
  window.config.pageData = {repoLink: 'http://example.com'};
  const el = document.createElement('div');

  loadDiffFileTreePageData(el);

  expect(window.config.pageData).toEqual({repoLink: 'http://example.com'});
});
