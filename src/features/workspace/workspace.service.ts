import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import type { CohortRule } from '../../shared/types/index.js';

export function createWorkspaceService(deps: { workspaceRepo: WorkspaceRepository }) {
  const { workspaceRepo } = deps;

  return {
    getOrThrow: () => workspaceRepo.findOrThrow(),

    getSettings: async (): Promise<{ cohortRules: CohortRule[]; blogSyncEnabled: boolean }> => {
      const workspace = await workspaceRepo.findOrThrow();
      return {
        cohortRules: JSON.parse(workspace.cohortRules) as CohortRule[],
        blogSyncEnabled: workspace.blogSyncEnabled,
      };
    },

    updateSettings: async (input: {
      cohortRules?: CohortRule[];
      blogSyncEnabled?: boolean;
    }): Promise<{ cohortRules: CohortRule[]; blogSyncEnabled: boolean }> => {
      const workspace = await workspaceRepo.findOrThrow();
      const updated = await workspaceRepo.update(workspace.id, {
        ...(input.cohortRules !== undefined ? { cohortRules: JSON.stringify(input.cohortRules) } : {}),
        ...(input.blogSyncEnabled !== undefined ? { blogSyncEnabled: input.blogSyncEnabled } : {}),
      });
      return {
        cohortRules: JSON.parse(updated.cohortRules) as CohortRule[],
        blogSyncEnabled: updated.blogSyncEnabled,
      };
    },

    getSyncContext: async (): Promise<{
      id: number;
      githubOrg: string;
      cohortRules: CohortRule[];
    }> => {
      const workspace = await workspaceRepo.findOrThrow();
      return {
        id: workspace.id,
        githubOrg: workspace.githubOrg,
        cohortRules: JSON.parse(workspace.cohortRules) as CohortRule[],
      };
    },
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
