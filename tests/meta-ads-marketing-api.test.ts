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
            { id: "77", effective_status: "ACTIVE" },
            { id: "88", effective_status: "ADSET_PAUSED" },
          ],
        }),
      )
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
    for (const call of fetcher.mock.calls) {
      const options = call[1] as RequestInit;
      expect(String(call[0])).not.toContain(configuration.accessToken);
      expect(new Headers(options.headers).get("authorization")).toBe(
        `Bearer ${configuration.accessToken}`,
      );
    }
    expect(JSON.stringify(result)).not.toContain(configuration.accessToken);
    const adsUrl = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(adsUrl.searchParams.has("effective_status")).toBe(false);
    expect(JSON.parse(adsUrl.searchParams.get("filtering")!)).toContainEqual({
      field: "effective_status",
      operator: "IN",
      value: expect.arrayContaining(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"]),
    });
  });

  it("keeps deleted ads identifiable while preserving their historical insights", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: [{ id: "99", effective_status: "DELETED" }] }))
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
      );

    const result = await fetchMetaAdsDashboardData(configuration, {
      fetcher,
      bypassCache: true,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        campaign: "Campanha nova Leandro",
        ad: "Anuncio Leandro",
        status: "deleted",
        spend: 71.83,
        conversions: 38,
      }),
    ]);
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
