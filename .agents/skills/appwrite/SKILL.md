---
name: appwrite
description: Use when building, integrating, deploying, or troubleshooting Appwrite products (Databases, Auth, Functions, Storage, Messaging, Realtime, Sites, Edge Cache) in React, Next.js, Vite, and Node.js.
---

# Appwrite Platform Best Practices & Developer Guide

This skill provides comprehensive instructions for integrating, developing, and deploying with **Appwrite** across web applications, mobile apps (Capacitor/React Native), and serverless backends.

---

## Core Products & Capabilities

### 1. Appwrite Databases (High-Performance Edge Collections)
- **Structure**: `Database` -> `Collection` -> `Document`.
- **Attributes**: Create explicit attributes (`string`, `integer`, `float`, `boolean`, `email`, `enum`, `datetime`) before writing documents.
- **Indexes**: Add indexes (`key`, `fulltext`, `unique`) on query fields (e.g., `name_en`, `company_slug`, `canonical_id`) to ensure sub-10ms query execution.
- **Querying Syntax**:
  ```typescript
  import { Databases, Query } from "appwrite";
  const databases = new Databases(client);

  const response = await databases.listDocuments(
    "medicine_support_hub",
    "medicines",
    [
      Query.equal("category", "cardiology"),
      Query.search("name_en", "aspirin"),
      Query.orderDesc("current_price_egp"),
      Query.limit(20)
    ]
  );
  ```

---

### 2. Appwrite Realtime (1ms Live WebSocket Pushes)
- Subscribe to document level changes to push live data updates directly to the UI without REST polling:
  ```typescript
  import { Client } from "appwrite";

  const client = new Client().setEndpoint("https://cloud.appwrite.io/v1").setProject("PROJECT_ID");

  const unsubscribe = client.subscribe(
    "databases.medicine_support_hub.collections.medicines.documents",
    (response) => {
      // Event: databases.*.collections.*.documents.*.create / update / delete
      console.log("Realtime event payload:", response.payload);
    }
  );
  ```

---

### 3. Appwrite Serverless Functions (Cron Jobs & Event Triggers)
- **Directory Structure**: Put function code in `infra/<function_name>/` or `functions/<function_name>/`.
- **Handler Signature**:
  ```javascript
  export default async ({ req, res, log, error }) => {
    log("Appwrite Function triggered");
    return res.json({ success: true });
  };
  ```
- **Cron Scheduling**: Set execution schedule using standard cron syntax (e.g., `0 * * * *` for hourly).
- **Environment Variables**: Store server keys (`APPWRITE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) securely in Appwrite Function Settings.

---

### 4. Appwrite Storage (File Buckets & Media Optimization)
- **Bucket Creation**: Configure max file size, allowed MIME types, and encryption.
- **Image Preview API**: Generate thumbnail previews, cropping, and webp conversions dynamically via URL parameters.

---

### 5. Appwrite Sites & Deployment Hosting
- Deploy static or SSR applications using Appwrite CLI (`appwrite deploy target`) or Git GitHub integration.
- Configure public environment variables (`VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_ENDPOINT`) in Appwrite Site Settings.

---

## Integration Patterns with Supabase

1. **Hybrid Write/Read Architecture**:
   - **Writes**: Route through Supabase PostgreSQL for RLS policies, audit logs, and trigger checks.
   - **Reads**: Route through Appwrite Database Collections for edge-cached sub-10ms query speeds.
2. **Automated Realtime Sync**:
   - Run a scheduled Appwrite Function or Supabase Webhook to keep Appwrite Database collections continuously updated.
