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
