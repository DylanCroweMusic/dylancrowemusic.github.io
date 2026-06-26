#!/usr/bin/env python3
"""
update_dashboard.py v2.0 — Musician Business OS Dashboard CLI

Manages the v2.0 data model for Dylan Crowe's touring dashboard:
  - 14 top-level entities (meta, config, todos, tour_stops, busking_spots,
    venues, house_concerts, financials, ground_ops, marketing, income_history,
    expense_history, booking_summary, migration_notes)
  - Compiles data.json -> data.js for static GitHub Pages hosting
  - CLI subcommands: show, sync, compile-js, log-income, log-expense,
    add-busking-spot, add-venue, advance-venue, add-house-concert, tour-stop
  - Auto-recalculates financials and per-stop rollups
  - Auto-increments gig counts when venues reach 'booked' stage
  - Generates slug-based IDs for new entities

Location: /tmp/dylancrowemusic.github.io/scripts/update_dashboard.py
Data files: /tmp/dylancrowemusic.github.io/dashboard/data.json
            /tmp/dylancrowemusic.github.io/dashboard/data.js

Python 3.11, stdlib only.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = "/tmp/dylancrowemusic.github.io"
DASHBOARD_DIR = os.path.join(REPO_ROOT, "dashboard")
JSON_PATH = os.path.join(DASHBOARD_DIR, "data.json")
JS_PATH = os.path.join(DASHBOARD_DIR, "data.js")
DESIGN_SEED_PATH = "/tmp/dylancrowemusic-dashboard-design/data-model.json"

SCHEMA_VERSION = "2.0.0"

# Pipeline stage orders (sourced from config at runtime, but used as fallbacks)
VENUE_STAGES = [
    "not_contacted", "called", "emailed",
    "follow_up_1", "follow_up_2", "booked", "declined", "played",
]
HOUSE_CONCERT_STAGES = [
    "posted", "interested", "confirmed", "completed", "cancelled",
]
EXPENSE_CATEGORIES = [
    "fuel", "accommodation", "food", "gear", "maverick", "marketing", "misc",
]
INCOME_TYPES = ["busking", "venue_gig", "house_concert", "merch"]
EXPENSE_SOURCES = ["tour", "local"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso():
    """UTC now in ISO-8601 with Z suffix."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def slugify(text):
    """Convert text to a lowercase slug: non-alphanumeric -> '-', collapse dupes."""
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "unnamed"


def city_slug(city):
    """Slugify a city name, preserving slash-separated multi-city stops."""
    # Geelong/Torquay -> geelong-torquay
    return slugify(city.replace("/", " "))


def next_seq_id(prefix, existing_ids):
    """Generate next sequence id like inc-007 given existing ids."""
    max_n = 0
    for eid in existing_ids:
        if isinstance(eid, str) and eid.startswith(prefix + "-"):
            try:
                max_n = max(max_n, int(eid.split("-")[-1]))
            except ValueError:
                pass
    return f"{prefix}-{max_n + 1:03d}"


def find_tour_stop(data, identifier):
    """Find a tour stop by integer id or by case-insensitive name."""
    stops = data.get("tour_stops", [])
    # Try int id
    try:
        stop_id = int(identifier)
        for s in stops:
            if s.get("id") == stop_id:
                return s
    except (ValueError, TypeError):
        pass
    # Try name match
    ident_low = identifier.lower().strip()
    for s in stops:
        if s.get("name", "").lower() == ident_low:
            return s
        if ident_low in s.get("name", "").lower():
            return s
    return None


def get_venue_stages(data):
    return data.get("config", {}).get("venue_pipeline_stages", VENUE_STAGES)


def get_house_concert_stages(data):
    return data.get("config", {}).get(
        "house_concert_pipeline_stages", HOUSE_CONCERT_STAGES
    )


# ---------------------------------------------------------------------------
# Load / Save / Compile
# ---------------------------------------------------------------------------
def load_data():
    """Load data.json. If missing/invalid, initialize from design seed."""
    if not os.path.exists(JSON_PATH):
        return init_seed_data()
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"WARNING: data.json unreadable ({e}); reinitializing from seed.",
              file=sys.stderr)
        return init_seed_data()
    return data


def init_seed_data():
    """Write seed data (from design doc) to data.json and return it."""
    data = get_seed_data()
    os.makedirs(DASHBOARD_DIR, exist_ok=True)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Initialized {JSON_PATH} from v{SCHEMA_VERSION} seed data.")
    return data


def get_seed_data():
    """Return the v2.0 seed data. Uses the design data-model.json if available,
    otherwise builds a minimal in-memory seed."""
    if os.path.exists(DESIGN_SEED_PATH):
        with open(DESIGN_SEED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = _minimal_seed()
    data.setdefault("meta", {})["last_updated"] = now_iso()
    return data


def _minimal_seed():
    """Minimal fallback seed if the design doc isn't present."""
    return {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "system_name": "Dylan Crowe Musician Business OS",
            "last_updated": now_iso(),
            "tour_name": "One Guitar. One Dog. Every Town in Australia.",
            "tour_start": "2026-08-15",
            "tour_end": "2026-12-08",
            "tour_weeks": 16,
            "artist": {
                "name": "Dylan Crowe",
                "role": "Solo musician / touring artist",
                "companion": "Maverick (Australian Shepherd)",
                "email": "dylancrowemusic@gmail.com",
                "instagram": "@dylan_crowe_music",
                "website": "https://dylancrowemusic.github.io",
            },
        },
        "config": {
            "brand": {
                "cosmic_blue": "#1A1A3E", "cyan": "#00B4D8",
                "magenta": "#D946EF", "amber": "#D97706",
                "green": "#166534", "gold": "#F59E0B",
                "off_white": "#F5F0E8",
            },
            "venue_pipeline_stages": VENUE_STAGES,
            "house_concert_pipeline_stages": HOUSE_CONCERT_STAGES,
            "expense_categories": EXPENSE_CATEGORIES,
            "expense_sources": EXPENSE_SOURCES,
        },
        "todos": [],
        "tour_stops": [],
        "busking_spots": [],
        "venues": [],
        "house_concerts": [],
        "financials": {"tour": {}},
        "ground_ops": {},
        "marketing": [],
        "income_history": [],
        "expense_history": [],
        "booking_summary": {},
        "migration_notes": {},
    }


