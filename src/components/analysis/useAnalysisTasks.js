import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function useAnalysisTasks(analysisId) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(null);
  const queryKey = ["analysis-tasks", analysisId];
  const enabled = Boolean(analysisId && !String(analysisId).startsWith("local-"));
  const query = useQuery({ queryKey, queryFn: () => base44.analysis.getTasks(analysisId), enabled, retry: false });
  const mutation = useMutation({
    mutationFn: (checked) => base44.analysis.updateTasks(analysisId, checked),
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: (tasks) => queryClient.setQueryData(queryKey, tasks),
  });
  const toggle = async (index) => {
    if (!enabled || !query.data || busy.current || query.isFetching) return;
    busy.current = true;
    const nextChecked = { ...query.data.checked, [index]: !query.data.checked?.[index] };
    setPending({ analysisId, checked: nextChecked });
    try {
      await mutation.mutateAsync(nextChecked);
    } catch {
      // Keep the confirmed state and show the save error beside the checklist.
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return {
    checked: query.data?.checked || {},
    inputChecked: pending && pending.analysisId === analysisId ? pending.checked : query.data?.checked || {},
    toggle,
    refetch: query.refetch,
    isLoading: enabled && query.isPending,
    isSaving: mutation.isPending,
    disabled: !enabled || !query.data || query.isFetching || mutation.isPending,
    loadError: query.isError,
    saveError: mutation.isError,
  };
}
