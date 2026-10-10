import {localUserSettings} from '../modules/user-settings.ts';

export type CommitIdentity = {
  name: string,
  email: string,
};

const storageKey = (role: string) => `git-identity:${role}:v1`;

export function readStoredIdentity(role: string): CommitIdentity | null {
  const raw = localUserSettings.getString(storageKey(role), '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CommitIdentity;
    return {name: parsed.name || '', email: parsed.email || ''};
  } catch {
    return null;
  }
}

export function writeStoredIdentity(role: string, identity: CommitIdentity) {
  localUserSettings.setString(storageKey(role), JSON.stringify(identity));
}

// Remember the identity chosen on the server-rendered commit form, so the next edit starts from it.
export function initCommitIdentity() {
  for (const nameInput of document.querySelectorAll<HTMLInputElement>('input[name="commit_name"]')) {
    const form = nameInput.form;
    if (!form) continue;
    const emailSelect = form.querySelector<HTMLSelectElement>('select[name="commit_email"]');
    const stored = readStoredIdentity('commit');
    if (stored) {
      if (stored.name) nameInput.value = stored.name;
      const option = emailSelect && Array.from(emailSelect.options).find((o) => o.value.toLowerCase() === stored.email.toLowerCase());
      if (option) emailSelect.value = option.value;
    }
    const save = () => writeStoredIdentity('commit', {name: nameInput.value, email: emailSelect ? emailSelect.value : ''});
    nameInput.addEventListener('change', save);
    emailSelect?.addEventListener('change', save);
    form.addEventListener('submit', save);
  }
}