def save_data(data, compile_js=True):
    """Save data.json, optionally compile data.js, return True on success."""
    os.makedirs(DASHBOARD_DIR, exist_ok=True)
    # Update timestamp
    data.setdefault("meta", {})["last_updated"] = now_iso()
    # Recalculate everything before saving
    recalculate(data)
    # Write JSON
    try:
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except OSError as e:
        print(f"ERROR: could not write data.json: {e}", file=sys.stderr)
        return False
    if compile_js:
        compile_data_js(data)
    return True


def compile_data_js(data=None):
    """Compile data.json -> data.js wrapped in window.DASHBOARD_DATA = {...}."""
    if data is None:
        if not os.path.exists(JSON_PATH):
            print(f"ERROR: {JSON_PATH} does not exist; nothing to compile.",
                  file=sys.stderr)
            return False
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    os.makedirs(DASHBOARD_DIR, exist_ok=True)
    header = (
        "// Auto-generated by update_dashboard.py v2.0. Do not edit directly.\n"
        f"// Last updated: {data.get('meta', {}).get('last_updated', now_iso())}\n"
    )
    try:
        with open(JS_PATH, "w", encoding="utf-8") as f:
            f.write(header)
            f.write("window.DASHBOARD_DATA = ")
            json.dump(data, f, indent=2)
            f.write(";\n")
    except OSError as e:
        print(f"ERROR: could not write data.js: {e}", file=sys.stderr)
        return False
    print(f"Compiled data.js -> {JS_PATH}")
    return True


