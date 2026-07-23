import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so builds are deterministic and
  // don't get confused by unrelated lockfiles in parent directories.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Real product media is served from the Jetpack/Photon CDN and the store.
    remotePatterns: [
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      { protocol: "https", hostname: "trycommonplace.com" },
      { protocol: "https", hostname: "*.trycommonplace.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
