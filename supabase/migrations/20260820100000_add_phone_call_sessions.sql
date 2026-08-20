-- Phone mystery shops and prospect follow-up calls use the shared session pipeline.
alter table public.sessions
  add column if not exists session_kind text not null default 'tour';

alter table public.sessions
  drop constraint if exists sessions_session_kind_check;

alter table public.sessions
  add constraint sessions_session_kind_check
  check (session_kind in ('tour', 'call', 'ai_call'));

create index if not exists sessions_session_kind_idx
  on public.sessions(session_kind);
