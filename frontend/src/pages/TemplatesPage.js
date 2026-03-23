import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getTemplateVariables } from "../utils/api";

function TemplateEditor({ template, variables, onClose, onSave }) {
  const [form, setForm] = useState({
    name: template?.name ?? "",
    subject: template?.subject ?? "",
    body: template?.body ?? "",
    is_default: template?.is_default ?? false,
  });

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const insertVar = (key) => {
    const tag = `{{${key}}}`;
    setForm((f) => ({ ...f, body: f.body + tag }));
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div className="card" style={{ width: 680, maxHeight: "92vh", overflow: "auto" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
          {template ? "Edit Template" : "New Template"}
        </h2>

        <div className="form-group">
          <label>Template Name</label>
          <input className="form-control" name="name" value={form.name} onChange={handle} placeholder="e.g. Standard Donation Request" />
        </div>

        <div className="form-group">
          <label>Subject Line</label>
          <input className="form-control" name="subject" value={form.subject} onChange={handle} placeholder="e.g. Request for Support to {{nonprofit_name}}" />
        </div>

        <div className="form-group">
          <label>Email Body</label>
          <div style={{ marginBottom: ".4rem", display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
            {(variables ?? []).map((v) => (
              <button
                key={v.key}
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: ".72rem", padding: ".2rem .6rem" }}
                onClick={() => insertVar(v.key)}
                title={v.description}
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
          <textarea
            className="form-control"
            name="body"
            rows={12}
            value={form.body}
            onChange={handle}
            style={{ fontFamily: "monospace", fontSize: ".875rem" }}
          />
        </div>

        <div className="form-group" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <input type="checkbox" id="is_default" name="is_default" checked={form.is_default} onChange={handle} />
          <label htmlFor="is_default" style={{ marginBottom: 0 }}>Set as default template</label>
        </div>

        <div style={{ display: "flex", gap: ".75rem", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save Template</button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data } = useQuery("templates", getTemplates);
  const { data: varData } = useQuery("template-vars", getTemplateVariables);
  const templates = data?.data ?? [];
  const variables = varData?.data?.variables ?? [];

  const createMut = useMutation(createTemplate, { onSuccess: () => { qc.invalidateQueries("templates"); setModal(null); } });
  const updateMut = useMutation(({ id, data }) => updateTemplate(id, data), { onSuccess: () => { qc.invalidateQueries("templates"); setModal(null); } });
  const deleteMut = useMutation(deleteTemplate, { onSuccess: () => qc.invalidateQueries("templates") });

  const handleSave = (form) => {
    if (modal === "new") createMut.mutate(form);
    else updateMut.mutate({ id: modal.id, data: form });
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Email Templates</h1>
        <button className="btn btn-primary" onClick={() => setModal("new")}>+ New Template</button>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {templates.map((t) => (
          <div className="card" key={t.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name} {t.is_default && <span className="badge badge-scheduled" style={{ marginLeft: ".5rem" }}>Default</span>}</div>
                <div style={{ fontSize: ".825rem", color: "var(--color-muted)", marginTop: ".25rem" }}>Subject: {t.subject}</div>
              </div>
              <div style={{ display: "flex", gap: ".5rem", flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => setModal(t)}>Edit</button>
                <button className="btn btn-danger" onClick={() => { if (window.confirm("Delete template?")) deleteMut.mutate(t.id); }}>Delete</button>
              </div>
            </div>
            <pre style={{
              marginTop: ".75rem", padding: ".75rem", background: "var(--color-bg)",
              borderRadius: "var(--radius)", fontSize: ".8rem", whiteSpace: "pre-wrap",
              maxHeight: 180, overflow: "auto", border: "1px solid var(--color-border)",
            }}>
              {t.body}
            </pre>
          </div>
        ))}
      </div>

      {modal && (
        <TemplateEditor
          template={modal === "new" ? null : modal}
          variables={variables}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
