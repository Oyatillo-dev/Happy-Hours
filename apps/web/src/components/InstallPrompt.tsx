import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

/** Chrome / Android event that lets the page show the browser's "install app" dialog. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'hh.installDismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
// iPhone and iPad (iPadOS reports itself as a Mac with touch) have no install dialog.
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Suggests adding the cabinet to the home screen: a button on Android / Chrome,
 * and the Share → "Add to Home Screen" hint on iPhone. Hidden once installed or dismissed.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed());
  const ios = isIos();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || (!event && !ios)) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // private mode: the prompt simply comes back next time
    }
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === 'accepted') setHidden(true);
  };

  return (
    <div className="install-prompt" role="region" aria-label={t('pwa.title')}>
      <img src="/icon.svg" alt="" width={44} height={44} />
      <div className="grow">
        <div className="install-title">{t('pwa.title')}</div>
        <div className="install-text">
          {ios ? (
            <>
              {t('pwa.iosBefore')} <Share size={15} aria-label={t('pwa.share')} className="install-inline-icon" />{' '}
              {t('pwa.iosAfter')}
            </>
          ) : (
            t('pwa.text')
          )}
        </div>
      </div>
      {event && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void install()}>
          <Download size={16} aria-hidden /> {t('pwa.install')}
        </button>
      )}
      <button type="button" className="icon-btn" onClick={dismiss} aria-label={t('common.close')}>
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
