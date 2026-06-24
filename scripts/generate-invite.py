#!/usr/bin/env python3
"""Generate a house concert invitation page from the template.

Usage:
  python3 generate-invite.py \\
    --host-name "Sarah" \\
    --date "Friday 15 August" \\
    --door-time "7:00pm" \\
    --start-time "7:30pm" \\
    --suburb "North Adelaide" \\
    --guest-count "30" \\
    --ticket-link "https://events.humanitix.com/..." \\
    --slug "sarah"

This creates house-concerts/invites/<slug>/index.html in the current repo.
Commit and push to make it live at dylancrowemusic.github.io/house-concerts/invites/<slug>
"""

import argparse
import os
import sys

TEMPLATE_PATH = "house-concerts/invite-template.html"
OUTPUT_DIR = "house-concerts/invites"


def main():
    parser = argparse.ArgumentParser(description="Generate a house concert invitation page")
    parser.add_argument("--host-name", required=True, help="Host's first name (e.g. 'Sarah')")
    parser.add_argument("--date", required=True, help="Event date (e.g. 'Friday 15 August')")
    parser.add_argument("--door-time", required=True, help="Doors open time (e.g. '7:00pm')")
    parser.add_argument("--start-time", required=True, help="Music start time (e.g. '7:30pm')")
    parser.add_argument("--suburb", required=True, help="Suburb or area (e.g. 'North Adelaide')")
    parser.add_argument("--guest-count", required=True, help="Max guests (e.g. '30')")
    parser.add_argument("--ticket-link", required=True, help="Humanitix or ticketing URL")
    parser.add_argument("--slug", required=True, help="URL slug (e.g. 'sarah')")
    args = parser.parse_args()

    # Read template
    if not os.path.exists(TEMPLATE_PATH):
        print(f"ERROR: Template not found at {TEMPLATE_PATH}", file=sys.stderr)
        print("Run this script from the repo root (dylancrowemusic.github.io/)", file=sys.stderr)
        sys.exit(1)

    with open(TEMPLATE_PATH) as f:
        template = f.read()

    # Replace placeholders
    replacements = {
        "[Host Name]": args.host_name,
        "[Date]": args.date,
        "[Door Time]": args.door_time,
        "[Start Time]": args.start_time,
        "[Suburb]": args.suburb,
        "[Guest Count]": args.guest_count,
        "[Ticket Link]": args.ticket_link,
    }

    for placeholder, value in replacements.items():
        template = template.replace(placeholder, value)

    # Check for any unreplaced placeholders
    remaining = [p for p in replacements if p in template]
    if remaining:
        print(f"WARNING: Some placeholders still present: {remaining}", file=sys.stderr)

    # Write output
    out_dir = os.path.join(OUTPUT_DIR, args.slug)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "index.html")

    with open(out_path, "w") as f:
        f.write(template)

    url = f"https://dylancrowemusic.github.io/house-concerts/invites/{args.slug}"
    print(f"✅ Invitation generated: {out_path}")
    print(f"🔗 Live URL: {url}")
    print(f"\nNext steps:")
    print(f"  git add {out_path}")
    print(f"  git commit -m \"Add house concert invitation for {args.host_name}\"")
    print(f"  git push origin main")
    print(f"\nHost can share this link: {url}")


if __name__ == "__main__":
    main()