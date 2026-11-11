'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useStaff } from '@/components/pages/requests/use-requests';
import { Badge, Button, Card, Checkbox, ConfirmDialog, Dialog, DialogActions, ErrorState, FormError, Input, PageHeader, Select, Spinner, Tabs } from '@/components/ui';
import { fieldErrors, PASSWORD_MIN_LENGTH, staffSchema, type Role, type StaffMember } from '@/contracts';
import { estKey, useEstablishmentId, useTimezone } from '@/hooks/use-establishment';
import { staffApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useAuthStore, useCan, useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { formatDateTime } from '@/utils/time';

type TeamDialog =
  | { kind: 'create' }
  | { kind: 'edit' | 'password' | 'toggle'; member: StaffMember }
  | { kind: 'role'; role?: Role }
  | { kind: 'delete-role'; role: Role }
  | null;

function useRoles() {
  const establishmentId = useEstablishmentId();
  return useQuery({ queryKey: estKey(establishmentId, 'roles'), queryFn: () => staffApi.roles(establishmentId) });
}

function useInvalidateTeam() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'staff') });
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'roles') });
  };
}

export function TeamPage() {
  const [tab, setTab] = useState<'members' | 'roles'>('members');
  const [dialog, setDialog] = useState<TeamDialog>(null);
  const canManageRoles = useCan('roles.manage');
  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Membres, rôles et permissions."
        actions={
          tab === 'members' ? (
            <Button onClick={() => setDialog({ kind: 'create' })}>
              <Plus className="size-4" aria-hidden />
              Ajouter un membre
            </Button>
          ) : (
            canManageRoles && (
              <Button onClick={() => setDialog({ kind: 'role' })}>
                <Plus className="size-4" aria-hidden />
                Nouveau rôle
              </Button>
            )
          )
        }
      />
      <div className="max-w-xs">
        <Tabs label="Sections" value={tab} onChange={setTab} tabs={[{ value: 'members', label: 'Membres' }, { value: 'roles', label: 'Rôles' }]} />
      </div>
      <div className="mt-5">{tab === 'members' ? <Members onDialog={setDialog} /> : <Roles onDialog={setDialog} />}</div>

      {dialog?.kind === 'create' && <CreateMemberDialog onClose={close} />}
      {dialog?.kind === 'edit' && <EditMemberDialog member={dialog.member} onClose={close} />}
      {dialog?.kind === 'password' && <PasswordDialog member={dialog.member} onClose={close} />}
      {dialog?.kind === 'toggle' && <ToggleDialog member={dialog.member} onClose={close} />}
      {dialog?.kind === 'role' && <RoleDialog role={dialog.role} onClose={close} />}
      {dialog?.kind === 'delete-role' && <DeleteRoleDialog role={dialog.role} onClose={close} />}
    </>
  );
}

