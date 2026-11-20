import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthSuccess?: (result: { adminUnlocked?: boolean }) => void;
}

export function AuthModal({ open, onClose, onAuthSuccess }: AuthModalProps) {
  const { signingIn, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const resetAndClose = () => {
    setError(null);
    setPassword('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    const result =
      mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(displayName, email, password);

    if (result.ok) {
      resetAndClose();
      onAuthSuccess?.({ adminUnlocked: result.adminUnlocked });
    } else if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-xl p-6 sm:p-7 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="auth-modal-title"
              className="text-xl font-bold text-zinc-950 tracking-tight"
            >
              {mode === 'signin' ? 'Sign in to DroidVault' : 'Create an account'}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {mode === 'signin'
                ? 'Access your saved downloads and member account.'
                : 'Sign up with your email and password in seconds.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close sign in dialog"
            onClick={resetAndClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'signin'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'signup'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="px-3.5 py-2.5 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg leading-relaxed"
          >
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-zinc-700 mb-1"
              >
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Perera"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-zinc-700 mb-1"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-zinc-700 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={signingIn}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {signingIn
              ? 'Please wait...'
              : mode === 'signin'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
