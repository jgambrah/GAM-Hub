
'use client';

/**
 * @fileOverview National Hub Knowledge Graph Service.
 * Orchestrates the semantic relationship network between campus entities.
 */

import { doc, increment, setDoc, Firestore, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { KnowledgeGraphNode } from './types';

/**
 * recordEdge
 * ----------
 * Strengthens or creates a connection between two nodes in the graph.
 */
export async function recordEdge(
  firestore: Firestore,
  sourceId: string,
  targetId: string,
  type: KnowledgeGraphNode['type'],
  weightIncrement = 1
) {
  if (!firestore || !sourceId || !targetId || sourceId === targetId) return;

  const nodeRef = doc(firestore, 'knowledge_graph', sourceId);
  const targetRef = doc(firestore, 'knowledge_graph', targetId);

  // We use a batch to ensure symmetry in the graph
  const batch = writeBatch(firestore);

  // Update Source Node
  batch.set(nodeRef, {
    id: sourceId,
    type: type,
    updatedAt: serverTimestamp(),
    [`connections.${targetId}.weight`]: increment(weightIncrement),
    [`connections.${targetId}.lastUpdated`]: serverTimestamp()
  }, { merge: true });

  // Update Target Node (Symmetric Relationship)
  batch.set(targetRef, {
    id: targetId,
    updatedAt: serverTimestamp(),
    [`connections.${sourceId}.weight`]: increment(weightIncrement),
    [`connections.${sourceId}.lastUpdated`]: serverTimestamp()
  }, { merge: true });

  return batch.commit().catch(err => console.warn("Graph edge log failed", err));
}

/**
 * getRelatedConcepts
 * -------------------
 * Retrieves the top N semantically related node IDs for a given source.
 */
export async function getRelatedConcepts(
  firestore: Firestore,
  nodeId: string,
  limitCount = 5
): Promise<string[]> {
  if (!firestore || !nodeId) return [];

  try {
    const snap = await getDoc(doc(firestore, 'knowledge_graph', nodeId));
    if (!snap.exists()) return [];

    const data = snap.data() as KnowledgeGraphNode;
    if (!data.connections) return [];

    // Sort by weight and return top IDs
    return Object.entries(data.connections)
      .sort(([, a], [, b]) => b.weight - a.weight)
      .slice(0, limitCount)
      .map(([id]) => id);
  } catch (err) {
    console.warn("Graph traversal failed", err);
    return [];
  }
}

/**
 * expandInterests
 * ---------------
 * Takes a set of direct interests and returns an "Expanded Vector" 
 * by following edges in the Knowledge Graph.
 */
export async function expandInterests(
  firestore: Firestore,
  interests: string[],
  depth = 1
): Promise<Record<string, number>> {
  const expanded: Record<string, number> = {};
  
  if (!firestore || interests.length === 0) return expanded;

  // For each interest, fetch its related concepts from the graph
  const fetches = interests.map(id => getDoc(doc(firestore, 'knowledge_graph', id)));
  const results = await Promise.all(fetches);

  results.forEach(snap => {
    if (snap.exists()) {
      const data = snap.data() as KnowledgeGraphNode;
      if (data.connections) {
        Object.entries(data.connections).forEach(([targetId, meta]) => {
          // Weight expansion by 0.5 to prevent drift
          expanded[targetId] = (expanded[targetId] || 0) + (meta.weight * 0.5);
        });
      }
    }
  });

  return expanded;
}
