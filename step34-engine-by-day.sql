-- step34-engine-by-day.sql
-- WHY: Smallest.ai's dashboard shows ~220 requests on 7 Sept and nothing after.
-- Those 220 were the local preview-generation run (249 files written 16:06-16:08
-- on 7 Sept), NOT customers. If production never authenticated to Smallest, then
-- 249 of 359 voices -- including the DEFAULT voice a user sees on first load --
-- have been failing since 8 Sept.
--
-- This proves it from our own data: successful generations per engine per day.
-- Zero Smallest successes on days with heavy traffic = the key was never live.
-- Today's row also answers whether the deploys from 16 Sept fixed it.

SELECT
    to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
    count(*) FILTER (WHERE voice_id LIKE 'sm-%')                  AS smallest,
    count(*) FILTER (WHERE voice_id LIKE 'fish-%')                AS fish,
    count(*) FILTER (WHERE voice_id NOT LIKE 'sm-%'
                       AND voice_id NOT LIKE 'fish-%'
                       AND voice_id <> 'system')                  AS gemini,
    count(*) FILTER (WHERE status = 'failed')                     AS failed_rows,
    count(*)                                                      AS total
FROM generation_history
WHERE created_at >= '2026-09-01'
  AND voice_id <> 'system'
GROUP BY 1
ORDER BY 1 DESC;
