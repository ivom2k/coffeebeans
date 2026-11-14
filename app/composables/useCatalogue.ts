import type {
  BrandInput, BrandOption, CatalogueCoffeeRow, CoffeeConflict, CoffeeEditorInput, CoffeeForEditing,
} from '#shared/types/catalogue';

// The admin catalogue, fetched in the browser only: the admin pages render client-side, and every
// endpoint behind them checks the role on the server.

const brandsKey = 'admin-brands';
const collator = new Intl.Collator('et');

export const useCatalogueCoffees = () => {
  const { data, status, error } = useFetch('/api/admin/coffees', {
    server: false,
    default: (): CatalogueCoffeeRow[] => [],
  });
  return { coffees: readonly(data), status: readonly(status), error: readonly(error) };
};

// Loads the brand list. The picker's "add brand" goes through useCatalogueBrandActions, which
// updates this copy in place.
export const useCatalogueBrands = () => {
  const { data, status, error } = useFetch('/api/admin/brands', {
    key: brandsKey,
    server: false,
    dedupe: 'defer',
    default: (): BrandOption[] => [],
  });
  return { brands: readonly(data), status: readonly(status), error: readonly(error) };
};

export const useCatalogueBrandActions = () => {
  const { data } = useNuxtData<BrandOption[]>(brandsKey);

  const create = async (input: BrandInput): Promise<BrandOption> => {
    const brand = await $fetch('/api/admin/brands', { method: 'POST', body: input });
    data.value = [...(data.value ?? []), brand].toSorted((a, b) => collator.compare(a.name, b.name));
    return brand;
  };

  return { create };
};

// Every country, named in the page's language and in its alphabetical order, for the pickers.
// Values are plain strings, as loaded coffees carry them; the server checks them against the list.
export const useCountryOptions = () => {
  const { countryName } = useFormatters();
  return computed(() => countryCodes
    .map((code): { label: string; value: string } => ({ label: countryName(code), value: code }))
    .toSorted((a, b) => collator.compare(a.label, b.label)));
};

export const createCatalogueCoffee = (input: CoffeeEditorInput) =>
  $fetch('/api/admin/coffees', { method: 'POST', body: input });

// One coffee in the editor. Actions update the loaded copy, so the page reflects them at once.
export const useCoffeeEditor = (id: number) => {
  const { data, status, error } = useFetch(`/api/admin/coffees/${id}`, { server: false });

  const patch = (changes: Partial<CoffeeForEditing>) => {
    if (data.value) {
      data.value = { ...data.value, ...changes };
    }
  };

  // Reloaded quietly rather than with refresh(), which would pass through 'pending' and make the
  // page swap the form for a spinner. The saved status decides whether Mustand is still offered.
  const save = async (input: CoffeeEditorInput): Promise<void> => {
    await $fetch(`/api/admin/coffees/${id}`, { method: 'PUT', body: input });
    data.value = await $fetch(`/api/admin/coffees/${id}`);
  };

  // The File itself is the body: the browser sends its bytes with the file's own content type.
  const uploadImage = async (file: File): Promise<void> => {
    const { imageUrl } = await $fetch(`/api/admin/coffees/${id}/image`, { method: 'PUT', body: file });
    patch({ imageUrl });
  };

  const removeImage = async (): Promise<void> => {
    await $fetch(`/api/admin/coffees/${id}/image`, { method: 'DELETE' });
    patch({ imageUrl: null });
  };

  const markReviewed = async (): Promise<void> => {
    const { reviewedAt } = await $fetch(`/api/admin/coffees/${id}/reviewed`, { method: 'POST' });
    patch({ reviewedAt });
  };

  return { coffee: readonly(data), status: readonly(status), error: readonly(error), save, uploadImage, removeImage, markReviewed };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// What the server put in createError's `data`: $fetch's error carries the response body as
// `data`, and the body carries ours as `data` again.
const errorData = (error: unknown): Record<string, unknown> | null =>
  isRecord(error) && isRecord(error.data) && isRecord(error.data.data) ? error.data.data : null;

export const statusCodeOf = (error: unknown): number | null =>
  isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : null;

// Why an admin request was refused, for the failures the page explains (a 409's "slugTaken", a
// 422's "unsupported"); null for any other failure.
export const failureReasonOf = (error: unknown): string | null => {
  const reason = errorData(error)?.reason;
  return typeof reason === 'string' ? reason : null;
};

// The conflicts that carry nothing but their reason.
const plainReasons = ['slugTaken', 'nameTaken', 'cannotUnpublish'] as const;
const isPlainReason = (reason: string): reason is (typeof plainReasons)[number] =>
  plainReasons.some(known => known === reason);

// A coffee save's 409, as server/utils/coffeeSaveStatus.ts sends it.
export const coffeeConflictOf = (error: unknown): CoffeeConflict | null => {
  const data = errorData(error);
  const reason = failureReasonOf(error);
  if (data === null || reason === null) {
    return null;
  }
  if (reason === 'gtinTaken') {
    return { reason, gtins: Array.isArray(data.gtins) ? data.gtins.filter(isGtinOwner) : [] };
  }
  return isPlainReason(reason) ? { reason } : null;
};

const isGtinOwner = (value: unknown): value is { gtin: string; coffeeName: string } =>
  isRecord(value) && typeof value.gtin === 'string' && typeof value.coffeeName === 'string';
