ALTER TABLE public.candidates RENAME TO students;

ALTER POLICY "anon_select_candidates" ON public.students RENAME TO "anon_select_students";
ALTER POLICY "anon_insert_candidates" ON public.students RENAME TO "anon_insert_students";
ALTER POLICY "anon_update_candidates" ON public.students RENAME TO "anon_update_students";
ALTER POLICY "anon_delete_candidates" ON public.students RENAME TO "anon_delete_students";
