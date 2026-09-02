import { createFileRoute } from "@tanstack/react-router";
import { deleteLegacyUser } from "@/lib/delete-user.functions";

export const Route = createFileRoute("/api/public/tmp-delete-user")({
  server: {
    handlers: {
      GET: async () => Response.json(await deleteLegacyUser()),
    },
  },
});
