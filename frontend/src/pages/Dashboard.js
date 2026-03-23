import React from "react";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { getCompanies, getCampaigns } from "../utils/api";

function StatCard({ label, value, to, color }) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <div className="card" style={{ textAlign: "center", cursor: "pointer" }}>
        <div style={{ fontSize: "2rem", fontWeight: 700, color }}>{value ?? "—"}</div>
        <div style={{ fontSize: ".875rem", color: "var(--color-muted)", marginTop: ".25rem" }}>{label}</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: companiesData } = useQuery("companies-count", () => getCompanies({ per_page: 1 }));
  const { data: campaignsData } = useQuery("campaigns", getCampaigns);

  const totalCompanies = companiesData?.data?.total ?? 0;
  const campaigns = campaignsData?.data ?? [];
  const running = campaigns.filter((c) => c.status === "running").length;
  const completed = campaigns.filter((c) => c.status === "completed").length;
  const totalSent = campaigns.reduce((sum, c) => sum + (c.stats?.sent ?? 0), 0);

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: ".5rem" }}>
        Dashboard
      </h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1.75rem" }}>
        Overview of your nonprofit donation outreach
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard label="Companies in Database" value={totalCompanies} to="/companies" color="var(--color-primary)" />
        <StatCard label="Active Campaigns" value={running} to="/campaigns" color="var(--color-success)" />
        <StatCard label="Completed Campaigns" value={completed} to="/campaigns" color="var(--color-muted)" />
        <StatCard label="Total Emails Sent" value={totalSent} to="/campaigns" color="#7c3aed" />
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Recent Campaigns</h2>
        {campaigns.length === 0 ? (
          <p style={{ color: "var(--color-muted)", fontSize: ".875rem" }}>
            No campaigns yet. <Link to="/campaigns">Create one →</Link>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 10).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                  <td>{c.stats?.sent ?? 0}</td>
                  <td>{c.stats?.failed ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: "1.25rem", background: "#fffbeb", borderColor: "#fde68a" }}>
        <h3 style={{ fontSize: ".95rem", fontWeight: 600, marginBottom: ".5rem", color: "#92400e" }}>
          Ethical Use Reminder
        </h3>
        <ul style={{ fontSize: ".85rem", color: "#78350f", paddingLeft: "1.25rem", lineHeight: 1.8 }}>
          <li>Only scrape websites that permit crawling (robots.txt is always checked).</li>
          <li>Respect CAN-SPAM / CASL: every email includes an opt-out notice and honest From headers.</li>
          <li>Keep sending rates low (daily limit &amp; inter-email delay) to avoid being flagged as spam.</li>
          <li>Verify collected contacts before sending to ensure accuracy.</li>
        </ul>
      </div>
    </div>
  );
}
