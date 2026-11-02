import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useI18n } from '@/i18n';
import { colors, radius, shadow, space } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        variant === 'primary' ? shadow.glow : variant !== 'ghost' && shadow.raiseSm,
        off && styles.buttonDisabled,
        pressed && !off && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
          <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.brand, fg: colors.white, border: colors.brand },
  secondary: { bg: colors.card, fg: colors.brandDark, border: colors.card },
  danger: { bg: colors.card, fg: colors.danger, border: colors.card },
  ghost: { bg: 'transparent', fg: colors.brandDark, border: 'transparent' },
};

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? colors.white : colors.text} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
      {label ? <Text style={styles.muted}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, err } = useI18n();
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.faint} />
      <Text style={styles.stateText}>{err(error)}</Text>
      {onRetry ? <Button title={t.common.retry} variant="secondary" onPress={onRetry} icon="refresh" /> : null}
    </View>
  );
}

export function EmptyView({
  icon = 'leaf-outline',
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.brand} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {hint ? <Text style={styles.stateText}>{hint}</Text> : null}
      {action}
    </View>
  );
}

export function Banner({
  text,
  tone = 'warning',
  icon = 'information-circle-outline',
}: {
  text: string;
  tone?: 'warning' | 'info' | 'danger';
  icon?: IconName;
}) {
  const palette =
    tone === 'danger'
      ? { bg: colors.dangerSoft, fg: colors.danger }
      : tone === 'info'
        ? { bg: colors.brandSoft, fg: colors.brandDark }
        : { bg: colors.warningSoft, fg: colors.warning };
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Ionicons name={icon} size={18} color={palette.fg} />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

export function Badge({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'warning' | 'muted' | 'danger' }) {
  const p = {
    brand: { bg: colors.brandSoft, fg: colors.brandDark },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    muted: { bg: '#eef1ee', fg: colors.muted },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.badgeText, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

export function Stars({
  value,
  size = 16,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: size / 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          disabled={!onChange}
          onPress={() => onChange?.(i)}
          hitSlop={6}
          accessibilityRole={onChange ? 'button' : undefined}
          accessibilityLabel={`${i}`}
        >
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={size} color={colors.star} />
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.muted} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.md + 2,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    ...shadow.raiseSm,
  },
  chipActive: { backgroundColor: colors.brand, ...shadow.glow },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.raise,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md, minHeight: 280 },
  muted: { color: colors.muted },
  stateTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  stateText: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
});
