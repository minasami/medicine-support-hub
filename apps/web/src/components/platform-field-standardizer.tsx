import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Country = {
  name: string;
  officialName: string;
  code: string;
  region: string;
  lat: number | null;
  lon: number | null;
};

type City = {
  id: number;
  name: string;
  country: string;
  countryCode: string;
  admin1: string;
  admin1Code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number | null;
};

type TargetFields = {
  country: HTMLInputElement | null;
  city: HTMLInputElement | null;
};

type LeafletMap = {
  setView: (coords: [number, number], zoom: number) => LeafletMap;
  on: (event: string, handler: (payload: { latlng: { lat: number; lng: number } }) => void) => LeafletMap;
  remove: () => void;
  invalidateSize: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  setLatLng: (coords: [number, number]) => LeafletMarker;
  on: (event: string, handler: (payload: { target: { getLatLng: () => { lat: number; lng: number } } }) => void) => LeafletMarker;
};

type LeafletGlobal = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => unknown };
  marker: (coords: [number, number], options?: Record<string, unknown>) => LeafletMarker;
};

const COUNTRY_CACHE_KEY = "msh_reference_countries_v1";
const COUNTRY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const COUNTRY_DATALIST_ID = "msh-standard-country-options";
const CITY_DATALIST_ID = "msh-standard-city-options";
const LARGE_SELECT_THRESHOLD = 12;
const DEFAULT_CENTER: [number, number] = [26.8206, 30.8025];

const fallbackCountries: Country[] = [
  { name: "Egypt", officialName: "Arab Republic of Egypt", code: "EG", region: "Africa", lat: 27, lon: 30 },
  { name: "Saudi Arabia", officialName: "Kingdom of Saudi Arabia", code: "SA", region: "Asia", lat: 25, lon: 45 },
  { name: "United Arab Emirates", officialName: "United Arab Emirates", code: "AE", region: "Asia", lat: 24, lon: 54 },
  { name: "Jordan", officialName: "Hashemite Kingdom of Jordan", code: "JO", region: "Asia", lat: 31, lon: 36 },
  { name: "United Kingdom", officialName: "United Kingdom of Great Britain and Northern Ireland", code: "GB", region: "Europe", lat: 54, lon: -2 },
  { name: "United States", officialName: "United States of America", code: "US", region: "Americas", lat: 38, lon: -97 },
];

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function nativeSetValue(input: HTMLInputElement | null, value: string) {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function associatedLabel(input: HTMLInputElement | HTMLSelectElement) {
  if (input.id) {
    const exact = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    if (exact) return exact.textContent || "";
  }
  const wrapped = input.closest("label");
  if (wrapped) return wrapped.textContent || "";
  const container = input.parentElement;
  return container?.querySelector("label")?.textContent || "";
}

function fieldIntent(input: HTMLInputElement) {
  const evidence = normalize(
    [input.name, input.id, input.placeholder, input.getAttribute("aria-label"), associatedLabel(input)]
      .filter(Boolean)
      .join(" "),
  );
  if (/\b(country|nation|الدوله|الدولة)\b/u.test(evidence)) return "country";
  if (/\b(city|town|municipality|المدينه|المدينة)\b/u.test(evidence)) return "city";
  return null;
}

function findCountryForCity(cityInput: HTMLInputElement) {
  const form = cityInput.closest("form") || cityInput.closest("[role=form]") || document;
  const inputs = [...form.querySelectorAll<HTMLInputElement>("input")].filter(
    (input) => input.offsetParent !== null,
  );
  const cityIndex = inputs.indexOf(cityInput);
  const preceding = inputs
    .slice(0, Math.max(0, cityIndex))
    .reverse()
    .find((input) => fieldIntent(input) === "country");
  return preceding || inputs.find((input) => fieldIntent(input) === "country") || null;
}

function countryFromValue(countries: Country[], value: string) {
  const query = normalize(value);
  return countries.find(
    (country) =>
      normalize(country.name) === query ||
      normalize(country.officialName) === query ||
      normalize(country.code) === query,
  );
}

async function fetchCountries(): Promise<Country[]> {
  try {
    const cached = JSON.parse(localStorage.getItem(COUNTRY_CACHE_KEY) || "null") as
      | { savedAt: number; countries: Country[] }
      | null;
    if (cached && Date.now() - cached.savedAt < COUNTRY_CACHE_TTL && cached.countries.length > 150) {
      return cached.countries;
    }
  } catch {
    // Ignore malformed local cache.
  }

  const response = await fetch(
    "https://restcountries.com/v3.1/all?fields=name,cca2,region,latlng",
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`Country directory unavailable: HTTP ${response.status}`);
  const rows = (await response.json()) as Array<{
    name?: { common?: string; official?: string };
    cca2?: string;
    region?: string;
    latlng?: number[];
  }>;
  const countries = rows
    .map((row) => ({
      name: String(row.name?.common || "").trim(),
      officialName: String(row.name?.official || row.name?.common || "").trim(),
      code: String(row.cca2 || "").toUpperCase(),
      region: String(row.region || ""),
      lat: Number.isFinite(row.latlng?.[0]) ? Number(row.latlng?.[0]) : null,
      lon: Number.isFinite(row.latlng?.[1]) ? Number(row.latlng?.[1]) : null,
    }))
    .filter((country) => country.name && country.code)
    .sort((left, right) => left.name.localeCompare(right.name));
  localStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), countries }));
  return countries;
}

