// Appwrite Serverless Function: OCR Prescription Scanner & Document Parser
export default async ({ req, res, log, error }) => {
  log("OCR Prescription Parser Function triggered.");

  try {
    let payload = {};
    if (req.body) {
      try {
        payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch {}
    }

    const imageUrl = payload.image_url || payload.url;
    const base64Data = payload.image_base64 || payload.data;

    if (!imageUrl && !base64Data) {
      return res.json({
        success: false,
        error: "Missing image_url or image_base64 payload."
      }, 400);
    }

    log(`Parsing prescription document from ${imageUrl ? "image URL" : "base64 payload"}`);

    // Simulated high-precision pharmaceutical OCR parser response structure
    return res.json({
      success: true,
      document_type: "prescription",
      parsed_medicines: [
        {
          name_detected: "Ketomax Cream",
          confidence_score: 0.98,
          strength: "2%",
          dosage_instructions: "Apply twice daily",
          matched_canonical_id: 9901
        }
      ],
      detected_doctor: "Dr. Medical Specialist",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    error("OCR execution error: " + String(err.message || err));
    return res.json({
      success: false,
      error: String(err.message || err)
    }, 500);
  }
};
