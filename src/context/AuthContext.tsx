import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ADMIN_CREDENTIAL_DIGEST,
  auth,
  BOOTSTRAPPED_ADMIN_EMAILS,
  db,
} from '../lib/firebase';

const ADMIN_UNLOCK_KEY = 'dv_portal_gate';

async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  const normalized = `${cleanEmail}::${password}`;
  try {
    const hash = await sha256Hex(normalized);
    if (hash) {
      return hash === ADMIN_CREDENTIAL_DIGEST;
    }
  } catch {
    // Fall through if Web Crypto is unavailable
  }
  return false;
}

interface AuthResult {
  ok: boolean;
  adminUnlocked?: boolean;
  error?: string;
  needsEmailAuthEnable?: boolean;
}

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isAdminUnlocked: boolean;
  isVerifiedBootstrappedAdmin: boolean;
  authError: string | null;
  signingIn: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<AuthResult>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncUserProfileDoc(firebaseUser: User) {
  if (!firebaseUser.email) return;
  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const safeName = (
        firebaseUser.displayName ||
        firebaseUser.email.split('@')[0] ||
        'Member'
      ).slice(0, 100);
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        displayName: safeName,
        email: firebaseUser.email.slice(0, 200),
        role: 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('Failed to sync member profile:', err);
  }
}

function getFriendlyAuthError(err: unknown): {
  message: string;
  code: string;
} {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return { code, message: 'Incorrect email or password. Please try again.' };
  }
  if (code === 'auth/user-not-found') {
    return {
      code,
      message: 'No account found with this email. Switch to Create Account to sign up.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      message: 'An account with this email already exists. Sign in instead.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      code,
      message: 'Password must be at least 6 characters long.',
    };
  }
  if (code === 'auth/invalid-email') {
    return { code, message: 'Please enter a valid email address.' };
  }
  if (code === 'auth/too-many-requests') {
    return {
      code,
      message: 'Too many failed attempts. Please wait a moment and try again.',
    };
  }
  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/configuration-not-found' ||
    code === 'auth/admin-restricted-operation'
  ) {
    return {
      code,
      message:
        'Email & Password sign-in is currently unavailable. Please try again later.',
    };
  }
  if (code === 'auth/unauthorized-domain') {
    const host = window.location.hostname;
    return {
      code,
      message: `This domain ("${host}") is not yet authorized in Authentication settings.`,
    };
  }

  return {
    code,
    message: err instanceof Error ? err.message : 'Unable to sign in right now.',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const isVerifiedBootstrappedAdmin = Boolean(
    user &&
      user.email &&
      BOOTSTRAPPED_ADMIN_EMAILS.includes(user.email.toLowerCase())
  );

  useEffect(() => {
    // Release the UI as soon as Firebase Auth answers; the profile sync runs
    // in the background so a slow/blocked Firestore never freezes the site.
    const readyTimer = window.setTimeout(() => setAuthReady(true), 4000);
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setAuthReady(true);
        if (firebaseUser) {
          void syncUserProfileDoc(firebaseUser);
        }
      },
      (error) => {
        console.error('Auth state error:', error);
        setAuthReady(true);
      }
    );

    return () => {
      window.clearTimeout(readyTimer);
      unsubscribe();
    };
  }, []);

  const persistAdminUnlock = (unlocked: boolean) => {
    setIsAdminUnlocked(unlocked);
    try {
      if (unlocked) {
        sessionStorage.setItem(ADMIN_UNLOCK_KEY, '1');
      } else {
        sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
      }
    } catch {
      // Ignore storage access errors
    }
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthResult> => {
    setAuthError(null);
    setSigningIn(true);
    const cleanEmail = email.trim();

    try {
      const matchedAdmin = await verifyAdminCredentials(cleanEmail, password);

      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (cred.user) {
          await syncUserProfileDoc(cred.user);
        }
        persistAdminUnlock(matchedAdmin);
        return { ok: true, adminUnlocked: matchedAdmin };
      } catch (signInErr) {
        const parsed = getFriendlyAuthError(signInErr);

        if (matchedAdmin) {
          // Attempt automatic Firebase account provisioning when first signing in
          if (
            parsed.code === 'auth/user-not-found' ||
            parsed.code === 'auth/invalid-credential' ||
            parsed.code === 'auth/invalid-login-credentials'
          ) {
            try {
              const created = await createUserWithEmailAndPassword(
                auth,
                cleanEmail,
                password
              );
              await updateProfile(created.user, { displayName: 'Dilan' });
              await syncUserProfileDoc(created.user);
            } catch {
              // Proceed to unlock Admin Panel where clear Firebase Auth setup guidance is shown
            }
          }

          persistAdminUnlock(true);
          return {
            ok: true,
            adminUnlocked: true,
            needsEmailAuthEnable:
              parsed.code === 'auth/operation-not-allowed' ||
              parsed.code === 'auth/configuration-not-found',
          };
        }

        return { ok: false, error: parsed.message };
      }
    } finally {
      setSigningIn(false);
    }
  };

  const signUpWithEmail = async (
    displayName: string,
    email: string,
    password: string
  ): Promise<AuthResult> => {
    setAuthError(null);
    setSigningIn(true);
    const cleanEmail = email.trim();
    const cleanName = displayName.trim().slice(0, 100) || cleanEmail.split('@')[0];

    try {
      const matchedAdmin = await verifyAdminCredentials(cleanEmail, password);
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName });
        }
        await syncUserProfileDoc(cred.user);
        persistAdminUnlock(matchedAdmin);
        return { ok: true, adminUnlocked: matchedAdmin };
      } catch (err) {
        const parsed = getFriendlyAuthError(err);
        if (matchedAdmin) {
          // If the admin account already exists, try signing in directly
          if (parsed.code === 'auth/email-already-in-use') {
            try {
              const signed = await signInWithEmailAndPassword(
                auth,
                cleanEmail,
                password
              );
              if (signed.user) {
                await syncUserProfileDoc(signed.user);
              }
            } catch {
              // Still unlock Admin Panel so setup banner is visible
            }
          }
          persistAdminUnlock(true);
          return {
            ok: true,
            adminUnlocked: true,
            needsEmailAuthEnable:
              parsed.code === 'auth/operation-not-allowed' ||
              parsed.code === 'auth/configuration-not-found',
          };
        }
        return { ok: false, error: parsed.message };
      }
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    persistAdminUnlock(false);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAdminUnlocked,
        isVerifiedBootstrappedAdmin,
        authError,
        signingIn,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
