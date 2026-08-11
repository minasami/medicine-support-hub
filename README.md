# Medicine Support Hub
<a href="https://deepwiki.com/minasami/medicine-support-hub"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
**Digital health infrastructure for medicine access.**

Medicine Support Hub is an AI-ready, multi-tenant platform designed to help NGOs, healthcare providers, pharmacies, pharmaceutical companies, donors, suppliers, and public-sector programs coordinate medicine assistance from request to impact.

**Production:** [https://medicinesupport.app](https://medicinesupport.app)  
**Encyclopedia:** [https://medicinesupport.app/medicines](https://medicinesupport.app/medicines)  
**Industry / company rep registration:** [https://medicinesupport.app/industry](https://medicinesupport.app/industry)  
**Account (verified reps):** [https://medicinesupport.app/account](https://medicinesupport.app/account)  
**Admin industry claims:** [https://medicinesupport.app/admin/industry](https://medicinesupport.app/admin/industry)  
**NGO donations:** [https://medicinesupport.app/ngo/donations](https://medicinesupport.app/ngo/donations)

Legacy Vercel URL (historical): [https://medicine-support-hub.vercel.app](https://medicine-support-hub.vercel.app/) · [Manifesto](https://medicinesupport.app/manifesto) · [NGO](https://medicinesupport.app/ngo)

## Vision

To become trusted digital infrastructure for equitable medicine access by connecting the organizations that help patients receive essential and chronic medicines.

## Mission

To provide a secure, intelligent, transparent, and scalable platform for managing the full medicine-support lifecycle—from beneficiary enrollment and clinical review through budgeting, procurement, fulfillment, reporting, and impact assessment.

## Why this platform exists

Medicine assistance programs often depend on fragmented spreadsheets, emails, manual approvals, disconnected pharmacy workflows, and limited visibility into budgets or outcomes. Medicine Support Hub brings those workflows into one coordinated environment.

The platform is being developed as an **operating system for medicine access programs**, not only as a medicine request form.

## Core capabilities

- Patient and requester portals
- Organization workspaces and multi-tenant membership
- NGO program and beneficiary management
- Medicine request intake and tracking
- Clinical, physician, reviewer, and pharmacist workflows
- Pharmacy fulfillment and delivery coordination
- Budgeting, procurement, supplier, and partner workflows
- Executive, operational, and public-health reporting
- AI-assisted clinical and operational support
- Role-based platform administration and audit-ready workflows
- English and Arabic interface foundations
- Manufacturer stock import and company representative claims (Appwrite)
- NGO medicine donation exchange

## Platform roles

The current application includes dedicated experiences for patients/requesters, employees, reviewers, physicians, pharmacists, pharmacy teams, coordinators, branch managers, data-entry users, NGO teams, organization administrators, pharmaceutical company representatives, and platform administrators.

## Product direction

Medicine Support Hub is evolving around five enterprise capabilities:

1. **Organization Workspace** — a digital headquarters for each participating organization.
2. **Program Management** — configurable medicine assistance programs, eligibility, budgets, partners, and KPIs.
3. **Beneficiary CRM** — longitudinal beneficiary, household, condition, medicine, request, document, and outcome records.
4. **Configurable Workflows** — organization-specific review and approval processes.
5. **Executive Intelligence** — operational, budget, procurement, continuity, and impact insights.

Longer-term domains include medicine intelligence, inventory, procurement, donor reporting, public-health analytics, interoperability, research, and responsible AI copilots.

## Architecture principles

- **Organization-first:** operational records are scoped to organizations and programs.
- **Secure by default:** authentication, authorization, row-level security, and auditing are treated as core architecture.
- **Configurable before customizable:** organizations should configure workflows without separate codebases.
- **API-aware:** capabilities are designed with future partner and healthcare-system integrations in mind.
- **Evidence-aware:** reporting and recommendations should be traceable to underlying data and assumptions.
- **Human oversight:** AI assists users but does not silently replace accountable clinical, financial, or operational decisions.
- **Global-ready:** localization, currencies, time zones, country-specific catalogs, and differing workflows are considered in the design.

## Current technology

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter |
| Data and backend | **Appwrite** (Cloud FRA): Databases/TablesDB, Auth, Storage; legacy Supabase paths being retired |
| Client data | TanStack Query + Appwrite SDK |
| Deployment | **Production:** [https://medicinesupport.app](https://medicinesupport.app) (Appwrite Sites) |
| Repository model | Monorepo (`apps/web`) |
| Discoverability | Sitemap, robots.txt, structured metadata, llms.txt |

## Repository structure

```text
apps/
  web/                         Public site and role-based application
    public/                    robots.txt, sitemap.xml, llms.txt, verification files
    src/pages/                 Public pages and role portals
    src/lib/                   Appwrite data layers (claims, stock, donations, …)
docs/                          Product, architecture, deployment, schema documents
scripts/                       Provisioning, validation, data-quality tools
```

## Public routes

| Route | Purpose |
|---|---|
| `/` | Public product landing page |
| `/manifesto` | Mission, beliefs, and platform principles |
| `/medicines` | Medicines encyclopedia |
| `/industry` | Pharmaceutical company representative registration |
| `/account` | Account + verified company rep portal |
| `/admin/industry` | Industry claims moderation (admin) |
| `/ngo` | NGO and partner entry point |
| `/ngo/donations` | Medicine donation exchange |
| `/ngo/dashboard` | NGO operating dashboard |
| `/clinical-assistant` | AI-assisted clinical support interface |
| `/request` | Medicine support request submission |
| `/track` | Request tracking |
| `/admin` | Unified organization and platform administration |

## Multi-tenant foundation

The platform includes organization and membership foundations designed to support:

```text
Platform
  └── Organizations
       └── Members and roles
            └── Programs
                 └── Beneficiaries
                      └── Requests
                           └── Reviews, fulfillment, budgets, and impact
```

## Responsible AI

AI features are intended to assist with tasks such as summarization, document interpretation, operational analysis, and clinical-support conversations. They are not a replacement for licensed healthcare professionals or formal governance.

## Local development

### Prerequisites

- Node.js
- pnpm
- Appwrite project credentials (browser-safe `VITE_APPWRITE_*` vars)

### Setup

```bash
git clone https://github.com/minasami/medicine-support-hub.git
cd medicine-support-hub
pnpm install
```

Configure the environment variables required by `apps/web`, then run:

```bash
pnpm run dev
```

Before opening a pull request:

```bash
pnpm run typecheck
pnpm run build
```

## Deployment

| Environment | URL |
|-------------|-----|
| **Production** | [https://medicinesupport.app](https://medicinesupport.app) |
| Encyclopedia | [https://medicinesupport.app/medicines](https://medicinesupport.app/medicines) |
| Industry claims (admin) | [https://medicinesupport.app/admin/industry](https://medicinesupport.app/admin/industry) |
| Company rep account | [https://medicinesupport.app/account](https://medicinesupport.app/account) |
| NGO donations | [https://medicinesupport.app/ngo/donations](https://medicinesupport.app/ngo/donations) |

Appwrite Sites build notes: [`docs/APPWRITE_SITES_DEPLOYMENT.md`](docs/APPWRITE_SITES_DEPLOYMENT.md)

After merging to `main`, ensure the Appwrite Site redeploys so claim UI and data-layer changes go live.

## Documentation

- Appwrite Sites deployment: [`docs/APPWRITE_SITES_DEPLOYMENT.md`](docs/APPWRITE_SITES_DEPLOYMENT.md)
- Company claims schema: [`docs/company-profile-claims-schema.md`](docs/company-profile-claims-schema.md)
- Claim migration debug: [`docs/appwrite-claim-migration-debug.md`](docs/appwrite-claim-migration-debug.md)
- Platform maturity: [`docs/platform-maturity-followup.md`](docs/platform-maturity-followup.md)

## Contributing

Contributions that improve medicine access workflows, accessibility, security, interoperability, documentation, testing, and public-health usefulness are welcome.

## Security and privacy

Do not submit real patient, beneficiary, clinical, financial, or partner-confidential data to public issues, commits, screenshots, or demo environments. Security concerns should be reported privately to the maintainer.

## Status

Medicine Support Hub is an evolving independent platform and is not yet represented as a clinically validated medical device, national health system, or substitute for professional healthcare judgment.

## Creator

**Mina Samy Tawfik Saad**  
Digital health, public health, healthcare operations, and medicine-access innovation.

- Website: https://minasami.github.io/
- Email: jesussavedmina@gmail.com
- **Platform:** https://medicinesupport.app/

## License

See the repository license for permitted use and distribution.
