export default function Slide14AIIntegration() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "17vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            AI Integration
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Two features side by side */}
      <div style={{ display: "flex", gap: "2.5vw", flex: 1 }}>
        <div style={{ flex: 1, backgroundColor: "#0E7490", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Feature 01</div>
          <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em", lineHeight: 1.1 }}>OCR Extraction</div>
          <p style={{ fontSize: "1.3vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: 0 }}>
            Prescription image uploaded as base64 → OpenAI vision model extracts medicine names → auto-populates request form rows
          </p>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Feature 02</div>
          <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#0A1628", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Clinical Assistant</div>
          <p style={{ fontSize: "1.3vw", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
            GPT-powered medicine interaction and dosing guidance — with a structured fallback response when no API key is configured
          </p>
        </div>
        <div style={{ width: "22vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ backgroundColor: "#0A1628", padding: "3vh 2vw", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "1.5vh" }}>Safe degradation</div>
            <p style={{ fontSize: "1.3vw", color: "#FAFAF9", lineHeight: 1.5, margin: 0, fontWeight: 500 }}>Full feature set works without any AI key — no silent failures</p>
          </div>
          <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "2.5vh 2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1vh" }}>Configured via</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 500 }}>AI_INTEGRATIONS_OPENAI_BASE_URL</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>AI Integration / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>14</div>
      </div>
    </div>
  );
}
