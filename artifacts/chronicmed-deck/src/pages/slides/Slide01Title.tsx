export default function Slide01Title() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw" }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", letterSpacing: "-0.02em" }}>
          ChronicMed
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.9vw", color: "#64748B", display: "flex", flexDirection: "column", gap: "0.8vh", textAlign: "right" }}>
          <div><span style={{ color: "#0E7490", marginRight: "0.8vw" }}>Project:</span>ChronicMed Platform</div>
          <div><span style={{ color: "#0E7490", marginRight: "0.8vw" }}>Status:</span>Live on Replit</div>
          <div><span style={{ color: "#0E7490", marginRight: "0.8vw" }}>Version:</span>1.0</div>
        </div>
      </div>

      {/* Hero title block — bottom left */}
      <div style={{ position: "absolute", bottom: "15vh", left: "5vw", width: "90vw" }}>
        <div style={{ position: "relative", marginBottom: "3vh" }}>
          <div style={{ position: "absolute", left: "-1.5vw", top: "1.5vh", width: "30vw", height: "6vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h1 style={{ fontSize: "8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.04em", position: "relative", zIndex: 1 }}>
            ChronicMed
          </h1>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <p style={{ fontSize: "1.8vw", fontWeight: 500, color: "#64748B", margin: 0, maxWidth: "52vw", lineHeight: 1.4 }}>
            A bilingual chronic medicines support platform — connecting patients, pharmacists, and clinicians in one managed workflow.
          </p>
          <div style={{ width: "28vw", height: "1px", backgroundColor: "#0E7490" }} />
        </div>
      </div>
    </div>
  );
}
