# ChronicMed — Chronic Medicines Support Platform

**A modern, bilingual (English/Arabic) pharmacy management system designed to streamline chronic medicine requests, approvals, and deliveries.**

## 🎯 Value Proposition

ChronicMed solves the fragmented process of requesting, reviewing, and fulfilling chronic medication prescriptions. Our platform connects patients, physicians, reviewers, pharmacists, and delivery personnel in a single, intuitive workflow—reducing wait times, minimizing errors, and improving patient outcomes through real-time tracking and AI-assisted clinical support.

**Who benefits:**
- 👥 **Patients & Relatives** — Easy medicine requests with prescription uploads and real-time status tracking
- 🏥 **Physicians & Clinical Teams** — Quick clinical support with AI-assisted recommendations
- ✅ **Reviewers & Pharmacists** — Centralized dashboard for approving and managing requests
- 🚚 **Delivery Personnel** — Clear delivery lists and status updates
- 🏢 **Pharmacy Managers** — Analytics dashboard with activity logs and performance insights

## ✨ Key Features

### For Requesters
- **Bilingual Interface** — Seamless EN/AR support with RTL layout
- **Smart Medicine Search** — Searchable medicine database with dosage forms and strengths
- **Prescription Upload** — Upload photos with automatic OCR extraction
- **Request History** — Track all past and current medication requests

### For Reviewers & Pharmacists
- **Centralized Dashboard** — Real-time status overview (All, Pending, Approved, Preparing, Ready, Delivered, Closed)
- **Request Details** — Full patient info, prescription preview, and reviewer notes
- **Activity Feed** — Track all status transitions and changes
- **Status Workflow** — Intuitive approval and fulfillment pipeline

### For Clinical Teams
- **Clinical Support Assistant** — AI-powered chat for non-final decision support
- **Bilingual Disclaimer** — Clear guidance on limitations and responsibilities
- **Safe Fallbacks** — Works even without AI integration

### For Management
- **Analytics & Reports** — Statistics cards and performance metrics
- **Multi-Branch Support** — Manage multiple pharmacy branches
- **Audit Trail** — Complete activity logs for compliance
- **User Role Management** — Platform admins, reviewers, pharmacists, delivery, and more

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React + Vite + Tailwind CSS + shadcn/ui + Wouter |
| **Backend** | Express.js 5 (Node.js 22) |
| **Database** | PostgreSQL + Drizzle ORM |
| **API** | Express.js with OpenAPI spec + Orval codegen |
| **Validation** | Zod schemas (v4) on both client & server |
| **Build** | TypeScript 5.9, esbuild, pnpm workspaces |
| **Deployment** | Vercel (frontend) + Node.js hosting |

## 🏗️ Architecture Highlights

- **Contract-First Design** — Single OpenAPI spec → auto-generated typed hooks & schemas
- **Monorepo** — pnpm workspaces with shared libraries and artifacts
- **Type Safety** — 96.6% TypeScript for confidence and refactoring
- **Bilingual at Core** — `useLanguage()` hook with `t(en, ar)` pattern throughout
- **Prescription Files** — Stored locally in `uploads/` and served via `/api/uploads/`
- **Optional AI** — OpenAI integration for OCR and clinical support (graceful fallbacks)
- **Activity Tracking** — Every status transition logged for audits

## 📦 Project Structure

```
├── lib/
│   ├── api-spec/          # OpenAPI specification (single source of truth)
│   ├── db/                # Drizzle ORM schemas & database utilities
│   │   └── schema/        # medicines, requests, activity tables
│   ├── api-client-react/  # Auto-generated API hooks
│   └── ...
├── artifacts/
│   ├── api-server/        # Express backend
│   │   ├── src/routes/    # API endpoints: medicines, requests, dashboard, ai, uploads
│   │   └── src/           # Entry point, middleware, auth, logger
│   └── chronic-medicines/ # React frontend
│       ├── src/pages/     # Landing, request form, dashboard, detail views
│       └── src/components # Layout, forms, common UI
├── scripts/               # Utility scripts
└── pnpm-workspace.yaml    # Workspace configuration
```

## 🛠️ Quick Start

### Prerequisites
- **Node.js** 22 (use `nvm use` if you have `.nvmrc`)
- **pnpm** 10.28.0 (`npm install -g pnpm`)
- **PostgreSQL** database

### Setup

1. **Clone & Install**
   ```bash
   git clone https://github.com/minasami/medicine-support-hub.git
   cd medicine-support-hub
   pnpm install
   ```

