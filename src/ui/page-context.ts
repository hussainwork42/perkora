import { createContext, useContext } from 'react';
import type { Messages, Locale } from '../shared/i18n';

export interface PageInfo {
  path: string;
  locale: Locale;
  t: Messages;
  csrf: string;
  user: { id: string; name: string; email: string; isAdmin: boolean } | null;
  flash: { type: 'success' | 'error' | 'info'; message: string } | null;
  query: Record<string, string>;
}

export const PageContext = createContext<PageInfo>(null as unknown as PageInfo);

export function usePage(): PageInfo {
  return useContext(PageContext);
}
