'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useRequestTypes } from '@/components/pages/requests/use-requests';
import { Badge, Button, Card, Checkbox, ConfirmDialog, Dialog, DialogActions, EmptyState, ErrorState, FormError, Input, PageHeader, Select, Spinner, Tabs } from '@/components/ui';
import { ICON_LABELS, REQUEST_ICONS, requestIcon } from '@/constants/requests';
import { CURRENCIES, escalationRuleSchema, establishmentSchema, fieldErrors, requestTypeSchema, type EscalationRule, type RequestType } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { escalationApi, establishmentApi, requestTypesApi } from '@/services/api';
import { restoreSession } from '@/services/auth/session';
import { errorMessage } from '@/services/http';
import { useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { formatDuration } from '@/utils/time';
import { SessionSecuritySettings } from './session-security';

type Section = 'establishment' | 'types' | 'escalation';
const SECTIONS: { value: Section; label: string; permission: string }[] = [
  { value: 'establishment', label: 'Établissement', permission: 'establishment.update' },
  { value: 'types', label: 'Types de demande', permission: 'request_types.manage' },
  { value: 'escalation', label: 'Escalade', permission: 'escalation.manage' },
];

export function SettingsPage() {
  const permissions = useMembership()?.permissions ?? [];
  const sections = SECTIONS.filter((section) => permissions.includes(section.permission));
  const [section, setSection] = useState<Section>(sections[0]?.value ?? 'establishment');
  return (
    <>
      <PageHeader title="Paramètres" description="Réglages de l’établissement et du service." />
      {sections.length > 1 && (
        <div className="max-w-xl">
          <Tabs label="Sections" value={section} onChange={setSection} tabs={sections} />
        </div>
      )}
      <div className="mt-6">
        {section === 'establishment' && <EstablishmentSettings />}
        {section === 'types' && <RequestTypesSettings />}
        {section === 'escalation' && <EscalationSettings />}
      </div>
    </>
  );
}

// ------------------------------------------------------------ établissement

function EstablishmentSettings() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'establishment');
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: key, queryFn: () => establishmentApi.get(establishmentId) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: Parameters<typeof establishmentApi.update>[1]) => establishmentApi.update(establishmentId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated);
      toast.success('Paramètres enregistrés');
      void restoreSession(); // le nom et le fuseau affichés viennent du profil
    },
  });
  if (isPending) return <Spinner />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = establishmentSchema.safeParse({ ...Object.fromEntries(form), separateKitchen: form.get('separateKitchen') === 'on', pairingsEnabled: form.get('pairingsEnabled') === 'on' });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const { address, phone, ...rest } = parsed.data;
    save.mutate({ ...rest, address: address || undefined, phone: phone || undefined });
  }
  const timezones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [data.timezone];

  return (
    <>
      <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-8">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-[15px] font-semibold text-ink">Informations</legend>
          <Input label="Nom de l’établissement" name="name" defaultValue={data.name} error={errors.name} hint="Affiché à vos clients." />
          <Select label="Fuseau horaire" name="timezone" defaultValue={data.timezone} hint="Sert à afficher les heures et à calculer « aujourd’hui ».">
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
          <Select label="Devise" name="currency" defaultValue={data.currency} error={errors.currency} hint="Devise des prix de la carte et des montants des commandes.">
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code} — {currencyName(code)}
              </option>
            ))}
          </Select>
          <Input label="Adresse" name="address" defaultValue={data.address ?? ''} error={errors.address} />
          <Input label="Téléphone" name="phone" type="tel" defaultValue={data.phone ?? ''} error={errors.phone} />
        </fieldset>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-[15px] font-semibold text-ink">Demandes des clients</legend>
          <p className="-mt-1 text-[13px] text-ink-2">Ces limites protègent votre équipe d’un usage abusif d’un QR code.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Durée d’une session (minutes)" name="sessionTtlMinutes" type="number" min={15} max={720} defaultValue={data.sessionTtlMinutes} error={errors.sessionTtlMinutes && 'Entre 15 et 720.'} />
            <Input label="Demandes simultanées par table" name="maxActiveRequestsPerTable" type="number" min={1} max={20} defaultValue={data.maxActiveRequestsPerTable} error={errors.maxActiveRequestsPerTable && 'Entre 1 et 20.'} />
            <Input label="Demandes par session" name="maxRequestsPerSession" type="number" min={1} max={200} defaultValue={data.maxRequestsPerSession} error={errors.maxRequestsPerSession && 'Entre 1 et 200.'} />
            <Input label="Délai entre deux demandes (secondes)" name="requestCooldownSeconds" type="number" min={0} max={300} defaultValue={data.requestCooldownSeconds} error={errors.requestCooldownSeconds && 'Entre 0 et 300.'} />
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-[15px] font-semibold text-ink">Commandes</legend>
          <Checkbox
            label="Cuisine séparée : signaler les commandes prêtes au serveur"
            hint="Ajoute l’étape « Prête » sur l’écran Commandes. Laissez décoché si la même personne prépare et sert."
            name="separateKitchen"
            defaultChecked={data.separateKitchen}
          />
          <Checkbox
            label="Afficher « Souvent pris avec » dans la fiche d’un plat"
            hint="Propose au client, sous la quantité, les plats souvent commandés avec celui qu’il regarde."
            name="pairingsEnabled"
            defaultChecked={data.pairingsEnabled}
          />
        </fieldset>
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <div>
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
      {/* Spec 027, R12 : zone, rayon et délai d'alerte. */}
      <SessionSecuritySettings data={data} />
    </>
  );
}

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