2. **Environment Setup**
   ```bash
   # Create .env file in project root
   export DATABASE_URL="postgresql://user:password@localhost:5432/chronicmed"
   
   # Optional: OpenAI integration for OCR & clinical AI
   export AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"
   export AI_INTEGRATIONS_OPENAI_API_KEY="sk-..."
   ```

3. **Database Setup**
   ```bash
   # Push schema to database
   pnpm --filter @workspace/db run push
   
   # Seed admin user and test accounts
   pnpm --filter @workspace/api-server run seed
   ```

4. **Development Servers**
   ```bash
   # Terminal 1: API server (port 8080)
   pnpm --filter @workspace/api-server run dev
   
   # Terminal 2: Frontend (port 25867)
   pnpm --filter @workspace/chronic-medicines run dev
   
   # Terminal 3: (Optional) Monitor & typecheck
   pnpm run typecheck
   ```

5. **Access the App**
   - Frontend: `http://localhost:25867`
   - API: `http://localhost:8080/api`

### Test Accounts (Default Seed)
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Reviewer | `reviewer1` | `reviewer123` |
| Pharmacist | `pharmacist1` | `pharm123` |
| Physician | `physician1` | `doc123` |
| Delivery | `delivery1` | `deliver123` |
| Manager | `manager1` | `manager123` |

## 🔧 Common Commands

```bash
# Typecheck across all packages
pnpm run typecheck

# Build all packages
pnpm run build

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Run database migrations
pnpm --filter @workspace/db run push

# Format code
pnpm exec prettier --write .

# Run tests (if available)
pnpm run test
```

## 📡 API Documentation

The API is documented in `lib/api-spec/openapi.yaml`. Main endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/medicines` | Search medicines |
| `POST` | `/api/requests` | Create medication request |
| `GET` | `/api/requests` | List requests (filtered by role) |
| `GET` | `/api/requests/:id` | Request details |
| `PATCH` | `/api/requests/:id` | Update request status |
| `POST` | `/api/uploads` | Upload prescription file |
| `GET` | `/api/ai/ocr` | Extract text from prescription image |
| `POST` | `/api/ai/clinical` | Clinical support chat |

## 🌍 Bilingual Support

The app is built with bilingual support at the core:

- **Language Context** — `useLanguage()` hook for EN/AR toggling
- **Component Level** — Use `t(english, arabic)` helper throughout
- **RTL Layout** — Automatic `dir="rtl"` for Arabic
- **Storage** — User preference saved to localStorage

```tsx
import { useLanguage } from "@/lib/i18n";

export function MyComponent() {
  const { language, setLanguage, t } = useLanguage();
  
  return (
    <button onClick={() => setLanguage(language === "en" ? "ar" : "en")}>
      {t("Language: English", "اللغة: العربية")}
    </button>
  );
}
```

## 🔒 Authentication & Authorization

- **Role-Based Access Control** — Platform Admin, Reviewer, Pharmacist, Physician, Delivery, Manager, etc.
- **Session Cookies** — Secure HTTP-only cookies for auth tokens
- **Password Hashing** — Bcrypt hashing in production
- **Branch Management** — Multi-branch support with role scoping

## 🐛 Troubleshooting

**Database connection fails?**
- Verify `DATABASE_URL` is set and PostgreSQL is running
- Check credentials: `postgresql://user:password@localhost:5432/dbname`

**Frontend won't connect to API?**
- Ensure API server is running on port 8080
- Check CORS configuration in `artifacts/api-server/src/app.ts`
- Verify `http://localhost:25867` is in allowed origins

**pnpm workspace not found?**
- Run `pnpm install` from the root directory
- Verify Node.js version: `node --version` (should be 22.x)

**Database migrations fail?**
- Run `pnpm --filter @workspace/db run push` to apply pending migrations
- Check `lib/db/src/schema/` for schema definitions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and typecheck: `pnpm run typecheck`
4. Commit: `git commit -am 'feat: add your feature'`
5. Push and open a Pull Request

## 📋 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics & reporting
- [ ] Prescription refill automation
- [ ] SMS notifications for patients
- [ ] Integration with pharmacy systems (HL7/FHIR)
- [ ] Telemedicine consultation features

## 📄 License

MIT — See `LICENSE` for details

## 🙏 Support

Need help?
- **Documentation** — See `replit.md` for additional technical details
- **Issues** — Open a GitHub issue for bugs or feature requests
- **Email** — Contact the maintainers

---

**Live App:** [medicine-support-hub.vercel.app](https://medicine-support-hub.vercel.app)  
**Repository:** [github.com/minasami/medicine-support-hub](https://github.com/minasami/medicine-support-hub)
