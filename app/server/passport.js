"use strict"

// Module dependencies
var passport = require("passport");
var openVeoAPI = require("openveo-api");
var LocalStrategy = require("passport-local").Strategy;
var UserModel = process.require("app/server/models/UserModel.js");
var RoleModel = process.require("app/server/models/RoleModel.js");
var applicationStorage = openVeoAPI.applicationStorage;

var userModel = new UserModel();
var roleModel = new RoleModel();

// Define a passport authentication strategy.
// "email" and "password" field must be send using a POST
// request to authenticate.
passport.use(new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password"
  },
  function(email, password, done){
    userModel.getUserByCredentials(email, password, function(error, user){
      if(error)
        done(null, false);
      else
        getUserRoles(user, done);
    });
  }
));

// In order to support login sessions, Passport serialize and 
// deserialize user instances to and from the session.
// Only the user ID is serialized to the session.
passport.serializeUser(function(user, done){
  done(null, user.id);
});

// When subsequent requests are received, the ID is used to find
// the user, which will be restored to req.user.
passport.deserializeUser(function(id, done){
  userModel.getOne(id, function(error, user){
    if(error)
      done(null, false);
    else
      getUserRoles(user, done);
  });
});

/**
 * Gets user roles details.
 * @param Object user The user
 * @param Function callback Function to call when its done
 *  - Error An error if something went wrong, null otherwise
 *  - Object The upgraded user with roles details
 */
function getUserRoles(user, callback){
  
  // Get user permissions by roles
  if(user.roles){
    
    var ids = [];
     for(var id in user.roles)
       ids.push(id);    
    
    roleModel.getByIds(ids, function(error, roles){
      if(error)
        callback(null, false);
      else{
        user.roles = roles;
        callback(null, user);
      }
    });
  }
  
}