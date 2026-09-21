ALTER TABLE public.stripe_payment_history ADD COLUMN IF NOT EXISTS country_code text;
COMMENT ON COLUMN public.stripe_payment_history.country_code IS 'Billing country from Stripe Checkout, customer or charge address';
