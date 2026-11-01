import { useEffect, useRef, useState } from 'react';
import { useQrScanner } from './useQrScanner';
import { LuCamera, LuCheck, LuChevronLeft, LuCircleAlert, LuGift, LuLoaderCircle, LuMinus, LuPlus, LuSearch, LuStamp, LuStar, LuX } from 'react-icons/lu';
import { parseMoneyToMinor } from '../../shared/format';

type S = Record<string, string>;

interface Prog {
  id: string;
  name: string;
  type: 'stamps' | 'points';
  balance: number;
  stampsRequired?: number;
  maxStampsPerTransaction?: number;
  allowWithOtherPromotions: boolean;
  earnMode?: 'per_currency_unit' | 'per_purchase';
  pointsPerUnit?: number;
  pointsPerPurchase?: number;
  cardRewardName?: string | null;
  catalogue: { id: string; name: string; cost: number }[];
}
interface Member {
  id: string;
  shortName: string;
  memberCode: string;
  visitCount: number;
  lastVisitLabel: string | null;
  sinceLabel: string;
  programmes: Prog[];
  vouchers: { id: string; name: string; expiresLabel: string | null }[];
}
interface Recent {
  id: string;
  label: string;
  who: string;
  time: string;
  delta: number;
}

type Action =
  | { kind: 'award'; prog: Prog }
  | { kind: 'voucher'; voucher: Member['vouchers'][number] }
  | { kind: 'points'; prog: Prog; reward: Prog['catalogue'][number] };

