import type { AudioInsights, AudioInsightsStatus, FollowUpAction, SessionSummary } from "@tour/shared";
import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  deleteComment,
  deleteSession,
  fetchActions,
  fetchAnalysis,
  fetchAnalysisRuns,
  fetchAudioInsights,
  fetchCalendarEvents,
  fetchComments,
  fetchLiveSessionSuggestions,
  fetchMaterials,
  fetchProfile,
  fetchPracticeDashboard,
  fetchRubrics,
  fetchSampleSession,
  fetchSampleSessions,
  fetchSession,
  fetchSessionReview,
  fetchSessions,
  fetchTranscript,
  postComment,
  startAudioInsights,
  updateActionStatus,
  updateProfile,
  type FetchSessionsParams,
  type PaginatedSessions,
  type ProfileResponse,
  type ProfileUpdatePayload,
  type SessionComment,
  type SessionReviewBundle,
} from "./api";
import { getCurrentSession, replaceStoredSession } from "./auth";

const communityKey = () => getCurrentSession()?.workspace.community.id ?? "anonymous";
const userKey = () => getCurrentSession()?.workspace.user.id ?? "anonymous";

export const queryCacheTime = {
  live: 15_000,
  list: 60_000,
  detail: 2 * 60_000,
  reference: 10 * 60_000,
  durable: 30 * 60_000,
} as const;

const PROCESSING_SESSION_STATUSES = new Set([
  "uploaded",
  "transcribing",
  "segmenting",
  "analyzing",
]);

export const queryKeys = {
  all: () => ["mobile", communityKey()] as const,
  profile: () => [...queryKeys.all(), "profile", userKey()] as const,
  sessionsRoot: () => [...queryKeys.all(), "sessions"] as const,
  sessions: (params?: FetchSessionsParams) => [...queryKeys.sessionsRoot(), params ?? {}] as const,
  sessionPagesRoot: () => [...queryKeys.all(), "sessionPages"] as const,
  sessionPages: (params?: FetchSessionsParams) => [...queryKeys.sessionPagesRoot(), params ?? {}] as const,
  session: (sessionId: string) => [...queryKeys.all(), "session", sessionId] as const,
  sessionReview: (sessionId: string) => [...queryKeys.session(sessionId), "review"] as const,
  sessionReport: (sessionId: string) => [...queryKeys.session(sessionId), "report"] as const,
  sampleSessions: () => [...queryKeys.all(), "sampleSessions"] as const,
  sampleSession: (sessionId: string) => [...queryKeys.all(), "sampleSession", sessionId] as const,
  analysis: (sessionId: string) => [...queryKeys.session(sessionId), "analysis"] as const,
  actions: (sessionId: string) => [...queryKeys.session(sessionId), "actions"] as const,
  comments: (sessionId: string) => [...queryKeys.session(sessionId), "comments"] as const,
  transcript: (sessionId: string) => [...queryKeys.session(sessionId), "transcript"] as const,
  audioInsights: (sessionId: string) => [...queryKeys.session(sessionId), "audioInsights"] as const,
  rubrics: () => [...queryKeys.all(), "rubrics"] as const,
  materials: () => [...queryKeys.all(), "materials"] as const,
  calendar: () => [...queryKeys.all(), "calendar"] as const,
  practice: () => [...queryKeys.all(), "practice"] as const,
  liveSuggestions: (sessionId: string) => [...queryKeys.session(sessionId), "liveSuggestions"] as const,
};

export function sessionQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => fetchSession(sessionId),
    staleTime: queryCacheTime.detail,
  });
}

export function sessionReviewQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: queryKeys.sessionReview(sessionId),
    queryFn: () => fetchSessionReview(sessionId),
    staleTime: queryCacheTime.detail,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data
        && !data.analysis
        && PROCESSING_SESSION_STATUSES.has(data.session.status)
        ? 4_000
        : false;
    },
  });
}

