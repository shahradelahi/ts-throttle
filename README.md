<h1 align="center">
  <sup>@se-oss/throttle</sup>
  <br>
  <a href="https://github.com/shahradelahi/ts-throttle/actions/workflows/ci.yml"><img src="https://github.com/shahradelahi/ts-throttle/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@se-oss/throttle"><img src="https://img.shields.io/npm/v/@se-oss/throttle.svg" alt="NPM Version"></a>
  <a href="/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="MIT License"></a>
  <a href="https://bundlephobia.com/package/@se-oss/throttle"><img src="https://img.shields.io/bundlephobia/minzip/@se-oss/throttle" alt="npm bundle size"></a>
  <a href="https://packagephobia.com/result?p=@se-oss/throttle"><img src="https://packagephobia.com/badge?p=@se-oss/throttle" alt="Install Size"></a>
</h1>

_@se-oss/throttle_ is a utility for rate-limiting function calls, offering fine-grained control with features like strict mode, weighted throttling, and abort signals.

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

### Basic Usage

Throttle a function to be called at most twice per second.

```ts
import { throttle } from '@se-oss/throttle';

const throttled = throttle(async (id) => fetchData(id), {
  limit: 2,
  interval: 1000,
});

for (let i = 1; i <= 6; i++) {
  throttled(i).then(console.log);
}
```

### Abort Signal

Abort pending executions using an `AbortSignal`.

```ts
import { throttle } from '@se-oss/throttle';

const controller = new AbortController();
const throttled = throttle(work, {
  limit: 1,
  interval: 1000,
  signal: controller.signal,
});

await throttled();
controller.abort('stopped');
await throttled(); // Rejects with 'stopped'
```

### Delay Notifications

Get notified when function calls are delayed due to limits.

```ts
const throttled = throttle(work, {
  limit: 1,
  interval: 1000,
  onDelay: (...args) => console.log('Delayed:', ...args),
});
```

### Weighted Throttling

Assign custom costs to different function calls.

```ts
const throttled = throttle(fetchItems, {
  limit: 100,
  interval: 1000,
  weight: (count) => 1 + count,
});

await throttled(10); // Costs 11 points
```

### Queue Management

Monitor and manage the execution queue size.

```ts
const throttled = throttle(work, { limit: 1, interval: 1000 });

if (throttled.queueSize < 5) {
  await throttled();
}
```

## 📚 Documentation

For all configuration options, please see [the API docs](https://www.jsdocs.io/package/@se-oss/throttle).

## 🤝 Contributing

Want to contribute? Awesome! To show your support is to star the project, or to raise issues on [GitHub](https://github.com/shahradelahi/ts-throttle).

Thanks again for your support, it is much appreciated! 🙏

## License

[MIT](/LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi) and [contributors](https://github.com/shahradelahi/ts-throttle/graphs/contributors).
