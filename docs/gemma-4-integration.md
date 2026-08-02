# Gemma 4 integration

## Role in Medicine Support Hub

| Layer | Technology |
|-------|------------|
| **Barcode decode** | Google **ML Kit** (on-device, fast) |
| **Catalog match** | Appwrite + static + Open Product Facts |
| **Optional brief** | **Gemma 4** via Google AI `generateContent` |

Gemma does **not** replace barcode scanning. It adds a short educational product brief after a pack is identified.

## Models (Google AI / Gemini API host)

| Id | Notes |
|----|--------|
| `gemma-4-e2b-it` | Smallest cloud id (edge-oriented family) |
| `gemma-4-e4b-it` | Small multimodal |
| `gemma-4-26b-a4b-it` | **Default** — efficient MoE |
| `gemma-4-31b-it` | Highest quality dense |

Code: `apps/web/src/lib/gemma-client.ts`  
UI: **Gemma 4 brief** button on `/scan` when key is set.

## Configure

1. Create an API key in [Google AI Studio](https://aistudio.google.com/).
2. Set for web builds:

```bash
VITE_GOOGLE_AI_API_KEY=your_key_here
```

3. Rebuild / redeploy. Without the key, scan still works; the Gemma button is hidden.

**Do not** commit keys. Prefer Appwrite/Functions proxy later so the key is not in the client bundle for production.

## Safety

- System prompt forbids diagnosis/prescribing.
- UI labels output as educational only.
- Does not invent EDA verification.

## On-device future

Gemma 4 **E2B/E4B** mobile builds (LiteRT / AI Edge Gallery) can later run offline on-device; this integration uses the **cloud API** for reliability across devices without shipping multi‑GB weights in the APK.
