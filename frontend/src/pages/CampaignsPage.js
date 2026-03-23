import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  getCampaigns, createCampaign, scheduleCampaign,
  pauseCampaign, resumeCampaign, deleteCampaign,
  getCampaignLogs, getTemplates, getCompanies,
  addCompaniesToCampaign, previewCampaign,
} from "../utils/api";
import { format } from "date-fns";

function CampaignModal({ templates, onClose, onSave }) {
  const [form, setForm] = useState({
    name: "", template_id: templates[0]?.id ?? "",
    nonprofit_name: "", nonprofit_mission: "",
    sender_name: "", sender_email: "", sender_phone: "",
    scheduled_at: "", daily_limit: 20, delay_between_emails: 60,
  });

  const handle = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div className="card" style={{ width: 560, maxHeight: "92vh", overflow: "auto" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>New Campaign</h2>

        <div className="form-group">
          <label>Campaign Name</label>
          <input className="form-control" name="name" value={form.name} onChange={handle} />
        </div>

        <div className="form-group">
          <label>Email Template</label>
          <select className="form-control" name="template_id" value={form.template_id} onChange={handle}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Nonprofit Name</label>
          <input className="form-control" name="nonprofit_name" value={form.nonprofit_name} onChange={handle} />
        </div>

        <div className="form-group">
          <label>Mission Statement (used in template)</label>
          <textarea className="form-control" name="nonprofit_mission" rows={2} value={form.nonprofit_mission} onChange={handle} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
          <div className="form-group">
            <label>Sender Name</label>
            <input className="form-control" name="sender_name" value={form.sender_name} onChange={handle} />
          </div>
          <div className="form-group">
            <label>Sender Email</label>
            <input className="form-control" name="sender_email" type="email" value={form.sender_email} onChange={handle} />
          </div>
        </div>

        <div className="form-group">
          <label>Sender Phone (optional)</label>
          <input className="form-control" name="sender_phone" value={form.sender_phone} onChange={handle} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
          <div className="form-group">
            <label>Daily Email Limit</label>
            <input className="form-control" name="daily_limit" type="number" min={1} max={200} value={form.daily_limit} onChange={handle} />
          </div>
          <div className="form-group">
            <label>Delay Between Emails (sec)</label>
            <input className="form-control" name="delay_between_emails" type="number" min={5} value={form.delay_between_emails} onChange={handle} />
          </div>
        </div>

        <div className="form-group">
          <label>Schedule Start (optional — leave blank to start immediately)</label>
          <input className="form-control" name="scheduled_at" type="datetime-local" value={form.scheduled_at} onChange={handle} />
        </div>

        <div style={{ display: "flex", gap: ".75rem", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Create Campaign</button>
        </div>
      </div>
    </div>
  );
}

function LogsModal({ campaignId, onClose }) {
  const { data, isLoading } = useQuery(["campaign-logs", campaignId], () => getCampaignLogs(campaignId));
  const logs = data?.data ?? [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div className="card" style={{ width: 700, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Outreach Logs</h2>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        {isLoading ? <p>Loading…</p> : (
          <table>
            <thead>
              <tr><th>Company ID</th><th>Status</th><th>Email Used</th><th>Sent At</th><th>Error</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.company_id}</td>
                  <td><span className={`badge badge-${l.status}`}>{l.status}</span></td>
                  <td style={{ fontSize: ".8rem" }}>{l.email_used || "—"}</td>
                  <td style={{ fontSize: ".8rem" }}>{l.sent_at ? format(new Date(l.sent_at), "MMM d, HH:mm") : "—"}</td>
                  <td style={{ fontSize: ".75rem", color: "var(--color-danger)" }}>{l.error_message || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PreviewModal({ campaignId, onClose }) {
  const { data, isLoading } = useQuery(["campaign-preview", campaignId], () => previewCampaign(campaignId));
  const preview = data?.data;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div className="card" style={{ width: 680, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Email Preview</h2>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        {isLoading ? <p>Loading…</p> : preview && (
          <>
            <div style={{ marginBottom: ".75rem", fontSize: ".8rem", color: "var(--color-muted)" }}>
              Template: <strong>{preview.template_name}</strong> · Sample data used for variable substitution
            </div>
            <div className="card" style={{ background: "var(--color-bg)", marginBottom: ".75rem" }}>
              <div style={{ fontSize: ".75rem", color: "var(--color-muted)", marginBottom: ".25rem", textTransform: "uppercase", letterSpacing: ".05em" }}>Subject</div>
              <div style={{ fontWeight: 600 }}>{preview.subject}</div>
            </div>
            <div className="card" style={{ background: "var(--color-bg)" }}>
              <div style={{ fontSize: ".75rem", color: "var(--color-muted)", marginBottom: ".5rem", textTransform: "uppercase", letterSpacing: ".05em" }}>Body</div>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: ".85rem", lineHeight: 1.7 }}>{preview.body}</pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddCompaniesModal({ campaignId, onClose, onDone }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const { data, isLoading } = useQuery(
    ["companies-picker", page, search],
    () => getCompanies({ page, per_page: 15, search }),
    { keepPreviousData: true }
  );

  const addMut = useMutation(
    (ids) => addCompaniesToCampaign(campaignId, ids),
    { onSuccess: (res) => { alert(`Added ${res.data.added} companies to campaign.`); onDone(); } }
  );

  const companies = data?.data?.companies ?? [];
  const totalPages = data?.data?.pages ?? 1;

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    const ids = companies.map((c) => c.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      allSelected ? ids.forEach((id) => next.delete(id)) : ids.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div className="card" style={{ width: 680, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Add Companies to Campaign</h2>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>

        <input
          className="form-control"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ marginBottom: ".75rem" }}
        />

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
          {isLoading ? <p style={{ padding: "1rem", color: "var(--color-muted)" }}>Loading…</p> : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox"
                      checked={companies.length > 0 && companies.every((c) => selected.has(c.id))}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>Donation Email</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => toggle(c.id)}>
                    <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} /></td>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ fontSize: ".8rem" }}>{c.donation_email || <span style={{ color: "var(--color-muted)" }}>—</span>}</td>
                    <td>{c.verified ? "✓" : ""}</td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "1rem", color: "var(--color-muted)", textAlign: "center" }}>No companies found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem", alignItems: "center", justifyContent: "center" }}>
            <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span style={{ fontSize: ".875rem" }}>Page {page} / {totalPages}</span>
            <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <span style={{ fontSize: ".875rem", color: "var(--color-muted)" }}>{selected.size} selected</span>
          <button
            className="btn btn-primary"
            disabled={selected.size === 0 || addMut.isLoading}
            onClick={() => addMut.mutate([...selected])}
          >
            {addMut.isLoading ? "Adding…" : `Add ${selected.size} Companies`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [logsFor, setLogsFor] = useState(null);
  const [previewFor, setPreviewFor] = useState(null);
  const [addCompaniesFor, setAddCompaniesFor] = useState(null);

  const { data } = useQuery("campaigns", getCampaigns);
  const { data: templatesData } = useQuery("templates", getTemplates);
  const campaigns = data?.data ?? [];
  const templates = templatesData?.data ?? [];

  const createMut = useMutation(createCampaign, { onSuccess: () => { qc.invalidateQueries("campaigns"); setShowNew(false); } });
  const scheduleMut = useMutation(scheduleCampaign, { onSuccess: () => qc.invalidateQueries("campaigns") });
  const pauseMut = useMutation(pauseCampaign, { onSuccess: () => qc.invalidateQueries("campaigns") });
  const resumeMut = useMutation(resumeCampaign, { onSuccess: () => qc.invalidateQueries("campaigns") });
  const deleteMut = useMutation(deleteCampaign, { onSuccess: () => qc.invalidateQueries("campaigns") });

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Campaigns</h1>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Campaign</button>
      </div>

      {campaigns.length === 0 ? (
        <div className="card" style={{ color: "var(--color-muted)" }}>No campaigns yet.</div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {campaigns.map((c) => (
            <div className="card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1rem" }}>{c.name}</div>
                  <div style={{ fontSize: ".825rem", color: "var(--color-muted)" }}>
                    {c.nonprofit_name} · Limit: {c.daily_limit}/day · Delay: {c.delay_between_emails}s
                  </div>
                  <div style={{ display: "flex", gap: ".75rem", marginTop: ".5rem", fontSize: ".85rem" }}>
                    <span>Sent: <b>{c.stats?.sent ?? 0}</b></span>
                    <span>Failed: <b>{c.stats?.failed ?? 0}</b></span>
                    <span>Total: <b>{c.stats?.total ?? 0}</b></span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: ".5rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span className={`badge badge-${c.status}`}>{c.status}</span>
                  {c.status === "draft" && (
                    <button className="btn btn-success" onClick={() => scheduleMut.mutate(c.id)}>Schedule</button>
                  )}
                  {c.status === "running" && (
                    <button className="btn btn-secondary" onClick={() => pauseMut.mutate(c.id)}>Pause</button>
                  )}
                  {c.status === "paused" && (
                    <button className="btn btn-primary" onClick={() => resumeMut.mutate(c.id)}>Resume</button>
                  )}
                  <button className="btn btn-secondary" onClick={() => setPreviewFor(c.id)}>Preview</button>
                  <button className="btn btn-secondary" onClick={() => setAddCompaniesFor(c.id)}>+ Companies</button>
                  <button className="btn btn-secondary" onClick={() => setLogsFor(c.id)}>Logs</button>
                  <button className="btn btn-danger" onClick={() => { if (window.confirm("Delete campaign?")) deleteMut.mutate(c.id); }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <CampaignModal templates={templates} onClose={() => setShowNew(false)} onSave={(form) => createMut.mutate(form)} />}
      {logsFor && <LogsModal campaignId={logsFor} onClose={() => setLogsFor(null)} />}
      {previewFor && <PreviewModal campaignId={previewFor} onClose={() => setPreviewFor(null)} />}
      {addCompaniesFor && (
        <AddCompaniesModal
          campaignId={addCompaniesFor}
          onClose={() => setAddCompaniesFor(null)}
          onDone={() => { setAddCompaniesFor(null); qc.invalidateQueries("campaigns"); }}
        />
      )}
    </div>
  );
}
