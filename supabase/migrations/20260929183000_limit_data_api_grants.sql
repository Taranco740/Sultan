revoke all privileges on all tables in schema public from anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'goals', 'goal_steps', 'focus_items', 'workouts', 'workout_sets',
    'runs', 'sleep_logs', 'checklists', 'checklist_items', 'checklist_runs',
    'trades', 'journal_entries', 'ideas', 'projects', 'project_tasks',
    'money_entries', 'learning_items', 'relationships', 'weekly_reviews'
  ] loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end;
$$;
