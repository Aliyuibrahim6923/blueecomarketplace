import type { Metadata } from "next";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton, TextField } from "@/components/form/fields";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Badge, EmptyState, Input, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { changeRoleAction, setAccountStatusAction } from "@/features/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize } from "@/lib/utils";

export const metadata: Metadata = { title: "Users & roles" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const q = (sp.q ?? "").trim().slice(0, 80);
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, account_status, deletion_requested_at, created_at, roles:role_assignments!role_assignments_user_id_fkey(role, revoked_at)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (sp.id && /^[0-9a-f-]{36}$/i.test(sp.id)) query = query.eq("id", sp.id);
  else if (q) {
    const esc = q.replace(/[%_\\,()]/g, "");
    query = query.or(`full_name.ilike.%${esc}%,email.ilike.%${esc}%`);
  }
  if (sp.deletion === "1") query = query.not("deletion_requested_at", "is", null);
  const { data } = await query;

  return (
    <>
      <PageHeader title="Users & roles" description="Privileged roles are granted only here and every change is audited." />
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/dashboard/admin/users">
        <label htmlFor="u-q" className="sr-only">Search users</label>
        <Input id="u-q" name="q" defaultValue={q} placeholder="Name or email" className="w-64" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="deletion" value="1" defaultChecked={sp.deletion === "1"} /> Deletion requests only
        </label>
        <button className="h-10 rounded-md border border-border bg-white px-4 text-sm">Search</button>
      </form>
      {!data?.length ? (
        <EmptyState title="No users found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Roles</Th>
              <Th>Status</Th>
              <Th>Manage</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => {
              const roles = ((u.roles ?? []) as { role: string; revoked_at: string | null }[]).filter((r) => !r.revoked_at).map((r) => r.role);
              const self = u.id === admin.id;
              const active = u.account_status === "active";
              return (
                <tr key={u.id as string}>
                  <Td>
                    <p className="font-medium">{(u.full_name as string) || "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email as string}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(u.created_at as string)}</p>
                    {u.deletion_requested_at ? <Badge tone="warning">Deletion requested {formatDate(u.deletion_requested_at as string)}</Badge> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {roles.map((r) => (
                        <Badge key={r} tone={r === "admin" || r === "agency_analyst" ? "warning" : "info"}>
                          {humanize(r)}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <GenericStatusBadge status={u.account_status as string} />
                  </Td>
                  <Td className="min-w-72 space-y-2">
                    {!self ? (
                      <ActionForm
                        action={setAccountStatusAction}
                        hidden={{ targetId: u.id as string, status: active ? "suspended" : "active" }}
                        confirm={active ? "Suspend this account?" : "Reactivate this account?"}
                        className="space-y-2"
                      >
                        {active ? <TextField name="reason" label="Reason" required /> : null}
                        <SubmitButton size="sm" variant={active ? "danger" : "teal"}>
                          {active ? "Suspend" : "Reactivate"}
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <p className="text-xs text-muted-foreground">This is you.</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(["admin", "agency_analyst"] as const).map((role) => {
                        const has = roles.includes(role);
                        if (self && role === "admin") return null;
                        return (
                          <ActionForm
                            key={role}
                            action={changeRoleAction}
                            hidden={{ targetId: u.id as string, role, op: has ? "revoke" : "grant" }}
                            confirm={`${has ? "Revoke" : "Grant"} ${humanize(role)}?`}
                            className="space-y-0"
                          >
                            <SubmitButton size="sm" variant="ghost">
                              {has ? `Revoke ${humanize(role)}` : `Grant ${humanize(role)}`}
                            </SubmitButton>
                          </ActionForm>
                        );
                      })}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
