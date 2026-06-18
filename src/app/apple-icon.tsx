import { ImageResponse } from "next/og";

// Ícone usado pelo iOS ao "Adicionar à Tela de Início" (apple-touch-icon).
// Gerado como PNG pelo Next — o iOS não aceita SVG aqui.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#1a63f5,#0b3aa0)",
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>CRM</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: "#BFDE4D", lineHeight: 1, marginTop: 8 }}>EDY</div>
      </div>
    ),
    { ...size }
  );
}
