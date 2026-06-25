export default function Slide06RequestForm() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "22vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Patient Request Form
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Content */}
      <div style={{ display: "flex", gap: "5vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490", fontWeight: 500, minWidth: "2.5vw" }}>01</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Searchable medicine catalog</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>30+ chronic disease medicines, bilingual EN/AR, type to filter</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490", fontWeight: 500, minWidth: "2.5vw" }}>02</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Auto-expanding medicine rows</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Name, quantity, notes per row — add as many as needed</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490", fontWeight: 500, minWidth: "2.5vw" }}>03</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>For-self or for-relative toggle</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Reveals patient name and relation fields when needed</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490", fontWeight: 500, minWidth: "2.5vw" }}>04</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Prescription upload + OCR</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Image upload with AI-assisted medicine extraction</div>
            </div>
          </div>
        </div>
        <div style={{ width: "30vw", backgroundColor: "#0A1628", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2vh" }}>Validated with</div>
          <p style={{ fontSize: "1.6vw", fontWeight: 700, color: "#FAFAF9", lineHeight: 1.3, margin: "0 0 3vh 0", letterSpacing: "-0.01em" }}>React Hook Form + Zod schema validation on every field</p>
          <div style={{ width: "4vw", height: "2px", backgroundColor: "#0E7490" }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Patient Request Form / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>06</div>
      </div>
    </div>
  );
}
