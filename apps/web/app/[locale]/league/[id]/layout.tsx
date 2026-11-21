import type { ReactNode } from 'react';

export function generateStaticParams() {
  return [{ id: '_shell' }];
}

export default function LeagueLayout({ children }: { children: ReactNode }) {
  return children;
}
