export type JobStatus = "QUEUED" | "RETRIEVING_CONTEXT" | "ANALYZING" | "COMPLETED" | "FAILED";

export interface Comment {
  file_path: string;
  line: number;
  category: string;
  body: string;
  confidence_score: number;
}

export interface ContextChunk {
  file_path: string;
  symbol_name: string | null;
  similarity: number;
  raw_code: string;
}

export interface AstChunk {
  id: string;
  file_path: string;
  symbol_name: string | null;
  start_line: number;
  end_line: number;
  content_hash: string;
  raw_code: string;
}

export interface DiffLine {
  type: "ctx" | "add" | "del";
  n?: number;
  text: string;
}

export interface DiffFile {
  path: string;
  lines: DiffLine[];
}

export interface Review {
  id: string;
  pr_number: number;
  commit_sha?: string;
  author?: string;
  branch?: string;
  created_at?: string;
  title: string;
  status: JobStatus;
  latency_ms: number;
  tokens: number;
  diff: DiffFile[];
  comments: Comment[];
  context: ContextChunk[];
}

export interface Repo {
  full_name: string;
  index_status: string;
  total_chunks: number;
  reviews: Review[];
  chunks?: AstChunk[];
}

export const DEMO_REPOS: Repo[] = [
  {
    full_name: "mbuensalido/gripped",
    index_status: "READY",
    total_chunks: 412,
    reviews: [
      {
        id: "g-42",
        pr_number: 42,
        commit_sha: "8f4b21c9a0e3d19b",
        author: "mbuensalido",
        branch: "feat/paginated-climbs",
        created_at: "14m ago",
        title: "Make getClimbs return paginated result envelope",
        status: "COMPLETED",
        latency_ms: 3840,
        tokens: 1842,
        diff: [
          {
            path: "src/api/climbs.ts",
            lines: [
              { type: "ctx", n: 10, text: "export async function getClimbs(gymId: string, limit = 25) {" },
              { type: "del", text: "  return db.select().from(climbs).where(eq(climbs.gymId, gymId));" },
              { type: "add", n: 11, text: "  const rows = await db.select().from(climbs).where(eq(climbs.gymId, gymId)).limit(limit);" },
              { type: "add", n: 12, text: "  return { items: rows, nextCursor: rows.at(-1)?.id ?? null };" },
              { type: "ctx", n: 13, text: "}" },
            ],
          },
          {
            path: "src/api/ascents.ts",
            lines: [
              { type: "ctx", n: 28, text: "export async function recordAscent(userId: string, climbId: string) {" },
              { type: "add", n: 29, text: "  const existing = await db.query.ascents.findFirst({ where: eq(ascents.climbId, climbId) });" },
              { type: "add", n: 30, text: "  if (existing) return existing;" },
              { type: "ctx", n: 31, text: "  return db.insert(ascents).values({ userId, climbId }).returning();" },
              { type: "ctx", n: 32, text: "}" },
            ],
          },
        ],
        comments: [
          {
            file_path: "src/api/climbs.ts",
            line: 12,
            category: "Breaking Change",
            body: "`getClimbs` now returns `{ items, nextCursor }` instead of `Climb[]`. `src/screens/GymScreen.tsx` calls `climbs.map(...)` directly on the return value and will throw `TypeError: climbs.map is not a function` at runtime.",
            confidence_score: 0.96,
          },
          {
            file_path: "src/api/ascents.ts",
            line: 29,
            category: "Bug",
            body: "Lookup filters only by `eq(ascents.climbId, climbId)` without scoping to `userId`. If any climber has logged this route, subsequent users will receive that user's ascent record instead of recording their own.",
            confidence_score: 0.91,
          },
        ],
        context: [
          {
            file_path: "src/screens/GymScreen.tsx",
            symbol_name: "GymScreen",
            similarity: 0.93,
            raw_code: "export function GymScreen({ gym }: { gym: Gym }) {\n  const climbs = await getClimbs(gym.id);\n  return climbs.map((c) => <ClimbRow key={c.id} {...c} />);\n}",
          },
          {
            file_path: "src/hooks/useClimbs.ts",
            symbol_name: "useClimbs",
            similarity: 0.89,
            raw_code: "export function useClimbs(gymId: string) {\n  return useQuery({\n    queryKey: ['climbs', gymId],\n    queryFn: () => getClimbs(gymId),\n    select: (data) => data.filter((c) => !c.archived),\n  });\n}",
          },
          {
            file_path: "src/db/schema.ts",
            symbol_name: "ascents",
            similarity: 0.85,
            raw_code: "export const ascents = pgTable('ascents', {\n  id: uuid('id').defaultRandom().primaryKey(),\n  userId: uuid('user_id').notNull(),\n  climbId: uuid('climb_id').notNull(),\n});",
          },
        ],
      },
      {
        id: "g-39",
        pr_number: 39,
        commit_sha: "e419c02b77d13a8f",
        author: "mbuensalido",
        branch: "perf/grade-histogram-memo",
        created_at: "2d ago",
        title: "Memoize V-grade distribution histogram selector",
        status: "COMPLETED",
        latency_ms: 2610,
        tokens: 1120,
        diff: [
          {
            path: "src/utils/grades.ts",
            lines: [
              { type: "ctx", n: 4, text: "export function computeGradeBuckets(climbs: Climb[]): Record<string, number> {" },
              { type: "add", n: 5, text: "  const counts: Record<string, number> = Object.create(null);" },
              { type: "add", n: 6, text: "  for (const c of climbs) counts[c.grade] = (counts[c.grade] ?? 0) + 1;" },
              { type: "add", n: 7, text: "  return counts;" },
              { type: "ctx", n: 8, text: "}" },
            ],
          },
        ],
        comments: [],
        context: [
          {
            file_path: "src/components/GradeChart.tsx",
            symbol_name: "GradeChart",
            similarity: 0.87,
            raw_code: "const buckets = useMemo(() => computeGradeBuckets(climbs), [climbs]);\nreturn <BarSeries buckets={buckets} />;",
          },
        ],
      },
    ],
    chunks: [
      {
        id: "chk-1",
        file_path: "src/screens/GymScreen.tsx",
        symbol_name: "GymScreen",
        start_line: 14,
        end_line: 38,
        content_hash: "9f84a21c0e44b19d2e7c338f",
        raw_code: "export function GymScreen({ gym }: { gym: Gym }) {\n  const climbs = await getClimbs(gym.id);\n  return climbs.map((c) => <ClimbRow key={c.id} {...c} />);\n}",
      },
      {
        id: "chk-2",
        file_path: "src/hooks/useClimbs.ts",
        symbol_name: "useClimbs",
        start_line: 6,
        end_line: 21,
        content_hash: "4b12e88a90c13f77d021e4a1",
        raw_code: "export function useClimbs(gymId: string) {\n  return useQuery({\n    queryKey: ['climbs', gymId],\n    queryFn: () => getClimbs(gymId),\n    select: (data) => data.filter((c) => !c.archived),\n  });\n}",
      },
      {
        id: "chk-3",
        file_path: "src/db/schema.ts",
        symbol_name: "climbs",
        start_line: 1,
        end_line: 19,
        content_hash: "7d31f92a00b48e11c593a7b2",
        raw_code: "export const climbs = pgTable('climbs', {\n  id: uuid('id').defaultRandom().primaryKey(),\n  gymId: uuid('gym_id').notNull(),\n  grade: varchar('grade', { length: 8 }).notNull(),\n  setterId: uuid('setter_id'),\n});",
      },
      {
        id: "chk-4",
        file_path: "src/db/schema.ts",
        symbol_name: "ascents",
        start_line: 22,
        end_line: 35,
        content_hash: "1c89d40f23a76b54e901c2d8",
        raw_code: "export const ascents = pgTable('ascents', {\n  id: uuid('id').defaultRandom().primaryKey(),\n  userId: uuid('user_id').notNull(),\n  climbId: uuid('climb_id').notNull(),\n});",
      },
    ],
  },
  {
    full_name: "mbuensalido/coldchainiq",
    index_status: "READY",
    total_chunks: 287,
    reviews: [
      {
        id: "c-17",
        pr_number: 17,
        commit_sha: "3c91e70b4d12f8a5",
        author: "mbuensalido",
        branch: "feat/excursion-alerts",
        created_at: "1h ago",
        title: "Dispatch critical alert on vaccine temperature excursions",
        status: "COMPLETED",
        latency_ms: 4720,
        tokens: 2210,
        diff: [
          {
            path: "app/alerts.py",
            lines: [
              { type: "ctx", n: 20, text: "def check_excursion(reading: Reading) -> bool:" },
              { type: "add", n: 21, text: "    if reading.temp_c > 8.0:" },
              { type: "add", n: 22, text: "        db.execute(f\"INSERT INTO alerts VALUES ('{reading.sensor_id}', {reading.temp_c})\")" },
              { type: "add", n: 23, text: "        return True" },
              { type: "ctx", n: 24, text: "    return False" },
            ],
          },
        ],
        comments: [
          {
            file_path: "app/alerts.py",
            line: 22,
            category: "Security",
            body: "SQL statement is interpolated via an f-string using untrusted `reading.sensor_id` payload. `app/db/readings.py` uses parameterized `%s` bindings—use `db.execute('INSERT INTO alerts VALUES (%s, %s)', (reading.sensor_id, reading.temp_c))` to prevent SQL injection.",
            confidence_score: 0.98,
          },
          {
            file_path: "app/alerts.py",
            line: 21,
            category: "Architecture Violation",
            body: "Hardcoded `8.0` upper bound ignores lower-bound freezing excursions (`< 2.0°C`). Reference `THRESHOLDS['vaccine']` `(2, 8)` defined in `app/config.py`.",
            confidence_score: 0.88,
          },
        ],
        context: [
          {
            file_path: "app/db/readings.py",
            symbol_name: "insert_reading",
            similarity: 0.92,
            raw_code: "def insert_reading(r: Reading) -> None:\n    db.execute('INSERT INTO readings (sensor_id, temp_c) VALUES (%s, %s)', (r.sensor_id, r.temp_c))",
          },
          {
            file_path: "app/config.py",
            symbol_name: "THRESHOLDS",
            similarity: 0.86,
            raw_code: "THRESHOLDS: dict[str, tuple[float, float]] = {\n    'vaccine': (2.0, 8.0),\n    'plasma': (-25.0, -18.0),\n}",
          },
          {
            file_path: "app/models.py",
            symbol_name: "Reading",
            similarity: 0.82,
            raw_code: "class Reading(BaseModel):\n    sensor_id: str\n    temp_c: float\n    recorded_at: datetime",
          },
        ],
      },
      {
        id: "c-14",
        pr_number: 14,
        commit_sha: "a17d44e89c02b311",
        author: "mbuensalido",
        branch: "feat/mqtt-batch-ingest",
        created_at: "1d ago",
        title: "MQTT sensor batch ingestion consumer",
        status: "COMPLETED",
        latency_ms: 3910,
        tokens: 1965,
        diff: [
          {
            path: "app/workers/ingest.py",
            lines: [
              { type: "ctx", n: 15, text: "async def process_batch(batch: list[Reading]):" },
              { type: "add", n: 16, text: "    for item in batch:" },
              { type: "add", n: 17, text: "        facility = await db.fetchrow('SELECT * FROM facilities WHERE sensor_id = $1', item.sensor_id)" },
              { type: "add", n: 18, text: "        await save_telemetry(facility['id'], item)" },
            ],
          },
        ],
        comments: [
          {
            file_path: "app/workers/ingest.py",
            line: 17,
            category: "Performance",
            body: "N+1 query inside `process_batch` loop executes a separate `SELECT` per MQTT reading. Prefetch facility mappings in a single `WHERE sensor_id = ANY($1)` query before iterating.",
            confidence_score: 0.93,
          },
        ],
        context: [
          {
            file_path: "app/db/facilities.py",
            symbol_name: "get_facilities_by_sensors",
            similarity: 0.90,
            raw_code: "async def get_facilities_by_sensors(sensor_ids: list[str]) -> dict[str, UUID]:\n    rows = await db.fetch('SELECT sensor_id, id FROM facilities WHERE sensor_id = ANY($1)', sensor_ids)\n    return {r['sensor_id']: r['id'] for r in rows}",
          },
        ],
      },
    ],
    chunks: [
      {
        id: "cc-1",
        file_path: "app/db/readings.py",
        symbol_name: "insert_reading",
        start_line: 8,
        end_line: 14,
        content_hash: "2a91f44b82c19e03d71a55c8",
        raw_code: "def insert_reading(r: Reading) -> None:\n    db.execute('INSERT INTO readings (sensor_id, temp_c) VALUES (%s, %s)', (r.sensor_id, r.temp_c))",
      },
      {
        id: "cc-2",
        file_path: "app/config.py",
        symbol_name: "THRESHOLDS",
        start_line: 1,
        end_line: 9,
        content_hash: "8e77c12d90b34f56a123e9b0",
        raw_code: "THRESHOLDS: dict[str, tuple[float, float]] = {\n    'vaccine': (2.0, 8.0),\n    'plasma': (-25.0, -18.0),\n}",
      },
    ],
  },
];
