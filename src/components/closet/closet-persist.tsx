"use client";

import { startCutoutQueueWorker } from "@/lib/closet-cutout-queue";
import { ensureClosetImagesHydrated, hydrateCloset } from "@/lib/closet-store";
import { useEffect } from "react";

export function ClosetPersist() {
  useEffect(() => {
    hydrateCloset();
    void ensureClosetImagesHydrated();
    startCutoutQueueWorker();
  }, []);
  return null;
}
