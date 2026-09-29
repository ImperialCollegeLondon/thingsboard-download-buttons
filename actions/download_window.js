// Download the currently displayed time window as CSV.
//
// Widget header button -> Custom action. Uses widgetContext.timeWindow, so
// whatever range the dashboard time picker is showing is what gets exported.
//
// Derived from download_button/download_button.js.

(function () {
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

    var token = getAuthToken();
    if (!token) {
        dialogs.alert('Error', 'Authentication token not found. Please refresh the page.', 'CLOSE').subscribe();
        return;
    }

    var startTime = widgetContext.timeWindow.minTime;
    var endTime = widgetContext.timeWindow.maxTime;

    console.log('[download-window]', entity, keyInfo.names,
                new Date(startTime).toISOString(), '->', new Date(endTime).toISOString());

    fetchTimeseries(entity, keyInfo.names, startTime, endTime, 100000, token)
        .then(function (data) {
            var result = buildCsv(data, keyInfo);
            if (!result) {
                dialogs.alert('No data', 'No data points in the selected time window.', 'CLOSE').subscribe();
                return;
            }

            var filename = resolveEntityName(entity) + '_' +
                           isoDate(result.firstTs) + '_to_' + isoDate(result.lastTs) + '.csv';
            saveCsv(result.csv, filename);

            dialogs.alert('Download complete',
                'Saved ' + result.count + ' rows to ' + filename,
                'CLOSE').subscribe();
        })
        .catch(function (error) {
            console.error('[download-window]', error);
            dialogs.alert('Error', 'Failed to fetch data: ' + error.message, 'CLOSE').subscribe();
        });
})();
