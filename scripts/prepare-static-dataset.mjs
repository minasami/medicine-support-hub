// scripts/prepare-static-dataset.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const fullDatasetPath = path.join(root, 'apps', 'web', 'src', 'data', 'egyptian-medicines-dataset.json');
const publicDatasetPath = path.join(root, 'apps', 'web', 'public', 'data', 'egyptian-medicines-dataset.json');

console.log('[Dataset Optimizer] Reading 17.6MB dataset file...');
const rawText = fs.readFileSync(fullDatasetPath, 'utf8');
const data = JSON.parse(rawText);

console.log(`[Dataset Optimizer] Total medicines: ${data.medicines?.length}, Total companies: ${data.companies?.length}`);

fs.mkdirSync(path.dirname(publicDatasetPath), { recursive: true });
fs.writeFileSync(publicDatasetPath, JSON.stringify(data), 'utf8');
console.log(`[Dataset Optimizer] Wrote full dataset to public static asset: ${publicDatasetPath}`);

// Create a lightweight 300KB dataset for src/ to keep Vite build memory under 50MB
const topMeds = data.medicines.slice(0, 300);
const soulMeds = data.medicines.filter((m) => {
  const mfg = String(m.manufacturer || '').toUpperCase();
  const raw = String(m.raw_manufacturer || '').toUpperCase();
  const tm = String(m.trademark_owner || '').toUpperCase();
  return mfg.includes('SOUL PHARMA') || raw.includes('SOUL PHARMA') || tm.includes('SOUL PHARMA');
});

for (const sm of soulMeds) {
  if (!topMeds.some((tm) => tm.canonical_id === sm.canonical_id)) {
    topMeds.push(sm);
  }
}

const topCompanies = (data.companies || []).slice(0, 50);

const lightweightData = {
  medicines: topMeds,
  companies: topCompanies,
};

fs.writeFileSync(fullDatasetPath, JSON.stringify(lightweightData), 'utf8');
const newSize = fs.statSync(fullDatasetPath).size;
console.log(`[Dataset Optimizer] Shrinked src/data/egyptian-medicines-dataset.json from 17.6MB -> ${(newSize / 1024).toFixed(1)}KB! Bundle size optimized.`);
