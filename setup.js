var exec = require('child_process').exec;
var sysPath = require('path');
var fs = require('fs-extra');
var mv = require('mv');
var mode = process.argv[2];

var fsExists = fs.exists || sysPath.exists;

var execute = function (pathParts, params, callback) {
    if (callback == null) callback = function () { };
    var path = sysPath.join.apply(null, pathParts);
    var command = 'node ' + path + ' ' + params;
    console.log('Executing', command);
    exec(command, function (error, stdout, stderr) {
        if (error != null) return process.stderr.write(stderr.toString());
        console.log(stdout.toString());
        callback();
    });
};

if (mode === 'postinstall') {
    fsExists(sysPath.join(__dirname, 'lib'), function (exists) {
        if (exists) return;
        var libDir = sysPath.join(__dirname, 'lib');
        fs.mkdirSync(libDir);
        fs.copy(sysPath.join(__dirname, 'src', 'io.js'), sysPath.join(libDir, 'io.js'), function () {
            var modifiedFile = sysPath.join(libDir, 'typescript.js');
            execute(['node_modules', 'typescript', 'bin', 'tsc'], 'src/index.ts', function () {
                ['index.js', 'io.js', 'compiler.js'].forEach(function(f) { mv('src/' + f, 'lib/' + f, function () { }); });
                // Snippet borrowed from Ekin Koc (https://github.com/eknkc/typescript-require)
                var contents = [
                  '(function() {',
                  fs.readFileSync(sysPath.join(__dirname, '/node_modules/typescript/bin/typescript.js'), 'utf8'),
                  'module.exports = TypeScript;',
                  '}).call({});'
                ].join('');
                fs.writeFileSync(modifiedFile, contents, 'utf8');
            });
        });
    });
}
else if (mode === 'test') {
    execute(['node_modules', 'mocha', 'bin', 'mocha'],
      '--require test/common.js --colors');
}
