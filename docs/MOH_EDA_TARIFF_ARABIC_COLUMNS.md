# MOH / EDA tariff CSV — Arabic column mapping

`scripts/parse-moh-eda-tariff.mjs` auto-maps **Arabic and English** headers (case-insensitive, spaces/underscores normalized).

## Supported logical fields

| Logical field | Arabic headers (examples) | English headers (examples) |
|---------------|---------------------------|----------------------------|
| **name_en** | الاسم الانجليزي، الاسم الإنجليزي، اسم انجليزي | Trade Name, English Name, Product Name, Medicine Name |
| **name_ar** | الاسم العربي، الاسم التجاري، اسم الدواء | Arabic Name |
| **scientific_name** | المادة الفعالة، الاسم العلمي، التركيب | Scientific Name, Generic, Active Ingredient |
| **price** | السعر، السعر الرسمي، سعر الجمهور، سعر البيع | Price, Tariff, Official Price, Public Price, Retail Price |
| **manufacturer** | الشركة، الشركة المصنعة، المصنع، صاحب العلامة | Manufacturer, Company, Company Name |
| **strength** | التركيز، القوة | Strength, Concentration |
| **pack** | العبوة، حجم العبوة، الشكل الصيدلي للعبوة | Pack, Pack Size, Package |
| **reg_no** | رقم التسجيل، رقم القيد، رقم المستحضر | Registration, Reg No, Registration Number |

## Automated parsing behavior

1. **Delimiter auto-detect**: `,` or `;` or tab (most common column count wins).
2. **BOM strip** on first header (`\uFEFF`).
3. **Alias match**: exact normalized header, then substring contains.
4. **Script detect**: if only one name column is present, Arabic script → `name_ar`, else `name_en`.
5. **Price parse**: strips currency symbols and thousand separators.

## Example minimal Arabic CSV

```csv
الاسم التجاري,الاسم الانجليزي,المادة الفعالة,السعر الرسمي,الشركة
بانادول اكسترا,Panadol Extra,Paracetamol + Caffeine,32.5,GSK
```

```bash
node scripts/parse-moh-eda-tariff.mjs --input tariff-ar.csv --out scripts/reports/moh-eda-tariff.json
node scripts/enrich-appwrite-from-moh-tariff.mjs --dry-run
```

## Tips

- Prefer one row per **trade name + pack** strength.
- Keep `السعر الرسمي` as the MOH/EDA figure (not pharmacy promo prices).
- Re-run parse + enrich after each official circular.
