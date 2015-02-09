(function() {

    var tsc = require("typescript-compiler");
    var sysPath = require("path");
    var os = require("os");
    var Promise = require('promise');

    function TypeScriptCompiler(config) {
        this.config = config;
    }

    TypeScriptCompiler.prototype.brunchPlugin = true;
    TypeScriptCompiler.prototype.type = "javascript";
    TypeScriptCompiler.prototype.extension = "ts";

    TypeScriptCompiler.prototype.compile = function(data, path, callback) {
        var js = "";
        var tmpDir = os.tmpDir();
        path = path.replace(/\\/g, "/");

        var promise = new Promise(function (resolve, reject) {
            if (path.slice(-5) !== ".d.ts") {
                //compile to temporary dir because tsc-compiler cant resolve references in strings
                var result = tsc.compile(path, "--module commonjs --outDir " + tmpDir, null, function(err) {
                    var error = err.formattedMessage + '\n';
                    reject(error);
                });
                var fileName = null;
                var sourceFiles = Object.keys(result.sources);
                for(var i = 0; i < sourceFiles.length; i++) {
                    if (sysPath.basename(sourceFiles[i], '.js') == sysPath.basename(path, '.ts')) {
                        fileName = sourceFiles[i];
                    }
                }
                var comp = result.sources[fileName];
                js += comp;
                resolve(js);
            }
        });

        promise.then(function(result) {
            callback(null, result);
        }, function(error) {
            callback(error);
        })
    };

    module.exports = TypeScriptCompiler;
}).call(this);
