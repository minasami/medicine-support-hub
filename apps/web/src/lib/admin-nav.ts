/**
 * Single source of truth for platform admin navigation.
 * Used by the command hub and AdminShell side nav.
 */

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  category:
    | "priority"
    | "encyclopedia"
    | "industry"
    | "operations"
    | "system";
  badge?: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin/hub",
    label: "Command hub",
    description: "Overview, one-click claims, live backlogs",
    category: "priority",
  },
  {
    href: "/admin/industry",
    label: "Industry claims",
    description: "Approve company representative applications",
    category: "priority",
    badge: "Claims",
  },
  {
    href: "/admin/sellout",
    label: "Sell-out insights",
    description: "Brand unit mix, returns, ranked accounts (no names)",
    category: "industry",
    badge: "Internal",
  },
  {
    href: "/admin/medicine-enrichment",
    label: "Medicine enrichment",
    description: "DrugEye, tariffs, prices, composition",
    category: "encyclopedia",
  },
  {
    href: "/admin/mapping-accuracy",
    label: "ID mapping accuracy",
    description: "Static → live catalog identity quality",
    category: "encyclopedia",
  },
  {
    href: "/admin/control-center",
    label: "Control center",
    description: "Ingestion candidates, governance, duplicates",
    category: "encyclopedia",
  },
  {
    href: "/admin/marketplace",
    label: "Marketplace",
    description: "Listings and commercial moderation",
    category: "operations",
  },
  {
    href: "/admin/healthcare-network",
    label: "Healthcare network",
    description: "Providers, care enrollments, partners",
    category: "operations",
  },
  {
    href: "/admin/community",
    label: "Community",
    description: "Moderation and community health",
    category: "operations",
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    description: "Platform notification summary",
    category: "operations",
  },
  {
    href: "/admin/automation",
    label: "Automation",
    description: "Scheduled jobs and pipelines",
    category: "system",
  },
  {
    href: "/admin/users",
    label: "Users & roles",
    description: "Account tools and role inspection",
    category: "system",
  },
  {
    href: "/admin/legacy",
    label: "Legacy ops portal",
    description: "Requests, programs, beneficiaries (legacy)",
    category: "system",
  },
  {
    href: "/admin/leads",
    label: "Partnership leads",
    description: "Talk-to-founder and B2B inbound",
    category: "industry",
  },
];

export const ADMIN_CATEGORY_LABELS: Record<AdminNavItem["category"], string> = {
  priority: "Start here",
  encyclopedia: "Encyclopedia & data",
  industry: "Industry & access",
  operations: "Operations",
  system: "System",
};

export function adminNavByCategory() {
  const order: AdminNavItem["category"][] = [
    "priority",
    "encyclopedia",
    "industry",
    "operations",
    "system",
  ];
  return order.map((category) => ({
    category,
    label: ADMIN_CATEGORY_LABELS[category],
    items: ADMIN_NAV.filter((i) => i.category === category),
  }));
}
