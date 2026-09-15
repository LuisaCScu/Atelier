import type { MetadataRoute } from "next";
import { ATELIER_PUBLIC_ORIGIN } from "@/lib/contact";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/session", "/generate", "/regenerate", "/personalize", "/closet", "/you", "/profile", "/lookbook", "/style"],
      },
    ],
    sitemap: `${ATELIER_PUBLIC_ORIGIN}/sitemap.xml`,
  };
}
