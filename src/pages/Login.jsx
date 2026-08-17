import React, { useState } from 'react';
import { netscaleApi } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { Wifi, Loader2 } from 'lucide-react';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await netscaleApi.auth.loginViaEmailPassword(email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-blue-950/40 p-4">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-900/20 flex items-center justify-center mx-auto mb-4 transition-transform duration-300 hover:scale-105">
            <Wifi className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">ISP Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your account</p>
        </div>

        <div className="glass rounded-xl shadow-xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">{error}</p>}
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <div className="mt-4">
            <GoogleLoginButton redirectTo="/" />
          </div>

          <div className="mt-4 text-center text-sm text-slate-500 space-y-1">
            <Link to="/forgot-password" className="text-blue-600 hover:underline block transition-colors">Forgot password?</Link>
            <p>Don't have an account? <Link to="/register" className="text-blue-600 hover:underline transition-colors">Register</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}