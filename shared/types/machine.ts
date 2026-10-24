// What the machine endpoints return. The catalogue holds only approved models (decisions
// log §3), so it is the same for every visitor.

export type MachineKind = 'AUTOMATIC' | 'PORTAFILTER';

// A catalogue model, as every list names it: manufacturer, then model.
export type MachineModelRef = { modelId: number; manufacturerName: string; modelName: string; kind: MachineKind };

// One of the signed-in user's machines, which are what the rating form offers. Ratings point
// at the model, not at this entry, so it can be renamed or removed freely.
export type MyMachine = MachineModelRef & { id: number; nickname: string | null };

export type MyMachineInput = { machineModelId: number; nickname: string | null };
