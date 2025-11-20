-- 02bom.sql  （原 bom表 / 原料資料表）
CREATE TABLE IF NOT EXISTS bom (
    bom_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_name    VARCHAR(100) NOT NULL,
    shelf_life_days  INTEGER      -- 保存天數，可視需求改成 NOT NULL
);
