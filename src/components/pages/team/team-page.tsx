'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, Plus } from 'lucide-react';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useStaff } from '@/components/pages/requests/use-requests';
import { Badge, Button, Checkbox, Switch, ConfirmDialog, Dialog, DialogActions, ErrorState, FormError, Input, PageHeader, Select, Spinner, Tabs } from '@/components/ui';
import { fieldErrors, PASSWORD_MIN_LENGTH, staffSchema, type Role, type StaffMember } from '@/contracts';
import { estKey, useEstablishmentId, useTimezone } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { staffApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useAuthStore, useCan, useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { formatDateTime } from '@/utils/time';
import { Avatar, CellStack, ChevronCell, DataTable, TBody, Td, Th, THead, TRow } from '@/components/ui/data-table';

type TeamDialog =
  | { kind: 'create' }
  | { kind: 'member' | 'edit' | 'password' | 'toggle'; member: StaffMember }
  | { kind: 'role-detail'; role: Role }
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
        title="Employés"
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
      {dialog?.kind === 'member' && <MemberDialog member={dialog.member} onDialog={setDialog} onClose={close} />}
      {dialog?.kind === 'role-detail' && <RoleDetailDialog role={dialog.role} onDialog={setDialog} onClose={close} />}
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
  if (isPending) return <Spinner />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <DataTable label="Membres de l’établissement" minWidth={720}>
      <THead>
        <Th>Employé</Th>
        <Th>Rôle</Th>
        <Th>Statut</Th>
        <Th>Dernière connexion</Th>
        <th className="w-10 border-b border-line bg-sunken/85" aria-hidden />
      </THead>
      <TBody>
        {data.map((member, index) => {
          const self = member.id === me?.id;
          return (
            <TRow key={member.id} index={index} onOpen={() => onDialog({ kind: 'member', member })} label={`${member.firstName} ${member.lastName}, ${member.role.name}`}>
              <Td>
                <span className="flex items-center gap-3">
                  <Avatar firstName={member.firstName} lastName={member.lastName} className="size-9" />
                  <CellStack
                    primary={
                      <>
                        {member.firstName} {member.lastName}
                        {self && <span className="font-normal text-ink-3"> (vous)</span>}
                      </>
                    }
                    secondary={member.email}
                  />
                </span>
              </Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  <Badge tone={member.role.key === 'owner' ? 'brand' : 'neutral'}>{member.role.name}</Badge>
                  {member.revokedPermissions.length > 0 && <Badge tone="wait">Personnalisé</Badge>}
                </span>
              </Td>
              <Td>
                <MemberStatus member={member} />
              </Td>
              <Td>
                {member.lastLoginAt ? (
                  <CellStack primary={<span className="tabular font-normal">{formatDateTime(member.lastLoginAt, timezone)}</span>} />
                ) : (
                  <span className="text-ink-3">Jamais connecté</span>
                )}
              </Td>
              <ChevronCell />
            </TRow>
          );
        })}
      </TBody>
    </DataTable>
  );
}

/**
 * Spec 010 : permissions de l'employé, une par ligne avec un interrupteur.
 * Seules les permissions de son rôle apparaissent : on ne peut jamais lui en donner davantage.
 * Une permission que l'on ne détient pas soi-même est verrouillée.
 */
