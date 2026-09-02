-- A public check-in can wake only the assigned agent's private mobile channel.
-- The event includes no prospect information; the app refetches the session
-- through its existing authenticated API after it receives the signal.
create or replace function private.can_receive_agent_checkin_broadcast(
  p_topic text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and p_topic = 'agent-check-ins:' || (select auth.uid())::text;
$$;

revoke all on function private.can_receive_agent_checkin_broadcast(text)
  from public, anon;
grant execute on function private.can_receive_agent_checkin_broadcast(text)
  to authenticated;

drop policy if exists "agents can receive assigned check-in broadcasts"
  on realtime.messages;

create policy "agents can receive assigned check-in broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_receive_agent_checkin_broadcast(
      (select realtime.topic())
    )
  );

create or replace function public.notify_agent_session_checkin(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent_id text;
begin
  select session_row.agent_id
  into v_agent_id
  from public.sessions session_row
  where session_row.id = p_session_id;

  if v_agent_id is null
    or v_agent_id !~* '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return;
  end if;

  perform realtime.send(
    jsonb_build_object('sessionId', p_session_id),
    'session_checked_in',
    'agent-check-ins:' || substring(v_agent_id from 6),
    true
  );
end;
$$;

revoke all on function public.notify_agent_session_checkin(uuid)
  from public, anon, authenticated;
grant execute on function public.notify_agent_session_checkin(uuid)
  to service_role;
