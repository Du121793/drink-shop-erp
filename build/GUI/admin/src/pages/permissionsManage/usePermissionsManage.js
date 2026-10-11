import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getRoles,
  getRoleDetail,
  createRole,
  updateRole,
  deleteRole,
  updateRolePermissions,
  updateRoleInherit,
  getPermissions,
  getEmployees,
  updateEmployee,
  registerEmployee,
} from "../../api/permissions";

// 集中管理角色、員工與權限操作，頁面只負責呈現表單。
export default function usePermissionsManage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleDetail, setRoleDetail] = useState(null);
  const [roleForm, setRoleForm] = useState({
    role_name: "",
    description: "",
    is_assignable: true,
    is_active: true,
  });
  const [roleInheritIds, setRoleInheritIds] = useState([]);
  const [rolePermissionMap, setRolePermissionMap] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [registerToken, setRegisterToken] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerRoles, setRegisterRoles] = useState([]);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideEmployee, setOverrideEmployee] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    role_name: "",
    description: "",
    is_assignable: true,
  });

  const assignableRoles = useMemo(
    () => roles.filter((r) => r.is_assignable),
    [roles]
  );

  const roleMap = useMemo(() => {
    const map = new Map();
    roles.forEach((r) => map.set(String(r.role_id), r));
    return map;
  }, [roles]);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const [rRes, pRes, eRes] = await Promise.all([
        getRoles(),
        getPermissions(),
        getEmployees(),
      ]);
      const roleRows = (rRes.data?.roles || []).map((r) => ({
        ...r,
        role_id: String(r.role_id),
      }));
      const permissionRows = (pRes.data?.permissions || []).map((p) => ({
        ...p,
        permission_id: String(p.permission_id),
      }));
      setRoles(roleRows);
      setPermissions(permissionRows);
      const normalized = (eRes.data?.employees || []).map((e) => ({
        ...e,
        roles: Array.isArray(e.roles)
          ? e.roles.map((r) => String(r.role_id))
          : [],
        overrides: Array.isArray(e.overrides)
          ? e.overrides.map((o) => ({
              ...o,
              permission_id: String(o.permission_id),
            }))
          : [],
      }));
      setEmployees(normalized);
      if (roleRows.length > 0) {
        setSelectedRoleId((current) => current || roleRows[0].role_id);
      }
    } catch {
      setError("載入角色或員工資料失敗，請稍後再試。");
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const loadRoleDetail = async () => {
      if (!selectedRoleId) return;
      setError("");
      try {
        const detailRes = await getRoleDetail(selectedRoleId);
        const detail = detailRes?.data;
        if (!detail?.role) {
          setRoleDetail(null);
          setError("載入角色詳情失敗。");
          return;
        }
        const role = { ...detail.role, role_id: String(detail.role.role_id) };
        setRoleDetail({ ...detail, role });
        setRoleForm({
          role_name: role.role_name || "",
          description: role.description || "",
          is_assignable: role.is_assignable,
          is_active: role.is_active,
        });
        setRoleInheritIds(
          (detail.inherit_role_ids || []).map((id) => String(id))
        );
        const map = {};
        (detail.permissions || []).forEach((p) => {
          map[String(p.permission_id)] = Number(p.effect);
        });
        setRolePermissionMap(map);
      } catch {
        setRoleDetail(null);
        setError("載入角色詳情失敗。");
      }
    };
    loadRoleDetail();
  }, [selectedRoleId]);

  const handleRoleSave = async () => {
    if (!roleDetail?.role) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await updateRole(roleDetail.role.role_id, roleForm);
      await updateRoleInherit(roleDetail.role.role_id, roleInheritIds);
      const permissionsPayload = Object.entries(rolePermissionMap).map(
        ([permission_id, effect]) => ({
          permission_id,
          effect,
        })
      );
      await updateRolePermissions(roleDetail.role.role_id, permissionsPayload);
      setMessage("已更新角色設定");
      await loadAll();
    } catch {
      setError("更新角色設定失敗。");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleDelete = async () => {
    if (!roleDetail?.role) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await deleteRole(roleDetail.role.role_id);
      setSelectedRoleId("");
      setRoleDetail(null);
      setMessage("已刪除角色");
      await loadAll();
    } catch {
      setError("刪除角色失敗。");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!createForm.role_name) {
      setError("請輸入角色名稱。");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await createRole(createForm);
      setCreateDialogOpen(false);
      setCreateForm({ role_name: "", description: "", is_assignable: true });
      setSelectedRoleId(String(res.data?.role_id || ""));
      setMessage("已新增角色");
      await loadAll();
    } catch {
      setError("新增角色失敗。");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmployee = async (emp) => {
    setMessage("");
    setError("");
    setSaving(true);
    try {
      await updateEmployee(emp.line_id, {
        employee_name: emp.employee_name,
        role_ids: emp.roles,
        overrides: emp.overrides || [],
      });
      setMessage(`已更新 ${emp.line_id}`);
      await loadAll();
    } catch {
      setError("更新員工失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterEmployee = async () => {
    if (!registerToken) {
      setError("請輸入註冊 token。");
      return;
    }
    setMessage("");
    setError("");
    setSaving(true);
    try {
      await registerEmployee({
        token: registerToken,
        role_ids: registerRoles,
        employee_name: registerName || undefined,
      });
      setMessage("已完成註冊並設定角色");
      setRegisterToken("");
      setRegisterName("");
      setRegisterRoles([]);
      await loadAll();
    } catch {
      setError("註冊員工失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  

  

  const openOverrideDialog = (emp) => {
    setOverrideEmployee(emp);
    setOverrideDialogOpen(true);
  };

  const closeOverrideDialog = () => {
    setOverrideDialogOpen(false);
    setOverrideEmployee(null);
  };

  const handleOverrideSave = async () => {
    if (!overrideEmployee) return;
    await handleUpdateEmployee(overrideEmployee);
    closeOverrideDialog();
  };

  const overrideMap = useMemo(() => {
    if (!overrideEmployee) return {};
    const map = {};
    overrideEmployee.overrides.forEach((o) => {
      map[String(o.permission_id)] = Number(o.effect);
    });
    return map;
  }, [overrideEmployee]);

  const isSystemRole = roleDetail?.role?.is_system === true;

    return { roles, permissions, employees, setEmployees, selectedRoleId, setSelectedRoleId, roleDetail, roleForm, setRoleForm, roleInheritIds, setRoleInheritIds, rolePermissionMap, setRolePermissionMap, message, error, saving, registerToken, setRegisterToken, registerName, setRegisterName, registerRoles, setRegisterRoles, overrideDialogOpen, overrideEmployee, setOverrideEmployee, createDialogOpen, setCreateDialogOpen, createForm, setCreateForm, assignableRoles, handleRoleSave, handleRoleDelete, handleCreateRole, handleUpdateEmployee, handleRegisterEmployee, roleMap, openOverrideDialog, closeOverrideDialog, handleOverrideSave, overrideMap, isSystemRole };
}
