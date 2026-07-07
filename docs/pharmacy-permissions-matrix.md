# Pharmacy Permissions Matrix

This document defines the intended access model for the pharmacy module.

## Roles

### Platform admin

Purpose: global platform administration.

Can:

- manage user profiles and global roles,
- review platform-level settings,
- support branch owners when access is broken,
- review system-level operational health.

Should not normally:

- enter routine pharmacy stock or sales records unless acting as support.

### Branch owner

Purpose: accountable owner of a pharmacy branch.

Can:

- create and review branch records,
- repair owner access for older branches,
- link or remove branch accountants and managers,
- review finance, inventory, purchases, sales, and branch settings,
- deactivate duplicate or test branches,
- review branch reports and audit history when available.

### Branch manager

Purpose: operational manager for a branch.

Can:

- review branch operations,
- work with inventory, purchases, and sales,
- support accountants in day-to-day workflows.

Should not normally:

- deactivate branches,
- remove owner access,
- change platform-level roles.

### Pharmacy accountant

Purpose: finance and operational recording for a branch.

Can:

- add finance entries,
- work with suppliers,
- record purchases,
- record sales,
- review stock and branch financial summaries.

Should not normally:

- manage user access,
- deactivate branches,
- edit audit records,
- change platform-level roles.

### Future read-only viewer

Purpose: reporting and oversight without changing records.

Can:

- view selected branch reports,
- export permitted reports if enabled.

Cannot:

- create, edit, deactivate, or remove operational records.

## Module permissions summary

| Module | Platform admin | Branch owner | Branch manager | Pharmacy accountant | Read-only viewer |
|---|---|---|---|---|---|
| Branch settings | Support | Full | View | View | View |
| Member access | Support | Full | Limited/none | None | None |
| Finance | Support | Full | Full | Create/read | Read |
| Suppliers | Support | Full | Full | Create/read/update | Read |
| Inventory | Support | Full | Full | Create/read/update | Read |
| Purchases | Support | Full | Full | Create/read/update | Read |
| Sales | Support | Full | Full | Create/read | Read |
| Audit trail | Support | Read | Read | Limited read | Limited read |
| Exports | Support | Full | Full | Limited | Limited |

## Implementation notes

- Supabase RLS should stay aligned with this matrix.
- UI buttons should be hidden or disabled when the user does not have permission.
- Risky actions should require confirmation.
- Financial and stock corrections should be logged rather than silently overwritten.
- Audit records should not be editable by normal branch users.
