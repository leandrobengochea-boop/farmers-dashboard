-- Query para gerar o cache de calls a partir do BigQuery (psa-dw)
-- Execute via conector BigQuery do Claude e salve o resultado em data/calls-cache.json
-- Atualizar o filtro de mês e a lista de owner_ids conforme necessário

SELECT
  properties_hubspot_owner_id AS owner_id,
  COUNT(*) AS total_calls,
  COUNTIF(CAST(properties_hs_connected_count AS INT64) > 0) AS connected_calls
FROM `psa-dw.gold.calls`
WHERE properties_hs_timestamp >= '2026-09-01'
  AND properties_hs_timestamp < '2026-10-01'
  AND properties_hubspot_owner_id IN (
    '89632472','85002282','79760745','85846971','84497577','80228367',
    '95810969','93599591','87159365','95993082','94316537','95415669',
    '94028856','88200239','97763591','81033487','92335488','80688884',
    '96589066','97204561','97204635','93238814'
  )
GROUP BY owner_id
ORDER BY owner_id