# ---------------------------------------------------------------------------
# Recalculation engine
# ---------------------------------------------------------------------------
def recalculate(data):
    """Recompute all derived/rollup fields:
    - busking_spots[].total_earnings_logged, total_sessions, avg
    - tour_stops[].actuals (from income/expense history + child entities)
    - tour_stops[].financials (per-stop projected vs actual)
    - financials.tour.* (tour-level rollups)
    - ground_ops.* (Adelaide local float)
    - booking_summary.pipeline_counts
    """
    income = data.get("income_history", [])
    expenses = data.get("expense_history", [])
    stops = data.get("tour_stops", [])

    # --- Busking spot rollups ---
    for spot in data.get("busking_spots", []):
        hist = spot.get("earnings_history", [])
        total = round(sum(h.get("earnings", 0.0) for h in hist), 2)
        sessions = len(hist)
        spot["total_earnings_logged"] = total
        spot["total_sessions"] = sessions
        spot["avg_earnings_per_session"] = (
            round(total / sessions, 2) if sessions else 0.0
        )
        # status lifecycle: spotted -> played -> regular
        if sessions == 0:
            if spot.get("status") not in ("spotted", "played", "regular", "confirmed"):
                spot["status"] = "spotted"
        elif spot.get("status") in (None, "spotted", "confirmed", "played", "regular"):
            avg = spot["avg_earnings_per_session"]
            if sessions >= 3 and avg >= 250:
                spot["status"] = "regular"
            else:
                spot["status"] = "played"

    # --- Per-stop actuals + financials ---
    income_by_stop = {}
    expense_by_stop = {}
    for inc in income:
        sid = inc.get("tour_stop_id")
        if sid is None:
            continue
        income_by_stop.setdefault(sid, 0.0)
        income_by_stop[sid] += inc.get("amount", 0.0)
    for exp in expenses:
        sid = exp.get("tour_stop_id")
        if sid is None:
            continue
        expense_by_stop.setdefault(sid, 0.0)
        expense_by_stop[sid] += exp.get("amount", 0.0)

    for stop in stops:
        sid = stop.get("id")
        a = stop.setdefault("actuals", {})
        bk = a.setdefault("busking", {})
        vg = a.setdefault("venue_gig", {})
        hc = a.setdefault("house_concert", {})

        # Ensure fields exist
        bk.setdefault("sessions_completed", 0)
        bk.setdefault("spots_scouted", 0)
        bk.setdefault("spots_confirmed", 0)
        bk.setdefault("earnings_actual", 0.0)
        vg.setdefault("gigs_booked", 0)
        vg.setdefault("venues_contacted", 0)
        vg.setdefault("gigs_played", 0)
        vg.setdefault("earnings_actual", 0.0)
        hc.setdefault("shows_confirmed", 0)
        hc.setdefault("hosts_contacted", 0)
        hc.setdefault("shows_completed", 0)
        hc.setdefault("earnings_actual", 0.0)

        # Recompute earnings_actual from income_history for this stop
        stop_income = [i for i in income if i.get("tour_stop_id") == sid]
        stop_expense_total = round(expense_by_stop.get(sid, 0.0), 2)

        bk_earn = round(sum(
            i.get("amount", 0.0) for i in stop_income
            if i.get("type") == "busking"
        ), 2)
        vg_earn = round(sum(
            i.get("amount", 0.0) for i in stop_income
            if i.get("type") == "venue_gig"
        ), 2)
        hc_earn = round(sum(
            i.get("amount", 0.0) for i in stop_income
            if i.get("type") == "house_concert"
        ), 2)

        bk["earnings_actual"] = bk_earn
        vg["earnings_actual"] = vg_earn
        hc["earnings_actual"] = hc_earn

        # sessions_completed = count of busking income entries (tour source)
        bk["sessions_completed"] = sum(
            1 for i in stop_income
            if i.get("type") == "busking" and i.get("source", "tour") == "tour"
        )

        # gigs_played = count of venue_gig income entries
        vg["gigs_played"] = sum(
            1 for i in stop_income if i.get("type") == "venue_gig"
        )

        # gigs_booked = count of venues at booked/played stage for this stop
        stop_venues = [
            v for v in data.get("venues", [])
            if v.get("tour_stop_id") == sid
        ]
        vg["gigs_booked"] = sum(
            1 for v in stop_venues
            if v.get("pipeline_stage") in ("booked", "played")
        )
        vg["venues_contacted"] = sum(
            1 for v in stop_venues
            if v.get("pipeline_stage") != "not_contacted"
        )

        # spots scouted/confirmed from busking_spots
        stop_spots = [
            s for s in data.get("busking_spots", [])
            if s.get("tour_stop_id") == sid
        ]
        bk["spots_scouted"] = len(stop_spots)
        bk["spots_confirmed"] = sum(
            1 for s in stop_spots
            if s.get("status") in ("confirmed", "played", "regular")
        )

        # house concert actuals
        stop_hcs = [
            h for h in data.get("house_concerts", [])
            if h.get("tour_stop_id") == sid
        ]
        hc["hosts_contacted"] = sum(
            1 for h in stop_hcs
            if h.get("pipeline_stage") in ("interested", "confirmed", "completed")
        )
        hc["shows_confirmed"] = sum(
            1 for h in stop_hcs
            if h.get("pipeline_stage") in ("confirmed", "completed")
        )
        hc["shows_completed"] = sum(
            1 for h in stop_hcs
            if h.get("pipeline_stage") == "completed"
        )

        # Per-stop financials
        actual_income = round(bk_earn + vg_earn + hc_earn, 2)
        # include merch for this stop in actual_income
        merch_earn = round(sum(
            i.get("amount", 0.0) for i in stop_income
            if i.get("type") == "merch"
        ), 2)
        actual_income = round(actual_income + merch_earn, 2)

        # projected = sum of earnings targets
        t = stop.get("targets", {})
        projected = round(
            t.get("busking", {}).get("earnings_target", 0.0)
            + t.get("venue_gig", {}).get("earnings_target", 0.0)
            + t.get("house_concert", {}).get("earnings_target", 0.0)
            , 2
        )
        fin = stop.setdefault("financials", {})
        fin["projected_income"] = projected
        fin["actual_income"] = actual_income
        fin["actual_expenses"] = stop_expense_total
        fin["net"] = round(actual_income - stop_expense_total, 2)

        # Keep child id references in sync
        stop["busking_spot_ids"] = [s.get("id") for s in stop_spots if s.get("id")]
        stop["venue_ids"] = [v.get("id") for v in stop_venues if v.get("id")]
        stop["house_concert_ids"] = [
            h.get("id") for h in stop_hcs if h.get("id")
        ]

    # --- Tour-level financials ---
    tour_fin = data.setdefault("financials", {}).setdefault("tour", {})
    cfg_targets = data.get("config", {}).get("financial_targets", {})
    tour_fin["target"] = cfg_targets.get("net_savings_goal", 37000.0)
    tour_fin["gross_target"] = cfg_targets.get("gross_income_target", 52200.0)
    tour_fin["expense_budget"] = cfg_targets.get("total_expenses_budget", 15200.0)

    # current_earnings = sum of all tour-source income
    tour_earnings = round(sum(
        i.get("amount", 0.0) for i in income
        if i.get("source", "tour") == "tour"
    ), 2)
    tour_fin["current_earnings"] = tour_earnings

    # expenses_by_category (tour source only)
    cats = data.get("config", {}).get("expense_categories", EXPENSE_CATEGORIES)
    by_cat = {c: 0.0 for c in cats}
    for exp in expenses:
        if exp.get("source", "tour") != "tour":
            continue
        cat = exp.get("category", "misc")
        if cat not in by_cat:
            by_cat[cat] = 0.0
        by_cat[cat] = round(by_cat[cat] + exp.get("amount", 0.0), 2)
    tour_fin["expenses_by_category"] = by_cat
    total_exp = round(sum(by_cat.values()), 2)
    tour_fin["total_expenses"] = total_exp
    net = round(tour_earnings - total_exp, 2)
    tour_fin["net_earnings"] = net
    target = tour_fin.get("target", 37000.0)
    tour_fin["progress_to_target_pct"] = (
        round(net / target * 100, 2) if target else 0.0
    )

    # income_by_stream (tour source)
    streams = {t: 0.0 for t in INCOME_TYPES}
    for inc in income:
        if inc.get("source", "tour") != "tour":
            continue
        t = inc.get("type", "misc")
        if t not in streams:
            streams[t] = 0.0
        streams[t] = round(streams[t] + inc.get("amount", 0.0), 2)
    tour_fin["income_by_stream"] = streams

    # --- Ground ops (Adelaide local float) ---
    go = data.setdefault("ground_ops", {})
    go.setdefault("base_city", "Adelaide")
    go.setdefault("description",
                  "Adelaide local busking float — separate from tour savings.")
    go.setdefault("transaction_history", [])
    local_income = round(sum(
        i.get("amount", 0.0) for i in income
        if i.get("source") == "local"
    ), 2)
    local_expenses = round(sum(
        e.get("amount", 0.0) for e in expenses
        if e.get("source") == "local"
    ), 2)
    go["local_busking_earnings"] = local_income
    go["expenses"] = local_expenses
    go["cash_float"] = go.get("cash_float", 0.0)
    go["operational_bank"] = round(
        go.get("cash_float", 0.0) + local_income - local_expenses, 2
    )

    # --- Booking summary pipeline counts ---
    bs = data.setdefault("booking_summary", {})
    stages = get_venue_stages(data)
    counts = {s: 0 for s in stages}
    for v in data.get("venues", []):
        st = v.get("pipeline_stage", "not_contacted")
        if st not in counts:
            counts[st] = 0
        counts[st] += 1
    bs["pipeline_counts"] = counts
    bs["venues_mapped"] = bs.get("venues_mapped", 85)
    bs["venues_in_database"] = len(data.get("venues", []))
    in_pipeline = sum(
        c for s, c in counts.items() if s not in ("played", "declined")
    )
    bs["status"] = (
        f"{bs['venues_mapped']}+ venues mapped across call sheets. "
        f"{bs['venues_in_database']} active in pipeline."
    )


