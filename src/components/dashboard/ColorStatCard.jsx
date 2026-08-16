import React from "react";

export default function ColorStatCard({ label, value, icon: Icon, bg, iconBg }) {
  return (
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
}