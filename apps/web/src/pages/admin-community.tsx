import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

interface CommentRow {
  id: string;
  user_id: string;
  author_name: string;
  entity_type: string;
  entity_key: string;
  body: string;
  status: string;
  moderation_reason: string | null;
  created_at: string;
}
interface Observation {
  id: string;
  canonical_id: number;
  user_id: string;
  author_name: string;
  observation_type: string;
  title: string;
  description: string;
  severity: string | null;
  onset_timing: string | null;
  evidence_urls: string[];
  status: string;
  created_at: string;
}
interface Report {
  id: string;
  reporter_user_id: string;
  entity_type: string;
  entity_key: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}
interface CompanyMessage {
  id: string;
  company_slug: string;
  organization_id: string | null;
  sender_name: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
}

const humanize = (value: any) =>
  String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function AdminCommunity() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [openMessages, setOpenMessages] = useState<CompanyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [c, o, r, m] = await Promise.all([
        supabaseFetch<CommentRow[]>(
          "/rest/v1/community_comments?select=*&status=eq.held&order=created_at.desc&limit=50",
        ).catch(() => []),
        supabaseFetch<Observation[]>(
          "/rest/v1/community_safety_observations?select=*&status=eq.submitted&order=created_at.desc&limit=50",
        ).catch(() => []),
        supabaseFetch<Report[]>(
          "/rest/v1/community_content_reports?select=*&status=eq.submitted&order=created_at.desc&limit=50",
        ).catch(() => []),
        supabaseFetch<CompanyMessage[]>(
          "/rest/v1/company_messages?select=*&status=in.(sent,unread)&order=created_at.desc&limit=50",
        ).catch(() => []),
      ]);
      setComments(Array.isArray(c) ? c : []);
      setObservations(Array.isArray(o) ? o : []);
      setReports(Array.isArray(r) ? r : []);
      setOpenMessages(Array.isArray(m) ? m : []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load moderation items.", "تعذّر تحميل عناصر الإشراف."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.access_token]);

  if (loading) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          {t("Loading community moderation...", "جاري تحميل إشراف المجتمع...")}
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {t("Community Moderation & Safety", "إشراف المجتمع والسلامة")}
        </h1>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Refresh", "تحديث")}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {t("Held Community Comments", "تعليقات المجتمع المعلّقة")} ({" "}
              {comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.map((row) => (
              <div key={row.id} className="space-y-2 rounded-xl border p-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {row.author_name} · {humanize(row.entity_type)} ({row.entity_key})
                  </span>
                  <Badge variant="secondary">{row.status}</Badge>
                </div>
                <p className="text-sm">{row.body}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t(
                  "No held comments pending moderation.",
                  "لا توجد تعليقات معلّقة بانتظار الإشراف.",
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