export function useSessionsQuery(params?: FetchSessionsParams) {
  return useQuery({
    queryKey: queryKeys.sessions(params),
    queryFn: () => fetchSessions(params),
    staleTime: queryCacheTime.list,
  });
}

export function useInfiniteSessionsQuery(params?: FetchSessionsParams) {
  return useInfiniteQuery({
    queryKey: queryKeys.sessionPages(params),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchSessions({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: queryCacheTime.list,
    placeholderData: (previous) => previous,
  });
}

export function useSessionQuery(sessionId: string) {
  return useQuery(sessionQueryOptions(sessionId));
}

export function useSessionReviewQuery(sessionId: string) {
  return useQuery(sessionReviewQueryOptions(sessionId));
}

export function useSampleSessionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sampleSessions(),
    queryFn: fetchSampleSessions,
    enabled,
    staleTime: queryCacheTime.reference,
  });
}

export function useSampleSessionQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sampleSession(sessionId),
    queryFn: () => fetchSampleSession(sessionId),
    enabled,
    staleTime: queryCacheTime.reference,
  });
}

export function useAnalysisQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysis(sessionId),
    queryFn: () => fetchAnalysis(sessionId),
    enabled,
    staleTime: queryCacheTime.detail,
  });
}

export function useActionsQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.actions(sessionId),
    queryFn: () => fetchActions(sessionId),
    enabled,
    staleTime: queryCacheTime.detail,
  });
}

export function useCommentsQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.comments(sessionId),
    queryFn: () => fetchComments(sessionId),
    enabled,
    staleTime: queryCacheTime.list,
  });
}

export function useTranscriptQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transcript(sessionId),
    queryFn: () => fetchTranscript(sessionId),
    enabled,
    staleTime: queryCacheTime.reference,
  });
}

export function useAudioInsightsQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.audioInsights(sessionId),
    queryFn: () => fetchAudioInsights(sessionId),
    enabled,
    staleTime: queryCacheTime.reference,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" ? 3000 : false;
    },
  });
}

export function useRubricsQuery() {
  return useQuery({
    queryKey: queryKeys.rubrics(),
    queryFn: fetchRubrics,
    staleTime: queryCacheTime.durable,
  });
}

export function useMaterialsQuery() {
  return useQuery({
    queryKey: queryKeys.materials(),
    queryFn: fetchMaterials,
    staleTime: queryCacheTime.reference,
  });
}

export function useCalendarEventsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.calendar(),
    queryFn: () => fetchCalendarEvents(),
    enabled,
    staleTime: queryCacheTime.detail,
  });
}

export function usePracticeDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.practice(),
    queryFn: fetchPracticeDashboard,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useLiveSessionSuggestionsQuery(
  sessionId: string,
  context: { liveTranscript?: string; propertyContext?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.liveSuggestions(sessionId),
    queryFn: () => fetchLiveSessionSuggestions(sessionId, context),
    enabled: enabled && Boolean(sessionId),
    staleTime: queryCacheTime.live,
    refetchInterval: enabled ? 18_000 : false,
  });
}

export function useSessionReportQuery(sessionId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.sessionReport(sessionId),
    queryFn: async () => {
      const [review, runsResult] = await Promise.all([
        queryClient.ensureQueryData(sessionReviewQueryOptions(sessionId)),
        fetchAnalysisRuns(sessionId).catch(() => ({ runs: [] })),
      ]);
      return {
        session: review.session,
        analysis: review.analysis,
        runs: runsResult.runs,
      };
    },
    staleTime: queryCacheTime.detail,
  });
}

async function syncProfileIntoAuthSession(profile: ProfileResponse) {
  const session = getCurrentSession();
  if (!session) return null;
  return replaceStoredSession({
    ...session,
    workspace: {
      ...session.workspace,
      user: {
        ...session.workspace.user,
        fullName: profile.name,
        title: profile.title,
        phone: profile.phone,
        cardAccent: profile.cardAccent,
      },
    },
  });
}

