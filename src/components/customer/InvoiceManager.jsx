import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, CreditCard, Loader2, Receipt } from "lucide-react";

export default function InvoiceManager({ customer, invoices, onUpdated }) {
  const { toast } = useToast();
  const [markPaidInv, setMarkPaidInv] = useState(null);
  const [method, setMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState("");

  useEffect(() => {
    netscaleApi.entities.Staff.list("-created_date", 100).then(setStaffList).catch(() => {});
  }, []);

  const formatBDT = (a) => `৳${(a || 0).toLocaleString("en-BD")}`;
  const today = new Date().toISOString().split("T")[0];

  const totalDue = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + ((i.amount || 0) - (i.paid_amount || 0)), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || (i.status === "paid" ? i.amount : 0)), 0);

  const getDisplayStatus = (inv) => {
    if (inv.status === "paid") return "paid";
    if ((inv.paid_amount || 0) > 0) return "partial";
    if (inv.due_date && inv.due_date < today) return "overdue";
    return inv.status || "unpaid";
  };

  const handleMarkPaid = async () => {
    if (!markPaidInv) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    const currentPaid = markPaidInv.paid_amount || 0;
    const remaining = (markPaidInv.amount || 0) - currentPaid;
    if (amount > remaining + 0.01) {
      toast({ title: "Amount exceeds remaining", description: `Remaining balance: ${formatBDT(remaining)}`, variant: "destructive" });
      return;
    }
    setLoading("mark");
    try {
      const now = new Date().toISOString();
      const newPaidAmount = currentPaid + amount;
      const isFullyPaid = newPaidAmount >= (markPaidInv.amount || 0) - 0.01;
      await netscaleApi.entities.Invoice.update(markPaidInv.id, {
        paid_amount: newPaidAmount,
        status: isFullyPaid ? "paid" : "unpaid",
        paid_date: isFullyPaid ? today : (markPaidInv.paid_date || undefined),
        payment_method: method,
      });
      await netscaleApi.entities.Payment.create({
        invoice_id: markPaidInv.id,
        customer_id: customer.id,
        amount,
        gateway: method,
        transaction_id: `manual-${Date.now()}`,
        status: "completed",
        paid_at: now,
        description: notes || `Invoice payment - ${markPaidInv.billing_month || "bill"}`,
        collected_by: collectedBy || undefined,
        notes: notes || undefined,
      });
      toast({
        title: isFullyPaid ? "Invoice fully cleared" : "Partial payment recorded",
        description: `${formatBDT(amount)} via ${method}${collectedBy ? ` · collected by ${collectedBy}` : ""}`,
      });
      setMarkPaidInv(null);
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(""); }
  };

  const handlePayOnline = async (inv) => {
    setLoading("stripe-" + inv.id);
    try {
      const res = await netscaleApi.functions.invoke("adminPayInvoice", { invoice_id: inv.id });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast({ title: "Error", description: res.data?.error || "Failed to create payment session", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Payment error", description: err.message, variant: "destructive" });
    } finally { setLoading(""); }
  };

  const paymentMethods = ["cash", "bank_transfer", "mobile_banking", "cheque", "stripe"];

  return (
    <div className="glass-card p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-500" /> Invoices & Payments
        </h2>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Outstanding</div>
            <div className="text-sm font-bold text-red-600">{formatBDT(totalDue)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Collected</div>
            <div className="text-sm font-bold text-emerald-600">{formatBDT(totalPaid)}</div>
          </div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <Receipt className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No invoices yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Month</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Amount</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2 hidden sm:table-cell">Due Date</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Status</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2 hidden md:table-cell">Paid Info</th>
                <th className="text-right text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const status = getDisplayStatus(inv);
                const remaining = (inv.amount || 0) - (inv.paid_amount || 0);
                return (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-700">{inv.billing_month || "—"}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-900">
                      {formatBDT(inv.amount)}
                      {status === "partial" && (
                        <div className="text-[10px] text-emerald-600 font-normal">Paid {formatBDT(inv.paid_amount)} · Due {formatBDT(remaining)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-500 hidden sm:table-cell">{inv.due_date || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        status === "paid" ? "bg-emerald-100 text-emerald-700" :
                        status === "partial" ? "bg-blue-100 text-blue-700" :
                        status === "overdue" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>{status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 hidden md:table-cell">
                      {inv.paid_date ? `${inv.paid_date}${inv.payment_method ? ` · ${inv.payment_method}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {status !== "paid" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!loading} onClick={() => {
                            setMarkPaidInv(inv); setMethod("cash");
                            setPayAmount(String(remaining));
                            setNotes(""); setCollectedBy("");
                          }}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> {status === "partial" ? "Add Payment" : "Mark Paid"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" disabled={!!loading} onClick={() => handlePayOnline(inv)}>
                            {loading === "stripe-" + inv.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CreditCard className="w-3 h-3 mr-1" />}
                            Pay Online
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-600 flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-3 h-3" /> Cleared
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Paid Dialog */}
      <Dialog open={!!markPaidInv} onOpenChange={(v) => !v && setMarkPaidInv(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {markPaidInv && (
            <div className="space-y-3 mt-2">
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Invoice</span><span className="font-medium">{markPaidInv.billing_month || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total Amount</span><span className="font-bold text-slate-900">{formatBDT(markPaidInv.amount)}</span></div>
                {(markPaidInv.paid_amount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600"><span>Already Paid</span><span className="font-medium">{formatBDT(markPaidInv.paid_amount)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-500">Remaining</span><span className="font-bold text-red-600">{formatBDT((markPaidInv.amount || 0) - (markPaidInv.paid_amount || 0))}</span></div>
              </div>
              <div>
                <Label className="text-xs">Payment Amount (৳)</Label>
                <Input type="number" step="any" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount" />
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => setPayAmount(String((markPaidInv.amount || 0) - (markPaidInv.paid_amount || 0)))} className="text-[10px] text-blue-600 hover:underline">Full</button>
                  <button onClick={() => setPayAmount(String(Math.round(((markPaidInv.amount || 0) - (markPaidInv.paid_amount || 0)) / 2)))} className="text-[10px] text-blue-600 hover:underline">Half</button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Collected By (optional)</Label>
                <Select value={collectedBy} onValueChange={setCollectedBy}>
                  <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    {staffList.map(s => <SelectItem key={s.id} value={s.name}>{s.name} ({s.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Notes / Details</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment reference, receipt number, notes..." className="text-sm min-h-[60px]" />
              </div>
              <Button onClick={handleMarkPaid} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading === "mark"}>
                {loading === "mark" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Confirm Payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}