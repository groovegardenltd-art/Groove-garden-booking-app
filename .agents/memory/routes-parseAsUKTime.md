---
name: parseAsUKTime import in routes.ts
description: Re-export syntax does NOT make a symbol available in the local scope; must use import.
---

## Rule
In `server/routes.ts`, `parseAsUKTime` must be **imported** (not just re-exported) from `./time-utils` for it to be callable within the file:

```typescript
// CORRECT
import { parseAsUKTime } from './time-utils';

// WRONG — does NOT put parseAsUKTime in local scope
export { parseAsUKTime } from './time-utils';
```

**Why:** `export { X } from './module'` is a pure re-export in ESM/CJS transpilation — it puts `X` on the module's exports object but does NOT create a local binding named `X`. Any direct call to `parseAsUKTime(...)` within the same file will throw `ReferenceError: parseAsUKTime is not defined` at runtime. This was the root cause of the booking edit endpoint failing with "parseAsUKTime is not defined" and likely also caused resync endpoint failures.

**How to apply:** Whenever adding a new usage of `parseAsUKTime` in `routes.ts`, confirm the top of the file has `import { parseAsUKTime } from './time-utils'` (not `export { … } from`).
