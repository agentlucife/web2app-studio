import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp is used by the asset pipeline (icon/splash processing).
  serverExternalPackages: ["sharp"],
  // Never ship source maps of server code to the browser.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // The project generator reads maintained template files at runtime.
  outputFileTracingIncludes: {
    "/api/builds": ["./templates/generated/**/*"],
    "/api/projects/[id]/source": ["./templates/generated/**/*"],
    "/api/projects/[id]/sync": ["./templates/generated/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
