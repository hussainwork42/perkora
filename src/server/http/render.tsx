import fs from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { Ctx, Reply } from './core';
import { htmlReply } from './core';
import { islandComponents } from '../../ui/islands/registry.server';
import { beginIslandCollection, endIslandCollection } from '../../ui/islands/Island';
import { PageContext, type PageInfo } from '../../ui/page-context';

interface Manifest {
  js: string;
  css: string;
}
let manifest: Manifest | null = null;

export function assetManifest(): Manifest {
  if (manifest && process.env.NODE_ENV === 'production') return manifest;
  const file = path.resolve(process.cwd(), 'dist/manifest.json');
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
  } catch {
    manifest = { js: '/assets/client.js', css: '/assets/app.css' };
  }
  return manifest;
}

const escapeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface RenderOpts {
  title: string;
  description?: string;
  status?: number;
  bodyClass?: string;
  noindex?: boolean;
  themeColor?: string;
}

export function pageInfo(ctx: Ctx): PageInfo {
  return {
    path: ctx.path,
    locale: ctx.locale,
    t: ctx.t,
    csrf: ctx.csrfToken,
    user: ctx.user ? { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, isAdmin: ctx.user.platformRole === 'admin' } : null,
    flash: ctx.flash,
    query: Object.fromEntries(ctx.query.entries()),
    badges: (ctx.state.badges as Record<string, number> | undefined) ?? {},
  };
}

/** Server-render a page. Interactive islands are rendered as separate React roots. */
export function render(ctx: Ctx, node: ReactNode, opts: RenderOpts): Reply {
  const info = pageInfo(ctx);
  const collected = beginIslandCollection();
  let html: string;
  try {
    html = renderToString(<PageContext.Provider value={info}>{node}</PageContext.Provider>);
  } finally {
    endIslandCollection();
  }
  for (const island of collected) {
    const Comp = islandComponents[island.name];
    if (!Comp) throw new Error(`Unknown island ${island.name}`);
    const inner = renderToString(<Comp {...island.props} />);
    const markup =
      `<div data-island="${island.name}" data-island-id="${island.id}" class="${escapeHtml(island.className ?? '')}">${inner}</div>` +
      `<script type="application/json" data-island-props="${island.id}">${escapeJson(island.props)}</script>`;
    html = html.replace(`<template data-island-slot="${island.id}"></template>`, markup);
  }
  const m = assetManifest();
  const title = escapeHtml(opts.title.includes('Perkora') ? opts.title : `${opts.title} — Perkora`);
  const doc = `<!doctype html>
<html lang="${ctx.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
${opts.description ? `<meta name="description" content="${escapeHtml(opts.description)}">` : ''}
${opts.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="${escapeHtml(opts.themeColor ?? '#FAF6EF')}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/Inter-Regular.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/fonts/InterDisplay-SemiBold.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${m.css}">
</head>
<body class="${escapeHtml(opts.bodyClass ?? '')}">
${html}
${collected.length ? `<script type="module" src="${m.js}"></script>` : ''}
</body>
</html>`;
  return htmlReply(doc, opts.status ?? 200);
}
