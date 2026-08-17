import React, { useState, useRef } from "react";
import { netscaleApi } from "@/api/apiClient";
import { Loader2, UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, ArrowRight, Trash2, Download } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const CUSTOMER_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    address: { type: "string" },
    status: { type: "string", enum: ["active", "suspended", "inactive"] },
    package_id: { type: "string" },
    pppoe_username: { type: "string" },
    pppoe_password: { type: "string" },
    connection_date: { type: "string", format: "date" },
    notes: { type: "string" },
  },
  required: ["name", "phone"],
};

export default function BulkImport() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState("idle");
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null); setFileName(""); setStage("idle"); setRows([]); setErrors([]); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChosen = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setFileName(f.name); setStage("idle"); setRows([]); setErrors([]); setResult(null);
  };

  const parseFile = async () => {
    if (!file) return;
    setStage("parsing");
    setRows([]); setErrors([]); setResult(null);
    try {
      const up = await netscaleApi.integrations.Core.UploadFile({ file });
      const extracted = await netscaleApi.integrations.Core.ExtractDataFromUploadedFile({
        file_url: up.file_url,
        json_schema: CUSTOMER_SCHEMA,
      });
      if (extracted.status === "error") {
        setErrors([extracted.details || "Failed to parse file"]);
        setStage("error");
        return;
      }
      const list = Array.isArray(extracted.output) ? extracted.output : (extracted.output ? [extracted.output] : []);
      if (list.length === 0) {
        setErrors(["No rows could be extracted from this file."]);
        setStage("error");
        return;
      }
      const valid = [];
      const invalid = [];
      list.forEach((r, i) => {
        if (r && r.name && r.phone) valid.push({ ...r, status: r.status || "active" });
        else invalid.push({ row: i + 2, reason: !r?.name ? "Missing name" : "Missing phone", data: r });
      });
      setRows(valid);
      setErrors(invalid);
      setStage(valid.length > 0 ? "preview" : "error");
    } catch (err) {
      setErrors([err.response?.data?.error || err.message]);
      setStage("error");
    }
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const created = await netscaleApi.entities.Customer.bulkCreate(rows);
      setResult({ success: created.length, total: rows.length });
      setStage("done");
      toast({ title: `${created.length} customers imported` });
      setRows([]);
    } catch (err) {
      toast({ title: "Import failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ["name", "phone", "email", "address", "status", "package_id", "pppoe_username", "pppoe_password", "connection_date", "notes"];
    const sample = ["John Doe", "01712345678", "john@example.com", "123 Main St", "active", "", "john_doe", "pass123", "2026-01-15", "New customer"];
    const csv = [headers.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "customer_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <PageHeader icon={UploadCloud} iconBg="bg-blue-600" title="Bulk Import Customers" subtitle="Upload a spreadsheet to import existing customer data in one go">
        <button onClick={downloadTemplate} className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm"><Download className="w-3.5 h-3.5" /> Download Template</button>
      </PageHeader>

      <div className="max-w-3xl mx-auto space-y-5">
        {/* Step 1: Upload */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
            <h2 className="text-sm font-semibold text-slate-800">Select Spreadsheet File</h2>
          </div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); setFileName(f.name); setStage("idle"); } }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          >
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.json" onChange={onFileChosen} className="hidden" />
            {fileName ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                <p className="text-sm font-medium text-slate-800">{fileName}</p>
                <p className="text-xs text-slate-500">{(file?.size / 1024).toFixed(1)} KB — click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="w-10 h-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Click to upload or drag & drop</p>
                <p className="text-xs text-slate-400">CSV, Excel (.xlsx, .xls) or JSON — max 25MB</p>
              </div>
            )}
          </div>
          {file && stage === "idle" && (
            <Button onClick={parseFile} className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
              <ArrowRight className="w-4 h-4 mr-2" /> Parse & Preview
            </Button>
          )}
          {stage === "parsing" && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Parsing spreadsheet…</div>
          )}
        </div>

        {/* Parse errors */}
        {stage === "error" && (
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3 text-red-700"><AlertTriangle className="w-5 h-5" /><h2 className="text-sm font-semibold">Parsing Issues</h2></div>
            <ul className="space-y-1.5 text-xs text-slate-600 max-h-60 overflow-y-auto">
              {errors.map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{typeof e === "string" ? e : `Row ${e.row}: ${e.reason}`}</span>
                </li>
              ))}
            </ul>
            <Button onClick={reset} variant="outline" className="mt-4">Try Another File</Button>
          </div>
        )}

        {/* Step 2: Preview */}
        {stage === "preview" && (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="text-sm font-semibold text-slate-800">Review Parsed Data</h2>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{rows.length} valid rows</span>
            </div>

            {errors.length > 0 && (
              <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {errors.length} row(s) skipped due to missing required fields (name or phone).
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">#</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Name</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Phone</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2 hidden sm:table-cell">Email</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2 hidden md:table-cell">Address</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">Status</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase px-3 py-2 hidden lg:table-cell">PPPoE User</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">{r.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{r.phone}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 hidden sm:table-cell">{r.email || "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 hidden md:table-cell max-w-[160px] truncate">{r.address || "—"}</td>
                      <td className="px-3 py-2"><span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{r.status}</span></td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500 hidden lg:table-cell">{r.pppoe_username || "—"}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="w-6 h-6 rounded-md bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto"><Trash2 className="w-3 h-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-5">
              <Button onClick={reset} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={doImport} disabled={importing || rows.length === 0} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</> : <><CheckCircle className="w-4 h-4 mr-2" /> Import {rows.length} Customers</>}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {stage === "done" && result && (
          <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-emerald-600" /></div>
            <h2 className="text-lg font-bold text-slate-900">Import Complete</h2>
            <p className="text-sm text-slate-500 mt-1">{result.success} of {result.total} customers were successfully added to your database.</p>
            <div className="flex gap-3 mt-6 max-w-xs mx-auto">
              <Button onClick={reset} variant="outline" className="flex-1">Import More</Button>
              <Button onClick={() => window.location.href = "/customers"} className="flex-1 bg-blue-600 hover:bg-blue-700">View Customers</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}