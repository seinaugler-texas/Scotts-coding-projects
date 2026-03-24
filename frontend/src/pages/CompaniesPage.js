import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { getCompanies, createCompany, updateCompany, deleteCompany, bulkImportCompanies } from "../utils/api";

function CompanyModal({ company, onClose, onSave }) {
  const [form, setForm] = useState({
    name: company?.name ?? "",
    website: company?.website ?? "",
    donation_email: company?.donation_email ?? "",
    submission_form_url: company?.submission_form_url ?? "",
    contact_name: company?.contact_name ?? "",
    notes: company?.notes ?? "",
    verified: company?.verified ?? false,
  });

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div className="card" style={{ width: 520, maxHeight: "90vh", overflow: "auto" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
          {company ? "Edit Company" : "Add Company"}
        </h2>

        {["name", "website", "donation_email", "submission_form_url", "contact_name"].map((field) => (
          <div className="form-group" key={field}>
            <label>{field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</label>
            <input className="form-control" name={field} value={form[field]} onChange={handle} />
          </div>
        ))}

        <div className="form-group">
          <label>Notes</label>
          <textarea className="form-control" name="notes" rows={3} value={form.notes} onChange={handle} />
        </div>

        <div className="form-group" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <input type="checkbox" id="verified" name="verified" checked={form.verified} onChange={handle} />
          <label htmlFor="verified" style={{ marginBottom: 0 }}>Verified contact</label>
        </div>

        <div style={{ display: "flex", gap: ".75rem", justifyContent: "flex-end", marginTop: ".5rem" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const fileRef = useRef();

  const { data, isLoading } = useQuery(
    ["companies", page, search],
    () => getCompanies({ page, per_page: 20, search }),
    { keepPreviousData: true }
  );

  const createMut = useMutation(createCompany, { onSuccess: () => { qc.invalidateQueries("companies"); setModal(null); } });
  const updateMut = useMutation(({ id, data }) => updateCompany(id, data), { onSuccess: () => { qc.invalidateQueries("companies"); setModal(null); } });
  const deleteMut = useMutation(deleteCompany, { onSuccess: () => qc.invalidateQueries("companies") });
  const bulkMut = useMutation(bulkImportCompanies, {
    onSuccess: (res) => {
      qc.invalidateQueries("companies");
      setImportMsg(`✅ Imported ${res.data.created} companies, skipped ${res.data.skipped} duplicates.`);
      setTimeout(() => setImportMsg(null), 5000);
    },
    onError: () => setImportMsg("❌ Import failed. Check your CSV format."),
  });

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        const companies = lines.slice(1).map((line) => {
          const values = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
              inQuotes = !inQuotes;
            } else if (line[i] === "," && !inQuotes) {
              values.push(current.trim());
              current = "";
            } else {
              current += line[i];
            }
          }
          values.push(current.trim());
          const obj = {};
          headers.forEach((h, i) => { obj[h] = values[i] || ""; });
          return obj;
        }).filter((c) => c.name);
        bulkMut.mutate(companies);
      } catch (err) {
        setImportMsg("❌ Import failed. Check your CSV format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const headers = "name,website,donation_email,submission_form_url,contact_name,notes\n";
    const example = "HEB,https://newsroom.heb.com/support,,https://newsroom.heb.com/community/apply-for-support,Community Investment Program,Apply 8 weeks before event\n";
    const blob = new Blob([headers + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "companies_template.csv";
    a.click();
  };

  const companies = data?.data?.companies ?? [];
  const totalPages = data?.data?.pages ?? 1;

  const handleSave = (form) => {
    if (modal === "add") createMut.mutate(form);
    else updateMut.mutate({ id: modal.id, data: form });
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Companies</h1>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={downloadTemplate}>📥 CSV Template</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current.click()}>📤 Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSVImport} />
          <a className="btn btn-secondary" href="/api/companies/export" download="companies.csv">Export CSV</a>
          <button className="btn btn-primary" onClick={() => setModal("add")}>+ Add Company</button>
        </div>
      </div>

      {importMsg && (
        <div style={{ padding: ".75rem 1rem", marginBottom: "1rem", background: importMsg.startsWith("✅") ? "#d1fae5" : "#fee2e2", borderRadius: 8, fontSize: ".875rem" }}>
          {importMsg}
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <input
          className="form-control"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: "1.5rem", color: "var(--color-muted)" }}>Loading…</p>
        ) : companies.length === 0 ? (
          <p style={{ padding: "1.5rem", color: "var(--color-muted)" }}>
            No companies found. Add one manually, import a CSV, or use the Scraper.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Donation Email</th>
                <th>Form URL</th>
                <th>Verified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>{c.donation_email || <span style={{ color: "var(--color-muted)" }}>—</span>}</td>
                  <td>
                    {c.submission_form_url
                      ? <a href={c.submission_form_url} target="_blank" rel="noreferrer" style={{ fontSize: ".8rem" }}>Open Form</a>
                      : <span style={{ color: "var(--color-muted)" }}>—</span>}
                  </td>
                  <td>{c.verified ? "✓" : ""}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ marginRight: ".5rem" }} onClick={() => setModal(c)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm("Delete this company?")) deleteMut.mutate(c.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: ".5rem", marginTop: "1rem", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ alignSelf: "center", fontSize: ".875rem" }}>Page {page} / {totalPages}</span>
          <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {modal && (
        <CompanyModal
          company={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