// --------------------------------------------------------- types de demande

function RequestTypesSettings() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useRequestTypes();
  const [editing, setEditing] = useState<RequestType | 'new' | null>(null);
  const [removing, setRemoving] = useState<RequestType | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'request-types') });
  const remove = useMutation({
    mutationFn: (id: string) => requestTypesApi.archive(establishmentId, id),
    onSuccess: () => {
      toast.success('Type supprimé');
      void invalidate();
      setRemoving(null);
    },
    onError: (e) => toast.error('Suppression impossible', errorMessage(e)),
  });
  if (isPending) return <Spinner />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <div className="max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Ce que vos clients peuvent demander depuis leur table.</p>
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden />
          Ajouter
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState title="Aucun type de demande" description="Sans type actif, vos clients ne peuvent rien demander." />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.map((type) => {
              const Icon = requestIcon(type.icon);
              return (
                <li key={type.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {type.label}
                        {type.kind === 'order' && <Badge tone="neutral">Commandes de la carte</Badge>}
                        {type.kind === 'bill' && <Badge tone="neutral">Glissée par le client, réglée par le serveur</Badge>}
                        {type.priority === 'high' && <Badge tone="brand">Prioritaire</Badge>}
                        {!type.isActive && <Badge tone="muted">Masqué</Badge>}
                      </p>
                      <p className="text-[13px] text-ink-2">Prise en charge visée en {formatDuration(type.slaSeconds)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(type)}>
                      Modifier
                    </Button>
                    {/* « Commande » et « L'addition » (spec 028, R1) ne se suppriment pas : on les masque pour les suspendre. */}
                    {type.kind === 'service' && (
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(type)}>
                        Supprimer
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {editing && <RequestTypeDialog type={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => void invalidate()} />}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Supprimer « ${removing.label} » ?`}
          description="Les clients ne pourront plus faire cette demande. L’historique est conservé."
          confirmLabel="Supprimer"
          danger
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing.id)}
        />
      )}
    </div>
  );
}

function RequestTypeDialog({ type, onClose, onSaved }: { type?: RequestType; onClose: () => void; onSaved: () => void }) {
  const establishmentId = useEstablishmentId();
  const [icon, setIcon] = useState(type?.icon ?? 'bell');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: Omit<RequestType, 'id' | 'position' | 'kind'>) =>
      type ? requestTypesApi.update(establishmentId, type.id, body) : requestTypesApi.create(establishmentId, body),
    onSuccess: () => {
      toast.success(type ? 'Type modifié' : 'Type ajouté');
      onSaved();
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = requestTypeSchema.safeParse({
      label: form.get('label'),
      icon,
      priority: form.get('priority'),
      slaMinutes: form.get('slaMinutes'),
      allowNote: form.get('allowNote') === 'on',
      isActive: form.get('isActive') === 'on',
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const { slaMinutes, ...rest } = parsed.data;
    save.mutate({ ...rest, slaSeconds: Math.round(slaMinutes * 60) });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={type ? 'Modifier le type de demande' : 'Nouveau type de demande'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Libellé" name="label" defaultValue={type?.label} placeholder="Ex. : Une carafe d’eau" error={errors.label} autoFocus />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Icône</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {Object.entries(REQUEST_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={icon === key}
                aria-label={ICON_LABELS[key] ?? key}
                title={ICON_LABELS[key] ?? key}
                onClick={() => setIcon(key)}
                className={cn('grid aspect-square place-items-center rounded-lg ring-1 ring-inset', icon === key ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink-2 ring-line hover:bg-sunken')}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Délai cible (minutes)" name="slaMinutes" type="number" step="0.5" min={0.5} max={60} defaultValue={type ? type.slaSeconds / 60 : 3} error={errors.slaMinutes} />
          <Select label="Priorité" name="priority" defaultValue={type?.priority ?? 'normal'}>
            <option value="normal">Normale</option>
            <option value="high">Prioritaire</option>
          </Select>
        </div>
        <p className="-mt-2 text-[13px] text-ink-3">Passé le délai cible sans prise en charge, la demande est signalée « en retard ».</p>
        <Checkbox label="Le client peut ajouter une précision" name="allowNote" defaultChecked={type?.allowNote ?? true} />
        <Checkbox
          label={type?.kind === 'order' ? 'Commande en ligne ouverte' : 'Proposé aux clients'}
          hint={
            type?.kind === 'order'
              ? 'Décochez pour suspendre les commandes : la carte reste consultable, sans panier.'
              : 'Décochez pour masquer ce type sans le supprimer.'
          }
          name="isActive"
          defaultChecked={type?.isActive ?? true}
        />
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            {type ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------------ escalade

const TRIGGER_LABELS: Record<EscalationRule['trigger'], string> = {
  not_accepted: 'n’est pas prise en charge',
  not_resolved: 'n’est pas résolue',
};

function EscalationSettings() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'escalation-rules');
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: key, queryFn: () => escalationApi.list(establishmentId) });
  const types = useRequestTypes();
  const [editing, setEditing] = useState<EscalationRule | 'new' | null>(null);
  const [removing, setRemoving] = useState<EscalationRule | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const remove = useMutation({
    mutationFn: (id: string) => escalationApi.archive(establishmentId, id),
    onSuccess: () => {
      toast.success('Règle supprimée');
      void invalidate();
      setRemoving(null);
    },
    onError: (e) => toast.error('Suppression impossible', errorMessage(e)),
  });
  if (isPending) return <Spinner />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  const typeName = (id: string | null) => (id ? (types.data?.find((t) => t.id === id)?.label ?? 'un type supprimé') : null);

  return (
    <div className="max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Une escalade alerte les responsables sans changer le statut de la demande.</p>
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden />
          Ajouter
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState title="Aucune règle d’escalade" description="Sans règle, aucune alerte n’est envoyée quand une demande traîne." />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {rule.name}
                    {!rule.isActive && <Badge tone="muted">Désactivée</Badge>}
                  </p>
                  <p className="text-[13px] text-ink-2">
                    Si {typeName(rule.requestTypeId) ? `« ${typeName(rule.requestTypeId)} »` : 'une demande'} {TRIGGER_LABELS[rule.trigger]} après{' '}
                    {formatDuration(rule.afterSeconds)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(rule)}>
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(rule)}>
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing && <RuleDialog rule={editing === 'new' ? undefined : editing} types={types.data ?? []} onClose={() => setEditing(null)} onSaved={() => void invalidate()} />}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Supprimer la règle « ${removing.name} » ?`}
          description="Les demandes déjà escaladées le restent."
          confirmLabel="Supprimer"
          danger
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing.id)}
        />
      )}
    </div>
  );
}

