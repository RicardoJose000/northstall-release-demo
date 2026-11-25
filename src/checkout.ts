// App side of the payment: Stripe PaymentSheet + the create-payment Edge Function.
import { useStripe } from "@stripe/stripe-react-native";
import { supabase } from "./supabase";

export type CheckoutResult =
  | { status: "processing"; orderId: string }
  | { status: "canceled" }
  | { status: "failed"; message: string };

export function useCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return async function checkout(listingId: string): Promise<CheckoutResult> {
    const { data, error } = await supabase.functions.invoke("create-payment", {
      body: { listing_id: listingId },
    });
    if (error) return { status: "failed", message: error.message };

    const init = await initPaymentSheet({
      merchantDisplayName: "Northstall",
      paymentIntentClientSecret: data.clientSecret,
      returnURL: "northstall://stripe-redirect",
    });
    if (init.error) return { status: "failed", message: init.error.message };

    const result = await presentPaymentSheet();
    if (result.error) {
      return result.error.code === "Canceled"
        ? { status: "canceled" }
        : { status: "failed", message: result.error.message };
    }

    // Do not mark the order paid here. The webhook is the source of truth;
    // the Orders screen listens to the row via Supabase Realtime.
    return { status: "processing", orderId: data.orderId };
  };
}
