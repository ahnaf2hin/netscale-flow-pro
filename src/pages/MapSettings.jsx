import React, { useState, useEffect } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, MapPin, RefreshCw, Save, Eye, EyeOff, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function MapSettings() {
  const [recordId, setRecordId] = useState(null);
  const [form, setForm] = useState({ provider: "esri", google_maps_api_key: "", google_map_type: "roadmap", notes: "" });
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const list = await netscaleApi.entities.MapSetting.list("-created_date", 10);
      if (list.length > 0) {
        const r = list[0];
        setRecordId(r.id);
        setForm({
          provider: r.provider || "esri",
          google_maps_api_key: r.google_maps_api_key || "",
          google_map_type: r.google_map_type || "roadmap",
          notes: r.notes || "",
        });
      }
    } catch (err) { toast({ variant: "destructive", title: "Failed to load", description: err.message }); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        provider: form.provider,
        google_maps_api_key: form.google_maps_api_key,
        google_map_type: form.google_map_type,
        notes: form.notes,
      };
      if (recordId) {
        await netscaleApi.entities.MapSetting.update(recordId, payload);
      } else {
        const created = await netscaleApi.entities.MapSetting.create(payload);
        setRecordId(created.id);
      }
      toast({ title: "Map settings saved" });
    } catch (err) { toast({ variant: "destructive", title: "Save failed", description: err.message }); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  const isGoogle = form.provider === "google";

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Map Settings</h1>
            <p className="text-xs text-slate-500">Map provider & Google Maps API key</p>
          </div>
        </div>
        <button onClick={loadSettings} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="max-w-2xl glass-card p-6 space-y-5">
        <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-800">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Google Maps requires an API key with <b>Maps JavaScript API</b> enabled in your Google Cloud project (billing may apply). No key? Leave the provider as <b>Esri Satellite</b> for a free live satellite map.</span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Map Provider</Label>
          <Select value={form.provider} onValueChange={v => setForm({ ...form, provider: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="esri">Esri Satellite (free, no key)</SelectItem>
              <SelectItem value="google">Google Maps</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isGoogle && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Google Maps API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={form.google_maps_api_key}
                  onChange={e => setForm({ ...form, google_maps_api_key: e.target.value })}
                  placeholder="AIza..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Restrict this key to your app domain in Google Cloud for security.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Default Map Type</Label>
              <Select value={form.google_map_type} onValueChange={v => setForm({ ...form, google_map_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="roadmap">Roadmap</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Internal notes" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </Button>
          <Link to="/network-map" className="text-xs text-slate-500 hover:text-blue-600">View Network Map →</Link>
        </div>
      </div>

      <div className="mt-6">
        <Link to="/configuration" className="text-xs text-slate-500 hover:text-blue-600">← Back to Configuration</Link>
      </div>
    </div>
  );
}