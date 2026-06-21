#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------

missing=()

if ! command -v rofi &>/dev/null; then
  missing+=("rofi")
fi
if ! command -v jq &>/dev/null; then
  missing+=("jq")
fi
if ! command -v message-mirror &>/dev/null; then
  missing+=("message-mirror")
fi

# Detect display server and clipboard tools
if [[ -n "${WAYLAND_DISPLAY:-}" ]]; then
  CLIPBOARD_BACKEND="wayland"
  if ! command -v wl-paste &>/dev/null || ! command -v wl-copy &>/dev/null; then
    missing+=("wl-clipboard (wl-paste / wl-copy)")
  fi
else
  CLIPBOARD_BACKEND="x11"
  if ! command -v xclip &>/dev/null; then
    missing+=("xclip")
  fi
fi

NOTIFY_AVAILABLE=false
if command -v notify-send &>/dev/null; then
  NOTIFY_AVAILABLE=true
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  msg="message-mirror: missing dependencies:\n"
  for dep in "${missing[@]}"; do
    msg+="  • $dep\n"
  done
  rofi -e "$(printf '%b' "$msg")" 2>/dev/null || \
    printf '%b' "$msg" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Clipboard helpers
# ---------------------------------------------------------------------------

clipboard_read() {
  if [[ "$CLIPBOARD_BACKEND" == "wayland" ]]; then
    wl-paste --no-newline 2>/dev/null
  else
    xclip -selection clipboard -o 2>/dev/null
  fi
}

clipboard_write() {
  if [[ "$CLIPBOARD_BACKEND" == "wayland" ]]; then
    printf '%s' "$1" | wl-copy
  else
    printf '%s' "$1" | xclip -selection clipboard
  fi
}

# ---------------------------------------------------------------------------
# Rofi helpers
# ---------------------------------------------------------------------------

rofi_menu() {
  # rofi_menu <prompt> [extra rofi args...] <<< items
  local prompt="$1"; shift
  rofi -dmenu -p "$prompt" "$@"
}

rofi_message() {
  # Show a message-only window (no list). Blocks until dismissed.
  rofi -e "$1"
}

# ---------------------------------------------------------------------------
# Step 1: Simple / Advanced
# ---------------------------------------------------------------------------

mode=$(printf 'Simple\nAdvanced' | rofi_menu "Analysis mode") || exit 0

# ---------------------------------------------------------------------------
# Step 2: Calibration (Advanced only)
# ---------------------------------------------------------------------------

RELATIONSHIP_FLAG=""
GOAL_FLAG=""
TONE_FLAG=""

if [[ "$mode" == "Advanced" ]]; then
  relationship=$(printf 'Skip\nfriend\nfamily\nnew_acquaintance\npartner\ncoworker\nmanager\ndirect_report\nclient\nex' \
    | rofi_menu "Relationship") || exit 0
  [[ "$relationship" != "Skip" ]] && RELATIONSHIP_FLAG="--relationship $relationship"

  goal=$(printf 'Skip\napology\nboundary\nclarification\ninvitation\ndecline\nfeedback\nrepair\ncheck_in\nlogistics\nhard_conversation' \
    | rofi_menu "Goal") || exit 0
  [[ "$goal" != "Skip" ]] && GOAL_FLAG="--goal $goal"

  tone=$(printf 'Skip\nwarm\ndirect\ngentle\nfirm\nneutral\nbrief' \
    | rofi_menu "Desired tone") || exit 0
  [[ "$tone" != "Skip" ]] && TONE_FLAG="--desired-tone $tone"
fi

# ---------------------------------------------------------------------------
# Step 3: Input method
# ---------------------------------------------------------------------------

input_method=$(printf 'From clipboard\nWrite message' | rofi_menu "Input") || exit 0

if [[ "$input_method" == "From clipboard" ]]; then
  draft=$(clipboard_read)
  if [[ -z "$draft" ]]; then
    rofi_message "Clipboard is empty."
    exit 0
  fi
else
  draft=$(rofi_menu "Message") || exit 0
  if [[ -z "$draft" ]]; then
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Step 4: Analyze
# ---------------------------------------------------------------------------

