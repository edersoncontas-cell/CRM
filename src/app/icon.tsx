import { ImageResponse } from "next/og";

// Favicon / ícone do app (aba do navegador e PWA).
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#1a63f5,#0b3aa0)",
          color: "#BFDE4D",
          fontSize: 40,
          fontWeight: 800,
        }}
      >
        E
      </div>
    ),
    { ...size }
  );
}
