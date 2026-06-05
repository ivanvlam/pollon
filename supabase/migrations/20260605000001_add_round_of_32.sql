-- Mundial 2026 tiene 48 equipos → nueva ronda de 32 antes de octavos.
alter table matches
  drop constraint matches_round_check,
  add constraint matches_round_check check (
    round in ('group_stage','round_of_32','round_of_16','quarterfinal','semifinal','final')
  );
