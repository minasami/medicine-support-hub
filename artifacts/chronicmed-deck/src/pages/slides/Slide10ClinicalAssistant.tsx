export default function Slide10ClinicalAssistant() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "25vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Clinical Support Assistant
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Disclaimer banner */}
      <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #F59E0B", padding: "2vh 2.5vw", marginBottom: "4vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", fontWeight: 500, color: "#92400E" }}>
          FOR DECISION SUPPORT ONLY — NOT A FINAL CLINICAL DECISION &nbsp;|&nbsp; للدعم في اتخاذ القرار فقط — ليس قراراً سريرياً نهائياً
        </div>
      </div>

      {/* Features */}
      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>01</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Chat interface for clinicians</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Query medicine interactions, dosing, and chronic disease guidance</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>02</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Non-dismissible warning</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Prominent amber banner in both English and Arabic — always visible</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>03</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>AI-powered with safe fallback</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Full GPT responses when key is configured; structured fallback when offline</div>
            </div>
          </div>
        </div>
        <div style={{ width: "28vw", backgroundColor: "#0A1628", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "1.5vh" }}>Design intent</div>
          <p style={{ fontSize: "1.5vw", fontWeight: 600, color: "#FAFAF9", lineHeight: 1.4, margin: 0 }}>
            The assistant aids clinical judgment — it never replaces it. The warning is permanent and bilingual by design.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Clinical Support Assistant / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>10</div>
      </div>
    </div>
  );
}
