import { describe, expect, it, vi } from "vitest";

import { getMetaAdsApiConfiguration } from "@/lib/crm/meta-ads/config";
import {
  fetchMetaAdsDashboardData,
  MetaAdsApiError,
  probeMetaAdsApi,
} from "@/lib/crm/meta-ads/marketing-api";

const configuration = {
  enabled: true as const,
  available: true as const,
  accessToken: "t".repeat(80),
  accountId: "1080988750909489",
  apiVersion: "v26.0",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Meta Marketing API read-only client", () => {
  it("uses the São Paulo calendar day for the default API range", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(
        json({
          id: `act_${configuration.accountId}`,
          name: "Conta",
          currency: "BRL",
        }),
      );

    await fetchMetaAdsDashboardData(configuration, {
      fetcher,
      now: new Date("2026-10-27T01:30:00Z"),
      bypassCache: true,
    });

    const insightsUrl = new URL(String(fetcher.mock.calls[2]?.[0]));
    expect(JSON.parse(insightsUrl.searchParams.get("time_range")!)).toEqual({
      since: "2026-06-29",
      until: "2026-10-26",
    });
  });

  it("fails closed on incomplete or malformed secret configuration", () => {
    expect(getMetaAdsApiConfiguration({})).toEqual({ enabled: false, available: false });
    expect(getMetaAdsApiConfiguration({ META_ADS_API_ENABLED: "true" })).toEqual({
      enabled: true,
      available: false,
    });
    expect(
      getMetaAdsApiConfiguration({
        META_ADS_API_ENABLED: "true",
        META_ADS_ACCESS_TOKEN: "x".repeat(80),
        META_ADS_ACCOUNT_ID: configuration.accountId,
      }),
    ).toEqual({ ...configuration, accessToken: "x".repeat(80) });
  });

  it("maps daily ad insights without exposing the token or duplicating spend", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          data: [
            {
              id: "77",
              effective_status: "ACTIVE",
              adset: {
                id: "22",
                targeting: {
                  geo_locations: {
                    cities: [
                      {
                        key: "2441677",
                        name: "São Paulo",
                        region: "São Paulo",
                        country_name: "Brasil",
                      },
                    ],
                    regions: [{ key: "454", name: "São Paulo" }],
                  },
                },
              },
            },
            { id: "88", effective_status: "ADSET_PAUSED" },
          ],
        }),
      )
      .mockResolvedValueOnce(json({ data: [{ id: "11", effective_status: "ACTIVE" }] }))
      .mockResolvedValueOnce(
        json({
          data: [
            {
              date_start: "2026-10-20",
              account_id: configuration.accountId,
              account_name: "Superitendente Leandro",
              campaign_id: "11",
              campaign_name: "Residencial Aurora | WhatsApp",
              adset_id: "22",
              adset_name: "Público aberto",
              ad_id: "77",
              ad_name: "Vídeo 01",
              spend: "100.25",
              impressions: "2500",
              reach: "1800",
              actions: [
                { action_type: "link_click", value: "42" },
                {
                  action_type: "onsite_conversion.messaging_conversation_started_7d",
                  value: "8",
                },
              ],
            },
            {
              date_start: "2026-10-19",
              account_id: configuration.accountId,
              account_name: "Superitendente Leandro",
              campaign_id: "11",
              campaign_name: "Residencial Aurora | WhatsApp",
              adset_id: "22",
              adset_name: "Público aberto",
              ad_id: "77",
              ad_name: "Vídeo 01",
              spend: "10",
              impressions: "200",
              reach: "150",
              actions: [{ action_type: "link_click", value: "2" }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: [
            {
              date_start: "2026-10-20",
              account_id: configuration.accountId,
              campaign_id: "11",
              adset_id: "22",
              ad_id: "77",
              region: "São Paulo",
              actions: [
                {
                  action_type: "onsite_conversion.messaging_conversation_started_7d",
                  value: "8",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          id: `act_${configuration.accountId}`,
          name: "Superitendente Leandro",
          currency: "BRL",
          balance: "12345",
          amount_spent: "987654",
          spend_cap: "2500000",
        }),
      );
    const result = await fetchMetaAdsDashboardData(configuration, {
      fetcher,
      now: new Date("2026-10-21T12:00:00Z"),
      bypassCache: true,
    });
    expect(result).toMatchObject({
      source: "meta_marketing_api",
      accountId: configuration.accountId,
      accountName: "Superitendente Leandro",
      currency: "BRL",
      accountBalance: 123.45,
      amountSpent: 9876.54,
      spendCap: 25000,
      range: { start: "2026-06-24", end: "2026-10-21" },
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        destination: "whatsapp",
        event: "conversation",
        status: "active",
        spend: 100.25,
        conversions: 8,
        clicks: 42,
        impressions: 2500,
        reach: 1800,
        waClicks: 42,
        messageClicks: 8,
        targetLocations: expect.arrayContaining([
          expect.objectContaining({ type: "city", name: "São Paulo" }),
          expect.objectContaining({ type: "region", name: "São Paulo" }),
        ]),
      }),
      expect.objectContaining({
        date: "2026-10-19",
        destination: "whatsapp",
        conversions: 0,
        spend: 10,
        waClicks: 2,
        messageClicks: 0,
      }),
    ]);
    expect(result.regionalResults).toEqual([
      expect.objectContaining({
        region: "São Paulo",
        campaignId: "11",
        destination: "whatsapp",
        conversions: 8,
      }),
    ]);
    for (const call of fetcher.mock.calls) {
      const options = call[1] as RequestInit;
      expect(String(call[0])).not.toContain(configuration.accessToken);
      expect(new Headers(options.headers).get("authorization")).toBe(
        `Bearer ${configuration.accessToken}`,
      );
    }
    expect(JSON.stringify(result)).not.toContain(configuration.accessToken);
    const adsUrl = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(adsUrl.searchParams.get("fields")).toContain("adset{id,targeting}");
    expect(adsUrl.searchParams.has("effective_status")).toBe(false);
    expect(JSON.parse(adsUrl.searchParams.get("filtering")!)).toContainEqual({
      field: "effective_status",
      operator: "IN",
      value: expect.arrayContaining(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"]),
    });
    const campaignUrl = new URL(String(fetcher.mock.calls[1]?.[0]));
    expect(campaignUrl.pathname).toContain(`/act_${configuration.accountId}/campaigns`);
    expect(campaignUrl.searchParams.get("fields")).toBe("id,effective_status");
    expect(JSON.parse(campaignUrl.searchParams.get("filtering")!)).toContainEqual({
      field: "effective_status",
      operator: "IN",
      value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"],
    });
    const regionalUrl = new URL(String(fetcher.mock.calls[3]?.[0]));
    expect(regionalUrl.searchParams.get("breakdowns")).toBe("region");
    const accountUrl = new URL(String(fetcher.mock.calls[4]?.[0]));
    expect(accountUrl.pathname).toContain(`/act_${configuration.accountId}`);
    expect(accountUrl.searchParams.get("fields")).toContain("balance");
  });

  it("keeps a Meta-archived campaign identifiable while preserving its historical insights", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: [{ id: "99", effective_status: "ARCHIVED" }] }))
      .mockResolvedValueOnce(json({ data: [{ id: "11", effective_status: "ARCHIVED" }] }))
      .mockResolvedValueOnce(
        json({
          data: [
            {
              date_start: "2026-10-08",
              account_id: configuration.accountId,
              account_name: "Superitendente Leandro",
              campaign_id: "11",
              campaign_name: "Campanha nova Leandro",
              adset_id: "22",
              adset_name: "campanha nova Leandro",
              ad_id: "99",
              ad_name: "Anuncio Leandro",
              spend: "71.83",
              impressions: "1659",
              actions: [
                { action_type: "link_click", value: "189" },
                {
                  action_type: "onsite_conversion.messaging_conversation_started_7d",
                  value: "38",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: [],
        }),
      )
      .mockResolvedValueOnce(
        json({
          id: `act_${configuration.accountId}`,
          name: "Superitendente Leandro",
          currency: "BRL",
        }),
      );

    const result = await fetchMetaAdsDashboardData(configuration, {
      fetcher,
      bypassCache: true,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        campaign: "Campanha nova Leandro",
        ad: "Anuncio Leandro",
        status: "archived",
        spend: 71.83,
        conversions: 38,
      }),
    ]);
  });

  it("keeps historical spend from archived ads inside an active campaign", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          data: [
            { id: "77", effective_status: "ACTIVE" },
            { id: "88", effective_status: "ARCHIVED" },
          ],
        }),
      )
      .mockResolvedValueOnce(json({ data: [{ id: "11", effective_status: "ACTIVE" }] }))
      .mockResolvedValueOnce(
        json({
          data: [
            {
              date_start: "2026-10-27",
              account_id: configuration.accountId,
              account_name: "Conta",
              campaign_id: "11",
              campaign_name: "Campanha ativa",
              adset_id: "22",
              adset_name: "Conjunto ativo",
              ad_id: "77",
              ad_name: "Anúncio ativo",
              spend: "51.79",
              impressions: "1000",
              actions: [],
            },
            {
              date_start: "2026-10-20",
              account_id: configuration.accountId,
              account_name: "Conta",
              campaign_id: "11",
              campaign_name: "Campanha ativa",
              adset_id: "33",
              adset_name: "Conjunto anterior",
              ad_id: "88",
              ad_name: "Anúncio arquivado",
              spend: "98.21",
              impressions: "2000",
              actions: [],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(
        json({ id: `act_${configuration.accountId}`, name: "Conta", currency: "BRL" }),
      );

    const result = await fetchMetaAdsDashboardData(configuration, {
      fetcher,
      bypassCache: true,
      range: { start: "2026-10-01", end: "2026-10-27" },
    });

    expect(result.rows.map((row) => row.status)).toEqual(["active", "active"]);
    expect(result.rows.reduce((total, row) => total + row.spend, 0)).toBe(150);
  });

  it("does not add equivalent Meta lead action aliases", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: [{ id: "77", effective_status: "ACTIVE" }] }))
      .mockResolvedValueOnce(json({ data: [{ id: "11", effective_status: "ACTIVE" }] }))
      .mockResolvedValueOnce(
        json({
          data: [
            {
              date_start: "2026-10-26",
              account_id: configuration.accountId,
              account_name: "Conta",
              campaign_id: "11",
              campaign_name: "SACOMÃ / LIVIERO PUBLICO FECHADO",
              adset_id: "22",
              adset_name: "Público",
              ad_id: "77",
              ad_name: "Anúncio",
              spend: "20",
              impressions: "1000",
              actions: [
                { action_type: "lead", value: "5" },
                { action_type: "onsite_conversion.lead_grouped", value: "5" },
                { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(
        json({ id: `act_${configuration.accountId}`, name: "Conta", currency: "BRL" }),
      );

    const result = await fetchMetaAdsDashboardData(configuration, {
      fetcher,
      bypassCache: true,
      range: { start: "2026-10-26", end: "2026-10-26" },
    });

    expect(result.rows[0]).toMatchObject({ destination: "form", conversions: 5 });
  });

  it("refreshes the shared snapshot within ten seconds and deduplicates concurrent users", async () => {
    const liveConfiguration = { ...configuration, apiVersion: "v26.10" };
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      await Promise.resolve();
      const url = new URL(String(input));
      if (url.pathname.endsWith(`/act_${liveConfiguration.accountId}`)) {
        return json({
          id: `act_${liveConfiguration.accountId}`,
          name: "Conta ao vivo",
          currency: "BRL",
        });
      }
      return json({ data: [] });
    });
    const range = { start: "2026-10-28", end: "2026-10-28" };
    const firstNow = new Date("2026-10-28T12:00:00.000Z");

    const [first, concurrent] = await Promise.all([
      fetchMetaAdsDashboardData(liveConfiguration, { fetcher, now: firstNow, range }),
      fetchMetaAdsDashboardData(liveConfiguration, { fetcher, now: firstNow, range }),
    ]);

    expect(concurrent).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(5);

    const cached = await fetchMetaAdsDashboardData(liveConfiguration, {
      fetcher,
      now: new Date("2026-10-28T12:00:07.999Z"),
      range,
    });
    expect(cached).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(5);

    const refreshed = await fetchMetaAdsDashboardData(liveConfiguration, {
      fetcher,
      now: new Date("2026-10-28T12:00:08.000Z"),
      range,
    });
    expect(refreshed).not.toBe(first);
    expect(refreshed.fetchedAt).toBe("2026-10-28T12:00:08.000Z");
    expect(fetcher).toHaveBeenCalledTimes(10);
  });

  it("rejects untrusted pagination and classifies expired tokens", async () => {
    const untrusted = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ data: [], paging: { next: "https://evil.example/steal" } }));
    await expect(
      fetchMetaAdsDashboardData(configuration, { fetcher: untrusted, bypassCache: true }),
    ).rejects.toMatchObject({ code: "invalid_data" });

    const expired = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ error: { code: 190, message: "private token detail" } }, 400));
    await expect(
      fetchMetaAdsDashboardData(configuration, { fetcher: expired, bypassCache: true }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MetaAdsApiError>>({ code: "authentication" }),
    );
  });

  it("distinguishes an empty period from malformed upstream rows", async () => {
    const empty = vi.fn<typeof fetch>().mockImplementation(async () => json({ data: [] }));
    await expect(
      fetchMetaAdsDashboardData(configuration, { fetcher: empty, bypassCache: true }),
    ).resolves.toMatchObject({ rows: [] });
    const invalid = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [{ date_start: "invalid" }] }));
    await expect(
      fetchMetaAdsDashboardData(configuration, { fetcher: invalid, bypassCache: true }),
    ).rejects.toMatchObject({ code: "invalid_data", status: 502 });
  });

  it("probes only the configured account", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        id: `act_${configuration.accountId}`,
        name: "Superitendente Leandro",
        currency: "BRL",
        account_status: 1,
      }),
    );
    await expect(probeMetaAdsApi(configuration, fetcher)).resolves.toEqual({
      accountName: "Superitendente Leandro",
      currency: "BRL",
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(`/v26.0/act_${configuration.accountId}`);
  });
});
