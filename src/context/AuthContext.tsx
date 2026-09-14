import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, AuthConfig } from '../types';
import { fetchAuthConfig, fetchCurrentUser, loginWithGoogle as apiLoginWithGoogle, logout as apiLogout, devLogin as apiDevLogin } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isViewingAsUser: boolean;
  effectiveIsAdmin: boolean;
  isLoading: boolean;
  authConfig: AuthConfig | null;
  toggleViewAsUser: () => void;
  setViewAsUser: (value: boolean) => void;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  devLogin: (role?: 'admin' | 'user', email?: string, name?: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewingAsUser, setIsViewingAsUserState] = useState<boolean>(() => {
    return localStorage.getItem('sakk_cal_view_as_user') === 'true';
  });

  const setViewAsUser = useCallback((val: boolean) => {
    setIsViewingAsUserState(val);
    localStorage.setItem('sakk_cal_view_as_user', val ? 'true' : 'false');
  }, []);

  const toggleViewAsUser = useCallback(() => {
    setViewAsUser(!isViewingAsUser);
  }, [isViewingAsUser, setViewAsUser]);

  const refreshAuth = useCallback(async () => {
    try {
      const [cfg, currentUser] = await Promise.all([
        fetchAuthConfig().catch(() => ({ googleClientId: '', hasGoogleAuth: false, adminConfigured: false })),
        fetchCurrentUser().catch(() => null),
      ]);
      setAuthConfig(cfg);
      setUser(currentUser);
    } catch (err) {
      console.warn('Failed to load initial auth state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const loginWithGoogle = async (credential: string) => {
    setIsLoading(true);
    try {
      const res = await apiLoginWithGoogle(credential);
      setUser(res.user);
      setIsViewingAsUserState(false);
      localStorage.removeItem('sakk_cal_view_as_user');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiLogout();
      setUser(null);
      setIsViewingAsUserState(false);
      localStorage.removeItem('sakk_cal_view_as_user');
    } finally {
      setIsLoading(false);
    }
  };

  const devLogin = async (role: 'admin' | 'user' = 'admin', email?: string, name?: string) => {
    setIsLoading(true);
    try {
      const res = await apiDevLogin(role, email, name);
      setUser(res.user);
      setIsViewingAsUserState(false);
      localStorage.removeItem('sakk_cal_view_as_user');
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = Boolean(user && user.role === 'admin');
  const effectiveIsAdmin = Boolean(isAdmin && !isViewingAsUser);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isViewingAsUser,
        effectiveIsAdmin,
        isLoading,
        authConfig,
        toggleViewAsUser,
        setViewAsUser,
        loginWithGoogle,
        logout,
        devLogin,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

