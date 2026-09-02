import { createServerFn } from "@tanstack/react-start";

const SUPERUSER_EMAIL = "angeleschavessamino0@gmail.com";

const USERS = [
  { email: "fernandezcristina87@gmail.com", password: "010101" },
  { email: SUPERUSER_EMAIL, password: "010101" },
];


export const seedUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: { email: string; status: string }[] = [];
  for (const u of USERS) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) {
      // Ignore "already exists" errors
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        results.push({ email: u.email, status: "exists" });
      } else {
        results.push({ email: u.email, status: `error: ${error.message}` });
      }
    } else {
      results.push({ email: u.email, status: data.user ? "created" : "unknown" });
    }
  }

  // Asegura el rol de superusuario
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const su = list?.users?.find((u) => (u.email ?? "").toLowerCase() === SUPERUSER_EMAIL);
  if (su) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: su.id, role: "superuser" }, { onConflict: "user_id,role" });
  }

  return { results };

});
