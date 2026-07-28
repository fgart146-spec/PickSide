import type { PollCategory } from "@/lib/categories";

// Per-category visual identity for image-less option cards. Each option side
// (A/B) gets a slightly different angle/hue so two fallback cards in the same
// category still read as a distinct pair. Gradients are inline CSS strings so
// they render regardless of the Tailwind gradient-utility version.
export type PollVisual = {
  emoji: string;
  gradientA: string;
  gradientB: string;
};

export const POLL_VISUALS: Record<PollCategory, PollVisual> = {
  연애: {
    emoji: "❤️",
    gradientA: "linear-gradient(135deg, #fb7185 0%, #e879f9 55%, #a855f7 100%)",
    gradientB: "linear-gradient(45deg, #f472b6 0%, #d946ef 60%, #9333ea 100%)",
  },
  게임: {
    emoji: "🎮",
    gradientA: "linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)",
    gradientB: "linear-gradient(45deg, #06b6d4 0%, #2563eb 100%)",
  },
  음식: {
    emoji: "🍕",
    gradientA: "linear-gradient(135deg, #fb923c 0%, #ef4444 100%)",
    gradientB: "linear-gradient(45deg, #fbbf24 0%, #f97316 100%)",
  },
  일상: {
    emoji: "☀️",
    gradientA: "linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)",
    gradientB: "linear-gradient(45deg, #2dd4bf 0%, #0ea5e9 100%)",
  },
  밸런스: {
    emoji: "⚖️",
    gradientA: "linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%)",
    gradientB: "linear-gradient(45deg, #a855f7 0%, #7c3aed 100%)",
  },
  기타: {
    emoji: "✨",
    gradientA: "linear-gradient(135deg, #a78bfa 0%, #9333ea 100%)",
    gradientB: "linear-gradient(45deg, #e879f9 0%, #7c3aed 100%)",
  },
};

// The brand purple used for selection / winner accents across the VS UI.
export const PICK_PURPLE = "#7c5cfc";

// Categories created by an admin beyond the original 6 have no hand-tuned
// gradient here — fall back to a two-tone variant of their admin-set color
// (or the brand purple, if none was set) instead of crashing.
function fallbackVisual(color?: string | null): PollVisual {
  const base = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : PICK_PURPLE;
  return {
    emoji: "✨",
    gradientA: `linear-gradient(135deg, ${base} 0%, ${base}cc 100%)`,
    gradientB: `linear-gradient(45deg, ${base}cc 0%, ${base} 100%)`,
  };
}

export function visualFor(category: string, side: "A" | "B", color?: string | null) {
  const known = (POLL_VISUALS as Record<string, PollVisual>)[category];
  const v = known ?? fallbackVisual(color);
  return { emoji: v.emoji, gradient: side === "A" ? v.gradientA : v.gradientB };
}
