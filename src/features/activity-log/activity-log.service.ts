import type { ActivityLogRepository } from '../../db/repositories/activity-log.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export function createActivityLogService(deps: {
  activityLogRepo: ActivityLogRepository;
  workspaceService: WorkspaceService;
}) {
  const { activityLogRepo, workspaceService } = deps;

  return {
    getLogs: async (limit?: number) => {
      const workspace = await workspaceService.getOrThrow();
      return activityLogRepo.findMany(workspace.id, limit);
    },

    addLog: async (
      type: string,
      message: string,
      options?: { source?: string; memberGithubId?: string; metadata?: Record<string, unknown> },
    ) => {
      const workspace = await workspaceService.getOrThrow();
      return activityLogRepo.create({
        type,
        message,
        workspaceId: workspace.id,
        source: options?.source ?? null,
        memberGithubId: options?.memberGithubId ?? null,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
      });
    },

    clearLogs: async () => {
      const workspace = await workspaceService.getOrThrow();
      return activityLogRepo.deleteAll(workspace.id);
    },

    checkRateLimit: async (memberGithubId: string, windowMinutes: number) => {
      const since = new Date(Date.now() - windowMinutes * 60 * 1000);
      const count = await activityLogRepo.countByMember(memberGithubId, since);

      if (count === 0) {
        return { allowed: true, remainingSeconds: 0, requestCount: 0 };
      }

      const latest = await activityLogRepo.findLatestByMember(memberGithubId);
      if (!latest) {
        return { allowed: true, remainingSeconds: 0, requestCount: count };
      }

      const elapsedMs = Date.now() - latest.createdAt.getTime();
      const windowMs = windowMinutes * 60 * 1000;
      const remainingMs = windowMs - elapsedMs;

      return {
        allowed: remainingMs <= 0,
        remainingSeconds: remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0,
        requestCount: count,
      };
    },

    getLogsByType: async (type: string, limit?: number) => {
      const workspace = await workspaceService.getOrThrow();
      return activityLogRepo.findManyByType(type, workspace.id, limit);
    },
  };
}

export type ActivityLogService = ReturnType<typeof createActivityLogService>;
