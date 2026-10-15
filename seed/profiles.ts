// Sample data for local development, the end-to-end tests and the phase 2 phone check.
// Dates are days from "today", so the sample day always looks like the design draft's Thursday.

export type Line = "m2" | "m3" | "m4";
export type Confidence = "confident" | "neutral" | "not_at_all";

export type SeedSection = { code: string; name: string; line: Line; position: number };

export type SeedItem = {
  section: string;
  name: string;
  stop: number;
  /** Days from today: negative is late. */
  dueIn: number;
  description?: string;
  problemText?: string;
  problemUrl?: string;
  problemImages?: string[];
  answerText?: string;
  answerUrl?: string;
  answerImages?: string[];
  sideNote?: string;
  /** A review made today, which moved the item to its current stop and due date. */
  reviewedToday?: { confidence: Confidence; stopBefore: number; wasDueIn: number };
};

export type Profile = {
  /** Sections in creation order; position is the person's own order. */
  sections: SeedSection[];
  /** Items in creation order. */
  items: SeedItem[];
  /** The colour counter after these sections were created. */
  nextLine: Line;
};

const DIJKSTRA: Omit<SeedItem, "section" | "stop" | "dueIn"> = {
  name: "Why Dijkstra fails on negative edges",
  description: "Shortest paths, week 4. Came up in last year’s exam.",
  problemText:
    "Run Dijkstra from S on the graph in Fig. 1. Which distance does it get wrong, and why?",
  problemUrl: "https://example.edu/algo/lecture-07.pdf",
  problemImages: ["fig1-graph.webp", "fig2-pseudocode.webp"],
  answerText: [
    "Dijkstra makes A final at distance 2 as soon as A leaves the queue. The real shortest path S → B → A costs 5 + (−4) = 1, but A is never relaxed again: Dijkstra assumes a longer prefix can never lead to a shorter path. Negative edges break that assumption.",
    "",
    "```",
    "pop S   A = 2, B = 5",
    "pop A   A is final at 2",
    "pop B   5 + (-4) = 1 < 2, too late",
    "```",
  ].join("\n"),
  answerUrl: "https://example.edu/algo/bellman-ford",
  answerImages: ["fig3-steps.webp", "fig4-compare.webp"],
  sideNote:
    "Negative weights? Reach for **Bellman–Ford**. Dijkstra only works when every weight is zero or more.",
};

/** A short problem and a Markdown answer, so every item has something to review. */
function study(name: string, topic: string, extra: Partial<SeedItem> = {}): Partial<SeedItem> {
  return {
    problemText: `Explain **${name.replace(/`/g, "")}**: what it solves, how it works, and its cost.`,
    answerText: `${topic}: state the idea in one sentence, then walk through a small example.\n\n- When to use it\n- Time and space cost\n- One common mistake`,
    ...extra,
  };
}

const CODE_ANSWER = [
  "Keep two rows and swap them:",
  "",
  "```python",
  "prev = list(range(len(b) + 1))",
  "for i, ca in enumerate(a, 1):",
  "    cur = [i]",
  "    for j, cb in enumerate(b, 1):",
  "        cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))",
  "    prev = cur",
  "```",
].join("\n");

function item(
  section: string,
  name: string,
  stop: number,
  dueIn: number,
  extra: Partial<SeedItem> = {},
): SeedItem {
  return { section, name, stop, dueIn, ...study(name, section), ...extra };
}

