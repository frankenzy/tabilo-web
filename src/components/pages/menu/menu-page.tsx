'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, BookOpen, ImageOff, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  Badge, Button, Card, Checkbox, ConfirmDialog, Dialog, DialogActions, EmptyState, ErrorState, FormError, Input, PageHeader, Select,
  Spinner, Textarea,
} from '@/components/ui';
import { fieldErrors, menuCategoryFormSchema, menuItemFormSchema, type MenuCategory, type MenuItem } from '@/contracts';
import { useCurrency } from '@/hooks/use-currency';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { cn } from '@/lib/utils';
import { menuApi, menuImageUrl } from '@/services/api';
import { errorMessage, toHttpError } from '@/services/http';
import { useMembership } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { ImageError, shrinkImage } from '@/utils/image';
import { formatMoney, parseMoney, toMajorInput } from '@/utils/money';

/** Écran « Carte » (spec 001, P1) : rubriques, articles, prix, photos, ruptures et ordre d'affichage. */

function useMenu() {
  const establishmentId = useEstablishmentId();
  return useQuery({ queryKey: estKey(establishmentId, 'menu'), queryFn: () => menuApi.overview(establishmentId) });
}

/** Déplace l'élément d'index `from` d'un cran vers le haut (-1) ou le bas (+1). */
function moved<T>(list: T[], from: number, step: -1 | 1): T[] {
  const to = from + step;
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  [copy[from], copy[to]] = [copy[to], copy[from]];
  return copy;
}

