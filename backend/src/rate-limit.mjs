/**
 * Limite simples de requisições por chave (IP) em janela fixa, em memória.
 * Suficiente para uma única instância da API; várias instâncias exigiriam
 * um armazenamento compartilhado.
 */
export function createRateLimiter({ max, windowMs, now = Date.now }) {
  const buckets = new Map();

  function sweep(current) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(key);
    }
  }

  return function hit(key) {
    const current = now();
    if (buckets.size > 1000) sweep(current);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - current) / 1000));
    return {
      allowed: bucket.count <= max,
      remaining: Math.max(0, max - bucket.count),
      retryAfterSeconds
    };
  };
}
