import type { AudioInsights, FollowUpAction, SessionSummary } from "@tour/shared";
import {
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
  fetchAudioInsights,
  fetchCalendarEvents,
  fetchComments,
  fetchMaterials,
  fetchProfile,
  fetchRubrics,
  fetchSampleSession,
  fetchSampleSessions,
  fetchSession,
  fetchSessions,
  fetchTranscript,
  postComment,
  updateActionStatus,
  updateProfile,
  type FetchSessionsParams,
  type PaginatedSessions,
  type ProfileResponse,
  type ProfileUpdatePayload,
  type SessionComment,
} from "./api";
import { getCurrentSession, replaceStoredSession } from "./auth";

const communityKey = () => getCurrentSession()?.workspace.community.id ?? "anonymous";
const userKey = () => getCurrentSession()?.workspace.user.id ?? "anonymous";

export const queryKeys = {
  all: () => ["mobile", communityKey()] as const,
  profile: () => ["mobile", "profile", userKey()] as const,
  sessions: (params?: FetchSessionsParams) => [...queryKeys.all(), "sessions", params ?? {}] as const,
  sessionPages: (params?: FetchSessionsParams) => [...queryKeys.all(), "sessionPages", params ?? {}] as const,
  session: (sessionId: string) => [...queryKeys.all(), "session", sessionId] as const,
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
};

export function useSessionsQuery(params?: FetchSessionsParams) {
  return useQuery({
    queryKey: queryKeys.sessions(params),
    queryFn: () => fetchSessions(params),
  });
}

export function useInfiniteSessionsQuery(params?: FetchSessionsParams) {
  return useInfiniteQuery({
    queryKey: queryKeys.sessionPages(params),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchSessions({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });
}

export function useSessionQuery(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => fetchSession(sessionId),
  });
}

export function useSampleSessionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sampleSessions(),
    queryFn: fetchSampleSessions,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSampleSessionQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sampleSession(sessionId),
    queryFn: () => fetchSampleSession(sessionId),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useAnalysisQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysis(sessionId),
    queryFn: () => fetchAnalysis(sessionId),
    enabled,
  });
}

export function useActionsQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.actions(sessionId),
    queryFn: () => fetchActions(sessionId),
    enabled,
  });
}

export function useCommentsQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.comments(sessionId),
    queryFn: () => fetchComments(sessionId),
    enabled,
  });
}

export function useTranscriptQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transcript(sessionId),
    queryFn: () => fetchTranscript(sessionId),
    enabled,
  });
}

export function useAudioInsightsQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.audioInsights(sessionId),
    queryFn: () => fetchAudioInsights(sessionId),
    enabled,
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
    staleTime: 5 * 60_000,
  });
}

export function useMaterialsQuery() {
  return useQuery({
    queryKey: queryKeys.materials(),
    queryFn: fetchMaterials,
    staleTime: 2 * 60_000,
  });
}

export function useCalendarEventsQuery() {
  return useQuery({
    queryKey: queryKeys.calendar(),
    queryFn: () => fetchCalendarEvents(),
    staleTime: 60_000,
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
        aiTrainingDataFeedback: profile.aiTrainingDataFeedback,
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
    staleTime: 5 * 60_000,
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
        aiTrainingDataFeedback: session.workspace.user.aiTrainingDataFeedback ?? false,
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
          name: payload.name !== undefined ? payload.name : previous.name,
          title: payload.title !== undefined ? payload.title : previous.title,
          phone: payload.phone !== undefined ? payload.phone : previous.phone,
          cardAccent: payload.cardAccent !== undefined ? payload.cardAccent : previous.cardAccent,
          aiTrainingDataFeedback: payload.aiTrainingDataFeedback !== undefined ? payload.aiTrainingDataFeedback : previous.aiTrainingDataFeedback,
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
      await queryClient.cancelQueries({ queryKey: queryKeys.all() });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.all() });
      queryClient.setQueriesData<PaginatedSessions>(
        { queryKey: [...queryKeys.all(), "sessions"] },
        (data) => data ? {
          ...data,
          sessions: data.sessions.filter((session) => session.id !== sessionId),
          total: Math.max(0, data.total - 1),
        } : data,
      );
      queryClient.setQueriesData<InfiniteData<PaginatedSessions>>(
        { queryKey: [...queryKeys.all(), "sessionPages"] },
        (data) => updateSessionInPages(data, (session) => session.id === sessionId ? null : session),
      );
      return { previous };
    },
    onError: (_error, _sessionId, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.all() });
    },
  });
}

export function useUpdateActionStatusMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: "completed" | "dismissed" }) =>
      updateActionStatus(sessionId, actionId, status),
    onMutate: async ({ actionId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.actions(sessionId) });
      const previous = queryClient.getQueryData<{ actions: FollowUpAction[] }>(queryKeys.actions(sessionId));
      queryClient.setQueryData<{ actions: FollowUpAction[] }>(queryKeys.actions(sessionId), (data) =>
        data ? {
          actions: data.actions.map((action) => action.id === actionId ? { ...action, status } : action),
        } : data,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(queryKeys.actions(sessionId), context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.actions(sessionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
    },
  });
}

export function usePostCommentMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof postComment>[1]) => postComment(sessionId, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments(sessionId) });
      const previous = queryClient.getQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId));
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
      return { previous };
    },
    onError: (_error, _payload, context) => {
      queryClient.setQueryData(queryKeys.comments(sessionId), context?.previous);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId), (data) => ({
        comments: [
          ...(data?.comments ?? []).filter((comment) => !comment.id.startsWith("optimistic-")),
          result.comment,
        ],
      }));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(sessionId) });
    },
  });
}

export function useDeleteCommentMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(sessionId, commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments(sessionId) });
      const previous = queryClient.getQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId));
      queryClient.setQueryData<{ comments: SessionComment[] }>(queryKeys.comments(sessionId), (data) => ({
        comments: (data?.comments ?? []).filter((comment) => comment.id !== commentId && comment.parentId !== commentId),
      }));
      return { previous };
    },
    onError: (_error, _commentId, context) => {
      queryClient.setQueryData(queryKeys.comments(sessionId), context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(sessionId) });
    },
  });
}
