import React from "react";
import { CreditCard, Loader2, Receipt, CheckCircle, AlertCircle } from "lucide-react";

const statusStyle = {
  paid: { badge: "bg-emerald-100 text-emerald-700", icon: CheckCircle, label: "Paid" },
  unpaid: { badge: "bg-amber-100 text-amber-700", icon: AlertCircle, label: "Unpaid" },
  overdue: { badge: "bg-red-100 text-red-700", icon: AlertCircle, label: "Overdue" },
};

export default function BillsSection({ invoices, payingId, onPay }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-5 h-5 text-slate-400" />
        <h3 className="font-semibold text-slate-900">Bill History</h3>
        <span className="ml-auto text-xs text-slate-400">{invoices.length} invoices</span>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-8">
          <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No bills yet. Your invoices will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] uppercase font-semibold text-slate-400 px-2 py-2">Billing Month</th>
                <th className="text-left text-[10px] uppercase font-semibold text-slate-400 px-2 py-2 hidden sm:table-cell">Package</th>
                <th className="text-left text-[10px] uppercase font-semibold text-slate-400 px-2 py-2">Due Date</th>
                <th className="text-right text-[10px] uppercase font-semibold text-slate-400 px-2 py-2">Amount</th>
                <th className="text-center text-[10px] uppercase font-semibold text-slate-400 px-2 py-2">Status</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = statusStyle[inv.status] || statusStyle.unpaid;
                const StatusIcon = st.icon;
                const canPay = inv.status !== "paid";
                return (
                  <tr key={inv.id} className="border-b border-slate-50">
                    <td className="px-2 py-3 text-sm font-medium text-slate-800">{inv.billing_month || "—"}</td>
                    <td className="px-2 py-3 text-xs text-slate-500 hidden sm:table-cell">{inv.package_name || "—"}</td>
                    <td className="px-2 py-3 text-xs text-slate-500">{inv.due_date}</td>
                    <td className="px-2 py-3 text-sm font-bold text-slate-900 text-right">${inv.amount}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${st.badge}`}><StatusIcon className="w-3 h-3" /> {st.label}</span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      {canPay ? (
                        <button
                          onClick={() => onPay(inv)}
                          disabled={payingId === inv.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {payingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                          Pay
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}