export function useProfileQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: async () => {
      const profile = await fetchProfile();
      await syncProfileIntoAuthSession(profile);
      return profile;
    },
    enabled: enabled && Boolean(getCurrentSession()),
    staleTime: queryCacheTime.reference,
    placeholderData: () => {
      const session = getCurrentSession();
      if (!session) return undefined;
      return {
        name: session.workspace.user.fullName ?? session.workspace.user.email.split("@")[0] ?? "Agent",
        email: session.workspace.user.email,
        role: session.workspace.teamMember.accessRole,
        company: session.workspace.organization.name,
        community: session.workspace.community.name,
        title: session.workspace.user.title ?? null,
        phone: session.workspace.user.phone ?? null,
        cardAccent: session.workspace.user.cardAccent ?? null,
      } satisfies ProfileResponse;
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfileUpdatePayload) => updateProfile(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile() });
      const previous = queryClient.getQueryData<ProfileResponse>(queryKeys.profile());
      if (previous) {
        queryClient.setQueryData<ProfileResponse>(queryKeys.profile(), {
          ...previous,
          name: payload.name,
          title: payload.title !== undefined ? payload.title : previous.title,
          phone: payload.phone !== undefined ? payload.phone : previous.phone,
          cardAccent: payload.cardAccent !== undefined ? payload.cardAccent : previous.cardAccent,
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.profile(), context.previous);
      }
    },
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.profile(), profile);
      await syncProfileIntoAuthSession(profile);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

function updateSessionInPages(
  data: InfiniteData<PaginatedSessions> | undefined,
  updater: (session: SessionSummary) => SessionSummary | null,
) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => {
      const sessions = page.sessions
        .map(updater)
        .filter((session): session is SessionSummary => !!session);
      return {
        ...page,
        sessions,
        total: Math.max(0, page.total - (page.sessions.length - sessions.length)),
      };
    }),
  };
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSession,
    onMutate: async (sessionId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.sessionsRoot() }),
        queryClient.cancelQueries({ queryKey: queryKeys.sessionPagesRoot() }),
      ]);
      const previousSessions = queryClient.getQueriesData({ queryKey: queryKeys.sessionsRoot() });
      const previousPages = queryClient.getQueriesData({ queryKey: queryKeys.sessionPagesRoot() });
      queryClient.setQueriesData<PaginatedSessions>(
        { queryKey: queryKeys.sessionsRoot() },
        (data) => data ? {
          ...data,
          sessions: data.sessions.filter((session) => session.id !== sessionId),
          total: Math.max(0, data.total - 1),
        } : data,
      );
      queryClient.setQueriesData<InfiniteData<PaginatedSessions>>(
        { queryKey: queryKeys.sessionPagesRoot() },
        (data) => updateSessionInPages(data, (session) => session.id === sessionId ? null : session),
      );
      return { previousSessions, previousPages };
    },
    onError: (_error, _sessionId, context) => {
      context?.previousSessions.forEach(([key, data]) => queryClient.setQueryData(key, data));
      context?.previousPages.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _error, sessionId) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sessionsRoot() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sessionPagesRoot() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar() }),
      ]);
      queryClient.removeQueries({ queryKey: queryKeys.session(sessionId) });
    },
  });
}

export function useUpdateActionStatusMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: "completed" | "dismissed" }) =>
      updateActionStatus(sessionId, actionId, status),
    onMutate: async ({ actionId, status }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.actions(sessionId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.sessionReview(sessionId) }),
      ]);
      const previous = queryClient.getQueryData<{ actions: FollowUpAction[] }>(queryKeys.actions(sessionId));
      const previousReview = queryClient.getQueryData<SessionReviewBundle>(queryKeys.sessionReview(sessionId));
      queryClient.setQueryData<{ actions: FollowUpAction[] }>(queryKeys.actions(sessionId), (data) =>
        data ? {
          actions: data.actions.map((action) => action.id === actionId ? { ...action, status } : action),
        } : data,
      );
      queryClient.setQueryData<SessionReviewBundle>(queryKeys.sessionReview(sessionId), (data) =>
        data ? {
          ...data,
          actions: data.actions.map((action) => action.id === actionId ? { ...action, status } : action),
        } : data,
      );
      return { previous, previousReview };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(queryKeys.actions(sessionId), context?.previous);
      queryClient.setQueryData(queryKeys.sessionReview(sessionId), context?.previousReview);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.actions(sessionId), exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionReview(sessionId), exact: true });
    },
  });
}

