import { ImageResponse } from "next/og";

// The preview card shown when the site's link is shared (LinkedIn, X, Slack,
// WhatsApp, iMessage). Drawn at build time from this code, so it never goes
// stale against an exported picture. Same look as the landing page: near-black,
// the headline on the left, a dim tilted approval card on the right.

export const alt = "Kolumna: let AI agents work on your board, safely";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0b0b0c";
const FG = "#f4f4f5";
const MUTED = "#a1a1aa";
const FAINT = "rgba(255,255,255,0.32)";
const MINT = "#5fc79a";
const AMBER = "#e9b949";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, position: "relative", overflow: "hidden" }}>
        {/* The approval card, tilted and dim, bleeding off the right edge. */}
        <div
          style={{
            position: "absolute",
            right: -90,
            top: 150,
            width: 620,
            display: "flex",
            flexDirection: "column",
            padding: 34,
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "linear-gradient(155deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
            transform: "rotate(-8deg)",
            opacity: 0.85,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: FAINT, fontSize: 24 }}>
            <div style={{ width: 12, height: 12, borderRadius: 99, background: AMBER }} />
            <div style={{ display: "flex" }}>Claude Code · 3m ago</div>
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 38, color: "rgba(255,255,255,0.7)" }}>Move KOL-14 to Done</div>
          <div style={{ display: "flex", marginTop: 26, height: 10, borderRadius: 99, background: "rgba(255,255,255,0.12)", position: "relative" }}>
            <div style={{ display: "flex", width: "62%", height: 10, borderRadius: 99, background: "rgba(255,255,255,0.6)" }} />
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 22, color: FAINT }}>Confidence 62% · needs 80%</div>
          <div style={{ display: "flex", marginTop: 30, gap: 16 }}>
            <div style={{ display: "flex", padding: "12px 26px", borderRadius: 12, background: "rgba(255,255,255,0.75)", color: BG, fontSize: 24 }}>
              Approve
            </div>
            <div style={{ display: "flex", padding: "12px 20px", color: FAINT, fontSize: 24 }}>Reject</div>
          </div>
        </div>
        {/* A dark wash from the left, so the headline always reads. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: `linear-gradient(90deg, ${BG} 0%, ${BG} 46%, rgba(11,11,12,0.2) 78%, rgba(11,11,12,0.5) 100%)`,
          }}
        />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", padding: "72px 80px", width: 740 }}>
          {/* The logo: five bars, low / high / low / high / low, then the name. */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, height: 30 }}>
              {[7, 0, 7, 0, 7].map((top, i) => (
                <div key={i} style={{ width: 8, height: 23, marginTop: top, background: FG }} />
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 4, color: FG }}>KOLUMNA</div>
          </div>

          <div style={{ display: "flex", marginTop: 64, fontSize: 62, lineHeight: 1.12, letterSpacing: -1.5, color: FG }}>
            Let AI agents work on your board, safely.
          </div>
          <div style={{ display: "flex", marginTop: 34, fontSize: 27, lineHeight: 1.45, color: MUTED }}>
            Approvals, budgets and a full audit trail for Claude Code, Cursor and any MCP agent.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 30, fontSize: 22, color: MUTED }}>
            <div style={{ width: 10, height: 10, borderRadius: 99, background: MINT }} />
            Free during the beta
          </div>
        </div>
      </div>
    ),
    size,
  );
}
