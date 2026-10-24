import type { MaybeRefOrGetter } from 'vue';
import type { MyRating, RatingInput } from '#shared/types/rating';

// The signed-in user's own rating of one coffee, private note included, fetched in the browser
// only. The pages around it are cached, and Nitro renders a cached page without the visitor's
// cookie, so a fetch during server rendering would fail and the failure would be cached too.
export const useMyRating = (slug: MaybeRefOrGetter<string>) => {
  const { data, status } = useFetch(() => `/api/me/ratings/${encodeURIComponent(toValue(slug))}`, { server: false });

  const save = async (input: RatingInput): Promise<MyRating> => {
    const saved = await $fetch(`/api/me/ratings/${encodeURIComponent(toValue(slug))}`, { method: 'PUT', body: input });
    data.value = saved;
    return saved.rating;
  };

  return { rating: computed(() => data.value?.rating ?? null), status: readonly(status), save };
};
