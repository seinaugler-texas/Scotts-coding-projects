import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CompaniesPage from "./pages/CompaniesPage";
import TemplatesPage from "./pages/TemplatesPage";
import CampaignsPage from "./pages/CampaignsPage";
import ScraperPage from "./pages/ScraperPage";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/companies", label: "Companies" },
  { to: "/templates", label: "Email Templates" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/scraper", label: "Scraper" },
];

export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{
        width: 220, background: "#1e293b", color: "#fff",
        display: "flex", flexDirection: "column", padding: "1.5rem 0",
        flexShrink: 0,
      }}>
        <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid #334155" }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#60a5fa" }}>
            Nonprofit Outreach
          </div>
          <div style={{ fontSize: ".75rem", color: "#94a3b8", marginTop: ".2rem" }}>
            Donation Request Automation
          </div>
        </div>
        <div style={{ padding: ".75rem 0", flex: 1 }}>
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: "block",
              padding: ".55rem 1.25rem",
              fontSize: ".875rem",
              color: isActive ? "#fff" : "#94a3b8",
              background: isActive ? "#2563eb" : "transparent",
              textDecoration: "none",
              transition: "background .15s",
            })}>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main style={{ flex: 1, overflow: "auto" }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/scraper" element={<ScraperPage />} />
        </Routes>
      </main>
    </div>
  );
}