const fmt = (tmpl: string, v: Record<string, string | number>) => tmpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
const plural = (tmpl: string, n: number, v: Record<string, string | number> = {}) => {
  const [one, other] = tmpl.split('|');
  return fmt(n === 1 ? one : (other ?? one), { n, ...v });
};

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'k' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function StaffTerminal({ s, csrf, currency, currencySymbol, initialMemberId, instructions }: {
  s: S;
  csrf: string;
  currency: string;
  currencySymbol: string;
  initialMemberId?: string | null;
  instructions?: string;
}) {
  const [member, setMember] = useState<Member | null>(null);
  const [code, setCode] = useState('');
  const [contact, setContact] = useState('');
  const [showContact, setShowContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [success, setSuccess] = useState<{ title: string; lines: string[]; code?: string } | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [scanning, setScanning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const api = async (path: string, body?: unknown) => {
    const r = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data: any = null;
    try {
      data = await r.json();
    } catch {
      /* not json */
    }
    if (!r.ok) {
      const err: any = new Error(data?.error?.message ?? `Request failed (${r.status})`);
      err.code = data?.error?.code;
      err.details = data?.error?.details;
      throw err;
    }
    return data;
  };

  const loadRecent = () => api('/api/terminal/recent').then((d) => setRecent(d.items)).catch(() => undefined);

  useEffect(() => {
    loadRecent();
    if (initialMemberId) {
      setBusy(true);
      api(`/api/terminal/member/${initialMemberId}`)
        .then((d) => setMember(d.member))
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!success) return;
    let n = 10;
    setCountdown(n);
    const t = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        reset();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const reset = () => {
    setMember(null);
    setAction(null);
    setSuccess(null);
    setError(null);
    setCode('');
    setContact('');
    setShowContact(false);
    if (window.location.search) window.history.replaceState(null, '', '/terminal');
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const lookup = async (payload: Record<string, string>) => {
    setBusy(true);
    setError(null);
    try {
      const d = await api('/api/terminal/lookup', payload);
      setMember(d.member);
      setScanning(false);
    } catch (e: any) {
      setError(
        e.code === 'not_found'
          ? s.notFound
          : e.code === 'invalid_token' || e.code === 'token_expired'
            ? s.invalidCode
            : e.code === 'other_cafe'
              ? s.otherCafe
              : navigator.onLine === false
                ? s.offline
                : fmt(s.error, { message: e.message }),
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmitCode = (e: Event) => {
    e.preventDefault();
    const v = code.trim();
    if (!v) return;
    if (/PK1\./.test(v)) lookup({ token: v });
    else lookup({ code: v });
  };
  const onSubmitContact = (e: Event) => {
    e.preventDefault();
    if (contact.trim()) lookup({ contact: contact.trim() });
  };

  return (
    <div className="mx-auto grid max-w-[1100px] gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {success ? (
          <SuccessPanel s={s} success={success} countdown={countdown} onNext={reset} />
        ) : member ? (
          <MemberPanel
            s={s}
            member={member}
            currencySymbol={currencySymbol}
            onBack={reset}
            onAction={(a) => {
              setError(null);
              setAction(a);
            }}
          />
        ) : (
          <div className="card p-5 sm:p-6">
            {scanning ? (
              <Scanner s={s} onCode={(raw) => lookup({ token: raw, code: raw })} onClose={() => setScanning(false)} />
            ) : (
              <button type="button" className="btn btn-primary btn-lg w-full text-[17px]" style={{ minHeight: 64 }} onClick={() => setScanning(true)}>
                <LuCamera className="h-6 w-6" aria-hidden="true" /> {s.scan}
              </button>
            )}
            <form onSubmit={onSubmitCode as any} className="mt-5">
              <label htmlFor="member-code" className="label">
                {s.manual}
              </label>
              <div className="flex gap-2">
                <input
                  id="member-code"
                  ref={codeRef}
                  className="input flex-1 text-[18px] uppercase tracking-[0.08em] placeholder:normal-case placeholder:tracking-normal"
                  placeholder={s.manualPlaceholder}
                  value={code}
                  onChange={(e: any) => setCode(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  autoFocus
                />
                <button className="btn btn-secondary" type="submit" disabled={busy || !code.trim()}>
                  {busy ? <LuLoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LuSearch className="h-5 w-5" aria-hidden="true" />}
                  {s.find}
                </button>
              </div>
            </form>
            {showContact ? (
              <form onSubmit={onSubmitContact as any} className="mt-4">
                <label htmlFor="member-contact" className="label">
                  {s.contactLookup}
                </label>
                <div className="flex gap-2">
                  <input id="member-contact" className="input flex-1" placeholder={s.contactPlaceholder} value={contact} onChange={(e: any) => setContact(e.target.value)} autoComplete="off" />
                  <button className="btn btn-secondary" type="submit" disabled={busy || !contact.trim()}>
                    {s.find}
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="mt-3 text-[14px] link" onClick={() => setShowContact(true)}>
                {s.contactLookup}
              </button>
            )}
            {error && <ErrorBox message={error} />}
          </div>
        )}
        {member && error && !action && <ErrorBox message={error} />}
      </div>

      <aside className="space-y-4">
        {instructions && (
          <div className="card p-4">
            <h2 className="text-[14px] font-semibold">{s.instructions}</h2>
            <p className="mt-1 whitespace-pre-line text-[13.5px] text-muted-ink">{instructions}</p>
          </div>
        )}
        <div className="card">
          <h2 className="px-4 pt-4 text-[14px] font-semibold">{s.recent}</h2>
          {recent.length === 0 ? (
            <p className="px-4 pb-4 pt-2 text-[13.5px] text-muted-ink">{s.noRecent}</p>
          ) : (
            <ul className="divide-y divide-beige px-4 pb-2">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.who}</span>
                    <span className="block truncate text-muted-ink">{r.label}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {r.delta !== 0 && <span className={`block font-semibold tnum ${r.delta > 0 ? 'text-success' : 'text-terracotta-ink'}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span>}
                    <span className="block text-[12px] text-muted-ink tnum">{r.time}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {action && member && (
        <ConfirmSheet
          s={s}
          member={member}
          action={action}
          currency={currency}
          currencySymbol={currencySymbol}
          api={api}
          onClose={() => setAction(null)}
          onDone={(m, result) => {
            setMember(m);
            setAction(null);
            setSuccess(result);
            loadRecent();
          }}
        />
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-4 flex gap-2.5 rounded-[12px] border border-error/25 bg-error-tint px-4 py-3 text-[14.5px]">
      <LuCircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-error" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function MemberPanel({ s, member, onBack, onAction, currencySymbol }: { s: S; member: Member; onBack: () => void; onAction: (a: Action) => void; currencySymbol: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-beige px-5 py-4">
        <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={onBack} aria-label={s.nextCustomer}>
          <LuChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-muted-ink">{s.member}</p>
          <h2 className="truncate text-[22px] font-semibold leading-tight">{member.shortName}</h2>
          <p className="text-[13px] text-muted-ink">
            {member.memberCode} · {plural(s.visits, member.visitCount)} · {member.lastVisitLabel ? fmt(s.lastVisit, { when: member.lastVisitLabel }) : member.sinceLabel}
          </p>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {member.programmes.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-[14px] border border-beige bg-cream px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted-ink">{p.name}</p>
              {p.type === 'stamps' ? (
                <div>
                  <p className="text-[20px] font-semibold tnum">
                    {p.balance} / {p.stampsRequired}
                  </p>
                  <div className="mt-1.5 flex gap-1" aria-hidden="true">
                    {Array.from({ length: p.stampsRequired ?? 0 }, (_, i) => (
                      <span key={i} className={`h-2.5 flex-1 rounded-full ${i < p.balance ? 'bg-terracotta' : 'bg-beige'}`} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[20px] font-semibold tnum">
                  {p.balance} <span className="text-[14px] font-normal text-muted-ink">{s.points ?? 'points'}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg shrink-0 sm:w-44"
              onClick={() => onAction({ kind: 'award', prog: p })}
            >
              {p.type === 'stamps' ? <LuStamp className="h-5 w-5" aria-hidden="true" /> : <LuStar className="h-5 w-5" aria-hidden="true" />}
              {p.type === 'stamps' ? s.addStamp : s.addPoints}
            </button>
          </div>
        ))}

        <div className="pt-2">
          <h3 className="text-[14px] font-semibold">{s.rewardsHeld}</h3>
          {member.vouchers.length === 0 ? (
            <p className="mt-1 text-[13.5px] text-muted-ink">{s.noRewardsHeld}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {member.vouchers.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-[12px] border border-terracotta/40 bg-paper px-3.5 py-2.5">
                  <LuGift className="h-5 w-5 shrink-0 text-terracotta-ink" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{v.name}</span>
                    {v.expiresLabel && <span className="block text-[12.5px] text-muted-ink">{v.expiresLabel}</span>}
                  </span>
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => onAction({ kind: 'voucher', voucher: v })}>
                    {s.redeem}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {member.programmes
          .filter((p) => p.type === 'points' && p.catalogue.length)
          .map((p) => (
            <div key={p.id} className="pt-2">
              <h3 className="text-[14px] font-semibold">{s.pointsRewards}</h3>
              <ul className="mt-2 space-y-2">
                {p.catalogue.map((r) => {
                  const ok = p.balance >= r.cost;
                  return (
                    <li key={r.id} className="flex items-center gap-3 rounded-[12px] border border-beige bg-paper px-3.5 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{r.name}</span>
                        <span className="block text-[12.5px] text-muted-ink tnum">
                          {r.cost} {s.points ?? 'points'}
                          {!ok && ` · ${fmt(s.cannotAfford, { n: r.cost - p.balance })}`}
                        </span>
                      </span>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={!ok} onClick={() => onAction({ kind: 'points', prog: p, reward: r })}>
                        {s.redeem}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        <span className="hidden">{currencySymbol}</span>
      </div>
    </div>
  );
}

function ConfirmSheet({ s, member, action, currency, currencySymbol, api, onClose, onDone }: {
  s: S;
  member: Member;
  action: Action;
  currency: string;
  currencySymbol: string;
  api: (path: string, body?: unknown) => Promise<any>;
  onClose: () => void;
  onDone: (m: Member, result: { title: string; lines: string[]; code?: string }) => void;
}) {
  const [key] = useState(uuid);
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [promo, setPromo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSeconds, setRecentSeconds] = useState<number | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  let title = '';
  let preview: string[] = [];
  let canConfirm = true;
  if (action.kind === 'award') {
    const p = action.prog;
    if (p.type === 'stamps') {
      const after = p.balance + qty;
      title = p.name;
      preview = [fmt(s.willAdd, { n: plural(s.stampOne ?? '{n} stamp|{n} stamps', qty), programme: p.name }), fmt(s.balanceChange, { from: `${p.balance}/${p.stampsRequired}`, to: `${Math.min(after, p.stampsRequired!)}/${p.stampsRequired}` })];
      if (after >= (p.stampsRequired ?? Infinity) && p.cardRewardName) preview.push(fmt(s.rewardUnlocks, { reward: p.cardRewardName }));
    } else {
      title = p.name;
      let pts = 0;
      if (p.earnMode === 'per_currency_unit') {
        const minor = parseMoneyToMinor(amount);
        pts = minor ? Math.floor((minor * (p.pointsPerUnit ?? 1)) / 100) : 0;
        canConfirm = pts > 0;
      } else pts = qty * (p.pointsPerPurchase ?? 0);
      preview = pts > 0 ? [fmt(s.willAdd, { n: `${pts} ${s.points ?? 'points'}`, programme: p.name }), fmt(s.balanceChange, { from: p.balance, to: p.balance + pts })] : [];
    }
    if (promo && !p.allowWithOtherPromotions) canConfirm = false;
  } else if (action.kind === 'voucher') {
    title = fmt(s.redeemReward, { reward: action.voucher.name });
    preview = [s.redeemVoucher];
  } else {
    title = fmt(s.redeemReward, { reward: action.reward.name });
    preview = [fmt(s.redeemCost, { n: action.reward.cost, from: action.prog.balance, to: action.prog.balance - action.reward.cost })];
  }

  const submit = async (confirmSeparate = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let d: any;
      if (action.kind === 'award') {
        d = await api('/api/terminal/award', {
          membershipId: member.id,
          programmeId: action.prog.id,
          quantity: qty,
          amount: amount || undefined,
          currency,
          referenceId: reference.trim() || undefined,
          usedOtherPromotion: promo,
          confirmSeparatePurchase: confirmSeparate,
          idempotencyKey: key,
        });
        const r = d.result;
        const unit = r.programmeType === 'stamps' ? plural(s.stampOne ?? '{n} stamp|{n} stamps', r.credited) : `${r.credited} ${s.points ?? 'points'}`;
        const lines = [fmt(s.awarded, { n: unit, programme: r.programmeName })];
        for (const b of r.bonuses ?? []) lines.push(fmt(s.bonusAdded, { campaign: b.campaignName, n: b.amount }));
        for (const v of r.vouchersIssued ?? []) lines.push(fmt(s.unlocked, { reward: v.rewardName }));
        for (const c of r.challengeCompletions ?? []) lines.push(fmt(s.challengeDone, { name: c.challengeName }));
        if (r.duplicate) lines.push(s.duplicate);
        onDone(d.member, { title: s.success, lines });
      } else if (action.kind === 'voucher') {
        d = await api('/api/terminal/redeem', { membershipId: member.id, kind: 'voucher', customerRewardId: action.voucher.id, idempotencyKey: key });
        onDone(d.member, { title: s.redeemedTitle, lines: [d.result.rewardName, ...(d.result.duplicate ? [s.duplicate] : [])], code: d.result.redemptionCode });
      } else {
        d = await api('/api/terminal/redeem', { membershipId: member.id, kind: 'points', rewardId: action.reward.id, idempotencyKey: key });
        onDone(d.member, {
          title: s.redeemedTitle,
          lines: [d.result.rewardName, fmt(s.balanceChange, { from: action.prog.balance, to: d.result.balanceAfter }), ...(d.result.duplicate ? [s.duplicate] : [])],
          code: d.result.redemptionCode,
        });
      }
    } catch (e: any) {
      if (e.code === 'recent_award') {
        setRecentSeconds(e.details?.secondsAgo ?? 0);
      } else if (e.code === 'insufficient_balance') {
        setError(s.insufficient);
      } else if (navigator.onLine === false) {
        setError(s.offline);
      } else {
        setError(fmt(s.error, { message: e.message }));
      }
    } finally {
      setBusy(false);
    }
  };

  const p = action.kind === 'award' ? action.prog : null;
  const maxQty = p?.type === 'stamps' ? (p.maxStampsPerTransaction ?? 1) : 10;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-coffee/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="animate-sheet-up w-full max-w-[480px] rounded-t-[22px] bg-paper p-5 shadow-2xl sm:rounded-[22px] sm:p-6" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted-ink">{member.shortName}</p>
            <h2 id="confirm-title" className="text-[20px] font-semibold">
              {title}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm -mr-2" onClick={onClose} disabled={busy} aria-label={s.cancel ?? 'Cancel'}>
            <LuX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {p && (
          <div className="mt-4 space-y-4">
            {p.type === 'stamps' || p.earnMode === 'per_purchase' ? (
              maxQty > 1 && (
                <div>
                  <p className="label">{p.type === 'stamps' ? s.quantity : s.purchases}</p>
                  <div className="flex items-center gap-3">
                    <button type="button" className="btn btn-secondary h-12 w-12 px-0" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="−1">
                      <LuMinus className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="w-10 text-center font-display text-[26px] font-semibold tnum" aria-live="polite">
                      {qty}
                    </span>
                    <button type="button" className="btn btn-secondary h-12 w-12 px-0" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="+1">
                      <LuPlus className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div>
                <label htmlFor="amount" className="label">
                  {fmt(s.amount, { currency: currencySymbol })}
                </label>
                <input id="amount" className="input text-[20px] tnum" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e: any) => setAmount(e.target.value)} autoFocus autoComplete="off" />
              </div>
            )}
            <div>
              <label htmlFor="reference" className="label">
                {s.reference} <span className="font-normal text-muted">({s.optional ?? 'optional'})</span>
              </label>
              <input id="reference" className="input" value={reference} onChange={(e: any) => setReference(e.target.value)} maxLength={60} autoComplete="off" />
              <p className="hint">{s.referenceHelp}</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="checkbox mt-[3px]" checked={promo} onChange={(e: any) => setPromo(e.target.checked)} />
              <span className="text-[14.5px]">{s.otherPromo}</span>
            </label>
            {promo && !p.allowWithOtherPromotions && <p className="rounded-[10px] bg-warning-tint px-3 py-2 text-[13.5px] text-warning-ink">{s.otherPromoBlocked}</p>}
          </div>
        )}

        {preview.length > 0 && (
          <div className="mt-5 rounded-[14px] bg-cream px-4 py-3.5">
            {preview.map((line, i) => (
              <p key={i} className={i === 0 ? 'text-[16px] font-semibold' : 'mt-0.5 text-[14.5px] text-muted-ink tnum'}>
                {line}
              </p>
            ))}
          </div>
        )}

        {recentSeconds !== null ? (
          <div className="mt-5 rounded-[14px] border border-warning/40 bg-warning-tint p-4">
            <p className="text-[14.5px] text-ink">{fmt(s.recentConfirm, { n: recentSeconds })}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                {s.cancel ?? 'Cancel'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => submit(true)} disabled={busy}>
                {s.yesSeparate}
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={firstRef}
            type="button"
            className="btn btn-primary btn-lg mt-5 w-full text-[17px]"
            style={{ minHeight: 58 }}
            onClick={() => submit(false)}
            disabled={busy || !canConfirm}
          >
            {busy && <LuLoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {action.kind === 'award' ? s.confirmAward : s.confirmRedeem}
          </button>
        )}
        {error && <ErrorBox message={error} />}
      </div>
    </div>
  );
}

function SuccessPanel({ s, success, countdown, onNext }: { s: S; success: { title: string; lines: string[]; code?: string }; countdown: number; onNext: () => void }) {
  return (
    <div className="card px-6 py-10 text-center" role="status" aria-live="polite">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-white animate-stamp-in">
        <LuCheck className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-[24px] font-semibold">{success.title}</h2>
      <ul className="mt-2 space-y-1">
        {success.lines.map((l, i) => (
          <li key={i} className={i === 0 ? 'text-[17px] font-medium' : 'text-[15px] text-muted-ink'}>
            {l}
          </li>
        ))}
      </ul>
      {success.code && (
        <p className="mt-4 text-[13px] text-muted-ink">
          {s.redemptionCode}: <span className="font-semibold tracking-[0.08em] text-ink">{success.code}</span>
        </p>
      )}
      <button type="button" className="btn btn-primary btn-lg mt-7 w-full max-w-xs" onClick={onNext} autoFocus>
        {s.nextCustomer}
      </button>
      <p className="mt-3 text-[13px] text-muted-ink">{fmt(s.resetIn, { n: countdown })}</p>
    </div>
  );
}

function Scanner({ s, onCode, onClose }: { s: S; onCode: (raw: string) => void; onClose: () => void }) {
  const { videoRef, problem, ready } = useQrScanner(onCode);
  const message = problem === 'denied' ? s.cameraDenied : problem === 'insecure' ? s.cameraInsecure : problem === 'nocamera' ? s.cameraMissing : problem ? s.cameraUnsupported : null;
  return (
    <div>
      {message ? (
        <div role="alert" className="rounded-[12px] bg-warning-tint px-4 py-3 text-[14.5px] text-warning-ink">
          {message}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[14px] bg-coffee">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay aria-label={s.scanning} />
          <div className="pointer-events-none absolute inset-8 rounded-[18px] border-2 border-cream/80" aria-hidden="true" />
          <p className="absolute inset-x-0 bottom-3 text-center text-[13.5px] text-cream" aria-live="polite">
            {ready ? s.scanning : s.cameraStarting}
          </p>
        </div>
      )}
      <button type="button" className="btn btn-secondary mt-3 w-full" onClick={onClose}>
        {s.stopScan}
      </button>
    </div>
  );
}
