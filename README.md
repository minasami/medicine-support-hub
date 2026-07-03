# Medicine Support Hub

**Digital health infrastructure for medicine access.**

Medicine Support Hub is an AI-ready, multi-tenant platform designed to help NGOs, healthcare providers, pharmacies, pharmaceutical companies, donors, suppliers, and public-sector programs coordinate medicine assistance from request to impact.

[Live platform](https://medicine-support-hub.vercel.app/) · [Manifesto](https://medicine-support-hub.vercel.app/manifesto) · [NGO workspace](https://medicine-support-hub.vercel.app/ngo) · [Clinical assistant](https://medicine-support-hub.vercel.app/clinical-assistant)

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

## Platform roles

The current application includes dedicated experiences for patients/requesters, employees, reviewers, physicians, pharmacists, pharmacy teams, coordinators, branch managers, data-entry users, NGO teams, organization administrators, and platform administrators.

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
| Data and backend | Supabase PostgreSQL, authentication, storage, and row-level security foundations |
| Client data | TanStack Query |
| Deployment | Vercel |
| Repository model | Monorepo |
| Discoverability | Sitemap, robots.txt, structured metadata, Google verification, and llms.txt |

## Repository structure

```text
apps/
  web/                         Public site and role-based application
    public/                    robots.txt, sitemap.xml, llms.txt, verification files
    src/pages/                 Public pages and role portals
supabase/
  migrations/                  Versioned platform, organization, and NGO schema changes
docs/                          Product, architecture, governance, and strategy documents
```

The repository may also contain legacy or transitional packages from earlier versions of the platform. The active product direction is centered on `apps/web`, Supabase, and the multi-tenant organization model.

## Public routes

| Route | Purpose |
|---|---|
| `/` | Public product landing page |
| `/manifesto` | Mission, beliefs, and platform principles |
| `/ngo` | NGO and partner entry point |
| `/ngo/dashboard` | NGO operating dashboard |
| `/clinical-assistant` | AI-assisted clinical support interface |
| `/request` | Medicine support request submission |
| `/track` | Request tracking |
| `/admin` | Unified organization and platform administration |

Additional protected routes support reviewers, physicians, pharmacists, pharmacies, delivery coordination, branch management, and data entry.

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

Tenant isolation and role scoping should be enforced through database policies as new domains are implemented.

## Responsible AI

AI features are intended to assist with tasks such as summarization, document interpretation, operational analysis, and clinical-support conversations. They are not a replacement for licensed healthcare professionals or formal governance.

High-impact recommendations should be:

- explainable,
- reviewable,
- auditable,
- linked to supporting data or knowledge,
- and subject to appropriate human oversight.

## Local development

### Prerequisites

- Node.js
- pnpm
- A Supabase project or compatible PostgreSQL environment

### Setup

```bash
git clone https://github.com/minasami/medicine-support-hub.git
cd medicine-support-hub
pnpm install
```

Configure the environment variables required by `apps/web`, then run the development command defined in the workspace package scripts.

```bash
pnpm run dev
```

Before opening a pull request, run the available checks for the affected workspace:

```bash
pnpm run typecheck
pnpm run build
```

## Roadmap

### Foundation

- [x] Public product landing page
- [x] Multi-role portals
- [x] Google authentication foundations
- [x] Organization and membership database foundation
- [x] NGO portal and operational sections
- [x] Unified admin experience
- [x] SEO and AI-discoverability foundations
- [x] Public manifesto page

### Next

- [ ] Organization Workspace
- [ ] Program Management
- [ ] Beneficiary CRM
- [ ] Configurable Workflow Builder
- [ ] Executive Analytics
- [ ] Procurement and inventory maturity
- [ ] Partnership and donor CRM
- [ ] Public-health impact framework
- [ ] API and interoperability layer
- [ ] Responsible AI copilots by role

## Documentation

Strategic and technical documentation is being organized around:

- Executive vision and manifesto
- Product requirements
- Enterprise and data architecture
- Governance and security
- Intelligence architecture
- Roadmap and operating principles
- Pilot, partnership, and research frameworks
- Platform maturity follow-up: [`docs/platform-maturity-followup.md`](docs/platform-maturity-followup.md)

## Contributing

Contributions that improve medicine access workflows, accessibility, security, interoperability, documentation, testing, and public-health usefulness are welcome.

1. Fork the repository.
2. Create a focused branch.
3. Make and test the change.
4. Document security, migration, and workflow implications.
5. Open a pull request with a clear summary and validation steps.

Clinical or high-impact decision-support features should include an explicit review and governance plan.

## Security and privacy

Do not submit real patient, beneficiary, clinical, financial, or partner-confidential data to public issues, commits, screenshots, or demo environments. Security concerns should be reported privately to the maintainer.

## Status

Medicine Support Hub is an evolving independent platform and is not yet represented as a clinically validated medical device, national health system, or substitute for professional healthcare judgment. Product claims and impact measures should remain evidence-based and proportionate to real deployments.

## Creator

**Mina Samy Tawfik Saad**  
Digital health, public health, healthcare operations, and medicine-access innovation.

- Website: https://minasami.github.io/
- Email: jesussavedmina@gmail.com
- Platform: https://medicine-support-hub.vercel.app/

## License

See the repository license for permitted use and distribution.
