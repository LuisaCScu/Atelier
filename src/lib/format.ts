export function formatMoney(value: number): string {
  return `$${Math.round(value)}`;
}

export function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] || "Alex";
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function lookTitle(number: number, title: string): string {
  return `${number} ${title}`;
}

export function todayLabel(): string {
  return "today";
}
