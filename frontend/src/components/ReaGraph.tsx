import React, { useMemo, useRef, useState } from 'react';
import { GraphCanvas, lightTheme, Label, Ring } from 'reagraph';
import { GraphNode as GraphNodeType, GraphEdge as GraphEdgeType } from '../types/relationship';

const drillOrder = ['Division', 'Family', 'Genus', 'Species'] as const;

function nextLevel(level: typeof drillOrder[number]) {
  const idx = drillOrder.indexOf(level);
  return idx < drillOrder.length - 1 ? drillOrder[idx + 1] : undefined;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'stretch',
  height: 600
};

const panelStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #ddd',
  borderRadius: 6,
  overflow: 'hidden'
};

const controlsStyle: React.CSSProperties = { padding: 8, background: '#fafafa' };

export const Interactive = () => {
  // ============ RING SIZE CONFIGURATION ============
  // Ring radii for each taxonomic level
  const RING_DIVISION = 280;
  const RING_FAMILY = 200;
  const RING_GENUS = 120;
  const RING_SPECIES = 50;

  // Refs for each GraphCanvas so we can call fitNodesInView
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  // map of computed positions per visible node id (used by layoutOverrides)
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  // Store previous nodes to identify new children for animation
  const previousRenderedNodesRef = useRef<Array<any>>([]);

  // Base division-level graphs
  const divisionGraph = useMemo(() => buildDivisionLevel(), []);

  // Track expanded node id (not used — we drive by level+parent)
  // per-side expansion stack: each entry { level: nextLevel, parent: name }
  const [leftStack, setLeftStack] = useState<Array<{ level: typeof drillOrder[number]; parent: string }>>([]);
  const [rightStack, setRightStack] = useState<Array<{ level: typeof drillOrder[number]; parent: string }>>([]);
  // edges to highlight as active (edge ids)
  const [activeEdgeIds, setActiveEdgeIds] = useState<string[]>([]);
  // Current parent (selected taxon) for drill-down on each side
  const [leftParent, setLeftParent] = useState<string | undefined>(undefined);
  const [rightParent, setRightParent] = useState<string | undefined>(undefined);

  // Search/filter state
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [leftLevel, setLeftLevel] = useState<'Division' | 'Family' | 'Genus' | 'Species'>('Division');    // WE ONLY USE 4 taxa division, family, genus, species (genus + specific_epithet)
  const [rightLevel, setRightLevel] = useState<'Division' | 'Family' | 'Genus' | 'Species'>('Division'); 
  // Track the active division per side so deeper drills stay scoped to the clicked division only
  const [leftDivision, setLeftDivision] = useState<string | undefined>(undefined);
  const [rightDivision, setRightDivision] = useState<string | undefined>(undefined);
  // Track parent expansion info for animation
  const [expansionParentInfo, setExpansionParentInfo] = useState<{ side: 'left' | 'right'; nodeId: string; pos: { x: number; y: number } } | null>(null);

  // Combined nodes & edges for a single canvas; nodes are positioned by layoutOverrides
  const combinedNodesEdges = useMemo(() => {
    function parentLevelOf(level: typeof drillOrder[number]) {
      if (level === 'Family') return 'Division';
      if (level === 'Genus') return 'Family';
      if (level === 'Species') return 'Genus';
      return 'Division';
    }

    // Build left nodes: if there's a stack, build progressively by applying each entry
    // STRICT RULE: Start with ALL division nodes, then replace ONLY the clicked parent with its children
    let leftNodes: any[];
    if (leftStack && leftStack.length > 0) {
      // Start with all division nodes
      leftNodes = getNodesFor('Division', 'lepidoptera');
      
      // Apply each stack entry in order to expand only the clicked nodes
      for (const entry of leftStack) {
        const parentPrefix = entry.level === 'Family' ? 'lepdiv' : entry.level === 'Genus' ? 'lepfam' : 'lepgen';
        const parentId = `${parentPrefix}:${entry.parent}`;
        const idx = leftNodes.findIndex(n => String(n.id) === parentId || String(n.label) === entry.parent);
        if (idx >= 0) {
          const children = getNodesFor(entry.level, 'lepidoptera', entry.parent);
          // Replace only this parent with its children
          leftNodes = [...leftNodes.slice(0, idx), ...children, ...leftNodes.slice(idx + 1)];
        }
      }
    } else {
      const levelParent = leftLevel === 'Family' ? leftDivision : undefined;
      leftNodes = getNodesFor(leftLevel, 'lepidoptera', levelParent as any);
    }

    // Build right nodes: same progressive approach
    let rightNodes: any[];
    if (rightStack && rightStack.length > 0) {
      // Start with all division nodes
      rightNodes = getNodesFor('Division', 'plants');
      
      for (const entry of rightStack) {
        const parentPrefix = entry.level === 'Family' ? 'plantdiv' : entry.level === 'Genus' ? 'plantfam' : 'plantgen';
        const parentId = `${parentPrefix}:${entry.parent}`;
        const idx = rightNodes.findIndex(n => String(n.id) === parentId || String(n.label) === entry.parent);
        if (idx >= 0) {
          const children = getNodesFor(entry.level, 'plants', entry.parent);
          rightNodes = [...rightNodes.slice(0, idx), ...children, ...rightNodes.slice(idx + 1)];
        }
      }
    } else {
      const levelParent = rightLevel === 'Family' ? rightDivision : undefined;
      rightNodes = getNodesFor(rightLevel, 'plants', levelParent as any);
    }

    // build edges by mapping interactions to the most specific visible node
    const visibleIds = new Set<string>([...leftNodes.map(n => n.id), ...rightNodes.map(n => n.id)]);

    // helper to map a species id to the best visible node id
    function mapSpeciesToVisibleNode(speciesId: string, side: 'lepidoptera' | 'plants') {
      // prefer exact species id
      if (visibleIds.has(speciesId)) return speciesId;
      // find meta from lists
      const list = side === 'lepidoptera' ? lepidopteraSpecies : plantSpecies;
      const meta = list.find(s => s.id === speciesId)?.data;
      if (!meta) return null;
      // prefer genus, then family, then division if visible
      const gid = `${side === 'lepidoptera' ? 'lepgen' : 'plantgen'}:${meta.genus}`;
      if (visibleIds.has(gid)) return gid;
      const fid = `${side === 'lepidoptera' ? 'lepfam' : 'plantfam'}:${meta.family}`;
      if (visibleIds.has(fid)) return fid;
      const did = `${side === 'lepidoptera' ? 'lepdiv' : 'plantdiv'}:${meta.division}`;
      if (visibleIds.has(did)) return did;
      return null;
    }

    const edgesMap = new Map<string, any>();
    interactions.forEach((rel, idx) => {
      const leftNodeId = mapSpeciesToVisibleNode(rel.insect, 'lepidoptera');
      const rightNodeId = mapSpeciesToVisibleNode(rel.plant, 'plants');
      if (!leftNodeId || !rightNodeId) return;
      const key = `${leftNodeId}->${rightNodeId}`;
      if (!edgesMap.has(key)) edgesMap.set(key, { id: `edge:${edgesMap.size}-${leftNodeId}-${rightNodeId}`, source: leftNodeId, target: rightNodeId, label: 'host' });
    });

    const edges = Array.from(edgesMap.values());

    // apply per-side search filters (only when not at Division level)
    const lterm = leftSearch.trim().toLowerCase();
    const rterm = rightSearch.trim().toLowerCase();
    const leftFinal = leftNodes.filter(n => (lterm && leftLevel !== 'Division') ? n.label.toLowerCase().includes(lterm) : true);
    const rightFinal = rightNodes.filter(n => (rterm && rightLevel !== 'Division') ? n.label.toLowerCase().includes(rterm) : true);

    // compute radial positions for nodes (four concentric rings). Assign nodes
    // to rings by their taxonomic level and spread them along their half-circle
    // (left side = left semicircle, right side = right semicircle).
    const allVisible = [...leftFinal, ...rightFinal];
    // Tighter ring radii so nodes intersect visibly
    const rings = [RING_DIVISION, RING_FAMILY, RING_GENUS, RING_SPECIES]; // radii for Division, Family, Genus, Species
    const groups: Record<string, any[]> = {};
    function ringIndexForNode(n: any) {
      const id = String(n.id);
      if (id.startsWith('lepdiv:') || id.startsWith('plantdiv:')) return 0;
      if (id.startsWith('lepfam:') || id.startsWith('plantfam:')) return 1;
      if (id.startsWith('lepgen:') || id.startsWith('plantgen:')) return 2;
      return 3;
    }
    for (const n of allVisible) {
      const side = String(n.id).startsWith('lep') ? 'left' : 'right';
      const ri = ringIndexForNode(n);
      const key = `${side}:${ri}`;
      groups[key] = groups[key] || [];
      groups[key].push(n);
    }

    // Barycenter heuristic: sort nodes within each ring to minimize edge crossings
    // Step 1: assign initial positions evenly
    const initialPosMap: Record<string, { x: number; y: number; angle: number }> = {};
    for (const key of Object.keys(groups)) {
      const [side, rs] = key.split(':');
      const ri = Number(rs);
      const list = groups[key];
      const count = list.length || 1;
      const start = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
      const range = Math.PI;
      for (let i = 0; i < list.length; i++) {
        const angle = start + ((i + 0.5) / count) * range;
        const r = rings[ri] || 40;
        initialPosMap[String(list[i].id)] = { 
          x: Math.cos(angle) * r, 
          y: Math.sin(angle) * r, 
          angle 
        };
      }
    }

    // Step 2: optimize ordering using barycenter heuristic (2 iterations)
    for (let iter = 0; iter < 2; iter++) {
      // Process each group
      for (const key of Object.keys(groups)) {
        const [side, rs] = key.split(':');
        const list = groups[key];
        if (list.length <= 1) continue;

        // Calculate barycenter (average angle of neighbors) for each node
        const barycenters = list.map(node => {
          const nodeId = String(node.id);
          const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
          if (connectedEdges.length === 0) return { node, barycenter: initialPosMap[nodeId]?.angle || 0 };

          // Get angles of all connected nodes
          const neighborAngles = connectedEdges
            .map(e => {
              const neighborId = e.source === nodeId ? e.target : e.source;
              return initialPosMap[String(neighborId)]?.angle;
            })
            .filter(a => a !== undefined) as number[];

          if (neighborAngles.length === 0) return { node, barycenter: initialPosMap[nodeId]?.angle || 0 };

          // Calculate average angle (handle wraparound for angles near pi/-pi boundary)
          const avgAngle = neighborAngles.reduce((sum, a) => sum + a, 0) / neighborAngles.length;
          return { node, barycenter: avgAngle };
        });

        // Sort nodes by barycenter
        barycenters.sort((a, b) => a.barycenter - b.barycenter);

        // Reassign positions based on sorted order
        const ri = Number(rs);
        const count = list.length;
        const start = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
        const range = Math.PI;
        barycenters.forEach((item, i) => {
          const angle = start + ((i + 0.5) / count) * range;
          const r = rings[ri] || 40;
          initialPosMap[String(item.node.id)] = {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            angle
          };
        });
      }
    }

    // Convert to final position map
    const posMap: Record<string, { x: number; y: number }> = {};
    for (const id of Object.keys(initialPosMap)) {
      posMap[id] = { x: initialPosMap[id].x, y: initialPosMap[id].y };
    }
    positionsRef.current = posMap;

    // assign sizes and fills and positions to nodes according to their ring
    // sizes for Division (outermost) -> Species (innermost) - much larger for visibility
    const ringSizes = [100, 80, 50, 20];
    // Lepidoptera nodes: use a bright yellow
    const leftColor = '#FFD700';
    const rightColor = '#66bb66';

    const annotate = (n: any) => {
      const id = String(n.id);
      const ri = ringIndexForNode(n);
      const size = ringSizes[ri] || 7;
      const fill = id.startsWith('lep') ? leftColor : rightColor;
      const p = posMap[id];
      return {
        ...n,
        size,
        fill,
        position: p ? { x: p.x, y: p.y, z: 0 } : n.position
      };
    };

    const finalLeft = leftFinal.map(annotate);
    const finalRight = rightFinal.map(annotate);
    
    // Save all computed positions for the click handlers to use
    Object.assign(positionsRef.current, posMap);
    
    // Save current rendered nodes for next iteration's comparison
    const allRenderedNodes = [...finalLeft, ...finalRight];
    previousRenderedNodesRef.current = allRenderedNodes;

    return { nodes: [...finalLeft, ...finalRight], edges };
  }, [leftLevel, rightLevel, leftSearch, rightSearch, leftParent, rightParent, leftStack, rightStack, leftDivision, rightDivision, RING_DIVISION, RING_FAMILY, RING_GENUS, RING_SPECIES]);

  // When a node is clicked on left, expand it (only allow one expanded), or if species clicked, focus right side on connected plants

  const handleLeftNodeClick = (node) => {
    const { id, label } = node;
    // expand taxon nodes (Division/Family/Genus) — only one at a time
    if (id.startsWith('lepdiv:') || id.startsWith('lepfam:') || id.startsWith('lepgen:')) {
      const lvl = id.startsWith('lepdiv:') ? 'Division' : id.startsWith('lepfam:') ? 'Family' : 'Genus';
      const nl = nextLevel(lvl);
      if (nl) {
        // Extract the node name from the id
        const parentName = String(id).includes(':') ? String(id).split(':')[1] : String(id);
        
        // Get parent position from the clicked node object itself
        const nodePos = node.position || { x: 0, y: 0 };
        const parentPos = {
          x: typeof nodePos.x === 'number' ? nodePos.x : 0,
          y: typeof nodePos.y === 'number' ? nodePos.y : 0
        };
        
        // Store expansion info in state so it persists across renders
        setExpansionParentInfo({
          side: 'left',
          nodeId: String(id),
          pos: parentPos
        });
        
        // If clicking a Division, set the division filter
        if (lvl === 'Division') setLeftDivision(parentName);
        
        // Add this expansion to the stack
        setLeftStack(prev => [...prev, { level: nl, parent: parentName }]);
        setLeftLevel(nl);
        setLeftParent(parentName);
      }
      // highlight edges connected to this node
      const connected = (combinedNodesEdges?.edges || []).filter(e => e.source === id || e.target === id).map(e => e.id);
      setActiveEdgeIds(connected);
      (async () => {
        const mod = await import('../../src/store');
        // @ts-ignore
        mod.defaultStore.setState({ actives: connected });
      })();
      return;
    }

    // species clicked -> focus matching plants
    if (id.startsWith('lep:')) {
      const matched = interactions.filter(i => i.insect === id).map(i => i.plant);
      if (matched.length) {
        setLeftParent(undefined);
        setRightParent(undefined);
        const connected = (combinedNodesEdges?.edges || []).filter(e => e.source === id || e.target === id).map(e => e.id);
        setActiveEdgeIds(connected);
        (async () => {
          const mod = await import('../../src/store');
          // @ts-ignore
          mod.defaultStore.setState({ actives: connected });
        })();
        setTimeout(() => {
          // @ts-ignore
          leftRef.current?.fitNodesInView([id, ...matched]);
        }, 200);
      }
    }
  };

  // When right node clicked
  const handleRightNodeClick = (node) => {
    const { id, label } = node;
    if (id.startsWith('plantdiv:') || id.startsWith('plantfam:') || id.startsWith('plantgen:')) {
      const lvl = id.startsWith('plantdiv:') ? 'Division' : id.startsWith('plantfam:') ? 'Family' : 'Genus';
      const nl = nextLevel(lvl);
      if (nl) {
        const parentName = String(id).includes(':') ? String(id).split(':')[1] : String(id);
        
        // Get parent position from the clicked node object itself
        const nodePos = node.position || { x: 0, y: 0 };
        const parentPos = {
          x: typeof nodePos.x === 'number' ? nodePos.x : 0,
          y: typeof nodePos.y === 'number' ? nodePos.y : 0
        };
        
        // Store expansion info in state so it persists across renders
        setExpansionParentInfo({
          side: 'right',
          nodeId: String(id),
          pos: parentPos
        });
        
        // If clicking a Division, set the division filter
        if (lvl === 'Division') setRightDivision(parentName);
        
        // Add this expansion to the stack
        setRightStack(prev => [...prev, { level: nl, parent: parentName }]);
        setRightLevel(nl);
        setRightParent(parentName);
      }
      const connected = (combinedNodesEdges?.edges || []).filter(e => e.source === id || e.target === id).map(e => e.id);
      setActiveEdgeIds(connected);
      (async () => {
        const mod = await import('../../src/store');
        // @ts-ignore
        mod.defaultStore.setState({ actives: connected });
      })();
      return;
    }
    if (id.startsWith('plant:')) {
      const matched = interactions.filter(i => i.plant === id).map(i => i.insect);
      if (matched.length) {
        setLeftParent(undefined);
        setRightParent(undefined);
        const connected = (combinedNodesEdges?.edges || []).filter(e => e.source === id || e.target === id).map(e => e.id);
        setActiveEdgeIds(connected);
        (async () => {
          const mod = await import('../../src/store');
          // @ts-ignore
          mod.defaultStore.setState({ actives: connected });
        })();
        setTimeout(() => {
          // @ts-ignore
          leftRef.current?.fitNodesInView(matched);
        }, 200);
      }
    }
  };

  // General node click handler for the single canvas
  const handleNodeClick = (node) => {
    if (!node || !node.id) return;
    if (String(node.id).startsWith('lep')) {
      handleLeftNodeClick(node);
    } else if (String(node.id).startsWith('plant')) {
      handleRightNodeClick(node);
    }
  };

  // collapse on background click: prefer collapsing the side that is currently deeper than Division
  // map a taxonomy level to a ring index (0 outermost -> 3 innermost)
  function levelToRingIndex(level: typeof drillOrder[number]) {
    if (level === 'Division') return 0;
    if (level === 'Family') return 1;
    if (level === 'Genus') return 2;
    return 3; // Species
  }

  // When canvas is clicked we receive the pointer event; determine which radial
  // ring region was clicked and collapse the most-recent expansion that corresponds
  // to that ring (only one per click).
  const handleCanvasClick = (event?: MouseEvent) => {
    try {
      if (!event || !event.target) {
        // fallback to previous behavior
        if (leftStack.length > 0 || leftLevel !== 'Division' || leftParent) {
          goBackLeft();
          setActiveEdgeIds([]);
          (async () => {
            const mod = await import('../../src/store');
            // @ts-ignore
            mod.defaultStore.setState({ actives: [] });
          })();
          return;
        }
        if (rightStack.length > 0 || rightLevel !== 'Division' || rightParent) {
          goBackRight();
          setActiveEdgeIds([]);
          (async () => {
            const mod = await import('../../src/store');
            // @ts-ignore
            mod.defaultStore.setState({ actives: [] });
          })();
        }
        return;
      }

      const el = event.target as Element;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (event as any).clientX - cx;
      const dy = (event as any).clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // radii for rings (outermost -> innermost)
      const r0 = Math.min(rect.width, rect.height) * 0.45; // outermost
      const r1 = Math.min(rect.width, rect.height) * 0.32;
      const r2 = Math.min(rect.width, rect.height) * 0.18;
      const r3 = Math.min(rect.width, rect.height) * 0.07;

      let clickedRing = -1;
      if (dist <= r3) clickedRing = 3;
      else if (dist <= r2) clickedRing = 2;
      else if (dist <= r1) clickedRing = 1;
      else if (dist <= r0) clickedRing = 0;

      // attempt to collapse the most-recent expansion whose children live in that ring
      const tryCollapseForSide = (stack: typeof leftStack, setStack: any, setLevel: any, setParent: any) => {
        if (!stack || stack.length === 0) return false;
        const top = stack[stack.length - 1];
        const topRing = levelToRingIndex(top.level as any);
        if (topRing === clickedRing) {
          // pop the stack
          const ns = stack.slice(0, -1);
          setStack(ns);
          if (ns.length > 0) setLevel(ns[ns.length - 1].level as any);
          else setLevel('Division');
          if (ns.length === 0) setParent(undefined);
          return true;
        }
        return false;
      };

      // prioritize the side that has a topmost expansion matching the clicked ring
      if (tryCollapseForSide(leftStack, setLeftStack, setLeftLevel, setLeftParent)) {
        setActiveEdgeIds([]);
        (async () => {
          const mod = await import('../../src/store');
          // @ts-ignore
          mod.defaultStore.setState({ actives: [] });
        })();
        return;
      }
      if (tryCollapseForSide(rightStack, setRightStack, setRightLevel, setRightParent)) {
        setActiveEdgeIds([]);
        (async () => {
          const mod = await import('../../src/store');
          // @ts-ignore
          mod.defaultStore.setState({ actives: [] });
        })();
        return;
      }

      // fallback: if no matching top stack, behave like previous global collapse
      if (leftStack.length > 0 || leftLevel !== 'Division' || leftParent) {
        goBackLeft();
        setActiveEdgeIds([]);
        (async () => {
          const mod = await import('../../src/store');
          // @ts-ignore
          mod.defaultStore.setState({ actives: [] });
        })();
        return;
      }
      if (rightStack.length > 0 || rightLevel !== 'Division' || rightParent) {
        goBackRight();
        setActiveEdgeIds([]);
        (async () => {
          const mod = await import('../../src/store');
          // @ts-ignore
          mod.defaultStore.setState({ actives: [] });
        })();
      }
    } catch (e) {
      // swallow errors and fallback
      if (leftStack.length > 0) goBackLeft();
      else if (rightStack.length > 0) goBackRight();
      setActiveEdgeIds([]);
      (async () => {
        const mod = await import('../../src/store');
        // @ts-ignore
        mod.defaultStore.setState({ actives: [] });
      })();
    }
  };

  // breadcrumb/back handlers
  const leftCanBack = leftStack.length > 0 || leftLevel !== 'Division' || !!leftParent;
  const rightCanBack = rightStack.length > 0 || rightLevel !== 'Division' || !!rightParent;

  const goBackLeft = () => {
    // if there is a stack for the current parent, pop one level
    if (leftStack.length > 0) {
      if (leftStack.length > 1) {
        const ns = leftStack.slice(0, -1);
        setLeftStack(ns);
        setLeftLevel(ns[ns.length - 1].level as any);
      } else {
        // removing last stack entry collapses to Division
        setLeftStack([]);
        setLeftLevel('Division');
        setLeftParent(undefined);
        setLeftDivision(undefined);
      }
      return;
    }
    // fallback: step up one level if no explicit stack
    if (leftLevel === 'Species') setLeftLevel('Genus');
    else if (leftLevel === 'Genus') setLeftLevel('Family');
    else if (leftLevel === 'Family') setLeftLevel('Division');
    if (leftLevel === 'Family') setLeftDivision(undefined);
    setLeftParent(undefined);
  };

  const goBackRight = () => {
    if (rightStack.length > 0) {
      if (rightStack.length > 1) {
        const ns = rightStack.slice(0, -1);
        setRightStack(ns);
        setRightLevel(ns[ns.length - 1].level as any);
      } else {
        setRightStack([]);
        setRightLevel('Division');
        setRightParent(undefined);
        setRightDivision(undefined);
      }
      return;
    }
    if (rightLevel === 'Species') setRightLevel('Genus');
    else if (rightLevel === 'Genus') setRightLevel('Family');
    else if (rightLevel === 'Family') setRightLevel('Division');
    if (rightLevel === 'Family') setRightDivision(undefined);
    setRightParent(undefined);
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', height: 600 }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
        <div style={panelStyle}>
          <div style={controlsStyle}>
            <div style={{ fontWeight: 600 }}>Lepidoptera</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input placeholder="Search species..." value={leftSearch} onChange={e => setLeftSearch(e.target.value)} style={{ flex: 1 }} />
              <select value={leftLevel} onChange={e => setLeftLevel(e.target.value as any)}>
                <option>Division</option>
                <option>Family</option>
                <option>Genus</option>
                <option>Species</option>
              </select>
              <button onClick={goBackLeft} disabled={!leftCanBack} style={{ marginLeft: 8 }}>Back</button>
            </div>
          </div>
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Click a node to drill down. Search filters the left side.</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <GraphCanvas
            ref={leftRef}
            nodes={combinedNodesEdges.nodes}
            edges={combinedNodesEdges.edges}
            layoutType="forceDirected2d"
            sizingType="none"
            labelType="auto"
            theme={lightTheme}
            onNodeClick={(n) => handleNodeClick(n)}
            onCanvasClick={handleCanvasClick}
            onNodePointerOver={async (n) => {
              // highlight connected nodes and edges
              const edges = (combinedNodesEdges?.edges || []).filter(e => e.source === n.id || e.target === n.id).map(e => e.id);
              const nodeSet = new Set<string>([n.id]);
              for (const eid of edges) {
                const e = (combinedNodesEdges?.edges || []).find(x => x.id === eid);
                if (e) {
                  nodeSet.add(e.source);
                  nodeSet.add(e.target);
                }
              }
              const actives = [...nodeSet, ...edges];
              setActiveEdgeIds(edges);
              const mod = await import('../../src/store');
              // @ts-ignore
              mod.defaultStore.setState({ actives });
            }}
            onNodePointerOut={async (n) => {
              setActiveEdgeIds([]);
              const mod = await import('../../src/store');
              // @ts-ignore
              mod.defaultStore.setState({ actives: [] });
            }}
            onEdgePointerOver={async (edge) => {
              // highlight the edge and its nodes
              const nodeSet = new Set<string>([edge.source, edge.target]);
              const actives = [edge.id, ...nodeSet];
              setActiveEdgeIds([edge.id]);
              const mod = await import('../../src/store');
              // @ts-ignore
              mod.defaultStore.setState({ actives });
            }}
            onEdgePointerOut={async () => {
              setActiveEdgeIds([]);
              const mod = await import('../../src/store');
              // @ts-ignore
              mod.defaultStore.setState({ actives: [] });
            }}
            defaultNodeSize={10}
            aggregateEdges={false}
            edgeArrowPosition={'none'}
            layoutOverrides={{
              // provide loose initial positions: bias x left/right but allow free-floating
              getNodePosition: (id: string, { nodes }) => {
                try {
                  const p = positionsRef.current?.[String(id)];
                  if (p) return p as any;
                  // fallback: deterministic-ish jitter as before
                  const isLeft = String(id).startsWith('lep');
                  let hash = 0;
                  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
                  const jitterX = (hash % 40) - 20;
                  const jitterY = ((hash >> 4) % 160) - 80;
                  const baseX = isLeft ? -200 : 200;
                  const x = baseX + jitterX;
                  const y = jitterY;
                  return { x, y } as any;
                } catch (e) {
                  return undefined;
                }
              }
            }}
          >
            {/* Lighting and concentric rings */}
            <directionalLight position={[0, 500, -400]} intensity={0.9} />
            <directionalLight position={[200, 200, 100]} intensity={0.6} />
            {/* Visible concentric rings and labels */}
            <group>
              <Ring animated={false} size={RING_DIVISION/2} opacity={0.25} color="#cccccc" />
              <group position={[RING_DIVISION, 10, 0]}>
                <Label text="Division" fontSize={10} />
              </group>
              <Ring animated={false} size={RING_FAMILY/2} opacity={0.18} color="#cccccc" />
              <group position={[RING_FAMILY, 10, 0]}>
                <Label text="Family" fontSize={9} />
              </group>
              <Ring animated={false} size={RING_GENUS/2} opacity={0.14} color="#cccccc" />
              <group position={[RING_GENUS, 8, 0]}>
                <Label text="Genus" fontSize={8} />
              </group>
              <Ring animated={false} size={RING_SPECIES/2} opacity={0.12} color="#cccccc" />
              <group position={[RING_SPECIES, 6, 0]}>
                <Label text="Species" fontSize={7} />
              </group>
            </group>
          </GraphCanvas>
        </div>
      </div>

      <div style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
        <div style={panelStyle}>
          <div style={controlsStyle}>
            <div style={{ fontWeight: 600 }}>Host Plants</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input placeholder="Search plants..." value={rightSearch} onChange={e => setRightSearch(e.target.value)} style={{ flex: 1 }} />
              <select value={rightLevel} onChange={e => setRightLevel(e.target.value as any)}>
                <option>Division</option>
                <option>Family</option>
                <option>Genus</option>
                <option>Species</option>
              </select>
              <button onClick={goBackRight} disabled={!rightCanBack} style={{ marginLeft: 8 }}>Back</button>
            </div>
          </div>
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Click a node to drill down. Search filters the right side.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
