import React, { useState } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Ban, RefreshCw, Pencil, Trash2, FilePlus, Loader2 } from "lucide-react";

export default function CustomerActions({ customer, packages = [], zones = [], onUpdated }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [form, setForm] = useState({
    name: customer.name || "", phone: customer.phone || "", email: customer.email || "",
    address: customer.address || "", latitude: customer.latitude || "", longitude: customer.longitude || "",
    connection_date: customer.connection_date || "", status: customer.status || "active",
    package_id: customer.package_id || "", pppoe_username: customer.pppoe_username || "",
    pppoe_password: customer.pppoe_password || "", zone: customer.zone || "", notes: customer.notes || "",
  });
  const [invoice, setInvoice] = useState({ amount: "", billing_month: "", due_date: "" });

  const handleToggleStatus = async () => {
    const newStatus = customer.status === "active" ? "suspended" : "active";
    const cmd = newStatus === "suspended" ? "suspend" : "reconnect";
    setActionLoading("status");
    try {
      await netscaleApi.entities.Customer.update(customer.id, { status: newStatus });
      if (customer.pppoe_username) {
        await netscaleApi.entities.CommandQueue.create({
          customer_id: customer.id, command_type: cmd,
          pppoe_username: customer.pppoe_username, status: "pending",
        }).catch(() => {});
      }
      toast({ title: `Customer ${newStatus}`, description: `${cmd} command queued for the collector agent` });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActionLoading(""); }
  };

  const handleEditSave = async () => {
    setActionLoading("edit");
    try {
      const data = {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      };
      await netscaleApi.entities.Customer.update(customer.id, data);
      toast({ title: "Customer updated" });
      setEditOpen(false);
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActionLoading(""); }
  };

  const handleCreateInvoice = async () => {
    if (!invoice.amount || !invoice.due_date) {
      toast({ title: "Missing fields", description: "Amount and due date are required", variant: "destructive" });
      return;
    }
    setActionLoading("invoice");
    try {
      const pkg = packages.find(p => p.id === customer.package_id);
      await netscaleApi.entities.Invoice.create({
        customer_id: customer.id,
        customer_name: customer.name,
        package_name: pkg?.name || "",
        amount: parseFloat(invoice.amount),
        due_date: invoice.due_date,
        billing_month: invoice.billing_month || new Date().toLocaleString("en-BD", { month: "long", year: "numeric" }),
        status: "unpaid",
      });
      toast({ title: "Invoice created" });
      setInvoiceOpen(false);
      setInvoice({ amount: "", billing_month: "", due_date: "" });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActionLoading(""); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete customer "${customer.name}"? This cannot be undone.`)) return;
    setActionLoading("delete");
    try {
      await netscaleApi.entities.Customer.delete(customer.id);
      toast({ title: "Customer deleted" });
      window.location.href = "/customers";
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActionLoading(""); }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={customer.status === "active" ? "destructive" : "default"}
          size="sm"
          disabled={!!actionLoading}
          onClick={handleToggleStatus}
          className={customer.status === "active" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}
        >
          {actionLoading === "status" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> :
            customer.status === "active" ? <Ban className="w-3.5 h-3.5 mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          {customer.status === "active" ? "Suspend" : "Reconnect"}
        </Button>
        <Button variant="outline" size="sm" disabled={!!actionLoading} onClick={() => setEditOpen(true)}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" disabled={!!actionLoading} onClick={() => setInvoiceOpen(true)}>
          <FilePlus className="w-3.5 h-3.5 mr-1.5" /> New Invoice
        </Button>
        <Button variant="ghost" size="sm" disabled={!!actionLoading} onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
          {actionLoading === "delete" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
          Delete
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="text-xs">Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label className="text-xs">Zone</Label>
              <Select value={form.zone} onValueChange={v => setForm({ ...form, zone: v })}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  {zones.filter(z => z.status === "active").map(z => <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></div>
              <div><Label className="text-xs">Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Connection Date</Label><Input type="date" value={form.connection_date} onChange={e => setForm({ ...form, connection_date: e.target.value })} /></div>
              <div><Label className="text-xs">Status</Label>
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
            <div><Label className="text-xs">Package</Label>
              <Select value={form.package_id} onValueChange={v => setForm({ ...form, package_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>
                  {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.speed_mbps} Mbps — ৳{p.monthly_price}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">PPPoE Username</Label><Input value={form.pppoe_username} onChange={e => setForm({ ...form, pppoe_username: e.target.value })} /></div>
              <div><Label className="text-xs">PPPoE Password</Label><Input value={form.pppoe_password} onChange={e => setForm({ ...form, pppoe_password: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={handleEditSave} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={actionLoading === "edit"}>
              {actionLoading === "edit" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-xs">Amount (৳) *</Label>
              <Input type="number" value={invoice.amount} onChange={e => setInvoice({ ...invoice, amount: e.target.value })} placeholder={packages.find(p => p.id === customer.package_id)?.monthly_price || ""} />
            </div>
            <div>
              <Label className="text-xs">Billing Month</Label>
              <Input value={invoice.billing_month} onChange={e => setInvoice({ ...invoice, billing_month: e.target.value })} placeholder={new Date().toLocaleString("en-BD", { month: "long", year: "numeric" })} />
            </div>
            <div>
              <Label className="text-xs">Due Date *</Label>
              <Input type="date" value={invoice.due_date} onChange={e => setInvoice({ ...invoice, due_date: e.target.value })} />
            </div>
            <Button onClick={handleCreateInvoice} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={actionLoading === "invoice"}>
              {actionLoading === "invoice" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Invoice"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}