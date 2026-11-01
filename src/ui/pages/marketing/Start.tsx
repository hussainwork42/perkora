import { LuSearch, LuStore, LuUser } from 'react-icons/lu';
import { usePage } from '../../page-context';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import { CafeMark } from '../../components/brand';
import { Island } from '../../islands/Island';
import { fmt } from '../../../shared/i18n';
import { cafeScannerLabels } from '../customer/CustomerPages';

/** One link to share with everyone: café owners, staff and customers each find their way in. */
export function StartPage() {
  const { t, user } = usePage();
  const s = t.start;
  return (
    <MarketingLayout active="start">
      <section className="mx-auto max-w-[980px] px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em] sm:text-[44px]">{s.title}</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-muted-ink">{s.intro}</p>
        {user && (
          <p className="mt-4 text-[15px]">
            {fmt(s.signedInAs, { name: user.name })}{' '}
            <a className="link font-medium" href="/home">
              {s.continue}
            </a>
          </p>
        )}
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="panel flex flex-col p-6 sm:p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-espresso text-cream">
              <LuStore className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-[22px] font-semibold">{s.cafeTitle}</h2>
            <p className="mt-1.5 text-[15.5px] text-muted-ink">{s.cafeBody}</p>
            <div className="mt-auto grid gap-2.5 pt-6">
              <a href="/get-started" className="btn btn-primary btn-lg w-full">
                {s.cafeCreate}
              </a>
              <a href="/sign-in" className="btn btn-secondary w-full">
                {s.cafeSignIn}
              </a>
              <p className="text-[13px] text-muted-ink">{s.staffNote}</p>
            </div>
          </div>
          <div className="panel flex flex-col p-6 sm:p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-terracotta text-white">
              <LuUser className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-[22px] font-semibold">{s.customerTitle}</h2>
            <p className="mt-1.5 text-[15.5px] text-muted-ink">{s.customerBody}</p>
            <div className="mt-auto grid gap-2.5 pt-6">
              <a href="/cafes" className="btn btn-primary btn-lg w-full">
                <LuSearch className="h-5 w-5" aria-hidden="true" /> {s.customerFind}
              </a>
              <Island name="CafeScanner" props={{ labels: cafeScannerLabels(t), variant: 'secondary' }} />
              <div className="grid grid-cols-2 gap-2.5">
                <a href="/sign-up" className="btn btn-secondary w-full">
                  {s.customerCreate}
                </a>
                <a href="/sign-in" className="btn btn-secondary w-full">
                  {s.customerSignIn}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export interface DirectoryCafe {
  slug: string;
  name: string;
  city: string | null;
  description: string | null;
  logoUrl: string | null;
  primaryColour: string;
  isDemo: boolean;
}

export function CafesPage({ cafes, q }: { cafes: DirectoryCafe[]; q: string }) {
  const { t } = usePage();
  const s = t.cafes;
  return (
    <MarketingLayout active="cafes">
      <section className="mx-auto max-w-[880px] px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em] sm:text-[44px]">{s.title}</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-muted-ink">{s.intro}</p>
        <form action="/cafes" method="get" className="mt-6 flex gap-2" role="search">
          <label htmlFor="cafe-q" className="sr-only">
            {s.search}
          </label>
          <input id="cafe-q" name="q" defaultValue={q} placeholder={s.search} className="input flex-1" maxLength={80} />
          <button className="btn btn-primary" type="submit">
            <LuSearch className="h-4 w-4" aria-hidden="true" /> {s.searchButton}
          </button>
        </form>
        <div className="mt-4 max-w-sm">
          <Island name="CafeScanner" props={{ labels: cafeScannerLabels(t), variant: 'secondary' }} />
        </div>
        {cafes.length === 0 ? (
          <p className="card mt-6 p-8 text-center text-muted-ink">{q ? fmt(s.none, { q }) : s.empty}</p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {cafes.map((c) => (
              <li key={c.slug}>
                <a href={`/c/${c.slug}`} className="card flex h-full items-start gap-4 p-4 hover:border-beige-strong">
                  <CafeMark name={c.name} logoUrl={c.logoUrl} colour={c.primaryColour} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16.5px] font-semibold">{c.name}</span>
                    <span className="block text-[13.5px] text-muted-ink">
                      {c.city}
                      {c.isDemo ? ` · ${s.demo}` : ''}
                    </span>
                    {c.description && <span className="mt-1 line-clamp-2 block text-[14px] text-muted-ink">{c.description}</span>}
                    <span className="mt-2 inline-block text-[14px] font-medium text-espresso underline underline-offset-4">{s.open}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-[14px] text-muted-ink">
          {s.ownCafe}{' '}
          <a className="link" href="/get-started">
            {s.ownCafeLink}
          </a>
        </p>
      </section>
    </MarketingLayout>
  );
}
