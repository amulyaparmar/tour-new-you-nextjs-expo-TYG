type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export async function setAnalyticsUserId(userId: string | null) {
  void userId;
}

export async function trackAnalyticsEvent(name: string, params?: AnalyticsParams) {
  void name;
  void params;
}
