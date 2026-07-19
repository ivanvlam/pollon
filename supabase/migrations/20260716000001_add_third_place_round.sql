-- El partido por el tercer puesto (perdedores de semis) usa round='third_place'
-- en todo el código (enum Round, bracket, knockoutSchedule) y en TheSportsDB es
-- la ronda sdb 160. Faltaba en el CHECK, así que el sync lo rechazaba con
-- "new row for relation matches violates check constraint matches_round_check".
alter table matches
  drop constraint matches_round_check,
  add constraint matches_round_check check (
    round in ('group_stage','round_of_32','round_of_16','quarterfinal','semifinal','third_place','final')
  );
