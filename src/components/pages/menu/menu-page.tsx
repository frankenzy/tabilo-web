"use client";

import { useFeature } from "@/hooks/use-account";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ImageOff,
  ImagePlus,
  Layers,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState, type CSSProperties, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogActions,
  EmptyState,
  ErrorState,
  FormError,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import {
  fieldErrors,
  menuCategoryFormSchema,
  menuItemFormSchema,
  type MenuCategory,
  type MenuItem,
} from "@/contracts";
import { useCurrency } from "@/hooks/use-currency";
import { estKey, useEstablishmentId } from "@/hooks/use-establishment";
import { CATEGORY_ICONS } from "@/constants/menu-icons";
import { cn } from "@/lib/utils";
import { menuApi, menuImageUrl } from "@/services/api";
import { errorMessage, toHttpError } from "@/services/http";
import { useMembership } from "@/stores/auth.store";
import { toast } from "@/stores/toast.store";
import { ImageError, shrinkImage } from "@/utils/image";
import { formatMoney, parseMoney, toMajorInput } from "@/utils/money";
import {
  OptionGroupsEditor,
  type OptionGroupDraft,
} from "./options-editor";
import { SlotsEditor, slotsDraftError } from "./slots-editor";
import type { Slot } from "@/utils/slots";
import {
  BundleGroupsEditor,
  bundleGroupsError,
  type BundleGroupDraft,
} from "./bundle-editor";
import { CategoryImage } from "./category-image";
import { filterItems, NO_ITEM_FILTER, type ItemFilter } from "./menu-filter";

/** Écran « Menus » (ex-« Carte », spec 001, P1) : rubriques, articles, prix, photos, ruptures et ordre d'affichage. */

