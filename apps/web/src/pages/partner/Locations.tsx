import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { partnerApi } from '../../api/endpoints';
import type { Location } from '../../api/types';
import { Badge, Empty, ErrorBox, Modal, PageHeader, QueryView, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { LocationFields, emptyLocation, toLocationInput, validateLocation, type LocationErrors } from '../LocationFields';
import { useLocations } from './hooks';

/** FR-P02: multiple locations. */
export function LocationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const locations = useLocations();
  const [editing, setEditing] = useState<Location | 'new' | null>(null);
  const toggle = useMutation({
    mutationFn: (l: Location) => partnerApi.updateLocation(l.id, { active: !l.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner'] }),
  });
  return (
    <>
      <PageHeader
        title={t('nav.locations')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            + {t('location.new')}
          </button>
        }
      />
      {toggle.error && <ErrorBox error={toggle.error} />}
      <QueryView query={locations}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon="📍">{t('location.empty')}</Empty>
          ) : (
            <div className="cards">
              {items.map((l) => (
                <article key={l.id} className={`card ${l.active ? '' : 'is-cancelled'}`}>
                  <div className="row-between">
                    <h3>{l.name}</h3>
                    {l.active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}
                  </div>
                  <p>{l.address}</p>
                  <p className="muted small">
                    {t('location.hours')}: {l.openTime}–{l.closeTime} ·{' '}
                    <a href={`https://2gis.kg/bishkek/geo/${l.lng},${l.lat}`} target="_blank" rel="noreferrer">
                      {l.lat.toFixed(4)}, {l.lng.toFixed(4)}
                    </a>
                  </p>
                  <div className="row">
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(l)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggle.mutate(l)}>
                      {l.active ? t('common.disable') : t('common.enable')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        }
      </QueryView>
      {editing && <LocationModal location={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function LocationModal({ location, onClose }: { location: Location | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState(
    location
      ? {
          name: location.name,
          address: location.address,
          lat: String(location.lat),
          lng: String(location.lng),
          openTime: location.openTime,
          closeTime: location.closeTime,
        }
      : { ...emptyLocation },
  );
  const [errors, setErrors] = useState<LocationErrors>({});
  const save = useMutation({
    mutationFn: () => (location ? partnerApi.updateLocation(location.id, toLocationInput(d)) : partnerApi.createLocation(toLocationInput(d))),
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['partner'] });
      onClose();
    },
  });
  const submit = () => {
    const e = validateLocation(d);
    setErrors(e);
    if (!Object.keys(e).length) save.mutate();
  };
  return (
    <Modal
      title={location ? t('location.edit') : t('location.new')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={submit}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <LocationFields value={d} onChange={setD} errors={errors} />
      {save.error && <ErrorBox error={save.error} />}
    </Modal>
  );
}
