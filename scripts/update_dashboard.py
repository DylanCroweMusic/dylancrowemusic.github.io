#!/usr/bin/env python3
"""
update_dashboard.py

Programmatically manage the JSON/JS database for the Musician OS Dashboard.
Handles:
  - Reading/writing 'data.json' and 'data.js'
  - High-quality seed data initialization with the new database format
  - CLI operations to add/complete todos, update financials, tour stops, booking stats, and log income.

Location: /tmp/dylancrowemusic.github.io/scripts/update_dashboard.py
Data files: /tmp/dylancrowemusic.github.io/dashboard/data.json
            /tmp/dylancrowemusic.github.io/dashboard/data.js
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

# Absolute Paths
REPO_ROOT = "/tmp/dylancrowemusic.github.io"
DASHBOARD_DIR = os.path.join(REPO_ROOT, "dashboard")
JSON_PATH = os.path.join(DASHBOARD_DIR, "data.json")
JS_PATH = os.path.join(DASHBOARD_DIR, "data.js")

def get_seed_data():
    """Return the initial seed data matching the new specification."""
    return {
        "todos": [
            {"id": 1, "task": "Service oil", "completed": False},
            {"id": 2, "task": "Fuel to parks", "completed": False},
            {"id": 3, "task": "Organize busking cash float", "completed": False},
            {"id": 4, "task": "Verify council permits", "completed": False}
        ],
        "financials": {
            "target": 37000.0,
            "current_earnings": 0.0,
            "fuel_expenses": 350.0,
            "gear_expenses": 120.0,
            "net_earnings": -470.0
        },
        "ground_ops": {
            "local_busking_earnings": 0.0,
            "expenses": 0.0,
            "cash_float": 150.0,
            "operational_bank": 150.0
        },
        "tour_stops": [
            {"id": 1, "name": "Perth", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 2, "name": "Fremantle", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 3, "name": "Bunbury", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 4, "name": "Margaret River", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 5, "name": "Albany", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 6, "name": "Esperance", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 7, "name": "Kalgoorlie", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 8, "name": "Adelaide", "status": "Current", "transit_status": "Arrived"},
            {"id": 9, "name": "Melbourne", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 10, "name": "Sydney", "status": "Planned", "transit_status": "Scheduled"},
            {"id": 11, "name": "Sunshine Coast", "status": "Target", "transit_status": "Dreaming"}
        ],
        "booking": {
            "venues_mapped": 85,
            "status": "85+ venues mapped"
        },
        "income_history": [],
        "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }

def load_data():
    """Load JSON data from JSON_PATH, fallback to seed data if not found or invalid."""
    if not os.path.exists(JSON_PATH):
        # Ensure directory exists
        os.makedirs(DASHBOARD_DIR, exist_ok=True)
        data = get_seed_data()
        save_data(data)
        return data

    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"Warning: Failed to load existing metrics due to error: {e}. Reinitializing with seed data.", file=sys.stderr)
        data = get_seed_data()
        save_data(data)
        return data

def save_data(data):
    """Save data dict as both data.json and data.js."""
    os.makedirs(DASHBOARD_DIR, exist_ok=True)
    
    # Update timestamp
    data["last_updated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Recalculate net earnings
    financials = data.get("financials", {})
    earnings = financials.get("current_earnings", 0.0)
    fuel = financials.get("fuel_expenses", 0.0)
    gear = financials.get("gear_expenses", 0.0)
    financials["net_earnings"] = round(earnings - fuel - gear, 2)
    
    # Recalculate operational bank
    ground_ops = data.setdefault("ground_ops", {
        "local_busking_earnings": 0.0,
        "expenses": 0.0,
        "cash_float": 150.0,
        "operational_bank": 150.0
    })
    local_busking = ground_ops.setdefault("local_busking_earnings", 0.0)
    expenses = ground_ops.setdefault("expenses", 0.0)
    cash_float = ground_ops.setdefault("cash_float", 150.0)
    ground_ops["operational_bank"] = round(cash_float + local_busking - expenses, 2)
    
    # Save JSON file
    try:
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"SUCCESS: Wrote JSON to {JSON_PATH}")
    except OSError as e:
        print(f"ERROR: Could not save data.json: {e}", file=sys.stderr)
        return False
        
    # Save JS file (for static pages running without local JSON fetches due to CORS/simplicity)
    try:
        with open(JS_PATH, "w", encoding="utf-8") as f:
            f.write(f"// Auto-generated. Do not edit directly.\nconst DASHBOARD_DATA = {json.dumps(data, indent=2)};\n")
        print(f"SUCCESS: Wrote JS to {JS_PATH}")
    except OSError as e:
        print(f"ERROR: Could not save data.js: {e}", file=sys.stderr)
        return False
        
    return True

def cmd_init():
    """Force reinitialize with seed data."""
    data = get_seed_data()
    if save_data(data):
        print("Initialized dashboard data store with seed values.")
    else:
        sys.exit(1)

def cmd_todo_add(task):
    """Add a new todo task."""
    data = load_data()
    todos = data.get("todos", [])
    new_id = max([t.get("id", 0) for t in todos], default=0) + 1
    todos.append({
        "id": new_id,
        "task": task,
        "completed": False
    })
    data["todos"] = todos
    save_data(data)
    print(f"Added todo #{new_id}: '{task}'")

def cmd_todo_complete(identifier):
    """Mark a todo task complete by ID or by substring match."""
    data = load_data()
    todos = data.get("todos", [])
    found = False
    
    # Try finding by ID
    try:
        todo_id = int(identifier)
        for t in todos:
            if t.get("id") == todo_id:
                t["completed"] = True
                print(f"Completed todo #{todo_id}: '{t.get('task')}'")
                found = True
                break
    except ValueError:
        # Finding by substring matching
        for t in todos:
            if identifier.lower() in t.get("task", "").lower():
                t["completed"] = True
                print(f"Completed todo #{t.get('id')}: '{t.get('task')}'")
                found = True
                break
                
    if not found:
        print(f"ERROR: No incomplete todo matched '{identifier}'", file=sys.stderr)
        sys.exit(1)
        
    data["todos"] = todos
    save_data(data)

def cmd_financials(target, earnings, fuel, gear):
    """Update financials."""
    data = load_data()
    financials = data.setdefault("financials", {})
    
    if target is not None:
        financials["target"] = float(target)
    if earnings is not None:
        financials["current_earnings"] = float(earnings)
    if fuel is not None:
        financials["fuel_expenses"] = float(fuel)
    if gear is not None:
        financials["gear_expenses"] = float(gear)
        
    save_data(data)
    print("Financials updated successfully:")
    print(json.dumps(data["financials"], indent=2))

def cmd_tour_stop(name, status, transit_status):
    """Update or add a tour stop."""
    data = load_data()
    stops = data.setdefault("tour_stops", [])
    
    # Find existing
    matched_stop = None
    for s in stops:
        if s.get("name", "").strip().lower() == name.strip().lower():
            matched_stop = s
            break
            
    if matched_stop:
        if status is not None:
            matched_stop["status"] = status
        if transit_status is not None:
            matched_stop["transit_status"] = transit_status
        print(f"Updated tour stop '{matched_stop['name']}'")
    else:
        # Add new stop
        new_id = max([s.get("id", 0) for s in stops], default=0) + 1
        new_stop = {
            "id": new_id,
            "name": name,
            "status": status or "Planned",
            "transit_status": transit_status or "Scheduled"
        }
        stops.append(new_stop)
        print(f"Added new tour stop #{new_id}: '{name}'")
        
    data["tour_stops"] = stops
    save_data(data)

def cmd_booking(count, status):
    """Update licensing/booking info."""
    data = load_data()
    booking = data.setdefault("booking", {})
    
    if count is not None:
        booking["venues_mapped"] = int(count)
    if status is not None:
        booking["status"] = status
        
    save_data(data)
    print("Booking info updated:")
    print(json.dumps(data["booking"], indent=2))

def cmd_log_income(income_type, amount, location, date):
    """Record income logs and update database accordingly."""
    data = load_data()
    history = data.setdefault("income_history", [])
    
    if not date:
        date = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
    entry = {
        "type": income_type,
        "amount": float(amount),
        "location": location or "",
        "date": date
    }
    history.append(entry)
    
    # Business logic for splitting local vs tour income:
    # If type is 'gig' or 'tour-busking' on the route -> financials 'current_earnings'
    # If type is 'local-busking' (Adelaide ground-ops) -> tracks to operational bank (ground_ops local_busking_earnings)
    # If type is 'busking' generally: check if location is Adelaide to classify as local, else tour-busking.
    # Note: Merch also logs to tour financials.
    
    is_local = False
    if income_type == "local-busking":
        is_local = True
    elif income_type == "tour-busking":
        is_local = False
    elif income_type == "busking":
        # check if location is Adelaide (case-insensitive)
        if location and location.strip().lower() == "adelaide":
            is_local = True
        else:
            is_local = False
            
    if is_local:
        ground_ops = data.setdefault("ground_ops", {
            "local_busking_earnings": 0.0,
            "expenses": 0.0,
            "cash_float": 150.0,
            "operational_bank": 150.0
        })
        ground_ops["local_busking_earnings"] = round(ground_ops.get("local_busking_earnings", 0.0) + amount, 2)
        print(f"SUCCESS: Logged local busking income of ${amount:,.2f} under Ground Operations.")
    else:
        financials = data.setdefault("financials", {
            "target": 37000.0,
            "current_earnings": 0.0,
            "fuel_expenses": 350.0,
            "gear_expenses": 120.0,
            "net_earnings": -470.0
        })
        financials["current_earnings"] = round(financials.get("current_earnings", 0.0) + amount, 2)
        print(f"SUCCESS: Logged tour income ({income_type}) of ${amount:,.2f} under Financials.")
        
    save_data(data)

def cmd_show():
    """Print the contents of the database nicely."""
    data = load_data()
    print("==================================================")
    print("                MUSICIAN OS DASHBOARD             ")
    print("==================================================")
    print(f"Last Updated: {data.get('last_updated')}\n")
    
    print("--- TODOS ---")
    for t in data.get("todos", []):
        status = "[X]" if t.get("completed") else "[ ]"
        print(f"  {status} #{t.get('id')}: {t.get('task')}")
        
    print("\n--- FINANCIALS ---")
    fin = data.get("financials", {})
    print(f"  Target:           ${fin.get('target', 0.0):,.2f}")
    print(f"  Current Earnings: ${fin.get('current_earnings', 0.0):,.2f}")
    print(f"  Fuel Expenses:    ${fin.get('fuel_expenses', 0.0):,.2f}")
    print(f"  Gear Expenses:    ${fin.get('gear_expenses', 0.0):,.2f}")
    print(f"  Net Earnings:     ${fin.get('net_earnings', 0.0):,.2f}")
    
    print("\n--- GROUND OPERATIONS (Adelaide Survival Plan) ---")
    g = data.get("ground_ops", {})
    print(f"  Cash Float:             ${g.get('cash_float', 0.0):,.2f}")
    print(f"  Local Busking Earnings: ${g.get('local_busking_earnings', 0.0):,.2f}")
    print(f"  Expenses:               ${g.get('expenses', 0.0):,.2f}")
    print(f"  Operational Bank:       ${g.get('operational_bank', 0.0):,.2f}")
    
    print("\n--- TOUR STOPS ---")
    for s in data.get("tour_stops", []):
        print(f"  - {s.get('name').ljust(15)} | Status: {s.get('status').ljust(10)} | Transit: {s.get('transit_status')}")
        
    print("\n--- BOOKING STATUS ---")
    b = data.get("booking", {})
    print(f"  Venues Mapped: {b.get('venues_mapped')}")
    print(f"  Status Text:   {b.get('status')}")
    
    history = data.get("income_history", [])
    if history:
        print("\n--- RECENT INCOME LOGS ---")
        for item in history[-5:]:  # show up to last 5
            print(f"  - {item.get('date')} | {item.get('type').ljust(12)} | ${item.get('amount'):,.2f} | {item.get('location')}")
    print("==================================================")

def main():
    parser = argparse.ArgumentParser(description="Manage the Musician OS Dashboard database (JSON/JS)")
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")
    
    # Init
    subparsers.add_parser("init", help="Initialize or reset database with seed data")
    
    # Show
    subparsers.add_parser("show", help="Display current dashboard metrics in a human-friendly format")
    
    # Todo Add
    p_todo_add = subparsers.add_parser("todo-add", help="Add a todo item")
    p_todo_add.add_argument("task", type=str, help="Text of the task")
    
    # Todo Complete
    p_todo_comp = subparsers.add_parser("todo-complete", help="Complete a todo item")
    p_todo_comp.add_argument("identifier", type=str, help="ID (e.g. '1') or substring match of the task text")
    
    # Financials
    p_fin = subparsers.add_parser("financials", help="Update financials")
    p_fin.add_argument("--target", type=float, help="Target earnings amount in dollars")
    p_fin.add_argument("--earnings", type=float, help="Current earnings in dollars")
    p_fin.add_argument("--fuel", type=float, help="Fuel expenses in dollars")
    p_fin.add_argument("--gear", type=float, help="Gear expenses in dollars")
    
    # Tour stops
    p_tour = subparsers.add_parser("tour-stop", help="Add or update a tour stop")
    p_tour.add_argument("name", type=str, help="Name of the stop (e.g. 'Kalgoorlie')")
    p_tour.add_argument("--status", type=str, choices=["Current", "Planned", "Target", "Completed"], help="Booking/touring status")
    p_tour.add_argument("--transit", type=str, help="Transit/logistics status (e.g. 'Arrived', 'Scheduled', 'Dreaming')")
    
    # Booking
    p_book = subparsers.add_parser("booking", help="Update booking status")
    p_book.add_argument("--count", type=int, help="Number of venues mapped")
    p_book.add_argument("--status", type=str, help="Overall status text (e.g. '85+ venues mapped')")
    
    # Log Income
    p_log = subparsers.add_parser("log-income", help="Log earnings/income updates")
    p_log.add_argument("--type", type=str, choices=["busking", "gig", "merch", "tour-busking", "local-busking"], required=True, help="Type of income tracker")
    p_log.add_argument("--amount", type=float, required=True, help="Amount in dollars")
    p_log.add_argument("--location", type=str, help="City/town/location where earned")
    p_log.add_argument("--date", type=str, help="Date of event (defaults to current time)")
    
    args = parser.parse_args()
    
    if args.command == "init":
        cmd_init()
    elif args.command == "show":
        cmd_show()
    elif args.command == "todo-add":
        cmd_todo_add(args.task)
    elif args.command == "todo-complete":
        cmd_todo_complete(args.identifier)
    elif args.command == "financials":
        if all(x is None for x in [args.target, args.earnings, args.fuel, args.gear]):
            p_fin.error("At least one financial metric flag (--target, --earnings, --fuel, --gear) must be provided.")
        cmd_financials(args.target, args.earnings, args.fuel, args.gear)
    elif args.command == "tour-stop":
        cmd_tour_stop(args.name, args.status, args.transit)
    elif args.command == "booking":
        if args.count is None and args.status is None:
            p_book.error("At least one option (--count or --status) must be provided.")
        cmd_booking(args.count, args.status)
    elif args.command == "log-income":
        cmd_log_income(args.type, args.amount, args.location, args.date)
    else:
        # Default behavior: if no command is specified, load_data to initialize, and show current state.
        print("No command provided. Showing current state:")
        cmd_show()

if __name__ == "__main__":
    main()
