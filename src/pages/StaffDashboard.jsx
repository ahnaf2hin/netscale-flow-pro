import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ClipboardList, Clock, Briefcase, Check, RefreshCw, Search, UserCircle, CalendarClock } from "lucide-react";
import ColorStatCard from "@/components/dashboard/ColorStatCard";
import { useToast } from "@/components/ui/use-toast";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const CATEGORY_LABELS = {
  installation: "Installation", maintenance: "Maintenance", support: "Support", meeting: "Meeting", other: "Other",
};

export default function StaffDashboard() {
  const [me, setMe] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setMe(user);
      // Find the staff record matching this user (by email, fallback to name)
      const allStaff = await base44.entities.Staff.list("-created_date", 200);
      const match = allStaff.find(s => (s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase()))
        || allStaff.find(s => s.name && user.full_name && s.name.toLowerCase() === user.full_name.toLowerCase());
      setStaffProfile(match || null);

      let myReports = [];
      if (match) {
        myReports = await base44.entities.WorkReport.filter({ staff_id: match.id }, "-report_date", 500);
        if (myReports.length === 0) {
          myReports = await base44.entities.WorkReport.filter({ staff_name: match.name }, "-report_date", 500);
        }
      } else if (user.full_name) {
        myReports = await base44.entities.WorkReport.filter({ staff_name: user.full_name }, "-report_date", 500);
      }
      setReports(myReports);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load dashboard", description: err.message });
    } finally { setLoading(false); }
  };

  const pending = reports.filter(r => r.status === "pending").length;
  const inProgress = reports.filter(r => r.status === "in_progress").length;
  const completed = reports.filter(r => r.status === "completed").length;
  const totalHours = reports.reduce((sum, r) => sum + (r.hours || 0), 0);

  const filtered = reports.filter(r => {
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Work Dashboard</h1>
            <p className="text-xs text-slate-500">Your assigned tasks & work reports</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Staff profile banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-7 h-7 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 truncate">{staffProfile?.name || me?.full_name || "Staff Member"}</h2>
          <p className="text-xs text-slate-500 truncate">
            {staffProfile?.role ? <span className="capitalize">{staffProfile.role}</span> : null}
            {staffProfile?.department ? <span> · {staffProfile.department}</span> : null}
            {me?.email ? <span> · {me.email}</span> : null}
          </p>
        </div>
        {!staffProfile && (
          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-full">No staff profile linked</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <ColorStatCard label="Total Tasks" value={reports.length} icon={ClipboardList} bg="bg-indigo-500" iconBg="bg-indigo-600" />
        <ColorStatCard label="Pending" value={pending} icon={Clock} bg="bg-amber-500" iconBg="bg-amber-600" />
        <ColorStatCard label="In Progress" value={inProgress} icon={Briefcase} bg="bg-cyan-500" iconBg="bg-cyan-600" />
        <ColorStatCard label="Completed" value={completed} icon={Check} bg="bg-emerald-500" iconBg="bg-emerald-600" />
        <ColorStatCard label="Total Hours" value={totalHours} icon={CalendarClock} bg="bg-violet-500" iconBg="bg-violet-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your tasks..." className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === t.value ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{CATEGORY_LABELS[r.category] || r.category || "Other"}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${r.status === "completed" ? "bg-emerald-100 text-emerald-700" : r.status === "in_progress" ? "bg-cyan-100 text-cyan-700" : "bg-amber-100 text-amber-700"}`}>
                {r.status?.replace("_", " ")}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-3">{r.description}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> {r.report_date || "—"}
              </span>
              <span className="text-[11px] text-slate-400">{r.hours || 0}h</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">No tasks assigned{statusFilter !== "all" ? ` with status "${statusFilter.replace("_", " ")}"` : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}