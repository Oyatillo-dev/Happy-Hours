import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { partnerApi } from '../../api/endpoints';
import type { Schedule } from '../../api/types';
import { Badge, Empty, ErrorBox, Field, Modal, PageHeader, QueryView, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { rules, windowError } from '../../lib/validation';
import { useLocations, useTemplates } from './hooks';

const DAYS = [1, 2, 3, 4, 5, 6, 7];

/** FR-P04: recurring schedules by weekday. */
export function SchedulesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const schedules = useQuery({ queryKey: ['partner', 'schedules'], queryFn: partnerApi.schedules, select: (d) => d.items });
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const toggle = useMutation({
    mutationFn: async (s: Schedule): Promise<unknown> =>
      s.active ? partnerApi.deleteSchedule(s.id) : partnerApi.updateSchedule(s.id, { active: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', 'schedules'] }),
  });
  const days = (s: Schedule) => (s.weekdays.length === 7 ? t('schedules.everyday') : s.weekdays.map((d) => t(`weekday.${d}` as DictKey)).join(', '));
  return (
    <>
      <PageHeader
        title={t('schedules.title')}
        sub={t('schedules.subtitle')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            + {t('schedules.new')}
          </button>
        }
      />
      {toggle.error && <ErrorBox error={toggle.error} />}
      <QueryView query={schedules}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon="🗓️">{t('schedules.empty')}</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('offers.template')}</th>
                    <th>{t('offers.location')}</th>
                    <th>{t('schedules.weekdays')}</th>
                    <th>{t('orders.window')}</th>
                    <th className="num">{t('orders.qty')}</th>
                    <th>{t('common.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className={s.active ? '' : 'row-muted'}>
                      <td>{s.template.title}</td>
                      <td>{s.location.name}</td>
                      <td>{days(s)}</td>
                      <td>
                        {s.pickupFromTime}–{s.pickupToTime}
                      </td>
                      <td className="num">{s.quantity}</td>
                      <td>{s.active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('schedules.paused')}</Badge>}</td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm" onClick={() => setEditing(s)}>
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => (!s.active || window.confirm(t('schedules.deleteConfirm'))) && toggle.mutate(s)}
                        >
                          {s.active ? t('common.disable') : t('common.enable')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </QueryView>
      {editing && <ScheduleModal schedule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ScheduleModal({ schedule, onClose }: { schedule: Schedule | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const templates = useTemplates();
  const locations = useLocations();
  const activeTemplates = (templates.data ?? []).filter((x) => x.active || x.id === schedule?.templateId);
  const activeLocations = (locations.data ?? []).filter((l) => l.active || l.id === schedule?.locationId);

  const [templateId, setTemplateId] = useState(schedule?.templateId ?? '');
  const [locationId, setLocationId] = useState(schedule?.locationId ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(schedule?.weekdays ?? DAYS);
  const [quantity, setQuantity] = useState(String(schedule?.quantity ?? 5));
  const [from, setFrom] = useState(schedule?.pickupFromTime ?? '20:00');
  const [to, setTo] = useState(schedule?.pickupToTime ?? '21:00');
  const [submitted, setSubmitted] = useState(false);

  const tplId = templateId || activeTemplates[0]?.id || '';
  const locId = locationId || activeLocations[0]?.id || '';
  const loc = activeLocations.find((l) => l.id === locId);
  const qty = Number(quantity);
  const errs = {
    qty: !Number.isInteger(qty) || qty < 1 || qty > rules.maxQuantity ? t('err.invalid_number') : null,
    days: weekdays.length === 0 ? t('err.weekdays_required') : null,
    win: (() => {
      const k = windowError(loc, from, to);
      return k ? t(k, { min: rules.minWindowMinutes, max: rules.maxWindowMinutes }) : null;
    })(),
  };
  const invalid = Object.values(errs).some(Boolean) || !tplId || !locId;

  const save = useMutation({
    mutationFn: () => {
      const body = { weekdays: [...weekdays].sort(), quantity: qty, pickupFromTime: from, pickupToTime: to };
      return schedule
        ? partnerApi.updateSchedule(schedule.id, body)
        : partnerApi.createSchedule({ ...body, templateId: tplId, locationId: locId });
    },
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['partner', 'schedules'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!invalid) save.mutate();
  };
  const show = (s: string | null) => (submitted ? s : null);

  return (
    <Modal
      title={schedule ? t('schedules.edit') : t('schedules.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="sch-form" className="btn btn-primary" disabled={save.isPending}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="sch-form" className="stack" onSubmit={submit} noValidate>
        <Field label={t('offers.template')}>
          <select className="input" value={tplId} disabled={!!schedule} onChange={(e) => setTemplateId(e.target.value)}>
            {activeTemplates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('offers.location')}>
          <select className="input" value={locId} disabled={!!schedule} onChange={(e) => setLocationId(e.target.value)}>
            {activeLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.openTime}–{l.closeTime})
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('schedules.weekdays')} error={show(errs.days)}>
          <div className="row wrap">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip ${weekdays.includes(d) ? 'active' : ''}`}
                aria-pressed={weekdays.includes(d)}
                onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
              >
                {t(`weekday.${d}` as DictKey)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid-3">
          <Field label={t('offers.quantity')} error={show(errs.qty)}>
            <input className="input" type="number" inputMode="numeric" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label={t('offers.pickupFrom')}>
            <input className="input" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('offers.pickupTo')}>
            <input className="input" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        {errs.win ? (
          <p className={`field-error ${submitted ? '' : 'soft'}`}>{errs.win}</p>
        ) : (
          loc && <p className="field-hint">{t('offers.windowHint', { open: loc.openTime, close: loc.closeTime })}</p>
        )}
        {save.error && <ErrorBox error={save.error} />}
      </form>
    </Modal>
  );
}
