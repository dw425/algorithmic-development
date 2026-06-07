/**
 * FolderDependencyDiagram — Visual tier diagram showing folder-to-folder
 * connections via shared tables, using SVG Bezier curves colored by type.
 *
 * Each folder is a node positioned by its topological execution order (Y axis).
 * Connections between folders are drawn as colored SVG curves:
 *   - Red: write_conflict (multiple folders writing same table)
 *   - Blue: write_clean (clean writes consumed downstream)
 *   - Purple: read_after_write
 *   - Green: source_read
 *   - Amber: lookup_stale
 *   - Orange: chain
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TierMapResult } from '../../types/tiermap';
import { useCommitSearch } from '../../hooks/useCommitSearch';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface FolderNode {
  name: string;
  sessionCount: number;
  tier: number;        // topological tier (grouped by depth)
  writeCount: number;
  readCount: number;
  lookupCount: number;
  critical: number;
  workflows: number;
}

interface FolderConn {
  from: string;   // writer folder name
  to: string;     // reader folder name
  type: string;   // dominant connection type
  tables: string[];
  counts: Record<string, number>;
  total: number;
}

interface LineData {
  fX: number; fY: number; tX: number; tY: number;
  color: string; dash: string; th: number;
  isAct: boolean; isDim: boolean; type: string;
}

/* ── Connection type styles (matching TierDiagram) ─────────────────────── */

const CONN_STYLES: Record<string, { color: string; label: string; dash: string; baseWidth: number }> = {
  write_conflict: { color: '#EF4444', label: 'Write Conflict', dash: '', baseWidth: 3 },
  write_clean:    { color: '#3B82F6', label: 'Clean Write', dash: '', baseWidth: 2 },
  read_after_write: { color: '#A855F7', label: 'Read-After-Write', dash: '', baseWidth: 2 },
  lookup_stale:   { color: '#F59E0B', label: 'Lookup Staleness', dash: '6,3', baseWidth: 2 },
  chain:          { color: '#F97316', label: 'Dep Chain', dash: '', baseWidth: 2.5 },
  source_read:    { color: '#10B981', label: 'Source Read', dash: '', baseWidth: 1.5 },
  mixed:          { color: '#94A3B8', label: 'Mixed', dash: '', baseWidth: 2 },
};

const T = {
  bg: '#0f172a', surface: '#1e293b', border: '#334155',
  text: '#e2e8f0', muted: '#94a3b8', accent: '#3b82f6',
  accentBg: 'rgba(59,130,246,0.1)',
  red: '#EF4444', green: '#10B981', orange: '#F97316', purple: '#A855F7',
  yellow: '#F59E0B', cyan: '#06B6D4',
};

/* ── Build folder graph from tier data ─────────────────────────────────── */

