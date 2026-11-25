// POST /functions/v1/stripe-webhook   (deployed with verify_jwt = false)
// Two Stripe endpoints point here:
//   1) "Your account" events   -> payment_intent.*, charge.refunded
//   2) "Connected accounts"    -> account.updated
// Each has its own signing secret, so both are accepted.
import Stripe from "npm:stripe@17";
import { admin, json, stripe } from "../_shared/clients.ts";

const secrets = [
  Deno.env.get("STRIPE_WEBHOOK_SECRET"),
  Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET"),
].filter(Boolean) as string[];

const crypto = Stripe.createSubtleCryptoProvider();

async function verify(body: string, signature: string): Promise<Stripe.Event | null> {
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, crypto);
    } catch {
      // try the next secret
    }
  }
  return null;
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "account.updated": {
      const a = event.data.object;
      await admin
        .from("seller_accounts")
        .update({
          charges_enabled: a.charges_enabled,
          payouts_enabled: a.payouts_enabled,
          details_submitted: a.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_account_id", a.id)
        .throwOnError();
      break;
    }
    case "payment_intent.succeeded":
      await admin.from("orders").update({ status: "paid" })
        .eq("stripe_payment_intent_id", event.data.object.id).throwOnError();
      break;
    case "payment_intent.payment_failed":
      await admin.from("orders").update({ status: "failed" })
        .eq("stripe_payment_intent_id", event.data.object.id).throwOnError();
      break;
    case "charge.refunded": {
      const pi = event.data.object.payment_intent;
      if (typeof pi === "string") {
        await admin.from("orders").update({ status: "refunded" })
          .eq("stripe_payment_intent_id", pi).throwOnError();
      }
      break;
    }
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const body = await req.text(); // raw body, required for signature check
  const event = await verify(body, signature);
  if (!event) return new Response("invalid signature", { status: 400 });

  // Idempotency: Stripe can deliver the same event more than once.
  const { error: seen } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (seen?.code === "23505") return json({ received: true, duplicate: true });
  if (seen) return new Response("db error", { status: 500 });

  try {
    await handle(event);
  } catch (err) {
    console.error(err);
    // Forget the event so Stripe's automatic retry can process it again.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return new Response("handler error", { status: 500 });
  }

  return json({ received: true });
});
