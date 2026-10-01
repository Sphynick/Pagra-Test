import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { Check, Copy, KeyRound, Loader2, LogOut, Shield, UserCheck, X } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'customer' | 'admin';
  currentUser: User | null;
  isAdmin: boolean;
  onClose: () => void;
  onSuccessAdminRedirect?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'customer',
  currentUser,
  isAdmin,
  onClose,
  onSuccessAdminRedirect,
}) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      if (initialMode === 'admin' && onSuccessAdminRedirect) {
        onSuccessAdminRedirect();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || password.length < 6) {
      setError('Please enter a valid email address and a password of at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      if (authTab === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Ignore verification email errors if already handled
        }
      }
      if (initialMode === 'admin' && onSuccessAdminRedirect) {
        onSuccessAdminRedirect();
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/operation-not-allowed')) {
        setError(
          'Email/Password sign-in is not yet enabled in your Firebase project. Please use "Continue with Google" above, or enable Email/Password in the Firebase Console.'
        );
      } else if (msg.includes('auth/invalid-credential')) {
        setError('Invalid email or password. Please check your credentials or use Google Sign-In.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUid = () => {
    if (!currentUser) return;
    navigator.clipboard.writeText(currentUser.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-[var(--card)] text-[var(--ink)] border-t sm:border border-[var(--line)] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-none flex flex-col">
        {/* Mobile Bottom-Sheet Drag Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-[var(--line)]" />
        </div>

        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--line)]">
          <div>
            <p className="text-xs text-[var(--mute)]">
              {initialMode === 'admin' ? 'PAGRA Admin Access' : 'PAGRA Customer Account'}
            </p>
            <h2 id="auth-modal-title" className="font-display text-2xl font-bold text-[var(--ink)]">
              {currentUser
                ? 'Account Profile'
                : initialMode === 'admin'
                  ? 'Admin Sign In'
                  : authTab === 'signup'
                    ? 'Create Account'
                    : 'Sign In'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--mute)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {currentUser ? (
            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--mute)]">Signed in as</span>
                  <span className="text-xs font-semibold text-[var(--accent)]">
                    {isAdmin ? 'Role: Administrator' : 'Role: Customer'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--ink)] truncate">
                  {currentUser.displayName || currentUser.email}
                </p>

                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-[11px] text-[var(--mute)]">Account UID</span>
                    <span className="block text-xs font-mono-tabular text-[var(--ink)] truncate">
                      {currentUser.uid}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] bg-[var(--card)] border border-[var(--line)] rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedUid ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy UID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  onClose();
                }}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[var(--sale)] border border-[var(--sale)] rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full min-h-[48px] flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 disabled:opacity-60 rounded-lg transition-opacity cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
                <span>Continue with Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-[var(--line)]"></div>
                <span className="shrink mx-3 text-xs text-[var(--mute)]">or Email & Password</span>
                <div className="grow border-t border-[var(--line)]"></div>
              </div>

              {initialMode !== 'admin' && (
                <div className="flex items-center gap-1 p-1 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAuthTab('signin')}
                    className={`flex-1 min-h-[40px] py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      authTab === 'signin'
                        ? 'bg-[var(--ink)] text-[var(--bg)]'
                        : 'text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab('signup')}
                    className={`flex-1 min-h-[40px] py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      authTab === 'signup'
                        ? 'bg-[var(--ink)] text-[var(--bg)]'
                        : 'text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Create account
                  </button>
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-semibold text-[var(--ink)] mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-[var(--ink)] mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={authTab === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-[var(--bg)] border border-[var(--sale)] rounded-lg text-xs text-[var(--sale)] leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[var(--ink)] bg-[var(--card)] hover:bg-[var(--bg)] border border-[var(--ink)] rounded-lg transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-[var(--mute)]" />
                  <span>{authTab === 'signin' ? 'Sign in' : 'Sign up'}</span>
                </button>
              </form>

              {initialMode === 'admin' && (
                <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg flex items-start gap-2.5 text-xs text-[var(--mute)]">
                  <Shield className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                  <span>
                    Admin dashboard writes are protected by Firebase Authentication and Firestore
                    Security Rules (`isAdmin()`).
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
