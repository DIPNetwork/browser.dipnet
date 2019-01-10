angular.module('BlocksApp').controller('UnclesController', function($stateParams, $rootScope, $scope, $http, $location) {
    $scope.data = {};
    var fetchUncles = function() {
        var table = $("#table_uncles").DataTable({
            processing: true,
            serverSide: true,
            paging: true,
            "ordering": false,
            searching: false,
            "scrollX": true,
            stateSave: true,
            "pagingType": $("html")[0].offsetWidth > 550 ? "full_numbers" : "full",
            stateSaveCallback: function(settings, data) {
                sessionStorage.setItem('uncles_' + settings.sInstance, JSON.stringify(data))
            },
            stateLoadCallback: function(settings) {
                return JSON.parse(sessionStorage.getItem('uncles_' + settings.sInstance));
            },
            ajax: function(data, callback, settings) {
                data.count = 0;
                $http.post('/uncles', {
                    page: Math.ceil(data.start / data.length) + 1,
                    size: data.length
                }).then(function(list) {
                    // save data
                    data.count = list.data.total;
                    $scope.data.data = [...list.data.data];
                    $scope.data.recordsTotal = list.data.total;
                    $scope.data.recordsFiltered = list.data.total;
                    callback($scope.data);
                });
            },
            "lengthMenu": [
                [10, 20, 50, 100],
                [10, 20, 50, 100] // change per page values here
            ],
            "pageLength": 10,
            "language": {
                "lengthMenu": "_MENU_ transactions",
                "zeroRecords": "No transactions found",
                "infoEmpty": ":(",
                "infoFiltered": "(filtered from _MAX_ total txs)"
            },
            "columnDefs": [{
                "orderable": false,
                "targets": [0, 1, 2, 3, 4]
            }, {
                "render": function(data, type, row) {
                    return row.gasUsed;
                },
                "targets": [4]
            }, {
                "render": function(data, type, row) {
                    return '<a href="/addr/' + row.coinbase + '">' + row.coinbase + '</a>'
                },
                "targets": [3]
            }, {
                "render": function(data, type, row) {
                    return '<a href="/uncle/' + row.blockNumber + '/' + row.position + '">' + row.number + '</a>'
                },
                "targets": [1]
            }, {
                "render": function(data, type, row) {
                    return '<a href="/block/' + row.blockHash + '">' + row.blockNumber + '</a>'
                },
                "targets": [0]
            }, {
                "render": function(data, type, row) {
                    return getDuration(row.timestamp).toString();
                },
                "targets": [2]
            }, ]
        });
    };
    fetchUncles();
});