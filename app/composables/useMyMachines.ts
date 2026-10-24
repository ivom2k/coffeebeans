import type { MyMachine, MyMachineInput } from '#shared/types/machine';

// The signed-in user's machines, fetched only in the browser: they are per-user, and the
// pages around them are cached for every visitor.
const key = 'my-machines';

// Loads the list. Call it once per screen, where the list is shown: each call fetches again
// when its component mounts.
export const useMyMachines = () => {
  const { data, status } = useFetch('/api/me/machines', {
    key,
    server: false,
    // Calls made while a request runs share it instead of restarting it.
    dedupe: 'defer',
    default: (): MyMachine[] => [],
  });
  return { machines: readonly(data), status: readonly(status) };
};

// Changes to the list. They update the loaded copy in place rather than fetching it again,
// so a component can use them without triggering a reload.
export const useMyMachineActions = () => {
  const { data } = useNuxtData<MyMachine[]>(key);
  const current = () => data.value ?? [];

  const add = async (input: MyMachineInput): Promise<MyMachine> => {
    const machine = await $fetch('/api/me/machines', { method: 'POST', body: input });
    data.value = [...current(), machine];
    return machine;
  };

  const rename = async (id: number, nickname: string): Promise<void> => {
    const saved = await $fetch(`/api/me/machines/${id}`, { method: 'PATCH', body: { nickname } });
    data.value = current().map(machine => (machine.id === id ? { ...machine, nickname: saved.nickname } : machine));
  };

  const remove = async (id: number): Promise<void> => {
    await $fetch(`/api/me/machines/${id}`, { method: 'DELETE' });
    data.value = current().filter(machine => machine.id !== id);
  };

  return { add, rename, remove };
};
