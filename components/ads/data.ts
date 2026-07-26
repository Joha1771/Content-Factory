export const PLATFORM_META: Record<
  string,
  {
    color: string;
    textColor?: string;
    abbr: string;
    name: string;
    region: "cis" | "global";
  }
> = {
  yandex: {
    color: "#FFDB4D",
    textColor: "#664400",
    abbr: "Я",
    name: "Яндекс Директ",
    region: "cis",
  },
  vk: { color: "#0077FF", abbr: "VK", name: "VK Реклама", region: "cis" },
  telegram: {
    color: "#0088CC",
    abbr: "TG",
    name: "Telegram Ads",
    region: "cis",
  },
  mytarget: { color: "#FF6600", abbr: "MT", name: "myTarget", region: "cis" },
  kaspi: { color: "#E31E24", abbr: "K", name: "Kaspi Ads", region: "cis" },
  google: { color: "#34A853", abbr: "G", name: "Google Ads", region: "global" },
  meta: { color: "#1877F2", abbr: "M", name: "Meta Ads", region: "global" },
  tiktok: {
    color: "#000000",
    abbr: "TT",
    name: "TikTok Ads",
    region: "global",
  },
  instagram: {
    color: "#E1306C",
    abbr: "IG",
    name: "Instagram",
    region: "global",
  },
};
