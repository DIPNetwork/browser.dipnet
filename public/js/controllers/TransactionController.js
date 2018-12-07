angular.module('BlocksApp').controller('TransactionController', function ($stateParams, $rootScope, $scope, $http, $location) {
    $scope.data = {};
    $scope.queryInfo = {};
    if('addr' in  $location.search()){
        $scope.queryInfo.addr = $scope.queryInfo.addr;
    }
    if('block' in  $location.search()){
        $scope.queryInfo.addr = $scope.queryInfo.block;
    }
    var fetchUncles = function () {
        var table = $("#table_transactions").DataTable({
            processing: true,
            serverSide: true,
            paging: true,
            searching: false,
            stateSave:true,
            "pagingType": "full_numbers",
            stateSaveCallback:function(settings,data){
                sessionStorage.setItem('txs_'+ settings.sInstance, JSON.stringify(data))
            },
            stateLoadCallback:function(settings){
                return JSON.parse(sessionStorage.getItem('txs_'+settings.sInstance));
            },
            ajax: function (data, callback, settings) {
                let sql = '';
                if ('addr' in $scope.queryInfo || 'block' in $scope.queryInfo) {
                    sql = '&' + Object.keys($scope.queryInfo)[0] + '=' + Object.values($scope.queryInfo)[0];
                }
                $http.post('/tx',{page:Math.ceil(data.start / data.length) + 1,size:data.length,...sql}).then(function (list) {
                    // save data
                    data.count = list.data.length;
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
            "columnDefs": [
                {"orderable": false, "targets": [0, 1, 2, 3, 4, 5, 6]},
                {
                    "render": function (data, type, row) {
                        return '<a href="/tx/' + row.hash + '">' + row.hash.substr(0, 10) + '...</a>'
                    }, "targets": [0]
                },
                {
                    "render": function (data, type, row) {
                        return getDuration(row.timestamp).toString();
                    }, "targets": [2]
                },
                {
                    "render": function (data, type, row) {
                        return '<a href="/block/' + row.blockNumber + '">' + row.blockNumber + '</a>'
                    }, "targets": [1]
                },
                {
                    "render": function (data, type, row) {
                        return '<a href="/addr/' + row.from + '">' + row.from.substr(0, 10) + '...</a>';
                    }, "targets": [3]
                },
                {
                    "render": function (data, type, row) {
                        if(row.to == null){
                            row.to = row.contractAddress;
                        }
                        return '<a href="/addr/' + row.to + '" title="' + row.to + '">' + row.to.substr(0, 10) + '...</a>'
                    }, "targets": [4]
                },
                {
                    "render": function (data, type, row) {
                        return row.value.substr(0, 10) + ' DPN';
                    }, "targets": [5]
                },
                {
                    "render": function (data, type, row) {
                        return (row.gasPrice * row.gasUsed).toString().substr(0, 10) - 0;
                    }, "targets": [6]
                }
            ]
        });
    };
    fetchUncles();

});