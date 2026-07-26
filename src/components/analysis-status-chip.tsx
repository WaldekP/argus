import { StatusChip, type StatusMeta } from '@/components/status-chip';
import type { AnalysisStatus } from '@/lib/api/analysis';

const STATUS_META: Record<AnalysisStatus, StatusMeta> = {
  collecting: { label: 'Zbieram dane', color: 'teal' },
  analyzing: { label: 'Analizuję', color: 'accent' },
  ready: { label: 'Gotowa', color: 'success' },
  error: { label: 'Błąd', color: 'error' },
};

/** Chip statusu analizy niespójności: Zbieram dane / Analizuję / Gotowa / Błąd. */
export function AnalysisStatusChip({ status }: { status: AnalysisStatus }) {
  return <StatusChip {...STATUS_META[status]} />;
}
