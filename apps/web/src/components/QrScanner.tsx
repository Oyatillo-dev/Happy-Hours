import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

const ELEMENT_ID = 'hh-qr-reader';

/**
 * Camera QR scanner on top of html5-qrcode (loaded lazily so it does not weigh on
 * other screens). Calls onScan once per detected code; the parent decides when to stop.
 */
export function QrScanner({ onScan, onError }: { onScan: (text: string) => void; onError: () => void }) {
  const { t } = useI18n();
  const cb = useRef(onScan);
  cb.current = onScan;
  const errCb = useRef(onError);
  errCb.current = onError;
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    let last = '';
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false });
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } },
          (text) => {
            if (text === last) return;
            last = text;
            setTimeout(() => (last = ''), 3000);
            cb.current(text);
          },
          () => undefined,
        );
        if (cancelled) await scanner.stop().catch(() => undefined);
        else setStarting(false);
      } catch {
        if (!cancelled) errCb.current();
      }
    })();
    return () => {
      cancelled = true;
      if (scanner?.isScanning) void scanner.stop().catch(() => undefined);
    };
  }, []);

  return (
    <div className="scanner">
      <div id={ELEMENT_ID} className="scanner-view" />
      <p className="muted center">{starting ? t('common.loading') : t('issue.scanHint')}</p>
    </div>
  );
}

/** The QR holds the order's qrToken; tolerate URL / prefixed payloads by taking the last segment. */
export function parseQrPayload(text: string): { qrToken: string } | { code: string } {
  const trimmed = text.trim();
  if (/^\d{6}$/.test(trimmed)) return { code: trimmed };
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('qrToken') ?? url.searchParams.get('token');
    if (fromQuery) return { qrToken: fromQuery };
    const seg = url.pathname.split('/').filter(Boolean).pop();
    if (seg) return { qrToken: seg };
  } catch {
    /* not a URL */
  }
  const parts = trimmed.split(':');
  return { qrToken: parts[parts.length - 1] ?? trimmed };
}
