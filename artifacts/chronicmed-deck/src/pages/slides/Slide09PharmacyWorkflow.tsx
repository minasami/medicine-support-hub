export default function Slide09PharmacyWorkflow() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "22vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Pharmacy Workflow
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Status chain */}
      <div style={{ display: "flex", alignItems: "center", gap: "1vw", marginBottom: "5vh" }}>
        <div style={{ backgroundColor: "#0E7490", padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#FFFFFF", fontWeight: 500 }}>Pending</div>
        </div>
        <div style={{ fontSize: "1.5vw", color: "#0E7490", fontWeight: 700 }}>→</div>
        <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 500 }}>Approved</div>
        </div>
        <div style={{ fontSize: "1.5vw", color: "#64748B", fontWeight: 700 }}>→</div>
        <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 500 }}>Preparing</div>
        </div>
        <div style={{ fontSize: "1.5vw", color: "#64748B", fontWeight: 700 }}>→</div>
        <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 500 }}>Ready</div>
        </div>
        <div style={{ fontSize: "1.5vw", color: "#64748B", fontWeight: 700 }}>→</div>
        <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 500 }}>Delivered</div>
        </div>
        <div style={{ fontSize: "1.5vw", color: "#64748B", fontWeight: 700 }}>→</div>
        <div style={{ backgroundColor: "#0A1628", padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#FAFAF9", fontWeight: 500 }}>Closed</div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>01</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Every transition logged</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Activity table records who changed what and when — full audit trail</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>02</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Reviewer notes at each stage</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Captured and stored with the request — visible to all reviewers</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>03</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Prescription image inline</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Reviewers see the uploaded prescription directly in the detail view</div>
            </div>
          </div>
        </div>
        <div style={{ width: "28vw", backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "3vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1.5vh" }}>Rejection path</div>
          <p style={{ fontSize: "1.4vw", fontWeight: 600, color: "#0A1628", lineHeight: 1.4, margin: 0 }}>
            Pending can also move to Rejected — with a required note explaining the reason.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Pharmacy Workflow / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>09</div>
      </div>
    </div>
  );
}
