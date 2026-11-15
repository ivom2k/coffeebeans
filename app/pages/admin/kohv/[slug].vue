<script setup lang="ts">
// The admin's way from a public coffee page to its editor: the same address with `admin/` in
// front (/kohv/x becomes /admin/kohv/x). The public UI links to no admin page (decisions log
// §6), so this is typed, not clicked. The editor stays keyed by id, since the slug is one of the
// things it edits; this page only finds the id and moves on.
definePageMeta({ layout: 'admin' });

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
useSeoMeta({ title: () => t('catalogue.listTitle') });

const slug = String(route.params.slug);
// The list the admin's front page loads: it holds every coffee's slug and id, drafts included,
// so this needs no endpoint of its own. A visitor or a non-admin gets that endpoint's 401 or
// 403, which AdminLoad explains.
const { coffees, status, error } = useCatalogueCoffees();
const found = computed(() => coffees.value.find(coffee => coffee.slug === slug));

watch(found, async (coffee) => {
  if (coffee) {
    // Replaced, so Back from the editor returns to the coffee page, not to this stop on the way.
    await navigateTo(localePath(`/admin/kohvid/${coffee.id}`), { replace: true });
  }
}, { immediate: true });
</script>

<template>
  <AdminLoad
    :status="status"
    :error="error"
  >
    <!-- Found: the editor is opening. -->
    <div
      v-if="found"
      class="flex justify-center py-10"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin text-muted"
      />
    </div>
    <div
      v-else
      class="flex flex-col items-start gap-3"
    >
      <p
        role="alert"
        class="text-muted"
      >
        {{ $t('catalogue.notFound') }}
      </p>
      <UButton
        :to="localePath('/admin/kohvid')"
        :label="$t('catalogue.listTitle')"
        color="neutral"
        variant="outline"
        size="xl"
      />
    </div>
  </AdminLoad>
</template>
