import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { PROTECTED_PAGE_GATES } from "@/lib/authorization/page-gates";
import { PAGE_REGISTRY } from "@/lib/navigation/registry";

// @ts-expect-error — SQL generation is tested without running the local QA harness.
import { fixtureSetupSql } from "../scripts/qa/local-authenticated-visual.mjs";

const repositoryRoot = process.cwd();
const administratorProtectionMigration =
  "20261011143218_protect_administrator_accounts_and_enable_simulator_view.sql";
const permissionAccessDraftMigration = "20261012113000_apply_user_permission_access_draft.sql";
const sharedRoutinesMigration = "20261013014310_crm_shared_routines.sql";
const routineCompletionsMigration = "20261014020437_crm_routine_completions.sql";
const dashboardAnalysisMigration = "20261015185150_dashboard_analysis_snapshots.sql";
const qlikRankingV2Migration = "20261014170549_crm_qlik_v2_standalone.sql";
const administratorMasterOnlyPermissions = [
  "crm.simulators.execute",
  "crm.commercial_engine.execute",
  "crm.commercial_policy.manage",
];
const markerNames = [
  "20260808235856_grant_imob_ranking_service_role.sql",
  "20260809004414_add_atomic_imob_ranking_publish_rpc.sql",
  "20260809010942_restrict_imob_ranking_rpc_roles.sql",
  "20260809031936_qlik_ranking_developments.sql",
  "20260813133534_emergency_qlik_public_read_hardening.sql",
  "20260813142723_restore_ranking_read_permissions.sql",
  "20260813142835_add_ranking_public_read_policies.sql",
  "20260813160418_partnerships_rbac_convergence.sql",
  "20260813161959_secure_ranking_snapshot_read_rpc.sql",
  "20260813172800_restrict_ranking_snapshot_rpc_contract.sql",
  "20260813192928_master_simulator_execution_gate.sql",
];

