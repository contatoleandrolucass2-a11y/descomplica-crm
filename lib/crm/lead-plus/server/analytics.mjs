const DAY = 86400000;
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const hourFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "numeric",
  hourCycle: "h23",
});
const dateKey = (value) => dateFormatter.format(new Date(value));
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
function analyticsCohorts(leads, users, filters) {
  const end = Date.parse(filters.to + "T23:59:59.999-03:00");
  const start = Date.parse(filters.from + "T00:00:00-03:00");
  const duration = end - start + 1;
  const people = new Map(users.map((user) => [user.id, user]));
  const fits = (lead) =>
    (!filters.team || people.get(lead.owner_id)?.team === filters.team) &&
    (!filters.owner || lead.owner_id === filters.owner) &&
    (!filters.source || lead.source === filters.source) &&
    (!filters.negotiation || lead.negotiation_type === filters.negotiation) &&
    (!filters.queue || lead.attribution?.queue_id === filters.queue);
  const current = leads.filter(
    (lead) =>
      fits(lead) && Date.parse(lead.created_at) >= start && Date.parse(lead.created_at) <= end,
  );
  const previous = leads.filter(
    (lead) =>
      fits(lead) &&
      Date.parse(lead.created_at) >= start - duration &&
      Date.parse(lead.created_at) < start,
  );
  return { start, end, duration, people, current, previous };
}

/** Keep all earlier state for the relevant cohorts, not history for unrelated leads. */
export function analyticsHistoryScope({ leads, users, filters }) {
  const { current, previous } = analyticsCohorts(leads, users, filters);
  return {
    ids: [...current, ...previous].map((lead) => lead.id),
    eventIds: current.map((lead) => lead.id),
  };
}

