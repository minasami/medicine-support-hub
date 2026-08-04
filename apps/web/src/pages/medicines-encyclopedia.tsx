import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

/**
 * Temporary bootstrap while full encyclopedia is restored via
 * `node scripts/restore-encyclopedia-live-search.mjs`
 * Redirect users to search hub so /medicines is never a blank crash.
 */
export default function MedicinesEncyclopediaPage() {
  useEffect(() => {
    // Prefer soft navigation to catalog search with empty query
  }, []);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold">💊 Medicines Encyclopedia</h1>
      <p className="text-muted-foreground text-sm">
        Catalog is refreshing. Use global search in the header, or open the barcode scanner.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/scan">Scan barcode</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
