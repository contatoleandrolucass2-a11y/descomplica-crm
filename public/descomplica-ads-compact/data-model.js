/* Pure aggregation of the official daily rows. Missing observations stay null. */
const AdsData = (() => {
  const palette = [
    "#3979dc",
    "#199c89",
    "#8c65d5",
    "#d49a29",
    "#da5571",
    "#258ca3",
    "#b16b36",
    "#648e44",
  ];
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const ratio = (a, b, m = 1) => (a != null && b > 0 ? (a / b) * m : null);
  let campaignColors = {};
  function registerCampaigns(ids, stored = {}) {
    campaignColors = Object.fromEntries(
      Object.entries(stored).filter(
        ([id, index]) => /^\d+$/.test(id) && Number.isInteger(index) && index >= 0 && index < 10000,
      ),
    );
    let next = Math.max(-1, ...Object.values(campaignColors)) + 1;
    for (const id of [...new Set(ids)].sort())
      if (campaignColors[id] === undefined) campaignColors[id] = next++;
    return { ...campaignColors };
  }
  const color = (id) => {
    const index =
      campaignColors[id] ??
      [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % palette.length;
    if (index < palette.length) return palette[index];
    const angle = (index * 137.508 * Math.PI) / 180;
    return (
      "#" +
      [0, 2, 4]
        .map((offset) =>
          Math.round(130 + 80 * Math.cos(angle + (offset * Math.PI) / 3))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  };
  const shift = (date, days) => {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const days = (start, end) => Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  function filter(rows, state, range) {
    return rows.filter(
      (r) =>
        r.date >= range.start &&
        r.date <= range.end &&
        (state.account === "all" || r.accountId === state.account) &&
        (state.status === "all" || r.status === state.status) &&
        r.destination === state.destination,
    );
  }
  function aggregate(rows) {
    const sum = (key) => rows.reduce((n, r) => n + (Number.isFinite(r[key]) ? r[key] : 0), 0);
    const nullable = (key) =>
      rows.length && rows.every((r) => Number.isFinite(r[key])) ? sum(key) : null;
    const spend = sum("spend"),
      leads = sum("conversions"),
      clicks = sum("clicks"),
      impressions = sum("impressions");
    const opens = nullable(rows[0]?.destination === "site" ? "sessions" : "formOpens");
    return {
      spend,
      leads,
      clicks,
      impressions,
      opens,
      qualified: nullable("qualifiedLeads"),
      cpl: ratio(spend, leads),
      ctr: ratio(clicks, impressions, 100),
      cpc: ratio(spend, clicks),
      cpm: ratio(spend, impressions, 1000),
      geo: [null, null, null, null, null],
      rows,
    };
  }
  function groups(rows, level = "campaign") {
    const groups = new Map();
    for (const row of rows) {
      const id = row[level + "Id"];
      if (!id) continue;
      if (!groups.has(id))
        groups.set(id, {
          id,
          level,
          label: row[level] || id,
          name: escape(row[level] || id),
          color: color(row.campaignId),
          campaignId: row.campaignId,
          adsetId: row.adsetId,
          rows: [],
        });
      groups.get(id).rows.push(row);
    }
    return [...groups.values()];
  }
  function selectEntity(rows, entity) {
    return rows.filter((r) => r[(entity.level || "campaign") + "Id"] === entity.id);
  }
  function daily(rows, entity, range, cost = false) {
    const selected = selectEntity(rows, entity),
      totals = new Map();
    for (const row of selected) {
      if (!totals.has(row.date)) totals.set(row.date, []);
      totals.get(row.date).push(row);
    }
    return Array.from({ length: days(range.start, range.end) }, (_, i) => {
      const a = aggregate(totals.get(shift(range.start, i)) || []);
      return cost ? a.cpl : a.leads;
    });
  }
  return {
    registerCampaigns,
    escape,
    ratio,
    color,
    shift,
    days,
    filter,
    aggregate,
    groups,
    selectEntity,
    daily,
  };
})();
