import React from 'react';
import { Cloud, LogOut, ShieldCheck, X } from 'lucide-react';
import type { User } from 'firebase/auth';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  authError: string | null;
  onClearError: () => void;
  onGoogleSignIn: () => Promise<void>;
  onAppleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  user,
  authError,
  onClearError,
  onGoogleSignIn,
  onAppleSignIn,
  onSignOut,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Cloud Sync &amp; Account</h2>
            <p className="text-sm text-[#5B635E] dark:text-[#9BA39D] mt-1">
              Sync tasks, diet logs, workouts, and gifting reminders seamlessly across desktop, iOS, and Android.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#5B635E] hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
            aria-label="Close account modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {authError && (
          <div className="rounded-xl border border-[#B91C1C]/30 bg-[#B91C1C]/10 p-3.5 text-xs text-[#B91C1C] dark:text-[#E67676] space-y-2">
            <p>{authError}</p>
            <button
              type="button"
              onClick={onClearError}
              className="underline font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C]">
              <img
                src={user.photoURL || '/src/assets/images/avatar_planner_profile_1795259653485.jpg'}
                alt={user.displayName || 'Account avatar'}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border border-[#E6E4DC] dark:border-[#2A302C]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{user.displayName || 'Verdant Member'}</p>
                <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] truncate">{user.email}</p>
              </div>
              <Cloud className="w-5 h-5 text-[#3A5A40] dark:text-[#74A17B] shrink-0" />
            </div>

            <button
              type="button"
              onClick={async () => {
                await onSignOut();
                onClose();
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={async () => {
                await onGoogleSignIn();
                onClose();
              }}
              className="w-full min-h-[44px] flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={onAppleSignIn}
              className="w-full min-h-[44px] flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#1C211E] dark:bg-[#F0F2EF] text-white dark:text-[#121513] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
              </svg>
              <span>Continue with Apple</span>
            </button>

            <div className="flex items-start gap-2.5 pt-2 text-xs text-[#5B635E] dark:text-[#9BA39D]">
              <ShieldCheck className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B] shrink-0 mt-0.5" />
              <span>
                Your existing local planner items automatically sync into your private Firebase account upon sign-in.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
