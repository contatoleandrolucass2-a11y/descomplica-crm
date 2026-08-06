import { createHash } from "node:crypto";

const VIEW_KEYS = ["all", "with_canal_imob", "without_canal_imob"];
const STAGE_KEYS = ["opportunities", "appointments", "visits", "folders", "sales"];
const PERIOD_KEYS = ["month", "last_week", "week", "today"];
const ACTIVE_BROKER_STATUSES = new Set(["ativo", "reativado"]);
const APPROVED_FOLDER_STATUS = "analise aprovada";

function text(value) {
  return String(value ?? "").trim();
}

function fold(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return localDate(raw);

  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const [, day, month, year, hour = "00", minute = "00", second = "00"] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function saoPauloDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateKey(value) {
  const parts = saoPauloDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localDate(value) {
  return new Date(`${value}T12:00:00-03:00`);
}

function addDays(value, days) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function startOfWeek(value) {
  const weekday = saoPauloDateParts(value).weekday;
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return addDays(localDate(dateKey(value)), -Math.max(index, 0));
}

function endOfWeek(value) {
  return addDays(startOfWeek(value), 6);
}

function startOfMonth(value) {
  const parts = saoPauloDateParts(value);
  return localDate(`${parts.year}-${parts.month}-01`);
}

function endOfMonth(value) {
  const start = startOfMonth(value);
  return addDays(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 15)), -1);
}

