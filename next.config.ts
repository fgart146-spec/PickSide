import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Prefer modern formats for next/image-optimized assets (e.g. the logo).
    formats: ["image/avif", "image/webp"],
    // Lets next/image optimize (resize + AVIF/WebP negotiate) images served
    // from Supabase Storage, instead of the `unoptimized` escape hatch that
    // was needed before this was configured.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
