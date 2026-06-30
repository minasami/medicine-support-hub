import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import PartnershipLeadsPage from "@/pages/partnership-leads";
import PilotWorkspacePage from "@/pages/pilot-workspace";

export default function NotFound() {
  if (window.location.pathname === "/admin/leads") return <PartnershipLeadsPage />;
  if (window.location.pathname.startsWith("/workspace/pilots/")) return <PilotWorkspacePage />;
  return <div className="min-h-screen w-full flex items-center justify-center bg-gray-50"><Card className="w-full max-w-md mx-4"><CardContent className="pt-6"><div className="flex mb-4 gap-2"><AlertCircle className="h-8 w-8 text-red-500" /><h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1></div><p className="mt-4 text-sm text-gray-600">Did you forget to add the page to the router?</p></CardContent></Card></div>;
}
