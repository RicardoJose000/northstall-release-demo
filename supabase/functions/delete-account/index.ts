// POST /functions/v1/delete-account
// In-app account deletion (App Store guideline 5.1.1(v), Google Play account deletion policy).
// Deleting the auth user cascades to profiles, seller_accounts and listings.
// Orders stay for accounting with buyer_id / seller_id set to null.
import { admin, cors, fail, json, requireUser } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const user = await requireUser(req);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch (err) {
    return fail(err);
  }
});
