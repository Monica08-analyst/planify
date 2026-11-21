import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3A5A40] text-white px-4 py-2 text-xs font-medium hover:bg-[#588157] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] bg-white dark:bg-[#1B1F1C] text-[#1C211E] dark:text-[#F0F2EF] px-3.5 py-2 text-xs font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Smartphone className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Install on iPhone or iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-2 rounded-lg text-[#5B635E] hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
                  aria-label="Close install instructions"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-[#5B635E] dark:text-[#9BA39D] list-decimal list-inside">
                <li>Tap the Share button in the Safari toolbar.</li>
                <li>Scroll down and choose Add to Home Screen.</li>
                <li>Tap Add to run Verdant Day offline in standalone mode.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-5 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-[#1C211E] dark:bg-[#F0F2EF] text-white dark:text-[#121513] px-4 py-2.5 text-xs font-medium shadow-lg"
    >
      <WifiOff className="w-4 h-4 text-[#E39B4D]" />
      <span>Offline Mode — Changes saved locally &amp; sync on reconnect</span>
    </div>
  );
};
