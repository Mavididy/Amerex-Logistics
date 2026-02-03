/**
 * STRIPE CONFIGURATION
 */

// Your Stripe publishable key
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51Srw1zDeak7ipT0n65eENDTuBFhBO1qUJi0oVecfPjnNBl72t6B60U4Gmcq7sVlZ0HsEPbz7qOIGeNgiSJsKcyzG00JpQcJfnz";

// ⚠️ NEVER put secret key in frontend code!
// Move to Supabase Edge Function for production

let stripe = null;

if (typeof Stripe !== "undefined") {
  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  console.log("✅ Stripe initialized");
} else {
  console.error("❌ Stripe.js CDN not loaded");
}
