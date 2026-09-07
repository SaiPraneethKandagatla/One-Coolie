import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../context/AuthContext';

/* ============================================================
   ADMIN LOGIN — Operations Console Authentication
   ============================================================ */

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, 'admin');
      navigate('/admin');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Invalid administrator credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <Brand dark sub="Ops Console" />
          <Link
            to="/"
            className="text-xs font-mono text-zinc-500 hover:text-white"
          >
            Exit &rarr;
          </Link>
        </div>

        <div className="border border-zinc-800 rounded-2xl p-7 bg-zinc-950/70 shadow-2xl">
          <h2 className="text-xl font-bold tracking-tight mb-1 text-white">
            System Administration
          </h2>
          <p className="text-xs text-zinc-400 mb-6">
            Authorized station controllers and supervisors only
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@OneCoolie.in"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Master Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-xs"
              >
                {loading ? 'Authenticating...' : 'Enter Operations Console'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[11px] font-mono text-zinc-600">
          OneCoolie Network Dispatch v2.0
        </p>
      </div>
    </div>
  );
}