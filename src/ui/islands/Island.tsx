/**
 * <Island> marks an interactive component. On the server it leaves a slot that
 * render() fills with the component's own HTML plus its JSON props; in the
 * browser, src/client/entry.tsx hydrates each slot as its own React root.
 */
interface Collected {
  id: string;
  name: string;
  props: Record<string, unknown>;
  className?: string;
}

let current: Collected[] | null = null;
let seq = 0;

export function beginIslandCollection(): Collected[] {
  current = [];
  seq = 0;
  return current;
}

export function endIslandCollection() {
  current = null;
}

export function Island({ name, props, className }: { name: string; props: Record<string, unknown>; className?: string }) {
  if (!current) throw new Error('<Island> rendered outside render()');
  const id = `i${++seq}`;
  current.push({ id, name, props, className });
  return <template data-island-slot={id}></template>;
}
