import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizationContext } from "../lib/authorization/types";
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
  pages: vi.fn(),
  directory: vi.fn(),
}));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/navigation/pages", () => ({ getAuthorizedNavigation: mocks.pages }));
vi.mock("@/app/(protected)/admin/usuarios/user-directory", () => ({
  loadUserDirectoryPage: mocks.directory,
  USER_DIRECTORY_PAGE_SIZE: 6,
}));
import { resolveLeadCrmUser, loadLeadCrmUsers } from "../lib/crm/lead-plus/crm-users";
const actor = "10000000-0000-4000-8000-000000000001";
const target = "10000000-0000-4000-8000-000000000002";
const context: AuthorizationContext = {
  userId: actor,
  roleKey: "admin",
  level: 80,
  permissions: ["users.view", "crm.leads.view"],
};
const profile = {
  user_id: target,
  email: "target@example.test",
  is_active: true,
  access_status: "approved",
};
const authorization = {
  user_id: target,
  role_key: "admin",
  level: 80,
  permissions: ["crm.leads.view"],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.single });
  mocks.single.mockResolvedValue({ data: profile, error: null });
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "get_user_directory_contract"
      ? { data: "scoped", error: null }
      : { data: [authorization], error: null },
  );
  mocks.pages.mockResolvedValue([{ path: "/app/leads" }, { path: "/app/leads/lista" }]);
  mocks.directory.mockResolvedValue({
    totalCount: 1,
    users: [{ userId: target, email: profile.email, isActive: true, accessStatus: "approved" }],
  });
});
describe("LEAD+ existing CRM directory under caller RLS", () => {
  it("reads only the approved profile and validates canonical authorization and page access", async () => {
    expect(await resolveLeadCrmUser(context, target)).toEqual({
      id: target,
      email: profile.email,
      name: profile.email,
      authorizedPages: ["/app/leads", "/app/leads/lista"],
      canonicalPermissions: ["crm.leads.view"],
    });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("profiles");
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("user_id", target);
    expect(mocks.rpc).toHaveBeenCalledWith("get_user_directory_contract");
    expect(mocks.rpc).toHaveBeenCalledWith("get_user_authorization_context", { user_uuid: target });
    expect(mocks.pages).toHaveBeenCalledWith({
      userId: target,
      roleKey: "admin",
      level: 80,
      permissions: ["crm.leads.view"],
    });
  });
  it.each([
    { ...profile, is_active: false },
    { ...profile, access_status: "suspended" },
    { ...profile, access_status: "pending" },
    { ...profile, access_status: "legacy_review" },
    { ...profile, user_id: actor },
  ])("rejects non-approved, inactive or mismatched profiles %#", async (data) => {
    mocks.single.mockResolvedValue({ data, error: null });
    await expect(resolveLeadCrmUser(context, target)).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalledWith("get_user_authorization_context", expect.anything());
  });
  it.each(
    [
      [],
      [{ ...authorization, user_id: actor }],
      [{ ...authorization, permissions: ["unknown.permission"] }],
      [{ ...authorization, role_key: "unknown" }],
      [{ ...authorization, role_key: "pending", level: 1 }],
      [{ ...authorization, level: 999 }],
      [authorization, authorization],
    ].map((data) => ({ data })),
  )("fails closed for empty or unrecognized canonical authorization %#", async ({ data }) => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "get_user_directory_contract"
        ? { data: "scoped", error: null }
        : { data, error: null },
    );
    await expect(resolveLeadCrmUser(context, target)).rejects.toMatchObject({ status: 403 });
  });
  it("does not query another identity without users.view and denies missing target page", async () => {
    await expect(
      resolveLeadCrmUser({ ...context, permissions: ["crm.leads.view"] }, target),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.client).not.toHaveBeenCalled();
    mocks.pages.mockResolvedValue([]);
    await expect(resolveLeadCrmUser(context, target)).rejects.toMatchObject({ status: 403 });
  });
  it("loads a bounded existing directory page, retaining only approved active profiles", async () => {
    mocks.directory.mockResolvedValue({
      totalCount: 2,
      users: [
        { userId: target, email: profile.email, isActive: true, accessStatus: "approved" },
        {
          userId: actor,
          email: "disabled@example.test",
          isActive: false,
          accessStatus: "suspended",
        },
      ],
    });
    expect(await loadLeadCrmUsers(context, "target", 6)).toEqual({
      data: [{ id: target, name: profile.email, email: profile.email }],
      total: 2,
      offset: 6,
      limit: 6,
    });
    expect(mocks.directory).toHaveBeenCalledExactlyOnceWith(context, {
      search: "target",
      offset: 6,
      status: "active",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects invalid offsets and does not invent an unknown total", async () => {
    await expect(loadLeadCrmUsers(context, "", -1)).rejects.toMatchObject({ status: 422 });
    expect(mocks.directory).not.toHaveBeenCalled();
    mocks.directory.mockResolvedValue({ users: [], totalCount: null });
    await expect(loadLeadCrmUsers(context, "", 0)).rejects.toMatchObject({ status: 503 });
  });
});

describe("LEAD+ protected compact directory approval", () => {
  const compactProfile = { user_id: target, email: profile.email, is_active: true };
  const compactRow = { ...compactProfile, access_status: "approved" };
  function compactDirectory(value: unknown, error: unknown = null) {
    mocks.single.mockResolvedValue({ data: compactProfile, error: null });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_user_directory_contract") return { data: "compact", error: null };
      if (name === "get_compact_user_directory_page") return { data: value, error };
      return { data: [authorization], error: null };
    });
  }
  it("does not select a nonexistent access_status column and requires exact protected approval", async () => {
    compactDirectory({ profiles: [compactRow], total_count: 1, summary: null });
    const user = await resolveLeadCrmUser(context, target);
    expect(user.id).toBe(target);
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith("user_id,email,is_active");
    expect(mocks.rpc).toHaveBeenCalledWith("get_compact_user_directory_page", {
      p_offset: 0,
      p_search: profile.email,
      p_status: "active",
      p_include_summary: false,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_user_authorization_context", { user_uuid: target });
  });
  it.each([
    { profiles: [] },
    { profiles: [{ ...compactRow, user_id: actor }] },
    { profiles: [{ ...compactRow, email: "other@example.test" }] },
    { profiles: [{ ...compactRow, is_active: false }] },
    { profiles: [{ ...compactRow, access_status: "pending" }] },
    { profiles: [{ ...compactRow, access_status: "suspended" }] },
    { profiles: [{ ...compactRow, access_status: undefined }] },
    { profiles: [compactRow, compactRow] },
    {},
  ])("does not infer approval from a compact active flag %#", async (data) => {
    compactDirectory(data);
    await expect(resolveLeadCrmUser(context, target)).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalledWith("get_user_authorization_context", expect.anything());
  });
  it("denies compact RPC failure and unknown or unavailable directory contracts", async () => {
    compactDirectory({ profiles: [compactRow] }, { code: "42501" });
    await expect(resolveLeadCrmUser(context, target)).rejects.toMatchObject({ status: 403 });
    for (const contract of [
      { data: "legacy", error: null },
      { data: "compact", error: { code: "PGRST202" } },
    ]) {
      mocks.from.mockClear();
      mocks.rpc.mockResolvedValue(contract);
      await expect(resolveLeadCrmUser(context, target)).rejects.toMatchObject({ status: 403 });
      expect(mocks.from).not.toHaveBeenCalled();
    }
  });
});
