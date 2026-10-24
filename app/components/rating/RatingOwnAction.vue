<script setup lang="ts">
// The signed-in half of RatingAction: the user's own rating once there is one, otherwise the
// way to the rating form. A separate component so the fetch runs only for a signed-in user.
const props = defineProps<{ slug: string; label: string; outline: boolean }>();

const localePath = useLocalePath();
const { rating, status } = useMyRating(() => props.slug);
</script>

<template>
  <RatingYourRating
    v-if="rating"
    :rating="rating"
    :slug="slug"
  />
  <UButton
    v-else-if="status === 'success' || status === 'error'"
    :to="localePath(`/kohv/${slug}/hinda`)"
    :label="label"
    :color="outline ? 'neutral' : 'primary'"
    :variant="outline ? 'outline' : 'solid'"
    size="xl"
    block
    class="h-13 text-[17px]"
  />
  <div
    v-else
    class="h-13"
  />
</template>
