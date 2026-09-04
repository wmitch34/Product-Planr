import React, { useEffect, useRef, useState } from "react";

const GRID_SIZE = 24;
const PARENT_GRID_SIZE = 12;
const GRID_EXTENT = 20000;
const NODE_WIDTH = 156;
const NODE_HEIGHT = 72;
const SIDES = ["top", "right", "bottom", "left"];
const initialNodes = [
  { id: "n1", x: 96, y: 96, label: "Web app", details: [], isParent: false },
  { id: "n2", x: 384, y: 168, label: "Database", details: [], isParent: false },
];

const snap = (value, step = GRID_SIZE) => Math.round(value / step) * step;

const rectsOverlap = (first, second) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

export default function Graph() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [detailsNodeId, setDetailsNodeId] = useState(null);
  const [nodeMenuId, setNodeMenuId] = useState(null);
  const [handleMenu, setHandleMenu] = useState(null);
  const [connection, setConnection] = useState(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const panRef = useRef(null);
  const connectionRef = useRef(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const getNodeSize = (node) => ({
    width: node.width ?? NODE_WIDTH,
    height: node.height ?? NODE_HEIGHT,
  });

  const pointFromEvent = (event) => {
    const bounds = svgRef.current.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left - viewport.x,
      y: event.clientY - bounds.top - viewport.y,
    };
  };

  const screenPoint = (point) => ({
    x: point.x + viewport.x,
    y: point.y + viewport.y,
  });

  const beginCanvasPan = (event) => {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewport,
    };
    setSelectedNodeId(null);
    setDetailsNodeId(null);
    setNodeMenuId(null);
    setHandleMenu(null);
  };

  const moveCanvasPan = (event) => {
    if (!panRef.current || panRef.current.pointerId !== event.pointerId) return;
    setViewport({
      x: panRef.current.viewport.x + event.clientX - panRef.current.clientX,
      y: panRef.current.viewport.y + event.clientY - panRef.current.clientY,
    });
  };

  const endCanvasPan = (event) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePoint = (node, side) => {
    const { width, height } = getNodeSize(node);
    if (side === "top") return { x: node.x + width / 2, y: node.y };
    if (side === "right") return { x: node.x + width, y: node.y + height / 2 };
    if (side === "bottom") return { x: node.x + width / 2, y: node.y + height };
    return { x: node.x, y: node.y + height / 2 };
  };

  const handleMenuPosition = (point, side) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    const screen = screenPoint(point);
    const origin = bounds ? { x: bounds.left, y: bounds.top } : { x: 0, y: 0 };
    if (side === "top")
      return {
        position: "fixed",
        left: origin.x + screen.x,
        top: origin.y + screen.y - 10,
        transform: "translate(-50%, -100%)",
      };
    if (side === "bottom")
      return {
        position: "fixed",
        left: origin.x + screen.x,
        top: origin.y + screen.y + 10,
        transform: "translateX(-50%)",
      };
    if (side === "left")
      return {
        position: "fixed",
        left: origin.x + screen.x - 10,
        top: origin.y + screen.y,
        transform: "translate(-100%, -50%)",
      };
    return {
      position: "fixed",
      left: origin.x + screen.x + 10,
      top: origin.y + screen.y,
      transform: "translateY(-50%)",
    };
  };

  const nodeMenuPosition = (node) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    const { width } = getNodeSize(node);
    const screen = screenPoint({ x: node.x + width, y: node.y });
    return {
      position: "fixed",
      left: (bounds?.left || 0) + screen.x + 10,
      top: (bounds?.top || 0) + screen.y,
    };
  };

  const addNode = () => {
    const id = `n${Date.now()}`;
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        x: 216,
        y: 264,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        label: `Service ${currentNodes.length + 1}`,
        details: [],
        isParent: false,
        parentId: null,
      },
    ]);
  };

  const updateNode = (nodeId, changes) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId ? { ...node, ...changes } : node,
      ),
    );
  };

  const moveNode = (event) => {
    if (!dragRef.current) return;
    const point = pointFromEvent(event);
    const { id, offsetX, offsetY } = dragRef.current;
    const currentNode = nodesRef.current.find((node) => node.id === id);
    if (!currentNode) return;

    const nodeSize = getNodeSize(currentNode);
    const nextX = snap(point.x - offsetX);
    const nextY = snap(point.y - offsetY);

    if (currentNode.isParent) {
      const deltaX = nextX - currentNode.x;
      const deltaY = nextY - currentNode.y;

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === id) {
            return { ...node, x: nextX, y: nextY };
          }
          if (node.parentId === id) {
            return {
              ...node,
              x: node.x + deltaX,
              y: node.y + deltaY,
            };
          }
          return node;
        }),
      );
      return;
    }

    const parent = nodesRef.current.find(
      (candidate) =>
        candidate.id !== id &&
        candidate.isParent &&
        nextX >= candidate.x + 12 &&
        nextX + nodeSize.width <=
          candidate.x + getNodeSize(candidate).width - 12 &&
        nextY >= candidate.y + 12 &&
        nextY + nodeSize.height <=
          candidate.y + getNodeSize(candidate).height - 12,
    );

    if (parent && currentNode.parentId !== parent.id) {
      attachToParentIfNeeded(id, parent.id);
    }

    const boundedX = parent
      ? Math.min(
          Math.max(nextX, parent.x + 12),
          parent.x + getNodeSize(parent).width - nodeSize.width - 12,
        )
      : nextX;
    const boundedY = parent
      ? Math.min(
          Math.max(nextY, parent.y + 12),
          parent.y + getNodeSize(parent).height - nodeSize.height - 12,
        )
      : nextY;

    const snappedX = parent ? snap(boundedX, PARENT_GRID_SIZE) : boundedX;
    const snappedY = parent ? snap(boundedY, PARENT_GRID_SIZE) : boundedY;

    const isParentPlacement = Boolean(parent) || Boolean(currentNode.parentId);
    const nextRect = {
      x: snappedX,
      y: snappedY,
      width: nodeSize.width,
      height: nodeSize.height,
    };

    const overlapsOtherNode =
      !currentNode.isParent &&
      !isParentPlacement &&
      nodesRef.current.some((other) => {
        if (other.id === id || other.isParent) return false;
        const otherSize = getNodeSize(other);
        return rectsOverlap(nextRect, {
          x: other.x,
          y: other.y,
          width: otherSize.width,
          height: otherSize.height,
        });
      });

    if (overlapsOtherNode) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          x: snappedX,
          y: snappedY,
          parentId: parent?.id ?? currentNode.parentId ?? null,
        };
      }),
    );
  };

  const endNodeDrag = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", moveNode);
    window.removeEventListener("pointerup", endNodeDrag);
  };

  const moveNodeResize = (event) => {
    if (!resizeRef.current) return;
    const point = pointFromEvent(event);
    const { id, startX, startY, startWidth, startHeight } = resizeRef.current;
    const nextWidth = Math.max(
      GRID_SIZE,
      snap(Math.max(0, point.x - startX + startWidth)),
    );
    const nextHeight = Math.max(
      GRID_SIZE,
      snap(Math.max(0, point.y - startY + startHeight)),
    );

    updateNode(id, {
      width: nextWidth,
      height: nextHeight,
    });
  };

  const endNodeResize = () => {
    resizeRef.current = null;
    window.removeEventListener("pointermove", moveNodeResize);
    window.removeEventListener("pointerup", endNodeResize);
  };

  const beginNodeResize = (event, node) => {
    event.stopPropagation();
    setSelectedNodeId(node.id);
    const point = pointFromEvent(event);
    resizeRef.current = {
      id: node.id,
      startX: point.x,
      startY: point.y,
      startWidth: node.width ?? NODE_WIDTH,
      startHeight: node.height ?? NODE_HEIGHT,
    };
    window.addEventListener("pointermove", moveNodeResize);
    window.addEventListener("pointerup", endNodeResize);
  };

  const beginNodeDrag = (event, node) => {
    if (connection) return;
    event.stopPropagation();
    const point = pointFromEvent(event);
    dragRef.current = {
      id: node.id,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
    };
    window.addEventListener("pointermove", moveNode);
    window.addEventListener("pointerup", endNodeDrag);
  };

  const detachNodeFromParent = (nodeId) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId ? { ...node, parentId: null } : node,
      ),
    );
    setNodeMenuId(null);
  };

  const attachToParentIfNeeded = (nodeId, parentId) => {
    if (!parentId) return;
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, parentId };
        }
        return node;
      }),
    );
  };

  const handleNodeClick = (event, node) => {
    event.stopPropagation();
    if (connectionRef.current) {
      completeNodeConnection(node.id);
    }
  };

  const addConnection = (
    sourceId,
    targetId,
    sourceSide = "right",
    targetSide = "left",
    bidirectional = false,
  ) => {
    const timestamp = Date.now();
    setEdges((currentEdges) => [
      ...currentEdges,
      {
        id: `${sourceId}-${targetId}-${timestamp}`,
        from: sourceId,
        to: targetId,
        side: sourceSide,
        targetSide,
      },
      ...(bidirectional
        ? [
            {
              id: `${targetId}-${sourceId}-${timestamp}-reverse`,
              from: targetId,
              to: sourceId,
              side: targetSide,
              targetSide: sourceSide,
            },
          ]
        : []),
    ]);
  };

  const beginNodeConnection = (mode) => {
    if (!handleMenu) return;
    const sourceNode = nodes.find((node) => node.id === handleMenu.nodeId);
    if (!sourceNode) return;
    const nextConnection = {
      from: sourceNode.id,
      side: handleMenu.side,
      mode,
      point: handlePoint(sourceNode, handleMenu.side),
      cursor: handlePoint(sourceNode, handleMenu.side),
    };
    connectionRef.current = nextConnection;
    setConnection(nextConnection);
    setDetailsNodeId(null);
    setHandleMenu(null);
    window.addEventListener("pointermove", moveConnection);
    window.addEventListener("pointerup", finishConnection);
  };

  const completeNodeConnection = (targetId) => {
    const currentConnection = connectionRef.current;
    if (!currentConnection || currentConnection.from === targetId) return;
    addConnection(
      currentConnection.from,
      targetId,
      currentConnection.side,
      "left",
      currentConnection.mode === "two-way",
    );
    cancelConnection();
  };

  const moveConnection = (event) => {
    const cursor = pointFromEvent(event);
    setConnection((current) => (current ? { ...current, cursor } : current));
  };

  const finishConnection = (event) => {
    const point = pointFromEvent(event);
    const currentConnection = connectionRef.current;
    const target = nodesRef.current
      .filter((node) => node.id !== currentConnection?.from)
      .flatMap((node) =>
        SIDES.map((side) => ({ node, side, point: handlePoint(node, side) })),
      )
      .map((candidate) => ({
        ...candidate,
        distance: Math.hypot(
          candidate.point.x - point.x,
          candidate.point.y - point.y,
        ),
      }))
      .sort((first, second) => first.distance - second.distance)[0];

    if (currentConnection && target && target.distance <= 24) {
      addConnection(
        currentConnection.from,
        target.node.id,
        currentConnection.side,
        target.side,
        currentConnection.mode === "two-way",
      );
    }
    cancelConnection();
  };

  const cancelConnection = () => {
    connectionRef.current = null;
    setConnection(null);
    window.removeEventListener("pointermove", moveConnection);
    window.removeEventListener("pointerup", finishConnection);
  };

  const beginHandleConnection = (event, node, side) => {
    event.stopPropagation();
    const point = handlePoint(node, side);
    setSelectedNodeId(node.id);
    setNodeMenuId(null);
    setDetailsNodeId(null);
    setHandleMenu({ nodeId: node.id, side, point });
  };

  useEffect(
    () => () => {
      endNodeDrag();
      endNodeResize();
      cancelConnection();
    },
    [],
  );

  const connectedEdges = (nodeId, side) =>
    edges.filter(
      (edge) =>
        (edge.from === nodeId && edge.side === side) ||
        (edge.to === nodeId && edge.targetSide === side),
    );

  const removeConnection = (edgeId) => {
    const edge = edges.find((candidate) => candidate.id === edgeId);
    if (!edge) return;
    setEdges((currentEdges) =>
      currentEdges.filter(
        (candidate) =>
          candidate.id !== edgeId &&
          !(
            candidate.from === edge.to &&
            candidate.to === edge.from &&
            candidate.side === edge.targetSide &&
            candidate.targetSide === edge.side
          ),
      ),
    );
  };

  const focusNode = (direction) => {
    if (!nodes.length) return;

    const currentIndex = nodes.findIndex(
      (node) => node.id === (selectedNodeId ?? nodes[0].id),
    );
    const startIndex = currentIndex === -1 ? 0 : currentIndex;
    const targetIndex = (startIndex + direction + nodes.length) % nodes.length;
    const targetNode = nodes[targetIndex];
    const targetSize = getNodeSize(targetNode);

    setSelectedNodeId(targetNode.id);

    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const centerX = targetNode.x + targetSize.width / 2;
    const centerY = targetNode.y + targetSize.height / 2;

    setViewport({
      x: bounds.width / 2 - centerX,
      y: bounds.height / 2 - centerY,
    });
  };

  return (
    <section className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addNode}
          aria-label="Add node"
          title="Add node"
          data-tooltip="Add node"
          className="graph-toolbar-button rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => focusNode(-1)}
          aria-label="Focus previous node"
          title="Previous node"
          data-tooltip="Previous node"
          className="graph-toolbar-button rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path
              d="m15 18-6-6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => focusNode(1)}
          aria-label="Focus next node"
          title="Next node"
          data-tooltip="Next node"
          className="graph-toolbar-button rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path
              d="m9 18 6-6-6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <svg
          ref={svgRef}
          className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
          onPointerMove={moveCanvasPan}
          onPointerUp={endCanvasPan}
          onPointerCancel={endCanvasPan}
          aria-label="Project architecture graph"
        >
          <defs>
            <pattern
              id="grid"
              width={GRID_SIZE}
              height={GRID_SIZE}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                fill="none"
                stroke="#dbe4ef"
                strokeWidth="1"
              />
            </pattern>
            <marker
              id="arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M 0 0 L 6 3 L 0 6 z" fill="#000000" />
            </marker>
            {nodes
              .filter((node) => node.isParent)
              .map((node) => (
                <pattern
                  key={`parent-grid-${node.id}`}
                  id={`parent-grid-${node.id}`}
                  width={PARENT_GRID_SIZE}
                  height={PARENT_GRID_SIZE}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${PARENT_GRID_SIZE} 0 L 0 0 0 ${PARENT_GRID_SIZE}`}
                    fill="none"
                    stroke="#dfeaf7"
                    strokeWidth="1"
                  />
                </pattern>
              ))}
          </defs>
          <g transform={`translate(${viewport.x} ${viewport.y})`}>
            <rect
              x={-GRID_EXTENT + (viewport.x % GRID_SIZE)}
              y={-GRID_EXTENT + (viewport.y % GRID_SIZE)}
              width={GRID_EXTENT * 2}
              height={GRID_EXTENT * 2}
              fill="url(#grid)"
              onPointerDown={beginCanvasPan}
            />
            {[...nodes]
              .sort(
                (first, second) =>
                  Number(second.isParent) - Number(first.isParent),
              )
              .map((node) => {
                const { width, height } = getNodeSize(node);
                const isParent = node.isParent;
                const isChildInParent = Boolean(node.parentId);

                return (
                  <g key={node.id} className="group">
                    <g>
                      <rect
                        x={node.x}
                        y={node.y}
                        width={width}
                        height={height}
                        rx="12"
                        fill={isParent ? "#f8fbff" : "white"}
                        stroke={
                          selectedNodeId === node.id
                            ? "#1e3a8a"
                            : isParent
                              ? "#64748b"
                              : isChildInParent
                                ? "#334155"
                                : "#64748b"
                        }
                        strokeWidth="2"
                        style={{ pointerEvents: "none" }}
                      />
                      {isParent && (
                        <rect
                          x={node.x + 8}
                          y={node.y + 8}
                          width={width - 16}
                          height={height - 16}
                          rx="10"
                          fill={`url(#parent-grid-${node.id})`}
                          opacity="0.8"
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </g>

                    <foreignObject
                      x={node.x + 2}
                      y={node.y + 2}
                      width={width - 4}
                      height={height - 4}
                      style={{
                        pointerEvents: "auto",
                        position: "relative",
                        zIndex: isParent ? 30 : isChildInParent ? 200 : 20,
                        overflow: "visible",
                      }}
                    >
                      <div
                        onPointerDown={(event) => beginNodeDrag(event, node)}
                        onClick={(event) => handleNodeClick(event, node)}
                        className="relative flex h-full w-full cursor-grab flex-col justify-start active:cursor-grabbing"
                        style={{
                          pointerEvents: "auto",
                          backgroundColor: isParent
                            ? "transparent"
                            : "transparent",
                          borderRadius: "12px",
                          boxShadow: isChildInParent
                            ? "0 8px 18px rgba(15, 23, 42, 0.12)"
                            : "0 6px 16px rgba(15, 23, 42, 0.08)",
                        }}
                      >
                        <div className="relative h-full w-full">
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "6px",
                              transform: "translateX(-50%)",
                              width: "calc(100% - 36px)",
                              textAlign: "center",
                              pointerEvents: "none",
                            }}
                          >
                            <span
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => handleNodeClick(event, node)}
                              className="block truncate text-sm font-semibold leading-none text-slate-800"
                              aria-label={`${node.label} name`}
                              style={{ pointerEvents: "auto" }}
                            >
                              {node.label}
                            </span>
                          </div>
                          <button
                            aria-label={`Open actions for ${node.label}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedNodeId(node.id);
                              setNodeMenuId(node.id);
                              setDetailsNodeId(null);
                              setHandleMenu(null);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              zIndex: 2,
                            }}
                          >
                            &middot;&middot;&middot;
                          </button>
                          <div className="h-full w-full" />
                        </div>
                      </div>
                    </foreignObject>

                    <rect
                      x={node.x + width - 22}
                      y={node.y + height - 22}
                      width="22"
                      height="22"
                      rx="5"
                      fill="#f8fafc"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      className="cursor-se-resize"
                      style={{ pointerEvents: "auto" }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        beginNodeResize(event, node);
                      }}
                    />

                    {SIDES.map((side) => {
                      const point = handlePoint(node, side);
                      const isHorizontal = side === "top" || side === "bottom";

                      return (
                        <ellipse
                          key={`${node.id}-${side}`}
                          cx={point.x}
                          cy={point.y}
                          rx={isHorizontal ? 10 : 6}
                          ry={isHorizontal ? 6 : 10}
                          fill="#000"
                          stroke="white"
                          strokeWidth="2"
                          className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                          aria-label={`Connect ${node.label} from ${side}`}
                          onPointerDown={(event) =>
                            beginHandleConnection(event, node, side)
                          }
                        />
                      );
                    })}
                  </g>
                );
              })}
            {edges.map((edge) => {
              const from = nodes.find((node) => node.id === edge.from);
              const to = nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;
              const start = handlePoint(from, edge.side);
              const end = handlePoint(to, edge.targetSide || "left");
              return (
                <line
                  key={edge.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#000000"
                  strokeWidth="2.5"
                  markerEnd="url(#arrow)"
                />
              );
            })}
            {connection && (
              <line
                x1={connection.point.x}
                y1={connection.point.y}
                x2={connection.cursor.x}
                y2={connection.cursor.y}
                stroke="#60a5fa"
                strokeWidth="2.5"
                strokeDasharray="6 5"
                markerEnd="url(#arrow)"
              />
            )}
          </g>
        </svg>

        {nodeMenuId && selectedNode && (
          <div
            className="fixed z-[1000] w-48 rounded-lg border border-slate-300 bg-white p-2 opacity-100 shadow-xl"
            style={nodeMenuPosition(selectedNode)}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-2 pb-2 text-sm font-semibold text-slate-800">
              Node actions
            </div>
            {selectedNode.parentId && (
              <button
                onClick={() => detachNodeFromParent(selectedNode.id)}
                className="block w-full border-t border-slate-100 px-2 pt-2 text-left text-sm text-slate-700 hover:text-blue-600"
              >
                Detach from parent
              </button>
            )}
            <button
              onClick={() => {
                const nextIsParent = !selectedNode.isParent;
                updateNode(selectedNode.id, {
                  isParent: nextIsParent,
                  parentId: null,
                });
                setNodeMenuId(null);
              }}
              className="block w-full border-t border-slate-100 px-2 pt-2 text-left text-sm text-slate-700 hover:text-blue-600"
            >
              {selectedNode.isParent ? "Remove parent" : "Make parent node"}
            </button>
            <button
              onClick={() => {
                setDetailsNodeId(selectedNode.id);
                setNodeMenuId(null);
              }}
              className="block w-full border-t border-slate-100 px-2 pt-2 text-left text-sm text-slate-700 hover:text-blue-600"
            >
              Details
            </button>
            <button
              onClick={() => {
                const nextName = window.prompt(
                  "Rename node",
                  selectedNode.label || "",
                );
                if (nextName !== null) {
                  const cleanedName = nextName.trim();
                  if (cleanedName) {
                    updateNode(selectedNode.id, { label: cleanedName });
                  }
                }
                setNodeMenuId(null);
              }}
              className="block w-full border-t border-slate-100 px-2 pt-2 text-left text-sm text-slate-700 hover:text-blue-600"
            >
              Rename node
            </button>
            {connectedEdges(selectedNode.id, "right").map((edge) => (
              <button
                key={edge.id}
                onClick={() => removeConnection(edge.id)}
                className="mt-2 block w-full border-t border-slate-100 px-2 pt-2 text-left text-sm text-rose-600 hover:text-rose-700"
              >
                Remove connection
              </button>
            ))}
          </div>
        )}

        {handleMenu && (
          <div
            className="fixed z-[1000] w-48 rounded-lg border border-blue-300 bg-white p-2 opacity-100 shadow-xl"
            style={handleMenuPosition(handleMenu.point, handleMenu.side)}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-blue-100 px-2 pb-2 text-sm font-semibold capitalize text-slate-800">
              {handleMenu.side} connection
            </div>
            <button
              onClick={() => beginNodeConnection("one-way")}
              className="block w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
            >
              Add one-way connection
            </button>
            <button
              onClick={() => beginNodeConnection("two-way")}
              className="block w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
            >
              Add two-way connection
            </button>
            {connectedEdges(handleMenu.nodeId, handleMenu.side).map((edge) => (
              <button
                key={edge.id}
                onClick={() => {
                  removeConnection(edge.id);
                  setHandleMenu(null);
                }}
                className="mt-1 block w-full border-t border-blue-100 px-2 pt-2 text-left text-sm text-rose-600 hover:text-rose-700"
              >
                Remove connection
              </button>
            ))}
          </div>
        )}

        {detailsNodeId && (
          <div
            className="fixed z-[1001] max-h-[min(70vh,40rem)] w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-slate-300 bg-white p-5 opacity-100 shadow-xl"
            style={selectedNode ? nodeMenuPosition(selectedNode) : undefined}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="text-sm font-semibold text-slate-800">
                Details for {selectedNode?.label}
              </div>
              <button
                type="button"
                aria-label="Add detail"
                title="Add detail"
                onClick={() =>
                  updateNode(detailsNodeId, {
                    details: [
                      ...(nodes.find((node) => node.id === detailsNodeId)
                        ?.details || []),
                      { key: "", value: "" },
                    ],
                  })
                }
                className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-blue-600"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="max-h-[calc(70vh-6rem)] space-y-2 overflow-y-auto">
              {(nodes.find((node) => node.id === detailsNodeId)?.details || [])
                .length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-500">
                  No details yet. Add a key/value pair.
                </p>
              ) : (
                (
                  nodes.find((node) => node.id === detailsNodeId)?.details || []
                ).map((detail, index) => (
                  <div
                    key={`${detailsNodeId}-detail-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2"
                  >
                    <input
                      value={detail.key}
                      onChange={(event) => {
                        const currentDetails =
                          nodes.find((node) => node.id === detailsNodeId)
                            ?.details || [];
                        updateNode(detailsNodeId, {
                          details: currentDetails.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, key: event.target.value }
                              : item,
                          ),
                        });
                      }}
                      placeholder="Key"
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                    <input
                      value={detail.value}
                      onChange={(event) => {
                        const currentDetails =
                          nodes.find((node) => node.id === detailsNodeId)
                            ?.details || [];
                        updateNode(detailsNodeId, {
                          details: currentDetails.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        });
                      }}
                      placeholder="Value"
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
