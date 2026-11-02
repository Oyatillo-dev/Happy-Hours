import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { partnerApi } from '../../api/endpoints';
import type { Location, PartnerOffer } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { DateNav } from '../../components/DateNav';
import { Badge, Empty, ErrorBox, Field, Modal, PageHeader, QueryView, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { addDays, fromMinutes, money, nowMinutes, time, toMinutes, today } from '../../lib/format';
import { rules, windowError } from '../../lib/validation';
import { useLocations, usePartner, useTemplates } from './hooks';

/** FR-P04…P06: today's boxes — publish, change quantity, cancel. */
export function OffersPage() {
  const { t } = useI18n();
  const [date, setDate] = useState(today());
  const [publishing, setPublishing] = useState(false);
  const [editQty, setEditQty] = useState<PartnerOffer | null>(null);
  const [cancelling, setCancelling] = useState<PartnerOffer | null>(null);
  const partner = usePartner();
  const active = partner.data?.status === 'ACTIVE';

  const offers = useQuery({
    queryKey: ['partner', 'offers', date],
    queryFn: () => partnerApi.offers(date),
    select: (d) => d.items,
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title={t('offers.title')}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            disabled={!active}
            title={active ? undefined : t('offers.notActive')}
            onClick={() => setPublishing(true)}
          >
            + {t('offers.publish')}
          </button>
        }
      />
      <DateNav value={date} onChange={setDate} />
      {!active && partner.data && <p className="alert alert-warn">{t('offers.notActive')}</p>}
      <QueryView query={offers}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon="🥐">{t('offers.empty')}</Empty>
          ) : (
            <div className="cards">
              {items.map((o) => (
                <OfferCard key={o.id} offer={o} onQty={() => setEditQty(o)} onCancel={() => setCancelling(o)} />
              ))}
            </div>
          )
        }
      </QueryView>
      {publishing && <PublishModal defaultDate={date} onClose={() => setPublishing(false)} onDone={setDate} />}
      {editQty && <QuantityModal offer={editQty} onClose={() => setEditQty(null)} />}
      {cancelling && <CancelModal offer={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}

function OfferCard({ offer: o, onQty, onCancel }: { offer: PartnerOffer; onQty: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const cancelled = o.status === 'CANCELLED';
  const remaining = Math.max(o.quantity - o.sold, 0);
  const pctSold = o.quantity ? Math.min(100, Math.round((o.sold / o.quantity) * 100)) : 0;
  const past = new Date(o.pickupTo).getTime() < Date.now();
  return (
    <article className={`card offer-card ${cancelled ? 'is-cancelled' : ''}`}>
      <div className="offer-top">
        {o.template.photoUrl ? (
          <img className="thumb" src={o.template.photoUrl} alt="" />
        ) : (
          <div className="thumb thumb-empty" aria-hidden>
            📦
          </div>
        )}
        <div className="grow">
          <h3>{o.template.title}</h3>
          <div className="muted small">
            {o.location.name}
            {o.scheduleId ? ` · ${t('offers.fromSchedule')}` : ''}
          </div>
          <div className="offer-window">{t('offers.window', { from: time(o.pickupFrom), to: time(o.pickupTo) })}</div>
        </div>
        <div className="offer-price">
          <strong>{money(o.priceKgs)}</strong>
          <s className="muted small">{money(o.valueKgs)}</s>
        </div>
      </div>
      <div className="progress" aria-hidden>
        <div style={{ width: `${pctSold}%` }} />
      </div>
      <div className="row-between small">
        <span>{t('offers.sold', { sold: o.sold, quantity: o.quantity })}</span>
        {cancelled ? <Badge tone="red">{t('offers.cancelled')}</Badge> : <Badge tone={remaining ? 'green' : 'gray'}>{t('offers.remaining', { n: remaining })}</Badge>}
      </div>
      {!cancelled && !past && (
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={onQty}>
            {t('offers.changeQty')}
          </button>
          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={onCancel}>
            {t('offers.cancelOffer')}
          </button>
        </div>
      )}
    </article>
  );
}

function defaultWindow(loc: Location | undefined, date: string) {
  if (!loc) return { from: '20:00', to: '21:00' };
  const close = toMinutes(loc.closeTime);
  const open = toMinutes(loc.openTime);
  let to = close;
  let from = Math.max(open, close - 90);
  if (date === today() && from < nowMinutes() + 5) {
    from = Math.max(open, Math.ceil((nowMinutes() + 5) / 15) * 15);
    to = Math.min(close, from + 60);
  }
  return { from: fromMinutes(from), to: fromMinutes(to) };
}

function PublishModal({ defaultDate, onClose, onDone }: { defaultDate: string; onClose: () => void; onDone: (date: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const { me } = useAuth();
  const templates = useTemplates();
  const locations = useLocations();

  const usableLocations = useMemo(
    () =>
      (locations.data ?? []).filter(
        (l) => l.active && (me?.role !== 'PARTNER_STAFF' || !me.locationId || me.locationId === l.id),
      ),
    [locations.data, me],
  );
  const usableTemplates = (templates.data ?? []).filter((x) => x.active);

  const [templateId, setTemplateId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState(defaultDate < today() ? today() : defaultDate);
  const [quantity, setQuantity] = useState('5');
  const [win, setWin] = useState<{ from: string; to: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const tplId = templateId || usableTemplates[0]?.id || '';
  const locId = locationId || usableLocations[0]?.id || '';
  const loc = usableLocations.find((l) => l.id === locId);
  const w = win ?? defaultWindow(loc, date);

  const qty = Number(quantity);
  const qtyError = !Number.isInteger(qty) || qty < 1 || qty > rules.maxQuantity ? t('err.invalid_number') : null;
  const winErr = windowError(loc, w.from, w.to, date);
  const winText = winErr ? t(winErr, { min: rules.minWindowMinutes, max: rules.maxWindowMinutes }) : null;

  const publish = useMutation({
    mutationFn: () =>
      partnerApi.publishOffer({ templateId: tplId, locationId: locId, date, quantity: qty, pickupFromTime: w.from, pickupToTime: w.to }),
    onSuccess: () => {
      toast(t('offers.published'));
      void qc.invalidateQueries({ queryKey: ['partner', 'offers'] });
      onDone(date);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (qtyError || winErr || !tplId || !locId) return;
    publish.mutate();
  };

  const loading = templates.isLoading || locations.isLoading;
  const tpl = usableTemplates.find((x) => x.id === tplId);

  return (
    <Modal
      title={t('offers.publish')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="publish-form" className="btn btn-primary" disabled={publish.isPending || !tplId || !locId}>
            {publish.isPending ? t('common.loading') : t('offers.publish')}
          </button>
        </>
      }
    >
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : usableTemplates.length === 0 ? (
        <Empty icon="📦">
          {t('offers.noTemplates')}
          {me?.role === 'PARTNER_OWNER' && (
            <div>
              <Link to="/p/templates" onClick={onClose}>
                {t('templates.new')}
              </Link>
            </div>
          )}
        </Empty>
      ) : (
        <form id="publish-form" className="stack" onSubmit={submit} noValidate>
          <Field label={t('offers.template')} hint={tpl ? t('offers.priceValue', { price: money(tpl.priceKgs), value: money(tpl.valueKgs) }) : null}>
            <select className="input" value={tplId} onChange={(e) => setTemplateId(e.target.value)}>
              {usableTemplates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title} — {money(x.priceKgs)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('offers.location')}>
            <select
              className="input"
              value={locId}
              onChange={(e) => {
                setLocationId(e.target.value);
                setWin(null);
              }}
            >
              {usableLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.openTime}–{l.closeTime})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label={t('common.date')}>
              <div className="row">
                <input
                  className="input"
                  type="date"
                  min={today()}
                  value={date}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setDate(e.target.value);
                    setWin(null);
                  }}
                />
              </div>
            </Field>
            <Field label={t('offers.quantity')} error={submitted ? qtyError : null}>
              <input className="input" type="number" inputMode="numeric" min={1} max={500} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
          </div>
          <div className="row">
            <button type="button" className={`chip ${date === today() ? 'active' : ''}`} onClick={() => { setDate(today()); setWin(null); }}>
              {t('common.today')}
            </button>
            <button type="button" className={`chip ${date === addDays(today(), 1) ? 'active' : ''}`} onClick={() => { setDate(addDays(today(), 1)); setWin(null); }}>
              {t('common.tomorrow')}
            </button>
          </div>
          <div className="grid-2">
            <Field label={t('offers.pickupFrom')}>
              <input className="input" type="time" value={w.from} onChange={(e) => setWin({ ...w, from: e.target.value })} />
            </Field>
            <Field label={t('offers.pickupTo')}>
              <input className="input" type="time" value={w.to} onChange={(e) => setWin({ ...w, to: e.target.value })} />
            </Field>
          </div>
          {winText ? (
            <p className={`field-error ${submitted ? '' : 'soft'}`}>{winText}</p>
          ) : (
            loc && <p className="field-hint">{t('offers.windowHint', { open: loc.openTime, close: loc.closeTime })}</p>
          )}
          {publish.error && <ErrorBox error={publish.error} />}
        </form>
      )}
    </Modal>
  );
}

/** Quantity can always change (not below sold); the window only while nobody has booked. */
function QuantityModal({ offer, onClose }: { offer: PartnerOffer; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const locations = useLocations();
  const [value, setValue] = useState(String(offer.quantity));
  const [win, setWin] = useState({ from: time(offer.pickupFrom), to: time(offer.pickupTo) });
  const n = Number(value);
  const err = !Number.isInteger(n) || n < 0 || n > rules.maxQuantity ? t('err.invalid_number') : n < offer.sold ? t('err.quantity_below_sold', { sold: offer.sold }) : null;
  const booked = offer.sold > 0 || offer._count.orders > 0;
  const loc = (locations.data ?? []).find((l) => l.id === offer.location.id);
  const winChanged = win.from !== time(offer.pickupFrom) || win.to !== time(offer.pickupTo);
  const winErr = winChanged ? windowError(loc, win.from, win.to, offer.date) : null;
  const winText = winErr ? t(winErr, { min: rules.minWindowMinutes, max: rules.maxWindowMinutes }) : null;
  const save = useMutation({
    mutationFn: () =>
      partnerApi.updateOffer(offer.id, {
        quantity: n,
        ...(winChanged ? { pickupFromTime: win.from, pickupToTime: win.to } : {}),
      }),
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['partner', 'offers'] });
      onClose();
    },
  });
  return (
    <Modal
      title={t('offers.qtyTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={!!err || !!winErr || save.isPending} onClick={() => save.mutate()}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <p>
        <strong>{offer.template.title}</strong> · {time(offer.pickupFrom)}–{time(offer.pickupTo)}
      </p>
      <div className="stepper">
        <button type="button" className="btn btn-lg" onClick={() => setValue(String(Math.max(offer.sold, n - 1)))} disabled={n <= offer.sold}>
          −
        </button>
        <input className="input input-lg center" type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="button" className="btn btn-lg" onClick={() => setValue(String(n + 1))}>
          +
        </button>
      </div>
      {err ? <p className="field-error">{err}</p> : <p className="field-hint">{t('offers.qtyHint', { sold: offer.sold })}</p>}
      <div className="grid-2">
        <Field label={t('offers.pickupFrom')}>
          <input className="input" type="time" value={win.from} disabled={booked} onChange={(e) => setWin({ ...win, from: e.target.value })} />
        </Field>
        <Field label={t('offers.pickupTo')}>
          <input className="input" type="time" value={win.to} disabled={booked} onChange={(e) => setWin({ ...win, to: e.target.value })} />
        </Field>
      </div>
      {booked ? (
        <p className="field-hint">{t('offers.windowLocked')}</p>
      ) : (
        winText && <p className="field-error">{winText}</p>
      )}
      {save.error && <ErrorBox error={save.error} />}
    </Modal>
  );
}

function CancelModal({ offer, onClose }: { offer: PartnerOffer; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 3;
  const cancel = useMutation({
    mutationFn: () => partnerApi.cancelOffer(offer.id, reason.trim()),
    onSuccess: () => {
      toast(t('offers.cancelled'));
      void qc.invalidateQueries({ queryKey: ['partner'] });
      onClose();
    },
  });
  return (
    <Modal
      title={t('offers.cancelTitle', { title: offer.template.title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.back')}
          </button>
          <button type="button" className="btn btn-danger" disabled={!valid || cancel.isPending} onClick={() => cancel.mutate()}>
            {t('offers.cancelOffer')}
          </button>
        </>
      }
    >
      <p className="alert alert-warn">{t('offers.cancelWarn')}</p>
      {offer.sold > 0 && <p>{t('offers.paidOrders', { n: offer._count.orders })}</p>}
      <Field label={t('common.reason')} error={reason && !valid ? t('err.reason_short') : null}>
        <textarea className="input" rows={3} maxLength={300} value={reason} placeholder={t('offers.cancelReasonPh')} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {cancel.error && <ErrorBox error={cancel.error} />}
    </Modal>
  );
}
