import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  executeCommand,
  getGetWorkspaceQueryKey,
  useGetWorkspace,
  type CommandResult,
} from '@workspace/api-client-react';
import { reportError } from '@/lib/session';

export function useWorkspace(enabled: boolean) {
  return useGetWorkspace({
    query: {
      queryKey: getGetWorkspaceQueryKey(),
      enabled,
      refetchInterval: 20000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });
}

/** Runs a trusted command, then refetches the workspace. */
export function useRun() {
  const qc = useQueryClient();
  return useCallback(
    async (action: string, data: Record<string, unknown>): Promise<CommandResult> => {
      let res: CommandResult;
      try {
        res = await executeCommand(action, { data });
      } catch (e) {
        reportError(e);
        throw e;
      }
      await qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
      return res;
    },
    [qc],
  );
}
