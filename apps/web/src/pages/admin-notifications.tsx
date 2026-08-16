import { FormEvent, useState } from "react";
import { Bell, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

const topics = [
  "platform_updates",
  "medicine_updates",
  "company_updates",
  "marketplace_updates",
  "learning_updates",
  "favorite_updates",
];
const audienceTypes = ["topic", "all", "users", "role", "medicine", "company"];
const humanize = (value: any) =>
  String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function AdminNotifications() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [draft, setDraft] = useState({
    title: "",
    body: "",
    topic: "platform_updates",
    audienceType: "all",
    audienceValues: "",
    targetUrl: "/medicines",
    imageUrl: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCampaign(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/notification_campaigns", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          body: draft.body,
          topic: draft.topic,
          audience_type: draft.audienceType,
          target_url: draft.targetUrl,
          image_url: draft.imageUrl || null,
          status: "sent",
        }),
      });
      setMessage(
        t(
          "Notification campaign queued successfully.",
          "تم وضع حملة الإشعارات في قائمة الانتظار بنجاح.",
        ),
      );
      setDraft({
        title: "",
        body: "",
        topic: "platform_updates",
        audienceType: "all",
        audienceValues: "",
        targetUrl: "/medicines",
        imageUrl: "",
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Failed to send campaign.", "تعذّر إرسال الحملة."),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Bell className="h-6 w-6 text-primary" />
          {t("Notification Campaign Studio", "استوديو حملات الإشعارات")}
        </h1>
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

      <Card>
        <CardHeader>
          <CardTitle>
            {t("Compose Broadcast Notification", "إنشاء إشعار بث")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendCampaign} className="space-y-4">
            <div>
              <Label>{t("Campaign Title", "عنوان الحملة")}</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={t("Title...", "العنوان...")}
                required
              />
            </div>
            <div>
              <Label>{t("Notification Body", "نص الإشعار")}</Label>
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder={t("Body text...", "نص المحتوى...")}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("Topic", "الموضوع")}</Label>
                <select
                  value={draft.topic}
                  onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {humanize(topic)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("Audience", "الجمهور")}</Label>
                <select
                  value={draft.audienceType}
                  onChange={(e) =>
                    setDraft({ ...draft, audienceType: e.target.value })
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  {audienceTypes.map((a) => (
                    <option key={a} value={a}>
                      {humanize(a)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" disabled={sending}>
              <Send className="mr-2 h-4 w-4" />
              {sending
                ? t("Sending...", "جاري الإرسال...")
                : t("Send Campaign", "إرسال الحملة")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
