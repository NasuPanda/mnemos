// Seeds (or wipes) one person's sample data in D1 and R2.
//
//   npm run db:seed                       local dev data for DEV_USER_EMAIL in .dev.vars
//   npm run db:seed:e2e                   the end-to-end set, in the e2e state folder
//   npm run db:seed:remote -- --email=me  your production account (asks you to confirm)
//   node scripts/seed.ts --wipe [--remote --email=me]   delete the sample data only
//
// Production asks you to type "seed production" (or "wipe production"). Where there is no
// keyboard, such as Claude Code's "!" commands, pass it instead: --confirm="seed production".
//
// It replaces the person's sections, items, images and reviews; users and settings stay.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { devProfile, e2eProfile, type Profile } from "../seed/profiles.ts";

const BUCKET = "mnemos-images";
const IMAGES_DIR = "seed/images";
const DEFAULT_LADDER = "[1,2,3,5,7,14,28]";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"] as const;
  }),
);
const remote = args.has("remote");
const wipe = args.has("wipe");
const profileName = args.get("profile") ?? "dev";
const persistTo = args.get("persist-to");

const email = (args.get("email") ?? (remote ? undefined : devUserEmail()))?.trim().toLowerCase();
if (!email) fail("Pass --email=you@example.com: the account to seed must be named for production.");

const today = localToday();
const profile: Profile = profileName === "e2e" ? e2eProfile() : devProfile();

if (remote) await confirmProduction();

const sql = wipe ? wipeSql() : [...wipeSql(), ...seedSql(profile)];
const file = join(".wrangler", "seed", `${wipe ? "wipe" : profileName}.sql`);
mkdirSync(join(".wrangler", "seed"), { recursive: true });
writeFileSync(file, `${sql.join("\n")}\n`);
wrangler(["d1", "execute", "DB", `--file=${file}`, ...target()]);
if (!wipe) uploadImages(profile);

const items = profile.items.length;
console.log(
  wipe
    ? `Wiped the sample data for ${email}.`
    : `Seeded ${profile.sections.length} sections and ${items} items for ${email}, today ${today}.`,
);

// ---------------------------------------------------------------------------------------------

function wipeSql(): string[] {
  const user = userId();
  return [
    `INSERT INTO users (email) VALUES (${text(email)}) ON CONFLICT (email) DO NOTHING;`,
    `INSERT INTO settings (user_id) SELECT id FROM users WHERE email = ${text(email)} ON CONFLICT DO NOTHING;`,
    `DELETE FROM reviews WHERE user_id = ${user};`,
    `DELETE FROM item_images WHERE item_id IN (SELECT id FROM items WHERE user_id = ${user});`,
    `DELETE FROM items WHERE user_id = ${user};`,
    `DELETE FROM sections WHERE user_id = ${user};`,
    `UPDATE settings SET ladder_days = '${DEFAULT_LADDER}', next_line = 'm2' WHERE user_id = ${user};`,
  ];
}

function seedSql({ sections, items, nextLine }: Profile): string[] {
  const user = userId();
  const sectionId = (code: string) =>
    `(SELECT id FROM sections WHERE user_id = ${user} AND code = ${text(code)})`;
  const itemId = (name: string) =>
    `(SELECT id FROM items WHERE user_id = ${user} AND name = ${text(name)})`;

  const statements = [`UPDATE settings SET next_line = '${nextLine}' WHERE user_id = ${user};`];
  for (const s of sections) {
    statements.push(
      `INSERT INTO sections (user_id, name, code, line, position) VALUES (${user}, ${text(s.name)}, ${text(s.code)}, '${s.line}', ${s.position});`,
    );
  }
  for (const i of items) {
    statements.push(
      `INSERT INTO items (user_id, section_id, name, description, problem_url, problem_text, answer_url, answer_text, side_note, stop, due_on) VALUES (${user}, ${sectionId(i.section)}, ${text(i.name)}, ${text(i.description)}, ${text(i.problemUrl)}, ${text(i.problemText)}, ${text(i.answerUrl)}, ${text(i.answerText)}, ${text(i.sideNote)}, ${i.stop}, '${addDays(today, i.dueIn)}');`,
    );
    for (const [side, files] of [
      ["problem", i.problemImages],
      ["answer", i.answerImages],
    ] as const) {
      (files ?? []).forEach((name, index) => {
        statements.push(
          `INSERT INTO item_images (item_id, side, image_key, position) VALUES (${itemId(i.name)}, '${side}', '${imageKey(name)}', ${index + 1});`,
        );
      });
    }
    if (i.reviewedToday) {
      const r = i.reviewedToday;
      statements.push(
        `INSERT INTO reviews (user_id, item_id, reviewed_on, confidence, stop_before, stop_after, was_due_on, next_due_on, manual) VALUES (${user}, ${itemId(i.name)}, '${today}', '${r.confidence}', ${r.stopBefore}, ${i.stop}, '${addDays(today, r.wasDueIn)}', '${addDays(today, i.dueIn)}', 0);`,
      );
    }
  }
  return statements;
}

