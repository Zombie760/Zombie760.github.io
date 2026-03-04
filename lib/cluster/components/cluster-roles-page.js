"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { PlusIcon, TrashIcon, PencilIcon, UserIcon } from "../../chat/components/icons.js";
import { getClusterRoles, createClusterRole, updateClusterRole, deleteClusterRole } from "../actions.js";
import { ConfirmDialog } from "../../chat/components/ui/confirm-dialog.js";
function ClusterRolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadRoles = async () => {
    try {
      const result = await getClusterRoles();
      setRoles(result);
    } catch (err) {
      console.error("Failed to load roles:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadRoles();
  }, []);
  const handleCreate = async () => {
    const role = await createClusterRole("New Role", "");
    setRoles((prev) => [role, ...prev]);
  };
  const handleUpdate = async (roleId, updates) => {
    setRoles(
      (prev) => prev.map((r) => r.id === roleId ? { ...r, ...updates } : r)
    );
    const { success } = await updateClusterRole(roleId, updates);
    if (!success) loadRoles();
  };
  const handleDelete = async (roleId) => {
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    const { success } = await deleteClusterRole(roleId);
    if (!success) loadRoles();
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Define roles that can be assigned to workers in your clusters." }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: handleCreate,
          className: "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90",
          children: [
            /* @__PURE__ */ jsx(PlusIcon, { size: 16 }),
            "New role"
          ]
        }
      )
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: [...Array(3)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-24 animate-pulse rounded-lg bg-border/50" }, i)) }) : roles.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "rounded-full bg-muted p-4 mb-4", children: /* @__PURE__ */ jsx(UserIcon, { size: 24 }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-3", children: "No roles defined yet." }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: handleCreate,
          className: "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-input hover:bg-muted",
          children: [
            /* @__PURE__ */ jsx(PlusIcon, { size: 16 }),
            "Create first role"
          ]
        }
      )
    ] }) : /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: roles.map((role) => /* @__PURE__ */ jsx(
      RoleCard,
      {
        role,
        onUpdate: handleUpdate,
        onDelete: handleDelete
      },
      role.id
    )) })
  ] });
}
function RoleCard({ role, onUpdate, onDelete }) {
  const [editingName, setEditingName] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [nameValue, setNameValue] = useState(role.roleName);
  const [roleValue, setRoleValue] = useState(role.role);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef(null);
  const roleRef = useRef(null);
  useEffect(() => {
    if (editingName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [editingName]);
  useEffect(() => {
    if (editingRole && roleRef.current) {
      roleRef.current.focus();
    }
  }, [editingRole]);
  const saveName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== role.roleName) {
      onUpdate(role.id, { roleName: trimmed });
    }
    setEditingName(false);
  };
  const saveRole = () => {
    if (roleValue !== role.role) {
      onUpdate(role.id, { role: roleValue });
    }
    setEditingRole(false);
  };
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border bg-card p-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx("div", { className: "shrink-0 rounded-md bg-muted p-2", children: /* @__PURE__ */ jsx(UserIcon, { size: 16 }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          editingName ? /* @__PURE__ */ jsx(
            "input",
            {
              ref: nameRef,
              type: "text",
              value: nameValue,
              onChange: (e) => setNameValue(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setEditingName(false);
                  setNameValue(role.roleName);
                }
              },
              onBlur: saveName,
              className: "text-sm font-medium bg-background border border-input rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-xs"
            }
          ) : /* @__PURE__ */ jsx("span", { className: "text-sm font-medium truncate", children: role.roleName }),
          !editingName && /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setEditingName(true),
              className: "text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted",
              children: /* @__PURE__ */ jsx(PencilIcon, { size: 12 })
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-1.5", children: editingRole ? /* @__PURE__ */ jsx(
          "textarea",
          {
            ref: roleRef,
            value: roleValue,
            onChange: (e) => setRoleValue(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Escape") {
                setEditingRole(false);
                setRoleValue(role.role);
              }
            },
            onBlur: saveRole,
            rows: 3,
            className: "w-full text-sm bg-background border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring resize-y",
            placeholder: "Describe what this role does..."
          }
        ) : /* @__PURE__ */ jsx(
          "p",
          {
            className: "text-xs text-muted-foreground cursor-pointer hover:text-foreground mt-0.5",
            onClick: () => setEditingRole(true),
            children: role.role || "Click to add a description..."
          }
        ) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "shrink-0 flex items-center gap-1", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setConfirmDelete(true),
          className: "rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted",
          "aria-label": "Delete role",
          children: /* @__PURE__ */ jsx(TrashIcon, { size: 16 })
        }
      ) })
    ] }),
    /* @__PURE__ */ jsx(
      ConfirmDialog,
      {
        open: confirmDelete,
        title: "Delete role?",
        description: `This will delete "${role.roleName}" and unassign it from any workers using it.`,
        confirmLabel: "Delete",
        onConfirm: () => {
          setConfirmDelete(false);
          onDelete(role.id);
        },
        onCancel: () => setConfirmDelete(false)
      }
    )
  ] });
}
export {
  ClusterRolesPage
};
