-- 角色與示範帳號（對應 12permissions.sql）
-- 僅三種職位：管理員(5)、經理(3)、員工(1)

INSERT INTO role (role_name, permission_level) VALUES
  ('管理員', 5),
  ('經理', 3),
  ('員工', 1)
ON CONFLICT (role_name) DO UPDATE
SET permission_level = EXCLUDED.permission_level;

-- 範例員工
INSERT INTO employee (line_id, employee_name) VALUES
  ('admin_line_id', '管理員A'),
  ('manager_line_id', '經理B'),
  ('staff_line_id', '員工C')
ON CONFLICT (line_id) DO UPDATE
SET employee_name = EXCLUDED.employee_name;

-- 指派角色（每人單一角色）
WITH r AS (
  SELECT role_id, role_name FROM role WHERE role_name IN ('管理員','經理','員工')
)
INSERT INTO employee_role (line_id, role_id)
SELECT 'admin_line_id', (SELECT role_id FROM r WHERE role_name = '管理員')
UNION ALL
SELECT 'manager_line_id', (SELECT role_id FROM r WHERE role_name = '經理')
UNION ALL
SELECT 'staff_line_id', (SELECT role_id FROM r WHERE role_name = '員工')
ON CONFLICT (line_id, role_id) DO NOTHING;
