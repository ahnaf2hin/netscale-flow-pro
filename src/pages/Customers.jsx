import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, Users, UserCheck, Wifi, Eye, Ban, X, Plus, Search, Phone, Download, Server, Trash2, MessageCircle, Pencil, Filter as FilterIcon, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const StatCard = ({ label, value, icon: Icon, bg, iconBg }) => (
  <div className={`${bg} rounded-xl p-4 flex items-center justify-between`}>
    <div>
      <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold mt-1">{value}</p>
    </div>
    <div className={`${iconBg} w-10 h-10 rounded-lg flex items-center justify-center`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
  </div>
);

const genCode = () => "CUST-" + Math.floor(100000 + Math.random() * 900000);

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [sessionMap, setSessionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [routers, setRouters] = useState([]);
  const [staff, setStaff] = useState([]);
  const [importRouterId, setImportRouterId] = useState("");
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "",
    latitude: "", longitude: "", connection_date: "",
    status: "active", package_id: "", pppoe_username: "", pppoe_password: "", customer_code: "", zone: "", notes: "",
    provided_devices: "", connection_charge: "", discount: "", package_discount: "",
    referral: "", connected_by: "", free_connection: false
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [custs, pkgs, rts, sessions, staffList] = await Promise.all([
        netscaleApi.entities.Customer.list("-created_date", 500),
        netscaleApi.entities.Package.list("-created_date", 100),
        netscaleApi.entities.MikrotikRouter.list("-created_date", 50),
        netscaleApi.entities.PPPoESession.list("-last_synced", 500),
        netscaleApi.entities.Staff.list("-created_date", 100),
      ]);
      setCustomers(custs);
      setPackages(pkgs);
      setRouters(rts);
      setStaff(staffList);
      const smap = {};
      (sessions || []).forEach(s => { if (s.pppoe_username) smap[s.pppoe_username] = s; });
      setSessionMap(smap);
      if (rts.length > 0 && !importRouterId) setImportRouterId(rts[0].id);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditCustomer(null);
    setForm({ name: "", phone: "", email: "", address: "", latitude: "", longitude: "", connection_date: "", status: "active", package_id: "", pppoe_username: "", pppoe_password: "", customer_code: genCode(), zone: "", notes: "", provided_devices: "", connection_charge: "", discount: "", package_discount: "", referral: "", connected_by: "", free_connection: false });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditCustomer(c);
    setForm({ name: c.name || "", phone: c.phone || "", email: c.email || "", address: c.address || "", latitude: c.latitude || "", longitude: c.longitude || "", connection_date: c.connection_date || "", status: c.status || "active", package_id: c.package_id || "", pppoe_username: c.pppoe_username || "", pppoe_password: c.pppoe_password || "", customer_code: c.customer_code || "", zone: c.zone || "", notes: c.notes || "", provided_devices: c.provided_devices || "", connection_charge: c.connection_charge || "", discount: c.discount || "", package_discount: c.package_discount || "", referral: c.referral || "", connected_by: c.connected_by || "", free_connection: c.free_connection || false });
    setShowForm(true);
  };

  const handleSave = async () => {
    const data = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      connection_charge: form.connection_charge ? parseFloat(form.connection_charge) : 0,
      discount: form.discount ? parseFloat(form.discount) : 0,
      package_discount: form.package_discount ? parseFloat(form.package_discount) : 0,
    };
    try {
      let custId;
      if (editCustomer) {
        await netscaleApi.entities.Customer.update(editCustomer.id, data);
        custId = editCustomer.id;
        toast({ title: "Customer updated" });
      } else {
        const created = await netscaleApi.entities.Customer.create(data);
        custId = created.id;
        toast({ title: "Customer created" });
      }
      setShowForm(false);
      loadData();
      // Auto-generate monthly invoices from connection date
      if (data.connection_date && data.package_id) {
        try {
          const res = await netscaleApi.functions.invoke("generateCustomerInvoices", { customer_id: custId });
          if (res.data?.created > 0) {
            toast({ title: `${res.data.created} invoice(s) generated from connection date` });
          }
        } catch (invErr) { console.error("Invoice generation failed:", invErr); }
      }
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await netscaleApi.entities.Customer.delete(deleteTarget.id); toast({ title: "Client deleted" }); setDeleteTarget(null); loadData(); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleStatusToggle = async (c) => {
    const newStatus = c.status === "active" ? "suspended" : "active";
    try {
      await netscaleApi.entities.Customer.update(c.id, { status: newStatus });
      toast({ title: newStatus === "active" ? "Client activated" : "Client suspended" });
      loadData();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.pppoe_username?.toLowerCase().includes(search.toLowerCase()) || c.customer_code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getPkg = (pkgId) => packages.find(p => p.id === pkgId);

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const getSortVal = (c, key) => {
    const sess = c.pppoe_username ? sessionMap[c.pppoe_username] : null;
    const pkg = getPkg(c.package_id);
    switch (key) {
      case "customer_code": return (c.customer_code || "").toLowerCase();
      case "pppoe_username": return (c.pppoe_username || "").toLowerCase();
      case "name": return (c.name || "").toLowerCase();
      case "phone": return (c.phone || "").toLowerCase();
      case "zone": return (c.zone || "").toLowerCase();
      case "router_name": return (sess?.router_name || "").toLowerCase();
      case "package": return (pkg?.name || "").toLowerCase();
      case "monthly_price": return pkg?.monthly_price || 0;
      case "connection_date": return c.connection_date || "";
      case "status": return c.status || "";
      default: return "";
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) { setSortDir(sortDir === "asc" ? "desc" : "asc"); }
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const av = getSortVal(a, sortKey);
    const bv = getSortVal(b, sortKey);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />;

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    if (filtered.every(c => selectedIds.has(c.id))) {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(c => next.delete(c.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(c => next.add(c.id)); return next; });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkSuspend = async () => {
    const toSuspend = filtered.filter(c => selectedIds.has(c.id) && c.status !== "suspended");
    if (!toSuspend.length) { toast({ title: "No customers to suspend", variant: "destructive" }); return; }
    setBulkActionLoading(true);
    try {
      await netscaleApi.entities.Customer.bulkUpdate(toSuspend.map(c => ({ id: c.id, status: "suspended" })));
      // A suspend command only reaches a router if it's tagged with that router's id (the collector
      // only pulls pending commands scoped to the router it's currently syncing) — look up each
      // customer's current router from their PPPoE session before queuing the command.
      const usernames = toSuspend.filter(c => c.pppoe_username).map(c => c.pppoe_username);
      const sessions = usernames.length
        ? await netscaleApi.entities.PPPoESession.filter({ pppoe_username: { in: usernames } }, "-last_synced", 1000)
        : [];
      const routerByUsername = {};
      for (const s of sessions) if (!routerByUsername[s.pppoe_username]) routerByUsername[s.pppoe_username] = s.router_id;
      await Promise.all(toSuspend.map(c => (c.pppoe_username && routerByUsername[c.pppoe_username])
        ? netscaleApi.entities.CommandQueue.create({ customer_id: c.id, command_type: "suspend", router_id: routerByUsername[c.pppoe_username], pppoe_username: c.pppoe_username, status: "pending" }).catch(() => {})
        : null));
      toast({ title: `${toSuspend.length} customer(s) suspended` });
      clearSelection();
      loadData();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setBulkActionLoading(false); }
  };

  const handleImportPppoe = async () => {
    if (!importRouterId) { toast({ title: "Select a router first", variant: "destructive" }); return; }
    setImporting(true);
    try {
      const res = await netscaleApi.functions.invoke("managePppoe", { action: "import_customers", router_id: importRouterId });
      const d = res.data;
      if (d.success === false) throw new Error(d.error);
      toast({ title: "Import complete", description: `${d.created} new client(s) imported, ${d.skipped} already existed.` });
      setShowImport(false);
      loadData();
    } catch (err) { toast({ title: "Import failed", description: err.message, variant: "destructive" }); }
    finally { setImporting(false); }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
  const selectableCount = filtered.filter(c => selectedIds.has(c.id) && c.status !== "suspended").length;
  const activeCount = customers.filter(c => c.status === "active").length;
  const inactiveCount = customers.filter(c => c.status === "inactive").length;
  const onlineCount = customers.filter(c => c.pppoe_username && sessionMap[c.pppoe_username]?.status === "online").length;
  const offlineCount = customers.length - onlineCount;

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Client Management</h1>
            <p className="text-xs text-slate-500">Manage clients, track services, and monitor connectivity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-2 shadow-sm">
            <Download className="w-3.5 h-3.5" /> Import PPPoE
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add New Client
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Clients" value={activeCount} icon={UserCheck} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Inactive" value={inactiveCount} icon={UserCheck} bg="bg-slate-600" iconBg="bg-slate-700" />
        <StatCard label="Online Clients" value={onlineCount} icon={Wifi} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <StatCard label="Offline Clients" value={offlineCount} icon={Wifi} bg="bg-rose-500" iconBg="bg-rose-600" />
      </div>

      {/* Filter Region */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-indigo-500" />
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Filter Clients</p>
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            {showFilters ? "Hide" : "Show"}
          </button>
        </div>
        {showFilters && (
          <div className="px-4 pb-4 flex flex-col sm:flex-row gap-3 border-t border-slate-100 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Search name, phone, User ID, Client ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm h-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Client Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-12 h-12 mb-3" />
            <p className="text-sm">No clients found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="w-10 px-4 py-3.5">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-400 text-indigo-500 cursor-pointer" />
                  </th>
                  {[
                    { label: "Client ID", key: "customer_code" },
                    { label: "User ID", key: "pppoe_username" },
                    { label: "Name", key: "name" },
                    { label: "Contact", key: "phone" },
                    { label: "Zone", key: "zone" },
                    { label: "Server", key: "router_name" },
                    { label: "Package", key: "package" },
                    { label: "Monthly Bill", key: "monthly_price" },
                    { label: "Billing Date", key: "connection_date" },
                    { label: "Status", key: "status" },
                  ].map(col => (
                    <th key={col.key} className="text-left text-[11px] font-semibold uppercase tracking-wide px-4 py-3.5 cursor-pointer select-none hover:text-indigo-300 transition-colors" onClick={() => handleSort(col.key)}>
                      <span className="inline-flex items-center gap-1">{col.label}<SortIcon k={col.key} /></span>
                    </th>
                  ))}
                  <th className="text-center text-[11px] font-semibold uppercase tracking-wide px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => {
                   const sess = c.pppoe_username ? sessionMap[c.pppoe_username] : null;
                   const pkg = getPkg(c.package_id);
                   const isOnline = sess?.status === "online";
                   return (
                     <tr key={c.id} className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors ${selectedIds.has(c.id) ? "bg-indigo-50/50" : ""} ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                       <td className="px-4 py-3.5">
                         <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer" />
                       </td>
                       <td className="px-4 py-3.5">
                         <span className="text-[13px] font-mono font-semibold text-indigo-600">{c.customer_code || "—"}</span>
                       </td>
                       <td className="px-4 py-3.5">
                         <p className="text-[13px] font-mono text-slate-700">{c.pppoe_username || "—"}</p>
                         {isOnline && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>}
                       </td>
                       <td className="px-4 py-3.5"><p className="text-sm font-semibold text-slate-900">{c.name}</p></td>
                       <td className="px-4 py-3.5"><div className="flex items-center gap-1.5 text-[13px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400" />{c.phone || "—"}</div></td>
                       <td className="px-4 py-3.5">{c.zone ? <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{c.zone}</span> : <span className="text-slate-300">—</span>}</td>
                       <td className="px-4 py-3.5">{sess?.router_name ? <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100">{sess.router_name}</span> : <span className="text-slate-300">—</span>}</td>
                       <td className="px-4 py-3.5 text-[13px] text-slate-700">{pkg ? `${pkg.name} · ${pkg.speed_mbps} Mbps` : "—"}</td>
                       <td className="px-4 py-3.5 text-[13px] font-semibold text-slate-900">{pkg?.monthly_price ? `৳${pkg.monthly_price}` : "—"}</td>
                       <td className="px-4 py-3.5 text-[13px] text-slate-600">{c.connection_date ? moment(c.connection_date).format("D MMM YYYY") : "—"}</td>
                       <td className="px-4 py-3.5">
                         <div className="flex flex-col items-start gap-1">
                           <Switch checked={c.status === "active"} onCheckedChange={() => handleStatusToggle(c)} className="data-[state=checked]:bg-blue-500" />
                           <span className={`text-[9px] font-bold uppercase ${c.status === "active" ? "text-emerald-600" : c.status === "suspended" ? "text-amber-600" : "text-slate-400"}`}>{c.status}</span>
                         </div>
                       </td>
                       <td className="px-4 py-3.5">
                         <div className="flex items-center justify-center gap-1">
                           <Link to={`/customers/${c.id}`}>
                             <button className="w-7 h-7 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center"><Eye className="w-3.5 h-3.5" /></button>
                           </Link>
                           <button onClick={() => openEdit(c)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                           <button onClick={() => setDeleteTarget(c)} className="w-7 h-7 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                           <Link to="/sms"><button className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center"><MessageCircle className="w-3.5 h-3.5" /></button></Link>
                         </div>
                       </td>
                     </tr>
                   );
                 })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 lg:left-[calc(50%+30px)]">
          <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="h-4 w-px bg-slate-700" />
            <Button size="sm" variant="destructive" disabled={selectableCount === 0 || bulkActionLoading} onClick={handleBulkSuspend} className="bg-red-600 hover:bg-red-700">
              {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Ban className="w-3.5 h-3.5 mr-1.5" />}
              Suspend {selectableCount > 0 && `(${selectableCount})`}
            </Button>
            <button onClick={clearSelection} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Client?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 mt-2">This will permanently remove <span className="font-semibold text-slate-900">{deleteTarget?.name}</span>. This cannot be undone.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700"><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editCustomer ? "Edit Client" : "Add New Client"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Customer ID (for payments)</Label><Input value={form.customer_code} readOnly className="bg-slate-50 font-mono text-indigo-600 font-semibold" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="text-xs">Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label className="text-xs">Zone</Label><Input value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} placeholder="e.g. MOTIJHEEL" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Connection Date</Label><Input type="date" value={form.connection_date} onChange={e => setForm({ ...form, connection_date: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Package</Label>
              <Select value={form.package_id} onValueChange={v => setForm({ ...form, package_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>
                  {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.speed_mbps} Mbps — ৳{p.monthly_price}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Connection Details</p>
              <div className="space-y-4">
                <div><Label className="text-xs">Provided Devices & Cables</Label><Input value={form.provided_devices} onChange={e => setForm({ ...form, provided_devices: e.target.value })} placeholder="e.g. 1x ONU, 50m fiber, 1x router" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">Connection Charge (৳)</Label><Input type="number" value={form.connection_charge} onChange={e => setForm({ ...form, connection_charge: e.target.value })} placeholder="0" /></div>
                  <div><Label className="text-xs">Free Connection</Label>
                    <div className="flex items-center gap-2 h-9">
                      <Switch checked={form.free_connection} onCheckedChange={v => setForm({ ...form, free_connection: v })} className="data-[state=checked]:bg-emerald-500" />
                      <span className="text-xs text-slate-500">{form.free_connection ? "Waived" : "No"}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">Monthly Discount (৳)</Label><Input type="number" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} placeholder="0" /></div>
                  <div><Label className="text-xs">Package Discount (৳)</Label><Input type="number" value={form.package_discount} onChange={e => setForm({ ...form, package_discount: e.target.value })} placeholder="0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">Referral</Label><Input value={form.referral} onChange={e => setForm({ ...form, referral: e.target.value })} placeholder="Referral name or code" /></div>
                  <div><Label className="text-xs">Connected By (Staff)</Label>
                    <Select value={form.connected_by} onValueChange={v => setForm({ ...form, connected_by: v })}>
                      <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                      <SelectContent>
                        {staff.map(s => <SelectItem key={s.id} value={s.name}>{s.name} — {s.role}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">PPPoE Username</Label><Input value={form.pppoe_username} onChange={e => setForm({ ...form, pppoe_username: e.target.value })} /></div>
              <div><Label className="text-xs">PPPoE Password</Label><Input value={form.pppoe_password} onChange={e => setForm({ ...form, pppoe_password: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700">{editCustomer ? "Update Client" : "Create Client"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import PPPoE Users Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Import PPPoE Users</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">Pull all PPPoE users from a MikroTik router and add them as clients. Only the PPPoE username and password are filled — click a client afterward to add their details.</p>
            <div>
              <Label className="text-xs">Router</Label>
              <Select value={importRouterId} onValueChange={setImportRouterId}>
                <SelectTrigger><Server className="w-3.5 h-3.5 mr-1.5 text-slate-400" /><SelectValue placeholder="Select router" /></SelectTrigger>
                <SelectContent>{routers.map(r => <SelectItem key={r.id} value={r.id}>{r.name || r.host}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleImportPppoe} disabled={importing} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Import Users
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}