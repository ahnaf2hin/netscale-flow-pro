import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { netscaleApi } from "@/api/apiClient";
import { Wifi, Zap, Shield, Headset, Star, ArrowRight, CheckCircle, Phone } from "lucide-react";

export default function Landing() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    netscaleApi.entities.Package.filter({ is_active: true })
      .then(setPackages)
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center"><Wifi className="w-5 h-5 text-white" /></div>
            <span className="font-bold text-slate-900">NetScale Flow Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-500 hover:text-slate-800 hidden sm:inline">Staff Login</Link>
            <Link to="/portal/login" className="text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5">Customer Login <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mb-4"><Star className="w-3 h-3" /> #1 Rated ISP in your area</span>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">Blazing fast fiber internet for your home & business</h1>
            <p className="mt-4 text-slate-600 text-lg">Manage your account, pay bills, and upgrade your plan — all from one simple customer portal.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/portal/login" className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 flex items-center gap-2">Access My Account <ArrowRight className="w-4 h-4" /></Link>
              <a href="#packages" className="border border-slate-200 text-slate-700 px-6 py-3 rounded-lg font-semibold hover:bg-slate-50">View Plans</a>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> No setup fees</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> 24/7 support</span>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <img src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80" alt="Internet services" className="w-full h-[360px] object-cover" />
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Lightning Speed", desc: "Symmetric fiber speeds up to 1Gbps with no data caps." },
            { icon: Shield, title: "Reliable Uptime", desc: "99.9% uptime guarantee with proactive monitoring." },
            { icon: Headset, title: "24/7 Support", desc: "Local support team ready to help anytime you need." },
          ].map((f, i) => (
            <div key={i} className="border border-slate-100 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4"><f.icon className="w-5 h-5 text-emerald-600" /></div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Choose your plan</h2>
          <p className="text-slate-500 mt-2">Transparent pricing, no hidden fees. Upgrade anytime from your portal.</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : packages.length === 0 ? (
          <p className="text-center text-slate-400 text-sm">No plans available right now.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((p, i) => (
              <div key={p.id} className={`rounded-xl border p-6 ${i === 1 ? "border-emerald-300 shadow-lg ring-1 ring-emerald-100 relative" : "border-slate-200"}`}>
                {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">Popular</span>}
                <h3 className="font-bold text-slate-900 text-lg">{p.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{p.description || `${p.speed_mbps} Mbps speed`}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">${p.monthly_price}</span>
                  <span className="text-sm text-slate-400">/month</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> {p.speed_mbps} Mbps speed</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> {p.validity_days} day validity</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Free installation</li>
                </ul>
                <Link to="/portal/login" className={`mt-6 block text-center py-2.5 rounded-lg font-semibold text-sm ${i === 1 ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Get Started</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to get connected?</h2>
          <p className="text-slate-300 mt-2">Log in to your customer portal to manage everything in one place.</p>
          <Link to="/portal/login" className="inline-flex items-center gap-2 mt-6 bg-emerald-600 px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700">Access My Account <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <div className="flex items-center gap-2"><Wifi className="w-4 h-4 text-emerald-600" /> <span>NetScale Flow Pro</span></div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> 1300 000 000</span>
            <Link to="/portal/login" className="hover:text-slate-600">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}