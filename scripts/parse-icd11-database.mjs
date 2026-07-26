// scripts/parse-icd11-database.mjs
import fs from 'fs';
import path from 'path';

const txtPath = 'C:\\Users\\Mina.s.Tawfik\\Downloads\\Databases\\LinearizationMiniOutput-ICHI-en.txt';
const outputPath = path.resolve(process.cwd(), 'apps', 'web', 'public', 'data', 'icd11-ichi-codes.json');

if (fs.existsSync(txtPath)) {
  console.log('[ICD-11 Parser] Reading LinearizationMiniOutput-ICHI-en.txt...');
  const lines = fs.readFileSync(txtPath, 'utf8').split('\n');

  const categories = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 5) continue;

    const uri = parts[0]?.trim();
    const code = parts[2]?.trim() || '';
    const rawTitle = parts[4]?.trim() || '';
    const classKind = parts[5]?.trim() || '';

    const cleanTitle = rawTitle.replace(/^[- ]+/, '').replace(/\(proposed\)$/i, '').trim();

    if (cleanTitle && (code || classKind === 'category' || classKind === 'chapter' || classKind === 'block')) {
      categories.push({
        code: code || `ICHI-${i}`,
        title: cleanTitle,
        kind: classKind,
        uri: uri
      });
    }
  }

  // Deduplicate and filter top 1500 leaf items
  const unique = [];
  const seen = new Set();
  for (const item of categories) {
    const key = `${item.code}_${item.title.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(unique.slice(0, 2000)), 'utf8');
  console.log(`[ICD-11 Parser] Wrote ${unique.length} standardized ICD-11/ICHI codes to ${outputPath}`);
} else {
  console.warn('[ICD-11 Parser] File not found at expected path:', txtPath);
}
