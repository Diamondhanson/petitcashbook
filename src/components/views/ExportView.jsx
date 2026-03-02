import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import * as pettyCashApi from "../../utils/pettyCashApi";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 20 },
  table: { flexDirection: "row", flexWrap: "wrap" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, paddingVertical: 6 },
  cell: { width: "25%", fontSize: 10 },
});

function ExportView() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const exportExcel = async () => {
    setLoading(true);
    const opts = {};
    if (startDate) opts.startDate = startDate + "T00:00:00.000Z";
    if (endDate) opts.endDate = endDate + "T23:59:59.999Z";
    const { data } = await pettyCashApi.getDisbursedRequestsForExport?.(opts);
    setLoading(false);
    if (!data?.length) {
      alert("No data to export");
      return;
    }
    const rows = data.map((r) => ({
      Date: r.created_at?.slice(0, 10),
      Requester: r.requester?.full_name ?? "",
      Purpose: r.purpose,
      Category: r.category,
      Amount: r.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Disbursements");
    XLSX.writeFile(wb, `disbursements-${startDate || "all"}-${endDate || "all"}.xlsx`);
  };

  const exportPdf = async () => {
    setLoading(true);
    const opts = {};
    if (startDate) opts.startDate = startDate + "T00:00:00.000Z";
    if (endDate) opts.endDate = endDate + "T23:59:59.999Z";
    const { data } = await pettyCashApi.getDisbursedRequestsForExport?.(opts);
    setLoading(false);
    if (!data?.length) {
      alert("No data to export");
      return;
    }
    const Doc = () => (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Disbursements Report</Text>
          {data.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cell}>{r.created_at?.slice(0, 10)}</Text>
              <Text style={styles.cell}>{r.requester?.full_name ?? ""}</Text>
              <Text style={styles.cell}>{r.purpose}</Text>
              <Text style={styles.cell}>{r.amount} FCFA</Text>
            </View>
          ))}
        </Page>
      </Document>
    );
    const blob = await pdf(<Doc />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disbursements-${startDate || "all"}-${endDate || "all"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-lg font-semibold text-brand-dark">Export</h2>
      <p className="mb-6 text-slate-600">
        Export disbursed requests by date range. Leave empty for all data.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-dark">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-brand-dark"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-dark">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-brand-dark"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={exportExcel}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportView;
