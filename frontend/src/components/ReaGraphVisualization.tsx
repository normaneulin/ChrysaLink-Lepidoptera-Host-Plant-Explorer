import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Position,
  Handle,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';

// --- Configuration ---

// --- ADJUST HERE TO MOVE GRAPH POSITION ---
// Positive X = Move Right, Negative X = Move Left
// Positive Y = Move Down, Negative Y = Move Up
const GRAPH_X_OFFSET = 0; 
const GRAPH_Y_OFFSET = 0;

// Animation Speed
const ANIMATION_DURATION_MS = 800; 

// Radial distances
const RADIUS_CONFIG: Record<string, number> = {
  species: 120,
  genus: 240,
  family: 360,
  division: 480, // Outermost
};

// SVG Mapping
const getSvgPath = (division: string) => {
  const key = (division || '').toLowerCase().trim();
  const map: Record<string, string> = {
    'rhopalocera': '/relationship_visual_node_images/rhopalocera_node.svg',
    'heterocera': '/relationship_visual_node_images/heterocera_node.svg',
    'angiosperm': '/relationship_visual_node_images/angiosperm_node.svg',
    'gymnosperm': '/relationship_visual_node_images/gymnosperm_node.svg',
    'pteridophyte': '/relationship_visual_node_images/pteridophyte_node.svg',
  };
  return map[key] || map['rhopalocera'];
};

// --- Types ---

interface GraphNode {
  id: string;
  label?: string;
  data?: {
    type?: string;
    taxonomic_level?: string;
    division?: string;
    family?: string;
    genus?: string;
    scientific_name?: string;
    [key: string]: any;
  };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
  onNodeClick?: (node: any) => void;
}

// --- Custom Components ---

const TaxonNode = React.memo(({ data }: { data: any }) => {
  const svgPath = getSvgPath(data.division);
  const color = data.type === 'lepidoptera' ? '#FFD700' : '#4ADE80';

  return (
    <div 
      className="taxon-node-inner"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '80px', height: '80px', cursor: 'pointer', position: 'relative'
      }}
    >
      {/* Label Badge */}
      <div style={{
        position: 'absolute', top: '-15px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '3px 8px', borderRadius: '6px',
        border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', 
        color: '#444', whiteSpace: 'nowrap', zIndex: 10,
        pointerEvents: 'none'
      }}>
        {data.label}
      </div>

      {/* Circle Image */}
      <div style={{
        width: '60px', height: '60px', borderRadius: '50%',
        backgroundColor: 'white', border: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)', overflow: 'hidden',
        zIndex: 5,
        transition: 'transform 0.2s' 
      }}>
        <img 
          src={svgPath} 
          alt={data.label} 
          style={{ width: '40px', height: '40px', objectFit: 'contain' }} 
        />
      </div>

      {/* Center Handles for cleaner edge connections */}
      <Handle 
        type="source" position={Position.Top} 
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 0 }} 
      />
      <Handle 
        type="target" position={Position.Top} 
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 0 }} 
      />
    </div>
  );
});

