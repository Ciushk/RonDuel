import type { ReactNode } from 'react';

export function generateStaticParams() {
  return [{ playId: '_shell' }];
}

export default function ResultLayout({ children }: { children: ReactNode }) {
  return children;
}
