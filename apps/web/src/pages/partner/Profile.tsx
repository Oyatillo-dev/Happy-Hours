import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { partnerApi } from '../../api/endpoints';
import { LangSwitch } from '../../components/LangSwitch';
import { ErrorBox, Field, PageHeader, PartnerStatusBadge, QueryView, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateOnly, phone } from '../../lib/format';
import { normalizePhone } from '../../lib/validation';
import { usePartner } from './hooks';

export function ProfilePage() {
  const { t, lang } = useI18n();
  const partner = usePartner();
  return (
    <>
      <PageHeader title={t('profile.title')} />
      <QueryView query={partner}>
        {(p) => (
          <div className="grid-2 align-start">
            <EditForm initial={p} />
            <section className="card stack-sm">
              <h2>{t('profile.legal')}</h2>
              <dl className="dl">
                <dt>{t('common.status')}</dt>
                <dd>
                  <PartnerStatusBadge status={p.status} />
                </dd>
                <dt>{t('ap.legalName')}</dt>
                <dd>{p.legalName}</dd>
                <dt>{t('ap.inn')}</dt>
                <dd className="mono">{p.inn}</dd>
                <dt>{t('apply.category')}</dt>
                <dd>{t(`partnerCategory.${p.category}` as DictKey)}</dd>
                <dt>{t('profile.commission')}</dt>
                <dd>
                  {p.commissionPct}%
                  {p.promoUntil && new Date(p.promoUntil) > new Date() && (
                    <div className="muted small">{t('profile.promoUntil', { date: dateOnly(p.promoUntil, lang) })}</div>
                  )}
                </dd>
              </dl>
              <p className="muted small">{t('profile.legalHint')}</p>
              <h2>{t('profile.language')}</h2>
              <LangSwitch />
            </section>
          </div>
        )}
      </QueryView>
    </>
  );
}

function EditForm({ initial }: { initial: { brandName: string; contactPhone: string; bankName: string; bankAccount: string } }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState(initial);
  useEffect(() => setD(initial), [initial]);
  const [submitted, setSubmitted] = useState(false);
  const errs = {
    brandName: d.brandName.trim().length < 2 ? t('err.min_length', { n: 2 }) : null,
    contactPhone: normalizePhone(d.contactPhone) ? null : t('err.invalid_phone'),
    bankName: d.bankName.trim().length < 2 ? t('err.min_length', { n: 2 }) : null,
    bankAccount: d.bankAccount.trim().length < 10 || d.bankAccount.trim().length > 34 ? t('err.bank_account') : null,
  };
  const save = useMutation({
    mutationFn: () =>
      partnerApi.update({
        brandName: d.brandName.trim(),
        contactPhone: normalizePhone(d.contactPhone)!,
        bankName: d.bankName.trim(),
        bankAccount: d.bankAccount.trim(),
      }),
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['partner', 'profile'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });
  const show = (s: string | null) => (submitted ? s : null);
  return (
    <form
      className="card stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (!Object.values(errs).some(Boolean)) save.mutate();
      }}
    >
      <Field label={t('apply.brandName')} error={show(errs.brandName)}>
        <input className="input" value={d.brandName} maxLength={80} onChange={set('brandName')} />
      </Field>
      <Field label={t('apply.contactPhone')} error={show(errs.contactPhone)} hint={phone(initial.contactPhone)}>
        <input className="input" type="tel" value={d.contactPhone} onChange={set('contactPhone')} />
      </Field>
      <Field label={t('apply.bankName')} error={show(errs.bankName)}>
        <input className="input" value={d.bankName} maxLength={100} onChange={set('bankName')} />
      </Field>
      <Field label={t('apply.bankAccount')} error={show(errs.bankAccount)}>
        <input className="input" value={d.bankAccount} maxLength={34} onChange={set('bankAccount')} />
      </Field>
      {save.error && <ErrorBox error={save.error} />}
      <button className="btn btn-primary" disabled={save.isPending}>
        {t('common.save')}
      </button>
    </form>
  );
}
