import Constants from "expo-constants";

const PRODUCTION_API_BASE_URL = "https://tour.you";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** RFC1918 / link-local — typical laptop LAN IPs that change between Wi‑Fi networks. */
function isMutableLanHost(hostname: string) {
  if (isLoopbackHost(hostname)) return true;
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a = 0, b = 0] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

function metroLanHostname(): string | null {
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  if (!debuggerHost) return null;
  const lanIp = debuggerHost.split(":")[0]?.trim();
  if (!lanIp || isLoopbackHost(lanIp)) return null;
  return lanIp;
}

export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const metroHost = metroLanHostname();

  if (raw) {
    const configuredUrl = raw.replace(/\/+$/, "");
    try {
      const url = new URL(configuredUrl);
      // In dev, follow Metro's LAN IP so a stale .env (e.g. old 192.168.x.x) can't break fetch.
      if (__DEV__ && metroHost && isMutableLanHost(url.hostname)) {
        url.hostname = metroHost;
        return url.toString().replace(/\/+$/, "");
      }
      if (!isLoopbackHost(url.hostname)) {
        return configuredUrl;
      }
      return __DEV__ ? configuredUrl : PRODUCTION_API_BASE_URL;
    } catch {
      return __DEV__ ? configuredUrl : PRODUCTION_API_BASE_URL;
    }
  }

  if (__DEV__ && metroHost) {
    return `http://${metroHost}:3000`;
  }

  return __DEV__ ? "http://localhost:3000" : PRODUCTION_API_BASE_URL;
}

/** Public site URL for follow-up links (defaults to API host in dev). */
export function getSiteBaseUrl(): string {
  const site = process.env.EXPO_PUBLIC_SITE_URL?.trim();
  if (site) {
    const configuredUrl = site.replace(/\/+$/, "");
    const metroHost = metroLanHostname();
    try {
      const url = new URL(configuredUrl);
      // Keep local site URLs reachable when Metro serves the app over LAN.
      if (__DEV__ && metroHost && isMutableLanHost(url.hostname)) {
        url.hostname = metroHost;
        return url.toString().replace(/\/+$/, "");
      }
      return configuredUrl;
    } catch {
      return configuredUrl;
    }
  }
  return getApiBaseUrl();
}
