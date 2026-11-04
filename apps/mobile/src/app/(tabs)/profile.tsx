import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDeleteAccount, useImpact, useNotifications, useUpdateMe } from '@/api/hooks';
import type { Language } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Loading, SectionTitle, type IconName } from '@/components/ui';
import { fmt, useI18n } from '@/i18n';
import { confirm, notice } from '@/lib/confirm';
import { fmtMoney, fmtPhone } from '@/lib/format';
import { colors, radius, space } from '@/theme';

/** Profile: impact (FR-B11), language (FR-B13), name, logout, account deletion (NFR-06). */
export default function ProfileScreen() {
  const { t, lang, setLang, err } = useI18n();
  const { status, user, signOut } = useAuth();
  const impact = useImpact();
  const notifications = useNotifications();
  const updateMe = useUpdateMe();
  const deleteAccount = useDeleteAccount();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (status === 'loading') return <Loading />;

  const languageCard = (
    <Card style={{ gap: space.sm }}>
      <Text style={styles.label}>{t.profile.language}</Text>
      <View style={styles.langRow}>
        {(['ru', 'ky'] as Language[]).map((l) => (
          <Pressable
            key={l}
            onPress={() => void setLang(l)}
            style={[styles.langBtn, lang === l && styles.langActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked: lang === l }}
          >
            <Text style={[styles.langText, lang === l && styles.langTextActive]}>{t.languages[l]}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );

  if (status === 'guest' || !user) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.guest}>
          <View style={styles.guestIcon}>
            <Ionicons name="leaf" size={36} color={colors.brand} />
          </View>
          <Text style={styles.guestTitle}>{t.profile.guestTitle}</Text>
          <Text style={styles.guestHint}>{t.profile.guestHint}</Text>
          <Button title={t.common.login} onPress={() => router.push('/login')} style={{ alignSelf: 'stretch' }} />
        </Card>
        {languageCard}
      </ScrollView>
    );
  }

  const unread = notifications.data?.unread ?? 0;
  const saveName = () => {
    const v = name.trim();
    if (!v) return;
    updateMe.mutate({ name: v }, { onSuccess: () => setEditing(false), onError: (e) => notice(err(e)) });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={{ gap: space.md }}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {editing ? (
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={80}
                placeholder={t.login.namePlaceholder}
                style={styles.nameInput}
                onSubmitEditing={saveName}
                returnKeyType="done"
              />
            ) : (
              <Text style={styles.name}>{user.name || t.profile.noName}</Text>
            )}
            <Text style={styles.phone}>{fmtPhone(user.phone)}</Text>
          </View>
          {editing ? (
            <Pressable onPress={saveName} hitSlop={8} accessibilityLabel={t.common.save}>
              <Ionicons name="checkmark-circle" size={28} color={colors.brand} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                setName(user.name ?? '');
                setEditing(true);
              }}
              hitSlop={8}
              accessibilityLabel={t.profile.edit}
            >
              <Ionicons name="create-outline" size={22} color={colors.brandDark} />
            </Pressable>
          )}
        </View>
      </Card>

      <View>
        <SectionTitle>{t.profile.impactTitle}</SectionTitle>
        <View style={styles.impactGrid}>
          <Impact icon="cube-outline" value={impact.data ? String(impact.data.boxes) : '—'} label={t.profile.boxes} />
          <Impact
            icon="restaurant-outline"
            value={impact.data ? String(impact.data.foodKg).replace('.', ',') : '—'}
            label={t.profile.foodKg}
          />
          <Impact icon="wallet-outline" value={impact.data ? fmtMoney(t, impact.data.savedKgs) : '—'} label={t.profile.saved} />
          <Impact
            icon="cloud-outline"
            value={impact.data ? String(impact.data.co2Kg).replace('.', ',') : '—'}
            label={t.profile.co2}
          />
        </View>
      </View>

      <Card style={{ padding: 0 }}>
        <MenuItem
          icon="notifications-outline"
          label={t.profile.notifications}
          badge={unread > 0 ? String(unread) : undefined}
          onPress={() => router.push('/notifications')}
        />
        <View style={styles.sep} />
        <MenuItem icon="heart-outline" label={t.profile.favorites} onPress={() => router.push('/favorites')} />
      </Card>

      {languageCard}

      <View style={{ gap: space.sm }}>
        <Button
          title={t.profile.logout}
          variant="secondary"
          icon="log-out-outline"
          onPress={async () => {
            if (await confirm(t.profile.logoutConfirm, '', { ok: t.profile.logout, cancel: t.common.cancel })) {
              await signOut();
            }
          }}
        />
        <Button
          title={t.profile.deleteAccount}
          variant="danger"
          icon="trash-outline"
          loading={deleteAccount.isPending}
          onPress={async () => {
            const ok = await confirm(
              t.profile.deleteConfirmTitle,
              t.profile.deleteConfirmText,
              { ok: t.profile.deleteAccount, cancel: t.common.cancel },
              true,
            );
            if (!ok) return;
            deleteAccount.mutate(undefined, {
              onSuccess: () => notice(t.profile.deleted),
              onError: (e) => notice(err(e)),
            });
          }}
        />
      </View>
      <Text style={styles.version}>{fmt(t.profile.version, { v: Constants.expoConfig?.version ?? '1.0.0' })}</Text>
    </ScrollView>
  );
}

function Impact({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.impact}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <Text style={styles.impactValue}>{value}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, badge, onPress }: { icon: IconName; label: string; badge?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menu, pressed && { backgroundColor: colors.inset }]}>
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={styles.menuText}>{label}</Text>
      {badge ? (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
  guest: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  guestIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  guestHint: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  langRow: { flexDirection: 'row', gap: space.sm },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  langActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  langText: { fontSize: 15, color: colors.text },
  langTextActive: { color: colors.brandDark, fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    borderBottomWidth: 1,
    borderColor: colors.brand,
    paddingVertical: 2,
  },
  phone: { fontSize: 14, color: colors.muted, marginTop: 2 },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  impact: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 2,
  },
  impactValue: { fontSize: 22, fontWeight: '800', color: colors.brandDark, marginTop: 4 },
  impactLabel: { fontSize: 12, color: colors.muted },
  menu: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  menuText: { flex: 1, fontSize: 16, color: colors.text },
  menuBadge: { backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' },
  menuBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  version: { textAlign: 'center', color: colors.faint, fontSize: 12 },
});
