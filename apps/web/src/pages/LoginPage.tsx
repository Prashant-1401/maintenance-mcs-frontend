import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { login } = useAuth();
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
      navigate('/');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-8 sm:p-10 shadow-xl shadow-orange-950/5 animate-fade-in"
      >
        {/* Brand Header with Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size="lg" showText={false} />
          <h1 className="mt-4 text-xl font-black text-stone-900 tracking-tight">
            Maintenance <span className="text-orange-600">MCS</span>
          </h1>
          <p className="mt-1 text-xs font-semibold text-stone-400 uppercase tracking-wider">
            Plant Reliability & Maintenance System
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-stone-700 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 transition"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-stone-700 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 py-3 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:from-orange-500 hover:to-amber-400 hover:shadow-lg hover:shadow-orange-500/30 active:scale-98 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In to Plant Portal'}
          </button>
        </div>

        <div className="mt-8 border-t border-stone-100 pt-5 text-center">
          <p className="text-[11px] text-stone-400 font-medium leading-relaxed">
            Demo roles: <span className="font-semibold text-stone-600">admin@</span>,{' '}
            <span className="font-semibold text-stone-600">head@</span>,{' '}
            <span className="font-semibold text-stone-600">supervisor@</span>,{' '}
            <span className="font-semibold text-stone-600">fitter@maintenance.local</span>
            <br />
            Password:{' '}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-700 font-mono text-[10px]">
              password123
            </code>
          </p>
        </div>
      </form>
    </div>
  );
}
