(function() {

    //var TypeScript = require("typescript");
    // var TypeScriptAPI = require("typescript.api");
    var tsc = require("typescript-compiler");
    var sysPath = require("path");
    var os = require("os")

    function show_diagnostics(units, callback) {

        for (var n in units) {
            for (var m in units[n].diagnostics) {
                var errorMsg = units[n].diagnostics[m].toString();
                callback(errorMsg, null);
            }
        }
    }

    module.exports = TypeScriptCompiler = (function() {

        TypeScriptCompiler.prototype.brunchPlugin = true;
        TypeScriptCompiler.prototype.type = "javascript";
        TypeScriptCompiler.prototype.extension = "ts";

        function TypeScriptCompiler(config) {

            this.config = config;
            //this.libPath = sysPath.join(__dirname, "..", "node_modules", "typescript", "bin", "lib.d.ts");
        }

        TypeScriptCompiler.prototype.compile = function(data, path, callback) {

            var js = "";
            var error = null;
            var outputWriter = {
                Write: function(str) {
                    js += str;
                },
                WriteLine: function(str) {
                    js += str + "\n";
                },
                Close: function() {}
            };
            var nullWriter = {
                Write: function(str) {},
                WriteLine: function(str) {},
                Close: function() {}
            };

            path = path.replace(/\\/g, "/");
            var tmpDir = os.tmpdir()

            function compile() {
                var error
                    //compile to temporary dir because tsc-compiler cant resolve references in strings
                var res = tsc.compile(path, "--module commonjs --outDir " + tmpDir, null, function(err) {
                    error += err.messageText
                })
                var fl = Object.keys(res.sources)[0]
                var comp = res.sources[fl]
                js += comp
            }

            try {
                path.slice(-5) === ".d.ts" ? null : compile()
            } catch (err) {
                // error += err.stack;
            } finally {
                callback(error, js);
            }
        };
        return TypeScriptCompiler;
    })();
}).call(this);