/** Filler for the days ahead, so the account feels like a few weeks of real use. */
const TOPICS: Record<string, string[]> = {
  GR: [
    "Euler tour",
    "Articulation points",
    "Max flow with Edmonds–Karp",
    "Minimum cut",
    "Bridges in a graph",
    "Topological order with DFS",
    "Cycle detection in a directed graph",
    "Shortest path in a DAG",
  ],
  DS: [
    "Treap split and merge",
    "Sparse table queries",
    "Rope for text editing",
    "Deque with two stacks",
    "Persistent segment tree",
    "Disjoint sparse table",
    "Van Emde Boas idea",
    "Cuckoo hashing",
  ],
  DP: [
    "Digit DP",
    "Interval DP on brackets",
    "Tree DP: maximum independent set",
    "Knuth optimisation",
    "Divide and conquer DP",
    "Profile DP on a grid",
    "Probability DP",
    "Convex hull trick",
  ],
  SQL: [
    "Gap and island queries",
    "Partial index",
    "MVCC snapshot reads",
    "Lateral join",
    "Upsert with ON CONFLICT",
    "Foreign key cascades",
    "Query plan: index-only scan",
    "Window frame: ROWS vs RANGE",
  ],
  OS: [
    "Context switch cost",
    "Lock-free queue",
    "Futex",
    "Huge pages",
    "Load balancing across cores",
    "I/O scheduler",
    "Signal handling",
    "Zombie and orphan processes",
  ],
  NET: [
    "TCP congestion window",
    "QUIC streams",
    "NAT traversal",
    "Head-of-line blocking",
    "CDN cache keys",
    "ARP",
    "IPv6 neighbour discovery",
    "TLS session resumption",
  ],
  SD: [
    "Outbox pattern",
    "Saga with compensation",
    "Backpressure",
    "Sharding by tenant",
    "Circuit breaker",
    "Hot key mitigation",
    "Read replicas lag",
    "Feature flags at scale",
  ],
  ALG: [
    "Quickselect",
    "KMP failure function",
    "Z-algorithm",
    "Manacher’s algorithm",
    "Fast exponentiation",
    "Sieve of Eratosthenes",
    "Meet in the middle",
    "Sweep line for intervals",
  ],
  PY: [
    "Generators and yield from",
    "Descriptors",
    "The GIL",
    "dataclass(slots=True)",
    "Context managers",
    "asyncio task groups",
    "functools.cache",
    "Structural pattern matching",
  ],
  TS: [
    "Conditional types",
    "Template literal types",
    "satisfies",
    "Discriminated unions",
    "Variance annotations",
    "Mapped type modifiers",
    "infer in conditional types",
    "Branded types",
  ],
  ML: [
    "Bias–variance trade-off",
    "Cross-entropy loss",
    "Gradient clipping",
    "Batch normalisation",
    "Precision vs recall",
    "Regularisation: L1 vs L2",
    "Learning-rate warm-up",
    "Attention scores",
  ],
  LA: [
    "Eigenvectors",
    "Singular value decomposition",
    "Rank and nullity",
    "Orthogonal projection",
    "Change of basis",
    "Positive definite matrices",
    "LU decomposition",
    "Gram–Schmidt",
  ],
};

/** A small deterministic random generator, so every seed gives the same account. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The design draft's Thursday (pages 01, 05 and 10): 38 left, 7 of them late, 9 done; 12 due
 * tomorrow; 12 sections in the draft's creation order and colours, with C++ deleted.
 */
