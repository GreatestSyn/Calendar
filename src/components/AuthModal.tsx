import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  ShieldCheck,
  User,
  LogOut,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  KeyRound,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    isAdmin,
    isViewingAsUser,
    toggleViewAsUser,
    authConfig,
    loginWithGoogle,
    logout,
    devLogin,
    isLoading,
  } = useAuth();

  const [authError, setAuthError] = useState<string | null>(null);
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [customDevEmail, setCustomDevEmail] = useState('admin@example.com');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initialize and render Google Identity Services button
  useEffect(() => {
    if (!isOpen || user || !authConfig?.googleClientId) return;

    let timeoutId: any = null;

    const initGsi = () => {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id && googleBtnRef.current) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: authConfig.googleClientId,
            callback: async (response: any) => {
              try {
                setAuthError(null);
                await loginWithGoogle(response.credential);
                onClose();
              } catch (err: any) {
                setAuthError(err.message || 'Google sign-in verification failed.');
              }
            },
          });

          googleBtnRef.current.innerHTML = '';
          (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
          });
        } catch (err) {
          console.warn('Failed to render Google button:', err);
        }
      } else {
        timeoutId = setTimeout(initGsi, 200);
      }
    };

    initGsi();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, user, authConfig?.googleClientId, loginWithGoogle, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shadow-2xs">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {user ? 'Account & Permissions' : 'Sign In'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {user ? 'Manage your active session' : 'Google OAuth Authentication'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {authError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Error</p>
                <p>{authError}</p>
              </div>
            </div>
          )}

          {/* User Already Signed In */}
          {user ? (
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-3.5">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-12 h-12 rounded-full border border-slate-300 dark:border-slate-700 shadow-2xs object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</h3>
                    {user.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        <User className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        Viewer
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* Admin Preview Mode Switch */}
              {isAdmin && (
                <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      {isViewingAsUser ? (
                        <EyeOff className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      )}
                      <span>View as Public Visitor</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isViewingAsUser}
                      onClick={toggleViewAsUser}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                        isViewingAsUser ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isViewingAsUser ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isViewingAsUser
                      ? 'Currently viewing the calendar as an unauthenticated visitor. Administrative controls and pending submissions are hidden.'
                      : 'Enable this toggle to preview the calendar exactly as visitors and community members experience it.'}
                  </p>
                </div>
              )}

              {/* Sign Out Button */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    onClose();
                  }}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg transition-colors shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* User Not Signed In */
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Sign in with your Google account. Accounts registered in the administrator allowlist will unlock approval queues, editing, rescheduling, and Telegram broadcast controls.
              </p>

              {/* Google Sign-in Button Container */}
              {authConfig?.hasGoogleAuth ? (
                <div className="flex flex-col items-center justify-center py-3">
                  <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />
                </div>
              ) : (
                /* Google OAuth Client ID Not Yet Configured in .env */
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Google OAuth Setup Needed</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    To enable live Google Sign-in, specify your Google OAuth 2.0 Web Client ID in <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono text-[10px]">.env</code>:
                  </p>
                  <pre className="bg-amber-100/70 dark:bg-amber-900/40 p-2 rounded-lg font-mono text-[10px] text-amber-950 dark:text-amber-200 overflow-x-auto">
                    {`GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"\nADMIN_EMAILS="your.email@gmail.com"`}
                  </pre>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    You can test administrator capabilities right now using the instant testing options below.
                  </p>
                </div>
              )}

              {/* Quick Testing Options Toggle */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDevOptions(!showDevOptions)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>Instant Testing / Dev Mode Options</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {showDevOptions ? 'Hide ▲' : 'Show ▼'}
                  </span>
                </button>

                {showDevOptions && (
                  <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Simulate Email Address:
                      </label>
                      <input
                        type="email"
                        value={customDevEmail}
                        onChange={(e) => setCustomDevEmail(e.target.value)}
                        placeholder="e.g. admin@sakk.org"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                          await devLogin('admin', customDevEmail, 'Admin Tester');
                          onClose();
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Sign in as Admin</span>
                      </button>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                          await devLogin('user', customDevEmail, 'Community Viewer');
                          onClose();
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs"
                      >
                        <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Sign in as Viewer</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

