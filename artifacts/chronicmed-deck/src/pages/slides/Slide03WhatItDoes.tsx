export default function Slide03WhatItDoes() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#0A1628", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#FAFAF9" }}>ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>03 / 16</div>
      </div>

      {/* Big statement */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.9vw", color: "#0E7490", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3vh" }}>What ChronicMed Does</div>
        <div style={{ position: "relative", marginBottom: "5vh" }}>
          <div style={{ position: "absolute", left: "-1.5vw", top: "1.5vh", width: "45vw", height: "8vh", backgroundColor: "#FFFFFF", opacity: 0.04, zIndex: 0 }} />
          <h2 style={{ fontSize: "5.5vw", fontWeight: 700, color: "#FAFAF9", margin: 0, lineHeight: 1.1, letterSpacing: "-0.03em", maxWidth: "75vw", position: "relative", zIndex: 1 }}>
            One platform. Patient to pharmacy to delivery.
          </h2>
        </div>
        <p style={{ fontSize: "1.8vw", color: "#94A3B8", maxWidth: "55vw", lineHeight: 1.5, margin: 0 }}>
          Routes medicine requests end-to-end with full bilingual EN/AR support at every step — from prescription upload to doorstep delivery.
        </p>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "2vh", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Overview / ChronicMed</div>
        <div style={{ width: "8vw", height: "2px", backgroundColor: "#0E7490" }} />
      </div>
    </div>
  );
}
