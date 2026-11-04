import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useI18n } from '@/i18n';
import { colors, fonts, space } from '@/theme';

/**
 * The bank's payment page inside the app. A browser tab on Android does not reliably hand
 * the "back to the app" link over to Expo Go or the app, so the page stays here instead:
 * the sheet closes when the page tries to leave for an app link (exp://, sakta://,
 * intent://), and the order screen closes it as soon as polling sees the order paid.
 */
export function PaymentSheet({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal visible={!!url} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.order.paymentTitle}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            onPress={onClose}
            hitSlop={8}
            style={styles.close}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        {url ? (
          <WebView
            source={{ uri: url }}
            style={styles.web}
            startInLoadingState
            renderLoading={() => <ActivityIndicator style={styles.loading} size="large" color={colors.brand} />}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(req) => {
              if (/^https?:/i.test(req.url)) return true;
              onClose();
              return false;
            }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  title: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  web: { flex: 1, backgroundColor: colors.bg },
  loading: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