export function MenuPage() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const key = estKey(establishmentId, 'menu');
  const canManage = (useMembership()?.permissions ?? []).includes('menu.manage');
  const { data, isPending, isError, error, refetch } = useMenu();
  const [editingCategory, setEditingCategory] = useState<MenuCategory | 'new' | null>(null);
  const [archivingCategory, setArchivingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<{ item?: MenuItem; categoryId: string } | null>(null);
  const [archivingItem, setArchivingItem] = useState<MenuItem | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  /** Ordre : affichage immédiat, puis retour à l'état serveur si l'API refuse (carte modifiée ailleurs). */
  const reorder = useMutation({
    mutationFn: async (change: { categoryId?: string; ids: string[] }): Promise<void> => {
      if (change.categoryId) await menuApi.reorderItems(establishmentId, change.categoryId, change.ids);
      else await menuApi.reorderCategories(establishmentId, change.ids);
    },
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MenuCategory[]>(key);
      queryClient.setQueryData<MenuCategory[]>(key, (current = []) => {
        if (!change.categoryId) return change.ids.map((id) => current.find((c) => c.id === id)!).filter(Boolean);
        return current.map((c) =>
          c.id === change.categoryId ? { ...c, items: change.ids.map((id) => c.items.find((i) => i.id === id)!).filter(Boolean) } : c,
        );
      });
      return { previous };
    },
    onError: (e, _change, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error('Ordre non enregistré', errorMessage(e));
    },
    onSettled: () => void invalidate(),
  });

  const toggle = useMutation({
    mutationFn: (item: MenuItem) => menuApi.updateItem(establishmentId, item.id, { isAvailable: !item.isAvailable }),
    // La case suit le clic tout de suite ; l'état serveur la corrige en cas d'échec.
    onMutate: (item) => {
      void queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MenuCategory[]>(key);
      queryClient.setQueryData<MenuCategory[]>(key, (current = []) =>
        current.map((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: !item.isAvailable } : i)) })),
      );
      return { previous };
    },
    onSuccess: (updated) => {
      toast.success(updated.isAvailable ? `« ${updated.name} » est de nouveau disponible` : `« ${updated.name} » est en rupture`);
    },
    onError: (e, _item, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error('Modification impossible', errorMessage(e));
    },
    onSettled: () => void invalidate(),
  });

  const archiveCategory = useMutation({
    mutationFn: (id: string) => menuApi.archiveCategory(establishmentId, id),
    onSuccess: () => {
      toast.success('Rubrique supprimée');
      setArchivingCategory(null);
      void invalidate();
    },
    onError: (e) => toast.error('Suppression impossible', errorMessage(e)),
  });

  const archiveItem = useMutation({
    mutationFn: (id: string) => menuApi.archiveItem(establishmentId, id),
    onSuccess: () => {
      toast.success('Article retiré de la carte');
      setArchivingItem(null);
      void invalidate();
    },
    onError: (e) => toast.error('Suppression impossible', errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Carte"
        description={canManage ? 'Ce que vos clients voient et commandent depuis leur table.' : 'La carte proposée aux clients.'}
        actions={
          canManage && data && data.length > 0 ? (
            <Button onClick={() => setEditingCategory('new')}>
              <Plus className="size-4" aria-hidden />
              Nouvelle rubrique
            </Button>
          ) : undefined
        }
      />
      {isPending ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" aria-hidden />}
          title="Votre carte est vide"
          description={canManage ? 'Créez une première rubrique (Plats, Boissons…), puis ajoutez-y vos articles.' : 'Le gérant n’a pas encore créé la carte.'}
          action={
            canManage ? (
              <Button onClick={() => setEditingCategory('new')}>
                <Plus className="size-4" aria-hidden />
                Créer une rubrique
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          {data.map((category, index) => (
            <Card key={category.id}>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <h2 className="text-[15px] font-semibold text-ink">
                  {category.name}
                  <span className="ml-2 text-[13px] font-normal text-ink-3">
                    {category.items.length} article{category.items.length > 1 ? 's' : ''}
                  </span>
                </h2>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <MoveButtons
                      label={`la rubrique ${category.name}`}
                      first={index === 0}
                      last={index === data.length - 1}
                      disabled={reorder.isPending}
                      onMove={(step) => reorder.mutate({ ids: moved(data, index, step).map((c) => c.id) })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setEditingCategory(category)}>
                      Renommer
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setArchivingCategory(category)} aria-label={`Supprimer la rubrique ${category.name}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                )}
              </header>
              {category.items.length === 0 ? (
                <p className="px-4 py-4 text-sm text-ink-2">Aucun article. Une rubrique vide n’est pas montrée aux clients.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {category.items.map((item, itemIndex) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      canManage={canManage}
                      first={itemIndex === 0}
                      last={itemIndex === category.items.length - 1}
                      busy={reorder.isPending}
                      onMove={(step) => reorder.mutate({ categoryId: category.id, ids: moved(category.items, itemIndex, step).map((i) => i.id) })}
                      onToggle={() => toggle.mutate(item)}
                      onEdit={() => setEditingItem({ item, categoryId: category.id })}
                      onArchive={() => setArchivingItem(item)}
                    />
                  ))}
                </ul>
              )}
              {canManage && (
                <div className="border-t border-line px-4 py-2.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditingItem({ categoryId: category.id })}>
                    <Plus className="size-4" aria-hidden />
                    Ajouter un article
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {editingCategory && (
        <CategoryDialog category={editingCategory === 'new' ? undefined : editingCategory} onClose={() => setEditingCategory(null)} onSaved={() => void invalidate()} />
      )}
      {editingItem && data && (
        <ItemDialog
          item={editingItem.item}
          categoryId={editingItem.categoryId}
          categories={data}
          onClose={() => setEditingItem(null)}
          onSaved={() => void invalidate()}
        />
      )}
      {archivingCategory && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setArchivingCategory(null)}
          title={`Supprimer la rubrique « ${archivingCategory.name} » ?`}
          description={`Ses ${archivingCategory.items.length} article(s) disparaissent aussi de la carte. Les commandes passées restent intactes.`}
          confirmLabel="Supprimer"
          danger
          loading={archiveCategory.isPending}
          onConfirm={() => archiveCategory.mutate(archivingCategory.id)}
        />
      )}
      {archivingItem && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setArchivingItem(null)}
          title={`Retirer « ${archivingItem.name} » de la carte ?`}
          description="Pour une rupture passagère, utilisez plutôt « Disponible ». Les commandes passées restent intactes."
          confirmLabel="Retirer"
          danger
          loading={archiveItem.isPending}
          onConfirm={() => archiveItem.mutate(archivingItem.id)}
        />
      )}
    </>
  );
}

function MoveButtons({ label, first, last, disabled, onMove }: { label: string; first: boolean; last: boolean; disabled: boolean; onMove: (step: -1 | 1) => void }) {
  return (
    <>
      <Button variant="ghost" size="sm" className="px-2" disabled={first || disabled} onClick={() => onMove(-1)} aria-label={`Monter ${label}`}>
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button variant="ghost" size="sm" className="px-2" disabled={last || disabled} onClick={() => onMove(1)} aria-label={`Descendre ${label}`}>
        <ArrowDown className="size-4" aria-hidden />
      </Button>
    </>
  );
}

interface ItemRowProps {
  item: MenuItem;
  canManage: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (step: -1 | 1) => void;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

function ItemRow({ item, canManage, first, last, busy, onMove, onToggle, onEdit, onArchive }: ItemRowProps) {
  const currency = useCurrency();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
      <Thumbnail imageId={item.imageId} name={item.name} />
      <div className="min-w-0 flex-1">
        <p className={cn('flex flex-wrap items-center gap-2 text-sm font-medium', item.isAvailable ? 'text-ink' : 'text-ink-3')}>
          {item.name}
          {!item.isAvailable && <Badge tone="late">Épuisé</Badge>}
        </p>
        {item.description && <p className="truncate text-[13px] text-ink-2">{item.description}</p>}
        <p className="tabular mt-0.5 text-sm text-ink">{formatMoney(item.priceMinor, currency)}</p>
      </div>
      {canManage && (
        <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" className="size-4 accent-ink" checked={item.isAvailable} onChange={onToggle} />
            Disponible
          </label>
          <MoveButtons label={item.name} first={first} last={last} disabled={busy} onMove={onMove} />
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Modifier
          </Button>
          <Button variant="ghost" size="sm" className="px-2" onClick={onArchive} aria-label={`Retirer ${item.name} de la carte`}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

function Thumbnail({ imageId, name, size = 'size-14' }: { imageId: string | null; name: string; size?: string }) {
  if (!imageId) {
    return (
      <span className={cn('grid shrink-0 place-items-center rounded-lg bg-sunken text-ink-3', size)}>
        <ImageOff className="size-4" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, déjà réduite
  return <img src={menuImageUrl(imageId)} alt={name} loading="lazy" className={cn('shrink-0 rounded-lg object-cover', size)} />;
}

function CategoryDialog({ category, onClose, onSaved }: { category?: MenuCategory; onClose: () => void; onSaved: () => void }) {
  const establishmentId = useEstablishmentId();
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: (name: string) => (category ? menuApi.renameCategory(establishmentId, category.id, name) : menuApi.createCategory(establishmentId, { name })),
    onSuccess: () => {
      toast.success(category ? 'Rubrique renommée' : 'Rubrique créée');
      onSaved();
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = menuCategoryFormSchema.safeParse({ name: new FormData(event.currentTarget).get('name') });
    if (!parsed.success) return setError(fieldErrors(parsed.error).name);
    setError(undefined);
    save.mutate(parsed.data.name);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={category ? 'Renommer la rubrique' : 'Nouvelle rubrique'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nom" name="name" defaultValue={category?.name} placeholder="Ex. : Boissons" error={error} autoFocus maxLength={40} />
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            {category ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

const IMAGE_ERRORS: Record<string, string> = {
  IMAGE_TOO_LARGE: 'La photo dépasse 300 Ko.',
  IMAGE_INVALID: 'Ce fichier n’est pas une image valide.',
  IMAGE_TYPE_UNSUPPORTED: 'Format accepté : JPEG, PNG ou WebP.',
};

interface ItemDialogProps {
  item?: MenuItem;
  categoryId: string;
  categories: MenuCategory[];
  onClose: () => void;
  onSaved: () => void;
}

function ItemDialog({ item, categoryId, categories, onClose, onSaved }: ItemDialogProps) {
  const establishmentId = useEstablishmentId();
  const currency = useCurrency();
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Photo : null = inchangée ; 'remove' = à retirer ; sinon la photo réduite à envoyer.
  const [photo, setPhoto] = useState<{ mime: string; data: string } | 'remove' | null>(null);
  const [photoError, setPhotoError] = useState<string>();
  const [preparing, setPreparing] = useState(false);

  const save = useMutation({
    mutationFn: async (body: Parameters<typeof menuApi.createItem>[1]) => {
      const saved = item ? await menuApi.updateItem(establishmentId, item.id, body) : await menuApi.createItem(establishmentId, body);
      if (photo === 'remove' && item?.imageId) await menuApi.removeImage(establishmentId, saved.id);
      else if (photo && photo !== 'remove') await menuApi.setImage(establishmentId, saved.id, photo);
      return saved;
    },
    onSuccess: () => {
      toast.success(item ? 'Article modifié' : 'Article ajouté');
      onSaved();
      onClose();
    },
    // L'article a pu être enregistré avant l'échec de la photo : on rafraîchit la carte dans tous les cas.
    onError: () => onSaved(),
  });

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoError(undefined);
    setPreparing(true);
    try {
      setPhoto(await shrinkImage(file));
    } catch (e) {
      setPhotoError(e instanceof ImageError ? e.message : 'Photo illisible.');
    } finally {
      setPreparing(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = menuItemFormSchema.safeParse({
      categoryId: form.get('categoryId'),
      name: form.get('name'),
      description: form.get('description') ?? '',
      price: form.get('price'),
      isAvailable: form.get('isAvailable') === 'on',
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const priceMinor = parseMoney(parsed.data.price, currency);
    if (priceMinor === null) return setErrors({ price: 'Prix invalide.' });
    setErrors({});
    const { categoryId, name, description, isAvailable } = parsed.data;
    save.mutate({ categoryId, name, description: description || null, priceMinor, isAvailable });
  }

  const previewSrc = photo && photo !== 'remove' ? `data:${photo.mime};base64,${photo.data}` : photo === 'remove' ? null : item?.imageId ? menuImageUrl(item.imageId) : null;
  const saveError = save.isError ? (IMAGE_ERRORS[toHttpError(save.error).code] ?? errorMessage(save.error)) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()} title={item ? 'Modifier l’article' : 'Nouvel article'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nom" name="name" defaultValue={item?.name} placeholder="Ex. : Garba" error={errors.name} autoFocus maxLength={60} />
        <Textarea label="Description (facultatif)" name="description" defaultValue={item?.description ?? ''} error={errors.description} rows={2} maxLength={200} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Prix (${currency})`}
            name="price"
            inputMode="decimal"
            defaultValue={item ? toMajorInput(item.priceMinor, currency) : ''}
            error={errors.price}
            placeholder={currency === 'XOF' ? '1500' : '8,50'}
          />
          <Select label="Rubrique" name="categoryId" defaultValue={categoryId} error={errors.categoryId}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Photo (facultatif)</legend>
          <div className="flex items-center gap-3">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou image de l'API
              <img src={previewSrc} alt="Aperçu" className="size-16 rounded-lg object-cover" />
            ) : (
              <span className="grid size-16 place-items-center rounded-lg bg-sunken text-ink-3">
                <ImageOff className="size-5" aria-hidden />
              </span>
            )}
            <div className="flex flex-col items-start gap-1">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-medium text-ink ring-1 ring-line ring-inset hover:bg-sunken">
                <ImagePlus className="size-4" aria-hidden />
                {preparing ? 'Préparation…' : previewSrc ? 'Changer la photo' : 'Choisir une photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} disabled={preparing} />
              </label>
              {previewSrc && (
                <button type="button" className="text-[13px] text-ink-3 underline underline-offset-4 hover:text-ink" onClick={() => setPhoto(item?.imageId ? 'remove' : null)}>
                  Retirer la photo
                </button>
              )}
            </div>
          </div>
          {photoError && (
            <p role="alert" className="mt-1.5 text-[13px] text-late">
              {photoError}
            </p>
          )}
        </fieldset>
        <Checkbox label="Disponible" hint="Décochez en cas de rupture : l’article reste affiché, mais ne peut plus être commandé." name="isAvailable" defaultChecked={item?.isAvailable ?? true} />
        <FormError message={saveError} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending} disabled={preparing}>
            {item ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
