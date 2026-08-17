import React from "react";
import { CreditCard, Key, Wrench, UserCheck, Gift, DollarSign, FileText, Smartphone } from "lucide-react";

export default function CustomerFullDetails({ customer, pkg }) {
  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;

  const details = [
    { icon: Key, label: "PPPoE Password", value: customer.pppoe_password || "—", mono: true },
    { icon: FileText, label: "Customer Code", value: customer.customer_code || "—", mono: true },
    { icon: DollarSign, label: "Connection Charge", value: customer.free_connection ? "FREE" : formatBDT(customer.connection_charge) },
    { icon: Gift, label: "Monthly Discount", value: customer.discount ? formatBDT(customer.discount) : "—" },
    { icon: Gift, label: "Package Discount", value: customer.package_discount ? formatBDT(customer.package_discount) : "—" },
    { icon: Wrench, label: "Provided Devices", value: customer.provided_devices || "—" },
    { icon: UserCheck, label: "Connected By", value: customer.connected_by || "—" },
    { icon: Smartphone, label: "Referral", value: customer.referral || "—" },
  ];

  return (
    <div className="glass-card p-6 mt-6">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-blue-500" /> Full Customer Details
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {details.map((d) => (
          <div key={d.label} className="border border-slate-100 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase mb-1">
              <d.icon className="w-3 h-3" /> {d.label}
            </div>
            <div className={`text-sm font-medium text-slate-700 ${d.mono ? "font-mono text-xs" : ""}`}>{d.value}</div>
          </div>
        ))}
      </div>
      {customer.notes && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 uppercase mb-1">Notes</div>
          <p className="text-sm text-slate-600">{customer.notes}</p>
        </div>
      )}
    </div>
  );
}