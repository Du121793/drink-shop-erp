-- 04custom_option.sql (客製化選項)
CREATE TABLE IF NOT EXISTS custom_option (
option_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
option_name VARCHAR(100) NOT NULL -- 選項名稱
);