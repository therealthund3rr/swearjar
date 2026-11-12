import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run next to `next dev` without sharing .next (local checks only).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // SSE must not be buffered by gzip.
  compress: false,
};

export default nextConfig;