function Members({ onDialog }: { onDialog: (dialog: TeamDialog) => void }) {
  const { data, isPending, isError, error, refetch } = useStaff();
  const timezone = useTimezone();
  const me = useAuthStore((state) => state.me);
  const myRole = useMembership()?.role.key;
  if (isPending) return <Spinner />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <Card>
      <ul className="divide-y divide-line">
        {data.map((member) => {
          const self = member.id === me?.id;
          // Seul un propriétaire modifie un propriétaire (règle appliquée par l'API).
          const editable = member.role.key !== 'owner' || myRole === 'owner';
          return (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {member.firstName} {member.lastName}
                  {self && <span className="text-[13px] font-normal text-ink-3">(vous)</span>}
                  <Badge tone={member.role.key === 'owner' ? 'brand' : 'neutral'}>{member.role.name}</Badge>
                  {member.status === 'disabled' && <Badge tone="late">Désactivé</Badge>}
                  {member.mustChangePassword && member.status === 'active' && <Badge tone="wait">Mot de passe à changer</Badge>}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-ink-2">
                  {member.email} · {member.lastLoginAt ? `dernière connexion ${formatDateTime(member.lastLoginAt, timezone)}` : 'jamais connecté'}
                </p>
              </div>
              {editable && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onDialog({ kind: 'edit', member })}>
                    Modifier
                  </Button>
                  {!self && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => onDialog({ kind: 'password', member })}>
                        Mot de passe
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDialog({ kind: 'toggle', member })}>
                        {member.status === 'active' ? 'Désactiver' : 'Réactiver'}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RoleSelect({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  const roles = useRoles();
  const myPermissions = useMembership()?.permissions ?? [];
  const myRole = useMembership()?.role.key;
  // On ne propose que les rôles attribuables : jamais plus de droits que les siens.
  const options = (roles.data ?? []).filter(
    (role) => role.permissions.every((p) => myPermissions.includes(p)) && (role.key !== 'owner' || myRole === 'owner'),
  );
  return (
    <Select label="Rôle" name="roleId" defaultValue={defaultValue ?? ''} error={error} disabled={roles.isPending}>
      <option value="">Choisir…</option>
      {options.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </Select>
  );
}

function CreateMemberDialog({ onClose }: { onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateTeam();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: (body: Parameters<typeof staffApi.create>[1]) => staffApi.create(establishmentId, body),
    onSuccess: (member) => {
      toast.success('Membre ajouté', `${member.firstName} devra changer son mot de passe à la première connexion.`);
      invalidate();
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = staffSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    create.mutate(parsed.data);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Ajouter un membre" description="Vous lui communiquez son mot de passe initial ; il le changera à sa première connexion.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" name="firstName" error={errors.firstName} autoFocus />
          <Input label="Nom" name="lastName" error={errors.lastName} />
        </div>
        <Input label="Adresse e-mail" name="email" type="email" inputMode="email" autoComplete="off" error={errors.email} />
        <RoleSelect error={errors.roleId} />
        <Input label="Mot de passe initial" name="password" type="text" autoComplete="off" error={errors.password} hint={`${PASSWORD_MIN_LENGTH} caractères au minimum.`} />
        <FormError message={create.isError ? errorMessage(create.error) : null} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending}>
            Ajouter
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function EditMemberDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateTeam();
  const self = useAuthStore((state) => state.me?.id) === member.id;
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Parameters<typeof staffApi.update>[2]) => staffApi.update(establishmentId, member.id, body),
    onSuccess: () => {
      toast.success('Membre modifié');
      invalidate();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName || !lastName) return setError('Prénom et nom sont requis.');
    setError(null);
    save.mutate({ firstName, lastName, roleId: !self && form.roleId && form.roleId !== member.role.id ? form.roleId : undefined });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`Modifier ${member.firstName} ${member.lastName}`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" name="firstName" defaultValue={member.firstName} />
          <Input label="Nom" name="lastName" defaultValue={member.lastName} />
        </div>
        {self ? <p className="text-[13px] text-ink-3">Vous ne pouvez pas modifier votre propre rôle.</p> : <RoleSelect defaultValue={member.role.id} />}
        <FormError message={error} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function PasswordDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateTeam();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (password: string) => staffApi.update(establishmentId, member.id, { password }),
    onSuccess: () => {
      toast.success('Mot de passe réinitialisé', 'Ses sessions ouvertes ont été fermées.');
      invalidate();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    if (password.length < PASSWORD_MIN_LENGTH) return setError(`Au moins ${PASSWORD_MIN_LENGTH} caractères.`);
    setError(null);
    save.mutate(password);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Réinitialiser le mot de passe" description={`${member.firstName} devra le changer à sa prochaine connexion.`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nouveau mot de passe" name="password" type="text" autoComplete="off" autoFocus />
        <FormError message={error} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            Réinitialiser
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ToggleDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateTeam();
  const disabling = member.status === 'active';
  const toggle = useMutation({
    mutationFn: () => staffApi.update(establishmentId, member.id, { status: disabling ? 'disabled' : 'active' }),
    onSuccess: () => {
      toast.success(disabling ? 'Compte désactivé' : 'Compte réactivé');
      invalidate();
      onClose();
    },
    onError: (e) => {
      toast.error('Action impossible', errorMessage(e));
      onClose();
    },
  });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={disabling ? `Désactiver ${member.firstName} ${member.lastName} ?` : `Réactiver ${member.firstName} ${member.lastName} ?`}
      description={disabling ? 'Son accès est coupé immédiatement. Son historique est conservé.' : 'Il pourra de nouveau se connecter.'}
      confirmLabel={disabling ? 'Désactiver' : 'Réactiver'}
      danger={disabling}
      loading={toggle.isPending}
      onConfirm={() => toggle.mutate()}
    />
  );
}

function Roles({ onDialog }: { onDialog: (dialog: TeamDialog) => void }) {
  const establishmentId = useEstablishmentId();
  const roles = useRoles();
  const catalog = useQuery({ queryKey: estKey(establishmentId, 'permissions'), queryFn: () => staffApi.permissions(establishmentId) });
  const canManage = useCan('roles.manage');
  if (roles.isPending || catalog.isPending) return <Spinner />;
  if (roles.isError || catalog.isError) return <ErrorState message={errorMessage(roles.error ?? catalog.error)} onRetry={() => void roles.refetch()} />;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3 text-[13px] font-medium text-ink-3">
                Permission
              </th>
              {roles.data.map((role) => (
                <th key={role.id} scope="col" className="px-3 py-3 text-center align-bottom">
                  <span className="block text-sm font-semibold text-ink">{role.name}</span>
                  <span className="block text-xs font-normal text-ink-3">
                    {role.members} membre{role.members > 1 ? 's' : ''}
                  </span>
                  {role.isSystem ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-normal text-ink-3">
                      <Lock className="size-3" aria-hidden />
                      Système
                    </span>
                  ) : (
                    canManage && (
                      <span className="mt-1 flex justify-center gap-2 text-xs font-medium">
                        <button type="button" className="text-ink underline underline-offset-2" onClick={() => onDialog({ kind: 'role', role })}>
                          Modifier
                        </button>
                        <button type="button" className="text-late underline underline-offset-2" onClick={() => onDialog({ kind: 'delete-role', role })}>
                          Supprimer
                        </button>
                      </span>
                    )
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {catalog.data.map((permission) => (
              <tr key={permission.key}>
                <th scope="row" className="px-4 py-2.5 font-normal text-ink">
                  {permission.description}
                </th>
                {roles.data.map((role) => {
                  const granted = role.permissions.includes(permission.key);
                  return (
                    <td key={role.id} className="px-3 py-2.5 text-center">
                      <span className={granted ? 'font-semibold text-done' : 'text-ink-3'} aria-label={granted ? 'Accordée' : 'Non accordée'}>
                        {granted ? '✓' : '–'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RoleDialog({ role, onClose }: { role?: Role; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateTeam();
  const catalog = useQuery({ queryKey: estKey(establishmentId, 'permissions'), queryFn: () => staffApi.permissions(establishmentId) });
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      role ? staffApi.updateRole(establishmentId, role.id, { name: name.trim(), permissions: selected }) : staffApi.createRole(establishmentId, { name: name.trim(), permissions: selected }),
    onSuccess: () => {
      toast.success(role ? 'Rôle modifié' : 'Rôle créé');
      invalidate();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setError('Donnez un nom au rôle.');
    if (selected.length === 0) return setError('Sélectionnez au moins une permission.');
    setError(null);
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={role ? `Modifier le rôle ${role.name}` : 'Nouveau rôle'} variant="sheet">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nom du rôle" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex. : Chef de rang" />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-[13px] font-medium text-ink">Permissions</legend>
          {catalog.isPending ? (
            <Spinner />
          ) : (
            (catalog.data ?? []).map((permission) => (
              <Checkbox
                key={permission.key}
                label={permission.description}
                checked={selected.includes(permission.key)}
                onChange={(e) => setSelected((current) => (e.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key)))}
              />
            ))
          )}
        </fieldset>
        <FormError message={error} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            {role ? 'Enregistrer' : 'Créer le rôle'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function DeleteRoleDialog({ role, onClose }: { role: Role; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const invalidate = useInvalidateTeam();
  const remove = useMutation({
    mutationFn: () => staffApi.deleteRole(establishmentId, role.id),
    onSuccess: () => {
      toast.success('Rôle supprimé');
      invalidate();
      onClose();
    },
    onError: (e) => {
      toast.error('Suppression impossible', errorMessage(e));
      onClose();
    },
  });
  return (
    <ConfirmDialog open onOpenChange={(open) => !open && onClose()} title={`Supprimer le rôle « ${role.name} » ?`} description="Un rôle encore attribué à des membres ne peut pas être supprimé." confirmLabel="Supprimer" danger loading={remove.isPending} onConfirm={() => remove.mutate()} />
  );
}
