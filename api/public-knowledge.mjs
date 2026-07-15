const ALLOWED_TYPES = new Set([
  "company",
  "generic",
  "therapeutic-category",
  "medicine",
]);
const clean = (value, max = 180) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

async function wikipedia(language, query) {
  const api = `https://${language}.wikipedia.org/w/api.php`;
  const headers = {
    "User-Agent":
      "MedicineSupportHub/1.0 (https://medicine-support-hub.vercel.app/contact)",
  };
  const found = await fetch(
    `${api}?action=query&format=json&origin=*&list=search&srnamespace=0&srlimit=1&srsearch=${encodeURIComponent(query)}`,
    { headers },
  );
  if (!found.ok) return null;
  const title = (await found.json())?.query?.search?.[0]?.title;
  if (!title) return null;
  const details = await fetch(
    `${api}?action=query&format=json&origin=*&prop=extracts|pageimages|info&inprop=url&exintro=1&explaintext=1&piprop=thumbnail|original&pithumbsize=720&titles=${encodeURIComponent(title)}`,
    { headers },
  );
  if (!details.ok) return null;
  const page = Object.values((await details.json())?.query?.pages || {})[0];
  if (!page || page.missing !== undefined || !page.extract) return null;
  return {
    title: page.title,
    extract: clean(page.extract, 1400),
    pageUrl: page.fullurl,
    imageUrl: page.thumbnail?.source || page.original?.source || null,
    source: "Wikipedia",
    attribution:
      "Text is provided by Wikipedia under CC BY-SA; image licensing may vary. Open the source page for attribution details.",
    language,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET")
    return response.status(405).json({ error: "Method not allowed" });
  const type = clean(request.query?.type, 40);
  const name = clean(request.query?.name);
  const language = request.query?.language === "ar" ? "ar" : "en";
  if (!ALLOWED_TYPES.has(type) || name.length < 2)
    return response
      .status(400)
      .json({ error: "A valid entity type and name are required." });
  const suffix =
    type === "company"
      ? "pharmaceutical company"
      : type === "generic"
        ? "drug"
        : "medicine";
  const result =
    (await wikipedia(language, `${name} ${suffix}`)) ||
    (language !== "en" ? await wikipedia("en", `${name} ${suffix}`) : null);
  response.setHeader(
    "Cache-Control",
    "public, s-maxage=86400, stale-while-revalidate=604800",
  );
  return response
    .status(200)
    .json({ result, query: name, type, clinicalAdvice: false });
}
