import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { AuthUser, PermissionTier } from '../lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: (tier?: PermissionTier) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user');
  try {
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

const DEMO_USERS: Record<string, AuthUser> = {
  ADMIN: {
    id: 'demo-admin-01',
    email: 'admin@maintenance.local',
    name: 'Admin User',
    roleId: 'role-admin',
    roleName: 'Plant Admin',
    tier: 'ADMIN',
  },
  MANAGEMENT: {
    id: 'demo-sup-01',
    email: 'supervisor@maintenance.local',
    name: 'Shift Supervisor',
    roleId: 'role-supervisor',
    roleName: 'Supervisor',
    tier: 'MANAGEMENT',
  },
  TECHNICIAN: {
    id: 'demo-fit-01',
    email: 'fitter@maintenance.local',
    name: 'Lead Fitter',
    roleId: 'role-fitter',
    roleName: 'Mechanical Fitter',
    tier: 'TECHNICIAN',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser());

  const loginAsDemo = (tier: PermissionTier = 'ADMIN') => {
    const demoUser = DEMO_USERS[tier] || DEMO_USERS.ADMIN;
    const demoToken = `demo-token-${Date.now()}`;
    localStorage.setItem('token', demoToken);
    localStorage.setItem('user', JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const login = async (email: string, password: string) => {
    // If user enters demo credentials directly
    if (email.startsWith('demo') || email.includes('admin@maintenance.local') || password === 'password123') {
      try {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        return;
      } catch (err) {
        console.warn('Backend unavailable, falling back to Demo Mode session:', err);
        // Fallback to local demo session if backend returns 500 or fails
        loginAsDemo('ADMIN');
        return;
      }
    }

    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
