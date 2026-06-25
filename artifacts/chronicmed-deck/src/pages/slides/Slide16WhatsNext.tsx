export default function Slide16WhatsNext() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#0A1628", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8vh" }}>
        <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#FAFAF9", letterSpacing: "-0.02em" }}>ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>16 / 16</div>
      </div>

      {/* Big text + columns */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", marginBottom: "6vh" }}>
          <div style={{ position: "absolute", left: "-1.5vw", top: "1.5vh", width: "20vw", height: "6vh", backgroundColor: "#FFFFFF", opacity: 0.04, zIndex: 0 }} />
          <h2 style={{ fontSize: "5.5vw", fontWeight: 700, color: "#FAFAF9", margin: 0, lineHeight: 1, letterSpacing: "-0.04em", position: "relative", zIndex: 1 }}>
            What's Next
          </h2>
        </div>

        <div style={{ display: "flex", gap: "2vw" }}>
          <div style={{ flex: 1, borderTop: "2px solid #0E7490", paddingTop: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "2vh" }}>Priority 01</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#FAFAF9", marginBottom: "1.5vh", letterSpacing: "-0.01em", lineHeight: 1.2 }}>AI integration</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", lineHeight: 1.5 }}>Enable full OCR and clinical assistant via OpenAI key</div>
          </div>
          <div style={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh" }}>Priority 02</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#FAFAF9", marginBottom: "1.5vh", letterSpacing: "-0.01em", lineHeight: 1.2 }}>Patient notifications</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", lineHeight: 1.5 }}>SMS / email alerts on status change — no more manual follow-up calls</div>
          </div>
          <div style={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh" }}>Priority 03</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#FAFAF9", marginBottom: "1.5vh", letterSpacing: "-0.01em", lineHeight: 1.2 }}>Mobile experience</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", lineHeight: 1.5 }}>Mobile-optimized patient experience for on-the-go request submission</div>
          </div>
          <div style={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh" }}>Priority 04</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#FAFAF9", marginBottom: "1.5vh", letterSpacing: "-0.01em", lineHeight: 1.2 }}>Admin analytics</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", lineHeight: 1.5 }}>Request volume, turnaround time, and pharmacy load reporting</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>What's Next / ChronicMed</div>
        <div style={{ width: "8vw", height: "2px", backgroundColor: "#0E7490" }} />
      </div>
    </div>
  );
}
