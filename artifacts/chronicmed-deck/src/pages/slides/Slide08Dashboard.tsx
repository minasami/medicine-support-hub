export default function Slide08Dashboard() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "20vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Reviewer Dashboard
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "1.5vw", marginBottom: "4vh" }}>
        <div style={{ flex: 1.4, backgroundColor: "#0A1628", padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#94A3B8", marginBottom: "0.8vh" }}>Total</div>
          <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#FAFAF9", lineHeight: 1, letterSpacing: "-0.03em" }}>All</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#0E7490", marginBottom: "0.8vh" }}>Pending</div>
          <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#0A1628", lineHeight: 1, letterSpacing: "-0.03em" }}>--</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#64748B", marginBottom: "0.8vh" }}>Approved</div>
          <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#0A1628", lineHeight: 1, letterSpacing: "-0.03em" }}>--</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#64748B", marginBottom: "0.8vh" }}>Preparing</div>
          <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#0A1628", lineHeight: 1, letterSpacing: "-0.03em" }}>--</div>
        </div>
        <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#64748B", marginBottom: "0.8vh" }}>Delivered</div>
          <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#0A1628", lineHeight: 1, letterSpacing: "-0.03em" }}>--</div>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>01</div>
            <p style={{ fontSize: "1.35vw", color: "#0A1628", lineHeight: 1.5, margin: 0 }}>Status filter tabs for rapid queue triage — All, Pending, Approved, Preparing, Ready, Delivered, Closed</p>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>02</div>
            <p style={{ fontSize: "1.35vw", color: "#0A1628", lineHeight: 1.5, margin: 0 }}>Recent activity feed showing every status change in real time</p>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>03</div>
            <p style={{ fontSize: "1.35vw", color: "#0A1628", lineHeight: 1.5, margin: 0 }}>One-click through to full request detail with prescription preview</p>
          </div>
        </div>
        <div style={{ width: "28vw", backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "3vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live data from</div>
          <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>React Query hooks</div>
          <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Auto-generated from OpenAPI spec — no manual fetch code</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Reviewer Dashboard / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>08</div>
      </div>
    </div>
  );
}
