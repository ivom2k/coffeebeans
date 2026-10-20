<script setup lang="ts">
import type { MachineIssueFlag } from '#shared/types/coffee';

defineProps<{ flag: MachineIssueFlag }>();
</script>

<template>
  <UBadge
    color="warning"
    variant="soft"
    class="rounded-full"
    :label="$t('coffee.issueBadge', { withIssues: flag.withIssues, answered: flag.answered })"
  />
</template>
