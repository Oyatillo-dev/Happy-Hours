import { Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { partnerApi } from '../../api/endpoints';
import { Badge, Empty, PageHeader, QueryView, Stars } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateTime } from '../../lib/format';

export function ReviewsPage() {
  const { t, lang } = useI18n();
  const reviews = useQuery({ queryKey: ['partner', 'reviews'], queryFn: partnerApi.reviews, select: (d) => d.items });
  return (
    <>
      <PageHeader title={t('reviews.title')} />
      <QueryView query={reviews}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon={Star}>{t('reviews.empty')}</Empty>
          ) : (
            <div className="cards">
              {items.map((r) => (
                <article key={r.id} className={`card ${r.isComplaint ? 'is-complaint' : ''}`}>
                  <div className="row-between">
                    <div>
                      <strong>{r.author || t('reviews.anonymous')}</strong>{' '}
                      <span className="muted small">· {t('reviews.order', { number: r.orderNumber })}</span>
                    </div>
                    <span className="muted small">{dateTime(r.createdAt, lang)}</span>
                  </div>
                  <div className="row">
                    <Stars value={r.rating} />
                    {r.isComplaint && <Badge tone="red">{t('reviews.complaint')}</Badge>}
                    {r.complaintStatus && <Badge>{t(`complaintStatus.${r.complaintStatus}` as DictKey)}</Badge>}
                  </div>
                  {r.text && <p>{r.text}</p>}
                  {r.complaintText && <p className="complaint-text">{r.complaintText}</p>}
                  {r.photoUrl && (
                    <a href={r.photoUrl} target="_blank" rel="noreferrer">
                      <img className="review-photo" src={r.photoUrl} alt="" />
                    </a>
                  )}
                  {r.resolution && <p className="muted small">{t('reviews.resolution', { text: r.resolution })}</p>}
                </article>
              ))}
            </div>
          )
        }
      </QueryView>
    </>
  );
}
