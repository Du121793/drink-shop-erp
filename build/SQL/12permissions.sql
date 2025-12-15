-- 01_employee.sql
CREATE TABLE IF NOT EXISTS employee (
  line_id        VARCHAR(64) PRIMARY KEY,
  employee_name  VARCHAR(100),                        -- 員工名稱（預設 line 名稱，可修改）
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 加入時間
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- 修改時間
);

-- 02_role.sql  (身分組)
CREATE TABLE IF NOT EXISTS role (
  role_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- 身分_id
  role_name        VARCHAR(100) NOT NULL,                           -- 角色名稱
  permission_level SMALLINT NOT NULL DEFAULT 0,                     -- 權限等級
  CONSTRAINT uq_role_name UNIQUE (role_name),
  CONSTRAINT chk_permission_level_nonneg CHECK (permission_level >= 0)
);

-- 03_employee_role.sql  (員工-身分組)
CREATE TABLE IF NOT EXISTS employee_role (
  line_id   VARCHAR(64) NOT NULL,
  role_id   BIGINT NOT NULL,
  PRIMARY KEY (line_id, role_id),
  CONSTRAINT fk_employee_role_employee
    FOREIGN KEY (line_id) REFERENCES employee(line_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_employee_role_role
    FOREIGN KEY (role_id) REFERENCES role(role_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_employee_role_line_id ON employee_role(line_id);
CREATE INDEX IF NOT EXISTS idx_employee_role_role_id ON employee_role(role_id);
