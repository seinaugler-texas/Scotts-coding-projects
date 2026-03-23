import React, { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { scrapeUrls, bulkImportCompanies } from "../utils/api";

export default function ScraperPage() {
  const qc = useQueryClient();
  const [urlText, setUrlText] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [autoImport, setAutoImport] = useState(false);

  const scrapeMut = useMutation(
    ({ urls, auto_import }) => scrapeUrls(urls, auto_import),
    {
      onSuccess: (res) => {
        setResults(res.data.results ?? []);
        setSelected(new Set());
        if (autoImport) qc.invalidateQueries("companies");
      },
    }
  );

  const importMut = useMutation(bulkImportCompanies, {
    onSuccess: (res) => {
      alert(`Imported ${res.data.created} companies (${res.data.skipped} skipped as duplicates).`);
      qc.invalidateQueries("companies");
    },
  });

  const handleScrape = () => {
    const urls = urlText
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));
    if (!urls.length) return alert("Enter at least one valid URL (must start with http/https).");
    if (urls.length > 50) return alert("Maximum 50 URLs per batch.");
    scrapeMut.mutate({ urls, auto_import: autoImport });
  };

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleImportSelected = () => {
    const toImport = [...selected].map((i) => results[i]).filter((r) => r.name && !r.notes?.startsWith("Skipped"));
    importMut.mutate(toImport);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: ".5rem" }}>Web Scraper</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1.25rem", fontSize: ".875rem" }}>
        Enter company website URLs (one per line) to extract donation email addresses and submission form links.
        The scraper always respects <code>robots.txt</code> and only collects publicly available contact info.
      </p>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div className="form-group">
          <label>Website URLs (one per line, max 50)</label>
          <textarea
            className="form-control"
            rows={6}
            placeholder={"https://www.example-company.com\nhttps://www.another-company.org"}
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            style={{ fontFamily: "monospace", fontSize: ".85rem" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: ".875rem", cursor: "pointer" }}>
            <input type="checkbox" checked={autoImport} onChange={(e) => setAutoImport(e.target.checked)} />
            Auto-import all valid results into Companies
          </label>
          <button
            className="btn btn-primary"
            onClick={handleScrape}
            disabled={scrapeMut.isLoading}
          >
            {scrapeMut.isLoading ? "Scraping…" : "Start Scraping"}
          </button>
        </div>
      </div>

      {scrapeMut.isError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--radius)", padding: ".75rem 1rem", marginBottom: "1rem", color: "#991b1b", fontSize: ".875rem" }}>
          Error: {scrapeMut.error?.response?.data?.error ?? scrapeMut.error?.message}
        </div>
      )}

      {results.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: ".75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: ".875rem", fontWeight: 600 }}>{results.length} results</span>
            {selected.size > 0 && (
              <button className="btn btn-success" onClick={handleImportSelected} disabled={importMut.isLoading}>
                {importMut.isLoading ? "Importing…" : `Import ${selected.size} selected`}
              </button>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Company Name</th>
                <th>Donation Email</th>
                <th>Form URL</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const isSkipped = r.notes?.startsWith("Skipped") || r.notes?.startsWith("Failed");
                return (
                  <tr key={i} style={{ opacity: isSkipped ? 0.5 : 1 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        disabled={isSkipped || !r.name}
                        onChange={() => toggleSelect(i)}
                      />
                    </td>
                    <td style={{ fontWeight: 500 }}>{r.name || <span style={{ color: "var(--color-muted)" }}>—</span>}</td>
                    <td style={{ fontSize: ".85rem" }}>{r.donation_email || <span style={{ color: "var(--color-muted)" }}>—</span>}</td>
                    <td style={{ fontSize: ".8rem" }}>
                      {r.submission_form_url
                        ? <a href={r.submission_form_url} target="_blank" rel="noreferrer">Open</a>
                        : <span style={{ color: "var(--color-muted)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: ".8rem", color: "var(--color-muted)" }}>{r.notes || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
