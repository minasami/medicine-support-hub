#!/usr/bin/env node
/**
 * CLI: automate safe platform-admin claim actions against Appwrite.
 *
 * Usage:
 *   APPWRITE_API_KEY=... node scripts/admin-auto-actions.mjs --dry-run
 *   APPWRITE_API_KEY=... node scripts/admin-auto-actions.mjs --approve-min=85
 *   APPWRITE_API_KEY=... node scripts/admin-auto-actions.mjs --reject-max=25
 *
 * Requires: APPWRITE_API_KEY (or APPWRITE_KEY)
 */
import { Client, Databases, Query } from "node-appwrite";

const ENDPOINT =
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1";
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const KEY = process.env.APPWRITE_API_KEY || process.env.APPWRITE_KEY || "";
const DATABASE_ID =
  process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const TABLE_ID =
  process.env.APPWRITE_CLAIMS_COLLECTION_ID || "company_profile_claims";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const approveMin = Number(
  (args.find((a) => a.startsWith("--approve-min=")) || "--approve-min=85").split(
    "=",
  )[1],
);
const rejectArg = args.find((a) => a.startsWith("--reject-max="));
const rejectMax = rejectArg ? Number(rejectArg.split("=")[1]) : null;

if (!KEY) {
  console.error("Set APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY);
const databases = new Databases(client);

async function listPending() {
  const res = await databases.listDocuments(DATABASE_ID, TABLE_ID, [
    Query.equal("status", "pending"),
    Query.limit(100),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents;
}

async function main() {
  console.log("Admin auto-actions", {
    dryRun,
    approveMin,
    rejectMax,
    project: PROJECT,
    table: TABLE_ID,
  });
  const pending = await listPending();
  console.log(`Pending claims: ${pending.length}`);

  const toApprove = pending.filter(
    (d) => Number(d.verification_score ?? 50) >= approveMin,
  );
  console.log(`Eligible auto-approve (score≥${approveMin}): ${toApprove.length}`);

  for (const d of toApprove) {
    const label = `${d.company_name || d.company_slug} · ${d.work_email} (${d.verification_score})`;
    if (dryRun) {
      console.log("  would approve", label);
      continue;
    }
    await databases.updateDocument(DATABASE_ID, TABLE_ID, d.$id, {
      status: "approved",
      is_approved: true,
      reviewer_notes: `CLI auto-approve score≥${approveMin}`,
      reviewed_at: new Date().toISOString(),
    });
    console.log("  approved", label);
  }

  if (rejectMax != null) {
    const toReject = pending.filter(
      (d) => Number(d.verification_score ?? 50) <= rejectMax,
    );
    console.log(`Eligible auto-reject (score≤${rejectMax}): ${toReject.length}`);
    for (const d of toReject) {
      const label = `${d.company_name || d.company_slug} · ${d.work_email} (${d.verification_score})`;
      if (dryRun) {
        console.log("  would reject", label);
        continue;
      }
      await databases.updateDocument(DATABASE_ID, TABLE_ID, d.$id, {
        status: "rejected",
        is_approved: false,
        reviewer_notes: `CLI auto-reject score≤${rejectMax}`,
        reviewed_at: new Date().toISOString(),
      });
      console.log("  rejected", label);
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
