import { useEffect, useRef, useState } from 'react';

export interface BarDatum {
  label: string;
  value: number;
  /** Text for the hover tooltip */
  tooltip: string;
}

/**
 * Minimal single-series bar chart (hand-rolled SVG): rounded bar tops on a shared
 * baseline, recessive grid, hover tooltip per bar. The title outside names the series.
 */
export function BarChart({ data, height = 180, format = String }: { data: BarDatum[]; height?: number; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = { top: 12, right: 8, bottom: 22, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.max(2, Math.min(28, step - 2));
  const ticks = Number.isInteger(nice / 2) ? [0, nice / 2, nice] : [0, nice];
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 48)));

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img">
        {ticks.map((tk) => {
          const y = pad.top + innerH - (tk / nice) * innerH;
          return (
            <g key={tk}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="chart-grid" />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" className="chart-axis">
                {format(tk)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / nice) * innerH;
          const x = pad.left + i * step + (step - barW) / 2;
          const y = pad.top + innerH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + i * step} y={pad.top} width={step} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  className={`chart-bar ${hover === i ? 'hover' : ''}`}
                  d={`M${x},${pad.top + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${pad.top + innerH} Z`}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="chart-axis">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="chart-tip"
          style={{ left: `${((pad.left + hover * step + step / 2) / width) * 100}%` }}
        >
          {data[hover].tooltip}
        </div>
      )}
    </div>
  );
}

function niceMax(n: number) {
  const pow = 10 ** Math.floor(Math.log10(n));
  const f = n / pow;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return m * pow;
}
