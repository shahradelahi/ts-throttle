# @se-oss/throttle

[![CI](https://github.com/shahradelahi/ts-throttle/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/shahradelahi/ts-throttle/actions/workflows/ci.yml)
[![NPM Version](https://img.shields.io/npm/v/@se-oss/throttle.svg)](https://www.npmjs.com/package/@se-oss/throttle)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](/LICENSE)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/@se-oss/throttle)
[![Install Size](https://packagephobia.com/badge?p=@se-oss/throttle)](https://packagephobia.com/result?p=@se-oss/throttle)

_@se-oss/throttle_ is a utility for rate-limiting function calls. It is designed for modern applications that require fine-grained control over asynchronous operations, offering features like strict mode, weighted throttling, and abort signals.

---

- [Installation](#-installation)
- [Usage](#-usage)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#license)

## 📦 Installation

```bash
npm install @se-oss/throttle
```

<details>
<summary>Install using your favorite package manager</summary>

**pnpm**

```bash
pnpm install @se-oss/throttle
```

**yarn**

```bash
yarn add @se-oss/throttle
```

</details>

## 📖 Usage

### Basic Throttling

Throttle a function to be called at most twice per second.

```typescript
import { throttle } from '@se-oss/throttle';

const now = Date.now();

const throttled = throttle(
  async (index: number) => {
    const secDiff = ((Date.now() - now) / 1000).toFixed();
    return `${index}: ${secDiff}s`;
  },
  {
    limit: 2,
    interval: 1000,
  }
);

for (let index = 1; index <= 6; index++) {
  (async () => {
    console.log(await throttled(index));
  })();
}
//=> 1: 0s
//=> 2: 0s
//=> 3: 1s
//=> 4: 1s
//=> 5: 2s
//=> 6: 2s
```

### Abort Signal

Abort pending executions using an `AbortSignal`.

```typescript
import { throttle } from '@se-oss/throttle';

const controller = new AbortController();

const throttled = throttle(
  () => {
    console.log('Executing...');
  },
  {
    limit: 2,
    interval: 1000,
    signal: controller.signal,
  }
);

await throttled();
await throttled();
controller.abort('aborted');
await throttled();
//=> Executing...
//=> Executing...
//=> Promise rejected with reason `aborted`
```

### onDelay

Get notified when function calls are delayed.

```typescript
import { throttle } from '@se-oss/throttle';

const throttled = throttle(
  (a, b) => {
    console.log(`Executing with ${a} ${b}...`);
  },
  {
    limit: 2,
    interval: 1000,
    onDelay: (a, b) => {
      console.log(`Call is delayed for ${a} ${b}`);
    },
  }
);

await throttled(1, 2);
await throttled(3, 4);
await throttled(5, 6);
//=> Executing with 1 2...
//=> Executing with 3 4...
//=> Call is delayed for 5 6
//=> Executing with 5 6...
```

### weight

Use the `weight` option to assign a custom cost to each function call.

```typescript
import { throttle } from '@se-oss/throttle';

// API allows 100 points per second.
// Each call costs 1 point + 1 point per item.
const throttled = throttle(
  async (itemCount: number) => {
    // Fetch data
  },
  {
    limit: 100,
    interval: 1000,
    weight: (itemCount: number) => 1 + itemCount,
  }
);

await throttled(10); // Costs 11 points
await throttled(50); // Costs 51 points
```

### queueSize

Check the number of queued items.

```typescript
import { throttle } from '@se-oss/throttle';

const accurateData = throttle(() => fetch('...'), {
  limit: 1,
  interval: 1000,
});
const fallbackData = () => fetch('...');

async function getData() {
  if (accurateData.queueSize >= 5) {
    return fallbackData(); // Use fallback when queue is full
  }

  return accurateData();
}
```

## 📚 Documentation

For all configuration options, please see [the API docs](https://www.jsdocs.io/package/@se-oss/throttle).

## 🤝 Contributing

Want to contribute? Awesome! To show your support is to star the project, or to raise issues on [GitHub](https://github.com/shahradelahi/ts-throttle)

Thanks again for your support, it is much appreciated! 🙏

## License

[MIT](/LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi) and [contributors](https://github.com/shahradelahi/ts-throttle/graphs/contributors).
