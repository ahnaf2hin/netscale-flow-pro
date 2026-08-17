import React, { useState } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { homeForRole } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";

export default function ChangePassword() {
  const { user, checkUserAuth } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) return setError("Password must be at least 8 characters");
    if (newPassword !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      await netscaleApi.auth.changePassword(newPassword);
      const fresh = await checkUserAuth();
      window.location.href = homeForRole(fresh?.role || user?.role);
    } catch (err) {
      setError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={KeyRound} title="Set a new password" subtitle="Your account was created with a temporary password — choose a new one to continue">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div>
          <Label className="text-xs">New password</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </div>
        <div>
          <Label className="text-xs">Confirm new password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set password & continue"}
        </Button>
      </form>
    </AuthLayout>
  );
}
