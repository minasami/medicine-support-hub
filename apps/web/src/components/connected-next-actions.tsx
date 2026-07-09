import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type RelatedAction = {
  related_title: string;
  related_href: string;
  reason: string;
  priority: number;
};

export function ConnectedNextActions({ contextType, contextKey, title }: { contextType: string; contextKey: string; title?: string }) {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [actions, setActions] = useState<RelatedAction[]>([]);

  useEffect(() => {
    const params = `select=related_title,related_href,reason,priority&context_type=eq.${encodeURIComponent(contextType)}&context_key=eq.${encodeURIComponent(contextKey)}&order=priority.desc&limit=6`;
    supabaseFetch<RelatedAction[]>(`/rest/v1/platform_related_navigation?${params}`)
      .then(setActions)
      .catch(() => setActions([]));
  }, [contextType, contextKey, supabaseFetch]);

  if (actions.length === 0) return null;

  return <section className="rounded-2xl border bg-muted/40 p-5">
    <div className="flex items-center gap-2">
      <Network className="h-4 w-4 text-primary" />
      <h2 className="text-lg font-semibold">{title || t("Connected next actions", "الخطوات التالية المترابطة")}</h2>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {actions.map(action => <a key={`${action.related_href}-${action.priority}`} href={action.related_href} className="rounded-xl border bg-background p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
        <div className="font-semibold">{action.related_title}</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.reason}</p>
      </a>)}
    </div>
  </section>;
}
