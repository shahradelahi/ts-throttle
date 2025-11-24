import type { Options } from '../typings';
import type { ThrottleState } from './state';

const insertTickSorted = (
  strictTicks: { time: number; weight: number }[],
  tickRecord: { time: number; weight: number }
): void => {
  if (strictTicks.length === 0 || tickRecord.time >= strictTicks.at(-1)!.time) {
    strictTicks.push(tickRecord);
  } else {
    const insertIndex = strictTicks.findIndex((tick) => tick.time > tickRecord.time);
    strictTicks.splice(insertIndex, 0, tickRecord);
  }
};

const windowedDelay = (state: ThrottleState, options: Options, requestWeight: number): number => {
  const now = Date.now();

  if (now - state.currentTick > options.interval) {
    state.activeWeight = requestWeight;
    state.currentTick = now;
    return 0;
  }

  if (state.activeWeight + requestWeight <= options.limit) {
    state.activeWeight += requestWeight;
  } else {
    state.currentTick += options.interval;
    state.activeWeight = requestWeight;
  }

  return state.currentTick - now;
};

const strictDelay = (
  state: ThrottleState,
  options: Options,
  requestWeight: number
): {
  delay: number;
  tickRecord?: { time: number; weight: number };
} => {
  const now = Date.now();

  if (state.strictTicks.length > 0 && now - state.strictTicks.at(-1)!.time > options.interval) {
    state.strictTicks.length = 0;
  }

  if (options.weight) {
    while (state.strictTicks.length > 0 && now - state.strictTicks[0]!.time >= options.interval) {
      state.strictTicks.shift();
    }

    const weightInWindowAt = (time: number): number => {
      let total = 0;
      for (const tick of state.strictTicks) {
        if (tick.time <= time && time - tick.time < options.interval) {
          total += tick.weight;
        }
      }
      return total;
    };

    if (weightInWindowAt(now) + requestWeight <= options.limit) {
      const tickRecord = { time: now, weight: requestWeight };
      insertTickSorted(state.strictTicks, tickRecord);
      return { delay: 0 };
    }

    let nextExecutionTime = now;
    while (weightInWindowAt(nextExecutionTime) + requestWeight > options.limit) {
      const firstInWindow = state.strictTicks.find(
        (tick) => tick.time <= nextExecutionTime && nextExecutionTime - tick.time < options.interval
      );

      if (!firstInWindow) {
        break;
      }

      nextExecutionTime = firstInWindow.time + options.interval;
    }

    const tickRecord = { time: nextExecutionTime, weight: requestWeight };
    insertTickSorted(state.strictTicks, tickRecord);
    return { delay: Math.max(0, nextExecutionTime - now), tickRecord };
  }

  const strictCapacity = Math.max(options.limit, 1);
  if (state.strictTicks.length < strictCapacity) {
    state.strictTicks.push({ time: now, weight: requestWeight });
    return { delay: 0 };
  }

  const oldestTime = state.strictTicks[0]!.time;
  const mostRecentTime = state.strictTicks.at(-1)!.time;
  const baseTime = oldestTime + options.interval;
  const minSpacing = options.interval > 0 ? Math.ceil(options.interval / strictCapacity) : 0;
  const nextExecutionTime = baseTime <= mostRecentTime ? mostRecentTime + minSpacing : baseTime;

  state.strictTicks.shift();
  const tickRecord = { time: nextExecutionTime, weight: requestWeight };
  state.strictTicks.push(tickRecord);

  return { delay: Math.max(0, nextExecutionTime - now), tickRecord };
};

export type DelayCalculator = (requestWeight: number) =>
  | number
  | {
      delay: number;
      tickRecord?: { time: number; weight: number };
    };

export const createDelayCalculator = (state: ThrottleState, options: Options): DelayCalculator => {
  if (options.strict) {
    return (requestWeight: number) => strictDelay(state, options, requestWeight);
  }
  return (requestWeight: number) => windowedDelay(state, options, requestWeight);
};

export const updateTickRecord = (
  state: ThrottleState,
  tickRecord: { time: number; weight: number },
  isWeighted: boolean
) => {
  const actualTime = Date.now();
  if (isWeighted && tickRecord.time !== actualTime) {
    tickRecord.time = actualTime;
    const index = state.strictTicks.indexOf(tickRecord);
    if (index !== -1) {
      state.strictTicks.splice(index, 1);
      insertTickSorted(state.strictTicks, tickRecord);
    }
  } else {
    tickRecord.time = actualTime;
  }
};