# ---------------------------------------------------------------------------
# CLI: show
# ---------------------------------------------------------------------------
def cmd_show(args):
    """Display current dashboard state."""
    data = load_data()
    recalculate(data)
    meta = data.get("meta", {})
    artist = meta.get("artist", {})
    print("=" * 72)
    print(f"  {meta.get('system_name', 'Musician Business OS')}")
    print(f"  Schema v{meta.get('schema_version', '?')}  |  "
          f"Updated: {meta.get('last_updated', '?')}")
    print(f"  Tour: {meta.get('tour_name', '?')}")
    print(f"  Artist: {artist.get('name', '?')}  |  {artist.get('companion', '')}")
    print("=" * 72)

    # Financials
    tf = data.get("financials", {}).get("tour", {})
    print("\n  TOUR FINANCIALS")
    print(f"    Earnings:   ${tf.get('current_earnings', 0):,.2f}")
    print(f"    Expenses:   ${tf.get('total_expenses', 0):,.2f}")
    print(f"    Net:        ${tf.get('net_earnings', 0):,.2f}")
    print(f"    Target:     ${tf.get('target', 0):,.2f}")
    print(f"    Progress:   {tf.get('progress_to_target_pct', 0):.2f}%")
    ibs = tf.get("income_by_stream", {})
    if ibs:
        print("    Income by stream:")
        for k, v in ibs.items():
            print(f"      {k:14s} ${v:,.2f}")

    # Ground ops
    go = data.get("ground_ops", {})
    print("\n  GROUND OPS (Adelaide local float)")
    print(f"    Local busking earnings: ${go.get('local_busking_earnings', 0):,.2f}")
    print(f"    Local expenses:        ${go.get('expenses', 0):,.2f}")
    print(f"    Cash float:            ${go.get('cash_float', 0):,.2f}")
    print(f"    Operational bank:      ${go.get('operational_bank', 0):,.2f}")

    # Booking summary
    bs = data.get("booking_summary", {})
    pc = bs.get("pipeline_counts", {})
    print("\n  BOOKING SUMMARY")
    print(f"    {bs.get('status', '')}")
    if pc:
        print("    Pipeline:")
        for stage, count in pc.items():
            if count:
                print(f"      {stage:16s} {count}")

    # Tour stops (compact)
    print("\n  TOUR STOPS")
    print(f"    {'#':>2}  {'City':<18} {'St':<4} {'Status':<10} "
          f"{'Bk$':>7} {'Vg$':>7} {'Hc$':>7} {'Net':>8}")
    print(f"    {'--':>2}  {'-'*18} {'-'*4} {'-'*10} {'-'*7} {'-'*7} {'-'*7} {'-'*8}")
    for s in data.get("tour_stops", []):
        a = s.get("actuals", {})
        bk = a.get("busking", {}).get("earnings_actual", 0.0)
        vg = a.get("venue_gig", {}).get("earnings_actual", 0.0)
        hc = a.get("house_concert", {}).get("earnings_actual", 0.0)
        net = s.get("financials", {}).get("net", 0.0)
        print(f"    {s.get('id', '?'):>2}  {s.get('name', '?'):<18} "
              f"{s.get('state', ''):<4} {s.get('status', ''):<10} "
              f"${bk:>6,.0f} ${vg:>6,.0f} ${hc:>6,.0f} ${net:>7,.0f}")

    # Entities summary
    print("\n  ENTITY COUNTS")
    for key in ("busking_spots", "venues", "house_concerts", "marketing",
                "income_history", "expense_history", "todos"):
        print(f"    {key:18s} {len(data.get(key, []))}")

    # Recent transactions
    inc = data.get("income_history", [])
    exp = data.get("expense_history", [])
    print("\n  RECENT INCOME (last 5)")
    for i in inc[-5:]:
        print(f"    {i.get('id', '?'):8s} {i.get('date', '?')[:10]} "
              f"${i.get('amount', 0):>7,.2f}  {i.get('type', ''):12s} "
              f"{i.get('location', '')}")
    print("  RECENT EXPENSES (last 5)")
    for e in exp[-5:]:
        print(f"    {e.get('id', '?'):8s} {e.get('date', '?')[:10]} "
              f"${e.get('amount', 0):>7,.2f}  {e.get('category', ''):12s} "
              f"{e.get('description', '')}")
    print()


# ---------------------------------------------------------------------------
# CLI: compile-js
# ---------------------------------------------------------------------------
def cmd_compile_js(args):
    """Compile data.json -> data.js."""
    ok = compile_data_js()
    sys.exit(0 if ok else 1)


# ---------------------------------------------------------------------------
# CLI: sync
# ---------------------------------------------------------------------------
def cmd_sync(args):
    """Compile data.js and optionally git commit + push."""
    data = load_data()
    recalculate(data)
    # save + compile
    if not save_data(data, compile_js=True):
        print("ERROR: save failed.", file=sys.stderr)
        sys.exit(1)
    print("Sync: data.json and data.js updated.")

    if args.commit or args.push:
        run_git(args)


