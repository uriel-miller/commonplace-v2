"use client";

/**
 * ListingsAdmin — the operator's listings management table.
 *
 * Searchable + paginated table of every marketplace listing (thumbnail, title,
 * category, price, condition, id). Supports inline editing of title + price and
 * a confirm-guarded delete. Talks to /api/admin/listings (GET) and
 * /api/admin/listings/[id] (PATCH/DELETE). All fetches fail soft — a network or
 * server hiccup shows a banner, never a blank crash. Money is handled in cents;
 * display uses formatPrice.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { formatPrice, type Listing } from "@/lib/listing";

/* --------------------------------- styles --------------------------------- */

const HEAD = "font-family:'Newsreader',serif;color:var(--ink);";

const cell = css("padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:13px;color:var(--ink);");
const th = css(
  "padding:10px 12px;text-align:left;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap;",
);

const inputStyle = css(
  "padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:13px;color:var(--ink);background:var(--paper);width:100%;box-sizing:border-box;",
);

const btnBase =
  "padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--line);background:var(--paper);color:var(--ink);white-space:nowrap;";

/* ---------------------------------- types --------------------------------- */

interface ListResponse {
  ok: boolean;
  items: Listing[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  warning?: string;
  error?: string;
}

interface MutationResponse {
  ok: boolean;
  id?: number;
  error?: string;
}

interface EditState {
  id: number;
  title: string;
  /** Whole-dollar string as typed by the operator. */
  priceDollars: string;
}

/* -------------------------------- component -------------------------------- */

export function ListingsAdmin() {
  const [items, setItems] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Debounce the search term into an "applied" value that drives fetches.
  const [applied, setApplied] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      setApplied(search.trim());
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [search]);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/listings?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (res.status === 401) {
        setBanner({ kind: "error", text: "Not authorized. Check your admin session." });
        setItems([]);
        return;
      }
      const data = (await res.json()) as ListResponse;
      if (!data.ok && data.warning) {
        setBanner({ kind: "error", text: data.warning });
      } else {
        setBanner(null);
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      setBanner({ kind: "error", text: "Could not reach the server. Try again." });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, applied);
  }, [page, applied, load]);

  /* -------------------------------- editing ------------------------------- */

  function startEdit(l: Listing) {
    setConfirmDelete(null);
    setEdit({
      id: l.id,
      title: l.title,
      priceDollars: String(Math.round(l.priceCents / 100)),
    });
  }

  function cancelEdit() {
    setEdit(null);
  }

  async function saveEdit() {
    if (!edit) return;
    const title = edit.title.trim();
    const dollars = Number(edit.priceDollars.replace(/[^0-9.]/g, ""));
    if (!title) {
      setBanner({ kind: "error", text: "Title cannot be empty." });
      return;
    }
    if (!Number.isFinite(dollars) || dollars < 0) {
      setBanner({ kind: "error", text: "Enter a valid price." });
      return;
    }
    const priceCents = Math.round(dollars * 100);
    setSavingId(edit.id);
    try {
      const res = await fetch(`/api/admin/listings/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priceCents }),
      });
      const data = (await res.json()) as MutationResponse;
      if (res.status === 401) {
        setBanner({ kind: "error", text: "Not authorized to edit." });
        return;
      }
      if (!data.ok) {
        setBanner({ kind: "error", text: data.error ?? "Edit failed." });
        return;
      }
      // Optimistically patch the row in place.
      setItems((prev) =>
        prev.map((it) => (it.id === edit.id ? { ...it, title, priceCents } : it)),
      );
      setBanner({ kind: "info", text: "Saved." });
      setEdit(null);
    } catch {
      setBanner({ kind: "error", text: "Could not save. Try again." });
    } finally {
      setSavingId(null);
    }
  }

  /* -------------------------------- delete -------------------------------- */

  async function doDelete(id: number) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      const data = (await res.json()) as MutationResponse;
      if (res.status === 401) {
        setBanner({ kind: "error", text: "Not authorized to delete." });
        return;
      }
      if (!data.ok) {
        setBanner({ kind: "error", text: data.error ?? "Delete failed." });
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setBanner({ kind: "info", text: "Listing deleted." });
    } catch {
      setBanner({ kind: "error", text: "Could not delete. Try again." });
    } finally {
      setSavingId(null);
      setConfirmDelete(null);
    }
  }

  /* --------------------------------- view --------------------------------- */

  return (
    <div style={css("max-width:1100px;margin:0 auto;padding:24px 16px;")}>
      <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;")}>
        <h1 style={sx(HEAD, "font-size:26px;margin:0;")}>Listings</h1>
        <span style={css("font-size:12px;color:var(--muted);")}>
          {total.toLocaleString("en-US")} total
        </span>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search listings by title…"
        style={sx(inputStyle, "max-width:360px;margin-bottom:14px;")}
        aria-label="Search listings"
      />

      {banner && (
        <div
          role="status"
          style={sx(
            "padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:14px;border:1px solid var(--line);",
            banner.kind === "error"
              ? "background:#fdecec;color:var(--maroon);border-color:var(--maroon);"
              : "background:#eefaf0;color:var(--green);border-color:var(--green);",
          )}
        >
          {banner.text}
        </div>
      )}

      <div style={css("overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--paper);")}>
        <table style={css("width:100%;border-collapse:collapse;min-width:760px;")}>
          <thead>
            <tr>
              <th style={th}>Item</th>
              <th style={th}>Category</th>
              <th style={th}>Price</th>
              <th style={th}>Condition</th>
              <th style={th}>ID</th>
              <th style={sx(th, "text-align:right;")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td style={sx(cell, "text-align:center;color:var(--muted);padding:32px;")} colSpan={6}>
                  No listings found.
                </td>
              </tr>
            )}

            {items.map((l) => {
              const ed = edit && edit.id === l.id ? edit : null;
              const editing = ed !== null;
              const busy = savingId === l.id;
              const thumb = l.images[0];
              return (
                <tr key={l.id} style={busy ? css("opacity:.55;") : undefined}>
                  {/* Item: thumbnail + title (title inline-editable) */}
                  <td style={cell}>
                    <div style={css("display:flex;align-items:center;gap:10px;min-width:0;")}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          width={44}
                          height={44}
                          style={css("width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:none;")}
                        />
                      ) : (
                        <div style={css("width:44px;height:44px;border-radius:6px;background:var(--cream);border:1px solid var(--line);flex:none;")} />
                      )}
                      {ed ? (
                        <input
                          value={ed.title}
                          onChange={(e) => setEdit({ ...ed, title: e.target.value })}
                          style={inputStyle}
                          aria-label="Edit title"
                        />
                      ) : (
                        <span style={css("font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;")}>
                          {l.title}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Category */}
                  <td style={sx(cell, "color:var(--muted);white-space:nowrap;")}>{l.categoryName}</td>

                  {/* Price (inline-editable) */}
                  <td style={sx(cell, "white-space:nowrap;")}>
                    {ed ? (
                      <div style={css("display:flex;align-items:center;gap:4px;")}>
                        <span style={css("color:var(--muted);")}>$</span>
                        <input
                          value={ed.priceDollars}
                          inputMode="numeric"
                          onChange={(e) => setEdit({ ...ed, priceDollars: e.target.value })}
                          style={sx(inputStyle, "width:90px;")}
                          aria-label="Edit price in dollars"
                        />
                      </div>
                    ) : (
                      <span style={css("font-weight:600;")}>{formatPrice(l.priceCents)}</span>
                    )}
                  </td>

                  {/* Condition */}
                  <td style={sx(cell, "color:var(--muted);white-space:nowrap;")}>
                    {l.condition ?? "—"}
                  </td>

                  {/* ID */}
                  <td style={sx(cell, "color:var(--muted);font-variant-numeric:tabular-nums;")}>{l.id}</td>

                  {/* Actions */}
                  <td style={sx(cell, "text-align:right;white-space:nowrap;")}>
                    {editing ? (
                      <div style={css("display:inline-flex;gap:6px;")}>
                        <Hoverable
                          as="button"
                          onClick={saveEdit}
                          disabled={busy}
                          styles={`${btnBase}background:var(--green);color:var(--cream);border-color:var(--green);`}
                          hover="opacity:.9;"
                        >
                          {busy ? "Saving…" : "Save"}
                        </Hoverable>
                        <Hoverable
                          as="button"
                          onClick={cancelEdit}
                          disabled={busy}
                          styles={btnBase}
                          hover="background:var(--cream);"
                        >
                          Cancel
                        </Hoverable>
                      </div>
                    ) : confirmDelete === l.id ? (
                      <div style={css("display:inline-flex;gap:6px;align-items:center;")}>
                        <span style={css("font-size:12px;color:var(--maroon);")}>Delete?</span>
                        <Hoverable
                          as="button"
                          onClick={() => doDelete(l.id)}
                          disabled={busy}
                          styles={`${btnBase}background:var(--maroon);color:var(--cream);border-color:var(--maroon);`}
                          hover="opacity:.9;"
                        >
                          Yes
                        </Hoverable>
                        <Hoverable
                          as="button"
                          onClick={() => setConfirmDelete(null)}
                          disabled={busy}
                          styles={btnBase}
                          hover="background:var(--cream);"
                        >
                          No
                        </Hoverable>
                      </div>
                    ) : (
                      <div style={css("display:inline-flex;gap:6px;")}>
                        <Hoverable
                          as="button"
                          onClick={() => startEdit(l)}
                          styles={btnBase}
                          hover="background:var(--cream);"
                        >
                          Edit
                        </Hoverable>
                        <Hoverable
                          as="button"
                          onClick={() => {
                            setEdit(null);
                            setConfirmDelete(l.id);
                          }}
                          styles={`${btnBase}color:var(--maroon);border-color:var(--maroon);`}
                          hover="background:#fdecec;"
                        >
                          Delete
                        </Hoverable>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={css("display:flex;align-items:center;justify-content:center;gap:14px;margin-top:18px;")}>
        <Hoverable
          as="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          styles={sx(btnBase, page <= 1 || loading ? "opacity:.45;cursor:default;" : "")}
          hover={page <= 1 || loading ? "" : "background:var(--cream);"}
        >
          ← Prev
        </Hoverable>
        <span style={css("font-size:13px;color:var(--muted);")}>
          Page {page} of {totalPages}
        </span>
        <Hoverable
          as="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
          styles={sx(btnBase, page >= totalPages || loading ? "opacity:.45;cursor:default;" : "")}
          hover={page >= totalPages || loading ? "" : "background:var(--cream);"}
        >
          Next →
        </Hoverable>
      </div>

      {loading && (
        <p style={css("text-align:center;color:var(--muted);font-size:12px;margin-top:10px;")}>Loading…</p>
      )}
    </div>
  );
}

export default ListingsAdmin;
