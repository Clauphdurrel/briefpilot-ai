import { ImageResponse } from "next/og";
export const alt =
  "BriefPilot AI — Des besoins clients aux spécifications prêtes à développer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: "#171b35",
        color: "#fafbff",
        padding: 72,
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: "#ad9fff" }}>
        ↗ BriefPilot AI
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 66,
          fontWeight: 700,
          letterSpacing: -3,
          maxWidth: 1000,
        }}
      >
        Des besoins clients aux spécifications prêtes à développer.
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#c9c8de" }}>
        Interview IA · Cahier des charges · Backlog · Prompts Codex
      </div>
    </div>,
    size,
  );
}
