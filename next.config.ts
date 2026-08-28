import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The scenes are captured by screenshotting the dev server, so the dev overlay
  // would be composited into the video. Turning it off is what keeps a captured
  // frame exactly the composition. Compile and runtime errors still surface.
  devIndicators: false,
};

export default nextConfig;
