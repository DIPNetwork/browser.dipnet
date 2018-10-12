angular.module('BlocksApp').controller('BlocksController', function($stateParams, $rootScope, $scope, $http, $location) {
  console.log('Blocks')
  $http({
    method: 'POST',
    url: '/blocks',
    data: {'page':1,size:10}
  }).success(function(data) {
    console.log(data)
  });
  $scope.data = {};
  var fetchUncles = function() {
    var table = $("#table_blocks").DataTable({
      processing: true,
      serverSide: true,
      paging: true,
      searching:false,
      ajax: function(data, callback, settings) {
        $http.post('/blocks', {page:Math.ceil(data.start/data.length)+1,size:data.length}).then(function(list) {
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
      "columnDefs": [
        {"orderable": false, "targets": [0,1,2,3,4,5,6,7,8]},
        { "render": function(data, type, row) {
            return '<a href="/block/'+row.number+'">'+row.number+'</a>'
          }, "targets": [0]},
        { "render": function(data, type, row) {
            return getDuration(row.timestamp).toString();
          }, "targets": [1]},
        { "render": function(data, type, row) {
            return '<a href="/transaction?block='+row.number+'">'+0+'</a>'
          }, "targets": [2]},
        { "render": function(data, type, row) {
            return row.uncles.length;
          }, "targets": [3]},
        { "render": function(data, type, row) {
            return'<a href="/addr/'+row.miner+'">'+row.miner.substr(0,10)+'...</a>'
          }, "targets": [4]},
        { "render": function(data, type, row) {
            return row.gasUsed;
          }, "targets": [5]},
        { "render": function(data, type, row) {
            return row.gasLimit;
          }, "targets": [6]},
        { "render": function(data, type, row) {
            return row.gasLimit;
          }, "targets": [7]},
        { "render": function(data, type, row) {
            return row.gasLimit;
          }, "targets": [8]},
      ]
    });
  };
  fetchUncles();
});