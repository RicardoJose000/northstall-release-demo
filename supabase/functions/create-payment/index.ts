// POST /functions/v1/create-payment   body: { listing_id }
// Destination charge: buyer pays the platform, Stripe moves (amount - fee)
// to the seller's Express account automatically.
import { admin, cors, fail, HttpError, json, requireUser, stripe } from "../_shared/clients.ts";

const FEE_BPS = Number(Deno.env.get("PLATFORM_FEE_BPS") ?? "1000"); // 1000 bps = 10%

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const user = await requireUser(req);
    const { listing_id } = await req.json();
    if (typeof listing_id !== "string") throw new HttpError(400, "listing_id_required");

    // Price always comes from the database, never from the app.
    const { data: listing } = await admin
      .from("listings")
      .select("id, seller_id, price_cents, currency, is_published")
      .eq("id", listing_id)
      .maybeSingle();
    if (!listing?.is_published) throw new HttpError(404, "listing_not_found");
    if (listing.seller_id === user.id) throw new HttpError(400, "cannot_buy_own_listing");

    const { data: seller } = await admin
      .from("seller_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("user_id", listing.seller_id)
      .maybeSingle();
    if (!seller?.charges_enabled) throw new HttpError(409, "seller_not_ready");

    const fee = Math.round((listing.price_cents * FEE_BPS) / 10_000);

    const { data: order, error } = await admin
      .from("orders")
      .insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount_cents: listing.price_cents,
        fee_cents: fee,
      })
      .select("id")
      .single();
    if (error) throw error;

    const intent = await stripe.paymentIntents.create(
      {
        amount: listing.price_cents,
        currency: listing.currency,
        automatic_payment_methods: { enabled: true },
        application_fee_amount: fee,
        transfer_data: { destination: seller.stripe_account_id },
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `order-${order.id}` },
    );

    await admin.from("orders").update({ stripe_payment_intent_id: intent.id }).eq("id", order.id);

    // The app shows "processing" until the webhook marks the order as paid.
    return json({ clientSecret: intent.client_secret, orderId: order.id });
  } catch (err) {
    return fail(err);
  }
});
