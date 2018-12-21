angular.module('BlocksApp').controller('AddressController', function ($stateParams, $rootScope, $scope, $http, $location) {
    var activeTab = $location.url().split('#');
    if (activeTab.length > 1){
        $scope.activeTab = activeTab[1];
    }else {
        $scope.activeTab = 'tab_addr_1'
    }

    $rootScope.$state.current.data["pageSubTitle"] = $stateParams.hash;
    $scope.addrHash = $stateParams.hash;
    $scope.addr = {"balance": 0, "count": 0, "mined": 0, isMined:false, uncles:0};
    $scope.settings = $rootScope.setup;
    $scope.blocks = {};
    $scope.uncles = {};

    //fetch web3 stuff
    $http({
        method: 'POST',
        url: '/web3relay',
        data: {"addr": $scope.addrHash, "options": ["balance", "count", "bytecode"]}
    }).then(function (resp) {
        resp.data.detail.coinbase = resp.data.detail.coinbase.toLowerCase();
        resp.data.detail.temAddress = resp.data.detail.temAddress.toLowerCase();
        $scope.addr = $.extend($scope.addr, resp.data);
        fetchTxs();
        fetchBlocks();
        fetchUncles();
        if (resp.data.isContract) {
            $rootScope.$state.current.data["pageTitle"] = "Contract Address";
            fetchInternalTxs();
        }
    });

    // fetch ethf balance 
    if ($scope.settings.useEthFiat)
        $http({
            method: 'POST',
            url: '/fiat',
            data: {"addr": $scope.addrHash}
        }).then(function (resp) {
            $scope.addr.ethfiat = resp.data.balance;
        });

    //fetch transactions
    var fetchTxs = function () {
        var table = $("#table_txs").DataTable({
            processing: true,
            serverSide: true,
            paging: true,
            ajax: function (data, callback, settings) {
                data.addr = $scope.addrHash;
                data.count = $scope.addr.count;
                $http.post('/addr', data).then(function (resp) {
                    // save data
                    $scope.data = resp.data;
                    // check $scope.records* if available.
                    resp.data.recordsTotal = $scope.recordsTotal ? $scope.recordsTotal : resp.data.recordsTotal;
                    resp.data.recordsFiltered = $scope.recordsFiltered ? $scope.recordsFiltered : resp.data.recordsFiltered;
                    callback(resp.data);
                });

                // get mined, recordsTotal counter only once.
                if (data.draw > 1)
                    return;

                $http.post('/addr_count', data).then(function (resp) {
                    $scope.addr.count = resp.data.recordsTotal;
                    $scope.addr.mined = parseInt(resp.data.mined);

                    data.count = resp.data.recordsTotal;

                    // set $scope.records*
                    $scope.recordsTotal = resp.data.recordsTotal;
                    $scope.recordsFiltered = resp.data.recordsFiltered;
                    // draw table if $scope.data available.
                    if ($scope.data) {
                        $scope.data.recordsTotal = resp.data.recordsTotal;
                        $scope.data.recordsFiltered = resp.data.recordsFiltered;
                        callback($scope.data);
                    }
                });
            },
            "lengthMenu": [
                [10, 20, 50, 100, 150, 300, 500, 1000],
                [10, 20, 50, 100, 150, 300, 500, 1000] // change per page values here
            ],
            "pageLength": 20,
            "order": [
                [6, "desc"]
            ],
            "language": {
                "lengthMenu": "_MENU_ transactions",
                "zeroRecords": "No transactions found",
                "infoEmpty": ":(",
                "infoFiltered": "(filtered from _MAX_ total txs)"
            },
            "columnDefs": [
                {"targets": [5], "visible": false, "searchable": false},
                {"type": "date", "targets": 6},
                {"orderable": false, "targets": [0, 2, 3, 4]},
                {
                    "render": function (data, type, row) {
                        if (data != $scope.addrHash)
                            return '<a href="/addr/' + data + '">' + data + '</a>'
                        else
                            return data
                    }, "targets": [2, 3]
                },
                {
                    "render": function (data, type, row) {
                        return '<a href="/block/' + data + '">' + data + '</a>'
                    }, "targets": [1]
                },
                {
                    "render": function (data, type, row) {
                        return '<a href="/tx/' + data + '">' + data + '</a>'
                    }, "targets": [0]
                },
                {
                    "render": function (data, type, row) {
                        return getDuration(data).toString();
                    }, "targets": [6]
                },
            ]
        });
    }
    var fetchBlocks = function () {
        var table = $("#table_b").DataTable({
            processing: true,
            serverSide: true,
            paging: true,
            searching: false,
            ajax: function (data, callback, settings) {
                $http.post('/blocks', {
                    page: Math.ceil(data.start / data.length) + 1,
                    size: data.length,
                    addr: $scope.addrHash
                }).then(function (list) {
                    // save data
                    data.count = list.data.total;
                    $scope.blocks.data = [...list.data.data];
                    $scope.blocks.recordsTotal = list.data.total;
                    $scope.blocks.recordsFiltered = list.data.total;
                    if(list.data.total != 0){
                        $scope.addr.isMined = true;
                    }
                    callback($scope.blocks);
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
                {"orderable": false, "targets": [0, 1, 2, 3, 4, 5]},
                {
                    "render": function (data, type, row) {
                        return '<a href="/block/' + row.number + '">' + row.number + '</a>'
                    }, "targets": [0]
                },
                {
                    "render": function (data, type, row) {
                        return getDuration(row.timestamp).toString();
                    }, "targets": [1]
                },
                {
                    "render": function (data, type, row) {
                        return '<a href="/transaction?block=' + row.number + '">' + row.transactions + '</a>'
                    }, "targets": [2]
                },
                {
                    "render": function (data, type, row) {
                        return row.difficulty;
                    }, "targets": [3]
                },
                {
                    "render": function (data, type, row) {
                        return '<a href="/addr/' + row.coinbase + '">' + row.coinbase.substr(0, 10) + '...</a>'
                    }, "targets": [4]
                },
                {
                    "render": function (data, type, row) {
                        return row.gasUsed;
                    }, "targets": [5]
                }
            ]
        });
    }
    var fetchUncles = function () {
        var table = $("#table_u").DataTable({
            processing: true,
            serverSide: true,
            paging: true,
            searching: false,
            ajax: function (data, callback, settings) {
                $http.post('/uncles', {
                    page: Math.ceil(data.start / data.length) + 1,
                    size: data.length,
                    addr:$scope.addrHash
                }).then(function (list) {
                    // save data
                    data.count = list.data.total;
                    $scope.uncles.data = [...list.data.data];
                    $scope.uncles.recordsTotal = list.data.total;
                    $scope.uncles.recordsFiltered = list.data.total;
                    $scope.addr.uncles = list.data.total;
                    callback($scope.uncles);
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
                {"orderable": false, "targets": [0, 1, 2, 3, 4, 5]},
                {
                    "render": function (data, type, row) {
                        return '<a href="/block/' + row.blockNumber + '">' + row.blockNumber + '</a>'
                    }, "targets": [0]
                },
                {
                    "render": function (data, type, row) {
                        return getDuration(row.timestamp).toString();
                    }, "targets": [1]
                },
                {
                    "render": function (data, type, row) {
                        return '<a href="/uncle/' + row.number + '">' + row.number + '</a>'
                    }, "targets": [2]
                },
                {
                    "render": function (data, type, row) {
                        return row.difficulty + " TH";
                    }, "targets": [3]
                },
                {
                    "render": function (data, type, row) {
                        return row.gasUsed
                    }, "targets": [4]
                },
                {
                    "render": function (data, type, row) {
                        return row.gasUsed;
                    }, "targets": [5]
                }
            ]
        });
    }
    var fetchInternalTxs = function () {
        $http({
            method: 'POST',
            url: '/web3relay',
            data: {"addr_trace": $scope.addrHash}
        }).then(function (resp) {
            $scope.internal_transactions = resp.data;
        });
    }
                    //从自定义指令提出了http请求


})
    .directive('contractSource', function ($http) {
        return {
            restrict: 'E',
            templateUrl: '/views/contract-source.html',
            scope: true,
            link: function ($scope, elem, attrs) {
                $http({
                    method: 'POST',
                    url: '/compile',
                    data: {
                        "addr": $scope.addrHash,
                        "action": "find"
                    }
                }).then(function (resp) {
                    console.log(resp.data);
                    $scope.contract = resp.data;
                });
            }         
        }
    })
    .directive('templateSource', function ($http) {
        return {
            restrict: 'E',
            templateUrl: '/views/template-source.html',
            scope: true,
            link: function ($scope, elem, attrs) {
                $scope.template = {};
                (function () {
                    var table = $("#table_TemplateInstance").DataTable({
                        processing: true,
                        serverSide: true,
                        paging: false,
                        "ordering": false,
                        searching: false,
                        stateSave: true,
                        "pagingType": "full_numbers",
                        ajax: function (data, callback, settings) {
                            $http({
                                   method: 'POST',
                                   url: '/compile',
                                   data: {
                                       "addr": $scope.addrHash,
                                       "action": "find"
                                   }
                               }).then(function (list) {   
                                $scope.template = list.data;
                                $scope.template.data = [...list.data.instance];
                                $scope.template.recordsTotal = list.data.instance.length;
                                $scope.template.recordsFiltered = list.data.instance.length;
                                callback($scope.template);
                            });
                        },
                        "lengthMenu": [
                            [10, 20, 50, 100],
                            [10, 20, 50, 100] // change per page values here
                        ],
                        "pageLength": 10,
                        "language": {
                            "lengthMenu": "",
                            "zeroRecords": "",
                            "infoEmpty": "",
                            "infoFiltered": ""
                        },
                        "columnDefs": [{
                                "orderable": false,
                                "targets": [0]
                            },
                            {
                                "render": function (data, type, row) {
                                    return '<a href="/addr/' + row + '">' + row + '</a>'
                                },
                                "targets": [0]
                            },
                        ]
                    });
                }());
            }
        }
    })