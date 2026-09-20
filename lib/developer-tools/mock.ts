/**
 * Deterministic mock-data generator for API prototyping. A seeded PRNG
 * (mulberry32) makes output reproducible; everything runs locally.
 */

export type MockTemplate = 'users' | 'products' | 'posts' | 'todos' | 'orders';

export const MOCK_TEMPLATES: MockTemplate[] = ['users', 'products', 'posts', 'todos', 'orders'];

/** Mulberry32 — tiny seeded PRNG with decent distribution. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    // eslint-disable-next-line no-bitwise
    t = Math.imul(t ^ (t >>> 15), t | 1);
    // eslint-disable-next-line no-bitwise
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // eslint-disable-next-line no-bitwise
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Layla', 'Omar', 'Sara', 'Yusuf', 'Nour', 'Ali', 'Maya', 'Karim', 'Hana', 'Tariq', 'Rania', 'Fadi'];
const LAST = ['Hassan', 'Ali', 'Khalil', 'Mansour', 'Rahman', 'Nasser', 'Farouk', 'Salem', 'Haddad', 'Aziz'];
const DOMAINS = ['example.com', 'mail.dev', 'test.io', 'demo.app'];
const PRODUCTS = ['Wireless Mouse', 'Mechanical Keyboard', 'USB-C Hub', 'Noise-Cancelling Headphones', 'Webcam 4K', 'Laptop Stand', 'Portable SSD 1TB', 'Smart Lamp', 'Ergonomic Chair', 'Monitor 27"'];
const CATEGORIES = ['Electronics', 'Accessories', 'Office', 'Audio', 'Storage'];
const POST_TITLES = ['Getting started with APIs', 'Caching strategies that scale', 'A guide to webhooks', 'Designing for RTL layouts', 'Testing without flakiness', 'From prototype to production'];
const TODO_TITLES = ['Review pull request', 'Update documentation', 'Fix login redirect', 'Write unit tests', 'Deploy to staging', 'Audit dependencies', 'Reply to support tickets'];
const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

function isoDay(rand: () => number, baseYear = 2025): string {
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${baseYear}-${pad(month)}-${pad(day)}`;
}

export interface MockOptions {
  template: MockTemplate;
  count: number; // 1..100
  seed: number;
}

/** Generate `count` mock records for a template. */
export function generateMock(options: MockOptions): Record<string, unknown>[] {
  const count = Math.max(1, Math.min(100, Math.round(options.count) || 5));
  const rand = seededRandom(Math.round(options.seed) || 1);
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = i + 1;
    switch (options.template) {
      case 'users': {
        const first = pick(rand, FIRST);
        const last = pick(rand, LAST);
        out.push({
          id,
          name: `${first} ${last}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${id}@${pick(rand, DOMAINS)}`,
          age: 18 + Math.floor(rand() * 48),
          active: rand() > 0.2,
          joinedAt: isoDay(rand),
        });
        break;
      }
      case 'products': {
        out.push({
          id,
          sku: `SKU-${String(1000 + Math.floor(rand() * 9000))}`,
          name: `${pick(rand, PRODUCTS)}`,
          category: pick(rand, CATEGORIES),
          price: Math.round((5 + rand() * 495) * 100) / 100,
          inStock: Math.floor(rand() * 200),
          rating: Math.round((3 + rand() * 2) * 10) / 10,
        });
        break;
      }
      case 'posts': {
        out.push({
          id,
          userId: 1 + Math.floor(rand() * 12),
          title: `${pick(rand, POST_TITLES)} — part ${1 + Math.floor(rand() * 3)}`,
          slug: `post-${id}`,
          publishedAt: isoDay(rand),
          views: Math.floor(rand() * 50000),
        });
        break;
      }
      case 'todos': {
        out.push({
          id,
          title: pick(rand, TODO_TITLES),
          completed: rand() > 0.5,
          priority: pick(rand, ['low', 'medium', 'high']),
          dueDate: isoDay(rand, 2026),
        });
        break;
      }
      case 'orders': {
        const qty = 1 + Math.floor(rand() * 5);
        const unit = Math.round((10 + rand() * 240) * 100) / 100;
        out.push({
          id: 5000 + id,
          customer: `${pick(rand, FIRST)} ${pick(rand, LAST)}`,
          items: qty,
          total: Math.round(qty * unit * 100) / 100,
          currency: 'USD',
          status: pick(rand, STATUSES),
          orderedAt: isoDay(rand),
        });
        break;
      }
    }
  }
  return out;
}
