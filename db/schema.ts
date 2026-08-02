import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const collaboratorDashboards = sqliteTable("collaborator_dashboards", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  manager: text("manager").notNull().default(""),
  role: text("role").notNull().default("Colaborador"),
  generatedAt: text("generated_at").notNull(),
  referenceDate: text("reference_date").notNull(),
  payloadJson: text("payload_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflow: text("workflow").notNull(),
  generatedAt: text("generated_at").notNull(),
  collaboratorCount: integer("collaborator_count").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pointGoals = sqliteTable("point_goals", {
  id: text("id").primaryKey(),
  weightsJson: text("weights_json").notNull(),
  targetsJson: text("targets_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
