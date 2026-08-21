import {createApp} from 'vue';
import DiffFileTree from '../components/DiffFileTree.vue';

// the async compare fragment doesn't carry window.config.pageData, so the tree data is injected as data-* attributes
export function loadDiffFileTreePageData(el: Element): void {
  const treeData = el.getAttribute('data-tree');
  if (!treeData) return;

  Object.assign(window.config.pageData, {
    DiffFileTree: JSON.parse(treeData),
    FolderIcon: JSON.parse(el.getAttribute('data-folder-icon')!),
    FolderOpenIcon: JSON.parse(el.getAttribute('data-folder-open-icon')!),
  });
}

export function initDiffFileTree() {
  const el = document.querySelector('#diff-file-tree');
  if (!el) return;

  loadDiffFileTreePageData(el);

  const fileTreeView = createApp(DiffFileTree);
  fileTreeView.mount(el);
}
