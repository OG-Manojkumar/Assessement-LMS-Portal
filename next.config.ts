import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LocalTunnel domains for testing
  serverExternalPackages: [],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      allowedOrigins: ['192.168.88.33:3000', '192.168.88.44:3000', 'c133ba5b6733a5.lhr.life', 'acclaim-trickster-deuce.ngrok-free.dev', 'localhost:3000']
    }
  } as any // TS bypass for experimental if needed
};

// Based on the error log Next 15 requires:
(nextConfig as any).allowedDevOrigins = ['192.168.88.33', '192.168.88.33:3000', '192.168.88.44', '192.168.88.44:3000', 'c133ba5b6733a5.lhr.life', 'acclaim-trickster-deuce.ngrok-free.dev'];
export default nextConfig;
