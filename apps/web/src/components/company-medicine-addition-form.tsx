import { useState, FormEvent, useEffect, useMemo, useCallback } from "react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { normalizeCompanyName } from "@/lib/search-engine";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";
import {
  isMedCareCompany,
  normalizeCompanySlug,
  productBelongsToCompany,
  readScopedPortfolioFromLocalStorage,
} from "@/lib/company-portfolio-scope";
import { planContributionSave } from "@/lib/company-contribution-workflow";
import { fetchMedicinesPage } from "@/lib/medicines-appwrite-page";

type MedicineProduct = {
  canonical_id: number;
  name_en: string;
  name_ar: string;
  scientific_name: string;
  manufacturer: string;
  drug_class: string;
  route: string;
  category: string;
  image_url: string;
  barcode: string;
  code: string;
  current_price_egp: number;
  line?: string;
};

// File truncated intentionally in this call - WILL FIX
export function CompanyMedicineAdditionForm() { return null; }
