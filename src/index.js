(function() {

    var TypeScript = require("./typescript.js");
    var Compiler = require("./compiler.js");
    var IO = require("./io.js");
    var sysPath = require("path");

    module.exports = TypeScriptCompiler = (function () {
        
        TypeScriptCompiler.prototype.brunchPlugin = true;
        TypeScriptCompiler.prototype.type = "javascript";
        TypeScriptCompiler.prototype.extension = "ts";

        function TypeScriptCompiler(config) {
            console.log("here");
            this.config = config;
            
            this.compilationSettings = new TypeScript.CompilationSettings();
            this.compilationSettings.codeGenTarget = TypeScript.CodeGenTarget.ES5;
            this.compilationSettings.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous;
            this.compilationSettings.useDefaultLib = false;
            this.compilationSettings.resolve = true;

            this.libPath = sysPath.join(__dirname, "..", "node_modules", "typescript", "bin", "lib.d.ts");
        }
        
        TypeScriptCompiler.prototype.compile = function (data, path, callback) {
            var js = "";
            var error = null;
            var io = IO;
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
            path = TypeScript.switchToForwardSlashes(path);
            io.createFile = function (fileName, useUTF8) {
                if(fileName.match(new RegExp(path.replace(/\.ts$/, ".js")))) {
                    return outputWriter;
                } else {
                    return nullWriter;
                }
            };
            // TypeScript.CompilerDiagnostics.debug = true;
            // TypeScript.CompilerDiagnostics.diagnosticWriter = {
            //     Alert: function (s) {
            //         io.printLine(s);
            //     }
            // };
            try  {
                var batchCompiler = new Compiler.Compiler.BatchCompiler(io, this.compilationSettings);
                batchCompiler.batchCompile([
                    new TypeScript.SourceUnit(this.libPath, null),
                    new TypeScript.SourceUnit(path, data)
                ]);
            } catch (err) {
                error = err.stack;
            }finally {
                callback(error, js);
            }
        };

        return TypeScriptCompiler;
    })();

}).call(this);