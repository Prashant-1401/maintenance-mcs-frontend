import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';
import type { PermissionTier } from '../lib/types';

export function LoginPage() {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@maintenance.local');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setError('Invalid email or password. You can also use Instant Demo Access.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantDemo = (tier: PermissionTier = 'ADMIN') => {
    loginAsDemo(tier);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-8 sm:p-10 shadow-xl shadow-orange-950/5 animate-fade-in">
        {/* Brand Header with Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size="lg" showText={false} />
          <h1 className="mt-4 text-xl font-black text-stone-900 tracking-tight">
            Maintenance <span className="text-orange-600">MCS</span>
          </h1>
          <p className="mt-1 text-xs font-semibold text-stone-400 uppercase tracking-wider">
            Plant Reliability & Maintenance System
          </p>
        </div>

        {/* 1-Click Instant Demo Login Banner */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-4 border border-orange-200/80 shadow-xs text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-orange-900 mb-1">
            <span className="text-sm">⚡</span>
            <span>Instant Demo Access</span>
          </div>
          <p className="text-[11px] text-orange-800/80 mb-3 leading-snug">
            Explore live SAP Fiori launchpad, work orders, and reliability dashboards without setup.
          </p>
          <button
            type="button"
            onClick={() => handleInstantDemo('ADMIN')}
            className="w-full rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:from-orange-500 hover:to-amber-400 hover:shadow-lg hover:shadow-orange-500/30 active:scale-98 transition cursor-pointer"
          >
            Launch as Admin (Full Access) →
          </button>

          {/* Quick Role Selectors */}
          <div className="mt-2.5 pt-2 border-t border-orange-200/60 flex items-center justify-center gap-2 text-[10px]">
            <span className="text-stone-400 font-medium">Or switch role:</span>
            <button
              type="button"
              onClick={() => handleInstantDemo('MANAGEMENT')}
              className="px-2 py-0.5 rounded-md bg-white border border-orange-200 font-bold text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition cursor-pointer"
            >
              Supervisor
            </button>
            <button
              type="button"
              onClick={() => handleInstantDemo('TECHNICIAN')}
              className="px-2 py-0.5 rounded-md bg-white border border-orange-200 font-bold text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition cursor-pointer"
            >
              Fitter
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
            <span className="bg-white px-3 font-bold text-stone-400">Or sign in with email</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Regular Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-bold text-stone-700 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 transition"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-stone-700 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-stone-800 active:scale-98 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
