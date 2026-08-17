import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, UserCog, Plus, Copy, Check, KeyRound, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/dashboard/PageHeader";
import ColorStatCard from "@/components/dashboard/ColorStatCard";

const ROLES = [
  { value: "super_admin", label: "Super Admin", description: "Full access to everything, including user management" },
  { value: "staff", label: "Staff", description: "Internal team member — access controlled by the permissions below" },
  { value: "reseller", label: "Reseller", description: "Sees only their own attributed customers, in a separate panel" },
  { value: "customer", label: "Customer", description: "Customer self-service portal only — no admin access" },
];

const FEATURE_LABELS = {
  customers: "Clients", billing: "Billing", hotspot: "Hotspot", mikrotik: "Mikrotik",
  olt: "OLT Management", network: "Network Map", resellers: "Reseller Management (CRM)",
  staff: "HR & Payroll", support: "Support Tickets", sms: "SMS Service",
  accounting: "Accounting", reports: "Reports", configuration: "Configuration",
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [features, setFeatures] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [resellerList, setResellerList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [revealPassword, setRevealPassword] = useState(null); // { email, temp_password }
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({ email: "", full_name: "", role: "staff", permissions: {}, staff_id: "", reseller_id: "" });

  useEffect(() => { loadData(); }, []);

  function defaultPermsForRole(role) {
    if (role === "staff") return Object.fromEntries(features.map((f) => [f, true]));
    if (role === "reseller") return { customers: true, billing: true, support: true };
    return {};
  }

  // Permission checkboxes reflect `form.role`, but that starts as "staff" by default and the
  // user may never touch the role dropdown at all — so defaults must be applied when the form
  // opens (once `features` has loaded), not only reactively on a role *change* event.
  const openCreateForm = () => {
    setForm({ email: "", full_name: "", role: "staff", permissions: defaultPermsForRole("staff"), staff_id: "", reseller_id: "" });
    setShowForm(true);
  };

  const loadData = async () => {
    try {
      const [u, f, s, r] = await Promise.all([
        netscaleApi.adminUsers.list(),
        netscaleApi.adminUsers.features(),
        netscaleApi.entities.Staff.list("-created_date", 200),
        netscaleApi.entities.Reseller.list("-created_date", 200),
      ]);
      setUsers(u);
      setFeatures(f.features || []);
      setStaffList(s);
      setResellerList(r);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const setRole = (role) => {
    setForm({ ...form, role, permissions: defaultPermsForRole(role), staff_id: "", reseller_id: "" });
  };

  const toggleFeature = (f) => setForm({ ...form, permissions: { ...form.permissions, [f]: !form.permissions[f] } });

  const submitCreate = async () => {
    try {
      const payload = { ...form };
      if (form.role !== "staff") delete payload.staff_id;
      if (form.role !== "reseller") delete payload.reseller_id;
      const res = await netscaleApi.adminUsers.create(payload);
      setShowForm(false);
      setForm({ email: "", full_name: "", role: "staff", permissions: {}, staff_id: "", reseller_id: "" });
      setRevealPassword({ email: res.user.email, temp_password: res.temp_password });
      loadData();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const resetPassword = async (user) => {
    try {
      const res = await netscaleApi.adminUsers.resetPassword(user.id);
      setRevealPassword({ email: user.email, temp_password: res.temp_password });
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Delete the account for ${user.email}? This can't be undone.`)) return;
    try {
      await netscaleApi.adminUsers.delete(user.id);
      toast({ title: "User deleted" });
      loadData();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(revealPassword.temp_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const roleBadge = (role) => {
    const map = {
      super_admin: "bg-blue-100 text-blue-700", staff: "bg-emerald-100 text-emerald-700",
      reseller: "bg-amber-100 text-amber-700", customer: "bg-zinc-100 text-zinc-700",
    };
    return map[role] || map.customer;
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  const staffWithoutLogin = staffList.filter((s) => !users.some((u) => u.staff_id === s.id));
  const resellersWithoutLogin = resellerList.filter((r) => !users.some((u) => u.reseller_id === r.id));

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={UserCog} iconBg="bg-blue-600" title="User & Role Management" subtitle="Create accounts and control exactly what each person can access — invite-only, no public signup">
        <Button onClick={openCreateForm}><Plus className="w-4 h-4 mr-1" /> Add User</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ColorStatCard label="Total Users" value={users.length} icon={UserCog} bg="bg-blue-500" iconBg="bg-blue-600" />
        <ColorStatCard label="Staff" value={users.filter((u) => u.role === "staff").length} icon={ShieldCheck} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Resellers" value={users.filter((u) => u.role === "reseller").length} icon={ShieldCheck} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="Customers" value={users.filter((u) => u.role === "customer").length} icon={ShieldCheck} bg="bg-zinc-500" iconBg="bg-zinc-600" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 border-b border-slate-200">
                <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Name</th>
                <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Email</th>
                <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Role</th>
                <th className="text-left text-[11px] font-semibold uppercase px-4 py-3">Status</th>
                <th className="text-right text-[11px] font-semibold uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{u.full_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${roleBadge(u.role)}`}>{u.role}</span></td>
                  <td className="px-4 py-3 text-xs">
                    {u.must_change_password
                      ? <span className="text-amber-600">Pending first login</span>
                      : <span className="text-emerald-600">Active</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => resetPassword(u)} title="Generate new temporary password">
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => removeUser(u)} title="Delete account">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create user */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="text-xs">Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            </div>

            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 mt-1">{ROLES.find((r) => r.value === form.role)?.description}</p>
            </div>

            {form.role === "staff" && (
              <div>
                <Label className="text-xs">Link to Staff record (optional)</Label>
                <Select value={form.staff_id || "none"} onValueChange={(v) => setForm({ ...form, staff_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="No linked staff record" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked staff record</SelectItem>
                    {staffWithoutLogin.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.role === "reseller" && (
              <div>
                <Label className="text-xs">Link to Reseller record</Label>
                <Select value={form.reseller_id || "none"} onValueChange={(v) => setForm({ ...form, reseller_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="No linked reseller record" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked reseller record</SelectItem>
                    {resellersWithoutLogin.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-amber-600 mt-1">A reseller needs a linked record to see any data in their panel.</p>
              </div>
            )}

            {(form.role === "staff" || form.role === "reseller") && (
              <div>
                <Label className="text-xs">Feature access</Label>
                <div className="grid grid-cols-2 gap-2 mt-1 border border-slate-200 rounded-lg p-3 max-h-52 overflow-y-auto">
                  {features.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={!!form.permissions[f]} onChange={() => toggleFeature(f)} className="rounded border-slate-300 text-blue-600" />
                      {FEATURE_LABELS[f] || f}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={submitCreate} className="w-full" disabled={!form.email}>Create User</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* One-time password reveal */}
      <Dialog open={!!revealPassword} onOpenChange={(open) => !open && setRevealPassword(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Account ready</DialogTitle></DialogHeader>
          {revealPassword && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-slate-600">Share these credentials with <strong>{revealPassword.email}</strong> securely (this password is shown only once and can't be retrieved again — use the key icon to generate a new one if it's lost).</p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <code className="flex-1 font-mono text-sm text-slate-900">{revealPassword.temp_password}</code>
                <Button variant="outline" size="sm" onClick={copyPassword}>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-amber-600">They'll be required to set their own password on first login.</p>
              <Button className="w-full" onClick={() => setRevealPassword(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
