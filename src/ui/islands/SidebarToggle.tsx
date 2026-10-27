import { useEffect, useState } from 'react';
import { LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';

/** Collapses the desktop dashboard sidebar to icons; remembered per browser. */
export default function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let v = false;
    try {
      v = localStorage.getItem('pk_sidebar') === 'collapsed';
    } catch {
      /* storage unavailable */
    }
    setCollapsed(v);
    document.documentElement.toggleAttribute('data-sidebar-collapsed', v);
  }, []);
  const toggle = () => {
    const v = !collapsed;
    setCollapsed(v);
    document.documentElement.toggleAttribute('data-sidebar-collapsed', v);
    try {
      localStorage.setItem('pk_sidebar', v ? 'collapsed' : 'open');
    } catch {
      /* storage unavailable */
    }
  };
  const Icon = collapsed ? LuPanelLeftOpen : LuPanelLeftClose;
  return (
    <button type="button" onClick={toggle} className="rounded-md p-1 text-muted-ink hover:bg-sand hover:text-ink" aria-pressed={collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