function MemberPermissions({ member, self }: { member: StaffMember; self: boolean }) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const myPermissions = useMembership()?.permissions ?? [];
  const canManage = useCan('staff.manage');
  const catalog = useQuery({ queryKey: estKey(establishmentId, 'permissions'), queryFn: () => staffApi.permissions(establishmentId) });
  const [granted, setGranted] = useState<string[]>(member.permissions);
  const locked = !canManage ? 'Vous ne gérez pas l’équipe.' : self ? 'Vous ne pouvez pas ajuster vos propres permissions.' : member.role.key === 'owner' ? 'Un propriétaire garde toujours toutes ses permissions.' : null;
  const changed = granted.length !== member.permissions.length || granted.some((p) => !member.permissions.includes(p));
  const save = useMutation({
    mutationFn: () => staffApi.setPermissions(establishmentId, member.id, granted),
    onSuccess: (updated) => {
      toast.success('Permissions enregistrées', updated.revokedPermissions.length > 0 ? `${updated.revokedPermissions.length} retirée${updated.revokedPermissions.length > 1 ? 's' : ''} par rapport au rôle ${updated.role.name}.` : `Rôle ${updated.role.name} complet.`);
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'staff') });
    },
    onError: (error) => toast.error('Enregistrement impossible', errorMessage(error)),
  });
  const descriptions = new Map((catalog.data ?? []).map((permission) => [permission.key, permission.description]));
  const toggle = (key: string, on: boolean) => setGranted((current) => (on ? [...current, key] : current.filter((p) => p !== key)));
  const adjustable = (key: string) => !locked && myPermissions.includes(key);

  return (
    <section aria-labelledby="member-permissions" className="mt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="member-permissions" className="text-[15px] font-semibold text-ink">
          Permissions
        </h3>
        <span className="tabular text-[13px] text-ink-3">
          {granted.length} / {member.rolePermissions.length} du rôle {member.role.name}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-ink-2">
        {locked ?? `Seules les permissions du rôle ${member.role.name} sont proposées : on peut en retirer, jamais en ajouter.`}
      </p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-(--radius-card) ring-1 ring-line">
        {member.rolePermissions.map((key, index) => {
          const on = granted.includes(key);
          const canToggle = adjustable(key);
          return (
            <li
              key={key}
              className={cn('stagger flex animate-item-in items-center gap-3 px-4 py-2.5 transition-colors duration-300 ease-apple', !on && 'bg-sunken/50')}
              style={{ '--i': Math.min(index, 15) } as CSSProperties}
            >
              <span className={cn('min-w-0 flex-1 text-sm transition-colors duration-300', on ? 'text-ink' : 'text-ink-3 line-through decoration-ink-3/40')}>
                {descriptions.get(key) ?? key}
              </span>
              {!locked && !canToggle && <Lock className="size-3.5 shrink-0 text-ink-3" aria-label="Vous ne détenez pas cette permission" />}
              <Switch checked={on} disabled={!canToggle} onChange={(value) => toggle(key, value)} label={descriptions.get(key) ?? key} />
            </li>
          );
        })}
      </ul>
      {!locked && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={member.rolePermissions.every((p) => granted.includes(p) || !myPermissions.includes(p))}
            onClick={() => setGranted((current) => [...new Set([...current, ...member.rolePermissions.filter((p) => myPermissions.includes(p))])])}
          >
            Tout activer
          </Button>
          <Button size="sm" disabled={!changed} loading={save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </div>
      )}
    </section>
  );
}

function MemberStatus({ member }: { member: StaffMember }) {
  if (member.status === 'disabled') {
    return (
      <Badge tone="late">
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        Désactivé
      </Badge>
    );
  }
  if (member.mustChangePassword) {
    return (
      <Badge tone="wait">
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        Mot de passe à changer
      </Badge>
    );
  }
  return (
    <Badge tone="done">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      Actif
    </Badge>
  );
}