function buildFolderGraph(data: TierMapResult) {
  // Session → folder
  const sessionFolder = new Map<string, string>();
  const folderSessions = new Map<string, typeof data.sessions>();
  for (const s of data.sessions) {
    const fname = s.folder || s.full.split('.')[0] || '(unknown)';
    sessionFolder.set(s.id, fname);
    if (!folderSessions.has(fname)) folderSessions.set(fname, []);
    folderSessions.get(fname)!.push(s);
  }

  // Table ID → name
  const tableNameMap = new Map<string, string>();
  for (const t of data.tables) tableNameMap.set(t.id, t.name);

  // Table → writer/reader folders
  const tableWriters = new Map<string, Set<string>>();
  const tableReaders = new Map<string, Set<string>>();

  // Per-folder write/read counts
  const folderWrites = new Map<string, number>();
  const folderReads = new Map<string, number>();
  const folderLookups = new Map<string, number>();

  for (const conn of data.connections) {
    const ct = conn.type;
    if (ct === 'write_conflict' || ct === 'write_clean') {
      const folder = sessionFolder.get(conn.from);
      const tableName = tableNameMap.get(conn.to);
      if (folder && tableName) {
        if (!tableWriters.has(tableName)) tableWriters.set(tableName, new Set());
        tableWriters.get(tableName)!.add(folder);
        folderWrites.set(folder, (folderWrites.get(folder) || 0) + 1);
      }
    } else if (ct === 'read_after_write' || ct === 'source_read') {
      const tableName = tableNameMap.get(conn.from);
      const folder = sessionFolder.get(conn.to);
      if (folder && tableName) {
        if (!tableReaders.has(tableName)) tableReaders.set(tableName, new Set());
        tableReaders.get(tableName)!.add(folder);
        folderReads.set(folder, (folderReads.get(folder) || 0) + 1);
      }
    } else if (ct === 'lookup_stale') {
      const tableName = tableNameMap.get(conn.from);
      const folder = sessionFolder.get(conn.to);
      if (folder && tableName) {
        if (!tableReaders.has(tableName)) tableReaders.set(tableName, new Set());
        tableReaders.get(tableName)!.add(folder);
        folderLookups.set(folder, (folderLookups.get(folder) || 0) + 1);
      }
    }
  }

  // Build folder-to-folder edges via shared tables
  const edgeMap = new Map<string, FolderConn>();

  for (const conn of data.connections) {
    const ct = conn.type;
    let writerFolder: string | undefined;
    let tableName: string | undefined;

    if (ct === 'write_conflict' || ct === 'write_clean') {
      writerFolder = sessionFolder.get(conn.from);
      tableName = tableNameMap.get(conn.to);
      if (writerFolder && tableName) {
        const readers = tableReaders.get(tableName);
        if (readers) {
          for (const rFolder of readers) {
            if (rFolder === writerFolder) continue;
            const key = `${writerFolder}→${rFolder}`;
            if (!edgeMap.has(key)) {
              edgeMap.set(key, { from: writerFolder, to: rFolder, type: ct, tables: [], counts: {}, total: 0 });
            }
            const edge = edgeMap.get(key)!;
            edge.counts[ct] = (edge.counts[ct] || 0) + 1;
            edge.total++;
            if (!edge.tables.includes(tableName)) edge.tables.push(tableName);
          }
        }
      }
    } else if (ct === 'read_after_write' || ct === 'source_read' || ct === 'lookup_stale') {
      tableName = tableNameMap.get(conn.from);
      const readerFolder = sessionFolder.get(conn.to);
      if (tableName && readerFolder) {
        const writers = tableWriters.get(tableName);
        if (writers) {
          for (const wFolder of writers) {
            if (wFolder === readerFolder) continue;
            const key = `${wFolder}→${readerFolder}`;
            if (!edgeMap.has(key)) {
              edgeMap.set(key, { from: wFolder, to: readerFolder, type: ct, tables: [], counts: {}, total: 0 });
            }
            const edge = edgeMap.get(key)!;
            edge.counts[ct] = (edge.counts[ct] || 0) + 1;
            edge.total++;
            if (!edge.tables.includes(tableName)) edge.tables.push(tableName);
          }
        }
      }
    }
  }

  // Determine dominant type per edge
  for (const edge of edgeMap.values()) {
    const types = Object.entries(edge.counts);
    if (types.length === 1) {
      edge.type = types[0][0];
    } else {
      types.sort((a, b) => b[1] - a[1]);
      edge.type = types[0][0];
    }
  }

  const edges = Array.from(edgeMap.values());

  // Topological sort → assign tiers
  const folderNames = Array.from(folderSessions.keys());
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, Set<string>>();
  for (const name of folderNames) {
    inDegree.set(name, 0);
    adjList.set(name, new Set());
  }
  for (const edge of edges) {
    if (adjList.has(edge.from) && !adjList.get(edge.from)!.has(edge.to)) {
      adjList.get(edge.from)!.add(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
  }

  // BFS layer assignment (longest path = tier)
  const tierAssignment = new Map<string, number>();
  const queue: string[] = [];
  for (const [name, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(name);
      tierAssignment.set(name, 1);
    }
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    const nodeTier = tierAssignment.get(node) || 1;
    for (const neighbor of adjList.get(node) || []) {
      const newTier = Math.max(tierAssignment.get(neighbor) || 1, nodeTier + 1);
      tierAssignment.set(neighbor, newTier);
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Any unassigned (cycles) go to max tier + 1
  const maxTier = Math.max(...Array.from(tierAssignment.values()), 0);
  for (const name of folderNames) {
    if (!tierAssignment.has(name)) tierAssignment.set(name, maxTier + 1);
  }

  // Build nodes
  const nodes: FolderNode[] = folderNames.map(name => {
    const sessions = folderSessions.get(name) || [];
    return {
      name,
      sessionCount: sessions.length,
      tier: tierAssignment.get(name) || 1,
      writeCount: folderWrites.get(name) || 0,
      readCount: folderReads.get(name) || 0,
      lookupCount: folderLookups.get(name) || 0,
      critical: sessions.filter(s => s.critical).length,
      workflows: new Set(sessions.map(s => s.workflow).filter(Boolean)).size,
    };
  });

  return { nodes, edges };
}

/* ── Component ─────────────────────────────────────────────────────────── */

const ALL_CONN_TYPES = Object.keys(CONN_STYLES).filter(k => k !== 'mixed');

export default function FolderDependencyDiagram({ data }: { data: TierMapResult }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement>>({});
  const [lines, setLines] = useState<LineData[]>([]);
  const [svgDims, setSvgDims] = useState({ w: 0, h: 0 });
  const [hov, setHov] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const { committedValue: search, inputProps: searchInputProps, clear: clearSearch } = useCommitSearch();
  const [typeFilter, setTypeFilter] = useState<Set<string>>(() => new Set(ALL_CONN_TYPES));
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerSearch, setFolderPickerSearch] = useState('');

  const regRef = useCallback((name: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current[name] = el;
    else delete nodeRefs.current[name];
  }, []);

  // Build graph
  const { nodes, edges } = useMemo(() => buildFolderGraph(data), [data]);

  // Group by tier
  const tierGroups = useMemo(() => {
    const map = new Map<number, FolderNode[]>();
    for (const n of nodes) {
      if (!map.has(n.tier)) map.set(n.tier, []);
      map.get(n.tier)!.push(n);
    }
    // Sort within each tier by session count desc
    for (const group of map.values()) {
      group.sort((a, b) => b.sessionCount - a.sessionCount);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [nodes]);

  const maxTier = tierGroups.length > 0 ? tierGroups[tierGroups.length - 1][0] : 1;

  // Toggle a connection type filter
  const toggleType = useCallback((type: string) => {
    setTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Check if any filters are active
  const hasActiveFilters = !!(search || sel || typeFilter.size < ALL_CONN_TYPES.length);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSel(null);
    clearSearch();
    setTypeFilter(new Set(ALL_CONN_TYPES));
  }, [clearSearch]);

  // Edges filtered by connection type — only show edges whose dominant type is enabled
  const typeFilteredEdges = useMemo(() => {
    if (typeFilter.size === ALL_CONN_TYPES.length) return edges;
    return edges.filter(e => typeFilter.has(e.type));
  }, [edges, typeFilter]);

  // Filter nodes by search
  const filteredNames = useMemo(() => {
    if (!search) return new Set(nodes.map(n => n.name));
    const q = search.toLowerCase();
    return new Set(nodes.filter(n => n.name.toLowerCase().includes(q)).map(n => n.name));
  }, [nodes, search]);

  // Connected set for isolation (respects type filter)
  const connectedNames = useMemo(() => {
    if (!sel) return null;
    const s = new Set<string>([sel]);
    for (const e of typeFilteredEdges) {
      if (e.from === sel) s.add(e.to);
      if (e.to === sel) s.add(e.from);
    }
    return s;
  }, [sel, typeFilteredEdges]);

  // Active edges (visible)
  const activeEdges = useMemo(() => {
    return typeFilteredEdges.filter(e => {
      if (!filteredNames.has(e.from) && !filteredNames.has(e.to)) return false;
      if (sel) return e.from === sel || e.to === sel;
      if (hov) return e.from === hov || e.to === hov;
      return true;
    });
  }, [typeFilteredEdges, filteredNames, sel, hov]);

  // Connection counts per folder
  const connCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of edges) {
      c[e.from] = (c[e.from] || 0) + 1;
      c[e.to] = (c[e.to] || 0) + 1;
    }
    return c;
  }, [edges]);

  // Selected node detail
  const selNode = useMemo(() => sel ? nodes.find(n => n.name === sel) || null : null, [sel, nodes]);
  const selUpstream = useMemo(() => edges.filter(e => e.to === sel), [edges, sel]);
  const selDownstream = useMemo(() => edges.filter(e => e.from === sel), [edges, sel]);

  // Edge type summary
  const edgeTypeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of edges) {
      for (const [type, count] of Object.entries(e.counts)) {
        c[type] = (c[type] || 0) + count;
      }
    }
    return c;
  }, [edges]);

  /* ── SVG recalc ──────────────────────────────────────────────────────── */

  const recalc = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const cr = el.getBoundingClientRect();
    const st = el.scrollTop;
    const sleft = el.scrollLeft;
    setSvgDims({ w: el.scrollWidth, h: el.scrollHeight });

    if (activeEdges.length === 0) { setLines([]); return; }

    // Group by (from,to) pair for offset
    const groups: Record<string, { indices: number[]; count: number }> = {};
    activeEdges.forEach((e, i) => {
      const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
      if (!groups[key]) groups[key] = { indices: [], count: 0 };
      groups[key].indices.push(i);
      groups[key].count++;
    });

    const newLines: LineData[] = activeEdges.map((e, i) => {
      const fE = nodeRefs.current[e.from];
      const tE = nodeRefs.current[e.to];
      if (!fE || !tE) return null;
      const fR = fE.getBoundingClientRect();
      const tR = tE.getBoundingClientRect();

      const down = fR.top < tR.top;
      let fX = fR.left + fR.width / 2 - cr.left + sleft;
      let fY = down ? fR.bottom - cr.top + st : fR.top - cr.top + st;
      let tX = tR.left + tR.width / 2 - cr.left + sleft;
      let tY = down ? tR.top - cr.top + st : tR.bottom - cr.top + st;

      // Offset parallel lines
      const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
      const g = groups[key];
      if (g && g.count > 1) {
        const off = (g.indices.indexOf(i) - (g.count - 1) / 2) * 10;
        fX += off;
        tX += off;
      }

      const style = CONN_STYLES[e.type] || CONN_STYLES.mixed;
      const th = style.baseWidth * (1 + Math.min(e.total, 20) * 0.05);
      const isAct = hov === e.from || hov === e.to || sel === e.from || sel === e.to;
      const isDim = !!(hov || sel) && !isAct;

      return { fX, fY, tX, tY, color: style.color, dash: style.dash, th, isAct, isDim, type: e.type };
    }).filter(Boolean) as LineData[];

    setLines(newLines);
  }, [activeEdges, hov, sel]);

  useEffect(() => {
    const t = setTimeout(recalc, 80);
    return () => clearTimeout(t);
  }, [recalc]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const dr = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(recalc); };
    el.addEventListener('scroll', dr);
    window.addEventListener('resize', dr);
    return () => { el.removeEventListener('scroll', dr); window.removeEventListener('resize', dr); cancelAnimationFrame(raf); };
  }, [recalc]);

  /* ── Tier band colors ────────────────────────────────────────────────── */

  const tierColors = [
    { color: '#3B82F6', bg: 'rgba(59,130,246,0.06)', border: '#2563EB' },
    { color: '#EAB308', bg: 'rgba(234,179,8,0.06)', border: '#CA8A04' },
    { color: '#A855F7', bg: 'rgba(168,85,247,0.06)', border: '#9333EA' },
    { color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: '#059669' },
    { color: '#F97316', bg: 'rgba(249,115,22,0.06)', border: '#EA580C' },
    { color: '#06B6D4', bg: 'rgba(6,182,212,0.06)', border: '#0891B2' },
    { color: '#EC4899', bg: 'rgba(236,72,153,0.06)', border: '#DB2777' },
    { color: '#84CC16', bg: 'rgba(132,204,22,0.06)', border: '#65A30D' },
  ];

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Main diagram area */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}
      >
        {/* SVG overlay for connection lines */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}
          width={svgDims.w || undefined}
          height={svgDims.h || undefined}
        >
          <defs>
            {Object.entries(CONN_STYLES).map(([k, v]) => (
              <marker key={k} id={`farr-${k}`} viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="6" orient="auto">
                <path d={`M0,0.5 L9,3.5 L0,6.5`} fill={v.color} />
              </marker>
            ))}
          </defs>
          {lines.map((l, i) => {
            const dy = l.tY - l.fY;
            const cp = Math.max(Math.abs(dy) * 0.35, 30);
            const cpx = (l.tX - l.fX) * 0.15;
            const path = `M${l.fX},${l.fY} C${l.fX + cpx},${l.fY + (dy > 0 ? cp : -cp)} ${l.tX - cpx},${l.tY - (dy > 0 ? cp : -cp)} ${l.tX},${l.tY}`;
            return (
              <path
                key={i} d={path} fill="none" stroke={l.color}
                strokeWidth={l.isAct ? l.th * 1.6 : l.th}
                strokeDasharray={l.dash || undefined}
                opacity={l.isDim ? 0.08 : l.isAct ? 1 : 0.4}
                markerEnd={`url(#farr-${l.type})`}
                style={{ transition: 'opacity 0.15s' }}
              />
            );
          })}
        </svg>

        {/* Info banner */}
        <div style={{
          padding: '8px 16px', background: 'rgba(59,130,246,0.08)',
          borderBottom: '1px solid rgba(59,130,246,0.2)', fontSize: 11, color: T.muted,
          display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 5,
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontWeight: 700, color: '#60A5FA' }}>{nodes.length} folders</span>
          <span>across {maxTier} tiers</span>
          <span style={{ color: '#556677' }}>|</span>
          <span>{typeFilteredEdges.length} links</span>
          <span style={{ color: '#556677' }}>|</span>
          <span>{data.sessions.length.toLocaleString()} sessions</span>
          {sel && (
            <>
              <span style={{ color: '#556677' }}>|</span>
              <span style={{ color: T.accent, fontWeight: 600 }}>Selected: {sel}</span>
            </>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                border: `1px solid ${T.yellow}`, background: `${T.yellow}15`,
                color: T.yellow, fontFamily: 'inherit', marginLeft: 4,
              }}
            >
              Clear All Filters
            </button>
          )}
          <div style={{ flex: 1 }} />
          <input
            type="text"
            {...searchInputProps}
            placeholder="Filter folders... (Enter)"
            style={{
              width: 200, padding: '4px 8px', borderRadius: 4,
              border: `1px solid ${search ? T.accent : T.border}`, background: T.bg, color: T.text,
              fontSize: 10, outline: 'none',
            }}
          />
        </div>

        {/* Tier bands */}
        {tierGroups.map(([tier, group]) => {
          const tc = tierColors[(tier - 1) % tierColors.length];
          const visibleNodes = group.filter(n => {
            if (!filteredNames.has(n.name)) return false;
            if (connectedNames && !connectedNames.has(n.name)) return false;
            return true;
          });
          if (visibleNodes.length === 0) return null;
          return (
            <div key={tier} style={{
              borderBottom: `1px solid ${tc.border}33`,
              background: tc.bg,
              padding: '12px 16px',
              position: 'relative',
              zIndex: 2,
            }}>
              {/* Tier label */}
              <div style={{
                fontSize: 10, fontWeight: 700, color: tc.color,
                marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1,
              }}>
                Tier {tier} — {visibleNodes.length} folder{visibleNodes.length !== 1 ? 's' : ''}
                {tier === 1 && ' (no upstream dependencies)'}
                {tier === maxTier && tier > 1 && ' (deepest downstream)'}
              </div>

              {/* Folder cards */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {visibleNodes.map(n => {
                  const isHov = hov === n.name;
                  const isSel = sel === n.name;
                  const isActive = isHov || isSel;
                  const isDim = (hov || sel) ? !isActive && !(connectedNames?.has(n.name)) : false;
                  const links = connCounts[n.name] || 0;

                  return (
                    <div
                      key={n.name}
                      ref={(el) => regRef(n.name, el)}
                      onMouseEnter={() => setHov(n.name)}
                      onMouseLeave={() => setHov(null)}
                      onClick={() => setSel(prev => prev === n.name ? null : n.name)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1.5px solid ${isSel ? tc.color : isHov ? tc.color + '80' : T.border}`,
                        background: isSel ? tc.bg : T.surface,
                        cursor: 'pointer',
                        opacity: isDim ? 0.25 : 1,
                        transition: 'all 0.15s',
                        minWidth: 160,
                        maxWidth: 260,
                        position: 'relative',
                        zIndex: isActive ? 10 : 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: isSel ? tc.color : T.text,
                          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={n.name}>
                          {n.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 9, color: T.muted, flexWrap: 'wrap' }}>
                        <span>{n.sessionCount} sess</span>
                        {n.writeCount > 0 && <span style={{ color: T.accent }}>{n.writeCount}W</span>}
                        {n.readCount > 0 && <span style={{ color: T.green }}>{n.readCount}R</span>}
                        {n.lookupCount > 0 && <span style={{ color: T.yellow }}>{n.lookupCount}L</span>}
                        {links > 0 && <span style={{ color: T.orange }}>{links} links</span>}
                        {n.critical > 0 && <span style={{ color: T.red }}>{n.critical} crit</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {nodes.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%', color: T.muted, fontSize: 13 }}>
            No folder data available
          </div>
        )}
      </div>

      {/* ── Right sidebar ──────────────────────────────────────────────── */}
      <div style={{
        width: 300, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column',
        background: T.surface, overflow: 'hidden',
      }}>
        {/* Connection type filter (clickable legend) */}
        <div style={{ padding: 12, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Connection Filters</span>
            {typeFilter.size < ALL_CONN_TYPES.length && (
              <button
                onClick={() => setTypeFilter(new Set(ALL_CONN_TYPES))}
                style={{
                  padding: '1px 6px', borderRadius: 3, fontSize: 9, cursor: 'pointer',
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: T.muted, fontFamily: 'inherit',
                }}
              >
                Show All
              </button>
            )}
          </div>
          {Object.entries(CONN_STYLES).filter(([k]) => k !== 'mixed').map(([type, cfg]) => {
            const active = typeFilter.has(type);
            const count = edgeTypeCounts[type] || 0;
            return (
              <div
                key={type}
                onClick={() => toggleType(type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
                  padding: '3px 6px', borderRadius: 4, cursor: 'pointer',
                  background: active ? `${cfg.color}10` : 'transparent',
                  opacity: active ? 1 : 0.4,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${cfg.color}`,
                  background: active ? cfg.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>&#10003;</span>}
                </div>
                <div style={{ width: 20, height: 3, background: cfg.color, borderRadius: 1, flexShrink: 0, ...(cfg.dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${cfg.color} 0 6px, transparent 6px 9px)`, background: 'none' } : {}) }} />
                <span style={{ fontSize: 10, color: active ? T.text : T.muted }}>{cfg.label}</span>
                <span style={{ fontSize: 9, color: T.border, marginLeft: 'auto' }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Folder picker */}
        <div style={{ padding: 12, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Select Folder</span>
            <button
              onClick={() => setFolderPickerOpen(!folderPickerOpen)}
              style={{
                padding: '1px 6px', borderRadius: 3, fontSize: 9, cursor: 'pointer',
                border: `1px solid ${T.border}`, background: 'transparent',
                color: T.muted, fontFamily: 'inherit',
              }}
            >
              {folderPickerOpen ? 'Hide' : 'Browse'}
            </button>
          </div>
          {sel && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
              borderRadius: 4, background: T.accentBg, border: `1px solid ${T.accent}40`,
              marginBottom: folderPickerOpen ? 6 : 0,
            }}>
              <span style={{ fontSize: 10, color: T.accent, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sel}
              </span>
              <span
                onClick={() => setSel(null)}
                style={{ fontSize: 12, color: T.muted, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
              >
                x
              </span>
            </div>
          )}
          {folderPickerOpen && (
            <>
              <input
                type="text"
                value={folderPickerSearch}
                onChange={e => setFolderPickerSearch(e.target.value)}
                placeholder="Search folders..."
                style={{
                  width: '100%', padding: '4px 8px', borderRadius: 4,
                  border: `1px solid ${T.border}`, background: T.bg, color: T.text,
                  fontSize: 10, outline: 'none', boxSizing: 'border-box', marginBottom: 4,
                }}
              />
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                {nodes
                  .filter(n => !folderPickerSearch || n.name.toLowerCase().includes(folderPickerSearch.toLowerCase()))
                  .sort((a, b) => b.sessionCount - a.sessionCount)
                  .map(n => {
                    const isSel = sel === n.name;
                    return (
                      <div
                        key={n.name}
                        onClick={() => { setSel(isSel ? null : n.name); setFolderPickerOpen(false); setFolderPickerSearch(''); }}
                        onMouseEnter={() => setHov(n.name)}
                        onMouseLeave={() => setHov(null)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '3px 6px', borderRadius: 3, cursor: 'pointer', fontSize: 10,
                          color: isSel ? T.accent : T.text, marginBottom: 1,
                          background: isSel ? T.accentBg : hov === n.name ? `${T.accent}08` : 'transparent',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                          {n.name}
                        </span>
                        <span style={{ color: T.muted, flexShrink: 0, marginLeft: 4, fontSize: 9 }}>
                          {n.sessionCount}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        {/* Selected folder detail / Top connected */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {selNode ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: T.text, wordBreak: 'break-word' }}>{selNode.name}</h3>
                <div style={{ fontSize: 10, color: T.muted }}>
                  {selNode.sessionCount} sessions · {selNode.workflows} workflows · Tier {selNode.tier}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 10 }}>
                  <span style={{ color: T.accent }}>{selNode.writeCount} writes</span>
                  <span style={{ color: T.green }}>{selNode.readCount} reads</span>
                  {selNode.lookupCount > 0 && <span style={{ color: T.yellow }}>{selNode.lookupCount} lookups</span>}
                  {selNode.critical > 0 && <span style={{ color: T.red }}>{selNode.critical} critical</span>}
                </div>
              </div>

              {/* Upstream */}
              {selUpstream.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginBottom: 6 }}>
                    Depends On ({selUpstream.length})
                  </div>
                  {selUpstream.map(e => (
                    <EdgeDetail key={e.from} edge={e} label={e.from} direction="upstream" onSelect={() => setSel(e.from)} />
                  ))}
                </div>
              )}

              {/* Downstream */}
              {selDownstream.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, marginBottom: 6 }}>
                    Depended By ({selDownstream.length})
                  </div>
                  {selDownstream.map(e => (
                    <EdgeDetail key={e.to} edge={e} label={e.to} direction="downstream" onSelect={() => setSel(e.to)} />
                  ))}
                </div>
              )}

              {selUpstream.length === 0 && selDownstream.length === 0 && (
                <div style={{ fontSize: 11, color: T.muted, padding: '8px 0' }}>
                  No cross-folder dependencies
                </div>
              )}

              <button
                onClick={() => setSel(null)}
                style={{
                  marginTop: 16, padding: '6px 12px', borderRadius: 4, width: '100%',
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: T.muted, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
                }}
              >
                Clear Selection
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
                Click a folder card or use Browse above
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 8 }}>Top Connected</div>
              {nodes
                .filter(n => (connCounts[n.name] || 0) > 0)
                .sort((a, b) => (connCounts[b.name] || 0) - (connCounts[a.name] || 0))
                .slice(0, 15)
                .map(n => (
                  <div
                    key={n.name}
                    onClick={() => setSel(n.name)}
                    onMouseEnter={() => setHov(n.name)}
                    onMouseLeave={() => setHov(null)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 10,
                      color: T.text, marginBottom: 2,
                      background: hov === n.name ? T.accentBg : 'transparent',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                      {n.name}
                    </span>
                    <span style={{ color: T.orange, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                      {connCounts[n.name] || 0}
                    </span>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Edge detail card ──────────────────────────────────────────────────── */

function EdgeDetail({ edge, label, direction, onSelect }: {
  edge: FolderConn; label: string; direction: 'upstream' | 'downstream'; onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const accentColor = direction === 'upstream' ? T.green : T.orange;

  return (
    <div style={{
      padding: '6px 8px', marginBottom: 4, borderRadius: 6,
      border: `1px solid ${T.border}`, background: T.bg, fontSize: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          onClick={onSelect}
          style={{ color: accentColor, fontWeight: 600, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}
          title={label}
        >
          {direction === 'upstream' ? '< ' : '> '}{label}
        </span>
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ color: T.muted, cursor: 'pointer', flexShrink: 0, marginLeft: 4 }}
        >
          {edge.tables.length} tbl{edge.tables.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Type chips */}
      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
        {Object.entries(edge.counts).map(([type, count]) => {
          const s = CONN_STYLES[type] || CONN_STYLES.mixed;
          return (
            <span key={type} style={{
              fontSize: 8, padding: '1px 4px', borderRadius: 3,
              background: `${s.color}20`, color: s.color,
            }}>
              {s.label}: {count}
            </span>
          );
        })}
      </div>

      {expanded && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {edge.tables.map(t => (
              <span key={t} style={{
                fontSize: 8, padding: '1px 4px', borderRadius: 3,
                background: `${T.accent}15`, color: T.accent,
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
