/**
 * Pass-through root layout (required by Next.js).
 * The real <html> document is rendered by app/[locale]/layout.tsx.
 * app/not-found.tsx provides its own minimal document for invalid locales.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
