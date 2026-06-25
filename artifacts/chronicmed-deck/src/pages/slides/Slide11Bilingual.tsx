export default function Slide11Bilingual() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "#FAFAF9", fontFamily: "'Space Grotesk', sans-serif", boxSizing: "border-box", padding: "5vh 5vw", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "-1vw", top: "1.2vh", width: "20vw", height: "3vh", backgroundColor: "#0A1628", opacity: 0.07, zIndex: 0 }} />
          <h2 style={{ fontSize: "3.8vw", fontWeight: 700, color: "#0A1628", margin: 0, lineHeight: 1, letterSpacing: "-0.03em", position: "relative", zIndex: 1 }}>
            Bilingual by Design
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", fontWeight: 700, color: "#0A1628" }}>ChronicMed</div>
      </div>

      {/* Content: split */}
      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        {/* EN side */}
        <div style={{ flex: 1, borderTop: "3px solid #0E7490", paddingTop: "3vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0E7490", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>English — LTR</div>
          <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "3vh", letterSpacing: "-0.02em" }}>Request Medicines</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", minWidth: "2.5vw" }}>01</div>
              <div style={{ fontSize: "1.3vw", color: "#0A1628", lineHeight: 1.5 }}>Full English / Arabic toggle throughout every page</div>
            </div>
            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", minWidth: "2.5vw" }}>02</div>
              <div style={{ fontSize: "1.3vw", color: "#0A1628", lineHeight: 1.5 }}>All labels, messages, and UI copy translated at component level</div>
            </div>
            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#64748B", minWidth: "2.5vw" }}>03</div>
              <div style={{ fontSize: "1.3vw", color: "#0A1628", lineHeight: 1.5 }}>One app, two languages — no separate builds or routes</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "1px", backgroundColor: "#E2E8F0" }} />

        {/* AR side */}
        <div style={{ flex: 1, borderTop: "3px solid #0A1628", paddingTop: "3vh", textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Arabic — RTL</div>
          <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#0A1628", marginBottom: "3vh", letterSpacing: "-0.02em" }}>طلب الأدوية</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div style={{ fontSize: "1.3vw", color: "#0A1628", lineHeight: 1.5 }}>تبديل كامل بين العربية والإنجليزية في كل صفحة</div>
            <div style={{ fontSize: "1.3vw", color: "#0A1628", lineHeight: 1.5 }}>تنعكس الواجهة من اليمين إلى اليسار عند تفعيل العربية</div>
            <div style={{ fontSize: "1.3vw", color: "#0A1628", lineHeight: 1.5 }}>تطبيق واحد بلغتين — بدون بنيات منفصلة</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", right: "5vw", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "2vh" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#64748B" }}>Bilingual by Design / ChronicMed</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#0A1628", fontWeight: 500 }}>11</div>
      </div>
    </div>
  );
}
