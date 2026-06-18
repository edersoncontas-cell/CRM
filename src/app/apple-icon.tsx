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
          background: "#BFDE4D",
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 900, color: "#0b1220", letterSpacing: 2, lineHeight: 1 }}>
          CRM
        </div>
        <div style={{ fontSize: 70, fontWeight: 900, color: "#0b1220", lineHeight: 1, marginTop: 2 }}>
          EDY
        </div>
        <div style={{ marginTop: 10, width: 70, height: 7, borderRadius: 4, background: "#1a63f5" }} />
      </div>
    ),
    { ...size }
  );
}
