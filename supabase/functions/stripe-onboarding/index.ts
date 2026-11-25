// POST /functions/v1/stripe-onboarding
// Creates (once) a Stripe Connect Express account for the signed-in user
// and returns a fresh Account Link for hosted onboarding.
import { admin, cors, fail, json, requireUser, stripe } from "../_shared/clients.ts";

// Must be https. Point it at a tiny page / universal link that reopens the app
// (northstall://seller/return). Never trust the redirect itself as "onboarded":
// the real status arrives through the account.updated webhook.
const RETURN_URL = Deno.env.get("ONBOARDING_RETURN_URL")!;
const REFRESH_URL = Deno.env.get("ONBOARDING_REFRESH_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const user = await requireUser(req);

    const { data: existing, error } = await admin
      .from("seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: { user_id: user.id },
        },
        // Double taps / retries return the same account instead of creating two.
        { idempotencyKey: `express-account-${user.id}` },
      );
      accountId = account.id;

      const { error: insertError } = await admin
        .from("seller_accounts")
        .upsert({ user_id: user.id, stripe_account_id: accountId }, { onConflict: "user_id" });
      if (insertError) throw insertError;
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: RETURN_URL,
      refresh_url: REFRESH_URL,
    });

    return json({ url: link.url });
  } catch (err) {
    return fail(err);
  }
});
