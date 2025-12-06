/**
 * RelationshipGraph Component
 * 
 * Wrapper component that uses ReaGraphVisualization for cleaner integration.
 * This is the main component used by RelationshipPage.
 */

import React from 'react';
import { ReaGraphVisualization } from './ReaGraphVisualization';
import { GraphNode, GraphEdge } from '../types/relationship';

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  isLoading?: boolean;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
}

/**
 * Relationship Graph Component
 * 
 * Displays an interactive bipartite graph of lepidoptera-plant relationships
 * using ReaGraph (WebGL-based visualization).
 */
export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  nodes,
  edges,
  isLoading = false,
  height = 600,
  onNodeClick,
  onEdgeClick,
}) => {
  return (
    <ReaGraphVisualization
      nodes={nodes}
      edges={edges}
      isLoading={isLoading}
      height={height}
      onNodeClick={onNodeClick}
      // Force SVG renderer to avoid WebGL reconciler crash
      useWebGL={false}
    />
  );
};

export default RelationshipGraph;
