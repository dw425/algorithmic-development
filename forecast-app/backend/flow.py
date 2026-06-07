"""DAG executor for the node platform. Takes a flow {nodes, edges}, runs nodes in topological order,
wires each node's inputs from upstream outputs (fan-in → list for ensembles), and returns per-node
status + JSON-safe summaries. Values flow in-memory during a run; only summaries go to the client."""
import platform_nodes as pn

NODE_DEFS = pn.NODE_DEFS


def _params(node: dict) -> dict:
    return node.get("params") or (node.get("data") or {}).get("params") or {}


def _default_out(ntype: str) -> str | None:
    outs = NODE_DEFS.get(ntype, {}).get("outputs", [])
    return outs[0]["name"] if outs else None


def _default_in(ntype: str) -> str | None:
    ins = NODE_DEFS.get(ntype, {}).get("inputs", [])
    return ins[0]["name"] if ins else None


def _is_multi(ntype: str, port: str) -> bool:
    for p in NODE_DEFS.get(ntype, {}).get("inputs", []):
        if p["name"] == port:
            return bool(p.get("multi"))
    return False


def run_flow(graph: dict) -> dict:
    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    edges = [e for e in graph.get("edges", []) if e.get("source") in nodes and e.get("target") in nodes]
    indeg = {nid: 0 for nid in nodes}
    for e in edges:
        indeg[e["target"]] += 1
    queue = [nid for nid, d in indeg.items() if d == 0]
    order: list[str] = []
    deg = dict(indeg)
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for e in edges:
            if e["source"] == nid:
                deg[e["target"]] -= 1
                if deg[e["target"]] == 0:
                    queue.append(e["target"])
    if len(order) != len(nodes):
        return {"error": "cycle detected — flows must be a DAG", "nodes": {}}

    outputs: dict[str, dict] = {}
    results: dict[str, dict] = {}
    for nid in order:
        node = nodes[nid]
        ntype = node.get("type")
        # gather inputs from incoming edges
        inputs: dict = {}
        for e in edges:
            if e["target"] != nid or e["source"] not in outputs:
                continue
            sport = e.get("sourceHandle") or _default_out(nodes[e["source"]].get("type"))
            tport = e.get("targetHandle") or _default_in(ntype)
            val = outputs[e["source"]].get(sport)
            if tport in inputs:
                if isinstance(inputs[tport], list):
                    inputs[tport].append(val)
                else:
                    inputs[tport] = [inputs[tport], val]
            else:
                inputs[tport] = val
        # enforce list shape for multi ports
        for port in list(inputs.keys()):
            if _is_multi(ntype, port) and not isinstance(inputs[port], list):
                inputs[port] = [inputs[port]]
        try:
            outs, summary = pn.run_node(ntype, _params(node), inputs)
            outputs[nid] = outs or {}
            results[nid] = {"status": "error" if summary.get("error") else "done",
                            "summary": summary, "error": summary.get("error")}
        except Exception as ex:  # noqa - surface per-node failure, keep the rest running
            outputs[nid] = {}
            results[nid] = {"status": "error", "summary": {}, "error": f"{type(ex).__name__}: {str(ex)[:200]}"}
    return {"order": order, "nodes": results}
