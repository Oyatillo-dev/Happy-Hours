import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { partnerApi } from '../api/endpoints';
import { PARTNER_CATEGORIES, type PartnerCategory, type PartnerWithLocations } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { LangSwitch } from '../components/LangSwitch';
import { BankFields } from '../components/BankFields';
import { PhoneInput } from '../components/PhoneInput';
import { ErrorBox, Field } from '../components/ui';
import { useI18n, type DictKey } from '../i18n';
import { phone } from '../lib/format';
import { bankAccountError, INN, normalizePhone } from '../lib/validation';
import { LocationFields, emptyLocation, toLocationInput, validateLocation, type LocationErrors } from './LocationFields';

interface Draft {
  brandName: string;
  legalName: string;
  inn: string;
  category: PartnerCategory;
  contactPhone: string;
  bankName: string;
  bankAccount: string;
}

type Errors = Partial<Record<keyof Draft, DictKey>>;

/**
 * FR-P01: a logged-in buyer applies to become a partner. With `rejected`, the owner of a
 * rejected application corrects it inside the cabinet and sends it for review again.
 */
export function ApplyPage({ rejected }: { rejected?: PartnerWithLocations }) {
  const { t } = useI18n();
  const { me, logout } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>({
    brandName: rejected?.brandName ?? '',
    legalName: rejected?.legalName ?? '',
    inn: rejected?.inn ?? '',
    category: rejected?.category ?? 'BAKERY',
    contactPhone: rejected?.contactPhone ?? me?.phone ?? '+996',
    bankName: rejected?.bankName ?? '',
    bankAccount: rejected?.bankAccount ?? '+996',
  });
  const firstLocation = rejected?.locations[0];
  const [loc, setLoc] = useState(
    firstLocation
      ? {
          name: firstLocation.name,
          address: firstLocation.address,
          lat: String(firstLocation.lat),
          lng: String(firstLocation.lng),
          openTime: firstLocation.openTime,
          closeTime: firstLocation.closeTime,
        }
      : { ...emptyLocation },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [locErrors, setLocErrors] = useState<LocationErrors>({});

  const apply = useMutation({
    mutationFn: rejected ? partnerApi.reapply : partnerApi.apply,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      if (rejected) {
        await qc.invalidateQueries({ queryKey: ['partner'] });
        navigate('/p/status', { replace: true });
      }
    },
  });

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (d.brandName.trim().length < 2) errs.brandName = 'err.required';
    if (d.legalName.trim().length < 2) errs.legalName = 'err.required';
    if (!INN.test(d.inn.trim())) errs.inn = 'err.inn_invalid';
    if (!normalizePhone(d.contactPhone)) errs.contactPhone = 'err.invalid_phone';
    if (d.bankName.trim().length < 2) errs.bankName = 'err.required';
    const acc = d.bankAccount.trim();
    const accErr = bankAccountError(acc);
    if (accErr) errs.bankAccount = accErr;
    const le = validateLocation(loc);
    setErrors(errs);
    setLocErrors(le);
    if (Object.keys(errs).length || Object.keys(le).length) return;
    apply.mutate({
      brandName: d.brandName.trim(),
      legalName: d.legalName.trim(),
      inn: d.inn.trim(),
      category: d.category,
      contactPhone: normalizePhone(d.contactPhone)!,
      bankName: d.bankName.trim(),
      bankAccount: acc,
      location: toLocationInput(loc),
    });
  };

  const err = (k: keyof Draft) => (errors[k] ? t(errors[k]!) : null);

  const form = (
    <form className="stack" onSubmit={submit} noValidate>
      <section className="card stack">
        <h2>{t('apply.company')}</h2>
        <div className="grid-2">
          <Field label={t('apply.brandName')} error={err('brandName')}>
            <input className="input" value={d.brandName} maxLength={80} onChange={set('brandName')} />
          </Field>
          <Field label={t('apply.legalName')} error={err('legalName')}>
            <input className="input" value={d.legalName} maxLength={200} onChange={set('legalName')} />
          </Field>
          <Field label={t('apply.inn')} error={err('inn')}>
            <input
              className="input"
              inputMode="numeric"
              maxLength={14}
              value={d.inn}
              onChange={(e) => setD({ ...d, inn: e.target.value.replace(/\D/g, '') })}
            />
          </Field>
          <Field label={t('apply.category')}>
            <select className="input" value={d.category} onChange={set('category')}>
              {PARTNER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`partnerCategory.${c}` as DictKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('apply.contactPhone')} error={err('contactPhone')}>
            <PhoneInput value={d.contactPhone} onChange={(v) => setD((x) => ({ ...x, contactPhone: v }))} />
          </Field>
        </div>
      </section>
      <section className="card stack">
        <h2>{t('apply.bank')}</h2>
        <BankFields
          bankName={d.bankName}
          bankAccount={d.bankAccount}
          onChange={(patch) => setD((x) => ({ ...x, ...patch }))}
          bankNameError={err('bankName')}
          bankAccountError={err('bankAccount')}
        />
      </section>
      <section className="card stack">
        <h2>{t('apply.location')}</h2>
        <LocationFields value={loc} onChange={setLoc} errors={locErrors} />
      </section>
      {apply.error && <ErrorBox error={apply.error} />}
      <button className="btn btn-primary btn-lg" disabled={apply.isPending}>
        {apply.isPending ? t('common.loading') : t(rejected ? 'apply.resubmit' : 'apply.submit')}
      </button>
    </form>
  );

  if (rejected) {
    return (
      <div className="stack">
        <h1>{t('apply.reapplyTitle')}</h1>
        {rejected.rejectReason && <p className="alert alert-error">{t('status.reason', { reason: rejected.rejectReason })}</p>}
        {form}
      </div>
    );
  }

  return (
    <div className="apply-page">
      <header className="topbar topbar-plain">
        <div className="brand">
          <img src="/icon.svg" alt="" width={32} height={32} />
          <div className="brand-name">{t('app.name')}</div>
        </div>
        <div className="topbar-right">
          <LangSwitch />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void logout()}>
            {t('auth.logout')}
          </button>
        </div>
      </header>
      <main className="content narrow">
        <h1>{t('apply.title')}</h1>
        <p className="muted">{t('apply.subtitle')}</p>
        <p className="alert alert-info">{t('apply.buyerNote', { phone: phone(me?.phone) })}</p>
        {form}
      </main>
    </div>
  );
}
