/**
 * Fichier de deploiement via Flightplan
 *
 * @see https://coderwall.com/p/l1dzfw
 */

var config = require('./flightplan/config'),
    archivePrefix = 'sources_',
    Flightplan = require('flightplan'),
    argv = require('minimist')(process.argv.slice(2)),
    plateform = process.argv[2].split(':')[1],
    path = require('path'),
    plan = Flightplan,
    deployDir = new Date().toISOString().replace(/T|\..+|:|-/g, ''),
    gitRepo,
    gitTag = argv.tag,
    tmpDir = path.join('build', 'tmp'),
    archiveName,
    sha1 = 'unknown',
    currentReleaseDir,
    releaseDir = path.join(config.destinationDirectory[plateform], 'release'),
    newReleaseDir = path.join(releaseDir, deployDir),
    currentReleaseLink = path.join(config.destinationDirectory[plateform], 'current');

// configuration
plan.target('preproduction', config.briefing.destinations['preproduction']);
plan.target('production', config.briefing.destinations['production']);


// run commands on localhost
plan.local(['deploy', 'package'], function (local) {
  gitRepo;
  if (gitRepo === undefined) {
    var repo = local.prompt('Would you deploy Core or Publish? [co, pu]');
    
    if(repo === "co") {
      gitRepo = config.gitCoreRepository;
      releaseDir = path.join(config.destinationDirectory[plateform], 'openveo','release');
      currentReleaseLink = path.join(config.destinationDirectory[plateform],'openveo', 'current');
    }
    else if(repo  === "pu") {
      gitRepo = config.gitPublishRepository;
      releaseDir = path.join(config.destinationDirectory[plateform], 'openveo-publish','release');
      currentReleaseLink = path.join(config.destinationDirectory[plateform],'openveo-publish', 'current');
    }
    newReleaseDir = path.join(releaseDir, deployDir);
  }

  if (gitTag === undefined) {
    gitTag = local.prompt('Enter the version number or branch git to deploy? [ex: 1.2.3]');
  }
  archiveName = archivePrefix + gitTag.replace(/\//g, '_') + '.tar.gz';
  sha1 = local.git('show-ref --hash --heads --tags ' + gitTag).stdout.replace(/[\n\t\r]/g,"");
  // Remove tmp directory
  local.rm('-rf ' + tmpDir);
  // Create tmp directory
  local.mkdir('-p ' + path.join(tmpDir, 'sources'));
  // Checkout tag and run build
  local.with('cd ' + path.join(tmpDir, 'sources'), function () {
    // Extract code from git
    local.exec('git archive --remote=' + gitRepo + ' ' + gitTag + ' | tar -x');
    // Add Version
    local.echo('"' + gitTag + '" > VERSION');
    local.echo('"' + sha1 + '" >> VERSION');
    // Compile sass
//    local.exec('compass compile PATH/TO/config-prod.rb  --force');

    // Get dependancies to deploy with source code
    if (gitTag !== 'develop') {
      local.exec('npm install --production');
    } else {
      local.exec('npm install --production');
    }
    //install core openveo-api
    if(gitRepo == config.gitCoreRepository){
      local.with('cd node_modules/openveo-api'), function(){
        local.exec('npm install --production');
      }
    }
    // Remove unused stuffs
    local.rm('-rf tests flightplan');
    // Remove non production controllers
    
    // Compress archive
    local.tar('-zcf ../../' + archiveName + ' * .??*');
  });
});

// Create remote directories
plan.remote(['deploy', 'upload'], function (remote) {
  remote.log('Pre-deploy on ' + plan.target.destination);
  remote.log('Create release folder :' + releaseDir);
  remote.mkdir('-p ' + releaseDir);
  // Directories shared between releases
  remote.mkdir('-p ' + path.join(releaseDir, '..', "shared", "config"));
  remote.mkdir('-p ' + path.join(releaseDir, '..', "shared", "log"));
});

// Upload files on remote
plan.local(['deploy', 'upload'], function (local) {
  // confirm deployment, as we don't want to do this accidentally
  var input = local.prompt('Ready for deploying to ' + releaseDir + '? [yes]');
  if (input.indexOf('yes') === -1) {
    local.abort('user canceled flight'); // this will stop the flightplan right away.
  }

  // Rsync files to all the destination's hosts
  local.log('Copy files to remote hosts');
  local.with('cd build', function () {
    local.transfer(archiveName, releaseDir);
  });
});

// Extract sources on remote hosts
plan.remote(['deploy', 'extract'], function(remote) {
  remote.log('Deploy on '+ plan.target.destination);
  // Only used if there is a disaster deploy
  currentReleaseDir = remote.exec('readlink current || echo ' + newReleaseDir, {
    failsafe: true,
    exec : { cwd : config.destinationDirectory[plateform]}
  }).stdout;

  // Create release folder and extract archive
  remote.with('cd ' + releaseDir, function () {
    remote.mkdir('-p ' + newReleaseDir);
    remote.tar('-xzf ' + archiveName + ' -C ' + newReleaseDir);
    remote.rm('-f ' + archiveName);
  });

  remote.with('cd ' + newReleaseDir, function(){
    // Link shared folders
    remote.rm('-rf log');
    remote.ln('-s ' + path.join(releaseDir,'..', 'shared', 'log') + ' ' + path.join('log'));
    
    var sharedParametersFile = path.join(releaseDir, '..', 'shared', 'config');
    remote.exec('[ "$(ls -A  '+sharedParametersFile+' )"] && echo "config already exist" || cp '+ path.join(newReleaseDir,'config','*') +' ' + sharedParametersFile);
    remote.rm('-rf config');
    remote.ln('-s ' + path.join(releaseDir,'..', 'shared', 'config') + ' ' + path.join('config'));   
  });
  
  if(gitRepo == config.gitCoreRepository){
    remote.with('cd ' + newReleaseDir + '/node_modules/', function(){
       remote.ln('-s ' + path.join(config.destinationDirectory[plateform], 'openveo-publish','current') + ' openveo-publish');
    });
  }


  // Link current folder on the new release
  remote.log('link folder to web root');
  remote.rm('-f ' + currentReleaseLink);
  remote.ln('-s ' + newReleaseDir + ' ' + currentReleaseLink);
});

// Remote provisioning
plan.remote(['provision-remote'], function(remote) {
  remote.exec("sudo npm install -g karma");
  remote.exec("sudo npm install -g bower");
});

// Rollback management
plan.remote(['rollback'], function(remote) {

  currentReleaseDir = remote.exec('readlink ' + currentReleaseLink + ' || echo', {
    failsafe: true,
    exec : { cwd : config.destinationDirectory[plateform]}
  }).stdout;

  // List available releases
  var listRelease = remote.ls('-1 ' + releaseDir, {silent: true}).stdout.split("\n");
  remote.log('List of releases:');
  for(var i=0; i < listRelease.length; i++){
    if(listRelease[i] != ''){
      remote.log('- ' + listRelease[i]);
    }
  }

  // Let choose a release and restore it
  var release = remote.prompt('Select the release to restore? [ex: 20141007092521]');
  remote.log('link folder to web root');
  remote.rm('-f ' + currentReleaseLink);
  remote.ln('-s ' + path.join(releaseDir, release) + ' ' + currentReleaseLink);

  if(currentReleaseDir != ''){
    // We can delete the release that failed
    var input = remote.prompt('Do you want to delete the broken release (' + currentReleaseDir + ')? [yes/no]');
    if (input === 'yes') {
      remote.rm('-rf ' + currentReleaseDir);
    }
  }

  // Actions after sources rollback
  remote.with('cd '+ path.join(releaseDir, release), function(){
    var input = remote.prompt('Do you want to migrate down database ? [yes/no]');
    if (input === 'yes') {
      remote.exec('mongorestore dump/*.bson');
    }
  });
});

// If something went wrong...
// plan.disaster(function () {
//   if(currentReleaseDir !== undefined){
//     plan.logger.info('The previous release was:' + currentReleaseDir)
//   }
//   plan.logger.error('To rollback use this command:'.error + ' "node ./node_modules/flightplan/bin/fly.js rollback:' + plan.target.destination + '"');
// });