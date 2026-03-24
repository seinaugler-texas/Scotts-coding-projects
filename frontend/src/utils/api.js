import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://perfect-essence-production-0ca7.up.railway.app";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// ── Companies ────────────────────────────────────────────────────────────────
export const getCompanies = (params) => api.get("/companies/", { params });
export const getCompany = (id) => api.get(`/companies/${id}`);
export const createCompany = (data) => api.post("/companies/", data);
export const updateCompany = (id, data) => api.put(`/companies/${id}`, data);
export const deleteCompany = (id) => api.delete(`/companies/${id}`);
export const bulkImportCompanies = (data) => api.post("/companies/bulk", data);

// ── Templates ────────────────────────────────────────────────────────────────
export const getTemplates = () => api.get("/templates/");
export const getTemplate = (id) => api.get(`/templates/${id}`);
export const createTemplate = (data) => api.post("/templates/", data);
export const updateTemplate = (id, data) => api.put(`/templates/${id}`, data);
export const deleteTemplate = (id) => api.delete(`/templates/${id}`);
export const getTemplateVariables = () => api.get("/templates/variables");

// ── Campaigns ────────────────────────────────────────────────────────────────
export const getCampaigns = () => api.get("/campaigns/");
export const getCampaign = (id) => api.get(`/campaigns/${id}`);
export const createCampaign = (data) => api.post("/campaigns/", data);
export const updateCampaign = (id, data) => api.put(`/campaigns/${id}`, data);
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`);
export const scheduleCampaign = (id) => api.post(`/campaigns/${id}/schedule`);
export const pauseCampaign = (id) => api.post(`/campaigns/${id}/pause`);
export const resumeCampaign = (id) => api.post(`/campaigns/${id}/resume`);
export const getCampaignLogs = (id) => api.get(`/campaigns/${id}/logs`);
export const previewCampaign = (id) => api.get(`/campaigns/${id}/preview`);
export const addCompaniesToCampaign = (id, company_ids) =>
  api.post(`/campaigns/${id}/add_companies`, { company_ids });

// ── Scraper ──────────────────────────────────────────────────────────────────
export const scrapeUrls = (urls, auto_import = false) =>
  api.post("/scraper/scrape", { urls, auto_import });
export const scrapeSingle = (url) => api.post("/scraper/scrape_single", { url });
