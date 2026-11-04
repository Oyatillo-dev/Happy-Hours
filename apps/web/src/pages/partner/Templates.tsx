import { Package } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { upload } from '../../api/client';
import { partnerApi } from '../../api/endpoints';
import { BOX_CATEGORIES, type BoxCategory, type BoxTemplate } from '../../api/types';
import { Badge, Empty, ErrorBox, Field, Modal, PageHeader, QueryView, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { money } from '../../lib/format';
import { priceError, rules } from '../../lib/validation';
import { useTemplates } from './hooks';

/** FR-P03: box templates. */
export function TemplatesPage() {
  const { t } = useI18n();
  const templates = useTemplates();
  const [editing, setEditing] = useState<BoxTemplate | 'new' | null>(null);
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (x: BoxTemplate) => partnerApi.updateTemplate(x.id, { active: !x.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', 'templates'] }),
  });
  return (
    <>
      <PageHeader
        title={t('templates.title')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            + {t('templates.new')}
          </button>
        }
      />
      {toggle.error && <ErrorBox error={toggle.error} />}
      <QueryView query={templates}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon={Package}>{t('templates.empty')}</Empty>
          ) : (
            <div className="cards">
              {items.map((x) => (
                <article key={x.id} className={`card template-card ${x.active ? '' : 'is-cancelled'}`}>
                  {x.photoUrl ? <img className="template-photo" src={x.photoUrl} alt="" /> : <div className="template-photo thumb-empty"><Package size={32} strokeWidth={1.6} aria-hidden /></div>}
                  <div className="stack-sm">
                    <div className="row-between">
                      <h3>{x.title}</h3>
                      {!x.active && <Badge>{t('common.inactive')}</Badge>}
                    </div>
                    <div className="muted small">{t(`boxCategory.${x.category}` as DictKey)} · {x.weightKg} {t('common.kg')}</div>
                    <div>
                      <strong>{money(x.priceKgs)}</strong> <s className="muted">{money(x.valueKgs)}</s>{' '}
                      <Badge tone="green">{t('templates.discount', { pct: Math.round((1 - x.priceKgs / x.valueKgs) * 100) })}</Badge>
                    </div>
                    {x.description && <p className="small">{x.description}</p>}
                    {x.allergens && <p className="muted small">⚠ {x.allergens}</p>}
                    <div className="row">
                      <button type="button" className="btn btn-sm" onClick={() => setEditing(x)}>
                        {t('common.edit')}
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggle.mutate(x)}>
                        {x.active ? t('common.disable') : t('common.enable')}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        }
      </QueryView>
      {editing && <TemplateModal template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateModal({ template, onClose }: { template: BoxTemplate | null; onClose: () => void }) {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState({
    title: template?.title ?? '',
    category: (template?.category ?? 'BAKERY') as BoxCategory,
    description: template?.description ?? '',
    allergens: template?.allergens ?? '',
    priceKgs: String(template?.priceKgs ?? 150),
    valueKgs: String(template?.valueKgs ?? 400),
    weightKg: String(template?.weightKg ?? 1),
    photoUrl: template?.photoUrl ?? null,
  });
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);

  const price = Number(d.priceKgs);
  const value = Number(d.valueKgs);
  const weight = Number(d.weightKg.replace(',', '.'));
  const errs = {
    title: d.title.trim().length < 2 ? t('err.min_length', { n: 2 }) : null,
    price: !Number.isInteger(price) ? t('err.invalid_number') : priceError(price, value) === 'err.price_too_low' ? t('err.price_too_low', { min: rules.minPriceKgs }) : null,
    value: !Number.isInteger(value) ? t('err.invalid_number') : priceError(price, value) === 'err.value_too_low' ? t('err.value_too_low', { multiplier: rules.minValueMultiplier }) : null,
    weight: !Number.isFinite(weight) || weight <= 0 || weight > rules.maxWeightKg ? t('err.invalid_number') : null,
  };
  const invalid = Object.values(errs).some(Boolean);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: d.title.trim(),
        category: d.category,
        description: d.description.trim(),
        allergens: d.allergens.trim(),
        priceKgs: price,
        valueKgs: value,
        weightKg: weight,
        photoUrl: d.photoUrl,
      };
      return template ? partnerApi.updateTemplate(template.id, body) : partnerApi.createTemplate(body);
    },
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['partner', 'templates'] });
      onClose();
    },
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) return setUploadError('err.file_too_large');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setUploadError('err.unsupported_file_type');
    setUploading(true);
    try {
      const { url } = await upload(file);
      setD((prev) => ({ ...prev, photoUrl: url }));
    } catch (e) {
      setUploadError(e);
    } finally {
      setUploading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!invalid) save.mutate();
  };
  const show = (s: string | null) => (submitted ? s : null);
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.target.value });

  return (
    <Modal
      title={template ? t('templates.edit') : t('templates.new')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="tpl-form" className="btn btn-primary" disabled={save.isPending || uploading}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="tpl-form" className="stack" onSubmit={submit} noValidate>
        <div className="grid-2">
          <Field label={t('templates.titleField')} error={show(errs.title)}>
            <input className="input" value={d.title} maxLength={80} onChange={set('title')} />
          </Field>
          <Field label={t('templates.category')}>
            <select className="input" value={d.category} onChange={set('category')}>
              {BOX_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`boxCategory.${c}` as DictKey)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t('templates.description')}>
          <textarea className="input" rows={2} maxLength={500} value={d.description} placeholder={t('templates.descriptionPh')} onChange={set('description')} />
        </Field>
        <Field label={t('templates.allergens')}>
          <input className="input" maxLength={200} value={d.allergens} placeholder={t('templates.allergensPh')} onChange={set('allergens')} />
        </Field>
        <div className="grid-3">
          <Field label={t('templates.price')} error={show(errs.price)}>
            <input className="input" type="number" inputMode="numeric" min={rules.minPriceKgs} value={d.priceKgs} onChange={set('priceKgs')} />
          </Field>
          <Field label={t('templates.value')} error={show(errs.value)}>
            <input className="input" type="number" inputMode="numeric" value={d.valueKgs} onChange={set('valueKgs')} />
          </Field>
          <Field label={t('templates.weight')} error={show(errs.weight)}>
            <input className="input" inputMode="decimal" value={d.weightKg} onChange={set('weightKg')} />
          </Field>
        </div>
        <p className="field-hint">{t('templates.priceHint')}</p>
        <Field label={t('templates.photo')}>
          <div className="row">
            {d.photoUrl && <img className="thumb" src={d.photoUrl} alt="" />}
            <span className="btn btn-sm file-btn">
              {uploading ? t('templates.uploading') : t('templates.upload')}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void onFile(e.target.files?.[0])} />
            </span>
            {d.photoUrl && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setD({ ...d, photoUrl: null })}>
                {t('templates.removePhoto')}
              </button>
            )}
          </div>
        </Field>
        {uploadError !== null && <p className="field-error">{errorText(uploadError)}</p>}
        {save.error && <ErrorBox error={save.error} />}
      </form>
    </Modal>
  );
}
