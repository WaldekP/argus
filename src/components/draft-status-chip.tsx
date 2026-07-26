import { StatusChip, type StatusMeta } from '@/components/status-chip';
import type { DraftStatus } from '@/lib/api/content';

const STATUS_META: Record<DraftStatus, StatusMeta> = {
  draft: { label: 'Szkic', color: 'textSecondary' },
  accepted: { label: 'Zaakceptowany', color: 'success' },
  rejected: { label: 'Odrzucony', color: 'error' },
};

/** Chip statusu draftu przekazu: Szkic / Zaakceptowany / Odrzucony. */
export function DraftStatusChip({ status }: { status: DraftStatus }) {
  return <StatusChip {...STATUS_META[status]} />;
}
