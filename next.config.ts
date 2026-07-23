import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so builds are deterministic and
  // don't get confused by unrelated lockfiles in parent directories.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
