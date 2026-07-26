import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // AI 초안 결과 JSON에 base64 이미지를 담아 가져올 수 있어 기본 1MB보다 크게 잡음.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