if [[ "$NOTIFY_AVAILABLE" == "true" ]]; then
  notify-send "message-mirror" "Analyzing…" --expire-time=90000
fi

tmpfile=$(mktemp /tmp/message-mirror-XXXXXX.json)
trap 'rm -f "$tmpfile"' EXIT

# shellcheck disable=SC2086
if ! printf '%s' "$draft" | message-mirror $RELATIONSHIP_FLAG $GOAL_FLAG $TONE_FLAG \
    >"$tmpfile" 2>/tmp/message-mirror-err; then
  err=$(cat /tmp/message-mirror-err)
  rofi_message "${err:-error: analysis failed}"
  exit 1
fi

ok=$(jq -r '.ok' "$tmpfile")

# ---------------------------------------------------------------------------
# Step 5a: Refusal
# ---------------------------------------------------------------------------

if [[ "$ok" == "false" ]]; then
  category=$(jq -r '.refusal.category' "$tmpfile")
  reason=$(jq -r '.refusal.reason' "$tmpfile")
  safer_frame=$(jq -r '.refusal.safer_frame' "$tmpfile")

  mesg="Category: $category\n$reason"
  selected=$(printf '%s' "$safer_frame" \
    | rofi_menu "Refusal" -mesg "$(printf '%b' "$mesg")" -no-custom) || exit 0

  if [[ "$selected" == "$safer_frame" ]]; then
    clipboard_write "$safer_frame"
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 5b: Analysis
# ---------------------------------------------------------------------------

intent=$(jq -r '.analysis.apparent_intent' "$tmpfile")
tones=$(jq -r '.analysis.emotional_tone | join(", ")' "$tmpfile")
risks=$(jq -r '.analysis.risks_or_ambiguities[]' "$tmpfile" | sed 's/^/• /')

if [[ -n "$risks" ]]; then
  mesg="Intent: $intent\nTone: $tones\n\nRisks:\n$risks"
else
  mesg="Intent: $intent\nTone: $tones"
fi

selected=$(printf 'Show alternatives →' \
  | rofi_menu "Analysis" -mesg "$(printf '%b' "$mesg")" -no-custom) || exit 0

[[ "$selected" != "Show alternatives →" ]] && exit 0

# ---------------------------------------------------------------------------
# Step 6: Alternatives
# ---------------------------------------------------------------------------

alt_direct_text=$(jq -r '.alternatives[] | select(.label=="direct") | .text' "$tmpfile")
alt_direct_why=$(jq -r '.alternatives[] | select(.label=="direct") | .why' "$tmpfile")
alt_warm_text=$(jq -r '.alternatives[] | select(.label=="warm") | .text' "$tmpfile")
alt_warm_why=$(jq -r '.alternatives[] | select(.label=="warm") | .why' "$tmpfile")
alt_boundaried_text=$(jq -r '.alternatives[] | select(.label=="boundaried") | .text' "$tmpfile")
alt_boundaried_why=$(jq -r '.alternatives[] | select(.label=="boundaried") | .why' "$tmpfile")

while true; do
  items=$(printf '[direct]  %s\n  ↳ %s\n[warm]  %s\n  ↳ %s\n[boundaried]  %s\n  ↳ %s' \
    "$alt_direct_text"     "$alt_direct_why" \
    "$alt_warm_text"       "$alt_warm_why" \
    "$alt_boundaried_text" "$alt_boundaried_why")

  selected=$(printf '%s' "$items" | rofi_menu "Pick alternative" -no-custom) || exit 0

  # Ignore ↳ sub-rows — loop back so the user can pick a real alternative
  if [[ "$selected" == "  ↳ "* ]]; then
    continue
  fi

  # Use prefix strings rather than case patterns to avoid bracket glob expansion.
  if [[ "$selected" == \[direct\]* ]]; then
    clipboard_write "$alt_direct_text"
  elif [[ "$selected" == \[warm\]* ]]; then
    clipboard_write "$alt_warm_text"
  elif [[ "$selected" == \[boundaried\]* ]]; then
    clipboard_write "$alt_boundaried_text"
  fi

  break
done

if [[ "$NOTIFY_AVAILABLE" == "true" ]]; then
  notify-send "message-mirror" "Copied to clipboard."
fi
