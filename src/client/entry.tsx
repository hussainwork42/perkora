import { hydrateRoot } from 'react-dom/client';

/** Lazily-loaded interactive islands. Keep in sync with ui/islands/registry.server.ts. */
const registry: Record<string, () => Promise<{ default: (p: any) => any }>> = {
  MobileNav: () => import('../ui/islands/MobileNav'),
  WalletLive: () => import('../ui/islands/WalletLive'),
  MemberQr: () => import('../ui/islands/MemberQr'),
  CopyField: () => import('../ui/islands/CopyField'),
  StaffTerminal: () => import('../ui/islands/StaffTerminal'),
  SidebarToggle: () => import('../ui/islands/SidebarToggle'),
  RewardPreview: () => import('../ui/islands/RewardPreview'),
  PrintButton: () => import('../ui/islands/PrintButton'),
  ShowWhen: () => import('../ui/islands/ShowWhen'),
  CafeScanner: () => import('../ui/islands/CafeScanner'),
  FillInput: () => import('../ui/islands/FillInput'),
  ImagePicker: () => import('../ui/islands/ImagePicker'),
  BrandPreview: () => import('../ui/islands/BrandPreview'),
  PasswordInput: () => import('../ui/islands/PasswordInput'),
  ReplyBox: () => import('../ui/islands/ReplyBox'),
  InstallPrompt: () => import('../ui/islands/InstallPrompt'),
};

for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-island]'))) {
  const name = el.dataset.island!;
  const id = el.dataset.islandId!;
  const propsEl = document.querySelector(`script[data-island-props="${id}"]`);
  const props = propsEl ? JSON.parse(propsEl.textContent || '{}') : {};
  const load = registry[name];
  if (!load) continue;
  load()
    .then((mod) => {
      const Comp = mod.default;
      hydrateRoot(el, <Comp {...props} />);
    })
    .catch((e) => console.error('island failed', name, e));
}

/*
 * App feel: a pressed submit button shows a spinner and can't be pressed twice while the
 * next page loads. Forms that fail browser validation never reach this handler.
 */
document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  if (e.defaultPrevented || form.dataset.noLoading !== undefined || form.target === '_blank') return;
  const btn = ((e as SubmitEvent).submitter as HTMLElement | null) ?? form.querySelector<HTMLElement>('button[type=submit], button:not([type])');
  if (btn && btn.classList.contains('btn') && !btn.closest('[data-island]')) {
    btn.setAttribute('data-loading', '');
    btn.setAttribute('aria-busy', 'true');
  }
});
// coming back with the browser's back button restores a usable page
window.addEventListener('pageshow', () => {
  for (const b of Array.from(document.querySelectorAll('[data-loading]'))) {
    b.removeAttribute('data-loading');
    b.removeAttribute('aria-busy');
  }
});
