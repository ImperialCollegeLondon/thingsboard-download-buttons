// Download the device's entire telemetry history as CSV, paginated.
//
// Widget header button -> Custom action. Ignores the dashboard time window and
// walks backwards from now in PAGE_SIZE chunks until the server stops returning
// full pages.
//
// Derived from download_button/download_full_button_with_pagination.js.

(function () {
    var PAGE_SIZE = 50000;
    var MAX_PAGES = 20;   // safety limit; PAGE_SIZE * MAX_PAGES = 1M points per key

    var $injector = widgetContext.$scope.$injector;
    var dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));

    var entity = resolveEntity();
    if (!entity) {
        dialogs.alert('Error', 'No device is configured on this widget.', 'CLOSE').subscribe();
        return;
    }

    var keyInfo = collectDataKeys();
    if (!keyInfo.names.length) {
        dialogs.alert('Error', 'No telemetry keys are configured on this widget.', 'CLOSE').subscribe();
        return;
    }

    dialogs.confirm(
        'Download all data',
        'This exports the full history for ' + resolveEntityName(entity) +
        ', ignoring the dashboard time window. It may take a while and produce a large file. Continue?',
        'Cancel',
        'Download'
    ).subscribe(function (confirmed) {
        if (confirmed) {
            run();
        }
    });

    function run() {
        var token = getAuthToken();
        if (!token) {
            dialogs.alert('Error', 'Authentication token not found. Please refresh the page.', 'CLOSE').subscribe();
            return;
        }

        var merged = {};
        var seen = {};          // key -> Set of timestamps already merged
        var startTs = 0;
        var cursor = Date.now() + (365 * 24 * 60 * 60 * 1000);  // now + 1y, to catch clock skew
        var page = 0;

        fetchPage();

        function fetchPage() {
            if (page >= MAX_PAGES) {
                console.warn('[download-all] hit MAX_PAGES (' + MAX_PAGES + '), export may be truncated');
                finish(true);
                return;
            }
            page++;

            fetchTimeseries(entity, keyInfo.names, startTs, cursor, PAGE_SIZE, token)
                .then(function (data) {
                    var gotAnything = false;
                    var gotFullPage = false;
                    var oldestInPage = cursor;

                    Object.keys(data).forEach(function (key) {
                        var points = data[key];
                        if (!Array.isArray(points) || points.length === 0) {
                            return;
                        }
                        gotAnything = true;
                        if (points.length >= PAGE_SIZE) {
                            gotFullPage = true;
                        }
                        if (!merged[key]) {
                            merged[key] = [];
                            seen[key] = new Set();
                        }
                        points.forEach(function (point) {
                            // Pages are cursor-bounded but overlap is still possible
                            // if several points share the boundary timestamp.
                            if (!seen[key].has(point.ts)) {
                                seen[key].add(point.ts);
                                merged[key].push(point);
                            }
                            if (point.ts < oldestInPage) {
                                oldestInPage = point.ts;
                            }
                        });
                    });

                    console.log('[download-all] page ' + page + ', oldest ts ' +
                                new Date(oldestInPage).toISOString());

                    // Step the cursor past the oldest point we just read so the
                    // next page continues strictly further back in time.
                    var nextCursor = oldestInPage - 1;
                    if (gotAnything && gotFullPage && nextCursor > startTs && nextCursor < cursor) {
                        cursor = nextCursor;
                        fetchPage();
                    } else {
                        finish(false);
                    }
                })
                .catch(function (error) {
                    console.error('[download-all]', error);
                    dialogs.alert('Error', 'Failed to fetch data: ' + error.message, 'CLOSE').subscribe();
                });
        }

        function finish(truncated) {
            var result = buildCsv(merged, keyInfo);
            if (!result) {
                dialogs.alert('No data', 'This device has no stored telemetry.', 'CLOSE').subscribe();
                return;
            }

            var filename = resolveEntityName(entity) + '_ALL_' +
                           isoDate(result.firstTs) + '_to_' + isoDate(result.lastTs) + '.csv';
            saveCsv(result.csv, filename);

            var message = 'Saved ' + result.count + ' rows to ' + filename + '\n' +
                          'Range: ' + isoDate(result.firstTs) + ' to ' + isoDate(result.lastTs) +
                          ' (' + page + ' page' + (page === 1 ? '' : 's') + ')';
            if (truncated) {
                message += '\n\nWarning: hit the ' + MAX_PAGES + '-page safety limit, ' +
                           'so older data may be missing.';
            }
            dialogs.alert(truncated ? 'Download complete (truncated)' : 'Download complete',
                          message, 'CLOSE').subscribe();
        }
    }
})();
