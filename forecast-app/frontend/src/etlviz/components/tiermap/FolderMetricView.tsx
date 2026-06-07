/**
 * FolderMetricView — Shows how sessions are bucketed into Informatica folders.
 * Displays folder cards with session counts, tier distribution, and allows
 * filtering by folder name. Click a folder to see its sessions.
 *
 * Three modes:
 *  - Metrics: Current folder card view with session detail
 *  - Dependencies: Cross-folder dependency analysis (writer→reader via shared tables)
 *  - Exec Order: Topological execution ordering of folders
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { TierMapResult, TierSession } from '../../types/tiermap';
import { useCommitSearch } from '../../hooks/useCommitSearch';

interface FolderBucket {
  name: string;
  sessions: TierSession[];
  tiers: Map<number, number>;
  workflows: Set<string>;
  avgTier: number;
  critical: number;
}

interface FolderEdge {
  fromFolder: string;
  toFolder: string;
  tables: string[];
  counts: Record<string, number>;
  total: number;
}

interface FolderDepSummary {
  name: string;
  totalWrites: number;
  totalReads: number;
  totalLookups: number;
  totalChains: number;
  crossFolderLinks: number;
  execOrder: number;
}

type ViewMode = 'metrics' | 'dependencies' | 'execorder';

const T = {
  bg: '#0f172a', surface: '#1e293b', border: '#334155',
  text: '#e2e8f0', muted: '#94a3b8', accent: '#3b82f6',
  accentBg: 'rgba(59,130,246,0.1)',
  green: '#10B981', orange: '#F97316', purple: '#A855F7', red: '#ef4444',
  yellow: '#EAB308', cyan: '#06B6D4',
};

function tierColor(t: number): string {
  const p = ['#3B82F6','#EAB308','#A855F7','#10B981','#F97316','#06B6D4','#EC4899','#84CC16'];
  return p[Math.max(0, Math.floor(t) - 1) % p.length];
}

/** Build folder dependency graph from tier data. All client-side computation. */
function buildFolderDepGraph(data: TierMapResult) {
  // 1. sessionId → folder
  const sessionFolder = new Map<string, string>();
  for (const s of data.sessions) {
    const fname = s.folder || s.full.split('.')[0] || '(unknown)';
    sessionFolder.set(s.id, fname);
  }

  // 2. tableId → tableName
  const tableNameMap = new Map<string, string>();
  for (const t of data.tables) {
    tableNameMap.set(t.id, t.name);
  }

  // 3. For each table, track which folders write to it and read from it
  const tableWriters = new Map<string, Set<string>>(); // tableName → writer folders
  const tableReaders = new Map<string, Set<string>>(); // tableName → reader folders

  for (const conn of data.connections) {
    const connType = conn.type;
    if (connType === 'write_conflict' || connType === 'write_clean') {
      // from=Session, to=Table
      const folder = sessionFolder.get(conn.from);
      const tableName = tableNameMap.get(conn.to);
      if (folder && tableName) {
        if (!tableWriters.has(tableName)) tableWriters.set(tableName, new Set());
        tableWriters.get(tableName)!.add(folder);
      }
    } else if (connType === 'read_after_write' || connType === 'source_read' || connType === 'lookup_stale') {
      // from=Table, to=Session
      const tableName = tableNameMap.get(conn.from);
      const folder = sessionFolder.get(conn.to);
      if (folder && tableName) {
        if (!tableReaders.has(tableName)) tableReaders.set(tableName, new Set());
        tableReaders.get(tableName)!.add(folder);
      }
    } else if (connType === 'chain') {
      // chain: bidirectional — from=Session(writer), to=Session(reader) conceptually
      // but actually from and to can be session or table; handle both
      const fromFolder = sessionFolder.get(conn.from);
      const toFolder = sessionFolder.get(conn.to);
      if (fromFolder && toFolder && fromFolder !== toFolder) {
        // We'll handle chains as a special edge type below
      }
    }
  }

  // 4. Build edges: for each table with writers in folder A and readers in folder B (A≠B)
  const edgeMap = new Map<string, FolderEdge>(); // "A→B" → edge

  for (const [tableName, writers] of tableWriters.entries()) {
    const readers = tableReaders.get(tableName);
    if (!readers) continue;
    for (const wFolder of writers) {
      for (const rFolder of readers) {
        if (wFolder === rFolder) continue;
        const key = `${wFolder}→${rFolder}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { fromFolder: wFolder, toFolder: rFolder, tables: [], counts: {}, total: 0 });
        }
        const edge = edgeMap.get(key)!;
        if (!edge.tables.includes(tableName)) {
          edge.tables.push(tableName);
        }
        edge.total++;
      }
    }
  }

  // Also count by connection type for each edge
  for (const conn of data.connections) {
    const connType = conn.type;
    let writerFolder: string | undefined;
    let readerFolder: string | undefined;

    if (connType === 'write_conflict' || connType === 'write_clean') {
      writerFolder = sessionFolder.get(conn.from);
      const tableName = tableNameMap.get(conn.to);
      if (writerFolder && tableName) {
        const readers = tableReaders.get(tableName);
        if (readers) {
          for (const rFolder of readers) {
            if (rFolder === writerFolder) continue;
            const key = `${writerFolder}→${rFolder}`;
            const edge = edgeMap.get(key);
            if (edge) {
              edge.counts[connType] = (edge.counts[connType] || 0) + 1;
            }
          }
        }
      }
    } else if (connType === 'read_after_write' || connType === 'source_read' || connType === 'lookup_stale') {
      const tableName = tableNameMap.get(conn.from);
      readerFolder = sessionFolder.get(conn.to);
      if (tableName && readerFolder) {
        const writers = tableWriters.get(tableName);
        if (writers) {
          for (const wFolder of writers) {
            if (wFolder === readerFolder) continue;
            const key = `${wFolder}→${readerFolder}`;
            const edge = edgeMap.get(key);
            if (edge) {
              edge.counts[connType] = (edge.counts[connType] || 0) + 1;
            }
          }
        }
      }
    }
  }

  const edges = Array.from(edgeMap.values());

  // 5. Per-folder dependency summaries
  const folderNames = new Set<string>(sessionFolder.values());
  const summaryMap = new Map<string, FolderDepSummary>();
  for (const name of folderNames) {
    summaryMap.set(name, {
      name,
      totalWrites: 0,
      totalReads: 0,
      totalLookups: 0,
      totalChains: 0,
      crossFolderLinks: 0,
      execOrder: -1,
    });
  }

  // Count per-folder connection types
  for (const conn of data.connections) {
    const connType = conn.type;
    let folder: string | undefined;
    if (connType === 'write_conflict' || connType === 'write_clean') {
      folder = sessionFolder.get(conn.from);
      if (folder) summaryMap.get(folder)!.totalWrites++;
    } else if (connType === 'read_after_write' || connType === 'source_read') {
      folder = sessionFolder.get(conn.to);
      if (folder) summaryMap.get(folder)!.totalReads++;
    } else if (connType === 'lookup_stale') {
      folder = sessionFolder.get(conn.to);
      if (folder) summaryMap.get(folder)!.totalLookups++;
    } else if (connType === 'chain') {
      const f1 = sessionFolder.get(conn.from);
      const f2 = sessionFolder.get(conn.to);
      if (f1) summaryMap.get(f1)!.totalChains++;
      if (f2 && f2 !== f1) summaryMap.get(f2)!.totalChains++;
    }
  }

  for (const edge of edges) {
    const fromSummary = summaryMap.get(edge.fromFolder);
    const toSummary = summaryMap.get(edge.toFolder);
    if (fromSummary) fromSummary.crossFolderLinks++;
    if (toSummary) toSummary.crossFolderLinks++;
  }

  // 6. Topological sort (Kahn's algorithm) for execution order
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, Set<string>>();
  for (const name of folderNames) {
    inDegree.set(name, 0);
    adjList.set(name, new Set());
  }
  for (const edge of edges) {
    if (!adjList.get(edge.fromFolder)!.has(edge.toFolder)) {
      adjList.get(edge.fromFolder)!.add(edge.toFolder);
      inDegree.set(edge.toFolder, (inDegree.get(edge.toFolder) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(name);
  }
  queue.sort(); // deterministic order for equal in-degree

  const topoOrder: string[] = [];
  let hasCycle = false;
  while (queue.length > 0) {
    const node = queue.shift()!;
    topoOrder.push(node);
    for (const neighbor of adjList.get(node) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        // Insert sorted for determinism
        const idx = queue.findIndex(q => q.localeCompare(neighbor) > 0);
        if (idx === -1) queue.push(neighbor);
        else queue.splice(idx, 0, neighbor);
      }
    }
  }

  // Detect cycles: nodes not in topoOrder
  const cycleNodes: string[] = [];
  for (const name of folderNames) {
    if (!topoOrder.includes(name)) {
      cycleNodes.push(name);
    }
  }
  if (cycleNodes.length > 0) {
    hasCycle = true;
    cycleNodes.sort();
    topoOrder.push(...cycleNodes);
  }

  // Assign exec order
  for (let i = 0; i < topoOrder.length; i++) {
    const s = summaryMap.get(topoOrder[i]);
    if (s) s.execOrder = i + 1;
  }

  const summaries = Array.from(summaryMap.values());

  return { edges, summaries, topoOrder, hasCycle, cycleNodes };
}

export default function FolderMetricView({ data }: { data: TierMapResult }) {
  const { committedValue: search, inputProps: searchInputProps } = useCommitSearch();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'sessions' | 'name' | 'tier'>('sessions');
  const [sessionSearch, setSessionSearch] = useState('');
  const [mode, setMode] = useState<ViewMode>('metrics');

  // Build folder buckets from session data
  const folders = useMemo(() => {
    const map = new Map<string, FolderBucket>();
    for (const s of data.sessions) {
      const fname = s.folder || s.full.split('.')[0] || '(unknown)';
      let bucket = map.get(fname);
      if (!bucket) {
        bucket = { name: fname, sessions: [], tiers: new Map(), workflows: new Set(), avgTier: 0, critical: 0 };
        map.set(fname, bucket);
      }
      bucket.sessions.push(s);
      bucket.tiers.set(Math.floor(s.tier), (bucket.tiers.get(Math.floor(s.tier)) || 0) + 1);
      if (s.workflow) bucket.workflows.add(s.workflow);
      if (s.critical) bucket.critical++;
    }
    for (const b of map.values()) {
      b.avgTier = b.sessions.reduce((acc, s) => acc + s.tier, 0) / b.sessions.length;
    }
    return Array.from(map.values());
  }, [data.sessions]);

  // Dependency graph (computed once, used by Dependencies + Exec Order modes)
  const depGraph = useMemo(() => buildFolderDepGraph(data), [data]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = folders;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === 'sessions') return b.sessions.length - a.sessions.length;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a.avgTier - b.avgTier;
    });
    return result;
  }, [folders, search, sortBy]);

  const selectedBucket = useMemo(() => {
    if (!selectedFolder) return null;
    return folders.find(f => f.name === selectedFolder) || null;
  }, [selectedFolder, folders]);

  const filteredSessions = useMemo(() => {
    if (!selectedBucket) return [];
    if (!sessionSearch.trim()) return selectedBucket.sessions;
    const q = sessionSearch.toLowerCase();
    return selectedBucket.sessions.filter(s =>
      s.name.toLowerCase().includes(q) || s.full.toLowerCase().includes(q)
    );
  }, [selectedBucket, sessionSearch]);

  // Edges for selected folder in dependency mode
  const selectedFolderEdges = useMemo(() => {
    if (!selectedFolder) return { upstream: [] as FolderEdge[], downstream: [] as FolderEdge[] };
    return {
      upstream: depGraph.edges.filter(e => e.toFolder === selectedFolder),
      downstream: depGraph.edges.filter(e => e.fromFolder === selectedFolder),
    };
  }, [selectedFolder, depGraph.edges]);

  const selectedDepSummary = useMemo(() => {
    if (!selectedFolder) return null;
    return depGraph.summaries.find(s => s.name === selectedFolder) || null;
  }, [selectedFolder, depGraph.summaries]);

  const handleFolderClick = useCallback((name: string) => {
    setSelectedFolder(prev => prev === name ? null : name);
    setSessionSearch('');
  }, []);

  // Stats
  const totalFolders = folders.length;
  const maxSessions = folders.reduce((m, f) => Math.max(m, f.sessions.length), 0);

  const hasCrossFolderDeps = depGraph.edges.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Mode toggle bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
        {([
          ['metrics', 'Metrics'],
          ['dependencies', 'Dependencies'],
          ['execorder', 'Exec Order'],
        ] as [ViewMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '8px 20px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: 'none', borderBottom: `2px solid ${mode === m ? T.accent : 'transparent'}`,
              background: mode === m ? T.accentBg : 'transparent',
              color: mode === m ? T.accent : T.muted,
              fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.muted, padding: '10px 12px', alignSelf: 'center' }}>
          {totalFolders} folders · {depGraph.edges.length} cross-folder links
        </span>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {mode === 'metrics' && (
          <MetricsMode
            folders={folders}
            filtered={filtered}
            selectedFolder={selectedFolder}
            selectedBucket={selectedBucket}
            filteredSessions={filteredSessions}
            sessionSearch={sessionSearch}
            setSessionSearch={setSessionSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
            searchInputProps={searchInputProps}
            search={search}
            handleFolderClick={handleFolderClick}
            setSelectedFolder={setSelectedFolder}
            totalFolders={totalFolders}
            maxSessions={maxSessions}
            totalSessions={data.sessions.length}
          />
        )}

        {mode === 'dependencies' && (
          <DependenciesMode
            folders={folders}
            filtered={filtered}
            selectedFolder={selectedFolder}
            handleFolderClick={handleFolderClick}
            searchInputProps={searchInputProps}
            search={search}
            depGraph={depGraph}
            selectedFolderEdges={selectedFolderEdges}
            selectedDepSummary={selectedDepSummary}
            hasCrossFolderDeps={hasCrossFolderDeps}
            setSelectedFolder={setSelectedFolder}
            totalFolders={totalFolders}
            sortBy={sortBy}
            setSortBy={setSortBy}
            maxSessions={maxSessions}
          />
        )}

        {mode === 'execorder' && (
          <ExecOrderMode
            depGraph={depGraph}
            folders={folders}
            selectedFolder={selectedFolder}
            handleFolderClick={handleFolderClick}
            selectedFolderEdges={selectedFolderEdges}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Metrics Mode (original view) ─────────────────────────────────────── */

function MetricsMode({
  filtered, selectedFolder, selectedBucket, filteredSessions,
  sessionSearch, setSessionSearch, sortBy, setSortBy,
  searchInputProps, handleFolderClick, setSelectedFolder,
  totalFolders, maxSessions, totalSessions,
}: {
  folders: FolderBucket[];
  filtered: FolderBucket[];
  selectedFolder: string | null;
  selectedBucket: FolderBucket | null;
  filteredSessions: TierSession[];
  sessionSearch: string;
  setSessionSearch: (v: string) => void;
  sortBy: 'sessions' | 'name' | 'tier';
  setSortBy: (v: 'sessions' | 'name' | 'tier') => void;
  searchInputProps: Record<string, unknown>;
  search: string;
  handleFolderClick: (name: string) => void;
  setSelectedFolder: (v: string | null) => void;
  totalFolders: number;
  maxSessions: number;
  totalSessions: number;
}) {
  return (
    <>
      {/* Left: Folder list */}
      <div style={{ width: 420, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              Folders ({totalFolders})
            </span>
            <span style={{ fontSize: 10, color: T.muted }}>
              {totalSessions} sessions total
            </span>
          </div>
          <input
            type="text"
            {...searchInputProps}
            placeholder="Filter folders... (Enter to search)"
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 6,
              border: `1px solid ${T.border}`, background: T.bg, color: T.text,
              fontSize: 11, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {(['sessions', 'name', 'tier'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                  border: `1px solid ${sortBy === s ? T.accent : T.border}`,
                  background: sortBy === s ? T.accentBg : 'transparent',
                  color: sortBy === s ? T.accent : T.muted,
                  fontFamily: 'inherit',
                }}
              >
                {s === 'sessions' ? '# Sessions' : s === 'name' ? 'Name' : 'Avg Tier'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {filtered.map(f => (
            <FolderCard
              key={f.name}
              folder={f}
              isSelected={selectedFolder === f.name}
              maxSessions={maxSessions}
              onClick={() => handleFolderClick(f.name)}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>
              No folders match filter
            </div>
          )}
        </div>
      </div>

      {/* Right: Session detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedBucket ? (
          <>
            <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: T.text }}>{selectedBucket.name}</h3>
                  <span style={{ fontSize: 11, color: T.muted }}>
                    {selectedBucket.sessions.length} sessions · {selectedBucket.workflows.size} workflows · avg tier {selectedBucket.avgTier.toFixed(1)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFolder(null)}
                  style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 10px', color: T.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
                >
                  Close
                </button>
              </div>
              <input
                type="text"
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                placeholder="Filter sessions in this folder..."
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, marginTop: 10,
                  border: `1px solid ${T.border}`, background: T.bg, color: T.text,
                  fontSize: 11, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: T.muted, fontWeight: 600 }}>Session</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: T.muted, fontWeight: 600 }}>Workflow</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', color: T.muted, fontWeight: 600 }}>Tier</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', color: T.muted, fontWeight: 600 }}>Transforms</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', color: T.muted, fontWeight: 600 }}>Sources</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', color: T.muted, fontWeight: 600 }}>Targets</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', color: T.muted, fontWeight: 600 }}>Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(s => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}22` }}>
                      <td style={{ padding: '6px 8px', color: T.text, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.full}>
                        {s.name}
                      </td>
                      <td style={{ padding: '6px 8px', color: T.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.workflow || '-'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                        <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, background: `${tierColor(s.tier)}20`, color: tierColor(s.tier) }}>
                          T{Math.floor(s.tier)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px 8px', color: T.muted }}>{s.transforms}</td>
                      <td style={{ textAlign: 'center', padding: '6px 8px', color: T.muted }}>{s.sources?.length || 0}</td>
                      <td style={{ textAlign: 'center', padding: '6px 8px', color: T.muted }}>{s.targets?.length || 0}</td>
                      <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                        {s.critical ? <span style={{ color: '#ef4444' }}>●</span> : <span style={{ color: T.border }}>○</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSessions.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>
                  No sessions match filter
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 32, opacity: 0.3 }}>📁</span>
            <span style={{ fontSize: 13, color: T.muted }}>Select a folder to see its sessions</span>
            <span style={{ fontSize: 11, color: T.border }}>
              {totalFolders} folders · {totalSessions} sessions
            </span>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Dependencies Mode ────────────────────────────────────────────────── */

function DependenciesMode({
  filtered, selectedFolder, handleFolderClick,
  searchInputProps, depGraph, selectedFolderEdges,
  selectedDepSummary, hasCrossFolderDeps, setSelectedFolder,
  totalFolders, sortBy, setSortBy, maxSessions,
}: {
  folders: FolderBucket[];
  filtered: FolderBucket[];
  selectedFolder: string | null;
  handleFolderClick: (name: string) => void;
  searchInputProps: Record<string, unknown>;
  search: string;
  depGraph: ReturnType<typeof buildFolderDepGraph>;
  selectedFolderEdges: { upstream: FolderEdge[]; downstream: FolderEdge[] };
  selectedDepSummary: FolderDepSummary | null;
  hasCrossFolderDeps: boolean;
  setSelectedFolder: (v: string | null) => void;
  totalFolders: number;
  sortBy: 'sessions' | 'name' | 'tier';
  setSortBy: (v: 'sessions' | 'name' | 'tier') => void;
  maxSessions: number;
}) {
  // Sort folders by cross-folder link count in dependency mode
  const depSorted = useMemo(() => {
    const summaryByName = new Map(depGraph.summaries.map(s => [s.name, s]));
    return [...filtered].sort((a, b) => {
      const aLinks = summaryByName.get(a.name)?.crossFolderLinks || 0;
      const bLinks = summaryByName.get(b.name)?.crossFolderLinks || 0;
      return bLinks - aLinks;
    });
  }, [filtered, depGraph.summaries]);

  const summaryByName = useMemo(() =>
    new Map(depGraph.summaries.map(s => [s.name, s])),
    [depGraph.summaries]
  );

  return (
    <>
      {/* Left: Folder list with dep counts */}
      <div style={{ width: 420, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              Folder Dependencies ({totalFolders})
            </span>
          </div>
          <input
            type="text"
            {...searchInputProps}
            placeholder="Filter folders... (Enter to search)"
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 6,
              border: `1px solid ${T.border}`, background: T.bg, color: T.text,
              fontSize: 11, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {depSorted.map(f => {
            const isSelected = selectedFolder === f.name;
            const summary = summaryByName.get(f.name);
            const links = summary?.crossFolderLinks || 0;
            return (
              <div
                key={f.name}
                onClick={() => handleFolderClick(f.name)}
                style={{
                  padding: '10px 12px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${isSelected ? T.accent : T.border}`,
                  background: isSelected ? T.accentBg : T.surface,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? T.accent : T.text, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: links > 0 ? T.orange : T.muted }}>
                    {links} link{links !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 9, color: T.muted }}>
                  <span>{f.sessions.length} sessions</span>
                  {summary && (
                    <>
                      <span style={{ color: T.green }}>{summary.totalWrites}W</span>
                      <span style={{ color: T.cyan }}>{summary.totalReads}R</span>
                      {summary.totalLookups > 0 && <span style={{ color: T.yellow }}>{summary.totalLookups}L</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {depSorted.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>
              No folders match filter
            </div>
          )}
        </div>
      </div>

      {/* Right: Dependency detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedFolder && selectedDepSummary ? (
          <>
            <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: T.text }}>{selectedFolder}</h3>
                  <span style={{ fontSize: 11, color: T.muted }}>
                    {selectedDepSummary.totalWrites} writes · {selectedDepSummary.totalReads} reads · {selectedDepSummary.crossFolderLinks} cross-folder links
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFolder(null)}
                  style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 10px', color: T.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {!hasCrossFolderDeps ? (
                <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>
                  No cross-folder dependencies detected in this upload
                </div>
              ) : (
                <>
                  {/* Depends On (upstream) */}
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: T.green, fontWeight: 700 }}>
                      Depends On ({selectedFolderEdges.upstream.length} folder{selectedFolderEdges.upstream.length !== 1 ? 's' : ''})
                    </h4>
                    {selectedFolderEdges.upstream.length === 0 ? (
                      <div style={{ fontSize: 11, color: T.muted, padding: '8px 0' }}>No upstream folder dependencies</div>
                    ) : (
                      selectedFolderEdges.upstream.map(edge => (
                        <EdgeCard key={edge.fromFolder} edge={edge} label={edge.fromFolder} direction="upstream" />
                      ))
                    )}
                  </div>

                  {/* Depended By (downstream) */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: T.orange, fontWeight: 700 }}>
                      Depended By ({selectedFolderEdges.downstream.length} folder{selectedFolderEdges.downstream.length !== 1 ? 's' : ''})
                    </h4>
                    {selectedFolderEdges.downstream.length === 0 ? (
                      <div style={{ fontSize: 11, color: T.muted, padding: '8px 0' }}>No downstream folder dependents</div>
                    ) : (
                      selectedFolderEdges.downstream.map(edge => (
                        <EdgeCard key={edge.toFolder} edge={edge} label={edge.toFolder} direction="downstream" />
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 32, opacity: 0.3 }}>🔗</span>
            <span style={{ fontSize: 13, color: T.muted }}>Select a folder to see its dependencies</span>
            {!hasCrossFolderDeps && (
              <span style={{ fontSize: 11, color: T.yellow, marginTop: 4 }}>
                No cross-folder dependencies detected
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Edge Card (shared component for dependency display) ──────────────── */

function EdgeCard({ edge, label, direction }: { edge: FolderEdge; label: string; direction: 'upstream' | 'downstream' }) {
  const [expanded, setExpanded] = useState(false);
  const accentColor = direction === 'upstream' ? T.green : T.orange;

  return (
    <div
      style={{
        padding: '10px 12px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${T.border}`, background: T.surface,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: accentColor }}>
          {direction === 'upstream' ? '← ' : '→ '}{label}
        </span>
        <span style={{ fontSize: 10, color: T.muted }}>
          {edge.tables.length} table{edge.tables.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Type breakdown */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        {Object.entries(edge.counts).map(([type, count]) => (
          <span key={type} style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: `${connTypeColor(type)}20`, color: connTypeColor(type),
          }}>
            {connTypeLabel(type)}: {count}
          </span>
        ))}
      </div>

      {/* Expanded: show bridging tables */}
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>Bridging tables:</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {edge.tables.map(t => (
              <span key={t} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 3,
                background: `${T.accent}15`, color: T.accent, border: `1px solid ${T.accent}30`,
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function connTypeColor(type: string): string {
  switch (type) {
    case 'write_conflict': return T.red;
    case 'write_clean': return T.green;
    case 'read_after_write': return T.cyan;
    case 'source_read': return T.accent;
    case 'lookup_stale': return T.yellow;
    default: return T.muted;
  }
}

function connTypeLabel(type: string): string {
  switch (type) {
    case 'write_conflict': return 'write conflict';
    case 'write_clean': return 'write';
    case 'read_after_write': return 'read-after-write';
    case 'source_read': return 'source read';
    case 'lookup_stale': return 'lookup';
    default: return type;
  }
}

/* ─── Exec Order Mode ──────────────────────────────────────────────────── */

function ExecOrderMode({
  depGraph, folders, selectedFolder, handleFolderClick, selectedFolderEdges,
}: {
  depGraph: ReturnType<typeof buildFolderDepGraph>;
  folders: FolderBucket[];
  selectedFolder: string | null;
  handleFolderClick: (name: string) => void;
  selectedFolderEdges: { upstream: FolderEdge[]; downstream: FolderEdge[] };
}) {
  const folderByName = useMemo(() =>
    new Map(folders.map(f => [f.name, f])),
    [folders]
  );

  const summaryByName = useMemo(() =>
    new Map(depGraph.summaries.map(s => [s.name, s])),
    [depGraph.summaries]
  );

  return (
    <>
      {/* Left: Timeline */}
      <div style={{ width: 480, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
            Execution Order
          </span>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>
            Topological ordering based on folder dependencies
          </div>
          {depGraph.hasCycle && (
            <div style={{ fontSize: 10, color: T.red, marginTop: 4, padding: '4px 8px', borderRadius: 4, background: `${T.red}15`, border: `1px solid ${T.red}30` }}>
              Cycle detected — {depGraph.cycleNodes.length} folder{depGraph.cycleNodes.length !== 1 ? 's' : ''} in dependency cycle: {depGraph.cycleNodes.join(', ')}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {depGraph.topoOrder.map((name, idx) => {
            const isSelected = selectedFolder === name;
            const folder = folderByName.get(name);
            const summary = summaryByName.get(name);
            const isCycleNode = depGraph.cycleNodes.includes(name);
            const upstreamEdges = depGraph.edges.filter(e => e.toFolder === name);

            return (
              <div key={name} style={{ display: 'flex', gap: 12, marginBottom: 2 }}>
                {/* Timeline line + node */}
                <div style={{ width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    background: isCycleNode ? `${T.red}30` : isSelected ? T.accentBg : T.surface,
                    border: `2px solid ${isCycleNode ? T.red : isSelected ? T.accent : T.border}`,
                    color: isCycleNode ? T.red : isSelected ? T.accent : T.muted,
                  }}>
                    {idx + 1}
                  </div>
                  {idx < depGraph.topoOrder.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: T.border, minHeight: 8 }} />
                  )}
                </div>

                {/* Card */}
                <div
                  onClick={() => handleFolderClick(name)}
                  style={{
                    flex: 1, padding: '8px 12px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${isSelected ? T.accent : isCycleNode ? T.red + '50' : T.border}`,
                    background: isSelected ? T.accentBg : T.surface,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? T.accent : isCycleNode ? T.red : T.text, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </span>
                    <span style={{ fontSize: 10, color: T.muted }}>
                      {folder?.sessions.length || 0} sessions
                    </span>
                  </div>
                  {upstreamEdges.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, color: T.muted }}>after:</span>
                      {upstreamEdges.map(e => (
                        <span key={e.fromFolder} style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 3,
                          background: `${T.green}15`, color: T.green,
                        }}>
                          {e.fromFolder}
                        </span>
                      ))}
                    </div>
                  )}
                  {isCycleNode && (
                    <div style={{ fontSize: 9, color: T.red, marginTop: 4 }}>
                      Part of dependency cycle
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {depGraph.topoOrder.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>
              No folder dependencies to order
            </div>
          )}
        </div>
      </div>

      {/* Right: Selected folder detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedFolder ? (
          <>
            <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
              <h3 style={{ margin: 0, fontSize: 16, color: T.text }}>{selectedFolder}</h3>
              <span style={{ fontSize: 11, color: T.muted }}>
                Exec position #{summaryByName.get(selectedFolder)?.execOrder || '?'}
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {selectedFolderEdges.upstream.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: T.green }}>
                    Must run after ({selectedFolderEdges.upstream.length})
                  </h4>
                  {selectedFolderEdges.upstream.map(edge => (
                    <EdgeCard key={edge.fromFolder} edge={edge} label={edge.fromFolder} direction="upstream" />
                  ))}
                </div>
              )}
              {selectedFolderEdges.downstream.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: T.orange }}>
                    Must run before ({selectedFolderEdges.downstream.length})
                  </h4>
                  {selectedFolderEdges.downstream.map(edge => (
                    <EdgeCard key={edge.toFolder} edge={edge} label={edge.toFolder} direction="downstream" />
                  ))}
                </div>
              )}
              {selectedFolderEdges.upstream.length === 0 && selectedFolderEdges.downstream.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>
                  No cross-folder dependencies for this folder
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 32, opacity: 0.3 }}>⏱</span>
            <span style={{ fontSize: 13, color: T.muted }}>Select a folder to see execution details</span>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Shared: Folder Card ──────────────────────────────────────────────── */

function FolderCard({ folder, isSelected, maxSessions, onClick }: {
  folder: FolderBucket; isSelected: boolean; maxSessions: number; onClick: () => void;
}) {
  const pct = maxSessions > 0 ? (folder.sessions.length / maxSessions) * 100 : 0;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${isSelected ? T.accent : T.border}`,
        background: isSelected ? T.accentBg : T.surface,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? T.accent : T.text, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {folder.name}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>
          {folder.sessions.length}
        </span>
      </div>

      <div style={{ height: 4, borderRadius: 2, background: T.bg, marginBottom: 6 }}>
        <div style={{ height: '100%', borderRadius: 2, background: T.accent, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Array.from(folder.tiers.entries()).sort((a, b) => a[0] - b[0]).map(([tier, count]) => (
          <span key={tier} style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: `${tierColor(tier)}20`, color: tierColor(tier),
          }}>
            T{tier}: {count}
          </span>
        ))}
        {folder.critical > 0 && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#ef444420', color: '#ef4444' }}>
            {folder.critical} critical
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: T.muted }}>{folder.workflows.size} workflow{folder.workflows.size !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 9, color: T.muted }}>avg tier {folder.avgTier.toFixed(1)}</span>
      </div>
    </div>
  );
}