function useMenu() {
  const establishmentId = useEstablishmentId();
  return useQuery({
    queryKey: estKey(establishmentId, "menu"),
    queryFn: () => menuApi.overview(establishmentId),
  });
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
  const key = estKey(establishmentId, "menu");
  const canManage = (useMembership()?.permissions ?? []).includes(
    "menu.manage",
  );
  // Spec 034, R7 : formules comprises dans Pro.
  const bundles = useFeature("bundles");
  const { data, isPending, isError, error, refetch } = useMenu();
  const [editingCategory, setEditingCategory] = useState<
    MenuCategory | "new" | null
  >(null);
  const [archivingCategory, setArchivingCategory] =
    useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<{
    item?: MenuItem;
    categoryId: string;
    /** Spec 032 : nouvelle formule. */
    bundle?: boolean;
  } | null>(null);
  const [archivingItem, setArchivingItem] = useState<MenuItem | null>(null);
  // Recherche et filtre propres à chaque rubrique.
  const [itemFilters, setItemFilters] = useState<Record<string, ItemFilter>>(
    {},
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  /** Ordre : affichage immédiat, puis retour à l'état serveur si l'API refuse (carte modifiée ailleurs). */
  const reorder = useMutation({
    mutationFn: async (change: {
      categoryId?: string;
      ids: string[];
    }): Promise<void> => {
      if (change.categoryId)
        await menuApi.reorderItems(
          establishmentId,
          change.categoryId,
          change.ids,
        );
      else await menuApi.reorderCategories(establishmentId, change.ids);
    },
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MenuCategory[]>(key);
      queryClient.setQueryData<MenuCategory[]>(key, (current = []) => {
        if (!change.categoryId)
          return change.ids
            .map((id) => current.find((c) => c.id === id)!)
            .filter(Boolean);
        return current.map((c) =>
          c.id === change.categoryId
            ? {
                ...c,
                items: change.ids
                  .map((id) => c.items.find((i) => i.id === id)!)
                  .filter(Boolean),
              }
            : c,
        );
      });
      return { previous };
    },
    onError: (e, _change, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error("Ordre non enregistré", errorMessage(e));
    },
    onSettled: () => void invalidate(),
  });

  const toggle = useMutation({
    mutationFn: (item: MenuItem) =>
      menuApi.updateItem(establishmentId, item.id, {
        isAvailable: !item.isAvailable,
      }),
    // La case suit le clic tout de suite ; l'état serveur la corrige en cas d'échec.
    onMutate: (item) => {
      void queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MenuCategory[]>(key);
      queryClient.setQueryData<MenuCategory[]>(key, (current = []) =>
        current.map((c) => ({
          ...c,
          items: c.items.map((i) =>
            i.id === item.id ? { ...i, isAvailable: !item.isAvailable } : i,
          ),
        })),
      );
      return { previous };
    },
    onSuccess: (updated) => {
      toast.success(
        updated.isAvailable
          ? `« ${updated.name} » est de nouveau disponible`
          : `« ${updated.name} » est en rupture`,
      );
    },
    onError: (e, _item, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error("Modification impossible", errorMessage(e));
    },
    onSettled: () => void invalidate(),
  });

  const archiveCategory = useMutation({
    mutationFn: (id: string) => menuApi.archiveCategory(establishmentId, id),
    onSuccess: () => {
      toast.success("Rubrique supprimée");
      setArchivingCategory(null);
      void invalidate();
    },
    onError: (e) => toast.error("Suppression impossible", errorMessage(e)),
  });

  const archiveItem = useMutation({
    mutationFn: (id: string) => menuApi.archiveItem(establishmentId, id),
    onSuccess: () => {
      toast.success("Article retiré de la carte");
      setArchivingItem(null);
      void invalidate();
    },
    onError: (e) => toast.error("Suppression impossible", errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Menus"
        description={
          canManage
            ? "Ce que vos clients voient et commandent depuis leur table."
            : "La carte proposée aux clients."
        }
        actions={
          canManage && data && data.length > 0 ? (
            <Button onClick={() => setEditingCategory("new")}>
              <Plus className="size-4" aria-hidden />
              Nouvelle rubrique
            </Button>
          ) : undefined
        }
      />
      {isPending ? (
        <Spinner />
      ) : isError ? (
        <ErrorState
          message={errorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" aria-hidden />}
          title="Votre carte est vide"
          description={
            canManage
              ? "Créez une première rubrique (Plats, Boissons…), puis ajoutez-y vos articles."
              : "Le gérant n’a pas encore créé la carte."
          }
          action={
            canManage ? (
              <Button onClick={() => setEditingCategory("new")}>
                <Plus className="size-4" aria-hidden />
                Créer une rubrique
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {data.map((category, index) => (
            <Card
              key={category.id}
              className="stagger animate-item-in overflow-hidden"
              style={{ "--i": index } as CSSProperties}
            >
              {(() => {
                const filter = itemFilters[category.id] ?? NO_ITEM_FILTER;
                const visible = filterItems(category.items, filter);
                const filtering =
                  filter.query.trim() !== "" || filter.availability !== "all";
                const setFilter = (patch: Partial<ItemFilter>) =>
                  setItemFilters((current) => ({
                    ...current,
                    [category.id]: { ...filter, ...patch },
                  }));
                return (
                  <>
                    {/* En-tête isolé de la rubrique, sur une seule ligne : identité à gauche, outils et actions à droite. */}
                    <header className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-line bg-sunken/60 px-4 py-3">
                      <h2 className="flex min-w-[6rem] flex-1 items-center gap-2.5 text-[15px] font-semibold text-ink">
                        <CategoryImage
                          icon={category.icon}
                          imageId={category.imageId}
                          name=""
                          className="size-9 shrink-0 rounded-lg"
                        />
                        <span className="min-w-0">
                          <span className="block truncate">
                            {category.name}
                          </span>
                          <span className="tabular block text-[12px] font-normal text-ink-3">
                            {filtering ? `${visible.length} / ` : ""}
                            {category.items.length} article
                            {category.items.length > 1 ? "s" : ""}
                          </span>
                        </span>
                      </h2>
                      <div className="flex w-full flex-wrap items-center justify-start gap-1 sm:w-auto sm:justify-end">
                        {/* Groupe outils : ajout, recherche, filtre (toujours ensemble). */}
                        <div className="flex items-center gap-1">
                          {canManage && (
                            <AddItemButton
                              onClick={() =>
                                setEditingItem({ categoryId: category.id })
                              }
                            />
                          )}
                          {canManage && (
                            // Spec 032, P1 : « Nouvelle formule » dans la rubrique ; spec 034, R7 : cadenas hors Pro.
                            <button
                              type="button"
                              onClick={() =>
                                bundles
                                  ? setEditingItem({
                                      categoryId: category.id,
                                      bundle: true,
                                    })
                                  : toast.error(
                                      "Les formules sont comprises dans Pro",
                                      "Voyez la page « Abonnement ».",
                                    )
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink ring-1 ring-line hover:bg-sunken"
                              title="Nouvelle formule : un plat, une boisson, un prix"
                            >
                              {bundles ? (
                                <Layers className="size-4" aria-hidden />
                              ) : (
                                <Lock className="size-4" aria-hidden />
                              )}
                              Formule
                            </button>
                          )}
                          {/* Recherche : une loupe qui s'ouvre en champ au clic, et reste ouverte tant qu'elle contient un texte. */}
                          <label className="relative">
                            <span className="sr-only">
                              Rechercher dans {category.name}
                            </span>
                            <Search
                              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-2"
                              aria-hidden
                            />
                            <input
                              type="search"
                              value={filter.query}
                              onChange={(event) =>
                                setFilter({ query: event.target.value })
                              }
                              placeholder="Rechercher…"
                              className="peer h-9 w-9 cursor-pointer rounded-full bg-surface pr-2 pl-8 text-[13px] text-ink ring-1 ring-line transition-[width,box-shadow] duration-[420ms] ease-apple outline-none placeholder:text-transparent focus:w-24 focus:cursor-text sm:focus:w-40 focus:pr-8 focus:ring-2 focus:ring-brand focus:placeholder:text-ink-3 [&:not(:placeholder-shown)]:w-24 sm:[&:not(:placeholder-shown)]:w-40 [&:not(:placeholder-shown)]:pr-8 [&::-webkit-search-cancel-button]:hidden"
                            />
                            {filter.query && (
                              <button
                                type="button"
                                onClick={() => setFilter({ query: "" })}
                                className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 animate-pop-in place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
                                aria-label={`Vider la recherche dans ${category.name}`}
                              >
                                <X className="size-3.5" aria-hidden />
                              </button>
                            )}
                          </label>
                          <label className="relative">
                            <span className="sr-only">
                              Disponibilité dans {category.name}
                            </span>
                            <select
                              value={filter.availability}
                              onChange={(event) =>
                                setFilter({
                                  availability: event.target
                                    .value as ItemFilter["availability"],
                                })
                              }
                              className={cn(
                                "h-9 w-[5.75rem] appearance-none truncate rounded-full pr-6 pl-3 text-[13px] font-medium ring-1 outline-none transition-colors duration-300 ease-apple focus:ring-2 focus:ring-brand",
                                filter.availability === "all"
                                  ? "bg-surface text-ink ring-line"
                                  : "bg-ink text-white ring-ink",
                              )}
                            >
                              <option value="all">Tous</option>
                              <option value="available">Disponibles</option>
                              <option value="soldout">Épuisés</option>
                            </select>
                            <ChevronDown
                              className={cn(
                                "pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2",
                                filter.availability === "all"
                                  ? "text-ink-2"
                                  : "text-white",
                              )}
                              aria-hidden
                            />
                          </label>
                        </div>
                        {canManage && (
                          // Groupe actions de la rubrique : passe à la ligne d'un bloc sur téléphone.
                          <div className="flex items-center gap-1">
                            <span
                              className="mx-0.5 hidden h-6 w-px bg-line sm:block"
                              aria-hidden
                            />
                            <MoveButtons
                              label={`la rubrique ${category.name}`}
                              first={index === 0}
                              last={index === data.length - 1}
                              disabled={reorder.isPending}
                              onMove={(step) =>
                                reorder.mutate({
                                  ids: moved(data, index, step).map(
                                    (c) => c.id,
                                  ),
                                })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2"
                              onClick={() => setEditingCategory(category)}
                              aria-label={`Modifier la rubrique ${category.name}`}
                              title="Modifier la rubrique"
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2"
                              onClick={() => setArchivingCategory(category)}
                              aria-label={`Supprimer la rubrique ${category.name}`}
                              title="Supprimer la rubrique"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        )}
                      </div>
                    </header>
                    {category.items.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-ink-2">
                        Aucun article. Une rubrique vide n’est pas montrée aux
                        clients.
                      </p>
                    ) : visible.length === 0 ? (
                      <div className="flex animate-fade-in flex-col items-center gap-2 px-4 py-8 text-center text-sm text-ink-2">
                        Aucun article ne correspond.
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilter(NO_ITEM_FILTER)}
                        >
                          Effacer la recherche
                        </Button>
                      </div>
                    ) : (
                      <ul className="divide-y divide-line">
                        {visible.map((item) => {
                          const itemIndex = category.items.indexOf(item);
                          return (
                            <ItemRow
                              key={item.id}
                              item={item}
                              canManage={canManage}
                              first={itemIndex === 0}
                              last={itemIndex === category.items.length - 1}
                              // Pas de réordonnancement sur une liste filtrée : l'ordre se règle sur la rubrique entière.
                              busy={reorder.isPending || filtering}
                              onMove={(step) =>
                                reorder.mutate({
                                  categoryId: category.id,
                                  ids: moved(
                                    category.items,
                                    itemIndex,
                                    step,
                                  ).map((i) => i.id),
                                })
                              }
                              onToggle={() => toggle.mutate(item)}
                              onEdit={() =>
                                setEditingItem({
                                  item,
                                  categoryId: category.id,
                                })
                              }
                              onArchive={() => setArchivingItem(item)}
                            />
                          );
                        })}
                      </ul>
                    )}
                  </>
                );
              })()}
            </Card>
          ))}
        </div>
      )}

      {editingCategory && (
        <CategoryDialog
          category={editingCategory === "new" ? undefined : editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => void invalidate()}
        />
      )}
      {editingItem && data && (
        <ItemDialog
          item={editingItem.item}
          bundle={editingItem.bundle || editingItem.item?.isBundle}
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

function MoveButtons({
  label,
  first,
  last,
  disabled,
  onMove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onMove: (step: -1 | 1) => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="px-2"
        disabled={first || disabled}
        onClick={() => onMove(-1)}
        aria-label={`Monter ${label}`}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-2"
        disabled={last || disabled}
        onClick={() => onMove(1)}
        aria-label={`Descendre ${label}`}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
    </>
  );
}

/**
 * « Ajouter un article » : bouton rouge bien visible en haut de chaque rubrique.
 * Au survol il se soulève et le « + » pivote ; à l'appui il s'enfonce (mouvements façon Apple).
 */
function AddItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ajouter un article"
      title="Ajouter un article"
      className="group inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-late pr-3.5 pl-1.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_8px_20px_-8px_rgb(217_45_32/0.7)] transition-[transform,box-shadow,background-color] duration-300 ease-spring hover:-translate-y-0.5 hover:bg-[#c4261b] hover:shadow-[0_12px_24px_-8px_rgb(217_45_32/0.75)] focus-visible:ring-2 focus-visible:ring-late focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0 active:scale-95"
    >
      <span
        className="grid size-6 place-items-center rounded-full bg-white/20 transition-transform duration-500 ease-spring group-hover:rotate-90"
        aria-hidden
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </span>
      Ajouter
    </button>
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

function ItemRow({
  item,
  canManage,
  first,
  last,
  busy,
  onMove,
  onToggle,
  onEdit,
  onArchive,
}: ItemRowProps) {
  const currency = useCurrency();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Thumbnail imageId={item.imageId} name={item.name} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "flex flex-wrap items-center gap-2 text-sm font-medium",
            item.isAvailable ? "text-ink" : "text-ink-3",
          )}
        >
          {item.name}
          {item.isBundle && (
            <Badge tone="progress">
              Formule · {item.groups.map((group) => group.name).join(" + ")}
            </Badge>
          )}
          {item.promoPriceMinor != null && (
            <Badge tone="late">
              Promo · {formatMoney(item.promoPriceMinor, currency)}
            </Badge>
          )}
          {!item.isAvailable && <Badge tone="late">Épuisé</Badge>}
        </p>
        {item.description && (
          <p className="truncate text-[13px] text-ink-2">{item.description}</p>
        )}
        <p className="tabular mt-0.5 text-sm text-ink">
          {formatMoney(item.priceMinor, currency)}
        </p>
      </div>
      {canManage && (
        <div className="ml-auto flex items-center justify-end gap-1">
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              checked={item.isAvailable}
              onChange={onToggle}
            />
            Disponible
          </label>
          <MoveButtons
            label={item.name}
            first={first}
            last={last}
            disabled={busy}
            onMove={onMove}
          />
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={onArchive}
            aria-label={`Retirer ${item.name} de la carte`}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

function Thumbnail({
  imageId,
  name,
  size = "size-14",
}: {
  imageId: string | null;
  name: string;
  size?: string;
}) {
  if (!imageId) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg bg-sunken text-ink-3",
          size,
        )}
      >
        <ImageOff className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, déjà réduite
    <img
      src={menuImageUrl(imageId)}
      alt={name}
      loading="lazy"
      className={cn("shrink-0 rounded-lg object-cover", size)}
    />
  );
}

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category?: MenuCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const establishmentId = useEstablishmentId();
  const [error, setError] = useState<string>();
  const [icon, setIcon] = useState(category?.icon ?? "utensils");
  // Photo : null = inchangée ; 'remove' = à retirer ; sinon la photo réduite à envoyer.
  const [photo, setPhoto] = useState<
    { mime: string; data: string } | "remove" | null
  >(null);
  const [photoError, setPhotoError] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const save = useMutation({
    mutationFn: async (name: string) => {
      const saved = category
        ? await menuApi.updateCategory(establishmentId, category.id, {
            name,
            icon,
          })
        : await menuApi.createCategory(establishmentId, { name, icon });
      if (photo === "remove" && category?.imageId)
        await menuApi.removeCategoryImage(establishmentId, saved.id);
      else if (photo && photo !== "remove")
        await menuApi.setCategoryImage(establishmentId, saved.id, photo);
      return saved;
    },
    onSuccess: () => {
      toast.success(category ? "Rubrique modifiée" : "Rubrique créée");
      onSaved();
      onClose();
    },
    onError: () => onSaved(),
  });

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoError(undefined);
    setPreparing(true);
    try {
      setPhoto(await shrinkImage(file));
    } catch (e) {
      setPhotoError(e instanceof ImageError ? e.message : "Photo illisible.");
    } finally {
      setPreparing(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = menuCategoryFormSchema.safeParse({
      name: new FormData(event.currentTarget).get("name"),
    });
    if (!parsed.success) return setError(fieldErrors(parsed.error).name);
    setError(undefined);
    save.mutate(parsed.data.name);
  }

  const previewSrc =
    photo && photo !== "remove"
      ? `data:${photo.mime};base64,${photo.data}`
      : photo === "remove"
        ? null
        : category?.imageId
          ? menuImageUrl(category.imageId)
          : null;
  const saveError = save.isError
    ? (IMAGE_ERRORS[toHttpError(save.error).code] ?? errorMessage(save.error))
    : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !save.isPending && onClose()}
      title={category ? "Modifier la rubrique" : "Nouvelle rubrique"}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label="Nom"
          name="name"
          defaultValue={category?.name}
          placeholder="Ex. : Boissons"
          error={error}
          autoFocus
          maxLength={40}
        />
        <fieldset>
          <legend className="text-[13px] font-medium text-ink">
            Image vue par les clients
          </legend>
          <p className="mt-0.5 mb-2 text-[13px] text-ink-3">
            Beaucoup de clients choisissent par l’image : prenez un pictogramme
            clair, ou une photo.
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {CATEGORY_ICONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={icon === key}
                aria-label={label}
                title={label}
                onClick={() => setIcon(key)}
                className={cn(
                  "grid aspect-square place-items-center rounded-lg ring-1 ring-inset",
                  icon === key
                    ? "bg-ink text-white ring-ink"
                    : "bg-surface text-ink-2 ring-line hover:bg-sunken",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou image de l'API
              <img
                src={previewSrc}
                alt="Aperçu de la rubrique"
                className="size-14 rounded-xl object-cover"
              />
            ) : (
              <CategoryImage
                icon={icon}
                imageId={null}
                name="Aperçu de la rubrique"
                className="size-14 rounded-xl"
              />
            )}
            <div className="flex flex-col items-start gap-1">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-medium text-ink ring-1 ring-line ring-inset hover:bg-sunken">
                <ImagePlus className="size-4" aria-hidden />
                {preparing
                  ? "Préparation…"
                  : previewSrc
                    ? "Changer la photo"
                    : "Utiliser une photo à la place"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => void pick(e.target.files?.[0])}
                  disabled={preparing}
                />
              </label>
              {previewSrc && (
                <button
                  type="button"
                  className="text-[13px] text-ink-3 underline underline-offset-4 hover:text-ink"
                  onClick={() => setPhoto(category?.imageId ? "remove" : null)}
                >
                  Revenir au pictogramme
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
        <FormError message={saveError} />
        <DialogActions>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={save.isPending}
          >
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending} disabled={preparing}>
            {category ? "Enregistrer" : "Créer"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

const IMAGE_ERRORS: Record<string, string> = {
  IMAGE_TOO_LARGE: "La photo dépasse 300 Ko.",
  IMAGE_INVALID: "Ce fichier n’est pas une image valide.",
  IMAGE_TYPE_UNSUPPORTED: "Format accepté : JPEG, PNG ou WebP.",
};

interface ItemDialogProps {
  item?: MenuItem;
  /** Spec 032 : l'article est une formule (création ou modification). */
  bundle?: boolean;
  categoryId: string;
  categories: MenuCategory[];
  onClose: () => void;
  onSaved: () => void;
}

function ItemDialog({
  item,
  bundle = false,
  categoryId,
  categories,
  onClose,
  onSaved,
}: ItemDialogProps) {
  const establishmentId = useEstablishmentId();
  const currency = useCurrency();
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Spec 032 : rubriques de la formule, deux par défaut (Plat, Boisson).
  // Spec 033, R1 : promotion active et son prix ; spec 034, R4 : comprise dans Pro.
  const promotions = useFeature("promotions");
  const [promo, setPromo] = useState(item?.promoPriceMinor != null);
  // Spec 039 : créneaux de la promotion (vide = permanente) et de disponibilité (vide = toujours).
  const [promoSlots, setPromoSlots] = useState<Slot[]>(item?.promoSlots ?? []);
  const [availabilitySlots, setAvailabilitySlots] = useState<Slot[]>(
    item?.availabilitySlots ?? [],
  );
  // Spec 038 : options et suppléments (plats seulement, module de Pro).
  const optionsAllowed = useFeature("options");
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>(() =>
    (item?.optionGroups ?? []).map((group) => ({
      key: group.id,
      name: group.name,
      multiple: group.multiple,
      required: group.required,
      options: group.options.map((option) => ({
        key: option.id,
        id: option.id,
        name: option.name,
        price: toMajorInput(option.priceMinor, currency),
        isAvailable: option.isAvailable,
      })),
    })),
  );
  const [groups, setGroups] = useState<BundleGroupDraft[]>(() =>
    item?.isBundle
      ? item.groups.map((group) => ({ key: group.id, name: group.name, choiceIds: group.choiceIds }))
      : [
          { key: "plat", name: "Plat", choiceIds: [] },
          { key: "boisson", name: "Boisson", choiceIds: [] },
        ],
  );
  // Photo : null = inchangée ; 'remove' = à retirer ; sinon la photo réduite à envoyer.
  const [photo, setPhoto] = useState<
    { mime: string; data: string } | "remove" | null
  >(null);
  const [photoError, setPhotoError] = useState<string>();
  const [preparing, setPreparing] = useState(false);

  const save = useMutation({
    mutationFn: async (body: Parameters<typeof menuApi.createItem>[1]) => {
      const saved = item
        ? await menuApi.updateItem(establishmentId, item.id, body)
        : await menuApi.createItem(establishmentId, body);
      if (photo === "remove" && item?.imageId)
        await menuApi.removeImage(establishmentId, saved.id);
      else if (photo && photo !== "remove")
        await menuApi.setImage(establishmentId, saved.id, photo);
      return saved;
    },
    onSuccess: () => {
      toast.success(
        bundle
          ? item
            ? "Formule modifiée"
            : "Formule ajoutée"
          : item
            ? "Article modifié"
            : "Article ajouté",
      );
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
      setPhotoError(e instanceof ImageError ? e.message : "Photo illisible.");
    } finally {
      setPreparing(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = menuItemFormSchema.safeParse({
      categoryId: form.get("categoryId"),
      name: form.get("name"),
      description: form.get("description") ?? "",
      price: form.get("price"),
      isAvailable: form.get("isAvailable") === "on",
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const priceMinor = parseMoney(parsed.data.price, currency);
    if (priceMinor === null) return setErrors({ price: "Prix invalide." });
    const groupsError = bundle ? bundleGroupsError(groups) : null;
    if (groupsError) return setErrors({ groups: groupsError });
    // Spec 038 et 039 : contrôles des options et des créneaux, comme l'API.
    const slotsError =
      slotsDraftError(promoSlots) ?? slotsDraftError(availabilitySlots);
    if (slotsError) return setErrors({ slots: slotsError });
    const options = [];
    for (const group of optionGroups) {
      if (!group.name.trim() || group.options.length < 2)
        return setErrors({
          options: "Chaque groupe a un nom et au moins deux options.",
        });
      const parsedOptions = [];
      for (const option of group.options) {
        const priceMinor = parseMoney(option.price || "0", currency);
        if (!option.name.trim() || priceMinor === null)
          return setErrors({
            options: `Vérifiez les options de « ${group.name} » (nom et supplément).`,
          });
        parsedOptions.push({
          ...(option.id ? { id: option.id } : {}),
          name: option.name.trim(),
          priceMinor,
          isAvailable: option.isAvailable,
        });
      }
      options.push({
        name: group.name.trim(),
        multiple: group.multiple,
        required: group.required,
        options: parsedOptions,
      });
    }
    let promoPriceMinor: number | null = null;
    if (promo) {
      promoPriceMinor = parseMoney(String(form.get("promoPrice") ?? ""), currency);
      if (promoPriceMinor === null) return setErrors({ promoPrice: "Prix promotionnel invalide." });
      if (promoPriceMinor >= priceMinor) return setErrors({ promoPrice: "Le prix promotionnel doit être inférieur au prix." });
    }
    setErrors({});
    const { categoryId, name, description, isAvailable } = parsed.data;
    save.mutate({
      categoryId,
      name,
      description: description || null,
      priceMinor,
      isAvailable,
      ...(promo || item?.promoPriceMinor != null ? { promoPriceMinor } : {}),
      ...(promo
        ? {
            promoSlots: promoSlots.length > 0 ? promoSlots : null,
            promoName: String(form.get("promoName") ?? "").trim() || null,
          }
        : item?.promoSlots
          ? { promoSlots: null }
          : {}),
      ...(availabilitySlots.length > 0 || item?.availabilitySlots
        ? {
            availabilitySlots:
              availabilitySlots.length > 0 ? availabilitySlots : null,
          }
        : {}),
      ...(!bundle && (options.length > 0 || (item?.optionGroups.length ?? 0) > 0)
        ? { optionGroups: options }
        : {}),
      ...(bundle
        ? {
            groups: groups.map((group) => ({
              name: group.name.trim(),
              choiceIds: group.choiceIds,
            })),
          }
        : {}),
    });
  }

  const previewSrc =
    photo && photo !== "remove"
      ? `data:${photo.mime};base64,${photo.data}`
      : photo === "remove"
        ? null
        : item?.imageId
          ? menuImageUrl(item.imageId)
          : null;
  const saveError = save.isError
    ? (IMAGE_ERRORS[toHttpError(save.error).code] ?? errorMessage(save.error))
    : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !save.isPending && onClose()}
      title={
        bundle
          ? item
            ? "Modifier la formule"
            : "Nouvelle formule"
          : item
            ? "Modifier l’article"
            : "Nouvel article"
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label="Nom"
          name="name"
          defaultValue={item?.name}
          placeholder={bundle ? "Ex. : Menu midi" : "Ex. : Garba"}
          error={errors.name}
          autoFocus
          maxLength={60}
        />
        <Textarea
          label="Description (facultatif)"
          name="description"
          defaultValue={item?.description ?? ""}
          error={errors.description}
          rows={2}
          maxLength={200}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Prix (${currency})`}
            name="price"
            inputMode="decimal"
            defaultValue={item ? toMajorInput(item.priceMinor, currency) : ""}
            error={errors.price}
            placeholder={currency === "XOF" ? "1500" : "8,50"}
          />
          <Select
            label="Rubrique"
            name="categoryId"
            defaultValue={categoryId}
            error={errors.categoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">
            Photo (facultatif)
          </legend>
          <div className="flex items-center gap-3">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou image de l'API
              <img
                src={previewSrc}
                alt="Aperçu"
                className="size-16 rounded-lg object-cover"
              />
            ) : (
              <span className="grid size-16 place-items-center rounded-lg bg-sunken text-ink-3">
                <ImageOff className="size-5" aria-hidden />
              </span>
            )}
            <div className="flex flex-col items-start gap-1">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-medium text-ink ring-1 ring-line ring-inset hover:bg-sunken">
                <ImagePlus className="size-4" aria-hidden />
                {preparing
                  ? "Préparation…"
                  : previewSrc
                    ? "Changer la photo"
                    : "Choisir une photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => void pick(e.target.files?.[0])}
                  disabled={preparing}
                />
              </label>
              {previewSrc && (
                <button
                  type="button"
                  className="text-[13px] text-ink-3 underline underline-offset-4 hover:text-ink"
                  onClick={() => setPhoto(item?.imageId ? "remove" : null)}
                >
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
        {bundle && (
          <div>
            <BundleGroupsEditor
              groups={groups}
              categories={categories}
              excludeId={item?.id}
              onChange={setGroups}
            />
            {errors.groups && (
              <p role="alert" className="mt-1.5 text-[13px] text-late">
                {errors.groups}
              </p>
            )}
          </div>
        )}
        {/* Spec 033, P1 : prix promotionnel, ancien prix barré chez le client. */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <input
              type="checkbox"
              checked={promo}
              disabled={!promotions && !promo}
              onChange={(event) => setPromo(event.target.checked)}
              className="size-4 accent-[var(--color-late)]"
            />
            Promotion
            {!promotions && (
              <span className="inline-flex items-center gap-1 text-[12px] font-normal text-ink-3">
                <Lock className="size-3" aria-hidden />
                Avec Pro
              </span>
            )}
          </label>
          {promo && (
            <Input
              label={`Prix promotionnel (${currency})`}
              name="promoPrice"
              inputMode="decimal"
              defaultValue={item?.promoPriceMinor != null ? toMajorInput(item.promoPriceMinor, currency) : ""}
              error={errors.promoPrice}
              hint="Le client voit l’ancien prix barré. Décochez pour finir la promotion."
            />
          )}
          {promo && (
            // Spec 039, P1 : promotion programmée (happy hour).
            <>
              <Input
                label="Nom de la promotion (facultatif)"
                name="promoName"
                defaultValue={item?.promoName ?? ""}
                placeholder="Happy hour"
                maxLength={30}
              />
              <SlotsEditor
                label="Créneaux de la promotion (aucun = toute la journée)"
                slots={promoSlots}
                onChange={setPromoSlots}
              />
            </>
          )}
        </div>
        {promotions && (
          // Spec 039, P2 : disponible seulement à certaines heures.
          <SlotsEditor
            label="Disponible seulement à certaines heures (aucun créneau = toujours)"
            slots={availabilitySlots}
            onChange={setAvailabilitySlots}
          />
        )}
        {errors.slots && (
          <p role="alert" className="text-[13px] text-late">
            {errors.slots}
          </p>
        )}
        {!bundle &&
          (optionsAllowed ? (
            <div>
              <OptionGroupsEditor
                groups={optionGroups}
                currency={currency}
                onChange={setOptionGroups}
              />
              {errors.options && (
                <p role="alert" className="mt-1.5 text-[13px] text-late">
                  {errors.options}
                </p>
              )}
            </div>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
              <Lock className="size-3.5" aria-hidden />
              Options et suppléments : avec la formule Pro
            </p>
          ))}
        <Checkbox
          label="Disponible"
          hint="Décochez en cas de rupture : l’article reste affiché, mais ne peut plus être commandé."
          name="isAvailable"
          defaultChecked={item?.isAvailable ?? true}
        />
        <FormError message={saveError} />
        <DialogActions>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={save.isPending}
          >
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending} disabled={preparing}>
            {item ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
