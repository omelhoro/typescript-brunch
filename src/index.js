(function() {

    var tsc = require("typescript-compiler");
    var sysPath = require("path");
    var os = require("os");
    var Promise = require('promise');

    module.exports = TypeScriptCompiler = (function() {

        TypeScriptCompiler.prototype.brunchPlugin = true;
        TypeScriptCompiler.prototype.type = "javascript";
        TypeScriptCompiler.prototype.extension = "ts";

        function TypeScriptCompiler(config) {
            this.config = config;
        }

        TypeScriptCompiler.prototype.compile = function(data, path, callback) {
            var js = "";
            var tmpDir = os.tmpdir();
            path = path.replace(/\\/g, "/");

            var promise = new Promise(function (resolve, reject) {
                if (path.slice(-5) !== ".d.ts") {
                    //compile to temporary dir because tsc-compiler cant resolve references in strings
                    var res = tsc.compile(path, "--module commonjs --outDir " + tmpDir, null, function(err) {
                        var error = err.formattedMessage + '\n';
                        reject(error);
                    });
                    var fl = Object.keys(res.sources)[0];
                    var comp = res.sources[fl];
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
        return TypeScriptCompiler;
    })();
}).call(this);
