/**
 * Applies supabase/migrations/*.sql in filename order.
 *
 * Requirements:
 *   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres
 *
 * The password is the database password from Supabase → Project Settings →
 * Database. This is separate from the API keys and is never shipped to the
 * browser. The script records applied migrations in schema_migrations.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "SUPABASE_DB_URL is required. Copy the connection string from Supabase → Project Settings → Database (use the session pooler)."
    );
    process.exit(1);
  }

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
      alter table public.schema_migrations enable row level security;
      revoke all on public.schema_migrations from anon, authenticated;
    `);
    const { rows } = await client.query<{ name: string }>(
      "select name from public.schema_migrations"
    );
    const applied = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file}`);
        continue;
      }
      const sql = await readFile(path.join(dir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