function inRange(value, start, end) {
  if (!value) return false;
  const key = dateKey(value);
  return key >= dateKey(start) && key <= dateKey(end);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function periodStats(records, referenceDate) {
  const reference = localDate(referenceDate);
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  const weekStart = startOfWeek(reference);
  const weekEnd = endOfWeek(reference);
  const yesterday = addDays(reference, -1);
  const previousWeekEnd = addDays(weekStart, -1);
  const previousWeekStart = addDays(previousWeekEnd, -6);
  const lastSevenStart = addDays(reference, -6);
  const previousSevenStart = addDays(reference, -13);
  const previousSevenEnd = addDays(reference, -7);
  const lastFourteenStart = addDays(reference, -13);
  const previousFourteenStart = addDays(reference, -27);
  const previousFourteenEnd = addDays(reference, -14);
  const previousMonthEnd = addDays(monthStart, -1);
  const previousMonthStart = startOfMonth(previousMonthEnd);
  const cutoffDay = Number(saoPauloDateParts(reference).day);
  const previousMonthCutoff = localDate(
    `${saoPauloDateParts(previousMonthEnd).year}-${saoPauloDateParts(previousMonthEnd).month}-${String(
      Math.min(cutoffDay, Number(saoPauloDateParts(previousMonthEnd).day)),
    ).padStart(2, "0")}`,
  );

  const count = (start, end) => records.filter((record) => inRange(record.date, start, end)).length;
  const closedMonthCounts = [];
  for (let month = 1; month < Number(saoPauloDateParts(reference).month); month += 1) {
    const year = saoPauloDateParts(reference).year;
    const start = localDate(`${year}-${String(month).padStart(2, "0")}-01`);
    closedMonthCounts.push(count(start, endOfMonth(start)));
  }

  return {
    currentMonth: count(monthStart, monthEnd),
    currentWeek: count(weekStart, weekEnd),
    currentToday: count(reference, reference),
    previousMonth: count(previousMonthStart, previousMonthCutoff),
    yearClosedMonthsAverage: average(closedMonthCounts),
    lastThreeClosedMonthsAverage: average(closedMonthCounts.slice(-3)),
    previousFourteenDays: count(previousFourteenStart, previousFourteenEnd),
    lastFourteenDays: count(lastFourteenStart, reference),
    previousSevenDays: count(previousSevenStart, previousSevenEnd),
    lastSevenDays: count(lastSevenStart, reference),
    previousWeek: count(previousWeekStart, previousWeekEnd),
    yesterday: count(yesterday, yesterday),
  };
}

function sumForPeriod(records, referenceDate, getter) {
  const reference = localDate(referenceDate);
  const ranges = {
    month: [startOfMonth(reference), endOfMonth(reference)],
    week: [startOfWeek(reference), endOfWeek(reference)],
    today: [reference, reference],
  };
  return Object.fromEntries(
    Object.entries(ranges).map(([key, [start, end]]) => [
      key,
      records
        .filter((record) => inRange(record.date, start, end))
        .reduce((sum, record) => sum + Math.max(0, Number(getter(record)) || 0), 0),
    ]),
  );
}

function dedupe(records, keyFor) {
  const unique = new Map();
  let duplicates = 0;
  for (const record of records) {
    const key = text(keyFor(record));
    if (!key) continue;
    if (unique.has(key)) {
      duplicates += 1;
      continue;
    }
    unique.set(key, record);
  }
  return { records: [...unique.values()], duplicates };
}

function hashKey(namespace, value) {
  return `${namespace}-${createHash("sha256").update(text(value)).digest("hex").slice(0, 32)}`;
}

function hasCanalImob(record, imobAccounts) {
  const realEstate = fold(record.realEstateName);
  return realEstate.includes("canal imob") || (realEstate && imobAccounts.has(realEstate));
}

function byView(records, viewKey, imobAccounts) {
  if (viewKey === "all") return records;
  if (viewKey === "with_canal_imob") {
    return records.filter((record) => hasCanalImob(record, imobAccounts));
  }
  return records.filter((record) => !hasCanalImob(record, imobAccounts));
}

function emptyGoal() {
  return { month: 0, week: 0, today: 0 };
}

function goalFor(goals, viewKey, stageKey) {
  const goal = goals?.[viewKey]?.[stageKey];
  if (!goal) return emptyGoal();
  return {
    month: Math.max(0, Number(goal.month) || 0),
    week: Math.max(0, Number(goal.week) || 0),
    today: Math.max(0, Number(goal.today) || 0),
  };
}

function makeMetric(viewKey, stageKey, records, referenceDate, goals) {
  const stats = periodStats(records, referenceDate);
  const goal = goalFor(goals, viewKey, stageKey);
  return {
    viewKey,
    stageKey,
    ...stats,
    goalMonth: goal.month,
    goalWeek: goal.week,
    goalToday: goal.today,
  };
}

function topDevelopments(records, viewKey, imobAccounts) {
  const counts = new Map();
  for (const record of byView(records, viewKey, imobAccounts)) {
    const name = text(record.development);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))
    .slice(0, 5)
    .map(([name, total], index) => ({ viewKey, rank: index + 1, name, total }));
}

function rankingRange(periodKey, referenceDate) {
  const reference = localDate(referenceDate);
  if (periodKey === "month") return [startOfMonth(reference), endOfMonth(reference)];
  if (periodKey === "week") return [startOfWeek(reference), endOfWeek(reference)];
  if (periodKey === "today") return [reference, reference];
  const currentStart = startOfWeek(reference);
  const end = addDays(currentStart, -1);
  return [addDays(end, -6), end];
}

function latestManagers(reports) {
  const managers = new Map();
  const sources = [
    reports.opportunities ?? [],
    reports.appointments ?? [],
    reports.visits ?? [],
    reports.folders ?? [],
    reports.sales ?? [],
  ];
  for (const rows of sources) {
    for (const row of rows) {
      const broker = fold(row.brokerName);
      const manager = text(row.managerName);
      if (!broker || !manager) continue;
      const stamp = parseDate(row.date ?? row.createdAt ?? row.saleDate)?.getTime() ?? 0;
      const current = managers.get(broker);
      if (!current || stamp >= current.stamp) managers.set(broker, { manager, stamp });
    }
  }
  return managers;
}

function countBrokerActivity(records, brokerName, range, predicate = () => true) {
  const target = fold(brokerName);
  return records.filter(
    (record) =>
      fold(record.brokerName) === target &&
      predicate(record) &&
      inRange(record.date, range[0], range[1]),
  ).length;
}

