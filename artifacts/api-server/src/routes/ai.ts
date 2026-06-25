import { Router } from "express";
import { ExtractMedicinesBody, GetClinicalSupportBody } from "@workspace/api-zod";

const router = Router();

// OCR-assisted extraction: uses basic pattern matching as fallback (no API key needed)
router.post("/ai/extract-medicines", async (req, res) => {
  try {
    const parsed = ExtractMedicinesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const aiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const aiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (aiBaseUrl && aiKey) {
      try {
        // @ts-expect-error openai is optional at runtime; loaded only when configured
        const { default: OpenAI } = await import("openai");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = new (OpenAI as any)({ baseURL: aiBaseUrl, apiKey: aiKey });
        const imageData = parsed.data.image_base64.replace(/^data:[^;]+;base64,/, "");
        const response = await client.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } },
                { type: "text", text: "Extract medicine names from this prescription image. Return ONLY a JSON array of strings with the medicine names, no explanation. Example: [\"Metformin 500mg\", \"Lisinopril 10mg\"]" },
              ],
            },
          ],
          max_tokens: 500,
        });

        const content = response.choices[0]?.message?.content ?? "[]";
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          const medicines = JSON.parse(match[0]) as string[];
          res.json({ medicines, raw_text: content });
          return;
        }
      } catch (aiErr) {
        req.log.warn({ aiErr }, "AI extraction failed, using fallback");
      }
    }

    res.json({
      medicines: [],
      raw_text: "OCR extraction requires AI integration. Please manually enter medicine names, or contact support to enable AI-assisted extraction.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to extract medicines");
    res.status(500).json({ error: "Failed to extract medicines" });
  }
});

// Clinical support assistant
router.post("/ai/clinical-support", async (req, res) => {
  try {
    const parsed = GetClinicalSupportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { query, medicines, context } = parsed.data;
    const disclaimer =
      "IMPORTANT: This response is for decision support only and does not constitute a final clinical decision. Always consult a qualified pharmacist or physician before acting on this information. | تنبيه: هذه المعلومات لأغراض الدعم في اتخاذ القرار فقط ولا تمثل قراراً سريرياً نهائياً. يُرجى دائماً استشارة صيدلاني أو طبيب مؤهل قبل التصرف بناءً على هذه المعلومات.";

    const aiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const aiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (aiBaseUrl && aiKey) {
      try {
        // @ts-expect-error openai is optional at runtime; loaded only when configured
        const { default: OpenAI } = await import("openai");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = new (OpenAI as any)({ baseURL: aiBaseUrl, apiKey: aiKey });

        const systemPrompt = `You are a clinical support assistant for a pharmacy chronic medicines management system. 
You provide decision support information about medicines, dosages, interactions, and chronic disease management.
You MUST always clarify that your responses are for decision support only and not a final clinical decision.
Respond in the same language as the question (Arabic or English).
Be concise, accurate, and professional. Always mention when something requires direct clinical judgment.`;

        const userContent = [
          query,
          medicines?.length ? `Medicines involved: ${medicines.join(", ")}` : "",
          context ? `Additional context: ${context}` : "",
        ].filter(Boolean).join("\n");

        const response = await client.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          max_tokens: 800,
        });

        res.json({
          response: response.choices[0]?.message?.content ?? "Unable to generate response.",
          disclaimer,
          sources: [],
        });
        return;
      } catch (aiErr) {
        req.log.warn({ aiErr }, "AI clinical support failed, using fallback");
      }
    }

    res.json({
      response: `Clinical Support (Fallback Mode): Your query "${query}" has been received. AI-assisted clinical support requires AI integration to be enabled. In the meantime, please consult the formulary or contact a clinical pharmacist directly for guidance on this matter.`,
      disclaimer,
      sources: [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get clinical support");
    res.status(500).json({ error: "Failed to get clinical support" });
  }
});

export default router;
