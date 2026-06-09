import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: 18,
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#39FF14",
          borderRadius: "50%",
          border: "2px solid #39FF14",
          boxShadow: "0 0 8px #39FF14",
        }}
      >
        ⚡
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}