function buildRanking(reports, referenceDate, generatedAt) {
  const activeBrokers = (reports.brokers ?? []).filter(
    (broker) =>
      text(broker.contactId) &&
      text(broker.name) &&
      ACTIVE_BROKER_STATUSES.has(fold(broker.status)),
  );
  const managers = latestManagers(reports);
  const participants = [];

  for (const broker of activeBrokers) {
    for (const periodKey of PERIOD_KEYS) {
      const range = rankingRange(periodKey, referenceDate);
      participants.push({
        periodKey,
        brokerKey: hashKey("sf-contact", broker.contactId),
        brokerName: text(broker.name),
        managerName: managers.get(fold(broker.name))?.manager ?? "Sem gerente informado",
        roulette: 0,
        rouletteSaturday: 0,
        rouletteSunday: 0,
        schedule: countBrokerActivity(reports.appointments ?? [], broker.name, range),
        visit: countBrokerActivity(reports.visits ?? [], broker.name, range),
        approvedFolder: countBrokerActivity(
          reports.folders ?? [],
          broker.name,
          range,
          (record) => fold(record.status) === APPROVED_FOLDER_STATUS,
        ),
        sale: countBrokerActivity(reports.sales ?? [], broker.name, range),
      });
    }
  }

  return {
    snapshotKey: "global",
    referenceDate,
    generatedAt,
    timezone: "America/Sao_Paulo",
    source: "Salesforce Analytics Reports API v61 via n8n",
    rouletteAvailable: false,
    participants,
  };
}

function normalizeReports(input) {
  const opportunities = dedupe(input.opportunities ?? [], (row) => row.recordId || row.name);
  const appointments = dedupe(input.appointments ?? [], (row) => row.appointmentCode);
  const visits = dedupe(input.visits ?? [], (row) => row.appointmentCode);
  const folders = dedupe(input.folders ?? [], (row) => row.recordId || row.creditName);
  const sales = dedupe(input.sales ?? [], (row) => row.opportunityRecordId || row.opportunityName);

  return {
    reports: {
      brokers: input.brokers ?? [],
      imobAccounts: input.imobAccounts ?? [],
      opportunities: opportunities.records.map((row) => ({
        ...row,
        date: parseDate(row.createdAt),
      })),
      appointments: appointments.records.map((row) => ({ ...row, date: parseDate(row.createdAt) })),
      visits: visits.records.map((row) => ({ ...row, date: parseDate(row.attendedAt) })),
      folders: folders.records.map((row) => ({ ...row, date: parseDate(row.createdAt) })),
      sales: sales.records.map((row) => ({ ...row, date: parseDate(row.saleDate) })),
    },
    duplicates: {
      opportunities: opportunities.duplicates,
      appointments: appointments.duplicates,
      visits: visits.duplicates,
      folders: folders.duplicates,
      sales: sales.duplicates,
    },
  };
}

function differenceCount(left, right, keyFor) {
  const rightKeys = new Set(right.map(keyFor).map(text).filter(Boolean));
  return left.filter((row) => {
    const key = text(keyFor(row));
    return key && !rightKeys.has(key);
  }).length;
}

