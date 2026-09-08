const DEFAULT_NODE_WIDTH = 156;
const DEFAULT_NODE_HEIGHT = 72;
const DEFAULT_VIEWPORT_SCALE = 1;

export const createId = (prefix = "id") => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const normalizeNode = (node, index) => ({
  id: String(node.id || createId(`node-${index}`)),
  x: Number.isFinite(node.x) ? node.x : 0,
  y: Number.isFinite(node.y) ? node.y : 0,
  width: Number.isFinite(node.width) ? node.width : DEFAULT_NODE_WIDTH,
  height: Number.isFinite(node.height) ? node.height : DEFAULT_NODE_HEIGHT,
  label: typeof node.label === "string" ? node.label : "Untitled node",
  details: Array.isArray(node.details) ? node.details : [],
  isParent: Boolean(node.isParent),
  parentId: node.parentId ? String(node.parentId) : null,
});

const normalizeEdge = (edge, index) => ({
  id: String(edge.id || createId(`edge-${index}`)),
  from: String(edge.from),
  to: String(edge.to),
  side: edge.side || "right",
  targetSide: edge.targetSide || "left",
});

export const normalizeGraphDocument = (document = {}) => {
  const nodes = (Array.isArray(document.nodes) ? document.nodes : []).map(
    normalizeNode,
  );
  const nodeIds = new Set(nodes.map((node) => node.id));
  const validParentIds = new Set(
    nodes.filter((node) => node.isParent).map((node) => node.id),
  );

  const normalizedNodes = nodes.map((node) => ({
    ...node,
    parentId:
      node.parentId &&
      node.parentId !== node.id &&
      validParentIds.has(node.parentId)
        ? node.parentId
        : null,
  }));
  const normalizedEdges = (Array.isArray(document.edges) ? document.edges : [])
    .map(normalizeEdge)
    .filter(
      (edge) =>
        edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to),
    );

  return {
    id: String(document.id || createId("graph")),
    name:
      typeof document.name === "string" && document.name.trim()
        ? document.name.trim()
        : "Untitled graph",
    nodes: normalizedNodes,
    edges: normalizedEdges,
    viewport: {
      x: Number.isFinite(document.viewport?.x) ? document.viewport.x : 0,
      y: Number.isFinite(document.viewport?.y) ? document.viewport.y : 0,
      scale: Number.isFinite(document.viewport?.scale)
        ? document.viewport.scale
        : DEFAULT_VIEWPORT_SCALE,
    },
    version:
      Number.isInteger(document.version) && document.version >= 0
        ? document.version
        : 0,
    updatedAt: document.updatedAt || new Date().toISOString(),
  };
};

export const createGraphDocument = (overrides = {}) =>
  normalizeGraphDocument({
    id: createId("graph"),
    name: "Untitled graph",
    ...overrides,
  });

export const serializeGraphDocument = (document) =>
  JSON.stringify(normalizeGraphDocument(document));

export const hydrateGraphDocument = (serialized) => {
  const parsed =
    typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  return normalizeGraphDocument(parsed);
};
