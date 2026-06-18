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
          background: "#BFDE4D",
          color: "#0b1220",
          fontSize: 44,
          fontWeight: 900,
        }}
      >
        E
      </div>
    ),
    { ...size }
  );
}
