import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, Loader2, ArrowLeft } from "lucide-react";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/portal/dashboard";
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => base44.auth.loginWithProvider("google", "/portal/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-sm">
        <Link to="/portal" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"><ArrowLeft className="w-4 h-4" /> Back to home</Link>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center mx-auto mb-4"><Wifi className="w-7 h-7 text-white" /></div>
          <h1 className="text-xl font-bold text-slate-900">Customer Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage your account</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>
          <div className="mt-4">
            <Button variant="outline" className="w-full" onClick={handleGoogle}>Sign in with Google</Button>
          </div>
          <div className="mt-4 text-center text-sm text-slate-500 space-y-1">
            <Link to="/forgot-password" className="text-emerald-600 hover:underline block">Forgot password?</Link>
            <p>New customer? <Link to="/register" className="text-emerald-600 hover:underline">Create an account</Link></p>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">Staff? <Link to="/login" className="underline">Admin login</Link></p>
      </div>
    </div>
  );
}