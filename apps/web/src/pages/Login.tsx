import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { LangSwitch } from '../components/LangSwitch';
import { ErrorBox, Field } from '../components/ui';
import { useI18n } from '../i18n';
import { phone as fmtPhone } from '../lib/format';
import { normalizePhone } from '../lib/validation';

export function LoginPage() {
  const { t, lang } = useI18n();
  const { login } = useAuth();
  const [phoneInput, setPhoneInput] = useState('+996');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState<{ phone: string; devCode?: string } | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: (p: string) => authApi.requestOtp(p),
    onSuccess: (res) => {
      setSent({ phone: res.phone, devCode: res.devCode });
      setCode('');
    },
  });
  const verify = useMutation({
    mutationFn: () =>
      authApi.verify({ phone: sent!.phone, code, name: name.trim() || undefined, language: lang }),
    onSuccess: (res) => login({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user),
  });

  const onRequest = (e: FormEvent) => {
    e.preventDefault();
    const p = normalizePhone(phoneInput);
    if (!p) return setPhoneError(t('err.invalid_phone'));
    setPhoneError(null);
    request.mutate(p);
  };

  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(code)) verify.mutate();
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <div className="brand">
            <img src="/icon.svg" alt="" width={40} height={40} />
            <div>
              <div className="brand-name">{t('app.name')}</div>
              <div className="brand-sub">{t('app.partnerCabinet')}</div>
            </div>
          </div>
          <LangSwitch />
        </div>
        <h1>{t('auth.title')}</h1>

        {!sent ? (
          <form onSubmit={onRequest} className="stack">
            <p className="muted">{t('auth.subtitle')}</p>
            <Field label={t('auth.phone')} error={phoneError}>
              <input
                className="input input-lg"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                value={phoneInput}
                placeholder={t('auth.phonePlaceholder')}
                onChange={(e) => setPhoneInput(e.target.value)}
              />
            </Field>
            {request.error && <ErrorBox error={request.error} />}
            <button className="btn btn-primary btn-lg" disabled={request.isPending}>
              {request.isPending ? t('common.loading') : t('auth.getCode')}
            </button>
            <p className="muted small">{t('auth.demo')}</p>
          </form>
        ) : (
          <form onSubmit={onVerify} className="stack">
            <p className="muted">{t('auth.codeSent', { phone: fmtPhone(sent.phone) })}</p>
            {sent.devCode && (
              <div className="alert alert-info" data-testid="dev-code">
                {t('auth.devCode', { code: sent.devCode })}
              </div>
            )}
            <Field label={t('auth.code')}>
              <input
                className="input input-lg code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </Field>
            <Field label={`${t('auth.name')} (${t('common.optional')})`}>
              <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </Field>
            {verify.error && <ErrorBox error={verify.error} />}
            <button className="btn btn-primary btn-lg" disabled={verify.isPending || code.length !== 6}>
              {verify.isPending ? t('common.loading') : t('auth.login')}
            </button>
            <div className="row-between">
              <button type="button" className="link" onClick={() => setSent(null)}>
                {t('auth.changePhone')}
              </button>
              <button
                type="button"
                className="link"
                disabled={request.isPending}
                onClick={() => request.mutate(sent.phone)}
              >
                {t('auth.getCode')}
              </button>
            </div>
            {request.error && <ErrorBox error={request.error} />}
          </form>
        )}
      </div>
    </div>
  );
}
