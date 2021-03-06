"use strict"

// Module dependencies
var assert = require("chai").assert;
var ut = require("@openveo/test").generator;

// errorController.js
describe("errorController", function(){
  var request, response, errorController;
  
  beforeEach(function(){
    errorController = process.require("app/server/controllers/errorController.js");
    request = { params : {} };
    response = { locals : {} };
  });
  
  // notFoundAction method
  describe("notFoundAction", function(){

    it("Should send an error with http code 404", function(done){
      errorController.notFoundAction(request, response, function(error){
        assert.isDefined(error);
        assert.equal(error.httpCode, 404);
        done();
      });
    });
    
  });
  
  // notFoundPageAction method
  describe("notFoundPageAction", function(){

    it("Should send an HTML page with http code 404 if HTML is accepted", function(done){
      request.accepts = function(format){
        return (format === "html");
      };
      request.url = "/notFound";

      response.status = function(status){
        assert.equal(status, 404);
      };

      response.render = function(page, data){
        assert.isDefined(page);
        assert.isDefined(data);
        assert.equal(data.url, request.url);
        done();
      };

      errorController.notFoundPageAction(request, response, function(error){
        assert.ok(false);
      });
    });

    it("Should send a JSON with http code 404 if HTML is not accepted and JSON is", function(done){
      request.accepts = function(format){
        return (format === "json");
      };
      request.url = "/notFound";

      response.status = function(status){
        assert.equal(status, 404);
      };

      response.send = function(data){
        assert.isDefined(data);
        assert.isDefined(data.error);
        assert.equal(data.url, request.url);
        done();
      };

      errorController.notFoundPageAction(request, response, function(error){
        assert.ok(false);
      });
    });

    it("Should send a simple text with http code 404 if neither HTML nor JSON is accepted", function(done){
      request.accepts = function(format){
        return false;
      };
      request.url = "/notFound";

      response.status = function(status){
        assert.equal(status, 404);
      };

      response.type = function(){
        return this;
      };

      response.send = function(text){
        assert.isDefined(text);
        done();
      };

      errorController.notFoundPageAction(request, response, function(error){
        assert.ok(false);
      });
    });

  });

  // errorAction method
  describe("errorAction", function(){

    it("Should send back a JSON object with error code and module", function(done){
      
      var error = {
        httpCode: 500,
        code: 25,
        module: "core"
      };
      
      response.status = function(status){
        assert.equal(status, 500);
        return this;
      };
      
      response.send = function(data){
        assert.equal(data.error.code, 25);
        assert.equal(data.error.module, "core");
        done();
      };
      
      errorController.errorAction(error, request, response, function(){
        assert.ok(false);
      });
    });
    
    it("Should set module to core if not specified", function(done){
      
      var error = {
        httpCode: 400,
        code: 26
      };
      
      response.status = function(status){
        assert.equal(status, 400);
        return this;
      };
      
      response.send = function(data){
        assert.equal(data.error.code, 26);
        assert.equal(data.error.module, "core");
        done();
      };
      
      errorController.errorAction(error, request, response, function(){
        assert.ok(false);
      });
    });
    
    it("Should send an error 500 if no error is specified", function(done){
      
      response.status = function(status){
        assert.equal(status, 500);
        return this;
      };
      
      response.send = function(data){
        assert.equal(data.error.module, "core");
        done();
      };
      
      errorController.errorAction(null, request, response, function(){
        assert.ok(false);
      });
    });     
    
  });  

});