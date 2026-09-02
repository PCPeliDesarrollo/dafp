import { createServerFn } from "@tanstack/react-start";

const EMAIL_TO_DELETE = "gerenciapcpeli@gmail.com";

/** Elimina la cuenta de gerencia, que ya no debe tener acceso. */
export const deleteLegacyUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const target = list?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === EMAIL_TO_DELETE,
  );
  if (!target) return { status: "not_found" as const };
  const { error } = await supabaseAdmin.auth.admin.deleteUser(target.id);
  if (error) return { status: "error" as const, message: error.message };
  return { status: "deleted" as const };
});
