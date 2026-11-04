import { Camera, Check, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { partnerApi } from '../../api/endpoints';
import type { IssuedOrder } from '../../api/types';
import { QrScanner, parseQrPayload } from '../../components/QrScanner';
import { useI18n } from '../../i18n';
import { time, today } from '../../lib/format';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

/** FR-P07: issue an order by scanning the buyer's QR (qrToken) or typing the 6-digit code. */
export function IssuePage() {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [result, setResult] = useState<{ ok: true; order: IssuedOrder } | { ok: false; error: unknown } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const issue = useMutation({
    mutationFn: partnerApi.issue,
    onSuccess: (order) => {
      setResult({ ok: true, order });
      setCode('');
      setScanning(false);
      navigator.vibrate?.(120);
      void qc.invalidateQueries({ queryKey: ['partner', 'orders'] });
    },
    onError: (error) => {
      setResult({ ok: false, error });
      navigator.vibrate?.([60, 60, 60]);
    },
  });

  const queue = useQuery({
    queryKey: ['partner', 'orders', today()],
    queryFn: () => partnerApi.orders(today()),
    select: (d) => d.items.filter((o) => o.status === 'PAID' || o.status === 'READY'),
    refetchInterval: 30_000,
  });

  const submitCode = (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setResult({ ok: false, error: 'err.code_format' });
      return;
    }
    issue.mutate({ code });
  };

  const onScan = (text: string) => {
    if (issue.isPending) return;
    issue.mutate(parseQrPayload(text));
  };

  const press = (k: string) => {
    setResult(null);
    if (k === 'C') setCode('');
    else if (k === '⌫') setCode((c) => c.slice(0, -1));
    else setCode((c) => (c.length < 6 ? c + k : c));
  };

  const reset = () => {
    setResult(null);
    setCode('');
    inputRef.current?.focus();
  };

  return (
    <div className="issue">
      <h1 className="issue-title">{t('issue.title')}</h1>

      {result?.ok && (
        <div className="issue-result ok" role="status" data-testid="issue-result">
          <div className="issue-result-icon">
            <Check size={44} strokeWidth={2.5} />
          </div>
          <div className="issue-result-title">{t('issue.success')}</div>
          <div className="issue-result-number">{result.order.number}</div>
          <div className="issue-result-box">
            {result.order.boxTitle} · {t('issue.boxes', { n: result.order.quantity })}
          </div>
          {result.order.buyerName && <div>{t('issue.buyer', { name: result.order.buyerName })}</div>}
          <button type="button" className="btn btn-xl btn-light" onClick={reset}>
            {t('issue.next')}
          </button>
        </div>
      )}
      {result && !result.ok && (
        <div className="issue-result fail" role="alert" data-testid="issue-result">
          <div className="issue-result-icon">
            <X size={44} strokeWidth={2.5} />
          </div>
          <div className="issue-result-title">{t('issue.failed')}</div>
          <div className="issue-result-box">{errorText(result.error)}</div>
          <button type="button" className="btn btn-xl btn-light" onClick={() => setResult(null)}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {!result?.ok && (
        <>
          {scanning ? (
            <div className="stack">
              <QrScanner
                onScan={onScan}
                onError={() => {
                  setCameraError(true);
                  setScanning(false);
                }}
              />
              <button type="button" className="btn btn-xl" onClick={() => setScanning(false)}>
                {t('issue.stopScan')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-xl issue-scan"
              onClick={() => {
                setCameraError(false);
                setResult(null);
                setScanning(true);
              }}
            >
              <Camera size={20} aria-hidden /> {t('issue.scan')}
            </button>
          )}
          {cameraError && <p className="alert alert-warn">{t('issue.cameraError')}</p>}

          <form className="issue-code" onSubmit={submitCode}>
            <label className="issue-code-label" htmlFor="issue-code">
              {t('issue.code')}
            </label>
            <input
              id="issue-code"
              ref={inputRef}
              className="issue-code-input"
              inputMode="numeric"
              autoComplete="off"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                setResult(null);
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
            />
            <div className="keypad" aria-hidden>
              {KEYS.map((k) => (
                <button key={k} type="button" tabIndex={-1} className={`key ${k === 'C' || k === '⌫' ? 'key-fn' : ''}`} onClick={() => press(k)}>
                  {k}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-xl" disabled={issue.isPending || code.length !== 6}>
              {issue.isPending ? t('common.loading') : t('issue.submit')}
            </button>
          </form>
        </>
      )}

      {queue.data && queue.data.length > 0 && (
        <section className="issue-queue">
          <h2>{t('orders.toIssue', { n: queue.data.length })}</h2>
          <ul>
            {queue.data.map((o) => (
              <li key={o.id}>
                <strong>{o.number}</strong> {o.boxTitle} ×{o.quantity}
                <span className="muted">
                  {' '}
                  · {o.buyerName || '—'} · {t('orders.phoneTail', { tail: o.buyerPhoneTail })} · {time(o.pickupFrom)}–{time(o.pickupTo)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
