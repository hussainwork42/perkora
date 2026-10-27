import { scaleBand, scaleLinear } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';
import { cn } from '../cn';

export interface Point {
  label: string;
  value: number;
  /** full label for tooltips / screen readers */
  title?: string;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  return scaleLinear().domain([0, v]).nice(4).domain()[1];
}

/** Server-rendered SVG bar chart with native tooltips and a text summary for screen readers. */
export function BarChart({ data, height = 180, color = '#3B2925', ariaLabel, className, showEvery }: {
  data: Point[];
  height?: number;
  color?: string;
  ariaLabel: string;
  className?: string;
  showEvery?: number;
}) {
  const width = 640;
  const m = { t: 10, r: 8, b: 26, l: 30 };
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const x = scaleBand<number>().domain(data.map((_, i) => i)).range([m.l, width - m.r]).paddingInner(0.28).paddingOuter(0.1);
  const y = scaleLinear().domain([0, max]).range([height - m.b, m.t]);
  const ticks = y.ticks(4).filter((t) => Number.isInteger(t));
  const every = showEvery ?? Math.max(1, Math.ceil(data.length / 8));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${ariaLabel}. Total ${total}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="#E9DED0" strokeWidth="1" />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#77716B" className="tnum">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(0, y(0) - y(d.value));
          const bw = x.bandwidth();
          return (
            <g key={i}>
              <rect x={x(i)} y={y(0) - h} width={bw} height={h} rx={Math.min(3, bw / 3)} fill={color} opacity={d.value === 0 ? 0 : 0.92}>
                <title>{`${d.title ?? d.label}: ${d.value}`}</title>
              </rect>
              <rect x={x(i)} y={m.t} width={bw} height={height - m.b - m.t} fill="transparent">
                <title>{`${d.title ?? d.label}: ${d.value}`}</title>
              </rect>
              {i % every === 0 && (
                <text x={(x(i) ?? 0) + bw / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#77716B">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {ariaLabel}: {data.map((d) => `${d.title ?? d.label} ${d.value}`).join(', ')}
      </figcaption>
    </figure>
  );
}

export function AreaChart({ data, height = 180, color = '#B86F52', ariaLabel, className }: {
  data: Point[];
  height?: number;
  color?: string;
  ariaLabel: string;
  className?: string;
}) {
  const width = 640;
  const m = { t: 10, r: 10, b: 26, l: 30 };
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const x = scaleLinear().domain([0, Math.max(1, data.length - 1)]).range([m.l, width - m.r]);
  const y = scaleLinear().domain([0, max]).range([height - m.b, m.t]);
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const a = area<[number, number]>().x((p) => p[0]).y0(y(0)).y1((p) => p[1]).curve(curveMonotoneX)(pts) ?? '';
  const l = line<[number, number]>().x((p) => p[0]).y((p) => p[1]).curve(curveMonotoneX)(pts) ?? '';
  const ticks = y.ticks(4).filter((t) => Number.isInteger(t));
  const every = Math.max(1, Math.ceil(data.length / 7));
  return (
    <figure className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="#E9DED0" />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#77716B">
              {t}
            </text>
          </g>
        ))}
        <path d={a} fill={color} opacity="0.14" />
        <path d={l} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.value)} r="9" fill="transparent">
              <title>{`${d.title ?? d.label}: ${d.value}`}</title>
            </circle>
            {i % every === 0 && (
              <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="#77716B">
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">
        {ariaLabel}: {data.map((d) => `${d.title ?? d.label} ${d.value}`).join(', ')}
      </figcaption>
    </figure>
  );
}

/** Tiny decorative spark bars for mock-ups (aria-hidden). */
export function SparkBars({ values, color = '#3B2925', className }: { values: number[]; color?: string; className?: string }) {
  const max = Math.max(1, ...values);
  const w = 100 / values.length;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className} aria-hidden="true">
      {values.map((v, i) => (
        <rect key={i} x={i * w + w * 0.15} width={w * 0.7} y={40 - (v / max) * 38} height={(v / max) * 38} rx="1.2" fill={color} opacity={i === values.length - 1 ? 1 : 0.8} />
      ))}
    </svg>
  );
}
