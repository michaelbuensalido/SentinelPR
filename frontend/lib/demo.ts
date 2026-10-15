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
        title: "Make getClimbs return paginated result",
        status: "COMPLETED",
        latency_ms: 4200,
        tokens: 1840,
        diff: [
          {
            path: "src/api/climbs.ts",
            lines: [
              { type: "ctx", n: 10, text: "export async function getClimbs(gymId: string) {" },
              { type: "del", text: "  return db.select().from(climbs).where(eq(climbs.gymId, gymId));" },
              { type: "add", n: 11, text: "  const rows = await db.select().from(climbs).where(eq(climbs.gymId, gymId));" },
              { type: "add", n: 12, text: "  return { items: rows, nextCursor: null };" },
              { type: "ctx", n: 13, text: "}" },
            ],
          },
        ],
        comments: [
          {
            file_path: "src/api/climbs.ts",
            line: 12,
            category: "Breaking Change",
            body: "`getClimbs` now returns `{ items, nextCursor }` instead of `Climb[]`. `src/screens/GymScreen.tsx` calls `.map()` directly on the result and will crash at runtime.",
            confidence_score: 0.94,
          },
        ],
        context: [
          { file_path: "src/screens/GymScreen.tsx", symbol_name: "GymScreen", similarity: 0.91, raw_code: "const climbs = await getClimbs(gym.id);\nreturn climbs.map((c) => <ClimbRow key={c.id} {...c} />);" },
          { file_path: "src/db/schema.ts", symbol_name: "climbs", similarity: 0.89, raw_code: "export const climbs = pgTable('climbs', {\n  id: uuid('id').primaryKey(),\n  gymId: uuid('gym_id').notNull(),\n});" },
          { file_path: "src/hooks/useClimbs.ts", symbol_name: "useClimbs", similarity: 0.84, raw_code: "export function useClimbs(gymId: string) {\n  return useQuery(['climbs', gymId], () => getClimbs(gymId));\n}" },
        ],
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
        title: "Alert on temperature excursions",
        status: "COMPLETED",
        latency_ms: 5100,
        tokens: 2210,
        diff: [
          {
            path: "app/alerts.py",
            lines: [
              { type: "ctx", n: 20, text: "def check_excursion(reading):" },
              { type: "add", n: 21, text: "    if reading.temp_c > 8:" },
              { type: "add", n: 22, text: "        db.execute(f\"INSERT INTO alerts VALUES ({reading.sensor_id}, {reading.temp_c})\")" },
            ],
          },
        ],
        comments: [
          {
            file_path: "app/alerts.py",
            line: 22,
            category: "Security",
            body: "SQL built with an f-string from sensor input. Other writers (`app/db/readings.py`) use parameterized queries; use the same here to avoid SQL injection.",
            confidence_score: 0.97,
          },
        ],
        context: [
          { file_path: "app/db/readings.py", symbol_name: "insert_reading", similarity: 0.88, raw_code: "def insert_reading(r):\n    db.execute('INSERT INTO readings VALUES (%s, %s)', (r.sensor_id, r.temp_c))" },
          { file_path: "app/models.py", symbol_name: "Reading", similarity: 0.82, raw_code: "class Reading(BaseModel):\n    sensor_id: str\n    temp_c: float" },
          { file_path: "app/config.py", symbol_name: "THRESHOLDS", similarity: 0.77, raw_code: "THRESHOLDS = {'vaccine': (2, 8)}" },
        ],
      },
    ],
  },
];
