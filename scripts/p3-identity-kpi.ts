#!/usr/bin/env node
/**
 * KPI P3 — ressemblance ≥ 0.7 sur 7 jours + taux de régénération manuelle.
 * Usage: node --env-file=.env.local --import tsx scripts/p3-identity-kpi.ts
 */
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  const sql = neon(url);

  const [scores] = await sql`
    select
      count(*)::int as total,
      count(*) filter (where identity_score >= 0.7)::int as pass,
      avg(identity_score) filter (where identity_score is not null) as avg_score
    from posts
    where status = 'succeeded'
      and media_kind = 'image'
      and completed_at > now() - interval '7 days'
  `;

  const [regens] = await sql`
    select count(*)::int as manual_regens
    from posts p
    where p.regen_of_post_id is not null
      and p.created_at > now() - interval '7 days'
  `;

  const [baseline] = await sql`
    select count(*)::int as near_dupes
    from posts a
    join posts b
      on a.character_id = b.character_id
     and a.source_ref = b.source_ref
     and a.id <> b.id
     and a.status = 'succeeded'
     and b.status = 'succeeded'
     and b.created_at > a.created_at
     and b.created_at < a.created_at + interval '15 minutes'
    where a.completed_at > now() - interval '30 days'
  `;

  const total = Number(scores?.total ?? 0);
  const pass = Number(scores?.pass ?? 0);
  const passRate = total > 0 ? pass / total : null;

  const report = {
    windowDays: 7,
    posts: total,
    passAt070: pass,
    passRate,
    avgScore: scores?.avg_score ? Number(scores.avg_score) : null,
    manualRegens: Number(regens?.manual_regens ?? 0),
    nearDuplicateBaseline30d: Number(baseline?.near_dupes ?? 0),
    kpiPassRateOk: passRate === null ? null : passRate >= 0.9,
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.kpiPassRateOk === false) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
