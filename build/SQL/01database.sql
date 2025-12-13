-- 01database.sql
CREATE DATABASE drink_shop;

-- 在之後的檔案請連到 drink_shop 這個 DB 再執行
-- 例如：psql -d drink_shop -f 02bom.sql
drop table if exists custom_sales_detail , sales_detail ,product_option ,option_detail ,material_product ,inventory ,custom_option ,product ,bom;

