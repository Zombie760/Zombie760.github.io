'use client';

import { useState, useEffect, useRef } from 'react';
import { PlusIcon, TrashIcon, PencilIcon, UserIcon } from '../../chat/components/icons.js';
import { getClusterRoles, createClusterRole, updateClusterRole, deleteClusterRole } from '../actions.js';
import { ConfirmDialog } from '../../chat/components/ui/confirm-dialog.js';

export function ClusterRolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async () => {
    try {
      const result = await getClusterRoles();
      setRoles(result);
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleCreate = async () => {
    const role = await createClusterRole('New Role', '');
    setRoles((prev) => [role, ...prev]);
  };

  const handleUpdate = async (roleId, updates) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, ...updates } : r))
    );
    const { success } = await updateClusterRole(roleId, updates);
    if (!success) loadRoles();
  };

  const handleDelete = async (roleId) => {
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    const { success } = await deleteClusterRole(roleId);
    if (!success) loadRoles();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Define roles that can be assigned to workers in your clusters.
        </p>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
        >
          <PlusIcon size={16} />
          New role
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-border/50" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <UserIcon size={24} />
          </div>
          <p className="text-sm text-muted-foreground mb-3">No roles defined yet.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-input hover:bg-muted"
          >
            <PlusIcon size={16} />
            Create first role
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </>
  );
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

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-md bg-muted p-2">
          <UserIcon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Role Name */}
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                ref={nameRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') { setEditingName(false); setNameValue(role.roleName); }
                }}
                onBlur={saveName}
                className="text-sm font-medium bg-background border border-input rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-xs"
              />
            ) : (
              <span className="text-sm font-medium truncate">
                {role.roleName}
              </span>
            )}
            {!editingName && (
              <button
                onClick={() => setEditingName(true)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <PencilIcon size={12} />
              </button>
            )}
          </div>

          {/* Role Description */}
          <div className="mt-1.5">
            {editingRole ? (
              <textarea
                ref={roleRef}
                value={roleValue}
                onChange={(e) => setRoleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setEditingRole(false); setRoleValue(role.role); }
                }}
                onBlur={saveRole}
                rows={3}
                className="w-full text-sm bg-background border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                placeholder="Describe what this role does..."
              />
            ) : (
              <p
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground mt-0.5"
                onClick={() => setEditingRole(true)}
              >
                {role.role || 'Click to add a description...'}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"
            aria-label="Delete role"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete role?"
        description={`This will delete "${role.roleName}" and unassign it from any workers using it.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(role.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