export function operationAnalytics({
  leads,
  users,
  activities,
  events,
  bucketIds,
  filters,
  now = Date.now(),
}) {
  const { start, end, duration, people, current, previous } = analyticsCohorts(
    leads,
    users,
    filters,
  );
  const response = new Map();
  for (const activity of activities) {
    if (!["call", "whatsapp", "visit"].includes(activity.type)) continue;
    const at = +new Date(activity.created_at);
    if (at <= now && (!response.has(activity.lead_id) || response.get(activity.lead_id) > at))
      response.set(activity.lead_id, at);
  }
  const createdDays = new Map(current.map((lead) => [lead.id, dateKey(lead.created_at)]));
  const createdHours = new Map(
    current.map((lead) => [lead.id, hourFormatter.format(new Date(lead.created_at))]),
  );
  const responseMinutes = (lead) =>
    response.has(lead.id)
      ? Math.max(0, (response.get(lead.id) - Date.parse(lead.created_at)) / 60000)
      : null;
  const sameDay = (lead) =>
    response.has(lead.id) && dateKey(response.get(lead.id)) === dateKey(lead.created_at);
  const metricsFor = (rows) => {
    const times = rows.map(responseMinutes).filter((value) => value !== null);
    return {
      received: rows.length,
      firstResponse: median(times),
      meanResponse: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      sameDay: rows.length ? (rows.filter(sameDay).length / rows.length) * 100 : 0,
      closed: rows.filter((lead) => lead.stage === 5 && !lead.archived).length,
    };
  };
  const timeline = [];
  for (let day = start; day <= end; day += DAY) {
    const key = dateKey(day),
      rows = current.filter((lead) => createdDays.get(lead.id) === key);
    timeline.push({
      date: key,
      label: new Date(day).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        timeZone: "America/Sao_Paulo",
      }),
      received: rows.length,
      interacted: rows.filter((lead) => response.has(lead.id)).length,
    });
  }
  const team = [...new Set(current.map((lead) => lead.owner_id).filter(Boolean))]
    .map((id) => {
      const rows = current.filter((lead) => lead.owner_id === id);
      return {
        id,
        name: people.get(id)?.name || rows[0].owner,
        team: people.get(id)?.team || "",
        received: rows.length,
        unanswered: rows.filter((lead) => !lead.archived && !response.has(lead.id)).length,
        firstResponse: median(rows.map(responseMinutes).filter((value) => value !== null)),
        bucket: rows.filter((lead) => bucketIds.has(lead.id)).length,
      };
    })
    .sort((a, b) => b.received - a.received);
  const visited = new Map(current.map((lead) => [lead.id, new Set([0, lead.stage])]));
  const entryTimes = new Map(
    current.map((lead) => [lead.id, { stage: 0, at: Date.parse(lead.created_at) }]),
  );
  const stageDurations = new Map(),
    archiveReasons = new Map();
  for (const event of [...events].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  )) {
    if (!visited.has(event.entity_id)) continue;
    const detail = event.detail || {},
      from = detail.from,
      to = detail.to;
    if (Number.isInteger(to) && to >= 0 && to <= 5) {
      visited.get(event.entity_id).add(to);
      const entry = entryTimes.get(event.entity_id);
      if (to !== from) {
        const elapsed = (+new Date(event.created_at) - entry.at) / 60000;
        if (entry.stage === from && elapsed >= 0) {
          const key = from + ":" + to;
          if (!stageDurations.has(key)) stageDurations.set(key, []);
          stageDurations.get(key).push(elapsed);
        }
        entryTimes.set(event.entity_id, { stage: to, at: +new Date(event.created_at) });
      }
    }
    if (detail.archive_reason) archiveReasons.set(event.entity_id, detail.archive_reason);
  }
  const group = (key) =>
    [...new Set(current.map(key))]
      .map((name) => ({ name, count: current.filter((lead) => key(lead) === name).length }))
      .sort((a, b) => b.count - a.count);
  const archived = current.filter((lead) => lead.archived);
  const reasons = [
    ...new Set(archived.map((lead) => archiveReasons.get(lead.id) || "Não informado")),
  ]
    .map((name) => ({
      name,
      count: archived.filter((lead) => (archiveReasons.get(lead.id) || "Não informado") === name)
        .length,
    }))
    .sort((a, b) => b.count - a.count);
  return {
    generatedAt: new Date(now).toISOString(),
    filters,
    previousPeriod: { from: dateKey(start - duration), to: dateKey(start - 1) },
    metrics: metricsFor(current),
    previous: metricsFor(previous),
    timeline,
    team,
    funnel: Array.from({ length: 6 }, (_, stage) => ({
      stage,
      count: [...visited.values()].filter((set) => set.has(stage)).length,
    })),
    currentStages: Array.from({ length: 6 }, (_, stage) => ({
      stage,
      count: current.filter((lead) => !lead.archived && lead.stage === stage).length,
    })),
    transitions: [...stageDurations].map(([key, values]) => ({
      from: Number(key.split(":")[0]),
      to: Number(key.split(":")[1]),
      minutes: median(values),
      count: values.length,
    })),
    reasons,
    sources: group((lead) => lead.source),
    products: group((lead) => lead.product || "Não informado"),
    negotiations: group((lead) => lead.negotiation_type || "Indefinido"),
    hours: Array.from({ length: 24 }, (_, hour) => ({
      name: String(hour).padStart(2, "0") + "h",
      count: current.filter((lead) => Number(createdHours.get(lead.id)) === hour).length,
    })),
    needsAttention: {
      overdue: current.filter(
        (lead) =>
          !lead.archived && !response.has(lead.id) && now - Date.parse(lead.created_at) > DAY,
      ).length,
      bucket: current.filter((lead) => bucketIds.has(lead.id)).length,
    },
    records: current.map((lead) => ({
      id: lead.id,
      name: lead.name,
      owner: lead.owner,
      owner_id: lead.owner_id,
      source: lead.source,
      product: lead.product,
      stage: lead.stage,
      archived: lead.archived,
      unanswered: !response.has(lead.id),
      sameDay: sameDay(lead),
      bucket: bucketIds.has(lead.id),
      overdue: !lead.archived && !response.has(lead.id) && now - Date.parse(lead.created_at) > DAY,
      hour: createdHours.get(lead.id) + "h",
    })),
    options: {
      teams: [...new Set(users.map((user) => user.team).filter(Boolean))].sort(),
      users: users.map((user) => ({ id: user.id, name: user.name, team: user.team })),
      sources: [...new Set(leads.map((lead) => lead.source))].sort(),
      queues: [...new Set(leads.map((lead) => lead.attribution?.queue_id).filter(Boolean))].sort(),
    },
  };
}
