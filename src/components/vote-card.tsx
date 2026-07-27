"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckIcon } from "lucide-react";
import { visualFor, PICK_PURPLE } from "@/lib/poll-visuals";
import type { PollCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type VoteCardResult = { percent: number; count: number };

type VoteCardProps = {
  label: string;
  category: PollCategory;
  side: "A" | "B";
  imageUrl?: string | null;
  /** Interactive (published, not yet voted). */
  clickable?: boolean;
  /** This card is the viewer's pick. */
  selected?: boolean;
  /** When set, results are revealed with an animated bar. */
  result?: VoteCardResult | null;
  /** Highlight as the leading option. */
  winner?: boolean;
  onSelect?: () => void;
};

const BOTTOM_SCRIM =
  "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0) 100%)";

export function VoteCard({
  label,
  category,
  side,
  imageUrl,
  clickable = false,
  selected = false,
  result = null,
  winner = false,
  onSelect,
}: VoteCardProps) {
  const { emoji, gradient } = visualFor(category, side);
  const showResult = result != null;
  const percent = result?.percent ?? null;

  // Animate the progress bar from 0 → percent once results are revealed.
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    if (percent == null) return;
    const t = setTimeout(() => setBarWidth(percent), 60);
    return () => clearTimeout(t);
  }, [percent]);

  // Local previews (upload composer) use blob:/data: URLs, which next/image
  // can't process — fall back to a plain <img> for those.
  const isLocalPreview = imageUrl?.startsWith("blob:") || imageUrl?.startsWith("data:");

  const inner = (
    <>
      {imageUrl ? (
        isLocalPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Image
            src={imageUrl}
            alt={label}
            fill
            unoptimized
            sizes="(max-width: 768px) 46vw, 340px"
            className="object-cover"
          />
        )
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundImage: gradient }}
        >
          <span className="text-6xl drop-shadow-lg select-none sm:text-7xl" aria-hidden>
            {emoji}
          </span>
        </div>
      )}

      {/* Legibility scrim behind the label */}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: BOTTOM_SCRIM }} />

      {selected && (
        <div
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-white shadow-md"
          style={{ backgroundColor: PICK_PURPLE }}
        >
          <CheckIcon className="size-5" />
        </div>
      )}

      {showResult && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
          <span className="text-4xl font-extrabold text-white drop-shadow-md sm:text-5xl">
            {result.percent}%
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3 sm:p-4">
        {showResult && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${barWidth}%`,
                backgroundColor: winner ? PICK_PURPLE : "rgba(255,255,255,0.85)",
              }}
            />
          </div>
        )}
        <span className="line-clamp-2 text-sm font-bold text-white drop-shadow-md sm:text-base">
          {label}
        </span>
      </div>
    </>
  );

  const shared = cn(
    "group relative aspect-square w-full overflow-hidden rounded-[22px] text-left shadow-lg transition-all duration-200 ease-out",
    selected && "scale-[1.02]"
  );
  const ringStyle = selected ? { boxShadow: `0 0 0 4px ${PICK_PURPLE}` } : undefined;

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={label}
        className={cn(shared, "cursor-pointer hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]")}
        style={ringStyle}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={shared} style={ringStyle}>
      {inner}
    </div>
  );
}
