CREATE TABLE IF NOT EXISTS supplier (
  supplier_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_name VARCHAR(100) NOT NULL,
  email         VARCHAR(254),  -- 可為 NULL（也可以和 phone 都為空）
  phone         VARCHAR(30),   -- 可為 NULL（也可以和 email 都為空）
  CONSTRAINT uq_supplier_name UNIQUE (supplier_name)
);
