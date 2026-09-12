-- Migration 001 : valeurs par défaut par habitude (quantité, durée, montant).
-- À exécuter dans le SQL editor des projets créés avant cette version (Habikit-dev, puis Habikit-prod).
-- Idempotent : peut être relancée sans risque.
alter table public.habits add column if not exists default_count    numeric;
alter table public.habits add column if not exists default_duration numeric;
alter table public.habits add column if not exists default_amount   numeric;

-- Sport existant (mesuré en durée) : 1h par défaut, pour que le tap ajoute directement une séance.
update public.habits
set default_duration = 1
where lower(name) = 'sport'
  and metric = 'duration'
  and default_duration is null;

-- Séances de Sport enregistrées sans durée (invisibles car elles valent 0h) : on leur met la durée par défaut.
update public.entries e
set duration = h.default_duration
from public.habits h
where h.id = e.habit_id
  and lower(h.name) = 'sport'
  and h.default_duration is not null
  and e.duration is null;
