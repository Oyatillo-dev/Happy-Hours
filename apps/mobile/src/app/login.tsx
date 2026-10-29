import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import type { AuthResponse, User } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Banner, Button } from '@/components/ui';
import { fmt, useI18n } from '@/i18n';
import { fmtPhone, normalizePhone } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space } from '@/theme';

type Step = 'phone' | 'code' | 'name';
const RESEND_SECONDS = 60;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** FR-B01: login by phone + SMS code; new users are asked for a name. */
export default function LoginScreen() {
  const { t, lang, err } = useI18n();
  const { signIn, setUser } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const now = useNow(1000, step === 'code');
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);
  const resendLeft = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  const requestCode = async (target: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: true; phone: string; devCode?: string }>('POST', '/auth/otp/request', {
        body: { phone: target },
        auth: false,
      });
      setPhone(res.phone);
      setDevCode(res.devCode ?? null);
      setSentAt(Date.now());
      setCode('');
      setStep('code');
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = () => {
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setError(t.login.invalidPhone);
      return;
    }
    void requestCode(normalized);
  };

  const verify = async (value = code) => {
    if (value.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<AuthResponse>('POST', '/auth/otp/verify', {
        body: { phone, code: value, language: lang },
        auth: false,
      });
      await signIn(res);
      // The API only stores `language` for new accounts; keep an existing account in sync with the app.
      if (!res.isNew && res.user.language !== lang) {
        void api<User>('PATCH', '/me', { body: { language: lang } }).then(setUser).catch(() => undefined);
      }
      if (res.isNew || !res.user.name) setStep('name');
      else close();
    } catch (e) {
      setError(err(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    const v = name.trim();
    if (!v) {
      close();
      return;
    }
    setBusy(true);
    try {
      setUser(await api<User>('PATCH', '/me', { body: { name: v } }));
      close();
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 250);
  }, [step]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Ionicons name="leaf" size={32} color={colors.white} />
        </View>

        {step === 'phone' ? (
          <>
            <Text style={styles.title}>{t.common.appName}</Text>
            <Text style={styles.subtitle}>{t.login.subtitle}</Text>
            <Text style={styles.label}>{t.login.phone}</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+996</Text>
              <TextInput
                testID="phone-input"
                value={phoneInput}
                onChangeText={(v) => {
                  setPhoneInput(v);
                  setError(null);
                }}
                placeholder="700 123 456"
                placeholderTextColor={colors.faint}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={16}
                style={styles.phoneInput}
                onSubmitEditing={submitPhone}
                autoFocus
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button testID="get-code" title={t.login.getCode} onPress={submitPhone} loading={busy} />
            <Text style={styles.terms}>{t.login.terms}</Text>
          </>
        ) : null}

        {step === 'code' ? (
          <>
            <Text style={styles.title}>{t.login.code}</Text>
            <Text style={styles.subtitle}>{fmt(t.login.codeSent, { phone: fmtPhone(phone) })}</Text>
            {devCode ? <Banner tone="info" icon="key-outline" text={fmt(t.login.devCode, { code: devCode })} /> : null}
            <TextInput
              testID="code-input"
              ref={codeRef}
              value={code}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 4);
                setCode(digits);
                setError(null);
                if (digits.length === 4) void verify(digits);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={colors.faint}
              style={styles.codeInput}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button testID="verify" title={t.login.verify} onPress={() => void verify()} loading={busy} disabled={code.length !== 4} />
            <View style={styles.linksRow}>
              <Pressable onPress={() => setStep('phone')} hitSlop={8}>
                <Text style={styles.link}>{t.login.changePhone}</Text>
              </Pressable>
              {resendLeft > 0 ? (
                <Text style={styles.muted}>{fmt(t.login.resendIn, { s: resendLeft })}</Text>
              ) : (
                <Pressable onPress={() => void requestCode(phone)} hitSlop={8}>
                  <Text style={styles.link}>{t.login.resend}</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : null}

        {step === 'name' ? (
          <>
            <Text style={styles.title}>{t.login.nameTitle}</Text>
            <Text style={styles.subtitle}>{t.login.nameHint}</Text>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              placeholder={t.login.namePlaceholder}
              placeholderTextColor={colors.faint}
              maxLength={80}
              autoFocus
              autoComplete="name"
              style={styles.input}
              onSubmitEditing={() => void saveName()}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button testID="save-name" title={t.login.continue} onPress={() => void saveName()} loading={busy} />
            <Button title={t.login.skip} variant="ghost" onPress={close} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md, backgroundColor: colors.bg, flexGrow: 1 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: space.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: space.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 54,
    gap: space.sm,
  },
  prefix: { fontSize: 18, color: colors.muted, fontWeight: '600' },
  phoneInput: { flex: 1, fontSize: 18, color: colors.text, letterSpacing: 1 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 54,
    fontSize: 18,
    color: colors.text,
  },
  codeInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 64,
    fontSize: 32,
    letterSpacing: 16,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '700',
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  terms: { fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: space.sm },
  linksRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  link: { color: colors.brandDark, fontWeight: '600', fontSize: 14 },
  muted: { color: colors.faint, fontSize: 14 },
});
