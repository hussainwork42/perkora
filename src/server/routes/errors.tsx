import type { Ctx, Reply } from '../http/core';
import { render } from '../http/render';
import { Logo } from '../../ui/components/brand';
import { usePage } from '../../ui/page-context';

function ErrorPage({ status, message }: { status: number; message?: string }) {
  const { t } = usePage();
  const title = status === 404 ? t.errors.notFoundTitle : status === 403 ? t.errors.forbiddenTitle : status === 429 ? t.errors.forbiddenTitle : status >= 500 ? t.errors.serverTitle : t.errors.forbiddenTitle;
  const body = message ?? (status === 404 ? t.errors.notFoundBody : status === 429 ? t.errors.tooMany : '');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-display text-[64px] font-semibold text-beige-strong tnum">{status}</p>
      <h1 className="mt-2 text-[26px] font-semibold">{title}</h1>
      {body && <p className="mt-2 max-w-md text-muted-ink">{body}</p>}
      <div className="mt-8 flex gap-3">
        <a href="/" className="btn btn-primary">
          {t.errors.goHome}
        </a>
      </div>
    </div>
  );
}

export function renderError(ctx: Ctx, status: number, message?: string): Reply {
  return render(ctx, <ErrorPage status={status} message={message} />, { title: String(status), status, noindex: true });
}
