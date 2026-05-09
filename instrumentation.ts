/**
 * Next.js loads this file in a special bundle where Node built-ins are not available.
 * Do not import anything that uses `fs` — use Route Handlers for server file I/O instead.
 */
export async function register() {
  // intentionally empty (was: debug bootstrap; caused Can't resolve 'fs/promises')
}
