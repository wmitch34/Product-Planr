const crypto = require("node:crypto");
const isObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const finiteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);
const validationError = (message) =>
  Object.assign(new Error(message), { status: 400 });
const validateGraphDocument = (input, { id, version = 0 } = {}) => {
  if (!isObject(input))
    throw validationError("Graph document must be a JSON object");
  if (input.nodes !== undefined && !Array.isArray(input.nodes))
    throw validationError("nodes must be an array");
  if (input.edges !== undefined && !Array.isArray(input.edges))
    throw validationError("edges must be an array");
  const nodes = input.nodes || [],
    edges = input.edges || [];
  if (nodes.length > 1000 || edges.length > 3000)
    throw validationError("Graph is too large");
  const seen = new Set();
  const normalizedNodes = nodes.map((node, index) => {
    if (!isObject(node))
      throw validationError(`nodes[${index}] must be an object`);
    const nodeId =
      typeof node.id === "string" && node.id.trim()
        ? node.id
        : crypto.randomUUID();
    if (seen.has(nodeId)) throw validationError("Node IDs must be unique");
    seen.add(nodeId);
    return {
      id: nodeId,
      x: finiteNumber(node.x) ? node.x : 0,
      y: finiteNumber(node.y) ? node.y : 0,
      width: finiteNumber(node.width) ? node.width : 156,
      height: finiteNumber(node.height) ? node.height : 72,
      label:
        typeof node.label === "string"
          ? node.label.slice(0, 500)
          : "Untitled node",
      details: Array.isArray(node.details) ? node.details : [],
      isParent: Boolean(node.isParent),
      parentId: node.parentId == null ? null : String(node.parentId),
    };
  });
  const parentIds = new Set(
    normalizedNodes.filter((node) => node.isParent).map((node) => node.id),
  );
  normalizedNodes.forEach((node) => {
    if (
      node.parentId === node.id ||
      (node.parentId && !parentIds.has(node.parentId))
    )
      node.parentId = null;
  });
  const normalizedEdges = edges.map((edge, index) => {
    if (
      !isObject(edge) ||
      typeof edge.from !== "string" ||
      typeof edge.to !== "string"
    )
      throw validationError(`edges[${index}] must have from and to IDs`);
    if (edge.from === edge.to || !seen.has(edge.from) || !seen.has(edge.to))
      throw validationError(`edges[${index}] references an invalid node`);
    return {
      id:
        typeof edge.id === "string" && edge.id.trim()
          ? edge.id
          : crypto.randomUUID(),
      from: edge.from,
      to: edge.to,
      side: typeof edge.side === "string" ? edge.side : "right",
      targetSide:
        typeof edge.targetSide === "string" ? edge.targetSide : "left",
    };
  });
  return {
    id:
      id ||
      (typeof input.id === "string" && input.id.trim()
        ? input.id
        : crypto.randomUUID()),
    name:
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim().slice(0, 200)
        : "Untitled graph",
    nodes: normalizedNodes,
    edges: normalizedEdges,
    viewport: {
      x: finiteNumber(input.viewport?.x) ? input.viewport.x : 0,
      y: finiteNumber(input.viewport?.y) ? input.viewport.y : 0,
    },
    version: Number.isInteger(version) && version >= 0 ? version : 0,
    updatedAt:
      typeof input.updatedAt === "string"
        ? input.updatedAt
        : new Date().toISOString(),
  };
};
module.exports = { validateGraphDocument, validationError, isObject };
