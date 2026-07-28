import { ImageResponse } from "next/og";
import { PICK_PURPLE } from "@/lib/poll-visuals";

export const alt = "PickSide — 둘 중 하나를 골라 투표하는 서비스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          gap: 24,
          background: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 60%, #ffffff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: PICK_PURPLE }}>
          PickSide
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#4c1d95", fontWeight: 500 }}>
          둘 중 하나를 골라 투표하는 서비스
        </div>
      </div>
    ),
    size
  );
}
