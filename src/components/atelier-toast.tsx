"use client";

const DEFAULT_MS = 2500;
const HOST_ID = "atelier-toast-host";

/** Small fixed-bottom client toast — no heavy lib. Auto-dismiss ~2.5s. */
export function showAtelierToast(message: string, ms = DEFAULT_MS) {
  if (typeof document === "undefined") return;
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.className =
      "pointer-events-none fixed inset-x-0 bottom-8 z-[90] flex justify-center px-4 transition-all duration-200";
    document.body.appendChild(host);
  }

  host.replaceChildren();
  const bubble = document.createElement("p");
  bubble.setAttribute("role", "status");
  bubble.setAttribute("aria-live", "polite");
  bubble.className =
    "max-w-[360px] rounded-full bg-black px-4 py-2.5 text-center text-[13px] leading-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)]";
  bubble.textContent = message;
  host.appendChild(bubble);
  host.style.opacity = "1";
  host.style.transform = "translateY(0)";

  const prior = Number(host.dataset.timer || 0);
  if (prior) window.clearTimeout(prior);
  const timer = window.setTimeout(() => {
    host!.style.opacity = "0";
    host!.style.transform = "translateY(8px)";
    window.setTimeout(() => {
      if (host?.isConnected) host.replaceChildren();
    }, 220);
  }, ms);
  host.dataset.timer = String(timer);
}
