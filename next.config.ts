import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "atelier-assets.vercel.app",
        pathname: "/**",
      },
    ],
  },
  // Client ML cutout (@imgly/background-removal) — keep out of the Node server graph.
  serverExternalPackages: ["@imgly/background-removal", "onnxruntime-web"],
  async redirects() {
    return [
      { source: "/looks", destination: "/how", permanent: false },
      { source: "/looks/:path*", destination: "/how", permanent: false },
      { source: "/closet/add/manual", destination: "/closet/add/note", permanent: false },
      { source: "/you", destination: "/profile", permanent: false },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
