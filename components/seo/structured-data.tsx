import { StructuredData } from '@/lib/seo/schema';

export function JsonLd({ data }: { data: object | object[] }) {
  return <StructuredData data={data} />;
}
