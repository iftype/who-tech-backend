UPDATE "TeamBlog"
SET "blogUrl" = 'https://www.rilog.kr/feeds'
WHERE "slug" = 'rilog';

UPDATE "Member"
SET "blog" = 'https://www.rilog.kr/feeds'
WHERE "githubId" = '__team_rilog__' AND "isTeamBlog" = 1;
