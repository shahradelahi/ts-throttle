export interface ThrottleState {
  readonly queue: Map<NodeJS.Timeout, (reason?: unknown) => void>;
  readonly strictTicks: { time: number; weight: number }[];
  currentTick: number;
  activeWeight: number;
}

export const createThrottleState = (): ThrottleState => ({
  queue: new Map(),
  strictTicks: [],
  currentTick: 0,
  activeWeight: 0,
});
