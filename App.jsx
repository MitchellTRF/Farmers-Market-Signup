import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const LOGO_URL =
  "https://images.squarespace-cdn.com/content/v1/65a5463e9d143d289eafca2a/21ac092d-9476-4893-a932-b12c33da37e1/mcfm.png";

const ADMIN_PASSWORD = "mcfm2026";

const VENDOR_TYPES = [
  "Locally Grown Farm Product – Produce",
  "Locally Grown Farm Product – Meat",
  "Floral",
  "Value Added Items",
  "Bakery Goods",
  "Craft / Artisan",
  "Prepared Foods",
  "Youth Vendor",
  "Other",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(s) {
  if (!s) return "";
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── PRINT REPORT ────────────────────────────────────────────────────────────
function printMarketReport(market) {
  const confirmed = (market.signups || [])
    .filter((s) => s.status === "confirmed")
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = confirmed.map((v, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${v.name}</strong></td>
      <td>${v.owner_name || "—"}</td>
      <td>${v.phone || "—"}</td>
      <td>${v.vendor_type}</td>
      <td class="check"></td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Market Report – ${formatDate(market.date)}</title>
      <style>
        body { font-family: Georgia, serif; margin: 40px; color: #1a1a0a; }
        .header { text-align: center; border-bottom: 3px solid #3a6b35; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; margin: 0 0 4px; color: #3a6b35; }
        .header p { margin: 2px 0; font-size: 13px; color: #5a5040; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #3a6b35; color: white; padding: 8px 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #d8c898; vertical-align: top; }
        tr:nth-child(even) td { background: #faf5e8; }
        td.check { width: 50px; border: 1px solid #888; border-radius: 3px; background: white; }
        .footer { margin-top: 24px; font-size: 11px; color: #8a7a60; text-align: center; }
        .summary { margin-bottom: 16px; font-size: 13px; }
        .summary span { display: inline-block; margin-right: 20px; }
        @media print {
          body { margin: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Mason City Farmers Market</h1>
        <p><strong>${formatDate(market.date)}</strong> &nbsp;·&nbsp; ${market.location}</p>
        <p>Vendor Check-In Sheet</p>
      </div>
      <div class="summary">
        <span>📋 <strong>${confirmed.length}</strong> confirmed vendors</span>
        <span>🏷 Capacity: <strong>${market.capacity}</strong></span>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Business Name</th>
            <th>Owner Name</th>
            <th>Phone</th>
            <th>Vendor Type</th>
            <th>✓ Here</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        Printed ${new Date().toLocaleDateString()} &nbsp;·&nbsp; Mason City Farmers Market &nbsp;·&nbsp; PO Box 16, Mason City, IA 50402
      </div>
    </body>
    </html>
  `;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

// ─── DATA LAYER ──────────────────────────────────────────────────────────────
async function fetchData() {
  const t = todayStr();
  const [
    { data: allMarkets, error: mErr },
    { data: vendorLimits },
    { data: settings },
    { data: notifications },
  ] = await Promise.all([
    supabase
      .from("markets")
      .select("*, signups(*)")
      .order("date", { ascending: true }),
    supabase.from("vendor_limits").select("*").order("name"),
    supabase.from("settings").select("*"),
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (mErr) throw mErr;

  const typeLimits =
    settings?.find((s) => s.key === "type_limits")?.value || {};

  return {
    markets: (allMarkets || []).filter((m) => !m.archived && m.date >= t),
    archivedMarkets: (allMarkets || []).filter((m) => m.archived).reverse(),
    vendorLimits: vendorLimits || [],
    typeLimits,
    notifications: notifications || [],
  };
}

async function logNotification(message) {
  await supabase.from("notifications").insert({ message });
}

// ─── UI ATOMS ────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-9 h-9 border-4 border-[#3a6b35] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Badge({ children, color = "green" }) {
  const c = {
    green: "bg-[#3a6b35] text-white",
    amber: "bg-[#c17f24] text-white",
    red: "bg-[#a03030] text-white",
    gray: "bg-[#8a7a60] text-white",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c[color]}`}>
      {children}
    </span>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="block text-xs font-bold text-[#5a5040] uppercase tracking-wider mb-1">
      {children}
    </label>
  );
}

function TextInput({ label, ...props }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        {...props}
        className={`w-full bg-white border border-[#c8b98a] rounded-lg px-3 py-2 text-[#2a2010] focus:outline-none focus:border-[#3a6b35] focus:ring-1 focus:ring-[#3a6b35] ${props.className || ""}`}
      />
    </div>
  );
}

function Btn({ children, variant = "primary", className = "", loading: isLoading, ...props }) {
  const base =
    "font-bold rounded-lg transition-all text-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed";
  const v = {
    primary: "bg-[#3a6b35] text-white hover:bg-[#2d5228] shadow-sm",
    secondary: "bg-[#c17f24] text-white hover:bg-[#a06818] shadow-sm",
    danger: "bg-[#fde8e8] text-[#a03030] hover:bg-[#fad0d0]",
    ghost: "bg-white border border-[#c8b98a] text-[#5a5040] hover:bg-[#faf5e8]",
    archive: "bg-[#e8dfc8] text-[#5a5040] hover:bg-[#d8cfa8]",
    print: "bg-[#1a3a5a] text-white hover:bg-[#0f2840] shadow-sm",
  };
  return (
    <button
      className={`${base} ${v[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Saving…
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-[#d8c898] rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="bg-[#fffbec] border border-[#f0d888] rounded-xl p-4 text-sm text-[#7a5c10]">
      {children}
    </div>
  );
}

function MsgBanner({ msg }) {
  if (!msg) return null;
  const s = {
    success: "bg-[#e8f5e0] text-[#2d5a27] border-[#a0d090]",
    waitlist: "bg-[#fffbec] text-[#7a5c10] border-[#f0d888]",
    error: "bg-[#fde8e8] text-[#7a1a1a] border-[#f0b0b0]",
    info: "bg-[#e8f0f8] text-[#1a3a5a] border-[#a0b8d0]",
  };
  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${s[msg.type] || s.info}`}>
      {msg.text}
    </div>
  );
}

// ─── ADMIN LOGIN ─────────────────────────────────────────────────────────────
function AdminLogin({ onSuccess }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const attempt = () => {
    if (pw === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setErr(true);
      setPw("");
      setTimeout(() => setErr(false), 2000);
    }
  };

  return (
    <Card className="p-6 max-w-xs mx-auto mt-4">
      <div className="text-center mb-5">
        <div className="text-3xl mb-2">🔒</div>
        <h3 className="font-display text-lg text-[#3a6b35]">Admin Access</h3>
        <p className="text-xs text-[#8a7a60] mt-1">Enter the admin password to continue.</p>
      </div>
      <div className="space-y-3">
        <TextInput
          label="Password"
          type="password"
          placeholder="••••••••"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          className={err ? "border-[#a03030]" : ""}
        />
        {err && (
          <p className="text-xs text-[#a03030] text-center font-medium">
            Incorrect password. Try again.
          </p>
        )}
        <Btn variant="primary" className="w-full py-2.5" onClick={attempt} disabled={!pw}>
          Unlock Admin →
        </Btn>
      </div>
    </Card>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
function AdminPanel({ data, reload, onLogout }) {
  const [tab, setTab] = useState("markets");
  const [saving, setSaving] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [expanded, setExpanded] = useState(null);

  // Add market form
  const [newDate, setNewDate] = useState("");
  const [newCap, setNewCap] = useState(20);
  const [newLoc, setNewLoc] = useState("");

  // Vendor limits form
  const [limName, setLimName] = useState("");
  const [limEmail, setLimEmail] = useState("");
  const [limCount, setLimCount] = useState(2);

  // Type cap edits (local until saved)
  const [typeCapEdits, setTypeCapEdits] = useState({});
  useEffect(() => {
    const init = {};
    VENDOR_TYPES.forEach((t) => { init[t] = data.typeLimits[t] ?? ""; });
    setTypeCapEdits(init);
  }, [data.typeLimits]);

  const run = async (fn) => {
    setSaving(true);
    try { await fn(); await reload(); } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // ── Market operations ──
  const addMarket = () =>
    run(async () => {
      if (!newDate) return;
      await supabase.from("markets").insert({
        date: newDate,
        location: newLoc || "Southbridge Mall",
        capacity: parseInt(newCap),
      });
      setNewDate(""); setNewLoc("");
    });

  const setArchived = (id, archived) =>
    run(async () => {
      await supabase.from("markets").update({ archived }).eq("id", id);
      setExpanded(null);
    });

  const deleteMarket = (id) =>
    run(async () => {
      await supabase.from("markets").delete().eq("id", id);
      setExpanded(null);
    });

  const removeSignup = (signupId) =>
    run(async () => {
      await supabase.from("signups").delete().eq("id", signupId);
    });

  const promoteWaitlist = (market) =>
    run(async () => {
      const signups = market.signups || [];
      const confirmed = signups.filter((s) => s.status === "confirmed");
      const waitlist = signups
        .filter((s) => s.status === "waitlist")
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      if (confirmed.length >= market.capacity || waitlist.length === 0) return;

      const eligible = waitlist.find((v) => {
        const cap = data.typeLimits[v.vendor_type];
        if (!cap) return true;
        return confirmed.filter((c) => c.vendor_type === v.vendor_type).length < cap;
      });
      if (!eligible) return;

      await supabase.from("signups").update({ status: "confirmed" }).eq("id", eligible.id);
      await logNotification(
        `🎉 ${eligible.name} (${eligible.vendor_type}) promoted to confirmed for ${formatDate(market.date)}.`
      );
    });

  // ── Vendor limit operations ──
  const addVendorLimit = () =>
    run(async () => {
      if (!limName.trim() || !limEmail.trim()) return;
      await supabase.from("vendor_limits").insert({
        name: limName.trim(),
        email: limEmail.trim().toLowerCase(),
        max_markets: parseInt(limCount),
      });
      setLimName(""); setLimEmail(""); setLimCount(2);
    });

  const removeVendorLimit = (id) =>
    run(async () => { await supabase.from("vendor_limits").delete().eq("id", id); });

  const updateVendorLimit = (id, val) =>
    run(async () => {
      await supabase.from("vendor_limits").update({ max_markets: parseInt(val) }).eq("id", id);
    });

  // ── Type caps ──
  const saveTypeLimits = () =>
    run(async () => {
      const tl = {};
      Object.entries(typeCapEdits).forEach(([k, v]) => {
        if (v !== "" && parseInt(v) > 0) tl[k] = parseInt(v);
      });
      await supabase.from("settings").upsert({ key: "type_limits", value: tl });
    });

  // ── Notifications ──
  const clearNotifications = () =>
    run(async () => {
      await supabase.from("notifications").delete().gte("created_at", "2000-01-01");
    });

  // Signup counts per email
  const signupsByEmail = {};
  data.markets.forEach((m) =>
    (m.signups || [])
      .filter((s) => s.status === "confirmed")
      .forEach((v) => {
        signupsByEmail[v.email] = (signupsByEmail[v.email] || 0) + 1;
      })
  );

  // ── Inner market card ──
  function MarketCard({ m, archived = false }) {
    const signups = m.signups || [];
    const confirmed = signups.filter((s) => s.status === "confirmed");
    const waitlist = signups
      .filter((s) => s.status === "waitlist")
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const full = confirmed.length >= m.capacity;
    const exp = expanded === m.id;

    const typeCounts = {};
    confirmed.forEach((v) => {
      typeCounts[v.vendor_type] = (typeCounts[v.vendor_type] || 0) + 1;
    });

    return (
      <Card className="overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#faf5e8]"
          onClick={() => setExpanded(exp ? null : m.id)}
        >
          <div>
            <p className="font-bold text-[#2a2010]">{formatDate(m.date)}</p>
            <p className="text-xs text-[#8a7a60]">{m.location}</p>
          </div>
          <div className="flex items-center gap-2">
          {!archived && !onWaitlist && (
  <Badge color={full ? "red" : "green"}>
    {confirmed.length}/{m.capacity} spots
  </Badge>
)}
            )}
            {!archived && waitlist.length > 0 && (
              <Badge color="amber">{waitlist.length} waiting</Badge>
            )}
            {archived && <Badge color="gray">{confirmed.length} vendors</Badge>}
            <span className="text-[#8a7a60] text-sm">{exp ? "▲" : "▼"}</span>
          </div>
        </div>

        {exp && (
          <div className="border-t border-[#e8dfc8] p-4 space-y-4 bg-[#fdfaf3]">
            {/* Type breakdown badges */}
            {Object.keys(typeCounts).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(typeCounts).map(([type, cnt]) => {
                  const cap = data.typeLimits[type];
                  const atCap = cap && cnt >= cap;
                  return (
                    <span
                      key={type}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        atCap
                          ? "bg-[#fde8e8] border-[#f0b0b0] text-[#a03030]"
                          : "bg-[#e8f0e4] border-[#b0d0a8] text-[#3a6b35]"
                      }`}
                    >
                      {type.split("–").pop().trim().split(" / ").pop().trim()}: {cnt}
                      {cap ? `/${cap}` : ""}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Confirmed vendors */}
            <div>
              <p className="text-xs font-bold text-[#8a7a60] uppercase tracking-wider mb-2">
                Confirmed ({confirmed.length})
              </p>
              {confirmed.length === 0 ? (
                <p className="text-xs text-[#8a7a60] italic">None yet</p>
              ) : (
                <div className="space-y-1">
                  {confirmed.map((v) => (
                    <div
                      key={v.id}
                      className="bg-white border border-[#e8dfc8] rounded-lg px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#2a2010]">{v.name}</p>
                          <p className="text-xs text-[#5a5040]">
                            {v.owner_name && <span>{v.owner_name} · </span>}
                            {v.phone && <span>{v.phone} · </span>}
                            <span className="text-[#8a7a60]">{v.vendor_type}</span>
                          </p>
                          <p className="text-xs text-[#8a7a60]">{v.email}</p>
                        </div>
                        {!archived && (
                          <button
                            onClick={() => removeSignup(v.id)}
                            disabled={saving}
                            className="text-xs text-[#a03030] hover:underline shrink-0 mt-0.5"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waitlist */}
            {!archived && waitlist.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#8a7a60] uppercase tracking-wider mb-2">
                  Waitlist ({waitlist.length})
                </p>
                <div className="space-y-1 mb-2">
                  {waitlist.map((v, i) => (
                    <div
                      key={v.id}
                      className="bg-[#fffbec] border border-[#f0d888] rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#c17f24] font-bold text-sm shrink-0">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-[#2a2010]">{v.name}</p>
                          <p className="text-xs text-[#8a7a60]">
                            {v.owner_name && <span>{v.owner_name} · </span>}
                            {v.phone && <span>{v.phone} · </span>}
                            {v.vendor_type}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {confirmed.length < m.capacity && (
                  <Btn
                    variant="secondary"
                    className="w-full"
                    loading={saving}
                    onClick={() => promoteWaitlist(m)}
                  >
                    Promote #1 from Waitlist
                  </Btn>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#e8dfc8]">
              {confirmed.length > 0 && (
                <Btn variant="print" onClick={() => printMarketReport(m)}>
                  🖨 Print Check-In Sheet
                </Btn>
              )}
              {!archived && (
                <Btn variant="archive" disabled={saving} onClick={() => setArchived(m.id, true)}>
                  Archive
                </Btn>
              )}
              {archived && (
                <>
                  <Btn variant="ghost" disabled={saving} onClick={() => setArchived(m.id, false)}>
                    Restore
                  </Btn>
                  <Btn variant="danger" disabled={saving} onClick={() => deleteMarket(m.id)}>
                    Delete Permanently
                  </Btn>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="grid grid-cols-4 gap-1 bg-[#e8dfc8] rounded-xl p-1">
        {["markets", "types", "limits", "notifications"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-xs font-bold rounded-lg capitalize transition-all ${
              tab === t ? "bg-[#3a6b35] text-white shadow" : "text-[#5a5040] hover:bg-[#ddd4b8]"
            }`}
          >
            {t === "types" ? "Type Caps" : t === "limits" ? "Vendor Limits" : t}
            {t === "notifications" && data.notifications.length > 0 && (
              <span className="ml-1 bg-[#c17f24] text-white text-xs rounded-full px-1.5">
                {data.notifications.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ MARKETS ══ */}
      {tab === "markets" && (
        <>
          <Card className="p-4">
            <h3 className="font-display text-lg text-[#3a6b35] mb-3">Add Market Date</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <TextInput label="Date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <TextInput label="Capacity" type="number" min="1" value={newCap} onChange={(e) => setNewCap(e.target.value)} />
            </div>
            <TextInput
              label="Location"
              type="text"
              placeholder="e.g. Southbridge Mall"
              value={newLoc}
              onChange={(e) => setNewLoc(e.target.value)}
              className="mb-3"
            />
            <Btn
              variant="primary"
              className="w-full py-2.5 mt-3"
              onClick={addMarket}
              disabled={!newDate}
              loading={saving}
            >
              + Add Market Date
            </Btn>
          </Card>

          <div className="space-y-2">
            {data.markets.length === 0 && (
              <p className="text-center text-[#8a7a60] py-6 italic text-sm">No upcoming market dates.</p>
            )}
            {data.markets.map((m) => <MarketCard key={m.id} m={m} />)}
          </div>

          {/* Archive drawer */}
          <div>
            <button
              onClick={() => setShowArchive((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#e8dfc8] rounded-xl text-sm font-bold text-[#5a5040] hover:bg-[#ddd4b8] transition-colors"
            >
              <span>📦 Archive ({data.archivedMarkets.length} past markets)</span>
              <span>{showArchive ? "▲" : "▼"}</span>
            </button>
            {showArchive && (
              <div className="mt-2 space-y-2">
                {data.archivedMarkets.length === 0 ? (
                  <p className="text-center text-[#8a7a60] py-4 italic text-sm">No archived markets yet.</p>
                ) : (
                  data.archivedMarkets.map((m) => <MarketCard key={m.id} m={m} archived />)
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ TYPE CAPS ══ */}
      {tab === "types" && (
        <div className="space-y-4">
          <InfoBox>
            <strong>Per-market type caps.</strong> Set a max number of vendors per type per market.
            Leave blank for no limit. Great for keeping things food-forward by capping Craft/Artisan slots.
          </InfoBox>
          <Card className="p-4 space-y-3">
            {VENDOR_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-3">
                <label className="flex-1 text-sm text-[#2a2010] font-medium">{type}</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  placeholder="No limit"
                  value={typeCapEdits[type] ?? ""}
                  onChange={(e) =>
                    setTypeCapEdits((prev) => ({ ...prev, [type]: e.target.value }))
                  }
                  className="w-24 bg-white border border-[#c8b98a] rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-[#3a6b35]"
                />
              </div>
            ))}
          </Card>
          <Btn variant="primary" className="w-full py-2.5" onClick={saveTypeLimits} loading={saving}>
            Save Type Caps
          </Btn>
          {Object.keys(data.typeLimits).length > 0 && (
            <div className="bg-[#e8f0e4] border border-[#b0d0a8] rounded-xl p-3">
              <p className="text-xs font-bold text-[#3a6b35] uppercase tracking-wider mb-2">Active Caps</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.typeLimits).map(([k, v]) => (
                  <span key={k} className="text-xs bg-[#3a6b35] text-white px-2 py-0.5 rounded-full">
                    {k.split("–").pop().trim().split(" / ").pop().trim()}: max {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ VENDOR LIMITS ══ */}
      {tab === "limits" && (
        <div className="space-y-4">
          <InfoBox>
            <strong>Targeted limits only.</strong> Vendors matched by email get a personal seasonal
            cap. Everyone else books freely.
          </InfoBox>
          <Card className="p-4">
            <h3 className="font-display text-lg text-[#3a6b35] mb-3">Add Restricted Vendor</h3>
            <div className="space-y-3">
              <TextInput label="Business Name" type="text" placeholder="e.g. Sunrise Bakery" value={limName} onChange={(e) => setLimName(e.target.value)} />
              <TextInput label="Email Address" type="email" placeholder="vendor@email.com" value={limEmail} onChange={(e) => setLimEmail(e.target.value)} />
              <TextInput label="Max Markets This Season" type="number" min="1" max="20" value={limCount} onChange={(e) => setLimCount(e.target.value)} />
              <Btn
                variant="primary"
                className="w-full py-2.5"
                onClick={addVendorLimit}
                disabled={!limName.trim() || !limEmail.trim()}
                loading={saving}
              >
                + Add to Restricted List
              </Btn>
            </div>
          </Card>

          <div className="space-y-2">
            {data.vendorLimits.length === 0 ? (
              <p className="text-center text-[#8a7a60] py-6 italic text-sm">
                No restrictions. All vendors book freely.
              </p>
            ) : (
              data.vendorLimits.map((v) => {
                const used = signupsByEmail[v.email] || 0;
                const atLim = used >= v.max_markets;
                return (
                  <Card key={v.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[#2a2010]">{v.name}</p>
                        <p className="text-xs text-[#8a7a60] truncate">{v.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-[#e8dfc8] rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${atLim ? "bg-[#a03030]" : "bg-[#3a6b35]"}`}
                              style={{ width: `${Math.min(100, (used / v.max_markets) * 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold whitespace-nowrap ${atLim ? "text-[#a03030]" : "text-[#3a6b35]"}`}>
                            {used}/{v.max_markets}
                          </span>
                          {atLim && <Badge color="red">At Limit</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={v.max_markets}
                          onChange={(e) => updateVendorLimit(v.id, e.target.value)}
                          className="w-14 bg-white border border-[#c8b98a] rounded-lg px-2 py-1 text-sm text-center focus:outline-none"
                        />
                        <button
                          onClick={() => removeVendorLimit(v.id)}
                          disabled={saving}
                          className="text-[#a03030] text-xl leading-none hover:text-[#7a1a1a]"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══ NOTIFICATIONS ══ */}
      {tab === "notifications" && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg text-[#3a6b35]">Notification Log</h3>
            {data.notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                disabled={saving}
                className="text-xs text-[#8a7a60] hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          {data.notifications.length === 0 ? (
            <p className="text-[#8a7a60] italic text-sm">No notifications yet.</p>
          ) : (
            <div className="space-y-2">
              {data.notifications.map((n) => (
                <div key={n.id} className="bg-[#fffbec] border border-[#f0d888] rounded-lg p-3">
                  <p className="text-sm text-[#2a2010]">{n.message}</p>
                  <p className="text-xs text-[#8a7a60] mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onLogout}
          className="text-xs text-[#8a7a60] hover:text-[#a03030] underline"
        >
          🔒 Lock admin
        </button>
      </div>
    </div>
  );
}

// ─── VENDOR PANEL ─────────────────────────────────────────────────────────────
function VendorPanel({ data, reload }) {
  const [step, setStep] = useState("login");
  const [returning, setReturning] = useState(false);
  const [formName, setFormName] = useState("");
  const [formOwnerName, setFormOwnerName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formType, setFormType] = useState("");
  const [formOther, setFormOther] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupErr, setLookupErr] = useState("");
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const run = async (fn) => {
    setSaving(true);
    try { await fn(); await reload(); } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const getLimitEntry = (email) =>
    data.vendorLimits.find((v) => v.email === email.toLowerCase()) || null;

  const getSignupCount = (email) =>
    data.markets.reduce(
      (s, m) =>
        s + ((m.signups || []).some((v) => v.email === email && v.status === "confirmed") ? 1 : 0),
      0
    );

  const isConfirmed = (mkt, email) =>
    (mkt.signups || []).some((v) => v.email === email && v.status === "confirmed");
  const isOnWaitlist = (mkt, email) =>
    (mkt.signups || []).some((v) => v.email === email && v.status === "waitlist");
  const getTypeConfirmedCount = (mkt, type) =>
    (mkt.signups || []).filter((v) => v.vendor_type === type && v.status === "confirmed").length;

  // ── Login handlers ──
  const startNew = () => {
    if (!formName.trim() || !formEmail.trim() || !formType) return;
    const email = formEmail.trim().toLowerCase();
    const resolvedType = formType === "Other" ? formOther.trim() || "Other" : formType;
    setSession({
      name: formName.trim(),
      ownerName: formOwnerName.trim(),
      phone: formPhone.trim(),
      email,
      vendorType: resolvedType,
      limitEntry: getLimitEntry(email),
    });
    setMsg(null);
    setStep("markets");
  };

  const lookupReturning = () => {
    const email = lookupEmail.trim().toLowerCase();
    if (!email) return;
    let found = null;
    for (const m of data.markets) {
      const v = (m.signups || []).find((x) => x.email === email);
      if (v) { found = v; break; }
    }
    if (!found) {
      setLookupErr("No sign-ups found for that email. Please register as a new vendor.");
      return;
    }
    setSession({
      name: found.name,
      ownerName: found.owner_name || "",
      phone: found.phone || "",
      email,
      vendorType: found.vendor_type,
      limitEntry: getLimitEntry(email),
    });
    setMsg({ type: "info", text: `Welcome back, ${found.name}! Here are your upcoming markets.` });
    setLookupErr("");
    setStep("markets");
  };

  // ── Market actions ──
  const handleSignUp = (market) =>
    run(async () => {
      if (!session) return;

      if (isConfirmed(market, session.email)) {
        setMsg({ type: "error", text: "You're already signed up for this market." });
        return;
      }
      if (isOnWaitlist(market, session.email)) {
        setMsg({ type: "error", text: "You're already on the waitlist for this market." });
        return;
      }
      const atSeasonalLimit = session.limitEntry &&
  getSignupCount(session.email) >= session.limitEntry.max_markets;

      const confirmed = (market.signups || []).filter((s) => s.status === "confirmed");
      const isFull = confirmed.length >= market.capacity;
      const typeCap = data.typeLimits[session.vendorType];
      const typeCapHit = typeCap && getTypeConfirmedCount(market, session.vendorType) >= typeCap;
      const goWaitlist = isFull || typeCapHit || atSeasonalLimit;

      const { error } = await supabase.from("signups").insert({
        market_id: market.id,
        name: session.name,
        owner_name: session.ownerName || "",
        phone: session.phone || "",
        email: session.email,
        vendor_type: session.vendorType,
        status: goWaitlist ? "waitlist" : "confirmed",
      });

      if (error) {
        setMsg({ type: "error", text: "Something went wrong. Please try again." });
        return;
      }

      if (typeCapHit && !isFull) {
        setMsg({ type: "waitlist", text: `We've reached our limit for ${session.vendorType} vendors at this market. You're on the waitlist!` });
      } else if (goWaitlist) {
        setMsg({ type: "waitlist", text: "This market is full — you're on the waitlist. We'll reach out if a spot opens up!" });
      } else {
        setMsg({ type: "success", text: `You're confirmed for the ${formatDate(market.date)} market! See you there. 🌱` });
      }
    });

  const handleCancel = (market) =>
    run(async () => {
      if (!session) return;
      const wasConfirmed = isConfirmed(market, session.email);
      const wasWaitlist = isOnWaitlist(market, session.email);

      await supabase
        .from("signups")
        .delete()
        .eq("market_id", market.id)
        .eq("email", session.email);

      if (wasConfirmed) {
        const { data: freshSignups } = await supabase
          .from("signups")
          .select("*")
          .eq("market_id", market.id);

        const freshConfirmed = (freshSignups || []).filter((s) => s.status === "confirmed");
        const freshWaitlist = (freshSignups || [])
          .filter((s) => s.status === "waitlist")
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        if (freshConfirmed.length < market.capacity && freshWaitlist.length > 0) {
          const eligible = freshWaitlist.find((v) => {
            const cap = data.typeLimits[v.vendor_type];
            if (!cap) return true;
            return freshConfirmed.filter((c) => c.vendor_type === v.vendor_type).length < cap;
          });
          if (eligible) {
            await supabase.from("signups").update({ status: "confirmed" }).eq("id", eligible.id);
            await logNotification(
              `🎉 ${eligible.name} promoted to confirmed for ${formatDate(market.date)}.`
            );
          }
        }
      }

      setMsg({
        type: "info",
        text: wasWaitlist
          ? "You've been removed from the waitlist."
          : "Your spot has been cancelled.",
      });
    });

  const signupCount = session ? getSignupCount(session.email) : 0;
  const limitEntry = session?.limitEntry || null;
  const atLimit = limitEntry ? signupCount >= limitEntry.max_markets : false;

  // ── Login screen ──
  if (step === "login") {
    return (
      <div className="space-y-4">
        <div className="flex gap-1 bg-[#e8dfc8] rounded-xl p-1">
          <button
            onClick={() => { setReturning(false); setLookupErr(""); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              !returning ? "bg-[#3a6b35] text-white shadow" : "text-[#5a5040] hover:bg-[#ddd4b8]"
            }`}
          >
            New Vendor
          </button>
          <button
            onClick={() => setReturning(true)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              returning ? "bg-[#3a6b35] text-white shadow" : "text-[#5a5040] hover:bg-[#ddd4b8]"
            }`}
          >
            Returning Vendor
          </button>
        </div>

        {!returning ? (
          <Card className="p-6">
            <h3 className="font-display text-xl text-[#3a6b35] mb-1">New Vendor Registration</h3>
            <p className="text-sm text-[#8a7a60] mb-5">
              Fill out your info to sign up for off-season markets.
            </p>
            <div className="space-y-4">
              <TextInput label="Business / Farm Name" type="text" placeholder="Your business name" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <TextInput label="Owner / Contact Name" type="text" placeholder="Your name" value={formOwnerName} onChange={(e) => setFormOwnerName(e.target.value)} />
              <TextInput label="Phone Number" type="tel" placeholder="(555) 555-5555" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              <TextInput label="Email Address" type="email" placeholder="your@email.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              <div>
                <FieldLabel>Vendor Type — I am applying to sell the following:</FieldLabel>
                <div className="space-y-1.5 mt-1">
                  {VENDOR_TYPES.map((type) => (
                    <label
                      key={type}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        formType === type
                          ? "bg-[#e8f0e4] border-[#3a6b35]"
                          : "bg-[#fdfaf3] border-[#e8dfc8] hover:border-[#b0c8a8]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="vtype"
                        value={type}
                        checked={formType === type}
                        onChange={() => setFormType(type)}
                        className="accent-[#3a6b35]"
                      />
                      <span className="text-sm text-[#2a2010]">{type}</span>
                    </label>
                  ))}
                </div>
                {formType === "Other" && (
                  <TextInput
                    type="text"
                    placeholder="Please describe what you sell..."
                    value={formOther}
                    onChange={(e) => setFormOther(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
              <Btn
                variant="primary"
                className="w-full py-3"
                onClick={startNew}
                disabled={!formName.trim() || !formEmail.trim() || !formType}
              >
                Continue to Markets →
              </Btn>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <h3 className="font-display text-xl text-[#3a6b35] mb-1">Welcome Back!</h3>
            <p className="text-sm text-[#8a7a60] mb-5">
              Enter your email to view and manage your market sign-ups.
            </p>
            <div className="space-y-3">
              <TextInput
                label="Your Email Address"
                type="email"
                placeholder="your@email.com"
                value={lookupEmail}
                onChange={(e) => { setLookupEmail(e.target.value); setLookupErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && lookupReturning()}
              />
              {lookupErr && <p className="text-xs text-[#a03030] font-medium">{lookupErr}</p>}
              <Btn
                variant="primary"
                className="w-full py-3"
                onClick={lookupReturning}
                disabled={!lookupEmail.trim()}
              >
                Look Up My Sign-Ups →
              </Btn>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Markets screen ──
  return (
    <div className="space-y-4">
      {/* Session banner */}
      <div className="bg-[#3a6b35] text-white rounded-xl p-4 shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">Signed in as</p>
            <p className="font-display text-xl leading-tight">{session.name}</p>
            {session.ownerName && (
              <p className="text-xs opacity-80 mt-0.5">{session.ownerName}</p>
            )}
            <p className="text-xs opacity-60">{session.email}</p>
            <span className="inline-block mt-1.5 text-xs bg-white/20 rounded-full px-2.5 py-0.5 font-semibold">
              {session.vendorType}
            </span>
          </div>
          
        </div>
        
        <button
          onClick={() => {
            setSession(null); setStep("login");
            setFormName(""); setFormOwnerName(""); setFormPhone("");
            setFormEmail(""); setFormType(""); setLookupEmail(""); setMsg(null);
          }}
          className="mt-2 text-xs opacity-60 hover:opacity-100 underline"
        >
          ← Back / Switch vendor
        </button>
      </div>

      <MsgBanner msg={msg} />

      {data.markets.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[#8a7a60] italic">No upcoming markets scheduled yet. Check back soon!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.markets.map((m) => {
            const confirmed = (m.signups || []).filter((s) => s.status === "confirmed");
            const waitlist = (m.signups || [])
              .filter((s) => s.status === "waitlist")
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            const full = confirmed.length >= m.capacity;
            const confirmedMe = isConfirmed(m, session.email);
            const onWaitlist = isOnWaitlist(m, session.email);
            const waitlistPos = waitlist.findIndex((v) => v.email === session.email) + 1;
            const typeCap = data.typeLimits[session.vendorType];
            const typeCapHit = typeCap && getTypeConfirmedCount(m, session.vendorType) >= typeCap && !confirmedMe;
          const atSeasonalLimit = session.limitEntry && getSignupCount(session.email) >= session.limitEntry.max_markets;
            const spotsLeft = m.capacity - confirmed.length;

            return (
              <Card
                key={m.id}
                className={`p-4 ${
                  confirmedMe ? "border-[#a0d090] bg-[#e8f5e0]" :
                  onWaitlist  ? "border-[#f0d888] bg-[#fffbec]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-[#2a2010]">{formatDate(m.date)}</p>
                    <p className="text-xs text-[#8a7a60]">{m.location}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge color={full ? "red" : "green"}>
                        {confirmed.length}/{m.capacity} spots
                      </Badge>
                      {!full && !confirmedMe && spotsLeft <= 3 && (
                        <Badge color="amber">Only {spotsLeft} left!</Badge>
                      )}
                      {typeCapHit && !onWaitlist && (
                        <Badge color="amber">
                          {session.vendorType.split("–").pop().trim().split(" / ").pop().trim()} full
                        </Badge>
                      )}
                      {confirmedMe && <Badge color="green">✓ Confirmed</Badge>}
                      {onWaitlist && <Badge color="amber">Waitlist Joined</Badge>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {!confirmedMe && !onWaitlist && (
                      <Btn
                        variant={full || typeCapHit ? "secondary" : "primary"}
                        onClick={() => handleSignUp(m)}
                        
                        loading={saving}
                      >
                        {full || typeCapHit || atSeasonalLimit ? "Join Waitlist" : "Sign Up"}
                      </Btn>
                    )}
                    {(confirmedMe || onWaitlist) && (
                      <Btn variant="danger" onClick={() => handleCancel(m)} loading={saving}>
                        Cancel
                      </Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("vendor");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [data, setData] = useState({
    markets: [], archivedMarkets: [], vendorLimits: [], typeLimits: {}, notifications: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);

  const reload = useCallback(async () => {
    try {
      setData(await fetchData());
    } catch (e) {
      setLoadErr("Could not connect to the database. Check your Supabase configuration.");
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(175deg, #f5edd8 0%, #ede0c0 50%, #e0d0a8 100%)" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Sans+3:wght@400;600;700&display=swap');
        .font-display { font-family: 'Playfair Display', Georgia, serif; }
        * { box-sizing: border-box; }
        input[type=date]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-7">
          <img
            src={LOGO_URL}
            alt="Mason City Farmers Market"
            className="h-24 mx-auto mb-3 drop-shadow"
            style={{ objectFit: "contain" }}
          />
          <p className="text-[#6a5a38] text-sm font-semibold tracking-wide uppercase">
            Off-Season Market Registration
          </p>
        </div>

        <div className="flex gap-1 bg-[#d8c898]/60 rounded-xl p-1 mb-6">
          {[["vendor", "Vendor Sign-Up"], ["admin", "Admin Panel"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                mode === val
                  ? "bg-[#3a6b35] text-white shadow-md"
                  : "text-[#5a5040] hover:bg-[#c8b878]/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <Spinner />
        ) : loadErr ? (
          <div className="bg-[#fde8e8] border border-[#f0b0b0] rounded-xl p-4 text-sm text-[#7a1a1a]">
            {loadErr}
          </div>
        ) : mode === "vendor" ? (
          <VendorPanel data={data} reload={reload} />
        ) : adminUnlocked ? (
          <AdminPanel data={data} reload={reload} onLogout={() => setAdminUnlocked(false)} />
        ) : (
          <AdminLogin onSuccess={() => setAdminUnlocked(true)} />
        )}

        <p className="text-center text-[#8a7a58] text-xs mt-8">
          Mason City Farmers Market · PO Box 16, Mason City, IA 50402
        </p>
      </div>
    </div>
  );
}
