
'use client';

/**
 * @fileOverview National Hub Knowledge Graph Service.
 * Orchestrates the semantic relationship network between campus entities.
 * Features automated edge building and relationship reinforcement.
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
  source: { id: string; type: KnowledgeGraphNode['type'] },
  target: { id: string; type: KnowledgeGraphNode['type'] },
  weightIncrement = 1
) {
  if (!firestore || !source.id || !target.id || source.id === target.id) return;

  const nodeRef = doc(firestore, 'knowledge_graph', source.id);
  const targetRef = doc(firestore, 'knowledge_graph', target.id);

  // We use a batch to ensure symmetry in the graph
  const batch = writeBatch(firestore);

  // Update Source Node: Set type and name if creating, then increment connection weight
  batch.set(nodeRef, {
    id: source.id,
    type: source.type,
    name: source.id, // Fallback name to ID
    updatedAt: serverTimestamp(),
    [`connections.${target.id}.weight`]: increment(weightIncrement),
    [`connections.${target.id}.lastUpdated`]: serverTimestamp()
  }, { merge: true });

  // Update Target Node (Symmetric Relationship)
  batch.set(targetRef, {
    id: target.id,
    type: target.type,
    name: target.id,
    updatedAt: serverTimestamp(),
    [`connections.${source.id}.weight`]: increment(weightIncrement),
    [`connections.${source.id}.lastUpdated`]: serverTimestamp()
  }, { merge: true });

  return batch.commit().catch(err => console.warn("Liaison Graph: Edge log failed", err));
}

/**
 * updateGraphFromContent
 * ----------------------
 * Automatically connects all entities within a piece of content (Post, Product, etc.).
 * Implements nested loop mapping to build semantic clusters.
 */
export async function updateGraphFromContent(
  firestore: Firestore,
  entities: { id: string; type: KnowledgeGraphNode['type'] }[]
) {
  if (!firestore || entities.length < 2) return;

  // Professional Limit: only connect the first 10 entities to prevent graph saturation
  const pool = entities.slice(0, 10);

  const promises = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      promises.push(recordEdge(firestore, a, b));
    }
  }

  return Promise.all(promises);
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
