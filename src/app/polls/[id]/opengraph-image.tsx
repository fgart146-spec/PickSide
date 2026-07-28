import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { createServiceClient } from "@/lib/supabase/service";
import { SITE_URL } from "@/lib/site-url";
import { PICK_PURPLE } from "@/lib/poll-visuals";

export const alt = "PickSide 투표 결과";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 60;

type OptionRow = { id: string; label: string; votes: { count: number }[] };

async function loadPoll(id: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("polls")
    .select("question, vote_count, poll_options(id, label, votes(count))")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  return data as { question: string; vote_count: number; poll_options: OptionRow[] } | null;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poll = await loadPoll(id);

  if (!poll || poll.poll_options.length < 2) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f3ff",
            fontSize: 56,
            fontWeight: 700,
            color: PICK_PURPLE,
          }}
        >
          PickSide
        </div>
      ),
      size
    );
  }

  const [optionA, optionB] = poll.poll_options;
  const countA = optionA.votes[0]?.count ?? 0;
  const countB = optionB.votes[0]?.count ?? 0;
  const total = countA + countB;
  const pctA = total === 0 ? 50 : Math.round((countA / total) * 100);
  const pctB = 100 - pctA;

  const qrDataUrl = await QRCode.toDataURL(`${SITE_URL}/polls/${id}`, {
    width: 160,
    margin: 1,
    color: { dark: "#1e1b4b", light: "#ffffff" },
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          background: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 60%, #ffffff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: PICK_PURPLE }}>
            PickSide
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            width={96}
            height={96}
            style={{ borderRadius: 12, border: "4px solid white" }}
            alt=""
          />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 42,
              fontWeight: 700,
              color: "#1e1b4b",
              lineHeight: 1.3,
            }}
          >
            {poll.question}
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: optionA.label, pct: pctA },
              { label: optionB.label, pct: pctB },
            ].map((opt, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: 10,
                  padding: 24,
                  borderRadius: 20,
                  background: "white",
                  boxShadow: "0 4px 16px rgba(76, 29, 149, 0.12)",
                }}
              >
                <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "#1e1b4b" }}>
                  {opt.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    height: 16,
                    borderRadius: 999,
                    background: "#ede9fe",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: `${opt.pct}%`,
                      height: "100%",
                      background: PICK_PURPLE,
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: PICK_PURPLE }}>
                  {opt.pct}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#6d28d9", fontWeight: 600 }}>
          총 {poll.vote_count}명 참여 · pickside
        </div>
      </div>
    ),
    size
  );
}
