# LARA — AI-Powered PMO Analytics

> Your project diagnosis in minutes, not hours.

[![GitHub](https://img.shields.io/badge/github-juanpalar--ctrl-181717?style=flat&logo=github)](https://github.com/juanpalar-ctrl/pmo-ai-saas)
[![Deployed on Render](https://img.shields.io/badge/deployed-Render-46E3B7?style=flat)](https://pmo-ai-saas.onrender.com)
[![Node.js + TypeScript](https://img.shields.io/badge/stack-Node.js%20%2B%20TypeScript-339933?style=flat)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-316192?style=flat)](https://www.postgresql.org)
[![Claude API](https://img.shields.io/badge/AI-Claude%20Opus-9C6837?style=flat)](https://www.anthropic.com)

---

## What is LARA?

LARA is a SaaS platform that turns a spreadsheet of project tasks into **real-time intelligence**: Earned Value metrics, AI-powered risk analysis, economic forecasts, and team health monitoring.

**Upload → Analyze → Decide** — in 3 minutes instead of 3 days.

### Who is this for?

- **Project Managers** — Get reports instantly without waiting for PMO analysts
- **PMO Directors** — Portfolio view with real risk verdicts, not just RAG colors
- **Technical Leaders** — Deployment flow metrics and architectural health in one place

---

## Features

Upload any Excel file with tasks (name, dates, status, cost), and LARA generates:
- ✅ EVM metrics (CPI, SPI, EAC, VAC, ROI)
- ✅ AI-powered risk assessment (probability + impact)
- ✅ Economic forecasting (burn rate, cost of delay)
- ✅ Team health dashboard (workload + wellbeing)
- ✅ Executive & technical reports (AI-drafted)

---

## Key Features

### 1. **Intelligent Data Ingestion**
- Upload Excel, CSV, or Google Sheets
- AI auto-suggests column mappings (status → "completed %", cost → "budget")
- Data Integrity Score (0–100) tells you how much to trust the results

### 2. **Earned Value Management (EVM)**
- Full set: BAC, AC, PV, EV, CV, SV, CPI, SPI, EAC, VAC, TCPI, ROI
- Framework-specific metrics (Scrum, Kanban, Waterfall, SAFe)
- Deterministic — same data always yields same numbers

### 3. **AI-Powered Risk Analysis**
- **Risk Agent** detects real threats: team burnout, schedule delays, budget creep
- Integrates early warnings (stalled tasks, critical path impact)
- Outputs: risk score, probability, 3+ recommendations
- Always includes fallback to framework defaults if model hallucinates

### 4. **Economic Analysis**
- Budget status, daily burn rate, worst-case total cost, cost of delay
- "If we slip 2 weeks, how much does that cost?"

### 5. **Team Health Dashboard**
- **Workload axis** — team member carga vs. average (red/yellow/green)
- **People Health axis** — wellbeing score + feedback recency
- 1-on-1 feedback is AI-analyzed for sentiment & burnout signals
- Alerts feed back into risk assessment

### 6. **LARA Assistant (Chat)**
- Ask questions in natural language: "What's our biggest risk?"
- Generates drafts (emails, Slack messages, executive briefs)
- Simulates scenarios on-the-fly: "What if we add 2 sprints?"

### 7. **AI-Drafted Reports**
- **Executive Report**: state, health metrics, blockers, "what we need from you"
- **Technical Report**: delivery flow, technical health, architecture capacity, tactical actions
- Both in Markdown, ready to paste into Confluence/Notion

### 8. **Interactive Gantt + Portfolio View**
- Gantt with task timeline, status, owner
- Portfolio consolidates all projects with integrated health scoring (EVM + risk verdict + team health)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + Express 5 + TypeScript |
| **Database** | PostgreSQL (Render) + raw SQL (no ORM) |
| **AI** | Anthropic Claude (Opus 4.8) via SDK |
| **Frontend** | HTML + Vanilla JavaScript (no framework) |
| **File Parsing** | `xlsx` + `multer` |
| **Validation** | Zod schemas |
| **Auth** | JWT in httpOnly cookies + bcrypt |
| **Testing** | Jest + supertest (81% coverage, 333 tests) |
| **Logging** | Pino |
| **Security** | Helmet, CORS, rate limiting |
| **Deployment** | Render (Node.js web service) |

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
- 🔗 LinkedIn: [juan-pablo-lara]((https://www.linkedin.com/in/juanpablolarafigueroa-projectmanagement/?locale=en))

---

**Built with:**
- [Anthropic Claude](https://www.anthropic.com) for intelligence
- [Express.js](https://expressjs.com) for the API
- [PostgreSQL](https://www.postgresql.org) for persistence
- [Render](https://render.com) for hosting

**Last updated:** July 2026
