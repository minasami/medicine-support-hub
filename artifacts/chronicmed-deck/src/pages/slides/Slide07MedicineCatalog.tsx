export default function Slide07MedicineCatalog() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "19vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Medicine Catalog
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Stat + categories */}
      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <p style={{ fontSize: "1.5vw", color: "#64748B", lineHeight: 1.5, margin: 0 }}>
            Seeded at launch with 30+ bilingual medicines across all major chronic disease categories.
          </p>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2vw" }}>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", fontWeight: 500 }}>Cardiovascular</div>
            </div>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", fontWeight: 500 }}>Diabetes</div>
            </div>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", fontWeight: 500 }}>Thyroid</div>
            </div>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", fontWeight: 500 }}>Respiratory</div>
            </div>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", fontWeight: 500 }}>Psychiatry</div>
            </div>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", fontWeight: 500 }}>Gastrointestinal</div>
            </div>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", fontWeight: 500 }}>Pain</div>
            </div>
            <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", fontWeight: 500 }}>Supplements</div>
            </div>
          </div>
          <div style={{ marginTop: "1vh" }}>
            <div style={{ fontSize: "1.3vw", color: "#0A1628", fontWeight: 500 }}>Searchable by English or Arabic name — both directions work.</div>
          </div>
        </div>
        <div style={{ width: "28vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ backgroundColor: "#0A1628", padding: "3.5vh 2.5vw", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "1vh" }}>Total medicines</div>
            <div style={{ fontSize: "7vw", fontWeight: 700, color: "#FAFAF9", lineHeight: 1, letterSpacing: "-0.04em" }}>30+</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", marginTop: "1.5vh" }}>at launch, expandable by admins</div>
          </div>
          <div style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "2.5vh 2.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1vh" }}>Both names stored</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#0A1628" }}>Metformin 500mg</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#0E7490", marginTop: "0.5vh" }}>ميتفورمين 500 ملغ</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Medicine Catalog / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>07</div>
      </div>
    </div>
  );
}
