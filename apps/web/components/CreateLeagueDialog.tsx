'use client';

import { CreateLeagueWizard } from '@/components/CreateLeagueWizard';

interface CreateLeagueDialogProps {
  open: boolean;
  onClose: () => void;
  uid?: string;
  onCreated?: (league: { id: string; leagueId: string; name: string; inviteCode: string }) => void;
}

export function CreateLeagueDialog({ open, onClose, onCreated }: CreateLeagueDialogProps) {
  return <CreateLeagueWizard open={open} onClose={onClose} onCreated={onCreated} />;
}