function RuleDialog({ rule, types, onClose, onSaved }: { rule?: EscalationRule; types: RequestType[]; onClose: () => void; onSaved: () => void }) {
  const establishmentId = useEstablishmentId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: Omit<EscalationRule, 'id'>) => (rule ? escalationApi.update(establishmentId, rule.id, body) : escalationApi.create(establishmentId, body)),
    onSuccess: () => {
      toast.success(rule ? 'Règle modifiée' : 'Règle ajoutée');
      onSaved();
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = escalationRuleSchema.safeParse({
      name: form.get('name'),
      trigger: form.get('trigger'),
      afterMinutes: form.get('afterMinutes'),
      requestTypeId: form.get('requestTypeId') || null,
      isActive: form.get('isActive') === 'on',
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const { afterMinutes, ...rest } = parsed.data;
    save.mutate({ ...rest, afterSeconds: Math.round(afterMinutes * 60) });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={rule ? 'Modifier la règle' : 'Nouvelle règle d’escalade'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nom" name="name" defaultValue={rule?.name} placeholder="Ex. : Addition non prise en charge" error={errors.name} autoFocus />
        <Select label="Alerter quand une demande" name="trigger" defaultValue={rule?.trigger ?? 'not_accepted'}>
          <option value="not_accepted">n’est pas prise en charge</option>
          <option value="not_resolved">n’est pas résolue</option>
        </Select>
        <Input label="Après (minutes)" name="afterMinutes" type="number" step="0.5" min={0.5} max={120} defaultValue={rule ? rule.afterSeconds / 60 : 5} error={errors.afterMinutes} />
        <Select label="Type de demande concerné" name="requestTypeId" defaultValue={rule?.requestTypeId ?? ''}>
          <option value="">Tous les types</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </Select>
        <Checkbox label="Règle active" name="isActive" defaultChecked={rule?.isActive ?? true} />
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            {rule ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
