# LARA — AI-Powered PMO Analytics

> Your project diagnosis in minutes, not hours.

[![GitHub](https://img.shields.io/badge/github-juanpalar--ctrl-181717?style=flat&logo=github)](https://github.com/juanpalar-ctrl/pmo-ai-saas)
[![Node.js + TypeScript](https://img.shields.io/badge/stack-Node.js%20%2B%20TypeScript-339933?style=flat)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-316192?style=flat)](https://www.postgresql.org)
[![Claude API](https://img.shields.io/badge/AI-Claude%20Opus-9C6837?style=flat)](https://www.anthropic.com)

---

## What is LARA?

LARA is a SaaS platform that converts a spreadsheet of project tasks into **real-time intelligence**: Earned Value metrics, AI-powered risk analysis, economic forecasts, and team health monitoring.

**Upload → Analyze → Decide** — in 3 minutes instead of 3 days.

### For

- **Project Managers** — Get reports instantly
- **PMO Directors** — Portfolio view with real risk assessment
- **Technical Leaders** — Deployment flow metrics and team health

---

## Features

- **Earned Value Management (EVM)** — Full set of metrics: CPI, SPI, EAC, VAC, ROI, and more
- **AI-Powered Risk Analysis** — Detects real threats: team burnout, schedule delays, budget creep
- **Economic Forecasting** — Budget status, burn rate, worst-case costs, cost of delay
- **Team Health Dashboard** — Workload + wellbeing monitoring by team member
- **LARA Assistant (Chat)** — Ask questions, generate drafts, simulate scenarios
- **AI-Drafted Reports** — Executive & technical reports ready for stakeholders
- **Framework-Specific Metrics** — Optimized for Scrum, Kanban, Waterfall, SAFe
- **Interactive Gantt & Portfolio** — Visualize projects and consolidate multi-project view

---

Built with Node.js, TypeScript, PostgreSQL, and Anthropic Claude.

---

## Security

- ✅ JWT in httpOnly cookies (httpOnly, sameSite=strict, secure in prod)
- ✅ Bcrypt (cost 12), minimum 8-char passwords
- ✅ Rate limiting (auth: 20 req/15min, chat: 60 req/min)
- ✅ All reads scoped by `user_id` (closes IDOR)
- ✅ Zod validation at API boundaries
- ✅ Helmet for HTTP headers
- ⚠️ CSP disabled (uses inline styles/scripts)
- ⚠️ SSL verification disabled on Render-managed PG (acceptable for managed service)

---

## Deployment

### On Render (Production)
- Environment: Node.js web service
- Build: `npm install && npm run build`
- Start: `npm start`
- Env vars set via Render dashboard

**Current:** https://pmo-ai-saas.onrender.com

---

## Landing Page

A modern, fully responsive landing page is available at `/public/lara-landing.html` with:
- Real app screenshots embedded (Portfolio, Risk Analysis, Team Health, Metrics, Chatbot)
- LARA branding with cyan, lime, and yellow palette
- Market comparison table
- Contact form
- Direct "Ingresa" link to app login

---

## Contributing

This is a solo project (for now), but if you'd like to contribute:

1. Fork & create a branch
2. Make changes (keep determinism principle in mind)
3. Write tests
4. Submit PR

---

## What's Next?

See [DESCRIPCION_LARA.md](./docs/DESCRIPCION_LARA.md) for a deep technical audit, roadmap prioritization, and debt analysis.

---

## License

MIT

---

## Questions?

- 📧 Email: juanpalar@gmail.com
- 🐙 GitHub: [@juanpalar-ctrl](https://github.com/juanpalar-ctrl)
- 🔗 LinkedIn: [juan-pablo-lara](https://www.linkedin.com/in/juanpablolarafigueroa-projectmanagement/?locale=en)

---

**Built with:**
- [Anthropic Claude](https://www.anthropic.com) for intelligence
- [Express.js](https://expressjs.com) for the API
- [PostgreSQL](https://www.postgresql.org) for persistence
- [Render](https://render.com) for hosting

**© 2026 Juan Pablo Lara**

**Last updated:** July 2026
