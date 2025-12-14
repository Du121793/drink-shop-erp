CREATE TABLE inventory_consumption_log (
    log_id SERIAL PRIMARY KEY,
    bom_id INT NOT NULL REFERENCES bom(bom_id),
    quantity_consumed DECIMAL(10, 2) NOT NULL,
    consumption_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reason VARCHAR(255) NOT NULL
);
