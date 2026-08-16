import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function Dashboard() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/admin");
  }, [navigate]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <CardTitle>
            {t("Redirecting to Admin Dashboard", "جاري التوجيه إلى لوحة الإدارة")}
          </CardTitle>
          <CardDescription>
            {t(
              "The old dashboard route now points to the Supabase-native admin dashboard.",
              "مسار لوحة التحكم القديم يشير الآن إلى لوحة إدارة Supabase الأصلية.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link href="/admin">
              {t("Open Admin Dashboard", "افتح لوحة الإدارة")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
