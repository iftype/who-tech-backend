import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import type { CohortRule } from '../../shared/types/index.js';

export function createWorkspaceService(deps: { workspaceRepo: WorkspaceRepository }) {
  const { workspaceRepo } = deps;

  return {
    getOrThrow: () => workspaceRepo.findOrThrow(),

    getSettings: async (): Promise<{
      cohortRules: CohortRule[];
      blogSyncEnabled: boolean;
      profileRefreshEnabled: boolean;
    }> => {
      const workspace = await workspaceRepo.findOrThrow();
      return {
        cohortRules: JSON.parse(workspace.cohortRules) as CohortRule[],
        blogSyncEnabled: workspace.blogSyncEnabled,
        profileRefreshEnabled: workspace.profileRefreshEnabled,
      };
    },

    updateSettings: async (input: {
      cohortRules?: CohortRule[];
      blogSyncEnabled?: boolean;
      profileRefreshEnabled?: boolean;
    }): Promise<{ cohortRules: CohortRule[]; blogSyncEnabled: boolean; profileRefreshEnabled: boolean }> => {
      const workspace = await workspaceRepo.findOrThrow();
      const updated = await workspaceRepo.update(workspace.id, {
        ...(input.cohortRules !== undefined ? { cohortRules: JSON.stringify(input.cohortRules) } : {}),
        ...(input.blogSyncEnabled !== undefined ? { blogSyncEnabled: input.blogSyncEnabled } : {}),
        ...(input.profileRefreshEnabled !== undefined ? { profileRefreshEnabled: input.profileRefreshEnabled } : {}),
      });
      return {
        cohortRules: JSON.parse(updated.cohortRules) as CohortRule[],
        blogSyncEnabled: updated.blogSyncEnabled,
        profileRefreshEnabled: updated.profileRefreshEnabled,
      };
    },

    touchProfileRefresh: async () => {
      const workspace = await workspaceRepo.findOrThrow();
      await workspaceRepo.update(workspace.id, { lastProfileRefreshAt: new Date() });
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
