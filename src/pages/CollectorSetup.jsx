import React, { useState } from "react";
import { KeyRound, RefreshCw, Copy, Check, ShieldCheck, Terminal, Settings2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

function generateKey(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function CollectorSetup() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState(() => generateKey());
  const [copied, setCopied] = useState(false);

  const regenerate = () => {
    setApiKey(generateKey());
    setCopied(false);
    toast({ title: "New key generated" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const steps = [
    {
      icon: Settings2,
      title: "1. Save it as an environment variable",
      body: "In your backend host's dashboard (e.g. Railway → your server service → Variables), add a variable named COLLECTOR_API_KEY and paste this key as the value.",
    },
    {
      icon: Terminal,
      title: "2. Put it in the collector script",
      body: "Open collector.js and set the COLLECTOR_API_KEY constant at the top to the exact same value.",
    },
    {
      icon: Download,
      title: "3. Run the collector",
      body: "On a machine on the same network as your router: cd collector && npm install && npm start",
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-emerald-500" /> Collector Setup
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Generate a secret key that authenticates your local collector agent with this app.
        </p>
      </div>

      {/* Key generator card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Collector API Key
          </label>
          <Button variant="outline" size="sm" onClick={regenerate}>
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            readOnly
            value={apiKey}
            className="font-mono text-xs"
            onFocus={(e) => e.target.select()}
          />
          <Button onClick={copy} variant="secondary">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          64-character hex key. Keep it private — anyone with this key can sync router data into your app.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{s.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{s.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}