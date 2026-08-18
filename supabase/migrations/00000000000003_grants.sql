-- Explicit table grants for anon/authenticated. Discovered missing locally
-- (audit finding D7's RLS integration tests): the hosted platform's own
-- bootstrap already grants these automatically (verified directly against
-- the linked project via the Management API), but `supabase start`'s local
-- bootstrap does not extend that to tables created by later user
-- migrations, so local dev silently depended on hosted-only behavior our
-- own migrations never declared.
--
-- RLS remains the actual security boundary (ADR-003) -- a table-level grant
-- only says a role may *attempt* the operation; the policies from
-- 00000000000001/2 still decide which rows are visible/writable. Granting
-- to `anon` is harmless the same way it is on the hosted platform: RLS's
-- `auth.uid() = user_id` is never true for an unauthenticated request, so
-- table-level access alone can't expose or mutate a row.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on goals to anon, authenticated;
grant select, insert, update, delete on goal_entries to anon, authenticated;
grant select, insert, update, delete on milestones to anon, authenticated;
grant select, insert, update, delete on rank_windows to anon, authenticated;
