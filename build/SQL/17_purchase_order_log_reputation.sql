ALTER TABLE purchase_order_log
ADD COLUMN IF NOT EXISTS expected_delivery_at TIMESTAMPTZ;

ALTER TABLE purchase_order_log
ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
