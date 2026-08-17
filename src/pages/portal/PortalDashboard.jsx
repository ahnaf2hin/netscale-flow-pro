import React, { useEffect, useState } from "react";
import { netscaleApi } from "@/api/apiClient";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Wifi, AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";
import PortalNav from "@/components/portal/PortalNav";
import ProfileSection from "@/components/portal/ProfileSection";
import PackageSection from "@/components/portal/PackageSection";
import BillsSection from "@/components/portal/BillsSection";
import UpgradeSection from "@/components/portal/UpgradeSection";

export default function PortalDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [upgradingId, setUpgradingId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await netscaleApi.functions.invoke("getPortalData", {});
      setData(res.data);
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === "no_customer") {
        setError({ type: "no_customer", message: err.response.data.message });
      } else {
        setError({ type: "error", message: err.response?.data?.error || err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    const status = params.get("status");
    if (sid) {
      confirmPayment(sid);
    } else if (status === "canceled") {
      toast({ title: "Payment canceled", description: "Your payment was not completed.", variant: "destructive" });
      window.history.replaceState({}, "", "/portal/dashboard");
    }
  }, []);

  const confirmPayment = async (sid) => {
    setConfirming(true);
    try {
      const res = await netscaleApi.functions.invoke("confirmPayment", { session_id: sid });
      setConfirmResult(res.data);
      toast({ title: "Payment successful!", description: res.data.already_processed ? "This payment was already processed." : "Your account has been updated." });
      loadData();
    } catch (err) {
      toast({ title: "Payment confirmation failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setConfirming(false);
      window.history.replaceState({}, "", "/portal/dashboard");
    }
  };

  const handlePay = async (invoice) => {
    setPayingId(invoice.id);
    try {
      const res = await netscaleApi.functions.invoke("createCheckout", { type: "bill", invoice_id: invoice.id });
      window.location.href = res.data.url;
    } catch (err) {
      toast({ title: "Could not start payment", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setPayingId(null);
    }
  };

  const handleUpgrade = async (pkg) => {
    setUpgradingId(pkg.id);
    try {
      const res = await netscaleApi.functions.invoke("createCheckout", { type: "upgrade", package_id: pkg.id });
      window.location.href = res.data.url;
    } catch (err) {
      toast({ title: "Could not start upgrade", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setUpgradingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error?.type === "no_customer") {
    return (
      <>
        <PortalNav />
        <div className="max-w-md mx-auto mt-16 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-amber-600" /></div>
          <h2 className="text-lg font-bold text-slate-900">No account found</h2>
          <p className="text-sm text-slate-500 mt-2">{error.message}</p>
          <button onClick={() => netscaleApi.auth.logout("/portal/login")} className="mt-6 text-sm font-semibold text-emerald-600 hover:underline">Back to login</button>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PortalNav />
        <div className="max-w-md mx-auto mt-16 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-red-600" /></div>
          <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
          <p className="text-sm text-slate-500 mt-2">{error.message}</p>
          <button onClick={loadData} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:underline"><RefreshCw className="w-4 h-4" /> Try again</button>
        </div>
      </>
    );
  }

  const { customer, currentPackage, invoices, packages, user } = data;

  return (
    <>
      <PortalNav customerName={customer.name} email={user?.email || customer.email} />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {confirming && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">Confirming your payment…</p>
          </div>
        )}
        {confirmResult && !confirming && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">
              {confirmResult.type === "upgrade" ? "Package upgraded successfully!" : "Bill paid successfully!"}
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-5">
          <ProfileSection customer={customer} />
          <PackageSection pkg={currentPackage} />
        </div>

        <BillsSection invoices={invoices} payingId={payingId} onPay={handlePay} />

        <UpgradeSection packages={packages} currentPackageId={customer.package_id} upgradingId={upgradingId} onUpgrade={handleUpgrade} />

        <footer className="text-center text-xs text-slate-400 pt-4 pb-8">
          <div className="flex items-center justify-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-emerald-500" /> KG Soft Internet — Customer Portal</div>
        </footer>
      </div>
    </>
  );
}