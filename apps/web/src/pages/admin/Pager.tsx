import { useI18n } from '../../i18n';

/** Offset pagination; `total` may be unknown (then "next" is shown while the page is full). */
export function Pager({
  offset,
  limit,
  total,
  count,
  onChange,
}: {
  offset: number;
  limit: number;
  total?: number;
  count?: number;
  onChange: (offset: number) => void;
}) {
  const { t } = useI18n();
  const hasNext = total !== undefined ? offset + limit < total : (count ?? 0) >= limit;
  if (offset === 0 && !hasNext) return total !== undefined ? <p className="muted small">{t('common.total', { n: total })}</p> : null;
  return (
    <div className="pager">
      <button type="button" className="btn btn-sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
        ‹ {t('common.prev')}
      </button>
      <span className="muted small">
        {offset + 1}–{offset + (count ?? limit)}
        {total !== undefined ? ` / ${total}` : ''}
      </span>
      <button type="button" className="btn btn-sm" disabled={!hasNext} onClick={() => onChange(offset + limit)}>
        {t('common.next')} ›
      </button>
    </div>
  );
}
