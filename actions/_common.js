// Shared helpers for the RL000590 download actions.
//
// This file is not used directly by ThingsBoard — build_dashboard.py splices it
// into the top of each action script so both buttons share one implementation.
// Edit here, then re-run build_dashboard.py.

// Resolve the target entity.
//
// A header-button custom action does NOT receive a populated `entityId` argument
// (that only happens for row-click / cell-button actions on entity tables), so we
// fall back to the widget's first datasource. ThingsBoard has used a few shapes
// for that field across versions, hence the belt-and-braces checks.
function resolveEntity() {
    if (typeof entityId !== 'undefined' && entityId && entityId.id) {
        return { entityType: entityId.entityType || 'DEVICE', id: entityId.id };
    }
    var ds = widgetContext.datasources && widgetContext.datasources[0];
    if (ds) {
        if (ds.entityId && ds.entityId.id) {
            return { entityType: ds.entityId.entityType || ds.entityType || 'DEVICE', id: ds.entityId.id };
        }
        if (typeof ds.entityId === 'string') {
            return { entityType: ds.entityType || 'DEVICE', id: ds.entityId };
        }
        if (ds.deviceId) {
            return { entityType: 'DEVICE', id: ds.deviceId };
        }
    }
    return null;
}

function resolveEntityName(entity) {
    if (typeof entityName !== 'undefined' && entityName) {
        return entityName;
    }
    var ds = widgetContext.datasources && widgetContext.datasources[0];
    if (ds && ds.entityName) {
        return ds.entityName;
    }
    return entity ? entity.id : 'device';
}

// Telemetry key names are short codes on the wire (t, h, v). Prefer the widget's
// human labels for the CSV header so the file is readable outside ThingsBoard.
//
// Units come from key.units, as the raw telemetry data will be processed to match
// the chart.
function collectDataKeys() {
    var keys = [];
    var labels = {};
    if (widgetContext.datasources) {
        widgetContext.datasources.forEach(function (ds) {
            if (!ds.dataKeys) {
                return;
            }
            ds.dataKeys.forEach(function (key) {
                if (keys.indexOf(key.name) === -1) {
                    keys.push(key.name);
                    labels[key.name] = key.label || key.name;
                    var units = key.units;
                    if (units) {
                        labels[key.name] += ' (' + units + ')';
                    }
                }
            });
        });
    }
    return { names: keys, labels: labels };
}

function getAuthToken() {
    return localStorage.getItem('jwt_token');
}

function fetchTimeseries(entity, keys, startTs, endTs, limit, token) {
    var url = '/api/plugins/telemetry/' + entity.entityType + '/' + entity.id +
              '/values/timeseries' +
              '?keys=' + encodeURIComponent(keys.join(',')) +
              '&startTs=' + startTs +
              '&endTs=' + endTs +
              '&limit=' + limit +
              '&orderBy=DESC';

    return fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Accept': 'application/json',
            'X-Authorization': 'Bearer ' + token
        }
    }).then(function (response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        return response.json();
    });
}

// Wide CSV: one row per timestamp, one column per key.
//
// Builds a ts -> value lookup per key first. The obvious nested-loop version
// (Array.find inside the timestamp loop) is O(rows x points) and locks the tab
// up on a full-history export.
function buildCsv(data, keyInfo) {
    var keys = Object.keys(data).filter(function (k) {
        return Array.isArray(data[k]) && data[k].length > 0;
    });

    var index = {};
    var timestampSet = new Set();
    keys.forEach(function (key) {
        var byTs = {};
        data[key].forEach(function (point) {
            byTs[point.ts] = point.value;
            timestampSet.add(point.ts);
        });
        index[key] = byTs;
    });

    var timestamps = Array.from(timestampSet).sort(function (a, b) {
        return a - b;
    });

    if (timestamps.length === 0) {
        return null;
    }

    var header = ['Timestamp', 'DateTime'].concat(keys.map(function (key) {
        return csvEscape(keyInfo.labels[key] || key);
    }));
    var rows = [header.join(',')];

    timestamps.forEach(function (ts) {
        var row = [ts, new Date(ts).toISOString()];
        keys.forEach(function (key) {
            var value = index[key][ts];
            if (value !== undefined && typeof DIVISORS !== 'undefined' && DIVISORS[key]) {
                var decimals = (typeof DECIMALS !== 'undefined' && DECIMALS[key] !== undefined) ? DECIMALS[key] : 1;
                value = (parseFloat(value) / DIVISORS[key]).toFixed(decimals);
            }
            row.push(value === undefined ? '' : csvEscape(value));
        });
        rows.push(row.join(','));
    });

    return {
        csv: rows.join('\n') + '\n',
        count: timestamps.length,
        firstTs: timestamps[0],
        lastTs: timestamps[timestamps.length - 1]
    };
}

function csvEscape(value) {
    var text = String(value);
    if (text.indexOf(',') !== -1 || text.indexOf('"') !== -1 || text.indexOf('\n') !== -1) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

function saveCsv(csv, filename) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = window.URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

function isoDate(ts) {
    return new Date(ts).toISOString().split('T')[0];
}
