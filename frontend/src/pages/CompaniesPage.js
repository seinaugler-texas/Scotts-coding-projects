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

  const createMut = useMutation(createCompany, { onSuccess: () => { qc.invalidateQueries