def run_git(args):
    """Git add, commit, and optionally push."""
    msg = args.message or f"dashboard sync {now_iso()}"
    cmds = [
        ["git", "-C", REPO_ROOT, "add",
         "dashboard/data.json", "dashboard/data.js"],
        ["git", "-C", REPO_ROOT, "commit", "-m", msg],
    ]
    if args.push:
        cmds.append(["git", "-C", REPO_ROOT, "push", "origin", "main"])
    for cmd in cmds:
        print(f"$ {' '.join(cmd)}")
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.stdout.strip():
            print(r.stdout.strip())
        if r.returncode != 0:
            # 'nothing to commit' is fine
            if "nothing to commit" in r.stdout or "nothing to commit" in r.stderr:
                print("(nothing to commit)")
                return
            print(f"git error: {r.stderr.strip()}", file=sys.stderr)
            sys.exit(1)


# ---------------------------------------------------------------------------
# CLI: log-income
# ---------------------------------------------------------------------------
def cmd_log_income(args):
    """Add an income entry. Adelaide local-busking -> ground_ops routing."""
    data = load_data()

    # Determine source: explicit arg, else infer from type+location
    source = args.source
    if source is None:
        # Adelaide local busking -> local
        if (args.type == "busking"
                and "adelaide" in (args.location or "").lower()):
            source = "local"
        else:
            source = "tour"

    # Determine tour_stop_id
    tour_stop_id = args.tour_stop_id
    if tour_stop_id is None:
        # Try to find stop by location name
        stop = find_tour_stop(data, args.location or "")
        if stop:
            tour_stop_id = stop.get("id")
        elif source == "local":
            # Adelaide ground ops
            adelaide = find_tour_stop(data, "Adelaide")
            tour_stop_id = adelaide.get("id") if adelaide else None

    existing_ids = [i.get("id") for i in data.get("income_history", [])]
    inc_id = args.id or next_seq_id("inc", existing_ids)

    entry = {
        "id": inc_id,
        "type": args.type,
        "amount": round(float(args.amount), 2),
        "location": args.location or "",
        "tour_stop_id": tour_stop_id,
        "description": args.description or "",
        "date": args.date or now_iso(),
        "source": source,
    }
    # Link to venue or busking spot if provided
    if args.venue_id:
        entry["venue_id"] = args.venue_id
    if args.busking_spot_id:
        entry["busking_spot_id"] = args.busking_spot_id

    data.setdefault("income_history", []).append(entry)
    save_data(data)
    print(f"Logged income {inc_id}: ${entry['amount']:.2f} ({args.type}, "
          f"{source}) -> {args.location or 'n/a'}")


# ---------------------------------------------------------------------------
# CLI: log-expense
# ---------------------------------------------------------------------------
def cmd_log_expense(args):
    """Add an expense entry."""
    data = load_data()

    source = args.source or "tour"
    tour_stop_id = args.tour_stop_id
    if tour_stop_id is None and args.location:
        stop = find_tour_stop(data, args.location)
        if stop:
            tour_stop_id = stop.get("id")

    existing_ids = [e.get("id") for e in data.get("expense_history", [])]
    exp_id = args.id or next_seq_id("exp", existing_ids)

    entry = {
        "id": exp_id,
        "category": args.category,
        "amount": round(float(args.amount), 2),
        "location": args.location or "",
        "tour_stop_id": tour_stop_id,
        "description": args.description or "",
        "source": source,
        "date": args.date or now_iso(),
    }
    data.setdefault("expense_history", []).append(entry)
    save_data(data)
    print(f"Logged expense {exp_id}: ${entry['amount']:.2f} ({args.category}, "
          f"{source}) -> {args.description or 'n/a'}")


# ---------------------------------------------------------------------------
# CLI: add-busking-spot
# ---------------------------------------------------------------------------
def cmd_add_busking_spot(args):
    """Add a new busking spot to a tour stop."""
    data = load_data()
    stop = find_tour_stop(data, args.tour_stop)
    if not stop:
        print(f"ERROR: tour stop '{args.tour_stop}' not found.", file=sys.stderr)
        sys.exit(1)

    city = stop.get("name", args.tour_stop)
    spot_slug = slugify(args.name)
    spot_id = args.id or f"bsk-{city_slug(city)}-{spot_slug}"

    # Avoid duplicate IDs
    existing = {s.get("id") for s in data.get("busking_spots", [])}
    if spot_id in existing and not args.id:
        # append a numeric suffix
        n = 2
        while f"{spot_id}-{n}" in existing:
            n += 1
        spot_id = f"{spot_id}-{n}"

    spot = {
        "id": spot_id,
        "tour_stop_id": stop.get("id"),
        "name": args.name,
        "city": city,
        "address": args.address or "",
        "coordinates": {},
        "foot_traffic_rating": int(args.foot_traffic) if args.foot_traffic else 0,
        "permit_required": args.permit_required,
        "permit_obtained": False,
        "permit_authority": args.permit_authority or "",
        "permit_cost": 0.0,
        "best_time_of_day": args.best_time or "",
        "best_time_notes": args.best_time_notes or "",
        "acoustics_notes": args.acoustics_notes or "",
        "earnings_history": [],
        "total_earnings_logged": 0.0,
        "total_sessions": 0,
        "avg_earnings_per_session": 0.0,
        "status": "spotted",
        "discovered_date": args.discovered_date or datetime.now(
            timezone.utc).strftime("%Y-%m-%d"),
        "tags": args.tags.split(",") if args.tags else [],
    }
    data.setdefault("busking_spots", []).append(spot)
    # Link to tour stop
    spot_ids = stop.setdefault("busking_spot_ids", [])
    if spot_id not in spot_ids:
        spot_ids.append(spot_id)
    save_data(data)
    print(f"Added busking spot {spot_id} -> {city} (stop {stop.get('id')})")


