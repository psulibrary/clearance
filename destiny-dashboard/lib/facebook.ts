const GRAPH_VERSION = 'v19.0';

async function graphGet(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'Facebook Graph API error');
  return json;
}

// Insight metric names change/get deprecated over time on Facebook's side —
// fetch each independently so one unsupported metric doesn't break the rest.
const INSIGHT_METRICS = ['page_engaged_users', 'page_post_engagements', 'page_impressions', 'page_fan_adds'] as const;

export interface FacebookPageInsights {
  pageName: string | null;
  totalFollowers: number | null;
  engagedUsers28d: number | null;
  postEngagements28d: number | null;
  impressions28d: number | null;
  newFans28d: number | null;
}

export async function getPageInsights(): Promise<FacebookPageInsights> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN not configured');

  const profile = await graphGet(`/${pageId}`, {
    fields: 'name,fan_count,followers_count',
    access_token: token,
  });

  const values: Record<string, number | null> = {};
  for (const metric of INSIGHT_METRICS) {
    try {
      const data = await graphGet(`/${pageId}/insights`, {
        metric,
        period: 'days_28',
        access_token: token,
      });
      const series = (data.data as { values?: { value: number }[] }[] | undefined)?.[0]?.values;
      const latest = series?.[series.length - 1]?.value;
      values[metric] = typeof latest === 'number' ? latest : null;
    } catch {
      values[metric] = null;
    }
  }

  return {
    pageName: (profile.name as string) ?? null,
    totalFollowers: (profile.followers_count as number) ?? (profile.fan_count as number) ?? null,
    engagedUsers28d: values.page_engaged_users,
    postEngagements28d: values.page_post_engagements,
    impressions28d: values.page_impressions,
    newFans28d: values.page_fan_adds,
  };
}
