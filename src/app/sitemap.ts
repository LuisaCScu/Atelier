import type { MetadataRoute } from "next";
import { ATELIER_PUBLIC_ORIGIN } from "@/lib/contact";
import { listPublicLookbooks } from "@/lib/public-looks";

export const revalidate = 3600;

const TRUST_PATHS = ["", "/how", "/about", "/privacy", "/terms", "/disclosure", "/contact", "/looks"] as const;

function trustEntries(): MetadataRoute.Sitemap {
  return TRUST_PATHS.map((path) => ({
    url: `${ATELIER_PUBLIC_ORIGIN}${path || "/"}`,
    changeFrequency: path === "/looks" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}

async function lookEntries(): Promise<MetadataRoute.Sitemap> {
  const books = await Promise.race([
    listPublicLookbooks(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("sitemap-looks-timeout")), 3500)),
  ]).catch(() => []);
  const extra: MetadataRoute.Sitemap = [];
  for (const book of books) {
    extra.push({
      url: `${ATELIER_PUBLIC_ORIGIN}/looks/${book.requestId}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    for (const look of book.response.looks) {
      extra.push({
        url: `${ATELIER_PUBLIC_ORIGIN}/looks/${book.requestId}/${look.id}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }
  return extra;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const core = trustEntries();
  try {
    return [...core, ...(await lookEntries())];
  } catch {
    return core;
  }
}
