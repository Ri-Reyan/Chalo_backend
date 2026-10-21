import Stripe from "stripe";
import credentials from "../config/credentials.js";

const stripeKey =
  credentials.stripe_secret_key || process.env.STRIPE_SECRET_KEY || "";

if (!stripeKey) {
  console.warn("⚠️ STRIPE_SECRET_KEY is not defined in environment variables.");
}

export const stripe = new Stripe(stripeKey);

export default stripe;

