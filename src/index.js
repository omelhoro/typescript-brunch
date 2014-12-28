(function() {

    //var TypeScript = require("typescript");
    // var TypeScriptAPI = require("typescript.api");
    var tsc=require("typescript-compiler");
    var sysPath = require("path");

    function show_diagnostics (units, callback) {

        for(var n in units) {
            for(var m in units[n].diagnostics) {
                var errorMsg = units[n].diagnostics[m].toString();
                callback(errorMsg, null);
            }
        }
    }

    module.exports = TypeScriptCompiler = (function () {
        
        TypeScriptCompiler.prototype.brunchPlugin = true;
        TypeScriptCompiler.prototype.type = "javascript";
        TypeScriptCompiler.prototype.extension = "ts";

        function TypeScriptCompiler(config) {

            this.config = config;
            //this.libPath = sysPath.join(__dirname, "..", "node_modules", "typescript", "bin", "lib.d.ts");
        }
        
        TypeScriptCompiler.prototype.compile = function (data, path, callback) {

            var js = "";
            var error = null;
            var outputWriter = {
                Write: function (str) {
                    js += str;
                },
                WriteLine: function (str) {
                    js += str + "\n";
                },
                Close: function () {
                }
            };
            var nullWriter = {
                Write: function (str) {
                },
                WriteLine: function (str) {
                },
                Close: function () {
                }
            };

            path = path.replace(/\\/g, "/");

            try  {
                var error
                var res=tsc.compile(path,"--module commonjs --outDir /tmp/",null,function(err){
                    // console.log(Object.keys(err),err.messageText),
                    error+=err.messageText
                    // callback(err.messageText,null)
                })
                var fl=Object.keys(res.sources)[0]
                var comp=res.sources[fl]
                // console.log(comp)
                js+=comp
                // return callback(null,{data: comp })
                // TypeScriptAPI.resolve([path], function(resolved) {
                //     if (TypeScriptAPI.check(resolved)) {
                //         TypeScriptAPI.compile(resolved, function(compiled) {
                //             if(!TypeScriptAPI.check(compiled)) {
                //                 show_diagnostics (compiled, callback);
                //             }
                //             else {
                //                 for (var compileUnit in compiled) {
                //                     callback(null, compiled[compileUnit].content);
                //                 }
                //             }
                //         });
                //     }
                //     else {
                //         show_diagnostics(resolved, callback);
                //     }
                // });
            } 
            catch (err) {
                // error += err.stack;
            }
            finally {
                callback(error, js);
            }
        };
        return TypeScriptCompiler;
    })();
}).call(this);
