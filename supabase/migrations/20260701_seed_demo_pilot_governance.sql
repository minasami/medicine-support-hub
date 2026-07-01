insert into public.pilot_decisions (organization_id, program_id, title, decision, rationale, owner_name, decision_date, status)
select 'dd85b597-cd31-42c2-9cf5-4bfaef60e8a7'::uuid, 'dfab8aa8-e152-45e4-90cd-8432e658b130'::uuid, 'Approve pilot readiness phase', 'Proceed with the controlled pilot readiness phase before full launch.', 'Core program structure, reporting, and governance controls are now available.', 'Mina Samy Tawfik Saad', current_date, 'approved'
where not exists (
  select 1 from public.pilot_decisions
  where program_id='dfab8aa8-e152-45e4-90cd-8432e658b130'::uuid
    and title='Approve pilot readiness phase'
);

insert into public.pilot_meetings (organization_id, program_id, title, meeting_at, attendees, agenda, notes, actions)
select 'dd85b597-cd31-42c2-9cf5-4bfaef60e8a7'::uuid, 'dfab8aa8-e152-45e4-90cd-8432e658b130'::uuid, 'Pilot governance kickoff', now(), 'Program lead, operations lead, clinical reviewer, finance representative', 'Confirm pilot scope, owners, evidence requirements, and review cadence.', 'Governance workspace activated for the pilot.', 'Complete readiness gaps; assign milestone owners; review budget and evidence weekly.'
where not exists (
  select 1 from public.pilot_meetings
  where program_id='dfab8aa8-e152-45e4-90cd-8432e658b130'::uuid
    and title='Pilot governance kickoff'
);
