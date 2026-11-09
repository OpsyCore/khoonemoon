-- Additive enum values committed before dependent functions and policies run.
alter type public.reminder_target_type add value if not exists 'DOCUMENT';
alter type public.reminder_target_type add value if not exists 'APPLIANCE';
alter type public.reminder_target_type add value if not exists 'MEAL';
alter type public.document_entity_type add value if not exists 'APPLIANCE';