/** Puts each image into R2 under its SHA-256 name. Local runs skip images already uploaded. */
function uploadImages({ items }: Profile) {
  const names = new Set(
    items.flatMap((i) => [...(i.problemImages ?? []), ...(i.answerImages ?? [])]),
  );
  const marker = join(persistTo ?? join(".wrangler", "state"), "mnemos-seed-images.json");
  const uploaded = new Set<string>(
    !remote && existsSync(marker) ? (JSON.parse(readFileSync(marker, "utf8")) as string[]) : [],
  );
  for (const name of names) {
    const key = imageKey(name);
    if (uploaded.has(key)) continue;
    wrangler([
      "r2",
      "object",
      "put",
      `${BUCKET}/${key}`,
      `--file=${join(IMAGES_DIR, name)}`,
      "--content-type=image/webp",
      ...target(),
    ]);
    uploaded.add(key);
  }
  if (!remote) {
    mkdirSync(persistTo ?? join(".wrangler", "state"), { recursive: true });
    writeFileSync(marker, JSON.stringify([...uploaded]));
  }
}

function imageKey(name: string): string {
  const bytes = readFileSync(join(IMAGES_DIR, name));
  return `${createHash("sha256").update(bytes).digest("hex")}.webp`;
}

function target(): string[] {
  if (remote) return ["--remote"];
  return ["--local", ...(persistTo ? [`--persist-to=${persistTo}`] : [])];
}

function wrangler(command: string[]) {
  const result = spawnSync("npx", ["wrangler", ...command], {
    stdio: ["inherit", "ignore", "inherit"],
  });
  if (result.status !== 0) fail(`wrangler ${command.slice(0, 3).join(" ")} failed.`);
}

async function confirmProduction() {
  const phrase = wipe ? "wipe production" : "seed production";
  console.log(
    `\nThis ${wipe ? "deletes" : "replaces"} every section, item, image and review of ${email}\n` +
      `in the production database (remote D1 "mnemos" and R2 "${BUCKET}").\n`,
  );
  // Without a keyboard (Claude Code's "!" commands, scripts), pass the phrase as --confirm.
  const given = args.get("confirm");
  if (given !== undefined) {
    if (given.trim() !== phrase) fail(`Nothing changed: --confirm must be "${phrase}".`);
    return;
  }
  if (!process.stdin.isTTY) {
    fail(`Nothing changed. Without a keyboard, add --confirm="${phrase}".`);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type "${phrase}" to continue: `);
  rl.close();
  if (answer.trim() !== phrase) fail("Nothing changed.");
}

function userId(): string {
  return `(SELECT id FROM users WHERE email = ${text(email)})`;
}

function text(value: string | undefined): string {
  return value === undefined ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

/** The machine's local date, as the browser would send it. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function devUserEmail(): string | undefined {
  if (!existsSync(".dev.vars")) return undefined;
  return /^DEV_USER_EMAIL=(.+)$/m.exec(readFileSync(".dev.vars", "utf8"))?.[1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
