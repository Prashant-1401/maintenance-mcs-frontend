# Maintenance Reliability App — Demo Guide

## Before the demo (5 minutes earlier)
1. Double-click **Start-Demo** (in this folder, or the shortcut on your Desktop).
2. Wait about a minute. A black window shows progress; your browser then opens the app by itself.
3. Log in: **admin@maintenance.local** / **password123**.

## During the demo
- If a page looks stuck, shows an error, or goes blank: double-click **Fix-Demo**, wait ~1 minute, refresh the browser. Your data is kept.

## After the demo
- Double-click **Stop-Demo**. (Nothing is lost; everything is saved.)

## Other logins (to show different roles)
All use password **password123**:
| Who | Login | What they see |
|---|---|---|
| Admin | admin@maintenance.local | Everything, including master data & checklist templates |
| Head | head@maintenance.local | Management view (approve deviations, reports) |
| Supervisor | supervisor@maintenance.local | Management view |
| Fitter | fitter@maintenance.local | Technician — runs PMs / breakdown jobs |
| Electrician | electrician@maintenance.local | Technician — electrical jobs |
| Operator | operator@maintenance.local | Raises breakdown slips only |

## What the demo data tells (the story)
Plant 1 – RPVC Pipes has an extrusion line (Extruder, Haul-off, Cutter, Vacuum pump, Cooling pump) and a mixing line (Mixer, Loader). Real RPVC checklists are loaded: the **PM plan (273 checks in 12 equipment groups)** and the **Predictive data sheets (Extrusion 156 checkpoints, Mixer 99)**.
- Extruder had 3 breakdowns; the last (coupling failure) has a finished **RCA** with action items.
- The **Mixer is down right now** (motor tripping) — shows the live breakdown flow.
- Extruder PM is **in progress today** (124 of 273 checks done); Haul-off PM was **closed with checks deferred**; Cutter PM is **overdue**.
- Predictive: latest Extruder check has several readings out of limits (red/amber on the heatmap).

## Suggested 10-minute click path
1. **Dashboard** — breakdown count, MTTR / MTBF, PM and predictive compliance, cost split. Click a tile to see its trend.
2. **Open Orders** — everything open right now, plus technician workload (who is busy).
3. **Preventive Maintenance → PM Schedules** — switch List / Calendar (green = on time, red = overdue). Click **+ New Schedule**: pick **Plant → Line → Machine(s)**, choose a checklist template, save once for several machines.
4. Open the **Extruder PM in progress**: checks are grouped by equipment (Extruder, Feeder, Heaters…). Open a group, mark Pass/Fail, add remarks, press **Save** (it keeps what you've done), add **spares** and **people who worked**, then **Complete PM**. *Key point: you don't have to finish every check — what was done is recorded, so you can audit later.*
5. **Preventive Heatmap** — one tile per machine: done / partial / not done.
6. **Predictive Maintenance → Predictive Schedules** — start a check on the Mixer (the one in progress): numeric readings (e.g. temperature, current) and OK/Not-OK points; **Save** repeatedly, then **Complete**.
7. **Predictive Heatmap** — click a tile to see which checkpoint is out of limit.
8. **Breakdown Maintenance** — open the Mixer breakdown (attend → close with spares & manpower). Then **Breakdown Heatmap** and **Breakdown History**.
9. **Problem Solving → RCA** — open the finished 5-Why on the extruder coupling and the **RCA Tracker** (corrective / preventive actions with owners and due dates).
10. **Master Data → PM / Predictive Checklist Templates** — show **Import from Excel**: upload the plant's own checklist sheet, review the preview, confirm. (Have the original Excel files ready: `1. RPVC- PM Plan Tentative.xlsx`, `8. Predictive Maintenance Data Sheet -RPVC.xlsx`.)

## Good to know
- It runs only on this laptop, offline. Nothing is sent anywhere.
- Opening a very large group (e.g. "Loader / HLVC", 65 checks) can take a second to draw — that's normal.
- Want a fresh start with the same demo story? Ask for the **demo data reset** (your current data is backed up automatically before any reset).
