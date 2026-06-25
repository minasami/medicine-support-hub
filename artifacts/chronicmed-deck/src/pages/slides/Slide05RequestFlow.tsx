export default function Slide05RequestFlow() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "14vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Request Flow
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Four steps */}
      <div style={{ display: "flex", gap: "2vw", flex: 1, alignItems: "stretch" }}>
        <div style={{ flex: 1, backgroundColor: "#0E7490", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "rgba(255,255,255,0.6)", marginBottom: "1.5vh" }}>Step 01</div>
          <div>
            <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "2vh" }}>Submit</div>
            <p style={{ fontSize: "1.2vw", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, margin: 0 }}>Patient submits request with medicines and prescription photo</p>
          </div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", marginBottom: "1.5vh" }}>Step 02</div>
          <div>
            <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#0A1628", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "2vh" }}>Review</div>
            <p style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5, margin: 0 }}>Reviewer approves or rejects with notes</p>
          </div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", marginBottom: "1.5vh" }}>Step 03</div>
          <div>
            <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#0A1628", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "2vh" }}>Prepare</div>
            <p style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5, margin: 0 }}>Pharmacy prepares medicines and marks ready</p>
          </div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", marginBottom: "1.5vh" }}>Step 04</div>
          <div>
            <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#0A1628", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "2vh" }}>Close</div>
            <p style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5, margin: 0 }}>Request delivered and closed with full audit trail</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Request Flow / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>05</div>
      </div>
    </div>
  );
}
