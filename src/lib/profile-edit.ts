/** Profile-tab isolated editor (not onboarding wizard). */
export function isProfileEdit(search?: { from?: string; edit?: string } | null): boolean {
  if (!search) return false;
  return search.from === "profile" || search.edit === "1" || search.edit === "true";
}

export function withProfileEdit(href: string): string {
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}from=profile`;
}