# ---------------------------------------------------------------------------
# CLI: add-venue
# ---------------------------------------------------------------------------
def cmd_add_venue(args):
    """Add a venue to a tour stop with a pipeline stage."""
    data = load_data()
    stop = find_tour_stop(data, args.tour_stop)
    if not stop:
        print(f"ERROR: tour stop '{args.tour_stop}' not found.", file=sys.stderr)
        sys.exit(1)

    city = stop.get("name", args.tour_stop)
    state = stop.get("state", "")
    venue_slug = slugify(args.name)
    venue_id = args.id or f"ven-{city_slug(city)}-{venue_slug}"

    existing = {v.get("id") for v in data.get("venues", [])}
    if venue_id in existing and not args.id:
        n = 2
        while f"{venue_id}-{n}" in existing:
            n += 1
        venue_id = f"{venue_id}-{n}"

    stages = get_venue_stages(data)
    stage = args.stage or "not_contacted"
    if stage not in stages:
        print(f"ERROR: stage '{stage}' not in {stages}", file=sys.stderr)
        sys.exit(1)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    venue = {
        "id": venue_id,
        "tour_stop_id": stop.get("id"),
        "name": args.name,
        "city": city,
        "state": state,
        "phone": args.phone or "",
        "email": args.email or "",
        "contact_name": args.contact_name or "",
        "venue_type": args.venue_type or "",
        "address": args.address or "",
        "website": args.website or "",
        "pipeline_stage": stage,
        "stage_history": [
            {"stage": stage, "date": today,
             "notes": args.notes or f"Added to pipeline at {stage} stage."}
        ],
        "gig": None,
        "marketing": {
            "epk_sent": False, "epk_sent_date": None,
            "reels_captured": False, "reels_count": 0,
            "venue_posted_content": False, "venue_tagged_dylan": False,
            "social_posts_made": 0, "content_notes": "",
        },
        "status": "booked" if stage == "booked" else (
            "played" if stage == "played" else (
                "declined" if stage == "declined" else "in_pipeline"
            )
        ),
        "priority": args.priority or "medium",
        "first_contacted_date": today if stage != "not_contacted" else None,
        "tags": args.tags.split(",") if args.tags else [],
    }
    data.setdefault("venues", []).append(venue)
    venue_ids = stop.setdefault("venue_ids", [])
    if venue_id not in venue_ids:
        venue_ids.append(venue_id)

    # Auto-increment gig count if booked
    if stage == "booked":
        stop.setdefault("actuals", {}).setdefault("venue_gig", {})
        # gigs_booked will be recalculated, but bump target too if requested
        print(f"  Venue entered at 'booked' stage — gig count will roll up.")

    save_data(data)
    print(f"Added venue {venue_id} -> {city} (stop {stop.get('id')}) "
          f"at stage '{stage}'")


# ---------------------------------------------------------------------------
# CLI: advance-venue
# ---------------------------------------------------------------------------
def cmd_advance_venue(args):
    """Move a venue to the next pipeline stage (or a specified stage)."""
    data = load_data()
    venues = data.get("venues", [])
    venue = None
    for v in venues:
        if v.get("id") == args.venue_id:
            venue = v
            break
    if not venue:
        # try substring match
        for v in venues:
            if args.venue_id.lower() in v.get("id", "").lower() or \
               args.venue_id.lower() in v.get("name", "").lower():
                venue = v
                break
    if not venue:
        print(f"ERROR: venue '{args.venue_id}' not found.", file=sys.stderr)
        sys.exit(1)

    stages = get_venue_stages(data)
    current = venue.get("pipeline_stage", "not_contacted")
    if args.to_stage:
        new_stage = args.to_stage
        if new_stage not in stages:
            print(f"ERROR: stage '{new_stage}' not in {stages}", file=sys.stderr)
            sys.exit(1)
    else:
        try:
            idx = stages.index(current)
        except ValueError:
            idx = -1
        # skip declined as a "next" step in linear progression
        next_idx = idx + 1
        if next_idx >= len(stages):
            print(f"Venue {venue.get('id')} is already at terminal stage "
                  f"'{current}'. Use --to-stage to set explicitly.")
            sys.exit(1)
        new_stage = stages[next_idx]

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    history_entry = {
        "stage": new_stage, "date": today,
        "notes": args.notes or f"Advanced from {current} to {new_stage}.",
    }
    venue.setdefault("stage_history", []).append(history_entry)
    venue["pipeline_stage"] = new_stage

    # Update status
    if new_stage == "booked":
        venue["status"] = "booked"
    elif new_stage == "played":
        venue["status"] = "played"
    elif new_stage == "declined":
        venue["status"] = "declined"
    else:
        venue["status"] = "in_pipeline"

    if new_stage != "not_contacted" and not venue.get("first_contacted_date"):
        venue["first_contacted_date"] = today

    # Auto-increment gig count when reaching 'booked':
    # The recalculate step will update actuals.venue_gig.gigs_booked.
    save_data(data)
    print(f"Advanced {venue.get('id')}: {current} -> {new_stage}")
    if new_stage == "booked":
        stop = find_tour_stop(data, venue.get("tour_stop_id"))
        print(f"  Gig count auto-incremented for "
              f"{stop.get('name') if stop else venue.get('tour_stop_id')}.")


