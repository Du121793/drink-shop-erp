-- 12permissions.sql (new permission model)

CREATE TABLE IF NOT EXISTS employee (
  line_id        VARCHAR(64) PRIMARY KEY,
  employee_name  VARCHAR(100),
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permission (
  permission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          VARCHAR(100) NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  category      VARCHAR(100) NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS role (
  role_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name      VARCHAR(100) NOT NULL UNIQUE,
  description    TEXT,
  is_system      BOOLEAN NOT NULL DEFAULT FALSE,
  is_assignable  BOOLEAN NOT NULL DEFAULT TRUE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS role_inherit (
  role_id        BIGINT NOT NULL,
  parent_role_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, parent_role_id),
  CONSTRAINT fk_role_inherit_role
    FOREIGN KEY (role_id) REFERENCES role (role_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_role_inherit_parent
    FOREIGN KEY (parent_role_id) REFERENCES role (role_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_permission (
  role_id       BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  effect        SMALLINT NOT NULL, -- 1=GRANT, -1=DENY
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permission_role
    FOREIGN KEY (role_id) REFERENCES role (role_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_role_permission_permission
    FOREIGN KEY (permission_id) REFERENCES permission (permission_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_role (
  line_id   VARCHAR(64) NOT NULL,
  role_id   BIGINT NOT NULL,
  PRIMARY KEY (line_id, role_id),
  CONSTRAINT fk_employee_role_employee
    FOREIGN KEY (line_id) REFERENCES employee (line_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_employee_role_role
    FOREIGN KEY (role_id) REFERENCES role (role_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS employee_permission_override (
  line_id       VARCHAR(64) NOT NULL,
  permission_id BIGINT NOT NULL,
  effect        SMALLINT NOT NULL, -- 1=GRANT, -1=DENY
  expires_at    TIMESTAMPTZ,
  note          TEXT,
  PRIMARY KEY (line_id, permission_id),
  CONSTRAINT fk_employee_perm_override_employee
    FOREIGN KEY (line_id) REFERENCES employee (line_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_employee_perm_override_permission
    FOREIGN KEY (permission_id) REFERENCES permission (permission_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_role_line_id ON employee_role (line_id);
CREATE INDEX IF NOT EXISTS idx_employee_role_role_id ON employee_role (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permission_role_id ON role_permission (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permission_permission_id ON role_permission (permission_id);
