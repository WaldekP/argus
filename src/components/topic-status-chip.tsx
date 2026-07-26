import { StatusChip, type StatusMeta } from '@/components/status-chip';
import type { TopicStatus } from '@/lib/api/topics';

const STATUS_META: Record<TopicStatus, StatusMeta> = {
  generating: { label: 'W trakcie', color: 'accentLight' },
  ready: { label: 'Gotowe', color: 'success' },
  error: { label: 'Błąd', color: 'error' },
};

/**
 * Chip statusu dossier tematu: W trakcie / Gotowe / Błąd.
 *
 * Jedno źródło dla listy tematów i ekranu tematu. Wcześniej każdy z tych
 * ekranów miał własny chip, o innym kolorze i innym odstępie, więc ten sam
 * status wyglądał inaczej w zależności od tego, gdzie się go zobaczyło.
 */
export function TopicStatusChip({ status }: { status: TopicStatus }) {
  return <StatusChip {...STATUS_META[status]} />;
}