/** Fiche d'un employé : informations, puis ses actions regroupées (modifier, mot de passe, désactiver). */
function MemberDialog({ member, onDialog, onClose }: { member: StaffMember; onDialog: (dialog: TeamDialog) => void; onClose: () => void }) {
  const timezone = useTimezone();
  const me = useAuthStore((state) => state.me);
  const myRole = useMembership()?.role.key;
  const self = member.id === me?.id;
  // Seul un propriétaire modifie un propriétaire (règle appliquée par l'API).
  const editable = member.role.key !== 'owner' || myRole === 'owner';
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`${member.firstName} ${member.lastName}`} description={member.email} variant="sheet">
      <div className="flex items-center gap-4 rounded-(--radius-card) bg-sunken/60 p-4">
        <Avatar firstName={member.firstName} lastName={member.lastName} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">
            {member.firstName} {member.lastName}
            {self && <span className="font-normal text-ink-3"> (vous)</span>}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={member.role.key === 'owner' ? 'brand' : 'neutral'}>{member.role.name}</Badge>
            <MemberStatus member={member} />
          </div>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-line rounded-(--radius-card) ring-1 ring-line">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <dt className="text-ink-2">Adresse e-mail</dt>
          <dd className="truncate font-medium text-ink">{member.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <dt className="text-ink-2">Dernière connexion</dt>
          <dd className="tabular font-medium text-ink">{member.lastLoginAt ? formatDateTime(member.lastLoginAt, timezone) : 'Jamais'}</dd>
        </div>
      </dl>
      <MemberPermissions member={member} self={self} />
      {editable ? (
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="secondary" onClick={() => onDialog({ kind: 'edit', member })}>
            Modifier les informations et le rôle
          </Button>
          {!self && (
            <>
              <Button variant="secondary" onClick={() => onDialog({ kind: 'password', member })}>
                Définir un nouveau mot de passe
              </Button>
              <Button variant={member.status === 'active' ? 'danger' : 'primary'} onClick={() => onDialog({ kind: 'toggle', member })}>
                {member.status === 'active' ? 'Désactiver l’accès' : 'Réactiver l’accès'}
              </Button>
            </>
          )}
        </div>
      ) : (
        <p className="mt-6 text-[13px] text-ink-3">Seul un propriétaire peut modifier un autre propriétaire.</p>
      )}
    </Dialog>
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
  if (roles.isPending || catalog.isPending) return <Spinner />;
  if (roles.isError || catalog.isError) return <ErrorState message={errorMessage(roles.error ?? catalog.error)} onRetry={() => void roles.refetch()} />;

  return (
    <DataTable label="Permissions par rôle" minWidth={160 + 140 * roles.data.length}>
      <THead>
        <Th className="sticky left-0 z-10 bg-sunken/95">Permission</Th>
        {roles.data.map((role) => (
          <Th key={role.id} align="center" className="normal-case tracking-normal">
            <button
              type="button"
              onClick={() => onDialog({ kind: 'role-detail', role })}
              className="group inline-flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors duration-200 ease-apple hover:bg-surface"
            >
              <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                {role.isSystem && <Lock className="size-3 text-ink-3" aria-label="Rôle système" />}
                {role.name}
              </span>
              <span className="text-xs font-normal text-ink-3">
                {role.members} membre{role.members > 1 ? 's' : ''}
              </span>
            </button>
          </Th>
        ))}
      </THead>
      <TBody>
        {catalog.data.map((permission, index) => (
          <TRow key={permission.key} index={index}>
            <Td header className="sticky left-0 z-[1] bg-surface text-ink">
              {permission.description}
            </Td>
            {roles.data.map((role) => {
              const granted = role.permissions.includes(permission.key);
              return (
                <Td key={role.id} align="center">
                  {granted ? (
                    <span className="inline-grid size-6 place-items-center rounded-full bg-done-soft text-done" aria-label="Accordée">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  ) : (
                    <span className="text-ink-3" aria-label="Non accordée">
                      –
                    </span>
                  )}
                </Td>
              );
            })}
          </TRow>
        ))}
      </TBody>
    </DataTable>
  );
}

/** Fenêtre d'un rôle : ses permissions, puis ses actions (modifier, supprimer) s'il n'est pas un rôle système. */
function RoleDetailDialog({ role, onDialog, onClose }: { role: Role; onDialog: (dialog: TeamDialog) => void; onClose: () => void }) {
  const establishmentId = useEstablishmentId();
  const canManage = useCan('roles.manage');
  const catalog = useQuery({ queryKey: estKey(establishmentId, 'permissions'), queryFn: () => staffApi.permissions(establishmentId) });
  const granted = (catalog.data ?? []).filter((permission) => role.permissions.includes(permission.key));
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={role.name}
      description={`${role.members} membre${role.members > 1 ? 's' : ''} · ${role.permissions.length} permission${role.permissions.length > 1 ? 's' : ''}`}
      variant="sheet"
    >
      {role.isSystem && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-sunken/70 px-3 py-2 text-[13px] text-ink-2">
          <Lock className="size-3.5" aria-hidden />
          Rôle système : ses permissions ne se modifient pas.
        </p>
      )}
      <ul className="divide-y divide-line rounded-(--radius-card) ring-1 ring-line">
        {granted.map((permission) => (
          <li key={permission.key} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-done-soft text-done">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            {permission.description}
          </li>
        ))}
      </ul>
      {canManage && !role.isSystem && (
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="secondary" onClick={() => onDialog({ kind: 'role', role })}>
            Modifier le rôle
          </Button>
          <Button variant="danger" onClick={() => onDialog({ kind: 'delete-role', role })}>
            Supprimer le rôle
          </Button>
        </div>
      )}
    </Dialog>
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