describe("release-candidate migration train", () => {
  it("keeps a unique, ordered 85-version manifest", async () => {
    const migrations = (await readdir(path.join(repositoryRoot, "supabase/migrations")))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(migrations).toHaveLength(85);
    expect(new Set(migrations.map((name) => name.slice(0, 14))).size).toBe(85);
    expect(migrations).toEqual([...migrations].sort());
    expect(migrations).toEqual(expect.arrayContaining(markerNames));
    expect(migrations).toContain(permissionAccessDraftMigration);
    expect(migrations).toContain(sharedRoutinesMigration);
    expect(migrations).toContain(routineCompletionsMigration);
    expect(migrations.slice(-31)).toEqual([
      "20261014204014_local_user_presence.sql",
      dashboardAnalysisMigration,
      "20261015195915_unified_page_catalog.sql",
      "20261015201949_master_all_permission_defaults.sql",
      "20261015202643_sync_page_catalog.sql",
      "20261015202644_routine_individual_page_access.sql",
      "20261016000120_individual_page_data_access.sql",
      "20261017003100_qlik_partnerships_reader_permission.sql",
      "20261017022411_crm_forecasts.sql",
      "20261017022450_sync_page_catalog.sql",
      "20261018142142_crm_forecast_groups.sql",
      "20261019004204_forecast_action_plan.sql",
      "20261019031700_appointments_analysis_stores.sql",
      "20261019031715_appointments_analysis_read.sql",
      "20261020050000_appointments_operations_v3.sql",
      "20261020122216_forecast_period_scopes.sql",
      "20261020130000_dashboard_imob_goals.sql",
      "20261020204500_forecast_broker_roster.sql",
      "20261020214500_forecast_broker_manager_accents.sql",
      "20261020233000_appointments_goal_read.sql",
      "20261020235022_sync_page_catalog.sql",
      "20261021011101_sync_page_catalog.sql",
      "20261021191533_coordinator_dashboard_v3_projection.sql",
      "20261021210000_appointments_filters_kpis_v4.sql",
      "20261022184500_forecast_value_edit_roles.sql",
      "20261024053147_sync_page_catalog.sql",
      "20261024055603_crm_leads_core.sql",
      "20261024061135_crm_lead_operations.sql",
      "20261024062318_sync_page_catalog.sql",
      "20261024223147_appointments_conversion_goals_read.sql",
      "20261024224500_crm_lead_foreign_key_indexes.sql",
    ]);
    expect(migrations).toContain(qlikRankingV2Migration);
    expect(migrations.at(-1)).toBe("20261024224500_crm_lead_foreign_key_indexes.sql");
  });

  it("validates the current pgTAP inventory with the restore preflight", async () => {
    const source = await readFile(
      path.join(repositoryRoot, "scripts/release/isolated-restore-rehearsal.mjs"),
      "utf8",
    );
    const tree = ts.createSourceFile("restore.mjs", source, ts.ScriptTarget.Latest);
    const declarations = tree.statements
      .filter((statement) =>
        ts.isFunctionDeclaration(statement)
          ? statement.name?.text === "readPgTapPlan"
          : ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(
              (declaration) =>
                ts.isIdentifier(declaration.name) && declaration.name.text === "expectedPgTapTests",
            ),
      )
      .map((statement) => statement.getText(tree))
      .join("\n");
    // Run only the read-only inventory preflight, never the restore entry point.
    const plan = await runInNewContext(
      `${declarations}\nreadPgTapPlan()`,
      {
        readFile,
        readdir,
        path,
        sourceSupabaseRoot: path.join(repositoryRoot, "supabase"),
      },
      { timeout: 1000 },
    );
    expect(plan.files).toBe(40);
    expect(plan.tests).toBe(2242);
  });

  it("keeps the compact page-data fixture aligned with the Imob dashboard policy", async () => {
    const [fixture, atomicFixture, atomicHarness, harness] = await Promise.all([
      readFile(
        path.join(repositoryRoot, "tests/fixtures/compact-user-access/page-data.test.sql"),
        "utf8",
      ),
      readFile(
        path.join(
          repositoryRoot,
          "tests/fixtures/compact-user-access/catalog-atomic-rehearsal.sql",
        ),
        "utf8",
      ),
      readFile(path.join(repositoryRoot, "scripts/qa/catalog-atomic-rehearsal.mjs"), "utf8"),
      readFile(path.join(repositoryRoot, "scripts/qa/compact-user-access.mjs"), "utf8"),
    ]);

    expect(fixture).toContain(
      "\\ir ../../../supabase/migrations/20261020130000_dashboard_imob_goals.sql",
    );
    expect(atomicFixture).toContain(
      "\\ir ../../../supabase/migrations/20261020130000_dashboard_imob_goals.sql",
    );
    expect(atomicHarness).toContain("verifyTap(output, [26, 29])");
    expect(harness).toContain("const expectedPlans = [116, 8, 14, 29];");
  });

  it("keeps Administrator protection compatible with compact and scoped schemas", async () => {
    const sql = await readFile(
      path.join(repositoryRoot, "supabase/migrations", administratorProtectionMigration),
      "utf8",
    );
    const preflight = sql.match(/do \$migration\$[\s\S]*?\$migration\$;/)?.[0] ?? "";

    expect(preflight).not.toContain("crm_user_reporting_scope_grants");
    expect(preflight).not.toContain("private.current_user_is_master");
    expect(sql).toContain("values ('admin', 'crm.simulators.view')");
    expect(sql).toContain("target_role_key <> 'admin'");
    expect(sql).toContain("actor_role.role_key = 'master'");
    expect(sql).toContain("column_entry.column_name = 'access_status'");
    expect(sql).toMatch(
      /if to_regclass\('public\.crm_user_reporting_scope_grants'\) is not null then/,
    );
    expect(sql).toContain("v_expected_trigger_count integer := 3 + case");

    const staleAllowCleanup =
      sql.match(
        /delete from public\.user_permission_overrides permission_override[\s\S]*?;/,
      )?.[0] ?? "";
    expect(staleAllowCleanup).toContain("target_role.role_key = 'admin'");
    expect(staleAllowCleanup).toContain("permission_override.effect = 'allow'");
    for (const permission of administratorMasterOnlyPermissions) {
      expect(staleAllowCleanup).toContain(`'${permission}'`);
    }

    for (const triggerName of [
      "administrator_account_boundary_roles",
      "administrator_account_boundary_profiles",
      "administrator_account_boundary_permission_overrides",
      "administrator_account_boundary_reporting_scopes",
    ]) {
      expect(sql).toContain(triggerName);
    }
  });

  it.each(markerNames)("keeps %s as a sanitized executable no-op", async (name) => {
    const sql = await readFile(path.join(repositoryRoot, "supabase/migrations", name), "utf8");
    const executable = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    expect(executable).toBe("do $historical_marker$ begin null; end $historical_marker$;");
  });
});

