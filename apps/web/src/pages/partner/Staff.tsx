import { MapPin, Phone, Trash2, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { partnerApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { PhoneInput } from '../../components/PhoneInput';
import { Badge, Empty, ErrorBox, Field, Modal, PageHeader, QueryView, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { phone } from '../../lib/format';
import { normalizePhone } from '../../lib/validation';
import { useLocations } from './hooks';

/** FR-P02: staff accounts, optionally bound to one location. */
export function StaffPage() {
  const { t } = useI18n();
  const { me } = useAuth();
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ['partner', 'staff'], queryFn: partnerApi.staff, select: (d) => d.items });
  const locations = useLocations();
  const [adding, setAdding] = useState(false);
  const remove = useMutation({
    mutationFn: partnerApi.removeStaff,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', 'staff'] }),
  });
  const locName = (id: string | null) => (id ? (locations.data?.find((l) => l.id === id)?.name ?? '—') : t('staff.allLocations'));
  return (
    <>
      <PageHeader
        title={t('staff.title')}
        sub={t('staff.hint')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            + {t('staff.add')}
          </button>
        }
      />
      {remove.error && <ErrorBox error={remove.error} />}
      <QueryView query={staff}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon={Users}>{t('staff.empty')}</Empty>
          ) : (
            <div className="cards">
              {items.map((u) => (
                <article key={u.id} className="card staff-card">
                  <div className="staff-avatar" aria-hidden>
                    {(u.name ?? '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="grow stack-sm">
                    <div className="staff-name">
                      {u.name ?? '—'} {u.id === me?.id && <span className="muted">({t('staff.you')})</span>}
                    </div>
                    <a className="staff-line" href={`tel:${u.phone}`}>
                      <Phone size={15} aria-hidden /> {phone(u.phone)}
                    </a>
                    <div className="staff-line muted">
                      <MapPin size={15} aria-hidden />
                      {u.role === 'PARTNER_OWNER' ? t('staff.allLocations') : locName(u.locationId)}
                    </div>
                    <div>
                      <Badge tone={u.role === 'PARTNER_OWNER' ? 'blue' : 'gray'}>{t(`role.${u.role}` as DictKey)}</Badge>
                    </div>
                  </div>
                  {u.role === 'PARTNER_STAFF' && (
                    <button
                      type="button"
                      className="icon-btn staff-delete"
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                      disabled={remove.isPending}
                      onClick={() => window.confirm(t('staff.removeConfirm', { name: u.name ?? phone(u.phone) })) && remove.mutate(u.id)}
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  )}
                </article>
              ))}
            </div>
          )
        }
      </QueryView>
      {adding && <AddStaffModal onClose={() => setAdding(false)} />}
    </>
  );
}

function AddStaffModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const locations = useLocations();
  const [p, setP] = useState('+996');
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const phoneErr = normalizePhone(p) ? null : t('err.invalid_phone');
  const nameErr = name.trim() ? null : t('err.required');
  const add = useMutation({
    mutationFn: () => partnerApi.addStaff({ phone: normalizePhone(p)!, name: name.trim(), locationId: locationId || null }),
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['partner', 'staff'] });
      onClose();
    },
  });
  const submit = () => {
    setSubmitted(true);
    if (!phoneErr && !nameErr) add.mutate();
  };
  return (
    <Modal
      title={t('staff.add')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={add.isPending} onClick={submit}>
            {t('common.add')}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label={t('common.phone')} error={submitted ? phoneErr : null}>
          <PhoneInput value={p} onChange={setP} />
        </Field>
        <Field label={t('common.name')} error={submitted ? nameErr : null}>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('staff.location')}>
          <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">{t('staff.allLocations')}</option>
            {(locations.data ?? []).filter((l) => l.active).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        {add.error && <ErrorBox error={add.error} />}
      </div>
    </Modal>
  );
}