export function usePostCommentMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof postComment>[1]) => postComment(sessionId, payload),
    onMutate: async (payload) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.comments(sessionId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.sessionReview(sessionId) }),
      ]);
      const previous = queryClient.getQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId));
      const previousReview = queryClient.getQueryData<SessionReviewBundle>(queryKeys.sessionReview(sessionId));
      const session = getCurrentSession();
      const optimistic: SessionComment = {
        id: `optimistic-${Date.now()}`,
        sessionId,
        authorName: session?.workspace.user.fullName ?? session?.workspace.user.email ?? "You",
        body: payload.body,
        kind: payload.kind ?? "comment",
        timestampSec: payload.timestampSec ?? null,
        parentId: payload.parentId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId), (data) => ({
        comments: [...(data?.comments ?? []), optimistic],
      }));
      queryClient.setQueryData<SessionReviewBundle>(queryKeys.sessionReview(sessionId), (data) =>
        data ? { ...data, comments: [...data.comments, optimistic] } : data,
      );
      return { previous, previousReview };
    },
    onError: (_error, _payload, context) => {
      queryClient.setQueryData(queryKeys.comments(sessionId), context?.previous);
      queryClient.setQueryData(queryKeys.sessionReview(sessionId), context?.previousReview);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId), (data) => ({
        comments: [
          ...(data?.comments ?? []).filter((comment) => !comment.id.startsWith("optimistic-")),
          result.comment,
        ],
      }));
      queryClient.setQueryData<SessionReviewBundle>(queryKeys.sessionReview(sessionId), (data) =>
        data ? {
          ...data,
          comments: [
            ...data.comments.filter((comment) => !comment.id.startsWith("optimistic-")),
            result.comment,
          ],
        } : data,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(sessionId), exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionReview(sessionId), exact: true });
    },
  });
}

export function useDeleteCommentMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(sessionId, commentId),
    onMutate: async (commentId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.comments(sessionId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.sessionReview(sessionId) }),
      ]);
      const previous = queryClient.getQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId));
      const previousReview = queryClient.getQueryData<SessionReviewBundle>(queryKeys.sessionReview(sessionId));
      queryClient.setQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId), (data) => ({
        comments: (data?.comments ?? []).filter((comment) => comment.id !== commentId && comment.parentId !== commentId),
      }));
      queryClient.setQueryData<SessionReviewBundle>(queryKeys.sessionReview(sessionId), (data) =>
        data ? {
          ...data,
          comments: data.comments.filter((comment) => comment.id !== commentId && comment.parentId !== commentId),
        } : data,
      );
      return { previous, previousReview };
    },
    onError: (_error, _commentId, context) => {
      queryClient.setQueryData(queryKeys.comments(sessionId), context?.previous);
      queryClient.setQueryData(queryKeys.sessionReview(sessionId), context?.previousReview);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(sessionId), exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionReview(sessionId), exact: true });
    },
  });
}

export function useStartAudioInsightsMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startAudioInsights(sessionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.audioInsights(sessionId) });
      const previous = queryClient.getQueryData<{
        status: AudioInsightsStatus;
        insights: AudioInsights | null;
        error?: string | null;
      }>(queryKeys.audioInsights(sessionId));
      queryClient.setQueryData(queryKeys.audioInsights(sessionId), {
        status: "processing",
        insights: null,
        error: null,
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKeys.audioInsights(sessionId), context?.previous);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.audioInsights(sessionId), {
        status: result.status ?? "processing",
        insights: null,
        error: result.error ?? null,
      });
    },
  });
}
