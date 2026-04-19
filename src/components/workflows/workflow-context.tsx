"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/* ─── Types ─── */

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
}

export interface ActiveWorkflowState {
  /** True when the builder canvas is open */
  active: boolean;
  workflowId: string;
  workflowName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowContextValue {
  state: ActiveWorkflowState;
  /** Called when user enters the builder canvas */
  openBuilder: (id: string, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  closeBuilder: () => void;
  /** AI commands update these */
  addNode: (node: Omit<WorkflowNode, "id">) => WorkflowNode;
  addEdge: (from: string, to: string) => WorkflowEdge | null;
  /** Set config on a node (by full id or 8-char prefix) */
  setConfig: (nodeIdOrPrefix: string, config: Record<string, unknown>) => void;
  /** Builder syncs its state back here */
  syncState: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  /** Pending AI-issued commands the builder should consume */
  pendingCommands: WorkflowCommand[];
  clearCommands: () => void;
}

export interface WorkflowCommand {
  id: string;
  type: "add_node" | "add_edge" | "remove_node" | "remove_edge" | "set_name" | "set_config";
  payload: Record<string, unknown>;
}

const DEFAULT_STATE: ActiveWorkflowState = {
  active: false,
  workflowId: "",
  workflowName: "",
  nodes: [],
  edges: [],
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowBuilderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActiveWorkflowState>(DEFAULT_STATE);
  const [pendingCommands, setPendingCommands] = useState<WorkflowCommand[]>([]);

  const openBuilder = useCallback((id: string, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    setState({ active: true, workflowId: id, workflowName: name, nodes, edges });
  }, []);

  const closeBuilder = useCallback(() => {
    setState(DEFAULT_STATE);
    setPendingCommands([]);
  }, []);

  const syncState = useCallback((nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    setState((prev) => ({ ...prev, nodes, edges }));
  }, []);

  const addNode = useCallback((node: Omit<WorkflowNode, "id">): WorkflowNode => {
    const newNode: WorkflowNode = { ...node, id: crypto.randomUUID() };
    const cmd: WorkflowCommand = { id: crypto.randomUUID(), type: "add_node", payload: newNode as unknown as Record<string, unknown> };
    setPendingCommands((prev) => [...prev, cmd]);
    setState((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    return newNode;
  }, []);

  const addEdge = useCallback((from: string, to: string): WorkflowEdge | null => {
    setState((prev) => {
      if (prev.edges.some((e) => e.from === from && e.to === to)) return prev;
      const newEdge: WorkflowEdge = { id: crypto.randomUUID(), from, to };
      const cmd: WorkflowCommand = { id: crypto.randomUUID(), type: "add_edge", payload: newEdge as unknown as Record<string, unknown> };
      setPendingCommands((p) => [...p, cmd]);
      return { ...prev, edges: [...prev.edges, newEdge] };
    });
    return null;
  }, []);

  const clearCommands = useCallback(() => setPendingCommands([]), []);

  const setConfig = useCallback((nodeIdOrPrefix: string, config: Record<string, unknown>) => {
    const cmd: WorkflowCommand = { id: crypto.randomUUID(), type: "set_config", payload: { node: nodeIdOrPrefix, config } };
    setPendingCommands((prev) => [...prev, cmd]);
  }, []);

  return (
    <WorkflowContext.Provider value={{ state, openBuilder, closeBuilder, syncState, addNode, addEdge, setConfig, pendingCommands, clearCommands }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowBuilder() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflowBuilder must be used within WorkflowBuilderProvider");
  return ctx;
}
