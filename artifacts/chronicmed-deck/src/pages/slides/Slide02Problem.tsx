export default function Slide02Problem() {
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
            The Problem
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Content */}
      <div style={{ display: "flex", gap: "5vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3.5vh" }}>
          <p style={{ fontSize: "1.7vw", fontWeight: 500, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
            Chronic disease patients refill the same prescriptions repeatedly — yet the process is manual, fragmented, and error-prone.
          </p>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "3vh" }}>
            <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490", fontWeight: 500, minWidth: "2.5vw" }}>01</div>
              <p style={{ fontSize: "1.4vw", color: "#0A1628", lineHeight: 1.5, margin: 0 }}>
                Pharmacy staff manage requests through paper, phone, or disconnected systems
              </p>
            </div>
            <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490", fontWeight: 500, minWidth: "2.5vw" }}>02</div>
              <p style={{ fontSize: "1.4vw", color: "#0A1628", lineHeight: 1.5, margin: 0 }}>
                No visibility into request status for patients or reviewers
              </p>
            </div>
            <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490", fontWeight: 500, minWidth: "2.5vw" }}>03</div>
              <p style={{ fontSize: "1.4vw", color: "#0A1628", lineHeight: 1.5, margin: 0 }}>
                Arabic-speaking populations often lack localized healthcare tools
              </p>
            </div>
          </div>
        </div>
        <div style={{ width: "30vw", backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2vh" }}>The gap</div>
          <p style={{ fontSize: "1.8vw", fontWeight: 700, color: "#0A1628", lineHeight: 1.25, margin: 0, letterSpacing: "-0.02em" }}>
            No single platform handles the full chronic medicine request lifecycle — from patient to pharmacy to delivery.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>The Problem / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>02</div>
      </div>
    </div>
  );
}
