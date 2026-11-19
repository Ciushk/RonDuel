import { cn } from '@/lib/cn';

const PALETTE = [
  'bg-ron text-[#16131F]',
  'bg-duel text-[#16131F]',
  'bg-volt text-[#16131F]',
  'bg-gold text-[#16131F]',
] as const;

function hashNickname(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export interface AvatarProps {
  nickname: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function Avatar({ nickname, size = 'md', className }: AvatarProps) {
  const colorClass = PALETTE[hashNickname(nickname) % PALETTE.length]!;
  return (
    <span
      role="img"
      aria-label={nickname}
      className={cn(
        'border-border font-display inline-flex shrink-0 select-none items-center justify-center rounded-full border-2 font-extrabold',
        SIZE_CLASSES[size],
        colorClass,
        className,
      )}
    >
      {getInitials(nickname)}
    </span>
  );
}
