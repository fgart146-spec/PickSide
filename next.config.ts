import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Prefer modern formats for next/image-optimized assets (e.g. the logo).
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: {
      // 투표 생성 시 최대 10MB 이미지 2장 + AI 초안 base64 이미지를 담을 수 있게
      // 기본 1MB보다 크게 잡음.
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
