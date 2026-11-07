import { useState } from 'react';
import { useI18n } from '../i18n';
import { PhoneInput } from './PhoneInput';
import { Field } from './ui';

/** Banks partners in Kyrgyzstan usually get paid to; anything else goes through "Other". */
export const KG_BANKS = [
  'MBank',
  'O!Bank',
  'Bakai Bank',
  'Optima Bank',
  'Demir Bank',
  'KICB',
  'РСК Банк',
  'Айыл Банк',
  'Элдик Банк',
  'Керемет Банк',
  'Банк Компаньон',
  'FINCA Банк',
];

const OTHER = '__other';

/** Payouts go either to a phone number linked to the bank (+996…) or to a settlement account. */
const isPhoneAccount = (account: string) => account.startsWith('+996');

/**
 * Bank picker plus the payout destination: a phone number with a fixed +996 (MBank, O!Bank…)
 * or a settlement account. Both end up in `bankAccount`, which the API stores as text.
 */
export function BankFields({
  bankName,
  bankAccount,
  onChange,
  bankNameError,
  bankAccountError,
}: {
  bankName: string;
  bankAccount: string;
  onChange: (patch: { bankName?: string; bankAccount?: string }) => void;
  bankNameError?: string | null;
  bankAccountError?: string | null;
}) {
  const { t } = useI18n();
  const [other, setOther] = useState(() => bankName !== '' && !KG_BANKS.includes(bankName));
  const byPhone = bankAccount === '' || isPhoneAccount(bankAccount);
  const [mode, setMode] = useState<'phone' | 'account'>(byPhone ? 'phone' : 'account');

  const switchMode = (next: 'phone' | 'account') => {
    if (next === mode) return;
    setMode(next);
    onChange({ bankAccount: next === 'phone' ? '+996' : '' });
  };

  return (
    <div className="stack">
      <div className="grid-2">
        <Field label={t('apply.bankName')} error={bankNameError}>
          <select
            className="input"
            value={other ? OTHER : bankName}
            onChange={(e) => {
              const v = e.target.value;
              setOther(v === OTHER);
              onChange({ bankName: v === OTHER ? '' : v });
            }}
          >
            <option value="" disabled>
              {t('apply.bankPick')}
            </option>
            {KG_BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            <option value={OTHER}>{t('apply.bankOther')}</option>
          </select>
        </Field>
        {other && (
          <Field label={t('apply.bankOtherName')}>
            <input
              className="input"
              value={bankName}
              maxLength={100}
              autoFocus
              onChange={(e) => onChange({ bankName: e.target.value })}
            />
          </Field>
        )}
      </div>

      <div className="tabs payout-tabs" role="tablist" aria-label={t('apply.payoutBy')}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'phone'}
          className={`tab ${mode === 'phone' ? 'active' : ''}`}
          onClick={() => switchMode('phone')}
        >
          {t('apply.byPhone')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'account'}
          className={`tab ${mode === 'account' ? 'active' : ''}`}
          onClick={() => switchMode('account')}
        >
          {t('apply.byAccount')}
        </button>
      </div>

      {mode === 'phone' ? (
        <Field label={t('apply.payoutPhone')} error={bankAccountError} hint={t('apply.payoutPhoneHint')}>
          <PhoneInput value={bankAccount || '+996'} onChange={(v) => onChange({ bankAccount: v })} />
        </Field>
      ) : (
        <Field label={t('apply.bankAccount')} error={bankAccountError}>
          <input
            className="input"
            inputMode="numeric"
            value={bankAccount}
            maxLength={34}
            onChange={(e) => onChange({ bankAccount: e.target.value.replace(/\D/g, '') })}
          />
        </Field>
      )}
    </div>
  );
}
