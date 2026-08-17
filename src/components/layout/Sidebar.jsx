import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Settings, UserPlus, Users, CreditCard, Wifi, Server,
  HardDrive, Globe, Store, UserCircle, Headset, ClipboardList, MessageSquare,
  Calculator, BarChart3, Menu, X, LogOut, ChevronRight, ChevronDown, UploadCloud, ClipboardCheck
} from "lucide-react";
import { netscaleApi } from "@/api/apiClient";

const menuStructure = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "My Work", path: "/staff-dashboard", icon: ClipboardCheck },
  { label: "Configuration", path: "/configuration", icon: Settings, children: [
    { label: "System Settings", path: "/configuration" },
    { label: "Packages", path: "/packages" },
    { label: "Offices", path: "/offices" },
    { label: "Zones", path: "/zones" },
    { label: "Map Settings", path: "/map-settings" },
    { label: "Collector Setup", path: "/collector" },
    { label: "Payment Gateways", path: "/payment-gateways" },
    { label: "SMS Providers", path: "/sms-providers" },
  ]},
  { label: "Bulk Import", path: "/bulk-import", icon: UploadCloud },
  { label: "Signup List", path: "/signups", icon: UserPlus },
  { label: "Clients", path: "/customers", icon: Users, children: [
    { label: "Client List", path: "/customers" },
    { label: "Left Clients", path: "/customers/suspended" },
  ]},
  { label: "Billing", path: "/billing", icon: CreditCard, children: [
    { label: "Invoices", path: "/billing" },
    { label: "Payments", path: "/payments" },
    { label: "Packages", path: "/packages" },
  ]},
  { label: "Hotspot", path: "/hotspot", icon: Wifi, children: [
    { label: "Hotspot Users", path: "/hotspot" },
    { label: "Profiles", path: "/hotspot-profiles" },
    { label: "Vouchers", path: "/hotspot-vouchers" },
  ]},
  { label: "Mikrotik", path: "/mikrotik", icon: Server, children: [
    { label: "Servers", path: "/mikrotik" },
    { label: "PPPoE Users", path: "/connections" },
    { label: "Profiles", path: "/mikrotik-profiles" },
  ]},
  { label: "OLT Management", path: "/olt", icon: HardDrive },
  { label: "Network", path: "/network-map", icon: Globe, children: [
    { label: "Network Map", path: "/network-map" },
    { label: "Cable Routes", path: "/cable-routes" },
  ]},
  { label: "MAC Reseller", path: "/resellers", icon: Store, children: [
    { label: "Resellers", path: "/resellers" },
    { label: "Commissions", path: "/reseller-commissions" },
  ]},
  { label: "HR & Payroll", path: "/staff", icon: UserCircle, children: [
    { label: "Staff Members", path: "/staff" },
    { label: "Payroll", path: "/payroll" },
    { label: "Work Reports", path: "/work-report" },
  ]},
  { label: "Support & Ticketing", path: "/support", icon: Headset, children: [
    { label: "Support Tickets", path: "/support" },
    { label: "Categories", path: "/support-categories" },
  ]},
  { label: "Work Report", path: "/work-report", icon: ClipboardList },
  { label: "SMS Service", path: "/sms", icon: MessageSquare },
  { label: "Accounting", path: "/accounting", icon: Calculator, children: [
    { label: "Income", path: "/accounting/income" },
    { label: "Expenses", path: "/accounting/expenses" },
    { label: "Reports", path: "/accounting/reports" },
  ]},
  { label: "Reports", path: "/reports", icon: BarChart3 },
];

// Defined outside Sidebar so it keeps a stable component identity across re-renders —
// previously this was declared inside Sidebar()'s body, so every route change (Sidebar
// re-renders on useLocation()) created a *new* NavContent function/component type, which
// made React unmount+remount the whole nav DOM and reset its scroll position to the top.
function NavContent({ collapsed, expanded, location, setMobileOpen, toggleExpand, isActive, isParentActive, handleLogout }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-900/40 flex items-center justify-center flex-shrink-0">
          <Wifi className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white tracking-wide">NetScale Flow Pro</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest">ISP Management</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuStructure.map((item, idx) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const parentActive = item.children ? isParentActive(item.children) : false;
          const isOpen = expanded[idx] || parentActive;
          return (
            <div key={idx}>
              <div className="flex items-center">
                <Link
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out group flex-1 ${
                    active || parentActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/80 hover:translate-x-0.5"
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${active || parentActive ? "text-white" : "text-zinc-500 group-hover:text-white"}`} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
                {item.children && !collapsed && (
                  <button
                    onClick={(e) => { e.preventDefault(); toggleExpand(idx); }}
                    className={`p-1.5 rounded-md transition-colors ${active || parentActive ? "text-white hover:bg-indigo-500" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
              {item.children && !collapsed && isOpen && (
                <div className="ml-6 mt-1 space-y-1 border-l border-zinc-800 pl-3">
                  {item.children.map((child, ci) => (
                    <Link
                      key={ci}
                      to={child.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
                        isActive(child.path)
                          ? "text-white bg-indigo-600/30"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${isActive(child.path) ? "bg-indigo-400" : "bg-zinc-600"}`} />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-zinc-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    const e = {};
    menuStructure.forEach((m, i) => { if (m.children) e[i] = false; });
    return e;
  });
  const location = useLocation();

  const handleLogout = () => { netscaleApi.auth.logout("/login"); };

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path;
  };

  const isParentActive = (children) => children?.some(c => isActive(c.path));

  const toggleExpand = (idx) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const navProps = { collapsed, expanded, location, setMobileOpen, toggleExpand, isActive, isParentActive, handleLogout };

  return (
    <>
      {/* Mobile toggle — icon morphs between Menu/X and stays clickable above the drawer */}
      <button
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg border border-white/10 bg-zinc-900/60 backdrop-blur-xl backdrop-saturate-150 transition-all duration-200 hover:bg-zinc-800/70 hover:scale-105 active:scale-95"
      >
        <span className="relative w-5 h-5 block">
          <Menu className={`absolute inset-0 w-5 h-5 transition-all duration-200 ${mobileOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"}`} />
          <X className={`absolute inset-0 w-5 h-5 transition-all duration-200 ${mobileOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"}`} />
        </span>
      </button>

      {/* Mobile overlay — always mounted for smooth in/out transition */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ease-out ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Glassmorphism backdrop */}
        <div
          className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        {/* Glassmorphism drawer panel */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-64 overflow-y-auto border-r border-white/10 bg-zinc-900/75 backdrop-blur-2xl backdrop-saturate-150 shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <NavContent {...navProps} />
        </div>
      </div>

      {/* Desktop sidebar — solid (not glass): it's a persistent nav rail, not an overlay, so
          there's no page content behind it for translucency to read against. Glassmorphism is
          reserved for the hamburger menu's overlay + drawer below, where it actually shows. */}
      <div
        className={`hidden lg:flex flex-col bg-zinc-900 border-r border-zinc-800 h-screen sticky top-0 transition-all duration-200 ${
          collapsed ? "w-[68px]" : "w-60"
        }`}
      >
        <NavContent {...navProps} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-zinc-700 border border-zinc-600 rounded-full flex items-center justify-center text-zinc-300 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white hover:scale-110 active:scale-95 transition-all duration-200"
        >
          <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </div>
    </>
  );
}