# ---------------------------------------------------------------------------
# CLI: add-house-concert
# ---------------------------------------------------------------------------
def cmd_add_house_concert(args):
    """Add a house concert host entry."""
    data = load_data()
    stop = find_tour_stop(data, args.tour_stop)
    if not stop:
        print(f"ERROR: tour stop '{args.tour_stop}' not found.", file=sys.stderr)
        sys.exit(1)

    city = stop.get("name", args.tour_stop)
    state = stop.get("state", "")
    host_slug = slugify(args.host_name)
    hc_id = args.id or f"hc-{city_slug(city)}-{host_slug}"

    existing = {h.get("id") for h in data.get("house_concerts", [])}
    if hc_id in existing and not args.id:
        n = 2
        while f"{hc_id}-{n}" in existing:
            n += 1
        hc_id = f"{hc_id}-{n}"

    stages = get_house_concert_stages(data)
    stage = args.stage or "posted"
    if stage not in stages:
        print(f"ERROR: stage '{stage}' not in {stages}", file=sys.stderr)
        sys.exit(1)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    hc = {
        "id": hc_id,
        "tour_stop_id": stop.get("id"),
        "host_name": args.host_name,
        "city": city,
        "state": state,
        "host_email": args.host_email or "",
        "host_phone": args.host_phone or "",
        "source": args.source or "Facebook group",
        "source_detail": args.source_detail or "",
        "pipeline_stage": stage,
        "stage_history": [
            {"stage": stage, "date": today,
             "notes": args.notes or f"Added at {stage} stage."}
        ],
        "event": None,
        "outreach": {
            "facebook_groups_posted": [],
            "post_dates": [],
            "follow_up_messages_sent": 0,
            "personal_messages_sent": 0,
            "referral_source": args.source_detail or "",
        },
        "marketing": {
            "promo_kit_sent": False, "promo_kit_sent_date": None,
            "host_posted_socials": False, "reels_captured": False,
            "content_notes": "",
        },
        "status": "confirmed" if stage == "confirmed" else (
            "completed" if stage == "completed" else (
                "cancelled" if stage == "cancelled" else "in_pipeline"
            )
        ),
        "priority": args.priority or "medium",
        "first_contact_date": today if stage != "posted" else None,
        "tags": args.tags.split(",") if args.tags else [],
    }
    data.setdefault("house_concerts", []).append(hc)
    hc_ids = stop.setdefault("house_concert_ids", [])
    if hc_id not in hc_ids:
        hc_ids.append(hc_id)
    save_data(data)
    print(f"Added house concert {hc_id} -> {city} (stop {stop.get('id')}) "
          f"at stage '{stage}'")


# ---------------------------------------------------------------------------
# CLI: tour-stop
# ---------------------------------------------------------------------------
def cmd_tour_stop(args):
    """Update stop targets/status."""
    data = load_data()
    stop = find_tour_stop(data, args.tour_stop)
    if not stop:
        print(f"ERROR: tour stop '{args.tour_stop}' not found.", file=sys.stderr)
        sys.exit(1)

    changed = []
    if args.status:
        valid = data.get("config", {}).get("tour_stop_statuses",
                                           ["Planned", "Current",
                                            "Completed", "Skipped"])
        if args.status not in valid:
            print(f"WARNING: status '{args.status}' not in {valid}",
                  file=sys.stderr)
        stop["status"] = args.status
        changed.append(f"status={args.status}")
    if args.transit_status:
        stop["transit_status"] = args.transit_status
        changed.append(f"transit_status={args.transit_status}")
    if args.notes is not None:
        stop["notes"] = args.notes
        changed.append("notes")
    if args.week_type:
        stop["week_type"] = args.week_type
        changed.append(f"week_type={args.week_type}")

    # Target updates
    t = stop.setdefault("targets", {})
    if args.busking_sessions is not None:
        t.setdefault("busking", {})["sessions_target"] = int(args.busking_sessions)
        changed.append("busking.sessions_target")
    if args.busking_earnings is not None:
        t.setdefault("busking", {})["earnings_target"] = float(args.busking_earnings)
        changed.append("busking.earnings_target")
    if args.venue_gigs is not None:
        t.setdefault("venue_gig", {})["gigs_target"] = int(args.venue_gigs)
        changed.append("venue_gig.gigs_target")
    if args.venue_earnings is not None:
        t.setdefault("venue_gig", {})["earnings_target"] = float(args.venue_earnings)
        changed.append("venue_gig.earnings_target")
    if args.house_concert_shows is not None:
        t.setdefault("house_concert", {})["shows_target"] = int(args.house_concert_shows)
        changed.append("house_concert.shows_target")
    if args.house_concert_earnings is not None:
        t.setdefault("house_concert", {})["earnings_target"] = float(args.house_concert_earnings)
        changed.append("house_concert.earnings_target")

    save_data(data)
    if changed:
        print(f"Updated stop {stop.get('id')} ({stop.get('name')}): "
              f"{', '.join(changed)}")
    else:
        print(f"No changes for stop {stop.get('id')} ({stop.get('name')}).")


