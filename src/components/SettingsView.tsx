import React, { useRef, useState } from 'react';
import { Bell, Check, Cloud, Download, Moon, Sun, Upload } from 'lucide-react';
import type { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAControls';
import type { ThemePreference, UserSettings } from '../types';

interface SettingsViewProps {
  user: User | null;
  syncStatus: 'guest' | 'syncing' | 'synced' | 'offline';
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  onOpenAuth: () => void;
  onExportBackup: () => void;
  onImportBackup: (rawJson: string) => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  syncStatus,
  settings,
  onUpdateSettings,
  onOpenAuth,
  onExportBackup,
  onImportBackup,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      onShowToast('Browser notifications are unavailable; in-app reminders remain active.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await onUpdateSettings({ notificationsEnabled: true });
      new Notification('Verdant Day', {
        body: 'Custom task & special day reminders are enabled.',
        icon: '/pwa-192x192.png',
      });
      onShowToast('Notifications enabled.');
    } else {
      onShowToast('Permission not granted — in-app reminder banners will still appear.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await onImportBackup(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold">Settings &amp; Sync</h2>
        <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
          Customize theme preferences, reminder notifications, Pro tier preview, and multi-device backups.
        </p>
      </div>

      {/* Account & Cloud Sync */}
      <section className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#EFEDE6] dark:bg-[#232824] shrink-0">
            {!avatarError ? (
              <img
                src={
                  user?.photoURL ||
                  '/src/assets/images/avatar_planner_profile_1795259653485.jpg'
                }
                alt="User profile avatar"
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-semibold">
                VD
              </div>
            )}
          </div>
          <div>
            <p className="text-base font-semibold">
              {user ? user.displayName || 'Verdant Member' : 'Offline Guest Workspace'}
            </p>
            <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
              {user
                ? `${user.email} · Cloud sync: ${syncStatus}`
                : 'Sign in with Google or Apple to enable multi-device Firebase cloud sync'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3A5A40] text-white text-xs font-medium hover:bg-[#588157] min-h-[40px]"
          >
            <Cloud className="w-4 h-4" />
            <span>{user ? 'Manage Account' : 'Sign In (Google / Apple)'}</span>
          </button>
        </div>
      </section>

      {/* Theme & Pro Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
          <div className="flex items-center gap-2">
            {settings.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-[#74A17B]" />
            ) : (
              <Sun className="w-4 h-4 text-[#3A5A40]" />
            )}
            <h3 className="text-base font-semibold">Theme Preferences</h3>
          </div>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
            Calm Wellness Studio palette in warm alabaster stone and deep moss charcoal.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as ThemePreference[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onUpdateSettings({ theme: t })}
                className={`py-2.5 px-3 rounded-xl border text-xs font-medium capitalize transition-colors ${
                  settings.theme === t
                    ? 'bg-[#3A5A40] text-white border-[#3A5A40]'
                    : 'border-[#E6E4DC] dark:border-[#2A302C] hover:bg-[#EFEDE6] dark:hover:bg-[#232824]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Pro Tier Experience</h3>
            <span className="text-xs font-mono text-[#3A5A40] dark:text-[#74A17B]">
              {settings.tierPreview === 'pro' ? 'Pro Active' : 'Free Preview'}
            </span>
          </div>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
            All features are unlocked. Toggle below to compare the Standard Free layout vs. Pro Studio.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdateSettings({ tierPreview: 'pro' })}
              className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                settings.tierPreview === 'pro'
                  ? 'bg-[#3A5A40] text-white border-[#3A5A40]'
                  : 'border-[#E6E4DC] dark:border-[#2A302C]'
              }`}
            >
              {settings.tierPreview === 'pro' && <Check className="w-3.5 h-3.5" />}
              <span>Pro Unlocked</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ tierPreview: 'free' })}
              className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                settings.tierPreview === 'free'
                  ? 'bg-[#1C211E] dark:bg-[#F0F2EF] text-white dark:text-[#121513] border-transparent'
                  : 'border-[#E6E4DC] dark:border-[#2A302C]'
              }`}
            >
              {settings.tierPreview === 'free' && <Check className="w-3.5 h-3.5" />}
              <span>Free Tier Preview</span>
            </button>
          </div>
        </section>
      </div>

      {/* Custom Notifications */}
      <section className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
            <h3 className="text-base font-semibold">Custom Notification Preferences</h3>
          </div>
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="px-3.5 py-2 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-xs font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
          >
            Enable / Test Desktop Alerts
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] cursor-pointer">
            <span className="text-sm font-medium">Reminders Active</span>
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) =>
                onUpdateSettings({ notificationsEnabled: e.target.checked })
              }
              className="accent-[#3A5A40] w-4 h-4"
            />
          </label>

          <div>
            <label htmlFor="set-lead" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
              Default Task Lead Time
            </label>
            <select
              id="set-lead"
              value={settings.defaultReminderLeadMinutes}
              onChange={(e) =>
                onUpdateSettings({ defaultReminderLeadMinutes: Number(e.target.value) })
              }
              className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
            >
              <option value={10}>10 minutes prior</option>
              <option value={15}>15 minutes prior</option>
              <option value={30}>30 minutes prior</option>
              <option value={60}>1 hour prior</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="set-qs" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
                Quiet Start
              </label>
              <input
                id="set-qs"
                type="time"
                value={settings.quietHoursStart || '22:00'}
                onChange={(e) => onUpdateSettings({ quietHoursStart: e.target.value })}
                className="w-full px-2.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="set-qe" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
                Quiet End
              </label>
              <input
                id="set-qe"
                type="time"
                value={settings.quietHoursEnd || '07:00'}
                onChange={(e) => onUpdateSettings({ quietHoursEnd: e.target.value })}
                className="w-full px-2.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-xs font-mono tabular-nums"
              />
            </div>
          </div>
        </div>

        <label className="flex items-start sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] cursor-pointer">
          <div>
            <span className="block text-sm font-medium">Adaptive Smart Reminders</span>
            <span className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mt-0.5">
              Uses historical completion times, activity logs, and quiet hours to suggest optimal task windows and reminder lead times.
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.adaptiveRemindersEnabled !== false}
            onChange={(e) =>
              onUpdateSettings({ adaptiveRemindersEnabled: e.target.checked })
            }
            className="accent-[#3A5A40] w-4 h-4 mt-1 sm:mt-0 shrink-0"
          />
        </label>
      </section>

      {/* Nutrition Targets */}
      <section className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
        <h3 className="text-base font-semibold">Daily Nutrition &amp; Hydration Targets</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label htmlFor="t-kcal" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
              Calories
            </label>
            <input
              id="t-kcal"
              type="number"
              value={settings.calorieTarget}
              onChange={(e) => onUpdateSettings({ calorieTarget: Number(e.target.value) || 2000 })}
              className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="t-pro" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
              Protein (g)
            </label>
            <input
              id="t-pro"
              type="number"
              value={settings.proteinTarget}
              onChange={(e) => onUpdateSettings({ proteinTarget: Number(e.target.value) || 120 })}
              className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="t-carb" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
              Carbs (g)
            </label>
            <input
              id="t-carb"
              type="number"
              value={settings.carbsTarget}
              onChange={(e) => onUpdateSettings({ carbsTarget: Number(e.target.value) || 220 })}
              className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="t-fat" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
              Fats (g)
            </label>
            <input
              id="t-fat"
              type="number"
              value={settings.fatsTarget}
              onChange={(e) => onUpdateSettings({ fatsTarget: Number(e.target.value) || 70 })}
              className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="t-water" className="block text-xs text-[#5B635E] dark:text-[#9BA39D] mb-1">
              Water (glasses)
            </label>
            <input
              id="t-water"
              type="number"
              value={settings.waterTargetGlasses}
              onChange={(e) =>
                onUpdateSettings({ waterTargetGlasses: Number(e.target.value) || 8 })
              }
              className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Data Backup Integration */}
      <section className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold">Data Backup Integration</h3>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-0.5">
            Offline persistent cache is enabled automatically. Download or restore a complete JSON archive anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
          >
            <Download className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
            <span>Download Full Backup (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
          >
            <Upload className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
            <span>Restore from Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </section>
    </div>
  );
};
