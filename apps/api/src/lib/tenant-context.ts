// The identity every repository function requires to run a query.
// Built once per request by the requireWorkspaceMember middleware (Day 5),
// after it verifies the caller is actually a member of the workspace they're
// asking about. See ARCHITECTURE.md §6, Decision 1.
export type TenantContext = {
  workspaceId: string;
  actorId: string;
};