# ---------------------------------------------------------------------------
# Argparse
# ---------------------------------------------------------------------------
def build_parser():
    p = argparse.ArgumentParser(
        prog="update_dashboard.py",
        description="Musician Business OS v2.0 dashboard CLI.",
    )
    sub = p.add_subparsers(dest="command")

    # show
    sp_show = sub.add_parser("show", help="Display current dashboard state.")
    sp_show.set_defaults(func=cmd_show)

    # compile-js
    sp_js = sub.add_parser("compile-js", help="Compile data.json -> data.js.")
    sp_js.set_defaults(func=cmd_compile_js)

    # sync
    sp_sync = sub.add_parser("sync", help="Compile data.js and optionally git push.")
    sp_sync.add_argument("--commit", action="store_true", help="Git commit changes.")
    sp_sync.add_argument("--push", action="store_true", help="Git push to origin/main.")
    sp_sync.add_argument("-m", "--message", help="Git commit message.")
    sp_sync.set_defaults(func=cmd_sync)

    # log-income
    sp_inc = sub.add_parser("log-income", help="Add an income entry.")
    sp_inc.add_argument("--type", required=True, choices=INCOME_TYPES,
                        help="Income stream type.")
    sp_inc.add_argument("--amount", required=True, type=float, help="Dollar amount.")
    sp_inc.add_argument("--location", help="City/location string.")
    sp_inc.add_argument("--date", help="ISO date (default: now).")
    sp_inc.add_argument("--description", help="Description.")
    sp_inc.add_argument("--source", choices=EXPENSE_SOURCES,
                        help="tour or local (default: inferred).")
    sp_inc.add_argument("--tour-stop-id", type=int, help="Tour stop integer id.")
    sp_inc.add_argument("--venue-id", help="Linked venue id.")
    sp_inc.add_argument("--busking-spot-id", help="Linked busking spot id.")
    sp_inc.add_argument("--id", help="Explicit income id (default: auto).")
    sp_inc.set_defaults(func=cmd_log_income)

    # log-expense
    sp_exp = sub.add_parser("log-expense", help="Add an expense entry.")
    sp_exp.add_argument("--category", required=True, choices=EXPENSE_CATEGORIES,
                        help="Expense category.")
    sp_exp.add_argument("--amount", required=True, type=float, help="Dollar amount.")
    sp_exp.add_argument("--source", choices=EXPENSE_SOURCES, help="tour or local.")
    sp_exp.add_argument("--location", help="City/location.")
    sp_exp.add_argument("--date", help="ISO date.")
    sp_exp.add_argument("--description", help="Description.")
    sp_exp.add_argument("--tour-stop-id", type=int, help="Tour stop id.")
    sp_exp.add_argument("--id", help="Explicit expense id.")
    sp_exp.set_defaults(func=cmd_log_expense)

    # add-busking-spot
    sp_bsk = sub.add_parser("add-busking-spot", help="Add a busking spot.")
    sp_bsk.add_argument("--tour-stop", required=True,
                        help="Stop id or name (e.g. 1 or 'Perth').")
    sp_bsk.add_argument("--name", required=True, help="Spot name.")
    sp_bsk.add_argument("--address", help="Street address.")
    sp_bsk.add_argument("--foot-traffic", type=int, choices=range(1, 6),
                        help="Foot traffic rating 1-5.")
    sp_bsk.add_argument("--permit-required", action="store_true",
                        help="Permit required to busk here.")
    sp_bsk.add_argument("--permit-authority", help="Council/authority name.")
    sp_bsk.add_argument("--best-time", help="Best time of day.")
    sp_bsk.add_argument("--best-time-notes", help="Best time notes.")
    sp_bsk.add_argument("--acoustics-notes", help="Acoustics notes.")
    sp_bsk.add_argument("--discovered-date", help="Discovery date.")
    sp_bsk.add_argument("--tags", help="Comma-separated tags.")
    sp_bsk.add_argument("--id", help="Explicit spot id.")
    sp_bsk.set_defaults(func=cmd_add_busking_spot)

    # add-venue
    sp_ven = sub.add_parser("add-venue", help="Add a venue to the pipeline.")
    sp_ven.add_argument("--tour-stop", required=True, help="Stop id or name.")
    sp_ven.add_argument("--name", required=True, help="Venue name.")
    sp_ven.add_argument("--venue-type", help="Venue type.")
    sp_ven.add_argument("--phone", help="Phone number.")
    sp_ven.add_argument("--email", help="Booker email.")
    sp_ven.add_argument("--contact-name", help="Booker name.")
    sp_ven.add_argument("--address", help="Address.")
    sp_ven.add_argument("--website", help="Website URL.")
    sp_ven.add_argument("--stage", help="Initial pipeline stage "
                        "(default: not_contacted).")
    sp_ven.add_argument("--priority", choices=["high", "medium", "low"],
                        help="Priority (default: medium).")
    sp_ven.add_argument("--notes", help="Stage history notes.")
    sp_ven.add_argument("--tags", help="Comma-separated tags.")
    sp_ven.add_argument("--id", help="Explicit venue id.")
    sp_ven.set_defaults(func=cmd_add_venue)

    # advance-venue
    sp_adv = sub.add_parser("advance-venue", help="Advance a venue's pipeline stage.")
    sp_adv.add_argument("venue_id", help="Venue id or name substring.")
    sp_adv.add_argument("--to-stage", help="Explicit target stage.")
    sp_adv.add_argument("--notes", help="Stage history notes.")
    sp_adv.set_defaults(func=cmd_advance_venue)

    # add-house-concert
    sp_hc = sub.add_parser("add-house-concert", help="Add a house concert host.")
    sp_hc.add_argument("--tour-stop", required=True, help="Stop id or name.")
    sp_hc.add_argument("--host-name", required=True, help="Host name.")
    sp_hc.add_argument("--host-email", help="Host email.")
    sp_hc.add_argument("--host-phone", help="Host phone.")
    sp_hc.add_argument("--source", help="Lead source (e.g. 'Facebook group').")
    sp_hc.add_argument("--source-detail", help="Specific referrer/group.")
    sp_hc.add_argument("--stage", help="Initial stage (default: posted).")
    sp_hc.add_argument("--priority", choices=["high", "medium", "low"],
                       help="Priority.")
    sp_hc.add_argument("--notes", help="Stage history notes.")
    sp_hc.add_argument("--tags", help="Comma-separated tags.")
    sp_hc.add_argument("--id", help="Explicit house concert id.")
    sp_hc.set_defaults(func=cmd_add_house_concert)

    # tour-stop
    sp_ts = sub.add_parser("tour-stop", help="Update stop targets/status.")
    sp_ts.add_argument("tour_stop", help="Stop id or name.")
    sp_ts.add_argument("--status", help="New status.")
    sp_ts.add_argument("--transit-status", help="New transit status.")
    sp_ts.add_argument("--week-type", help="city/regional/transit.")
    sp_ts.add_argument("--notes", help="Stop notes.")
    sp_ts.add_argument("--busking-sessions", type=int,
                       help="Busking sessions target.")
    sp_ts.add_argument("--busking-earnings", type=float,
                       help="Busking earnings target.")
    sp_ts.add_argument("--venue-gigs", type=int, help="Venue gigs target.")
    sp_ts.add_argument("--venue-earnings", type=float,
                       help="Venue earnings target.")
    sp_ts.add_argument("--house-concert-shows", type=int,
                       help="House concert shows target.")
    sp_ts.add_argument("--house-concert-earnings", type=float,
                       help="House concert earnings target.")
    sp_ts.set_defaults(func=cmd_tour_stop)

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        sys.exit(0)
    args.func(args)


if __name__ == "__main__":
    main()