const BackgroundRingsNode = React.memo(() => {
  return (
    <div style={{ 
      width: 1, height: 1, pointerEvents: 'none', 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'visible'
    }}>
      <svg 
        width="1500" height="1500" viewBox="-750 -750 1500 1500" 
        style={{ overflow: 'visible' }}
      >
        {Object.entries(RADIUS_CONFIG).map(([level, radius]) => (
          <g key={level}>
            <circle 
              cx="0" cy="0" r={radius} 
              fill="none" 
              stroke="#cbd5e1" 
              strokeWidth={level === 'division' ? 2 : 1}
              strokeDasharray={level === 'division' ? '0' : '6 3'}
              opacity={0.5}
            />
            <text 
              x="0" y={-radius + 12} textAnchor="middle" 
              fill="#94a3b8" fontSize="10" fontWeight="bold" 
              style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              {level}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
});

const nodeTypes: NodeTypes = {
  taxon: TaxonNode,
  bgRings: BackgroundRingsNode,
};

// --- Main Logic ---

const VisualizationInternal: React.FC<Props> = ({ nodes: inputNodes = [], edges: inputEdges = [], height = 600, onNodeClick: propOnNodeClick }) => {
  const { fitView } = useReactFlow();
  
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [historyStack, setHistoryStack] = useState<Array<{ parentId: string, childrenIds: string[] }>>([]);
  const [animationOrigin, setAnimationOrigin] = useState<{ parentId: string, x: number, y: number } | null>(null);

  // 1. Build Hierarchy
  const hierarchy = useMemo(() => {
    const map = new Map<string, any>();
    const mkId = (t: string, l: string, n: string) => `${t}_${l}_${n.replace(/[^a-zA-Z0-9]/g, '')}`.toLowerCase();

    inputNodes.forEach(n => {
      if (!n || !n.data) return;
      const type = n.data.type === 'plant' ? 'plant' : 'lepidoptera';
      const division = n.data.division || 'Unknown';
      const family = n.data.family;
      const genus = n.data.genus;
      const label = n.label || n.data.scientific_name || 'Unknown';
      const level = (n.data.taxonomic_level || 'species').toLowerCase();

      // Division
      const divId = mkId(type, 'division', division);
      if (!map.has(divId)) map.set(divId, { id: divId, label: division, level: 'division', type, division, data: n.data });

      // Family
      if (family) {
        const famId = mkId(type, 'family', family);
        if (!map.has(famId)) map.set(famId, { id: famId, label: family, level: 'family', type, division, parentId: divId, data: n.data });
      }

      // Genus
      if (genus) {
        const genId = mkId(type, 'genus', genus);
        const pId = family ? mkId(type, 'family', family) : divId;
        if (!map.has(genId)) map.set(genId, { id: genId, label: genus, level: 'genus', type, division, parentId: pId, data: n.data });
      }

      // Species
      if (level === 'species') {
        const pId = genus ? mkId(type, 'genus', genus) : (family ? mkId(type, 'family', family) : divId);
        map.set(n.id, { id: n.id, label, level: 'species', type, division, parentId: pId, data: n.data });
      }
    });
    return Array.from(map.values());
  }, [inputNodes]);

  // 2. Initial State
  useEffect(() => {
    const divs = hierarchy.filter(n => n.level === 'division');
    setVisibleNodeIds(new Set(divs.map(n => n.id)));
    setHistoryStack([]);
    setTimeout(() => fitView({ duration: 1000 }), 100);
  }, [hierarchy, fitView]);

  // 3. Drill Down Handler
  const handleNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    const data = node.data;
    if (data.level === 'species') {
      if (propOnNodeClick) propOnNodeClick(data);
      return;
    }

    let nextLevel = '';
    if (data.level === 'division') nextLevel = 'family';
    else if (data.level === 'family') nextLevel = 'genus';
    else if (data.level === 'genus') nextLevel = 'species';
    if (!nextLevel) return;

    const children = hierarchy.filter(n => n.parentId === data.id && n.level === nextLevel);

    if (children.length > 0) {
      setAnimationOrigin({
        parentId: data.id,
        x: node.position.x,
        y: node.position.y
      });

      setHistoryStack(prev => [...prev, { parentId: data.id, childrenIds: children.map(c => c.id) }]);
      setVisibleNodeIds(prev => {
        const next = new Set(prev);
        next.delete(data.id);
        children.forEach(c => next.add(c.id));
        return next;
      });
    }
  }, [hierarchy, propOnNodeClick]);

  // 4. Animation Effect
  useEffect(() => {
    if (animationOrigin) {
      const timer = setTimeout(() => {
        setAnimationOrigin(null);
      }, 50); 
      return () => clearTimeout(timer);
    }
  }, [animationOrigin]);

  // 5. Merge Back Handler
  const handleCanvasClick = useCallback(() => {
    setHistoryStack(prev => {
      if (prev.length === 0) return prev;
      const lastAction = prev[prev.length - 1];
      const newStack = prev.slice(0, -1);
      setVisibleNodeIds(current => {
        const next = new Set(current);
        lastAction.childrenIds.forEach(id => next.delete(id));
        next.add(lastAction.parentId);
        return next;
      });
      return newStack;
    });
  }, []);

  // 6. Layout Calculation
  const { rfNodes, rfEdges } = useMemo(() => {
    const nodes: Node[] = [];
    
    // Background Rings with Manual Offset
    nodes.push({
      id: 'bg-rings-fixed',
      type: 'bgRings',
      position: { x: GRAPH_X_OFFSET, y: GRAPH_Y_OFFSET },
      data: {},
      zIndex: -1,
      draggable: false,
      selectable: false,
    });

    const visibleItems = hierarchy.filter(n => visibleNodeIds.has(n.id));
    
    // STRICT SORTING:
    // 1. Sort by Parent ID (Groups siblings together)
    // 2. Sort by Label (Ensures siblings are always in the same relative order)
    visibleItems.sort((a, b) => {
      const pA = a.parentId || '';
      const pB = b.parentId || '';
      if (pA !== pB) return pA.localeCompare(pB);
      return (a.label || '').localeCompare(b.label || '');
    });
    
    const leftItems = visibleItems.filter(n => n.type === 'lepidoptera');
    const rightItems = visibleItems.filter(n => n.type === 'plant');

    const layout = (items: any[], isLeft: boolean) => {
      items.forEach((item, index) => {
        const radius = RADIUS_CONFIG[item.level] || 100;
        const startAngle = isLeft ? Math.PI / 2 : -Math.PI / 2;
        const totalArc = Math.PI;
        const step = totalArc / (items.length + 1);
        const angle = startAngle + step * (index + 1);

        // Apply Offset to Node Positions
        const targetX = (radius * Math.cos(angle)) + GRAPH_X_OFFSET;
        const targetY = (radius * Math.sin(angle)) + GRAPH_Y_OFFSET;

        let finalX = targetX;
        let finalY = targetY;

        // Animation override: start at parent's old position
        if (animationOrigin && item.parentId === animationOrigin.parentId) {
          finalX = animationOrigin.x;
          finalY = animationOrigin.y;
        }

        nodes.push({
          id: item.id,
          type: 'taxon',
          position: { x: finalX, y: finalY },
          data: item,
          draggable: false,
          zIndex: 10,
        });
      });
    };

    layout(leftItems, true);
    layout(rightItems, false);

    // Edges
    const edges: Edge[] = [];
    const visibleSet = new Set(visibleItems.map(n => n.id));
    const findVisibleAncestor = (nodeId: string): string | null => {
        if (visibleSet.has(nodeId)) return nodeId;
        let curr = hierarchy.find(n => n.id === nodeId);
        while (curr && curr.parentId) {
            if (visibleSet.has(curr.parentId)) return curr.parentId;
            curr = hierarchy.find(n => n.id === curr!.parentId);
        }
        return null;
    };

    inputEdges.forEach(e => {
        const sourceVis = findVisibleAncestor(e.source);
        const targetVis = findVisibleAncestor(e.target);
        
        if (sourceVis && targetVis && sourceVis !== targetVis) {
            const edgeId = `e-${sourceVis}-${targetVis}`;
            if (!edges.find(ed => ed.id === edgeId)) {
                edges.push({
                    id: edgeId,
                    source: sourceVis,
                    target: targetVis,
                    type: 'straight',
                    animated: true,
                    style: { stroke: '#b0bec5', strokeWidth: 1.5, opacity: 0.6 },
                    zIndex: 0
                });
            }
        }
    });

    return { rfNodes: nodes, rfEdges: edges };
  }, [visibleNodeIds, hierarchy, inputEdges, animationOrigin]);

  return (
    <>
      <style>
        {`
          .react-flow__node {
            transition: transform ${ANIMATION_DURATION_MS}ms cubic-bezier(0.25, 0.8, 0.25, 1);
          }
        `}
      </style>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handleCanvasClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#f8fafc" gap={20} />
        <Panel position="top-right" style={{ background: 'white', padding: '10px', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>
            <div>🟡 Lepidoptera (Left)</div>
            <div>🟢 Host Plants (Right)</div>
          </div>
        </Panel>
      </ReactFlow>
    </>
  );
};

export const ReaGraphVisualization: React.FC<Props> = (props) => (
  <div style={{ width: '100%', height: props.height || 600, border: '1px solid #eee', position: 'relative' }}>
    <ReactFlowProvider>
      <VisualizationInternal {...props} />
    </ReactFlowProvider>
  </div>
);

export default ReaGraphVisualization;