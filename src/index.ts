import delay from '@se-oss/delay';
import { Abort } from 'abort-signal';

import type { AnyFunction, Options, ThrottledFunction } from './typings';
import { createDelayCalculator, updateTickRecord } from './utils/delay';
import { createThrottleState } from './utils/state';

const validateOptions = (options: Options): void => {
  if (!Number.isFinite(options.limit)) {
    throw new TypeError('Expected `limit` to be a finite number');
  }

  if (!Number.isFinite(options.interval)) {
    throw new TypeError('Expected `interval` to be a finite number');
  }

  if (options.limit < 0) {
    throw new TypeError('Expected `limit` to be >= 0');
  }

  if (options.interval < 0) {
    throw new TypeError('Expected `interval` to be >= 0');
  }

  if (options.weight !== undefined && typeof options.weight !== 'function') {
    throw new TypeError('Expected `weight` to be a function');
  }

  if (options.weight && options.interval === 0) {
    throw new TypeError('The `weight` option cannot be used with `interval` of 0');
  }
};

const defaultOptions: Options = {
  limit: 0,
  interval: 0,
  strict: false,
};

/**
 * Throttle promise-returning and async functions.
 *
 * It rate-limits function calls without discarding them, making it ideal for external API interactions where avoiding call loss is crucial.
 *
 * @param function_ - The function to be throttled.
 * @param options - The options for throttling.
 * @returns A throttled function.
 */
export const throttle = <F extends AnyFunction>(
  function_: F,
  options?: Partial<Options>
): ThrottledFunction<F> => {
  const resolvedOptions: Options = { ...defaultOptions, ...options };
  validateOptions(resolvedOptions);

  if (resolvedOptions.signal) {
    resolvedOptions.signal.throwIfAborted();
  }

  const state = createThrottleState();
  const getDelay = createDelayCalculator(state, resolvedOptions);

  const throttled = function (
    this: ThisParameterType<F>,
    ...args: Parameters<F>
  ): Promise<Awaited<ReturnType<F>>> {
    if (!throttled.isEnabled) {
      return (async () => function_.apply(this, args))() as Promise<Awaited<ReturnType<F>>>;
    }

    return new Promise((resolve, reject) => {
      let requestWeight = 1;
      if (resolvedOptions.weight) {
        try {
          requestWeight = resolvedOptions.weight(...args);
        } catch (error) {
          reject(error);
          return;
        }

        if (!Number.isFinite(requestWeight) || requestWeight < 0) {
          reject(new TypeError('Expected `weight` to be a finite non-negative number'));
          return;
        }

        if (requestWeight > resolvedOptions.limit) {
          reject(
            new TypeError(
              `Expected \`weight\` (${requestWeight}) to be <= \`limit\` (${resolvedOptions.limit})`
            )
          );
          return;
        }
      }

      const delayResult = getDelay(requestWeight);
      const waitTime = typeof delayResult === 'number' ? delayResult : delayResult.delay;
      const tickRecord = typeof delayResult === 'object' ? delayResult.tickRecord : undefined;

      const execute = (actualTime?: number) => {
        if (tickRecord) {
          updateTickRecord(state, tickRecord, !!resolvedOptions.weight, actualTime);
        }

        try {
          resolve(function_.apply(this, args) as Awaited<ReturnType<F>>);
        } catch (error) {
          reject(error);
        }
      };

      if (waitTime > 0) {
        try {
          resolvedOptions.onDelay?.(...args);
          // eslint-disable-next-line no-empty
        } catch {} // Ignore onDelay errors

        const delayPromise = delay(waitTime, {
          signal: resolvedOptions.signal,
          stats: true,
        });

        state.queue.set(delayPromise, reject);

        delayPromise
          .then(() => {
            state.queue.delete(delayPromise);
            execute(Date.now());
          })
          .catch((error) => {
            state.queue.delete(delayPromise);
            reject(error);
          });
      } else {
        execute();
      }
    });
  } as ThrottledFunction<AnyFunction>;

  throttled.isEnabled = true;

  Object.defineProperty(throttled, 'queueSize', {
    get: () => state.queue.size,
  });

  // The `registerThrottledFunction` logic is now handled by `manageLifecycle`.
  // The `setupSignal` call is replaced with the following block.
  if (resolvedOptions.signal) {
    Abort.manageLifecycle({
      signal: resolvedOptions.signal,
      target: throttled, // The throttled function is the target object
      onAbort: () => {
        // We just clear the references. Rejection is handled by the signal in `delay`.
        state.queue.clear();
        state.strictTicks.length = 0;
        state.currentTick = 0;
        state.activeWeight = 0;
      },
    });
  }

  return throttled as ThrottledFunction<F>;
};

export default throttle;
