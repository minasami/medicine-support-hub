/**
 * retrainModel — weekly RLAIF export + Vertex fine-tune stub.
 * Schedule: 0 4 * * 0 (Sunday 04:00 UTC)
 *
 * 1. Collect annotations status=approved (or used_for_training)
 * 2. Export training pack JSONL
 * 3. If GCS/Vertex creds present → upload + kick job (stubbed endpoint)
 * 4. Else write local export summary and mark docs used_for_training when possible
 */
import { Client, Databases, Query, ID, Storage } from "node-appwrite";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL = process.env.ANNOTATIONS_COLLECTION_ID || "annotations";
const BUCKET = process.env.APPWRITE_RLAIF_BUCKET || process.env.APPWRITE_RX_BUCKET || "prescription-images";

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
}

function getClient() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

function vertexConfigured() {
  return Boolean(
    process.env.VERTEX_ACCESS_TOKEN ||
      process.env.GOOGLE_CLOUD_ACCESS_TOKEN ||
      process.env.GCS_BUCKET ||
      process.env.VERTEX_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

async function listApproved(db, limit = 200) {
  const rows = [];
  for (const status of ["approved", "used_for_training"]) {
    try {
      const r = await db.listDocuments(DB, COL, [
        Query.equal("status", status),
        Query.limit(limit),
      ]);
      rows.push(...r.documents);
    } catch (e) {
      /* collection attr mismatch */
    }
  }
  // de-dupe
  const seen = new Set();
  return rows.filter((d) => {
    if (seen.has(d.$id)) return false;
    seen.add(d.$id);
    return true;
  });
}

function toJsonl(docs) {
  return docs
    .map((d) =>
      JSON.stringify({
        annotation_id: d.$id,
        image_id: d.image_id || d.image_crop_id || "",
        prescription_id: d.prescription_id || "",
        ai: d.ai_parsed_json || d.label_json || "",
        ground_truth: d.ground_truth_json || d.label_json || "",
        confidence: d.confidence,
        votes: d.votes,
      }),
    )
    .join("\n");
}

async function uploadGcsStub(jsonl, log) {
  const bucket = process.env.GCS_BUCKET;
  const token = process.env.VERTEX_ACCESS_TOKEN || process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
  if (!bucket || !token) {
    log("GCS/Vertex creds missing — export kept in response only");
    return { uploaded: false, reason: "missing_gcs_or_token" };
  }
  const object = `rlaif/exports/annotations-${new Date().toISOString().slice(0, 10)}.jsonl`;
  try {
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(object)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/jsonl",
      },
      body: jsonl,
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { uploaded: false, reason: `gcs_http_${resp.status}`, detail: t.slice(0, 300) };
    }
    return { uploaded: true, gcs_uri: `gs://${bucket}/${object}` };
  } catch (e) {
    return { uploaded: false, reason: String(e.message || e) };
  }
}

async function kickVertexStub(gcsUri, log) {
  if (!gcsUri) return { started: false, reason: "no_uri" };
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;
  const token = process.env.VERTEX_ACCESS_TOKEN || process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
  if (!project || !token) {
    log("Vertex fine-tune deferred — no project/token");
    return { started: false, reason: "missing_vertex_creds", deferred: true };
  }
  // Real custom training job creation is deferred; document the hook.
  log(`Would start Vertex fine-tune on ${gcsUri} for project ${project}`);
  return {
    started: false,
    deferred: true,
    reason: "vertex_finetune_stub",
    gcs_uri: gcsUri,
    project,
  };
}

export default async ({ req, res, log }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const client = getClient();
  const db = client ? new Databases(client) : null;
  const storage = client ? new Storage(client) : null;

  const stats = { pending: 0, approved: 0, rejected: 0, in_review: 0, used_for_training: 0, total: 0 };
  if (db) {
    for (const status of Object.keys(stats).filter((k) => k !== "total")) {
      try {
        const r = await db.listDocuments(DB, COL, [Query.equal("status", status), Query.limit(1)]);
        stats[status] = r.total || 0;
        stats.total += r.total || 0;
      } catch (e) {
        log(`stats ${status}: ${e.message || e}`);
      }
    }
  }

  let exportPack = { count: 0, bytes: 0, sample: [] };
  let gcs = { uploaded: false, reason: "no_db" };
  let vertex = { started: false, deferred: true };
  let marked = 0;

  if (db) {
    const docs = await listApproved(db, 200);
    const trainable = docs.filter((d) => d.status === "approved");
    const jsonl = toJsonl(trainable);
    exportPack = {
      count: trainable.length,
      bytes: jsonl.length,
      sample: trainable.slice(0, 3).map((d) => d.$id),
    };

    gcs = await uploadGcsStub(jsonl, log);
    vertex = await kickVertexStub(gcs.gcs_uri, log);

    // Persist export artifact to Appwrite Storage when possible (even without GCS)
    if (storage && jsonl.length) {
      try {
        const blob = Buffer.from(jsonl, "utf8");
        // node-appwrite File / InputFile varies by version — skip binary upload if unsupported
        log(`export jsonl ready (${blob.length} bytes); Storage binary upload left to Console/CI when InputFile available`);
      } catch (e) {
        log(`storage export note: ${e.message || e}`);
      }
    }

    if (trainable.length && !vertex.started) {
      for (const d of trainable.slice(0, 50)) {
        try {
          await db.updateDocument(DB, COL, d.$id, { status: "used_for_training" });
          marked += 1;
        } catch (e) {
          log(`mark used_for_training ${d.$id}: ${e.message || e}`);
        }
      }
    }
  }

  const configured = vertexConfigured();
  log(
    `retrainModel export=${exportPack.count} gcs=${gcs.uploaded} vertex_configured=${configured} marked=${marked}`,
  );

  return json(res, 200, {
    success: true,
    stub: !configured || !vertex.started,
    vertex_configured: configured,
    annotation_stats: stats,
    export: exportPack,
    gcs,
    vertex,
    marked_used_for_training: marked,
    message: configured
      ? "Export attempted; fine-tune job creation remains stubbed without full Vertex training API wiring."
      : "Weekly approved-annotations export ready. Provide GCS_BUCKET + VERTEX_ACCESS_TOKEN (or SA) for real upload/fine-tune.",
    todos: [
      "Set GCS_BUCKET + VERTEX_* / GOOGLE_CLOUD_* for live fine-tune",
      "Keep sendPush on Appwrite Messaging (no FIREBASE_SERVICE_ACCOUNT required)",
    ],
    run_id: ID.unique(),
    timestamp: new Date().toISOString(),
  });
};
