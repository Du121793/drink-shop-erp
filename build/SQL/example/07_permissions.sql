-- 07_permissions.sql (new permission model example)

INSERT INTO permission (code, name, category, description, is_active) VALUES
('system:admin', '系統管理員', '系統', '完整系統權限', TRUE),
('permissions:profile', '查看個人權限', '權限', '查看與更新個人資料', TRUE),
('permissions:issue', '權限註冊發放', '權限', '發放註冊 token', TRUE),
('permissions:manage', '權限管理', '權限', '管理角色與權限設定', TRUE),
('line:access', 'Line 功能', 'Line', '允許使用 Line 指令功能', TRUE),
('inventory:view', '查看庫存', '庫存', '檢視庫存與原料資訊', TRUE),
('inventory:write', '庫存維護', '庫存', '新增/修改庫存資料', TRUE),
('restock:view', '查看補貨建議', '補貨', '查看補貨建議清單', TRUE),
('restock:apply', '補貨調整', '補貨', '套用補貨調整或執行補貨', TRUE),
('restock:rules', '補貨規則管理', '補貨', '管理補貨規則與條件', TRUE),
('menu:manage', '菜單管理', '菜單', '新增/修改/刪除菜單', TRUE),
('supplier:view', '供應商查看', '採購', '查看供應商資料', TRUE),
('supplier:manage', '供應商維護', '採購', '新增/修改供應商資料', TRUE),
('purchase:view', '叫貨查看', '採購', '查看叫貨紀錄', TRUE),
('purchase:write', '叫貨操作', '採購', '新增或更新叫貨紀錄', TRUE),
('supplier:reputation', '供應商信譽', '採購', '查看與管理供應商信譽', TRUE),
('dashboard:view', '查看儀表板', '報表', '檢視營運儀表板', TRUE),
('report:view', '查看報表', '報表', '檢視營運報表', TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO role (role_name, description, is_system, is_assignable, is_active) VALUES
('模板-基本', '基本功能與 Line 權限', FALSE, FALSE, TRUE),
('模板-庫存查看', '庫存與原料瀏覽', FALSE, FALSE, TRUE),
('模板-庫存維護', '庫存資料維護', FALSE, FALSE, TRUE),
('模板-補貨作業', '補貨建議與調整', FALSE, FALSE, TRUE),
('模板-補貨規則', '補貨規則管理', FALSE, FALSE, TRUE),
('模板-採購', '供應商與叫貨管理', FALSE, FALSE, TRUE),
('模板-供應商信譽', '供應商信譽管理', FALSE, FALSE, TRUE),
('模板-菜單', '菜單與選項管理', FALSE, FALSE, TRUE),
('模板-報表', '營運報表檢視', FALSE, FALSE, TRUE),
('模板-權限註冊', '權限註冊發放', FALSE, FALSE, TRUE),
('模板-權限管理', '權限角色管理', FALSE, FALSE, TRUE),
('系統管理員', '完整權限', TRUE, TRUE, TRUE),
('店長', '店長角色', FALSE, TRUE, TRUE),
('庫存管理', '庫存與補貨', FALSE, TRUE, TRUE),
('採購管理', '採購與供應商', FALSE, TRUE, TRUE),
('門市夥伴', '門市基礎作業', FALSE, TRUE, TRUE)
ON CONFLICT (role_name) DO UPDATE
SET description = EXCLUDED.description,
    is_system = EXCLUDED.is_system,
    is_assignable = EXCLUDED.is_assignable,
    is_active = EXCLUDED.is_active;

WITH role_map AS (
  SELECT role_id, role_name FROM role
),
permission_map AS (
  SELECT permission_id, code FROM permission
),
role_permissions AS (
  SELECT * FROM (VALUES
    ('模板-基本', 'permissions:profile', 1),
    ('模板-基本', 'line:access', 1),
    ('模板-庫存查看', 'inventory:view', 1),
    ('模板-庫存維護', 'inventory:write', 1),
    ('模板-補貨作業', 'restock:view', 1),
    ('模板-補貨作業', 'restock:apply', 1),
    ('模板-補貨規則', 'restock:rules', 1),
    ('模板-採購', 'supplier:view', 1),
    ('模板-採購', 'supplier:manage', 1),
    ('模板-採購', 'purchase:view', 1),
    ('模板-採購', 'purchase:write', 1),
    ('模板-供應商信譽', 'supplier:reputation', 1),
    ('模板-菜單', 'menu:manage', 1),
    ('模板-報表', 'dashboard:view', 1),
    ('模板-報表', 'report:view', 1),
    ('模板-權限註冊', 'permissions:issue', 1),
    ('模板-權限管理', 'permissions:manage', 1),
    ('系統管理員', 'system:admin', 1)
  ) AS t(role_name, code, effect)
)
INSERT INTO role_permission (role_id, permission_id, effect)
SELECT r.role_id, p.permission_id, rp.effect
FROM role_permissions rp
JOIN role_map r ON r.role_name = rp.role_name
JOIN permission_map p ON p.code = rp.code
ON CONFLICT (role_id, permission_id) DO UPDATE
SET effect = EXCLUDED.effect;

WITH role_map AS (
  SELECT role_id, role_name FROM role
),
role_inherits AS (
  SELECT * FROM (VALUES
    ('系統管理員', '模板-基本'),
    ('系統管理員', '模板-庫存查看'),
    ('系統管理員', '模板-庫存維護'),
    ('系統管理員', '模板-補貨作業'),
    ('系統管理員', '模板-補貨規則'),
    ('系統管理員', '模板-採購'),
    ('系統管理員', '模板-供應商信譽'),
    ('系統管理員', '模板-菜單'),
    ('系統管理員', '模板-報表'),
    ('系統管理員', '模板-權限註冊'),
    ('系統管理員', '模板-權限管理'),
    ('店長', '模板-基本'),
    ('店長', '模板-庫存查看'),
    ('店長', '模板-庫存維護'),
    ('店長', '模板-補貨作業'),
    ('店長', '模板-補貨規則'),
    ('店長', '模板-採購'),
    ('店長', '模板-供應商信譽'),
    ('店長', '模板-菜單'),
    ('店長', '模板-報表'),
    ('店長', '模板-權限註冊'),
    ('庫存管理', '模板-基本'),
    ('庫存管理', '模板-庫存查看'),
    ('庫存管理', '模板-庫存維護'),
    ('庫存管理', '模板-補貨作業'),
    ('庫存管理', '模板-補貨規則'),
    ('採購管理', '模板-基本'),
    ('採購管理', '模板-採購'),
    ('採購管理', '模板-供應商信譽'),
    ('採購管理', '模板-報表'),
    ('門市夥伴', '模板-基本'),
    ('門市夥伴', '模板-庫存查看'),
    ('門市夥伴', '模板-補貨作業')
  ) AS t(role_name, parent_role_name)
)
INSERT INTO role_inherit (role_id, parent_role_id)
SELECT child.role_id, parent.role_id
FROM role_inherits ri
JOIN role_map child ON child.role_name = ri.role_name
JOIN role_map parent ON parent.role_name = ri.parent_role_name
ON CONFLICT (role_id, parent_role_id) DO NOTHING;

INSERT INTO employee (line_id, employee_name) VALUES
  ('admin_line_id', '管理員A'),
  ('manager_line_id', '店長B'),
  ('staff_line_id', '員工C')
ON CONFLICT (line_id) DO UPDATE
SET employee_name = EXCLUDED.employee_name;

WITH r AS (
  SELECT role_id, role_name FROM role WHERE role_name IN ('系統管理員','店長','門市夥伴')
)
INSERT INTO employee_role (line_id, role_id)
SELECT 'admin_line_id', (SELECT role_id FROM r WHERE role_name = '系統管理員')
UNION ALL
SELECT 'manager_line_id', (SELECT role_id FROM r WHERE role_name = '店長')
UNION ALL
SELECT 'staff_line_id', (SELECT role_id FROM r WHERE role_name = '門市夥伴')
ON CONFLICT (line_id, role_id) DO NOTHING;