async function fetchCities(query: string, countryCode?: string): Promise<City[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({
    name: query.trim(),
    count: "20",
    language: document.documentElement.lang || "en",
    format: "json",
  });
  if (countryCode) params.set("countryCode", countryCode);
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`City search unavailable: HTTP ${response.status}`);
  const payload = (await response.json()) as {
    results?: Array<{
      id?: number;
      name?: string;
      country?: string;
      country_code?: string;
      admin1?: string;
      admin1_id?: number;
      latitude?: number;
      longitude?: number;
      timezone?: string;
      population?: number;
    }>;
  };
  return (payload.results || [])
    .map((row) => ({
      id: Number(row.id || 0),
      name: String(row.name || "").trim(),
      country: String(row.country || "").trim(),
      countryCode: String(row.country_code || "").toUpperCase(),
      admin1: String(row.admin1 || "").trim(),
      admin1Code: row.admin1_id ? String(row.admin1_id) : "",
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      timezone: String(row.timezone || "").trim(),
      population: Number.isFinite(row.population) ? Number(row.population) : null,
    }))
    .filter((city) => city.id && city.name && Number.isFinite(city.latitude) && Number.isFinite(city.longitude));
}

export function PlatformFieldStandardizer() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [countries, setCountries] = useState<Country[]>(fallbackCountries);
  const [target, setTarget] = useState<TargetFields | null>(null);
  const [countryValue, setCountryValue] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  useEffect(() => {
    fetchCountries().then(setCountries).catch(() => setCountries(fallbackCountries));
  }, []);

  const country = useMemo(
    () => countryFromValue(countries, countryValue),
    [countries, countryValue],
  );

  const openPicker = useCallback((cityInput: HTMLInputElement) => {
    const countryInput = findCountryForCity(cityInput);
    setTarget({ country: countryInput, city: cityInput });
    setCountryValue(countryInput?.value || "");
    setCityQuery(cityInput.value || "");
    setSelectedCity(null);
    setLatitude(null);
    setLongitude(null);
    setError(null);
  }, []);

  useEffect(() => {
    const scan = () => {
      document.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        if (input.type === "hidden" || input.disabled) return;
        const intent = fieldIntent(input);
        if (intent === "country") {
          input.setAttribute("list", COUNTRY_DATALIST_ID);
          input.setAttribute("autocomplete", "country-name");
          input.setAttribute("inputmode", "search");
          input.dataset.mshLocationField = "country";
        }
        if (intent === "city") {
          input.setAttribute("list", CITY_DATALIST_ID);
          input.setAttribute("autocomplete", "address-level2");
          input.setAttribute("inputmode", "search");
          input.dataset.mshLocationField = "city";
          if (!input.parentElement?.querySelector("[data-msh-map-picker]")) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.mshMapPicker = "true";
            button.className =
              "mt-2 inline-flex min-h-10 items-center rounded-md border bg-background px-3 py-2 text-xs font-semibold text-primary shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring";
            button.textContent = t("Search city and choose on map", "ابحث عن المدينة وحددها على الخريطة");
            button.addEventListener("click", () => openPicker(input));
            input.insertAdjacentElement("afterend", button);
          }
        }
      });

      document.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
        if (select.disabled || select.options.length < LARGE_SELECT_THRESHOLD || select.dataset.mshSearchable) return;
        select.dataset.mshSearchable = "true";
        const search = document.createElement("input");
        search.type = "search";
        search.autocomplete = "off";
        search.placeholder = t("Search options…", "ابحث في الخيارات…");
        search.setAttribute("aria-label", `${t("Search", "بحث")}: ${associatedLabel(select) || t("options", "الخيارات")}`);
        search.className =
          "mb-2 flex min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
        search.addEventListener("input", () => {
          const query = normalize(search.value);
          [...select.options].forEach((option) => {
            option.hidden = Boolean(query) && !normalize(option.textContent || "").includes(query) && !option.selected;
          });
        });
        select.insertAdjacentElement("beforebegin", search);
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [openPicker, t]);

  useEffect(() => {
    if (!target || cityQuery.trim().length < 2) {
      setCityResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearching(true);
      setError(null);
      fetchCities(cityQuery, country?.code)
        .then((results) => {
          if (!controller.signal.aborted) setCityResults(results);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("City search failed.", "تعذر البحث عن المدينة."));
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [target, cityQuery, country?.code, t]);

  useEffect(() => {
    if (!target || !mapElementRef.current) return;
    const L = (window as unknown as { L?: LeafletGlobal }).L;
    if (!L) {
      setError(t("The map library could not load. City search still works.", "تعذر تحميل مكتبة الخريطة، لكن البحث عن المدينة ما زال متاحًا."));
      return;
    }
    const start: [number, number] = [
      latitude ?? country?.lat ?? DEFAULT_CENTER[0],
      longitude ?? country?.lon ?? DEFAULT_CENTER[1],
    ];
    const map = L.map(mapElementRef.current, { scrollWheelZoom: false }).setView(start, latitude ? 12 : country ? 5 : 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const marker = L.marker(start, { draggable: true }).addTo(map);
    const setPoint = (lat: number, lon: number) => {
      setLatitude(Number(lat.toFixed(6)));
      setLongitude(Number(lon.toFixed(6)));
      marker.setLatLng([lat, lon]);
    };
    map.on("click", ({ latlng }) => setPoint(latlng.lat, latlng.lng));
    marker.on("dragend", ({ target: nextMarker }) => {
      const point = nextMarker.getLatLng();
      setPoint(point.lat, point.lng);
    });
    mapRef.current = map;
    markerRef.current = marker;
    window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [target]);

  useEffect(() => {
    if (!target || latitude == null || longitude == null) return;
    markerRef.current?.setLatLng([latitude, longitude]);
    mapRef.current?.setView([latitude, longitude], 12);
  }, [target, latitude, longitude]);

  function chooseCity(city: City) {
    setSelectedCity(city);
    setCityQuery(city.name);
    setCountryValue(city.country || countryValue);
    setLatitude(city.latitude);
    setLongitude(city.longitude);
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(t("Location access is not supported by this browser.", "المتصفح لا يدعم تحديد الموقع."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(Number(coords.latitude.toFixed(6)));
        setLongitude(Number(coords.longitude.toFixed(6)));
      },
      () => setError(t("Location permission was denied or unavailable.", "تم رفض إذن الموقع أو تعذر تحديده.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function saveLocation() {
    const finalCountry = selectedCity?.country || countryValue.trim();
    const finalCity = selectedCity?.name || cityQuery.trim();
    nativeSetValue(target?.country || null, finalCountry);
    nativeSetValue(target?.city || null, finalCity);

    if (selectedCity) {
      try {
        await supabaseFetch("/rest/v1/rpc/register_reference_location", {
          method: "POST",
          body: JSON.stringify({
            p_geoname_id: selectedCity.id,
            p_name: selectedCity.name,
            p_country: selectedCity.country,
            p_country_code: selectedCity.countryCode,
            p_admin1: selectedCity.admin1 || null,
            p_admin1_code: selectedCity.admin1Code || null,
            p_latitude: selectedCity.latitude,
            p_longitude: selectedCity.longitude,
            p_timezone: selectedCity.timezone || null,
            p_population: selectedCity.population,
            p_source: "open_meteo_geocoding",
          }),
        });
      } catch {
        // Location remains usable in the form even when reference enrichment is temporarily unavailable.
      }
    }
    setTarget(null);
  }

  return (
    <>
      <datalist id={COUNTRY_DATALIST_ID}>
        {countries.map((item) => (
          <option key={item.code} value={item.name}>{item.code}</option>
        ))}
      </datalist>
      <datalist id={CITY_DATALIST_ID}>
        {cityResults.map((item) => (
          <option key={item.id} value={item.name}>{[item.admin1, item.country].filter(Boolean).join(", ")}</option>
        ))}
      </datalist>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {t("Choose a standardized location", "اختر موقعًا موحدًا")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Search a country and city, then confirm or refine the point on the OpenStreetMap map.",
                "ابحث عن الدولة والمدينة ثم أكد النقطة أو عدلها على خريطة OpenStreetMap.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
            <div className="space-y-4">
              <div>
                <Label>{t("Country", "الدولة")}</Label>
                <Input
                  className="mt-1"
                  list={COUNTRY_DATALIST_ID}
                  value={countryValue}
                  onChange={(event) => {
                    setCountryValue(event.target.value);
                    setSelectedCity(null);
                  }}
                  placeholder={t("Start typing a country", "ابدأ بكتابة اسم الدولة")}
                />
              </div>
              <div>
                <Label>{t("City", "المدينة")}</Label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={cityQuery}
                    onChange={(event) => {
                      setCityQuery(event.target.value);
                      setSelectedCity(null);
                    }}
                    placeholder={t("Type at least two letters", "اكتب حرفين على الأقل")}
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border">
                {searching && <p className="p-4 text-sm text-muted-foreground">{t("Searching cities…", "جارٍ البحث عن المدن…")}</p>}
                {!searching && cityQuery.trim().length >= 2 && cityResults.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">{t("No matching cities found. You may keep the typed value and choose a map point manually.", "لم يتم العثور على مدن مطابقة. يمكنك الاحتفاظ بالقيمة المكتوبة وتحديد النقطة يدويًا.")}</p>
                )}
                {cityResults.map((item) => {
                  const active = selectedCity?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-start justify-between gap-3 border-b p-3 text-left text-sm last:border-b-0 hover:bg-muted ${active ? "bg-primary/10" : ""}`}
                      onClick={() => chooseCity(item)}
                    >
                      <span>
                        <span className="font-semibold">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{[item.admin1, item.country, item.timezone].filter(Boolean).join(" · ")}</span>
                      </span>
                      {active && <Check className="mt-0.5 h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={() => void useCurrentLocation()}>
                <LocateFixed className="mr-2 h-4 w-4" />
                {t("Use my current location", "استخدم موقعي الحالي")}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div>
              <div ref={mapElementRef} className="h-[360px] w-full overflow-hidden rounded-xl border bg-muted" aria-label={t("Interactive location map", "خريطة تفاعلية للموقع")} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><Label>{t("Latitude", "خط العرض")}</Label><Input className="mt-1" inputMode="decimal" value={latitude ?? ""} onChange={(event) => setLatitude(event.target.value ? Number(event.target.value) : null)} /></div>
                <div><Label>{t("Longitude", "خط الطول")}</Label><Input className="mt-1" inputMode="decimal" value={longitude ?? ""} onChange={(event) => setLongitude(event.target.value ? Number(event.target.value) : null)} /></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "Map data © OpenStreetMap contributors. City search is provided by Open-Meteo geocoding. Coordinates improve mapping and analysis but do not replace address verification.",
                  "بيانات الخريطة © مساهمو OpenStreetMap، والبحث عن المدن مقدم من Open-Meteo. تحسن الإحداثيات الخرائط والتحليل لكنها لا تستبدل التحقق من العنوان.",
                )}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTarget(null)}>{t("Cancel", "إلغاء")}</Button>
            <Button type="button" onClick={() => void saveLocation()} disabled={!countryValue.trim() || !cityQuery.trim()}>{t("Use this location", "استخدم هذا الموقع")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
