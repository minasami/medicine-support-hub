export default function Slide04KeyUsers() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "12vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Key Users
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Three columns */}
      <div style={{ display: "flex", gap: "2.5vw", flex: 1 }}>
        <div style={{ flex: 1, borderTop: "3px solid #0E7490", paddingTop: "3vh", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>User type 01</div>
          <h3 style={{ fontSize: "2vw", fontWeight: 700, color: "#0A1628", margin: "0 0 2vh 0", letterSpacing: "-0.02em" }}>Patients & Families</h3>
          <p style={{ fontSize: "1.4vw", color: "#64748B", lineHeight: 1.55, margin: 0 }}>
            Submit medicine requests for themselves or a relative. Track status from pending to delivery without calling the pharmacy.
          </p>
        </div>
        <div style={{ flex: 1, borderTop: "3px solid #0A1628", paddingTop: "3vh", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>User type 02</div>
          <h3 style={{ fontSize: "2vw", fontWeight: 700, color: "#0A1628", margin: "0 0 2vh 0", letterSpacing: "-0.02em" }}>Pharmacy Reviewers</h3>
          <p style={{ fontSize: "1.4vw", color: "#64748B", lineHeight: 1.55, margin: 0 }}>
            Approve, prepare, and track fulfillment through a structured dashboard. Every status change is logged for accountability.
          </p>
        </div>
        <div style={{ flex: 1, borderTop: "3px solid #0A1628", paddingTop: "3vh", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>User type 03</div>
          <h3 style={{ fontSize: "2vw", fontWeight: 700, color: "#0A1628", margin: "0 0 2vh 0", letterSpacing: "-0.02em" }}>Clinical Staff</h3>
          <p style={{ fontSize: "1.4vw", color: "#64748B", lineHeight: 1.55, margin: 0 }}>
            Consult the AI-assisted Clinical Support Assistant for medicine interaction and dosing guidance — with clear decision-support disclaimers.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Key Users / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>04</div>
      </div>
    </div>
  );
}
