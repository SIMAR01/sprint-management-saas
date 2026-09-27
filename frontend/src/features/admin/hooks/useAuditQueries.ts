import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '../../../api/axiosClient';
import { useAuth } from '../../../context/AuthContext';
import {
  AuditFilterParams,
  PaginatedAuditResponse,
} from '../types/audit.types';

/**
 * Hook to retrieve paginated system-wide audit logs with filters (Admin only).
 */
export const useAuditLogsQuery = (
  filters: AuditFilterParams = {},
  options?: { isLive?: boolean }
) => {
  const { page = 1, limit = 20, resourceId, resourceType, actorUserId, action, correlationId, startDate, endDate } = filters;
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  return useQuery({
    queryKey: [
      'admin-audit-logs',
      { page, limit, resourceId, resourceType, actorUserId, action, correlationId, startDate, endDate },
    ],
    queryFn: async () => {
      const params: Record<string, any> = { page, limit };
      if (resourceId) params.resourceId = resourceId;
      if (resourceType && resourceType !== 'ALL') params.resourceType = resourceType;
      if (actorUserId) params.actorUserId = actorUserId;
      if (action && action !== 'ALL') params.action = action;
      if (correlationId) params.correlationId = correlationId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await axiosClient.get<PaginatedAuditResponse>('/audit', {
        params,
      });
      return response.data.data;
    },
    enabled: isAdmin,
    refetchInterval: options?.isLive ? 8000 : false, // Auto-refresh if live monitor mode is active
    staleTime: 1000 * 10,
  });
};
