import { router } from 'expo-router';
import { useI18n } from '@/i18n';
import { Button, EmptyView, type IconName } from './ui';

export function LoginPrompt({ icon = 'person-circle-outline', title }: { icon?: IconName; title?: string }) {
  const { t } = useI18n();
  return (
    <EmptyView
      icon={icon}
      title={title ?? t.common.loginRequired}
      action={<Button title={t.common.login} onPress={() => router.push('/login')} style={{ minWidth: 200 }} />}
    />
  );
}