export function buildSalesforceSnapshot({
  reports: rawReports,
  referenceDate,
  generatedAt,
  requestId,
  goals,
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error("invalid reference date");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(generatedAt)) throw new Error("invalid generated timestamp");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("invalid request id");

  const { reports, duplicates } = normalizeReports(rawReports);
  const imobAccounts = new Set(
    reports.imobAccounts.map((account) => fold(account.name)).filter(Boolean),
  );
  const stages = {
    opportunities: reports.opportunities,
    appointments: reports.appointments,
    visits: reports.visits,
    folders: reports.folders,
    sales: reports.sales,
  };
  const views = VIEW_KEYS.map((viewKey) => {
    const sales = byView(reports.sales, viewKey, imobAccounts);
    const values = sumForPeriod(sales, referenceDate, (record) => record.amount);
    return {
      viewKey,
      salesValueMonth: values.month,
      salesValueWeek: values.week,
      salesValueToday: values.today,
    };
  });
  const metrics = VIEW_KEYS.flatMap((viewKey) =>
    STAGE_KEYS.map((stageKey) =>
      makeMetric(
        viewKey,
        stageKey,
        byView(stages[stageKey], viewKey, imobAccounts),
        referenceDate,
        goals,
      ),
    ),
  );
  const top = VIEW_KEYS.flatMap((viewKey) =>
    topDevelopments(reports.opportunities, viewKey, imobAccounts),
  );
  const payload = {
    schemaVersion: 2,
    requestId,
    workflow: "salesforce_n8n_v1",
    dashboard: {
      snapshotKey: "global",
      referenceDate,
      generatedAt,
      timezone: "America/Sao_Paulo",
      source: "Salesforce Analytics Reports API v61 via n8n",
      goalsAvailable: Boolean(goals),
      views,
      metrics,
      topDevelopments: top,
    },
    ranking: buildRanking(reports, referenceDate, generatedAt),
  };

  const appointmentCodes = new Set(
    reports.appointments.map((row) => text(row.appointmentCode)).filter(Boolean),
  );
  const opportunityIds = new Set(
    reports.opportunities.map((row) => text(row.recordId)).filter(Boolean),
  );
  const opportunityNames = new Set(
    reports.opportunities.map((row) => fold(row.name)).filter(Boolean),
  );
  const activeBrokerKeys = new Set(
    payload.ranking.participants.map((participant) => participant.brokerKey),
  );
  const activeBrokerNames = new Set(
    payload.ranking.participants.map((participant) => fold(participant.brokerName)),
  );
  const activityBrokerNames = new Set(
    [
      ...reports.opportunities,
      ...reports.appointments,
      ...reports.visits,
      ...reports.folders,
      ...reports.sales,
    ]
      .map((row) => fold(row.brokerName))
      .filter(Boolean),
  );
  const diagnostics = {
    sourceRows: Object.fromEntries(
      Object.entries(reports).map(([key, rows]) => [key, rows.length]),
    ),
    duplicates,
    dataQuality: {
      visitsWithoutAppointment: reports.visits.filter(
        (row) => text(row.appointmentCode) && !appointmentCodes.has(text(row.appointmentCode)),
      ).length,
      foldersWithoutOpportunityById: reports.folders.filter(
        (row) =>
          text(row.opportunityRecordId) && !opportunityIds.has(text(row.opportunityRecordId)),
      ).length,
      foldersWithoutOpportunityByName: reports.folders.filter(
        (row) => fold(row.opportunityName) && !opportunityNames.has(fold(row.opportunityName)),
      ).length,
      salesWithoutOpportunityById: differenceCount(
        reports.sales,
        reports.opportunities,
        (row) => row.opportunityRecordId ?? row.recordId,
      ),
      salesWithoutOpportunityByName: reports.sales.filter(
        (row) => fold(row.opportunityName) && !opportunityNames.has(fold(row.opportunityName)),
      ).length,
      approvedFolders: reports.folders.filter((row) => fold(row.status) === APPROVED_FOLDER_STATUS)
        .length,
      activeBrokers: activeBrokerKeys.size,
      activeBrokersWithoutManager: new Set(
        payload.ranking.participants
          .filter((participant) => participant.managerName === "Sem gerente informado")
          .map((participant) => participant.brokerKey),
      ).size,
      activityBrokerNamesOutsideActiveBase: [...activityBrokerNames].filter(
        (name) => !activeBrokerNames.has(name),
      ).length,
    },
    goals: goals ? "provided" : "defaulted_to_zero",
    roulette: "source_unavailable_defaulted_to_zero",
  };

  return { payload, diagnostics };
}
