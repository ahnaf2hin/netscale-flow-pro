import React from "react";
import { User, Phone, Mail, MapPin, Calendar, BadgeCheck } from "lucide-react";

const statusColor = {
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-amber-100 text-amber-700",
  inactive: "bg-slate-100 text-slate-500",
};

export default function ProfileSection({ customer }) {
  const items = [
    { icon: Phone, label: "Phone", value: customer.phone },
    { icon: Mail, label: "Email", value: customer.email || "—" },
    { icon: MapPin, label: "Address", value: customer.address || "—" },
    { icon: Calendar, label: "Connected Since", value: customer.connection_date || "—" },
  ];

  return (
    <div className="glass-card overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-600 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center"><User className="w-6 h-6" /></div>
          <div>
            <h2 className="font-bold text-lg leading-tight">{customer.name}</h2>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 ${statusColor[customer.status] || statusColor.inactive}`}>
              <BadgeCheck className="w-3 h-3" /> {customer.status}
            </span>
          </div>
        </div>
      </div>
      <div className="p-6 grid sm:grid-cols-2 gap-4">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0"><it.icon className="w-4 h-4 text-slate-400" /></div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{it.label}</p>
              <p className="text-sm text-slate-700 truncate">{it.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}