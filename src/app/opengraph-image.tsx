import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aura Influences — Créez vos influenceuses virtuelles IA";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a, #1e1b4b, #0f172a)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "white",
            marginBottom: 16,
          }}
        >
          Aura Influences
        </div>
        <div style={{ fontSize: 28, color: "#a78bfa" }}>
          {"Créez des influenceuses virtuelles propulsées par l'IA"}
        </div>
      </div>
    ),
    { ...size }
  );
}
