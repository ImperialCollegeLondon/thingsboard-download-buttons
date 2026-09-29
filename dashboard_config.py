"""Chart/action configuration for build_dashboard.py."""

# Each series gets its own axis, and its own scaling from the raw stored value.
#
# `divisor` becomes a ThingsBoard post-processing function, so it affects the
# CHART ONLY. The download buttons read the raw telemetry API, which knows
# nothing about widget post-processing, so exports stay in the units the node
# actually transmits (mV, centidegrees). That is deliberate — the CSV is the
# raw record. The chart will read 3.8 V where the CSV reads 3800.
# `raw_units` is what the export CSV header says, since exports are unscaled.
# `min`/`max` pin the axis range; omit (or None) to autoscale.
AXIS_PLAN = {
    "h": {
        "axis": "default",
        "label": "Distance (mm)",
        "position": "left",
        "units": "mm",
        "raw_units": "mm",
        "divisor": 1,
        "decimals": 0,
        "min": None,
        "max": None,
        "order": 0,
    },
    "d": {
        "axis": "default",
        "label": "Water depth (m)",
        "position": "left",
        "units": "m",
        "raw_units": "m",
        "divisor": 1,
        "decimals": 2,
        "min": None,
        "max": None,
        "order": 0,
    },
    "t": {
        "axis": "temperature",
        "label": "Temperature (°C)",
        "position": "right",
        "units": "°C",
        "raw_units": "centi-°C",
        "divisor": 100,  # node transmits centidegrees
        "decimals": 1,
        "min": None,
        "max": None,
        "order": 1,
    },
    "v": {
        "axis": "voltage",
        "label": "Voltage (V)",
        "position": "right",
        "units": "V",
        "raw_units": "mV",
        "divisor": 1000,  # node transmits millivolts
        "decimals": 1,
        # Pinned to the cell's usable range. Autoscaling a battery rail makes
        # millivolt ripple look like a cliff; a fixed 0-4.2 V shows the trend.
        "min": 0,
        "max": 4.2,
        "order": 2,
    },
}

X_AXIS_LABEL = "Time"

HEADER_BUTTONS = [
    {
        "script": "download_window.js",
        "name": "Download visible window",
        "icon": "file_download",
    },
    {
        "script": "download_all.js",
        "name": "Download all history",
        "icon": "cloud_download",
    },
]

 # Full width on the default 24-column grid, taller than the source to give
# the three axes and the legend room.
WIDGET_SIZE = {
    "x": 24,
    "y": 9,
}