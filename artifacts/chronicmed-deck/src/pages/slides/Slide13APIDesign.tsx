export default function Slide13APIDesign() {
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
            API Design
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Two column */}
      <div style={{ display: "flex", gap: "4vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>01</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Single OpenAPI source of truth</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>All contracts defined in one YAML — server and client stay in sync automatically</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>02</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Auto-generated React Query hooks</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>useListMedicines, useCreateRequest, useUpdateRequest — no manual fetch code</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>03</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Route groups</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Medicines · Requests · Dashboard · AI · Uploads</div>
            </div>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: "2vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0E7490", minWidth: "2.5vw" }}>04</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "0.5vh" }}>Activity log</div>
              <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Every status transition written to the activity table — feeds the dashboard feed</div>
            </div>
          </div>
        </div>
        <div style={{ width: "32vw", backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh" }}>Codegen command</div>
          <div style={{ backgroundColor: "#0A1628", padding: "2vh 1.5vw", marginBottom: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490" }}>pnpm --filter</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#FAFAF9" }}>@workspace/api-spec</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0E7490" }}>run codegen</div>
          </div>
          <div style={{ fontSize: "1.2vw", color: "#64748B", lineHeight: 1.5 }}>Regenerates all typed hooks and Zod schemas from the OpenAPI spec in one step.</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>API Design / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>13</div>
      </div>
    </div>
  );
}
