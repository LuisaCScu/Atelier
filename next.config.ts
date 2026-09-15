import type { NextConfig } from "next";
const config: NextConfig = {
  images: { unoptimized: true },
  async redirects() {
    return [
      ...["style", "closet", "lookbook", "profile", "planner", "inspiration", "discover"].map(view => ({ source: `/${view}/:path*`, destination: `/#${view}`, permanent: false })),
      ...["start", "quick", "personalize", "you"].map(path => ({ source: `/${path}/:path*`, destination: "/#profile", permanent: false })),
      ...["looks", "how", "about", "contact", "privacy", "terms", "disclosure", "premium", "upgrade"].map(path => ({ source: `/${path}/:path*`, destination: "/", permanent: false })),
    ];
  },
};
export default config;
