import { observabilityApi } from "../../../lib/api/observability.api";

export const operationalSnapshotService = {
  getSnapshot: (signal: AbortSignal) => observabilityApi.getOperationalSnapshot(signal),
};
