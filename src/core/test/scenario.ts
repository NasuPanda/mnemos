import type { IsoDate } from "../dates";
import type { ScheduledItem, SectionRef } from "../day";
import type { Confidence } from "../rating";

/**
 * The design draft's Thursday, 24 September 2026, as the dashboard shows it mid-morning
 * (page 01): 38 left, 7 of them late, 9 done; Friday has 12 due.
 *
 * Sections, names, stops and delays follow the mockups where they are visible; the rest is
 * filler with the same counts. Item ids are creation order.
 */
export const TODAY: IsoDate = "2026-09-24";
export const FRIDAY: IsoDate = "2026-09-25";

export type ScenarioItem = ScheduledItem & { name: string; stop: number };

/** Sidebar order on page 01, with the left count each line shows. */
export const SECTIONS: (SectionRef & { code: string; left: number })[] = [
  { id: 1, position: 1, code: "GR", left: 8 },
  { id: 2, position: 2, code: "DS", left: 6 },
  { id: 3, position: 3, code: "DP", left: 7 },
  { id: 4, position: 4, code: "SQL", left: 5 },
  { id: 5, position: 5, code: "OS", left: 5 },
  { id: 6, position: 6, code: "NET", left: 3 },
  { id: 7, position: 7, code: "SD", left: 4 },
  { id: 8, position: 8, code: "ALG", left: 0 },
  { id: 9, position: 9, code: "PY", left: 0 },
  { id: 10, position: 10, code: "TS", left: 0 },
  { id: 11, position: 11, code: "ML", left: 0 },
  { id: 12, position: 12, code: "LA", left: 0 },
];

const [GR, DS, DP, SQL, OS, NET, SD, ALG] = [1, 2, 3, 4, 5, 6, 7, 8] as const;

let nextId = 1;
function item(sectionId: number, name: string, stop: number, dueOn: IsoDate): ScenarioItem {
  return { id: nextId++, sectionId, name, stop, dueOn };
}

/** The 38 items left today, in the order page 01 lists them within each section. */
export const LEFT_TODAY: ScenarioItem[] = [
  item(GR, "Why Dijkstra fails on negative edges", 4, "2026-09-21"), // +3 days
  item(GR, "Bellman–Ford: detect a negative cycle", 2, "2026-09-23"), // +1 day
  item(GR, "Tarjan’s strongly connected components", 5, "2026-09-23"), // +1 day
  item(GR, "Topological sort with Kahn’s algorithm", 3, TODAY),
  item(GR, "Floyd–Warshall path reconstruction", 6, TODAY),
  item(GR, "Bipartite check with BFS colouring", 1, TODAY),
  item(GR, "Kruskal vs Prim: when to use which", 2, TODAY),
  item(GR, "A* with an admissible heuristic", 3, TODAY),
  item(DS, "Union-find with path compression", 3, "2026-09-20"), // +4 days
  item(DS, "LRU cache: hash map + linked list", 5, TODAY),
  item(DS, "Binary heap siftDown", 1, TODAY),
  item(DS, "Trie: insert and prefix search", 2, TODAY),
  item(DS, "Segment tree with lazy propagation", 4, TODAY),
  item(DS, "Monotonic stack: next greater element", 6, TODAY),
  item(DP, "Edit distance with two rolling rows", 2, "2026-09-22"), // +2 days
  item(DP, "Longest increasing subsequence", 3, "2026-09-23"), // +1 day
  item(DP, "0/1 knapsack in a 1-D table", 2, TODAY),
  item(DP, "Coin change: number of ways", 4, TODAY),
  item(DP, "Matrix chain multiplication", 3, TODAY),
  item(DP, "Longest common subsequence", 5, TODAY),
  item(DP, "Bitmask DP for travelling salesman", 2, TODAY),
  item(SQL, "Running total with a window function", 3, "2026-09-23"), // +1 day
  item(SQL, "Covering index", 3, TODAY),
  item(SQL, "Isolation levels and phantom reads", 2, TODAY),
  item(SQL, "Recursive CTE for a tree", 4, TODAY),
  item(SQL, "Anti-join with NOT EXISTS", 5, TODAY),
  item(OS, "Page replacement: clock algorithm", 3, TODAY),
  item(OS, "Deadlock conditions", 4, TODAY),
  item(OS, "Copy-on-write fork", 2, TODAY),
  item(OS, "Priority inversion", 5, TODAY),
  item(OS, "Virtual memory TLB miss", 6, TODAY),
  item(NET, "TCP slow start", 3, TODAY),
  item(NET, "DNS resolution path", 2, TODAY),
  item(NET, "TLS handshake", 4, TODAY),
  item(SD, "Rate limiter design", 3, TODAY),
  item(SD, "Consistent hashing", 4, TODAY),
  item(SD, "Idempotent payment API", 5, TODAY),
  item(SD, "Read-your-writes consistency", 2, TODAY),
];

