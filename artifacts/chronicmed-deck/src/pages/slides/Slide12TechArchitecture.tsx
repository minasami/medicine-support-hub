export default function Slide12TechArchitecture() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#0A1628", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "24vw", height: "3vh", backgroundColor: "#FFFFFF", opacity: 0.06, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#FAFAF9", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Technical Architecture
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#FAFAF9" }}>ChronicMed</div>
      </div>

      {/* Two columns */}
      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ borderTop: "2px solid #0E7490", paddingTop: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Frontend</div>
            <div style={{ fontSize: "1.4vw", color: "#FAFAF9", lineHeight: 1.6, fontWeight: 500 }}>React + Vite + Tailwind CSS + shadcn/ui</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", lineHeight: 1.5, marginTop: "0.5vh" }}>Wouter routing — no React Router overhead</div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Backend</div>
            <div style={{ fontSize: "1.4vw", color: "#FAFAF9", lineHeight: 1.6, fontWeight: 500 }}>Express 5 + PostgreSQL + Drizzle ORM</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", lineHeight: 1.5, marginTop: "0.5vh" }}>Zod validation on every request and response</div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "2.5vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Monorepo</div>
            <div style={{ fontSize: "1.4vw", color: "#FAFAF9", lineHeight: 1.6, fontWeight: 500 }}>pnpm workspaces + Node 24 + TypeScript 5.9</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", lineHeight: 1.5, marginTop: "0.5vh" }}>Shared libs: api-spec, api-client-react, db, api-zod</div>
          </div>
        </div>
        <div style={{ width: "30vw", backgroundColor: "#FAFAF9", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Contract-first design</div>
          <p style={{ fontSize: "1.6vw", fontWeight: 700, color: "#0A1628", lineHeight: 1.3, margin: "0 0 3vh 0", letterSpacing: "-0.01em" }}>
            OpenAPI spec → Orval codegen → typed hooks + Zod schemas on both client and server
          </p>
          <div style={{ width: "4vw", height: "2px", backgroundColor: "#0E7490" }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Technical Architecture / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#FAFAF9", fontWeight: 500 }}>12</div>
      </div>
    </div>
  );
}
