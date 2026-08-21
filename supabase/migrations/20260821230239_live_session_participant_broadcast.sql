create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Realtime authorization runs as the subscribing Supabase Auth user. Keep the
-- membership lookup outside the exposed public schema and derive identity only
-- from auth.users/auth.uid(), never editable user metadata.
create or replace function private.can_receive_session_participant_broadcast(
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
    and exists (
      select 1
      from public.sessions session_row
      join public."propertiesTYG" property_row
        on property_row.id = session_row.property_id
      join auth.users auth_user
        on auth_user.id = (select auth.uid())
      where p_topic = 'session-participants:' || session_row.id::text
        and (
          session_row.agent_id = 'user:' || auth_user.id::text
          or exists (
            select 1
            from jsonb_array_elements(
              case
                when jsonb_typeof(property_row.metadata -> 'property_team') = 'array'
                  then property_row.metadata -> 'property_team'
                else '[]'::jsonb
              end
            ) as team_member
            where lower(nullif(team_member ->> 'email', '')) = lower(auth_user.email)
          )
        )
    );
$$;

revoke all on function private.can_receive_session_participant_broadcast(text)
  from public, anon;
grant execute on function private.can_receive_session_participant_broadcast(text)
  to authenticated;

drop policy if exists "property team can receive session participant broadcasts"
  on realtime.messages;

create policy "property team can receive session participant broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_receive_session_participant_broadcast(
      (select realtime.topic())
    )
  );

-- Broadcast a change signal only. The client refetches participant details
-- through the authenticated application API, so guest PII is not placed in the
-- Realtime message payload.
create or replace function private.broadcast_session_participant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'sessionId', new.id,
      'participantCount', jsonb_array_length(coalesce(new.leads, '[]'::jsonb))
    ),
    'participants_changed',
    'session-participants:' || new.id::text,
    true
  );
  return new;
end;
$$;

revoke all on function private.broadcast_session_participant_change()
  from public, anon, authenticated;

drop trigger if exists broadcast_session_participant_change
  on public.sessions;

create trigger broadcast_session_participant_change
after update of leads on public.sessions
for each row
when (old.leads is distinct from new.leads)
execute function private.broadcast_session_participant_change();
