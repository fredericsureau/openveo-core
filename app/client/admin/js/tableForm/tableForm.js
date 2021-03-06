(function (angular) {

  'use strict';

  var app = angular.module("ov.tableForm", ["ov.i18n", "ngSanitize"]);

  app.controller("DataTableController", DataTableController);
  app.controller("FormEditController", FormEditController);
  app.controller("FormAddController", FormAddController);
  app.controller("ModalInstanceTableController", ModalInstanceTableController);
  app.controller("DatePickerController", DatePickerController);
  app.factory("tableReloadEventService", TableReloadEventService);
  app.filter('status',StatusFilter);
  app.filter('category',CategoryFilter);

  // Controller for table, form in table and form outside table
  DataTableController.$inject = ["$scope", "$modal", "entityService"];
  FormEditController.$inject = ["$scope", "$filter"];
  FormAddController.$inject = ["$scope", "$filter", "tableReloadEventService"];
  ModalInstanceTableController.$inject = ["$scope", "$modalInstance"];
  DatePickerController.$inject = ["$scope"];

  // Service to reload a displayed table
  TableReloadEventService.$inject = ["$rootScope"];
  
  // Filter to display content in the table (cf. dataTable.html)
  StatusFilter.$inject = ['$filter'];
  CategoryFilter.$inject = ['jsonPath'];
  
  /**
   * Defines a filter to print status in cells.
   *
   * This filter has one optional Number parameter which must be specified
   * if the input is equal to 8 (error status), to precise the error code.
   */
  function StatusFilter($filter){
    return function(input, errorCode){
      var label = $filter("translate")("VIDEOS.STATE_" + input);
      var type = "label-danger";

      // Video is published
      if(input == 7) type = "label-success";

      // Video is sent
      else if(input == 6) type = "label-warning";

      // All other video states
      else if (input !== 8) type = "label-info";

      // Video is on error
      if(input === 8) label = label + "(" + errorCode + ")";

      return "<span class='label " + type + "'>" + label + "</span>";
    };
  };
  
/**
 * 
 * Filter to print Category in cells
 * 
 */
  function CategoryFilter(jsonPath){
    return function(input, rubrics) {
      //get title of elements in rubrics where id is "input"
      var name = jsonPath(rubrics, '$..*[?(@.id=="'+input+'")].title');
      if (name && name.length>0)  return name[0];
      else return "";
    };
  };
  
/**
 * 
 * Service reload Table
 */
 function TableReloadEventService($rootScope) {
    var sharedService = {};
    // deliver a broadcast service to reload datatable
    sharedService.broadcast = function () {
      $rootScope.$broadcast('reloadDataTable');
    };
    return sharedService;
  };
  
  /**
   * 
   *  DatePicker
   *  
   */
  function DatePickerController($scope) {
    var dp = this;
    
    dp.today = function () {
      dp.dt = new Date();
    };
    dp.today();

    dp.clear = function () {
      dp.dt = null;
    };

    dp.toggleMax = function () {
      dp.maxDate = dp.maxDate ? null : new Date();
    };
    dp.toggleMax();

    dp.open = function () {
      dp.status.opened = true;
    };

    dp.dateOptions = {
      startingDay: 1
    };
    dp.status = {
      opened: false
    };
  }
  
  /**
   * 
   * FormController
   *  
   */
  function FormEditController($scope, $filter) {
    
    var fec = this;
    // init the form on a row
    fec.init = function(row){
      fec.model = row;
      //Call init function if defined to set up dynamically some fields
      if($scope.editFormContainer.init) $scope.editFormContainer.init(row) ;
      fec.fields = $scope.editFormContainer.fields;
      fec.originalFields = fec.fields;
    };
    
    //Condition on a row to be edited
    fec.conditionEditDetail = $scope.editFormContainer.conditionEditDetail || function(val){return true};
    
    // When submit the form
    fec.onSubmit = function () {
      if ($scope.editFormContainer.onSubmit) {
        fec.model.saving = true;
        //Call submit function
        $scope.editFormContainer.onSubmit(fec.model, function () {
          //on success 
          //save value in the fields as initial value
          fec.options.updateInitialValue();
          fec.model.saving = false;
        }, function () {
          //on error 
          //reset the form
          fec.options.resetModel();
          $scope.$emit("setAlert", 'danger', $filter('translate')('UI.SAVE_ERROR'), 4000);
          fec.model.saving = false;
        });
      } else {
        //if there is no submit function : alert
        $scope.$emit("setAlert", 'danger', $filter('translate')('UI.SAVE_ERROR'), 4000);
      }
    };
    fec.options = {};
    
    // Toggle between show and editable information
    fec.editForm = function(){
      $scope.editFormContainer.pendingEdition = true;
      fec.form.$show();
    };
    fec.cancelForm = function(){
      $scope.editFormContainer.pendingEdition = false;
      fec.form.$cancel();
    };
  }
  
  /**
   * 
   * FormController
   *  
   */
  function FormAddController($scope, $filter, tableReloadEventService) {
    var vm = this;
    vm.model = $scope.addFormContainer.model;
//    vm.originalFields = angular.copy(vm.fields);
    vm.fields = $scope.addFormContainer.fields;
    
    vm.onSubmit = function () {
      //Call submit function
      $scope.addFormContainer.onSubmit(vm.model, function () {
        //on success 
        //reset the form
        vm.options.resetModel();
        // reload the table
        tableReloadEventService.broadcast();
        // emit a succeed message
        $scope.$emit("setAlert", 'success', $filter('translate')('UI.SAVE_SUCCESS'), 4000);
      }, function () {
        $scope.$emit("setAlert", 'danger', $filter('translate')('UI.SAVE_ERROR'), 4000);
      });
    }
    vm.options = {};
  }

  /**
   * 
   * DataTableController
   *  
   */
  function DataTableController($scope, $modal, entityService) {
    var dataTable = this;
    // All data
    dataTable.rows = $scope.tableContainer.rows || {};
    //Entity to call
    dataTable.entityType = $scope.tableContainer.entityType || "";
    
    //Filter key list
    dataTable.filterBy = angular.copy($scope.tableContainer.filterBy);
    
    //Header list
    dataTable.header = $scope.tableContainer.header || [];
    
    //action object to display in le actions list
    dataTable.actions = $scope.tableContainer.actions || [];
    
    //Column unsortable
    dataTable.notSortBy = ["action"];
    
    //hide selected checkbox
    dataTable.showSelectAll = $scope.tableContainer.showSelectAll || true;
    //is a row selected
    dataTable.isRowSelected = false;
    
    // Init Datatable
    dataTable.init = {
      'count': 10,
      'page': 1,
      'sortBy': dataTable.header[0]['key'],
      'sortOrder': 'asc'
    };
   
    dataTable.customTheme = {
      iconUp: 'glyphicon glyphicon-triangle-bottom',
      iconDown: 'glyphicon glyphicon-triangle-top',
      listItemsPerPage: [5, 10, 20, 30],
      itemsPerPage: 10,
      loadOnInit: true
    };
    
    //Enable selectAll option
    if(dataTable.showSelectAll) dataTable.customTheme['templateHeadUrl'] = 'views/elements/head.html';
    //Pagination template
    dataTable.customTheme['templateUrl'] = 'views/elements/pagination.html';
    
    
    //callback to load Resource on filter, pagination or sort change
    dataTable.getResource = function (params, paramsObj) {
      var param = {};
      param['count'] = paramsObj.count;
      param['page'] = paramsObj.page;
      param['sort'] = {};
      param['sort'][paramsObj.sortBy] = paramsObj.sortOrder == "dsc" ? -1 : 1;
      param['filter'] = {};
      dataTable.filterBy.forEach(function(filter, key){
        if (filter.value && filter.value != "") {
          if (filter.type == "date"){           
            var date = new Date(filter.value);
            var datePlus =  new Date(date);
            datePlus.setDate(date.getDate() + 1);
            param['filter'][filter.key] = {"$gte": date.getTime(), "$lt":datePlus.getTime()}
          }
          else if (filter.type == "select"){
            var values = [filter.value];
            if(filter.filterWithChildren) {
              for (var i = 0; i < filter.options.length; i++) {
                if (filter.options[i].value === filter.value) {
                  values = values.concat(filter.options[i].children.split(','));
                  break;
                }
              }
            }
            
            param['filter'][filter.key] = {"$in": values};
          } else param['filter'][filter.key] = {"$regex": ".*" + filter.value + ".*"}
        }
      });
      
      //call entities that match params
      return entityService.getEntities(dataTable.entityType, param).then(function (response) {
        dataTable.rows = response.data.rows;
        dataTable.selectAll = false;
        dataTable.isRowSelected = false;
        return {
          'rows': dataTable.rows,
          'header': dataTable.header,
          'pagination': response.data.pagination,
          'sortBy': dataTable.init.sortBy,
          'sortOrder': dataTable.init.sortOrder == -1 ? "dsc" : "asc"
        }
      });
    }
    
    //function to toggle detail
    dataTable.toggleRowDetails = function (row) {
      angular.forEach(dataTable.rows, function (value, key) {
        value.opened = (value.id === row.id) ? !value.opened : false;
        $scope.editFormContainer.pendingEdition = false;
      })
    };
    
    //function to call manually to reload dataTable
    dataTable.reloadCallback = function () {
      dataTable.selectAll = false;
    };
    
    //Broadcast listner to reload dataTable (on add row for exemple)
    $scope.$on('reloadDataTable', function() {
        dataTable.reloadCallback();
    });
    
    // helper to get value of en entity by accessing is property by a string 'ob1.prop1.child1'
    dataTable.getDescendantProp = function(obj, desc) {
      var arr = desc.split(".");
      while(arr.length && (obj = obj[arr.shift()]));
      return obj;
    }
        
    // call to check all unlocked selection checkbox 
    dataTable.checkAll = function () {
        angular.forEach(dataTable.rows, function (row) {
              row.selected = dataTable.selectAll;
        });
        dataTable.isRowSelected = dataTable.selectAll;
    };
    // call to uncheck the global selection checkbox
    dataTable.uncheckOne = function(){
        dataTable.selectAll = false;
        dataTable.isRowSelected = false;
        // if one still selected, isRowSelected = true
        angular.forEach(dataTable.rows, function (row) {
          if(row.selected) dataTable.isRowSelected = true;
        });
    };
    
    // Verify if an action is enable for all selected row
    dataTable.verifyCondition = function(action){
      var enable = true;
      for(var i=0; i<dataTable.rows.length && enable; i++){
        var row = dataTable.rows[i];
        if(row.selected){
          var condition = !action.condition || action.condition(row);
          enable = enable && action.global && condition;
        }
      }
      return enable;
    }
    
    // Execute an action on row after calling a popup verifying and reload table
    dataTable.prepareSingleAction = function(action, row){
      if(action.warningPopup)
        dataTable.openModal(action.callback, row);
      else {
        action.callback(row, dataTable.reloadCallback);
      }
    }
    
    // Execute an action on all selected row after calling a popup verifying
    dataTable.executeGlobalAction = function(action){
      var selected = dataTable.getSelectedId();
      dataTable.openModal(action.global, selected);
    }
    
    //Get All selected row id
    dataTable.getSelectedId = function(){
      var selected = [];
      for(var i=0; i<dataTable.rows.length; i++){
        var  row = dataTable.rows[i];
        if(row.selected)
          selected.push(row.id);
      };
      return selected;
    }
    
    //Open a modal, apply callback on OK promise and reload datatable 
    dataTable.openModal = function (action, item) {

      var modalInstance = $modal.open({
        templateUrl: 'tableModal.html',
        controller: 'ModalInstanceTableController'
      });
      modalInstance.result.then(function(){
        action(item, dataTable.reloadCallback);
      }, function () {
        // Do nothing
      });
    };
  }
  
  function ModalInstanceTableController($scope, $modalInstance) {
    $scope.ok = function () {
      $modalInstance.close(true);
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }

})(angular);