/** The 9 items reviewed this morning; their reviews moved them to later days, none to Friday. */
export const REVIEWED_THIS_MORNING: ScenarioItem[] = [
  item(GR, "Prim with a binary heap", 3, "2026-09-27"),
  item(GR, "Johnson’s algorithm", 2, "2026-09-26"),
  item(DS, "Fenwick tree", 4, "2026-10-01"),
  item(DS, "Skip list search", 3, "2026-09-27"),
  item(DP, "Rod cutting", 2, "2026-09-26"),
  item(SQL, "Composite index order", 5, "2026-10-08"),
  item(OS, "Semaphore vs mutex", 3, "2026-09-27"),
  item(NET, "HTTP/2 multiplexing", 2, "2026-09-26"),
  item(ALG, "Quickselect", 4, "2026-10-01"),
];

/** Friday's 12 items, none reviewed yet. */
export const DUE_FRIDAY: ScenarioItem[] = [
  item(GR, "Dijkstra with a binary heap", 5, FRIDAY),
  item(DS, "Red-black tree rotations", 4, FRIDAY),
  item(DS, "Bloom filter false positives", 3, FRIDAY),
  item(SQL, "Query plan: nested loop vs hash join", 4, FRIDAY),
  item(OS, "Scheduler: CFS vruntime", 5, FRIDAY),
  item(OS, "mmap vs read", 3, FRIDAY),
  item(NET, "BGP path selection", 4, FRIDAY),
  item(SD, "Write-ahead log", 5, FRIDAY),
  item(SD, "Leader election", 3, FRIDAY),
  item(ALG, "Reservoir sampling", 4, FRIDAY),
  item(ALG, "Union by rank proof", 3, FRIDAY),
  item(ALG, "Two pointers on a sorted array", 2, FRIDAY),
];

/** Items further ahead, so Friday isn't the only future day. */
export const LATER: ScenarioItem[] = [
  item(GR, "Euler tour", 6, "2026-09-26"),
  item(DS, "Treap split and merge", 5, "2026-09-27"),
  item(DP, "Digit DP", 6, "2026-10-02"),
];

export const ALL_ITEMS: ScenarioItem[] = [
  ...LEFT_TODAY,
  ...REVIEWED_THIS_MORNING,
  ...DUE_FRIDAY,
  ...LATER,
];

export const MORNING_REVIEWS = REVIEWED_THIS_MORNING.map((reviewed) => ({
  itemId: reviewed.id,
  reviewedOn: TODAY,
}));

/**
 * How the rest of Thursday goes: five items are rated Not at all and land on Friday (page 10
 * shows Bellman–Ford and both DP items there, reviewed today); everything else is Confident.
 */
export const NOT_AT_ALL_THIS_AFTERNOON = new Set([
  "Bellman–Ford: detect a negative cycle",
  "Edit distance with two rolling rows",
  "0/1 knapsack in a 1-D table",
  "Deadlock conditions",
  "TCP slow start",
]);

export function afternoonRating(item: ScenarioItem): Confidence {
  return NOT_AT_ALL_THIS_AFTERNOON.has(item.name) ? "not_at_all" : "confident";
}
