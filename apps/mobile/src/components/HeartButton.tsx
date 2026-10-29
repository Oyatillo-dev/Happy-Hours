import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useToggleFavorite } from '@/api/hooks';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { notice } from '@/lib/confirm';
import { colors } from '@/theme';

/** FR-B09: favourite toggle for a partner. Guests are sent to login. */
export function HeartButton({
  partnerId,
  active,
  size = 22,
  floating,
}: {
  partnerId: string;
  active: boolean;
  size?: number;
  floating?: boolean;
}) {
  const { status } = useAuth();
  const { t, err } = useI18n();
  const toggle = useToggleFavorite();
  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t.feed.favorites}
      accessibilityState={{ selected: active }}
      onPress={() => {
        if (status !== 'authed') {
          router.push('/login');
          return;
        }
        toggle.mutate(
          { partnerId, favorite: !active },
          { onError: (e) => notice(err(e)) },
        );
      }}
      style={floating ? styles.floating : undefined}
    >
      <Ionicons name={active ? 'heart' : 'heart-outline'} size={size} color={active ? '#e0475b' : floating ? colors.text : colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floating: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
