export default function Slide15Deployment() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "13vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Deployment
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Grid */}
      <div style={{ display: "flex", gap: "2.5vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vw" }}>
          <div style={{ flex: 1, backgroundColor: "#0A1628", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "1.5vh" }}>Hosting</div>
            <div style={{ fontSize: "2vw", fontWeight: 700, color: "#FAFAF9", letterSpacing: "-0.02em" }}>Live on Replit</div>
            <div style={{ fontSize: "1.2vw", color: "#94A3B8", marginTop: "1vh", lineHeight: 1.5 }}>API on /api, frontend at / — path-based routing via shared proxy</div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1.5vh" }}>Database</div>
            <div style={{ fontSize: "2vw", fontWeight: 700, color: "#0A1628", letterSpacing: "-0.02em" }}>PostgreSQL</div>
            <div style={{ fontSize: "1.2vw", color: "#64748B", marginTop: "1vh", lineHeight: 1.5 }}>Drizzle schema push — medicines seeded, activity log live</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vw" }}>
          <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1.5vh" }}>File storage</div>
            <div style={{ fontSize: "2vw", fontWeight: 700, color: "#0A1628", letterSpacing: "-0.02em" }}>Uploads directory</div>
            <div style={{ fontSize: "1.2vw", color: "#64748B", marginTop: "1vh", lineHeight: 1.5 }}>Prescription images saved to artifacts/api-server/uploads, served at /api/uploads/:filename</div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "1.5vh" }}>Build</div>
            <div style={{ fontSize: "2vw", fontWeight: 700, color: "#0A1628", letterSpacing: "-0.02em" }}>esbuild + Vite</div>
            <div style={{ fontSize: "1.2vw", color: "#64748B", marginTop: "1vh", lineHeight: 1.5 }}>CJS server bundle · Vite client build · pnpm workspaces</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Deployment / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>15</div>
      </div>
    </div>
  );
}
