/**
 * Seed script — imports Document_rows.csv and Transaction_rows.csv
 * into PostgreSQL via Prisma.
 *
 * Run from the myspend/ directory:
 *   npx tsx dbseed/seed.ts
 *
 * Requires DATABASE_URL to be set in .env or environment.
 */

import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { config } from "dotenv";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Load .env from myspend/
config({ path: path.join(process.cwd(), ".env") });

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Prisma client bootstrap
// ---------------------------------------------------------------------------

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = new Set([
  "Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Entertainment",
  "Fitness",
  "Bills",
  "Income",
  "Other",
]);

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with embedded commas
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

function parseDate(s: string): Date | null {
  if (!s || s.trim() === "") return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d;
}

function parseFloat2(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseNullableFloat(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function normalizeCategory(cat: string): string {
  return VALID_CATEGORIES.has(cat) ? cat : "Other";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("── myspend seed ──────────────────────────────");

  // ── Documents ────────────────────────────────────────────────────────────
  console.log("\n[1/2] Seeding Documents...");

  const docRows = parseCsv(path.join(__dirname, "Document_rows.csv"));
  console.log(`      Parsed ${docRows.length} rows from Document_rows.csv`);

  const documents = docRows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    storageBucket: row.storageBucket || "documents",
    storagePath: row.storagePath,
    mimeType: row.mimeType || null,
    uploadStatus: row.uploadStatus || "uploaded",
    extractionStatus: row.extractionStatus || "pending",
    rawAiResponse: row.rawAiResponse && row.rawAiResponse !== ""
      ? JSON.parse(row.rawAiResponse)
      : null,
    createdAt: parseDate(row.createdAt) ?? new Date(),
    updatedAt: parseDate(row.updatedAt) ?? new Date(),
  }));

  const docResult = await prisma.document.createMany({
    data: documents,
    skipDuplicates: true,
  });
  console.log(`      ✓ Inserted ${docResult.count} documents (skipped duplicates)`);

  // ── Transactions ──────────────────────────────────────────────────────────
  console.log("\n[2/2] Seeding Transactions...");

  const txRows = parseCsv(path.join(__dirname, "Transaction_rows.csv"));
  console.log(`      Parsed ${txRows.length} rows from Transaction_rows.csv`);

  // Validate all documentIds reference an existing Document
  const knownDocIds = new Set(documents.map((d) => d.id));
  const orphaned = txRows.filter(
    (row) => row.documentId && !knownDocIds.has(row.documentId)
  );
  if (orphaned.length > 0) {
    console.warn(
      `      ⚠ ${orphaned.length} transactions reference unknown documentIds — setting documentId to null`
    );
  }

  const transactions = txRows.map((row) => ({
    id: row.id,
    documentId:
      row.documentId && knownDocIds.has(row.documentId)
        ? row.documentId
        : null,
    date: parseDate(row.date),
    description: row.description,
    merchant: row.merchant || null,
    amount: parseFloat2(row.amount),
    category: normalizeCategory(row.category),
    confidence: parseNullableFloat(row.confidence),
    createdAt: parseDate(row.createdAt) ?? new Date(),
    updatedAt: parseDate(row.updatedAt) ?? new Date(),
  }));

  // Insert in batches of 500 to avoid parameter limit issues
  const BATCH = 500;
  let totalInserted = 0;

  for (let i = 0; i < transactions.length; i += BATCH) {
    const batch = transactions.slice(i, i + BATCH);
    const result = await prisma.transaction.createMany({
      data: batch,
      skipDuplicates: true,
    });
    totalInserted += result.count;
    process.stdout.write(
      `\r      ✓ ${totalInserted}/${transactions.length} inserted...`
    );
  }

  console.log(`\n      ✓ Inserted ${totalInserted} transactions (skipped duplicates)`);

  console.log("\n── Done ──────────────────────────────────────\n");
}

main()
  .catch((err) => {
    console.error("\n✗ Seed failed:", err.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
