import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SUPERUSER_EMAIL = "angeleschavessamino0@gmail.com";

/** Meses (YYYY-MM) visibles para un usuario normal: el mes en curso y,
 *  durante los 7 primeros días del mes, también el mes anterior. */
export function allowedMonths(now = new Date()): string[] {
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const months = [ym(now)];
  if (now.getDate() <= 7) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    months.push(ym(prev));
  }
  return months;
}

export function useSuperuser() {
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!mounted) return;
      if (!user) {
        setIsSuper(false);
        setLoading(false);
        return;
      }
      if ((user.email ?? "").toLowerCase() === SUPERUSER_EMAIL) {
        setIsSuper(true);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "superuser")
        .maybeSingle();
      if (!mounted) return;
      setIsSuper(!!data);
      setLoading(false);
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") check();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { isSuper, loading };
}
