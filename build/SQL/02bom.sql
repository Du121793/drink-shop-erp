-- 02bom.sql
CREATE TABLE IF NOT EXISTS bom (
    bom_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_name    VARCHAR(100) NOT NULL,
    shelf_life_days  INTEGER,                 -- 保存時間(天)
    max_stock_qty    NUMERIC(10,2),           -- 庫存最大值
    CONSTRAINT chk_bom_max_stock_nonneg
        CHECK (max_stock_qty IS NULL OR max_stock_qty >= 0)
);
