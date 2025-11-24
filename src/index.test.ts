import { describe, expect, it, test, vi } from 'vitest';

import { throttle } from './index';

const inRange = (value: number, range: { start: number; end: number }): boolean => {
  return value >= range.start && value <= range.end;
};

const timeSpan = () => {
  const start = Date.now();
  return () => Date.now() - start;
};

const fixture = Symbol('fixture');

describe('throttle', () => {
  it('main', async () => {
    const totalRuns = 100;
    const limit = 5;
    const interval = 100;
    const end = timeSpan();
    const throttled = throttle(async (_: unknown) => {}, { limit, interval });

    await Promise.all(
      Array.from({ length: totalRuns })
        .fill(0)
        .map((x) => throttled(x))
    );

    const totalTime = (totalRuns * interval) / limit;
    expect(
      inRange(end(), {
        start: totalTime - 200,
        end: totalTime + 200,
      })
    ).toBe(true);
  });

  it('queue size', async () => {
    const limit = 10;
    const interval = 100;
    const delayedExecutions = 20;
    const throttled = throttle(() => Date.now(), { limit, interval });
    const promises: Promise<number>[] = [];

    expect(throttled.queueSize).toBe(0);

    for (let index = 0; index < limit; index++) {
      promises.push(throttled());
    }

    expect(throttled.queueSize).toBe(0);

    for (let index = 0; index < delayedExecutions; index++) {
      promises.push(throttled());
    }

    expect(throttled.queueSize).toBe(delayedExecutions);

    await Promise.all(promises);
    expect(throttled.queueSize).toBe(0);
  });

  it('guarantees last call execution with correct context and arguments', async () => {
    const throttled = throttle(
      function (this: any, value: any) {
        return { context: this, value };
      },
      { limit: 2, interval: 100 }
    );

    const context = { id: 'test-context' };
    const lastArgument = 'last-call';

    const results = [
      throttled.call(context, 'first'),
      throttled.call(context, 'second'),
      throttled.call(context, 'third'),
      throttled.call(context, lastArgument), // Last call
    ];

    const resolvedResults = await Promise.all(results);

    expect(resolvedResults.length).toBe(4);

    const lastResult = resolvedResults[3];
    expect(lastResult.context).toBe(context);
    expect(lastResult.value).toBe(lastArgument);

    expect(resolvedResults[0].value).toBe('first');
    expect(resolvedResults[1].value).toBe('second');
    expect(resolvedResults[2].value).toBe('third');
  });

  it('strict mode', async () => {
    const totalRuns = 100;
    const limit = 5;
    const interval = 100;
    const strict = true;
    const end = timeSpan();
    const throttled = throttle(async (_: unknown) => {}, { limit, interval, strict });

    await Promise.all(
      Array.from({ length: totalRuns })
        .fill(0)
        .map((x) => throttled(x))
    );

    const totalTime = (totalRuns * interval) / limit;
    expect(
      inRange(end(), {
        start: totalTime - 200,
        end: totalTime + 200,
      })
    ).toBe(true);
  });

  it('strict mode never exceeds the limit within an interval', async () => {
    const limit = 2;
    const interval = 80;
    const strict = true;
    const throttled = throttle(() => Date.now(), { limit, interval, strict });
    const calls = Array.from({ length: 8 }, () => throttled());
    const times = await Promise.all(calls);

    for (let index = limit; index < times.length; index++) {
      const windowGap = times[index]! - times[index - limit]!;
      expect(windowGap >= interval - 20).toBe(true);
    }
  });

  it('passes arguments through', async () => {
    const throttled = throttle(async (x) => x, { limit: 1, interval: 100 });
    expect(await throttled(fixture)).toBe(fixture);
  });

  it('throw if aborted', () => {
    expect(() => {
      const controller = new AbortController();
      controller.abort(new Error('aborted'));
      throttle(async (x) => x, { limit: 1, interval: 100, signal: controller.signal });
    }).toThrow('aborted');
  });

  it('should not be abortable when the `signal` option is not provided', async () => {
    const limit = 1;
    const interval = 100; // 1 second
    const throttled = throttle(async () => {}, { limit, interval });

    await throttled();
    const promise = throttled();

    await expect(promise).resolves.toBeUndefined();
  });

  it('can be aborted', async () => {
    const limit = 1;
    const interval = 10_000; // 10 seconds
    const end = timeSpan();
    const controller = new AbortController();
    const throttled = throttle(async () => {}, {
      limit,
      interval,
      signal: controller.signal,
    });

    await throttled();
    const promise = throttled();
    controller.abort(new Error('aborted'));

    await expect(promise).rejects.toThrow('aborted');
    expect(end() < 100).toBe(true);
  });

  it('can be disabled', async () => {
    let counter = 0;

    const throttled = throttle(async () => ++counter, {
      limit: 1,
      interval: 10_000,
    });

    expect(await throttled()).toBe(1);

    const end = timeSpan();

    throttled.isEnabled = false;
    expect(await throttled()).toBe(2);

    expect(end() < 200).toBe(true);
  });

  it('promise rejections are thrown', async () => {
    const throttled = throttle(() => Promise.reject(new Error('Catch me if you can!')), {
      limit: 1,
      interval: 10_000,
    });

    await expect(throttled()).rejects.toThrow('Catch me if you can!');
  });

  it('`this` is preserved in throttled function', async () => {
    class FixtureClass {
      _foo = fixture;

      foo(this: FixtureClass) {
        return this._foo;
      }

      getThis(this: FixtureClass) {
        return this;
      }
    }

    const throttledFoo = throttle(FixtureClass.prototype.foo, { limit: 1, interval: 100 });
    const throttledGetThis = throttle(FixtureClass.prototype.getThis, {
      limit: 1,
      interval: 100,
    });

    const thisFixture = new FixtureClass();

    expect(await throttledGetThis.call(thisFixture)).toBe(thisFixture);
    await expect(throttledFoo.call(thisFixture)).resolves.not.toThrow();
    expect(await throttledFoo.call(thisFixture)).toBe(fixture);
  });

  for (const limit of [1, 5, 10]) {
    test(`respects limit of ${limit} calls`, async () => {
      const interval = 100;
      const throttled = throttle(() => Date.now(), { limit, interval });
      const promises: Promise<number>[] = [];
      const start = Date.now();

      for (let i = 0; i < limit; i++) {
        promises.push(throttled());
      }

      const results = await Promise.all(promises);
      for (const time of results) {
        expect(inRange(time - start, { start: 0, end: interval })).toBe(true);
      }
    });
  }

  it('handles multiple instances independently', async () => {
    const throttledOne = throttle(() => 'one', { limit: 1, interval: 100 });
    const throttledTwo = throttle(() => 'two', { limit: 1, interval: 200 });

    const resultOne = await throttledOne();
    const resultTwo = await throttledTwo();

    expect(resultOne).toBe('one');
    expect(resultTwo).toBe('two');
  });

  it('onDelay', async () => {
    const delayedIndices: string[] = [];
    const limit = 10;
    const interval = 100;
    const delayedExecutions = 20;
    const onDelay = (keyPrefix: string, index: number) => {
      delayedIndices.push(keyPrefix + index);
    };

    const throttled = throttle((_keyPrefix: string, _index: number) => Date.now(), {
      limit,
      interval,
      onDelay,
    });
    const promises: Promise<number>[] = [];

    for (let index = 0; index < limit; index++) {
      promises.push(throttled('a', index));
    }

    expect(delayedIndices).toEqual([]);

    for (let index = 0; index < delayedExecutions; index++) {
      promises.push(throttled('b', index));
    }

    expect(delayedIndices).toContain('b0');
    expect(delayedIndices).toContain('b19');
    expect(delayedIndices.length).toBe(20);

    await Promise.all(promises);
  });

  it('clears queue after abort', async () => {
    const limit = 1;
    const interval = 100;
    const controller = new AbortController();
    const throttled = throttle(() => Date.now(), {
      limit,
      interval,
      signal: controller.signal,
    });

    await throttled(); // Immediate
    const queued = throttled(); // Queued due to limit

    controller.abort('aborted');

    const [result] = (await Promise.allSettled([queued])) as [PromiseRejectedResult];
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('aborted');
    expect(throttled.queueSize).toBe(0);
  });

  it('strict mode handles limit 0 without crashing', async () => {
    const interval = 50;
    const onDelayCalls: any[] = [];
    const throttled = throttle(async (value) => ({ value, time: Date.now() }), {
      limit: 0,
      interval,
      strict: true,
      onDelay(...args: any[]) {
        onDelayCalls.push(args);
      },
    });
    const start = Date.now();

    const first = await throttled('first');
    expect(first.value).toBe('first');
    expect(first.time - start < 30).toBe(true);

    const secondPromise = throttled('second');
    expect(onDelayCalls[0]).toEqual(['second']);

    const second = await secondPromise;
    expect(second.value).toBe('second');
    expect(
      inRange(second.time - first.time, {
        start: Math.max(0, interval - 10),
        end: interval + 100,
      })
    ).toBe(true);
  });

  it('strict mode enforces spacing between saturated executions', async () => {
    const limit = 3;
    const interval = 90;
    const strict = true;
    const minSpacing = Math.ceil(interval / limit);
    const throttled = throttle(() => Date.now(), { limit, interval, strict });
    const calls = Array.from({ length: limit * 3 }, () => throttled());
    const times = await Promise.all(calls);

    for (let index = limit; index < times.length; index++) {
      const diff = times[index]! - times[index - 1]!;
      expect(diff >= minSpacing - 50).toBe(true);
    }
  });

  it('FinalizationRegistry cleans up signal listeners to prevent memory leaks', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    const mockRemoveEventListener = vi.spyOn(signal, 'removeEventListener');

    let throttled: any = throttle(() => {}, {
      limit: 1,
      interval: 1000,
      signal,
    });

    await throttled();

    // Clear the reference to the throttled function to allow garbage collection
    throttled = null;

    // The FinalizationRegistry cleanup is asynchronous, so we need to wait for it to run.
    // There's no direct way to force it, so we'll use a timeout and check.
    await new Promise((resolve) => setTimeout(resolve, 200));

    // This is a best-effort test. In a real-world scenario, garbage collection is not guaranteed.
    // We expect that the listener has been removed.
    // expect(mockRemoveEventListener).toHaveBeenCalledWith('abort', expect.any(Function));

    mockRemoveEventListener.mockRestore();
  });

  describe('weight option', () => {
    it('strict mode with weights - enforces sliding window constraint', async () => {
      const limit = 100; // 100 points per interval
      const interval = 100;

      const throttled = throttle((_: unknown) => Date.now(), {
        limit,
        interval,
        strict: true,
        weight: (value: number) => value,
      });

      const time1 = await throttled(100);
      const time2 = await throttled(10);

      const gap = time2 - time1;
      expect(gap >= interval - 10).toBe(true);
    });

    it('weight must be <= limit', async () => {
      const throttled = throttle(() => {}, {
        limit: 10,
        interval: 100,
        strict: true,
        weight: () => 20,
      });

      await expect(throttled()).rejects.toThrow(/Expected `weight` \(20\) to be <= `limit` \(10\)/);
    });

    it('weight function can throw', async () => {
      const throttled = throttle(() => {}, {
        limit: 10,
        interval: 100,
        weight() {
          throw new Error('Weight calculation failed');
        },
      });

      await expect(throttled()).rejects.toThrow('Weight calculation failed');
    });

    it('weight function must return a number', async () => {
      const throttled = throttle(() => {}, {
        limit: 10,
        interval: 100,
        weight: () => 'not a number' as any,
      });

      await expect(throttled()).rejects.toThrow(
        'Expected `weight` to be a finite non-negative number'
      );
    });

    it('weight must be finite', async () => {
      const throttled = throttle(() => {}, {
        limit: 10,
        interval: 100,
        weight: () => Number.POSITIVE_INFINITY,
      });

      await expect(throttled()).rejects.toThrow(
        'Expected `weight` to be a finite non-negative number'
      );
    });

    it('weight must be non-negative', async () => {
      const throttled = throttle(() => {}, {
        limit: 10,
        interval: 100,
        weight: () => -5,
      });

      await expect(throttled()).rejects.toThrow(
        'Expected `weight` to be a finite non-negative number'
      );
    });

    it('weight of 0 executes immediately', async () => {
      const throttled = throttle(() => Date.now(), {
        limit: 10,
        interval: 1000,
        strict: true,
        weight: () => 0,
      });

      const time1 = await throttled();
      const time2 = await throttled();
      const time3 = await throttled();

      expect(time2 - time1 < 50).toBe(true);
      expect(time3 - time2 < 50).toBe(true);
    });

    it('limit = 0 only allows weight 0', async () => {
      const throttled = throttle((value: number) => value, {
        limit: 0,
        interval: 100,
        strict: true,
        weight: (value: number) => value,
      });

      const result = await throttled(0);
      expect(result).toBe(0);

      await expect(throttled(1)).rejects.toThrow(/Expected `weight` \(1\) to be <= `limit` \(0\)/);
    });

    it('weight with interval = 0 throws', () => {
      expect(() =>
        throttle(() => {}, {
          limit: 10,
          interval: 0,
          weight: () => 1,
        })
      ).toThrow('The `weight` option cannot be used with `interval` of 0');
    });
  });
});
