import React, { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const PHASES = ["pre-listing", "listing", "active", "under-contract", "closing", "post-closing"];
const ASSIGNEES = ["agent", "tc", "buyer", "seller", "lender", "title", "inspector", "admin"];
const TRANSACTION_TYPES = ["Listing (Seller)", "Buyer Representation", "Dual Agency", "Rental", "Commercial"];

const COLORS = {
  navy: "#1a2332",
  red: "#c8102e",
  bg: "#f7f8fa",
  border: "#e3e6eb",
  text: "#1a2332",
  muted: "#6b7280"
};

export default function TaskTemplatesAdmin({ token, user }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [newDraft, setNewDraft] = useState({
    transaction_type: "Listing (Seller)",
    phase: "active",
    task_name: "",
    description: "",
    default_assignee_role: "agent",
    days_from_open: 0,
    category: "",
    is_required: false,
    sort_order: 100,
    active: true,
    state: "FL",
    notes: ""
  });
  const [filterType, setFilterType] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/admin/task-templates", {
        headers: { "Authorization": "Bearer " + token }
      });
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (e) { alert("Failed to load templates"); }
    setLoading(false);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditDraft({ ...t });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = async () => {
    try {
      const res = await fetch(API + "/admin/task-templates/" + editingId, {
        method: "PUT",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(editDraft)
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        setEditDraft({});
        fetchTemplates();
      } else {
        alert("Save failed: " + (data.error || "unknown"));
      }
    } catch (e) { alert("Save failed"); }
  };

  const createNew = async () => {
    if (!newDraft.task_name.trim()) { alert("Task name is required"); return; }
    try {
      const res = await fetch(API + "/admin/task-templates", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(newDraft)
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setNewDraft({
          transaction_type: "Listing (Seller)", phase: "active", task_name: "",
          description: "", default_assignee_role: "agent", days_from_open: 0,
          category: "", is_required: false, sort_order: 100, active: true,
          state: "FL", notes: ""
        });
        fetchTemplates();
      } else {
        alert("Create failed: " + (data.error || "unknown"));
      }
    } catch (e) { alert("Create failed"); }
  };

  const archiveTemplate = async (id, name) => {
    if (!window.confirm("Archive '" + name + "'? It will be hidden from new transactions but existing tasks won't be affected.")) return;
    try {
      const res = await fetch(API + "/admin/task-templates/" + id, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) fetchTemplates();
    } catch (e) { alert("Archive failed"); }
  };

  const filtered = templates.filter(t => {
    if (!showInactive && !t.active) return false;
    if (filterType !== "all" && t.transaction_type !== filterType) return false;
    if (filterPhase !== "all" && t.phase !== filterPhase) return false;
    return true;
  });

  const inputStyle = {
    padding: "8px 10px", border: "1px solid " + COLORS.border, borderRadius: 6,
    fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box"
  };

  const btnPrimary = {
    background: COLORS.red, color: "white", border: "none", borderRadius: 6,
    padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
  };

  const btnSecondary = {
    background: "white", color: COLORS.text, border: "1px solid " + COLORS.border,
    borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit"
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, color: COLORS.navy, fontSize: 24 }}>📋 Task Templates</h1>
          <p style={{ color: COLORS.muted, marginTop: 6 }}>
            Manage the workflow tasks that get auto-generated for each transaction type.
            Changes apply to new transactions going forward.
          </p>
        </div>

        <div style={{ background: "white", border: "1px solid " + COLORS.border, borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Transaction Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="all">All Types</option>
              {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Phase</label>
            <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="all">All Phases</option>
              {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 18 }}>
            <input type="checkbox" id="showInactive" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            <label htmlFor="showInactive" style={{ fontSize: 13, color: COLORS.text, cursor: "pointer" }}>Show archived</label>
          </div>
          <div style={{ marginLeft: "auto", paddingTop: 18 }}>
            <button style={btnPrimary} onClick={() => setShowCreate(true)}>+ New Task Template</button>
          </div>
        </div>

        <div style={{ background: "white", border: "1px solid " + COLORS.border, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: COLORS.muted }}>
          Showing <strong style={{ color: COLORS.text }}>{filtered.length}</strong> of {templates.length} templates
        </div>

        {showCreate && (
          <div style={{ background: "white", border: "2px solid " + COLORS.red, borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, color: COLORS.navy }}>New Task Template</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Task Name *</label>
                <input style={inputStyle} value={newDraft.task_name} onChange={e => setNewDraft({ ...newDraft, task_name: e.target.value })} placeholder="e.g., Order home inspection" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Transaction Type</label>
                <select style={inputStyle} value={newDraft.transaction_type} onChange={e => setNewDraft({ ...newDraft, transaction_type: e.target.value })}>
                  {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Phase</label>
                <select style={inputStyle} value={newDraft.phase} onChange={e => setNewDraft({ ...newDraft, phase: e.target.value })}>
                  {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Assignee Role</label>
                <select style={inputStyle} value={newDraft.default_assignee_role} onChange={e => setNewDraft({ ...newDraft, default_assignee_role: e.target.value })}>
                  {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Days From Open (negative = before closing)</label>
                <input type="number" style={inputStyle} value={newDraft.days_from_open} onChange={e => setNewDraft({ ...newDraft, days_from_open: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Sort Order</label>
                <input type="number" style={inputStyle} value={newDraft.sort_order} onChange={e => setNewDraft({ ...newDraft, sort_order: parseInt(e.target.value) || 100 })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Category</label>
                <input style={inputStyle} value={newDraft.category} onChange={e => setNewDraft({ ...newDraft, category: e.target.value })} placeholder="e.g., Inspection, Title, Marketing" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>State</label>
                <input style={inputStyle} value={newDraft.state} onChange={e => setNewDraft({ ...newDraft, state: e.target.value })} placeholder="FL" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Description (what the agent should do)</label>
                <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} value={newDraft.description} onChange={e => setNewDraft({ ...newDraft, description: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Notes (admin reference)</label>
                <textarea style={{ ...inputStyle, minHeight: 40, fontFamily: "inherit" }} value={newDraft.notes} onChange={e => setNewDraft({ ...newDraft, notes: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: COLORS.text, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={newDraft.is_required} onChange={e => setNewDraft({ ...newDraft, is_required: e.target.checked })} />
                  Required task
                </label>
              </div>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowCreate(false)}>Cancel</button>
              <button style={btnPrimary} onClick={createNew}>Create Template</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Loading...</div>
        ) : (
          <div style={{ background: "white", border: "1px solid " + COLORS.border, borderRadius: 8, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>
                No templates match your filters.
              </div>
            ) : filtered.map(t => (
              <div key={t.id} style={{
                borderBottom: "1px solid " + COLORS.border,
                padding: 16,
                opacity: t.active ? 1 : 0.55,
                background: editingId === t.id ? "#fff8f8" : "white"
              }}>
                {editingId === t.id ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Task Name</label>
                        <input style={inputStyle} value={editDraft.task_name || ""} onChange={e => setEditDraft({ ...editDraft, task_name: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Transaction Type</label>
                        <select style={inputStyle} value={editDraft.transaction_type || ""} onChange={e => setEditDraft({ ...editDraft, transaction_type: e.target.value })}>
                          {TRANSACTION_TYPES.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Phase</label>
                        <select style={inputStyle} value={editDraft.phase || ""} onChange={e => setEditDraft({ ...editDraft, phase: e.target.value })}>
                          {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Assignee</label>
                        <select style={inputStyle} value={editDraft.default_assignee_role || ""} onChange={e => setEditDraft({ ...editDraft, default_assignee_role: e.target.value })}>
                          {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Days From Open</label>
                        <input type="number" style={inputStyle} value={editDraft.days_from_open ?? 0} onChange={e => setEditDraft({ ...editDraft, days_from_open: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Sort Order</label>
                        <input type="number" style={inputStyle} value={editDraft.sort_order ?? 100} onChange={e => setEditDraft({ ...editDraft, sort_order: parseInt(e.target.value) || 100 })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Category</label>
                        <input style={inputStyle} value={editDraft.category || ""} onChange={e => setEditDraft({ ...editDraft, category: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>State</label>
                        <input style={inputStyle} value={editDraft.state || ""} onChange={e => setEditDraft({ ...editDraft, state: e.target.value })} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Description</label>
                        <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} value={editDraft.description || ""} onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 4 }}>Notes</label>
                        <textarea style={{ ...inputStyle, minHeight: 40, fontFamily: "inherit" }} value={editDraft.notes || ""} onChange={e => setEditDraft({ ...editDraft, notes: e.target.value })} />
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input type="checkbox" checked={!!editDraft.is_required} onChange={e => setEditDraft({ ...editDraft, is_required: e.target.checked })} />
                          Required
                        </label>
                        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input type="checkbox" checked={!!editDraft.active} onChange={e => setEditDraft({ ...editDraft, active: e.target.checked })} />
                          Active
                        </label>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button style={btnSecondary} onClick={cancelEdit}>Cancel</button>
                      <button style={btnPrimary} onClick={saveEdit}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <strong style={{ color: COLORS.text, fontSize: 15 }}>{t.task_name}</strong>
                        {t.is_required && <span style={{ background: "#fef2f2", color: COLORS.red, fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>REQUIRED</span>}
                        {!t.active && <span style={{ background: "#f3f4f6", color: COLORS.muted, fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>ARCHIVED</span>}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>
                        <strong>{t.transaction_type}</strong> · {t.phase} · assigned to <strong>{t.default_assignee_role}</strong> · day {t.days_from_open >= 0 ? "+" : ""}{t.days_from_open}
                        {t.category && <> · {t.category}</>}
                      </div>
                      {t.description && <div style={{ fontSize: 13, color: COLORS.text, marginTop: 4 }}>{t.description}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button style={btnSecondary} onClick={() => startEdit(t)}>Edit</button>
                      {t.active && <button style={{ ...btnSecondary, color: COLORS.red }} onClick={() => archiveTemplate(t.id, t.task_name)}>Archive</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
