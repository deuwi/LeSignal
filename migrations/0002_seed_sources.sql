-- Seed sources. Voir SOURCES.md.
-- Idempotent et FK-safe: ids explicites + INSERT OR REPLACE (pas de DELETE,
-- sinon la FK items.source_id bloque quand des items existent déjà).
INSERT OR REPLACE INTO sources (id, type, nom, url, flux, rank, config, actif) VALUES
-- dev / langages
(1,'rss','Node.js blog','https://nodejs.org/en/feed/blog.xml','dev',3,NULL,1),
(2,'rss','Rust blog','https://blog.rust-lang.org/feed.xml','dev',3,NULL,1),
(3,'atom','Go blog','https://go.dev/blog/feed.atom','dev',3,NULL,1),
(4,'rss','TypeScript devblog','https://devblogs.microsoft.com/typescript/feed/','dev',3,NULL,1),
(5,'atom','Bun releases','https://github.com/oven-sh/bun/releases.atom','dev',3,NULL,1),
(6,'atom','Deno releases','https://github.com/denoland/deno/releases.atom','dev',3,NULL,1),
-- IA outillage (both)
(7,'atom','Claude Code releases','https://github.com/anthropics/claude-code/releases.atom','both',3,NULL,1),
(8,'rss','GitHub changelog','https://github.blog/changelog/feed/','both',3,NULL,1),
(9,'atom','MCP releases','https://github.com/modelcontextprotocol/modelcontextprotocol/releases.atom','both',3,NULL,1),
(10,'atom','Simon Willison','https://simonwillison.net/atom/everything/','both',2,NULL,1),
(11,'search','Cursor changelog','Cursor editor changelog release','both',3,'{"query":"Cursor editor changelog release features"}',1),
(12,'search','OpenAI Codex news','OpenAI Codex coding agent release','both',3,'{"query":"OpenAI Codex coding agent release"}',1),
-- web / cloud
(13,'rss','Cloudflare blog','https://blog.cloudflare.com/rss/','dev',3,NULL,1),
(14,'rss','React blog','https://react.dev/rss.xml','dev',3,NULL,1),
(15,'rss','web.dev','https://web.dev/static/blog/feed.xml','dev',2,NULL,1),
-- archi / études
(16,'rss','arXiv cs.SE','https://rss.arxiv.org/rss/cs.SE','both',3,NULL,1),
(17,'rss','arXiv cs.DC','https://rss.arxiv.org/rss/cs.DC','dev',3,NULL,1),
(18,'rss','arXiv cs.HC','https://rss.arxiv.org/rss/cs.HC','deuwi',3,NULL,1),
(19,'rss','arXiv cs.AI','https://rss.arxiv.org/rss/cs.AI','deuwi',3,NULL,1),
(20,'atom','Martin Fowler','https://martinfowler.com/feed.atom','dev',2,NULL,1),
(21,'rss','METR','https://metr.org/feed.xml','deuwi',3,NULL,1),
-- marché / FR
(22,'api','Hacker News','https://hn.algolia.com/api/v1/search_by_date','deuwi',1,'{"kind":"hn","queries":["AI developer jobs","layoffs engineers","claude code","cursor AI","AI coding productivity"],"min_points":50}',1),
(23,'api','France Travail tensions','francetravail.io','deuwi',3,'{"kind":"francetravail","rome":["M1805","M1802"],"needs_secret":true}',0),
(24,'search','Free-Work marché','Free-Work marché freelance développeur IA','deuwi',2,'{"query":"Free-Work marché freelance développeur IA France"}',1),
(25,'search','APEC études','APEC étude emploi cadres','deuwi',3,'{"query":"APEC étude emploi cadres marché"}',1);