describe("release-candidate activation defaults", () => {
  it("grants inventory only to the newly created local visual fixture", () => {
    const fixture = {
      marker: "QA local synthetic inventory permissions",
      userId: "10000000-0000-4000-8000-000000000001",
    };
    const localSql = fixtureSetupSql(fixture);
    const reusedSql = fixtureSetupSql({ ...fixture, reuseExistingMaster: true });

    for (const permission of ["crm.inventory.riva.view", "crm.inventory.direcional.view"]) {
      expect(localSql).toContain(`('${fixture.userId}'::uuid, '${permission}', 'allow'`);
      expect(reusedSql).not.toContain(`('${fixture.userId}'::uuid, '${permission}', 'allow'`);
    }
    for (const sql of [localSql, reusedSql]) {
      expect(sql).not.toContain("insert into public.role_permissions");
      expect(sql).toContain("inventory brands must be inherited only by admin");
    }
  });

  it("converges the browser matrix with Gestão access and the released route inventory", async () => {
    const source = await readFile(
      path.join(repositoryRoot, "e2e/release-candidate.spec.ts"),
      "utf8",
    );
    const tree = ts.createSourceFile("release-candidate.spec.ts", source, ts.ScriptTarget.Latest);
    const declarationNames = new Set([
      "expectedRoles",
      "adminRoles",
      "activeOperationalRoles",
      "rankingRoles",
      "partnershipRoles",
      "repasseRoles",
      "metaAdsRoutes",
      "leadRoutes",
      "protectedSurfaces",
      "operationalRoutes",
      "connectedSystemsRoute",
      "settingsRoutes",
      "managementRoutes",
      "simulatorRoutes",
      "administrationRoutes",
      "administrationNavigationRoutes",
      "expectedDirectRoutesByRole",
      "expectedHeaderRoutesByRole",
      "allowedDirectRoutesForRole",
      "sortedRouteSet",
      "expectedAccountSettingsRoutesForRole",
      "expectedPrimaryNavigationRootsForRole",
    ]);
    // Evaluate only the pure matrix declarations, without loading browser setup or credentials.
    const declarations = tree.statements
      .filter((statement) =>
        ts.isFunctionDeclaration(statement)
          ? declarationNames.has(statement.name?.text ?? "")
          : ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(
              (declaration) =>
                ts.isIdentifier(declaration.name) && declarationNames.has(declaration.name.text),
            ),
      )
      .map((statement) => statement.getText(tree))
      .join("\n");
    const matrix = runInNewContext(
      ts.transpileModule(
        `${declarations}\n({ expectedRoles, protectedSurfaces, expectedDirectRoutesByRole, expectedHeaderRoutesByRole, allowedDirectRoutesForRole, expectedAccountSettingsRoutesForRole, expectedPrimaryNavigationRootsForRole })`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
      ).outputText,
      {},
      { timeout: 1000 },
    );
    const surfacePaths = matrix.protectedSurfaces.map((surface: { path: string }) => surface.path);
    expect(surfacePaths).toHaveLength(41);
    expect(new Set(surfacePaths).size).toBe(41);
    expect([...surfacePaths].sort()).toEqual(
      PROTECTED_PAGE_GATES.filter((gate) => gate.releaseEnabled)
        .map((gate) => gate.path)
        .sort(),
    );
    for (const role of matrix.expectedRoles) {
      const administrative = role === "master" || role === "admin";
      const operational = role !== "pending";
      for (const routes of [
        matrix.expectedDirectRoutesByRole[role],
        matrix.expectedHeaderRoutesByRole[role],
      ]) {
        expect(routes.includes("/app/gestao/previsao"), role).toBe(operational);
      }
      expect(matrix.expectedAccountSettingsRoutesForRole(role)).not.toContain(
        "/app/gestao/previsao",
      );
      expect(matrix.allowedDirectRoutesForRole(role), role).toEqual(
        matrix.expectedDirectRoutesByRole[role],
      );
      for (const route of ["/app/gestao", "/app/gestao/rotina"]) {
        expect(matrix.expectedDirectRoutesByRole[role].includes(route), `${role}: ${route}`).toBe(
          operational,
        );
        expect(matrix.expectedHeaderRoutesByRole[role].includes(route), `${role}: ${route}`).toBe(
          operational,
        );
        expect(matrix.expectedAccountSettingsRoutesForRole(role)).not.toContain(route);
      }
      const roots = matrix.expectedPrimaryNavigationRootsForRole(role);
      expect(
        matrix.expectedHeaderRoutesByRole[role].includes("/app/configuracoes/metas"),
        role,
      ).toBe(administrative);
      expect(roots.some((root: { name: string }) => root.name === "Configurações")).toBe(false);
      if (administrative) {
        expect(matrix.expectedHeaderRoutesByRole[role]).toHaveLength(30);
        expect(matrix.expectedHeaderRoutesByRole[role]).toContain("/app/configuracoes/metas");
        expect(roots.map((root: { name: string }) => root.name)).toEqual([
          "Dashboard",
          "Lead",
          "Meta Ads",
          "Simulação",
          "Ranking",
          "Canal de Parcerias",
          "Gestão",
          "Administração",
        ]);
        expect(roots[6]).toEqual({
          name: "Gestão",
          tag: "BUTTON",
          href: null,
          controls: "authorized-navigation-crm-management",
        });
      } else if (operational) {
        expect(matrix.expectedHeaderRoutesByRole[role]).toHaveLength(11);
        expect(matrix.expectedAccountSettingsRoutesForRole(role)).toEqual([]);
        expect(roots.map((root: { name: string }) => root.name)).toEqual([
          "Dashboard",
          "Simulação",
          role.endsWith("_house") ? "Ranking" : "Canal de Parcerias",
          "Gestão",
        ]);
        expect(roots[3]).toEqual({
          name: "Gestão",
          tag: "BUTTON",
          href: null,
          controls: "authorized-navigation-crm-management",
        });
      } else {
        expect(roots.some((root: { name: string }) => root.name === "Gestão")).toBe(false);
      }
    }
  });

  it("keeps REST catalog visibility aligned with the released catalog and default roles", async () => {
    const source = await readFile(
      path.join(repositoryRoot, "scripts/qa/local-rls-api.mjs"),
      "utf8",
    );
    const tree = ts.createSourceFile("local-rls-api.mjs", source, ts.ScriptTarget.Latest);
    const names = new Set([
      "pageKeysForPermissions",
      "simulatorPageKeys",
      "inheritedAnalyticalPageKeys",
      "rankingPageKeys",
      "partnershipPageKeys",
      "forecastPageKeys",
      "administrativeCommercialPageKeys",
      "masterAdministrativePageKeys",
      "expectedPageKeysByRole",
    ]);
    const declarations = tree.statements
      .filter((statement) =>
        ts.isFunctionDeclaration(statement)
          ? names.has(statement.name?.text ?? "")
          : ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(
              (declaration) =>
                ts.isIdentifier(declaration.name) && names.has(declaration.name.text),
            ),
      )
      .map((statement) => statement.getText(tree))
      .join("\n");
    const matrix = runInNewContext(
      `${declarations}\nexpectedPageKeysByRole`,
      { PAGE_REGISTRY },
      { timeout: 1000 },
    );
    const operational = [
      "master",
      "admin",
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
    ];
    for (const role of [...operational, "pending"]) {
      const administrative = role === "master" || role === "admin";
      expect(matrix[role].includes("crm.management.forecast"), role).toBe(role !== "pending");
      expect(new Set(matrix[role]).size, role).toBe(matrix[role].length);
      if (administrative) {
        expect(matrix[role], role).toEqual(
          PAGE_REGISTRY.filter((page) => page.releaseEnabled && page.isNavigation)
            .map((page) => page.pageKey)
            .sort(),
        );
      } else if (role === "pending") {
        expect(matrix[role]).toEqual([]);
      } else {
        expect(matrix[role], role).toContain("crm.management.routine");
        expect(matrix[role], role).toContain("crm.management");
      }
    }
  });

  it("keeps restore and browser gates synchronized with the released access matrix", async () => {
    const [restoreHarness, rlsHarness, browserHarness, visualHarness] = await Promise.all([
      readFile(path.join(repositoryRoot, "scripts/release/isolated-restore-rehearsal.mjs"), "utf8"),
      readFile(path.join(repositoryRoot, "scripts/qa/local-rls-api.mjs"), "utf8"),
      readFile(path.join(repositoryRoot, "e2e/release-candidate.spec.ts"), "utf8"),
      readFile(path.join(repositoryRoot, "scripts/qa/local-authenticated-visual.mjs"), "utf8"),
    ]);
    const expectedRoles = [
      "master",
      "admin",
      "coordinator",
      "manager_house",
      "manager_imob",
      "broker_house",
      "broker_imob",
      "pending",
    ];
    const readRoleBlock = (source: string, declaration: string) => {
      const block =
        source.match(new RegExp(`const ${declaration} = \\[([\\s\\S]*?)\\];`))?.[1] ?? "";
      return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
    };

    expect(restoreHarness).toContain("const expectedPgTapTests = 2242;");
    expect(readRoleBlock(rlsHarness, "requiredRoles")).toEqual(expectedRoles);
    expect(readRoleBlock(browserHarness, "expectedRoles")).toEqual(expectedRoles);
    for (const harness of [rlsHarness, visualHarness]) {
      expect(harness).toContain('path.join(repositoryRoot, ".next/standalone")');
      expect(harness).toContain("spawn(process.execPath, [serverPath]");
    }
  });

  it("ships all new runtime capabilities off and without credentials", async () => {
    const example = await readFile(
      path.join(repositoryRoot, "deploy/production.env.example"),
      "utf8",
    );
    expect(example).toContain("CRM_READ_MODEL_V3_SHADOW_ENABLED=false");
    expect(example).toContain("QLIK_RELAY_MODE=off");
    expect(example).toContain("QLIK_RELAY_WRITE_ENABLED=false");
    expect(example).toContain("QLIK_RELAY_KEY_ID=\n");
    expect(example).toContain("QLIK_RELAY_HMAC_SECRET=\n");
    expect(example).toContain("QLIK_RELAY_DATABASE_URL=\n");
    expect(example).toContain("COMMERCIAL_ENGINE_RUNTIME_MODE=off");
    expect(example).toContain("COMMERCIAL_ENGINE_ENABLED_KEYS=\n");
    expect(example).toContain("COMMERCIAL_ENGINE_DATABASE_URL=\n");
  });

  it("keeps CI and runbooks wired to local release gates", async () => {
    const [workflow, runbook, approvals, compose, visualHarness] = await Promise.all([
      readFile(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/release-candidate/RELEASE_RUNBOOK.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/release-candidate/APPROVAL_PACKAGE.md"), "utf8"),
      readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
      readFile(path.join(repositoryRoot, "scripts/qa/authenticated-visual.mjs"), "utf8"),
    ]);
    expect(workflow).toContain("pnpm format:check");
    expect(workflow).toContain("pnpm qa:e2e:release");
    expect(workflow).toContain("pnpm qa:visual:authenticated");
    expect(workflow).toContain("pnpm db:rehearse");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("raw CLI output was withheld");
    expect(runbook).toContain("#26 → #27 → #28 → #29 → #30 → #31 → #32 → #33 → novo incremento");
    expect(runbook).toContain("Nunca usar `migration repair`");
    expect(approvals).toContain("Ausência de qualquer resposta ou autorização mantém o gate");
    const runtimeEnvironment = compose.match(/\n    environment:\n((?:      .*\n)+)/)?.[1];
    expect(runtimeEnvironment).toBeDefined();
    expect(runtimeEnvironment).toContain("DEPLOYMENT_VERSION: ${IMAGE_TAG:?IMAGE_TAG is required}");
    expect(visualHarness).toContain(
      'const artifactRoot = path.join(repositoryRoot, "test-results/authenticated-visual")',
    );
    expect(visualHarness).toContain("function baselineMatchesHead()");
    expect(visualHarness).toContain('argv[0] === "--update-baseline"');
  });
});

describe("representative production restore evidence", () => {
  it("records the read-only restore, future train and clean rollback", async () => {
    const evidence = JSON.parse(
      await readFile(
        path.join(repositoryRoot, "docs/release-candidate/production-restore-results.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(evidence).toMatchObject({
      remoteMutation: false,
      representativeRemoteRestore: true,
      remoteCurrent: {
        restore: "passed",
        migrationHistoryEntries: 17,
        lastMigration: "20260809031936",
      },
      futureSequenceResult: "passed",
      rollback: {
        result: "passed",
        remoteSchemaPresent: true,
        remoteDataLoaded: true,
        futureObjectsAbsent: true,
      },
      cleanup: {
        containerRemoved: true,
        plaintextShredded: true,
        encryptedBackupPreserved: true,
      },
      authorization: {
        remoteMigration: false,
        cutover: false,
        productionDeploy: false,
      },
    });
    expect(evidence.futureSequence).toHaveLength(10);
  });
});

describe("isolated restore evidence", () => {
  it("prepares environment-bound pg_cron in the isolated restore database", async () => {
    const script = await readFile(
      path.join(repositoryRoot, "scripts/release/isolated-restore-rehearsal.mjs"),
      "utf8",
    );

    expect(script).toContain("alter system set cron.database_name");
    expect(script).toContain('"supabase_admin"');
    expect(script).toContain("create extension if not exists pg_cron with schema pg_catalog");
    expect(script).toContain("preparePgCronRestore(targetContainer, restoreDatabase)");
    expect(script).toContain("pg_isready");
  });

  it("proves a clean local cross-cluster restore without authorizing remote work", async () => {
    const evidence = JSON.parse(
      await readFile(
        path.join(repositoryRoot, "docs/release-candidate/isolated-restore-results.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(evidence).toMatchObject({
      schemaVersion: 2,
      remoteMutation: false,
      representativeRemoteRestore: false,
      remoteMigrationHistoryRehearsed: false,
      cutoverAuthorized: false,
      dockerTransport: "local-unix",
      independentSourceAndTargetProjects: true,
      independentSourceAndTargetContainers: true,
      worktreeDirtyAtRehearsal: false,
      migrationCount: 27,
      pgTapFiles: 18,
      pgTapTests: 885,
      sourceValidation: {
        pgTapTests: 885,
        databaseLint: "passed",
        securityAdvisors: "passed",
        performanceAdvisors: "passed",
      },
      restoredValidation: {
        pgTapTests: 885,
        databaseLint: "passed",
        securityAdvisors: "passed",
        performanceAdvisors: "passed",
      },
      reset: "passed",
      logicalBackup: "passed",
      logicalRestore: "passed",
      ownersPreserved: true,
      effectivePrivilegesPreserved: true,
      aclFingerprintMode: "effective-privileges-owner-implicit-grantor-independent",
      aclGrantorsCompared: false,
      targetAclMutationApplied: false,
      fingerprintMatch: true,
      sourcePostValidationNonSequenceFingerprintMatch: true,
      postValidationNonSequenceFingerprintMatch: true,
      objectCounts: {
        roles: 2,
        tables: 57,
        schemas: 4,
        policies: 25,
        functions: 88,
        relations: 62,
        sequences: 5,
      },
      failClosed: {
        relay_gates: 0,
        relay_role_safe: true,
        commercial_gates: 0,
        relay_credentials: 0,
        commercial_policies: 0,
        mapping_authorities: 0,
        commercial_role_safe: true,
        commercial_executions: 0,
      },
    });

    for (const key of [
      "captureCommit",
      "worktreeFingerprint",
      "migrationManifestSha256",
      "logicalBackupSha256",
      "canonicalFingerprintSha256",
    ]) {
      expect(evidence[key]).toMatch(key === "captureCommit" ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{64}$/);
    }
    expect(evidence.logicalBackupBytes).toEqual(expect.any(Number));
    expect(evidence.logicalBackupBytes).toBeGreaterThan(0);
    expect(Object.values(evidence.componentSha256 as Record<string, string>)).not.toHaveLength(0);
    expect(
      Object.values(evidence.componentSha256 as Record<string, string>).every((hash) =>
        /^[a-f0-9]{64}$/.test(hash),
      ),
    ).toBe(true);
  });
});
