import React, { useEffect, useMemo, useRef, useState } from "react";
import Graph from "../../components/Graph";
import {
  createGraphDocument,
  normalizeGraphDocument,
} from "../../lib/graphDocument";
import apiClient from "../../lib/apiClient";

const SAVE_DELAY = 700;

const contentSignature = (document) =>
  JSON.stringify({
    name: document?.name || "",
    nodes: document?.nodes || [],
    edges: document?.edges || [],
    viewport: document?.viewport || { x: 0, y: 0 },
  });

const selectedIdFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("graph")) return params.get("graph");
  const hash = window.location.hash.replace(/^#/, "");
  return hash.startsWith("graph=") ? decodeURIComponent(hash.slice(6)) : null;
};

const setSelectedIdInLocation = (id) => {
  const url = new URL(window.location.href);
  url.searchParams.set("graph", id);
  window.history.replaceState({}, "", url);
};

export default function EditorPage({ user, logout }) {
  const [graphs, setGraphs] = useState([]);
  const [selectedGraphId, setSelectedGraphId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [document, setDocument] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveNonce, setSaveNonce] = useState(0);
  const [graphsMenuOpen, setGraphsMenuOpen] = useState(false);
  const saveTimerRef = useRef(null);
  const documentRef = useRef(null);
  const baselineRef = useRef("");
  const baseVersionRef = useRef(0);
  const blockedSignatureRef = useRef(null);

  const selectedGraph = useMemo(
    () => graphs.find((graph) => graph.id === selectedGraphId) || null,
    [graphs, selectedGraphId],
  );

  useEffect(() => {
    let active = true;
    apiClient
      .get("/api/graphs")
      .then((result) => {
        if (!active) return;
        const nextGraphs = result?.graphs || [];
        setGraphs(nextGraphs);
        const requestedId = selectedIdFromLocation();
        setSelectedGraphId(
          nextGraphs.some((graph) => graph.id === requestedId)
            ? requestedId
            : nextGraphs[0]?.id || null,
        );
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedGraph) {
      setDocument(null);
      return;
    }
    const nextDocument = normalizeGraphDocument(selectedGraph);
    documentRef.current = nextDocument;
    baselineRef.current = contentSignature(nextDocument);
    baseVersionRef.current = nextDocument.version;
    blockedSignatureRef.current = null;
    setDocument(nextDocument);
    setSaveState("idle");
    setSaveMessage("");
    setSelectedIdInLocation(selectedGraph.id);
  }, [selectedGraphId]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const updateGraphInList = (nextDocument) => {
    setGraphs((current) =>
      current.map((graph) =>
        graph.id === nextDocument.id ? { ...graph, ...nextDocument } : graph,
      ),
    );
  };

  const saveDocument = async (capturedDocument) => {
    if (!capturedDocument || capturedDocument.id !== selectedGraphId) return;
    setSaveState("saving");
    setSaveMessage("");
    try {
      const result = await apiClient.patch(
        `/api/graphs/${encodeURIComponent(capturedDocument.id)}`,
        { document: capturedDocument },
        { headers: { "If-Match": `"${baseVersionRef.current}"` } },
      );
      const nextDocument = normalizeGraphDocument(result);
      baseVersionRef.current = nextDocument.version;
      baselineRef.current = contentSignature(nextDocument);
      blockedSignatureRef.current = null;
      const current = documentRef.current;
      if (
        current &&
        contentSignature(current) === contentSignature(capturedDocument)
      ) {
        documentRef.current = nextDocument;
        setDocument(nextDocument);
        updateGraphInList(nextDocument);
      } else if (current) {
        const withLatestVersion = { ...current, version: nextDocument.version };
        documentRef.current = withLatestVersion;
        setDocument(withLatestVersion);
        updateGraphInList(withLatestVersion);
      }
      setSaveState("saved");
      setSaveMessage("Saved");
    } catch (requestError) {
      if (requestError.status === 409) {
        const currentServer = requestError.data?.current;
        const currentLocal = documentRef.current;
        if (currentServer && currentLocal) {
          const preserved = {
            ...currentLocal,
            version: currentServer.version,
          };
          baseVersionRef.current = currentServer.version;
          documentRef.current = preserved;
          setDocument(preserved);
          updateGraphInList(preserved);
          baselineRef.current = contentSignature(currentServer);
          blockedSignatureRef.current = contentSignature(preserved);
        }
        setSaveState("error");
        setSaveMessage(
          "This graph changed elsewhere. Your local edits are preserved.",
        );
      } else {
        setSaveState("error");
        setSaveMessage(requestError.message || "Unable to save changes.");
      }
    }
  };

  const handleDocumentChange = (nextDocument) => {
    const normalized = normalizeGraphDocument(nextDocument);
    normalized.version = baseVersionRef.current;
    documentRef.current = normalized;
    setDocument(normalized);
    updateGraphInList(normalized);
  };

  useEffect(() => {
    if (!document || !selectedGraphId) return undefined;
    const signature = contentSignature(document);
    if (
      signature === baselineRef.current ||
      signature === blockedSignatureRef.current
    ) {
      return undefined;
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveDocument(documentRef.current);
    }, SAVE_DELAY);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [document, selectedGraphId, saveNonce]);

  const selectGraph = (id) => {
    if (id === selectedGraphId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSelectedGraphId(id);
  };

  const createGraph = async () => {
    const name = window.prompt("Graph name", "Untitled graph");
    if (name === null) return;
    try {
      setError(null);
      const result = await apiClient.post("/api/graphs", {
        document: createGraphDocument({
          name: name.trim() || "Untitled graph",
        }),
      });
      setGraphs((current) => [result, ...current]);
      setSelectedGraphId(result.id);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteGraph = async (graph) => {
    if (!window.confirm(`Delete “${graph.name || "Untitled graph"}”?`)) return;
    try {
      setError(null);
      await apiClient.delete(`/api/graphs/${encodeURIComponent(graph.id)}`);
      const remaining = graphs.filter((candidate) => candidate.id !== graph.id);
      setGraphs(remaining);
      if (selectedGraphId === graph.id)
        setSelectedGraphId(remaining[0]?.id || null);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const navigation = (
    <header className="app-header sticky top-0 z-50 flex h-16 items-center justify-between px-6">
      <h1 className="app-brand text-xl font-semibold">Product Planr</h1>
      <form
        className="app-search"
        onSubmit={(event) => event.preventDefault()}
        role="search"
      >
        <input
          type="search"
          placeholder="Search Doucments"
          aria-label="Search documents"
          className="app-search-input"
        />
        <button type="submit" className="app-search-button">
          Search
        </button>
      </form>
      <div className="flex items-center gap-3">
        <div className="app-graphs-menu">
          <button
            type="button"
            className="app-graphs-button rounded-lg px-3 py-2 text-sm font-medium"
            aria-expanded={graphsMenuOpen}
            onClick={() => setGraphsMenuOpen((current) => !current)}
          >
            Your Graphs
          </button>
          {graphsMenuOpen && (
            <div className="app-graphs-dropdown">
              <div className="app-graphs-dropdown-header">
                <span>Select a graph</span>
                <button
                  type="button"
                  className="graph-add flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-white"
                  onClick={createGraph}
                  aria-label="Add graph"
                >
                  +
                </button>
              </div>
              {graphs.length === 0 ? (
                <p className="graph-list-empty px-2 py-4 text-center text-sm">
                  No graphs yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {graphs.map((graph) => (
                    <li
                      key={graph.id}
                      className="group flex items-center gap-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          selectGraph(graph.id);
                          setGraphsMenuOpen(false);
                        }}
                        className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm ${
                          graph.id === selectedGraphId
                            ? "graph-list-item-selected font-semibold"
                            : "graph-list-item"
                        }`}
                      >
                        {graph.name || "Untitled graph"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGraph(graph)}
                        aria-label={`Delete ${graph.name || "graph"}`}
                        className="graph-delete hidden h-7 w-7 shrink-0 rounded group-hover:block"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <span className="app-user hidden text-sm sm:inline">{user.email}</span>
        <button
          type="button"
          onClick={logout}
          className="app-sign-out rounded-lg px-3 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </div>
    </header>
  );

  if (loading) {
    return (
      <>
        {navigation}
        <main className="app-main p-6">
          <p className="graph-loading rounded-xl p-8 text-sm">
            Loading graphs…
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      {navigation}
      <main className="app-main p-6">
        <div className="graph-page space-y-4">
          {(error || saveMessage || saveState === "saving") && (
            <div
              role={saveState === "error" || error ? "alert" : undefined}
              aria-live="polite"
              className={`graph-status rounded-lg px-4 py-3 text-sm ${
                error || saveState === "error"
                  ? "graph-status-error"
                  : saveState === "saving"
                    ? "graph-status-saving"
                    : "graph-status-saved"
              }`}
            >
              {error || saveMessage || "Saving…"}
              {saveState === "error" && (
                <button
                  type="button"
                  onClick={() => {
                    blockedSignatureRef.current = null;
                    setSaveNonce((value) => value + 1);
                  }}
                  className="ml-3 font-semibold underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="min-w-0">
            {document ? (
              <Graph
                key={document.id}
                document={document}
                onDocumentChange={handleDocumentChange}
              />
            ) : (
              <div className="empty-graph flex h-[calc(100vh-8rem)] flex-col items-center justify-center rounded-xl p-8 text-center">
                <h2 className="text-lg font-semibold text-slate-800">
                  No graphs yet
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Create a graph to start mapping your product.
                </p>
                <button
                  type="button"
                  onClick={createGraph}
                  className="graph-primary-action mt-5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                >
                  Create graph
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