export function devProfile(): Profile {
  const sections: SeedSection[] = [
    { code: "ALG", name: "Algorithms", line: "m2", position: 8 },
    { code: "DS", name: "Data structures", line: "m3", position: 2 },
    { code: "DP", name: "Dynamic programming", line: "m4", position: 3 },
    { code: "GR", name: "Graphs", line: "m2", position: 1 },
    { code: "SQL", name: "Databases", line: "m3", position: 4 },
    { code: "OS", name: "Operating systems", line: "m4", position: 5 },
    // C++ (M2) was created here and later deleted; its colour is never reused.
    { code: "NET", name: "Networks", line: "m3", position: 6 },
    { code: "SD", name: "System design", line: "m4", position: 7 },
    { code: "PY", name: "Python", line: "m2", position: 9 },
    { code: "TS", name: "TypeScript", line: "m3", position: 10 },
    { code: "ML", name: "Machine learning", line: "m4", position: 11 },
    { code: "LA", name: "Linear algebra", line: "m2", position: 12 },
  ];

  const leftToday: SeedItem[] = [
    { section: "GR", stop: 4, dueIn: -3, ...DIJKSTRA },
    item("GR", "Bellman–Ford: detect a negative cycle", 2, -1),
    item("GR", "Tarjan’s strongly connected components", 5, -1),
    item("GR", "Topological sort with Kahn’s algorithm", 3, 0),
    item("GR", "Floyd–Warshall path reconstruction", 6, 0),
    item("GR", "Bipartite check with BFS colouring", 1, 0),
    item("GR", "Kruskal vs Prim: when to use which", 2, 0),
    item("GR", "A* with an admissible heuristic", 3, 0),
    item("DS", "Union-find with path compression", 3, -4),
    item("DS", "LRU cache: hash map + linked list", 5, 0),
    item("DS", "Binary heap `siftDown`", 1, 0),
    item("DS", "Trie: insert and prefix search", 2, 0),
    item("DS", "Segment tree with lazy propagation", 4, 0, { problemImages: ["fig3-steps.webp"] }),
    item("DS", "Monotonic stack: next greater element", 6, 0),
    item("DP", "Edit distance with two rolling rows", 2, -2, { answerText: CODE_ANSWER }),
    item("DP", "Longest increasing subsequence", 3, -1),
    item("DP", "0/1 knapsack in a 1-D table", 2, 0),
    item("DP", "Coin change: number of ways", 4, 0),
    item("DP", "Matrix chain multiplication", 3, 0),
    item("DP", "Longest common subsequence", 5, 0),
    item("DP", "Bitmask DP for travelling salesman", 2, 0),
    item("SQL", "Running total with a window function", 3, -1),
    item("SQL", "Covering index", 3, 0),
    item("SQL", "Isolation levels and phantom reads", 2, 0),
    item("SQL", "Recursive CTE for a tree", 4, 0),
    item("SQL", "Anti-join with NOT EXISTS", 5, 0),
    item("OS", "Page replacement: clock algorithm", 3, 0),
    // Name only: the name is the question (pages 03, 09, 12 and 14).
    { section: "OS", name: "Mutex vs semaphore", stop: 7, dueIn: 0 },
    item("OS", "Copy-on-write fork", 2, 0),
    item("OS", "Priority inversion", 5, 0),
    item("OS", "Virtual memory TLB miss", 6, 0),
    item("NET", "TCP slow start", 3, 0),
    item("NET", "DNS resolution path", 2, 0),
    item("NET", "TLS handshake", 4, 0),
    item("SD", "Rate limiter design", 3, 0),
    item("SD", "Consistent hashing", 4, 0),
    item("SD", "Idempotent payment API", 5, 0),
    item("SD", "Read-your-writes consistency", 2, 0),
  ];

  // Reviewed this morning: each review moved the item to a later day, none to tomorrow.
  const reviewedThisMorning: SeedItem[] = [
    item("GR", "Prim with a binary heap", 3, 3, {
      reviewedToday: { confidence: "confident", stopBefore: 2, wasDueIn: 0 },
    }),
    item("GR", "Johnson’s algorithm", 2, 2, {
      reviewedToday: { confidence: "confident", stopBefore: 1, wasDueIn: -1 },
    }),
    item("DS", "Fenwick tree", 4, 5, {
      reviewedToday: { confidence: "neutral", stopBefore: 4, wasDueIn: 0 },
    }),
    item("DS", "Skip list search", 3, 3, {
      reviewedToday: { confidence: "confident", stopBefore: 2, wasDueIn: 0 },
    }),
    item("DP", "Rod cutting", 2, 2, {
      reviewedToday: { confidence: "confident", stopBefore: 1, wasDueIn: 0 },
    }),
    item("SQL", "Composite index order", 6, 14, {
      reviewedToday: { confidence: "confident", stopBefore: 5, wasDueIn: -2 },
    }),
    item("OS", "Semaphore vs condition variable", 3, 3, {
      reviewedToday: { confidence: "neutral", stopBefore: 3, wasDueIn: 0 },
    }),
    item("NET", "HTTP/2 multiplexing", 2, 2, {
      reviewedToday: { confidence: "confident", stopBefore: 1, wasDueIn: 0 },
    }),
    item("ALG", "Binary search on the answer", 4, 5, {
      reviewedToday: { confidence: "confident", stopBefore: 3, wasDueIn: 0 },
    }),
  ];

  const dueTomorrow: SeedItem[] = [
    item("GR", "Dijkstra with a binary heap", 5, 1),
    item("DS", "Red-black tree rotations", 4, 1),
    item("DS", "Bloom filter false positives", 3, 1),
    item("SQL", "Query plan: nested loop vs hash join", 4, 1),
    item("OS", "Scheduler: CFS vruntime", 5, 1),
    item("OS", "mmap vs read", 3, 1),
    item("NET", "BGP path selection", 4, 1),
    item("SD", "Write-ahead log", 5, 1),
    item("SD", "Leader election", 3, 1),
    item("ALG", "Reservoir sampling", 4, 1),
    item("ALG", "Union by rank proof", 3, 1),
    item("ALG", "Two pointers on a sorted array", 2, 1),
  ];

  // The days ahead: about 250 items over the next six weeks, never tomorrow.
  const next = random(2026);
  const later: SeedItem[] = [];
  for (let round = 1; round <= 3; round++) {
    for (const section of sections) {
      for (const topic of TOPICS[section.code] ?? []) {
        const stop = 1 + Math.floor(next() * 7);
        const dueIn = 2 + Math.floor(next() * 40);
        const name = round === 1 ? topic : `${topic} (part ${round})`;
        later.push(item(section.code, name, stop, dueIn));
      }
    }
  }

  return {
    sections,
    items: [...leftToday, ...reviewedThisMorning, ...dueTomorrow, ...later],
    nextLine: "m3",
  };
}

/** A small fixed set for the end-to-end tests: four items left today, one due tomorrow. */
export function e2eProfile(): Profile {
  return {
    sections: [
      { code: "GR", name: "Graphs", line: "m2", position: 1 },
      { code: "OS", name: "Operating systems", line: "m3", position: 2 },
    ],
    items: [
      { section: "GR", stop: 4, dueIn: -3, ...DIJKSTRA },
      item("GR", "Bellman–Ford: detect a negative cycle", 2, -1, {
        problemUrl: "https://example.edu/algo/bellman-ford",
      }),
      { section: "OS", name: "Mutex vs semaphore", stop: 7, dueIn: 0 },
      item("OS", "Page replacement: clock algorithm", 3, 0),
      item("GR", "Dijkstra with a binary heap", 5, 1),
    ],
    nextLine: "m4",
  };
}
